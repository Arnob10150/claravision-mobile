/**
 * ClaraVision mobile inference client.
 *
 * Set EXPO_PUBLIC_INFERENCE_API_URL to your Railway FastAPI service URL.
 * Example: https://your-service.up.railway.app
 */

export type DiseaseClass =
  | 'Diabetic Retinopathy' | 'Media Hazy' | 'Myopic Retinopathy'
  | 'Optic Disc Disorder' | 'Normal'

export type UncertaintyLevel = 'low' | 'medium' | 'high'

export interface DifferentialDiagnosis {
  disease: DiseaseClass
  probability: number
  ruled_out_because: string
}

export interface InferenceResult {
  predicted_class: DiseaseClass
  confidence: number
  uncertainty_score: number
  uncertainty_level: UncertaintyLevel
  all_probabilities: Record<DiseaseClass, number>
  activated_concepts: { name: string; confidence: number; description: string }[]
  supporting_reasons: string[]
  differential: DifferentialDiagnosis[]
  referral_flag: boolean
  analysis_id: string
  processing_time_ms: number
}

const DISEASES: DiseaseClass[] = [
  'Diabetic Retinopathy','Media Hazy','Myopic Retinopathy','Optic Disc Disorder','Normal',
]

const CONCEPT_DESCRIPTIONS: Record<string, string> = {
  Microaneurysms: 'Small capillary outpouchings commonly associated with diabetic retinopathy.',
  Hemorrhages: 'Retinal bleeding patterns that can support vascular pathology.',
  'Hard exudates': 'Lipid deposits caused by vascular leakage.',
  'Media opacity': 'Reduced fundus visibility from optical media haze.',
  'Macular changes': 'Structural macular findings that influence classification.',
  'Cup-to-disc ratio enlargement': 'Optic nerve head finding associated with glaucomatous change.',
  'Optic disc pallor': 'Pale optic disc appearance suggesting optic nerve dysfunction.',
}

type ApiProbability = { label: string; probability: number }
type ApiConcept = { concept?: string; name?: string; score?: number; confidence?: number; region?: string | null } | string
type ApiReason = { title?: string; text?: string } | string
type ApiDifferential = {
  label?: string
  disease?: string
  probability: number
  ruledOutBecause?: string
  ruled_out_because?: string
}

type ApiPrediction = {
  predicted_class: string
  confidence: number
  uncertainty_score: number
  uncertainty_level: UncertaintyLevel
  probabilities?: ApiProbability[] | Record<string, number>
  all_probabilities?: Record<string, number>
  activated_concepts?: ApiConcept[]
  supporting_reasons?: ApiReason[]
  differential?: ApiDifferential[]
  referral_flag: boolean
}

function inferenceBaseUrl() {
  const url = process.env.EXPO_PUBLIC_INFERENCE_API_URL
  if (!url) {
    throw new Error('EXPO_PUBLIC_INFERENCE_API_URL is required to run trained model inference.')
  }
  return url.replace(/\/$/, '')
}

function localApiHint(url: string) {
  if (url.includes('10.0.2.2')) {
    return ' The current URL only works from an Android emulator when the FastAPI model server is running on this PC.'
  }
  if (url.includes('127.0.0.1') || url.includes('localhost')) {
    return ' Localhost points to the phone/emulator itself; use your PC LAN IP or a deployed Railway URL.'
  }
  return ''
}

function uploadNameFromUri(uri: string) {
  const cleanUri = uri.split('?')[0] ?? uri
  const rawName = cleanUri.split('/').pop()
  return rawName && rawName.includes('.') ? decodeURIComponent(rawName) : 'fundus-image.jpg'
}

function mimeTypeFromName(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return 'image/jpeg'
}

function normalizeProbabilities(api: ApiPrediction): Record<DiseaseClass, number> {
  const out = Object.fromEntries(DISEASES.map(disease => [disease, 0])) as Record<DiseaseClass, number>

  if (api.all_probabilities) {
    for (const [label, value] of Object.entries(api.all_probabilities)) {
      if (DISEASES.includes(label as DiseaseClass)) out[label as DiseaseClass] = Number(value)
    }
  }

  if (Array.isArray(api.probabilities)) {
    for (const item of api.probabilities) {
      if (DISEASES.includes(item.label as DiseaseClass)) out[item.label as DiseaseClass] = Number(item.probability)
    }
  } else if (api.probabilities) {
    for (const [label, value] of Object.entries(api.probabilities)) {
      if (DISEASES.includes(label as DiseaseClass)) out[label as DiseaseClass] = Number(value)
    }
  }

  return out
}

function mapPrediction(api: ApiPrediction, startedAt: number): InferenceResult {
  return {
    predicted_class: api.predicted_class as DiseaseClass,
    confidence: Number(api.confidence),
    uncertainty_score: Number(api.uncertainty_score),
    uncertainty_level: api.uncertainty_level,
    all_probabilities: normalizeProbabilities(api),
    activated_concepts: (api.activated_concepts ?? []).map(item => {
      if (typeof item === 'string') {
        return {
          name: item,
          confidence: 0,
          description: CONCEPT_DESCRIPTIONS[item] ?? 'Activated by the trained inference model.',
        }
      }
      const name = item.name ?? item.concept ?? 'Model concept'
      return {
        name,
        confidence: Number(item.confidence ?? item.score ?? 0),
        description: CONCEPT_DESCRIPTIONS[name] ?? (item.region ? `Activated around ${item.region}.` : 'Activated by the trained inference model.'),
      }
    }),
    supporting_reasons: (api.supporting_reasons ?? []).map(reason => typeof reason === 'string' ? reason : reason.text ?? reason.title ?? ''),
    differential: (api.differential ?? []).map(item => ({
      disease: (item.disease ?? item.label ?? 'Normal') as DiseaseClass,
      probability: Number(item.probability),
      ruled_out_because: item.ruled_out_because ?? item.ruledOutBecause ?? 'Lower model posterior than the primary prediction.',
    })),
    referral_flag: Boolean(api.referral_flag),
    analysis_id: `CV-${Date.now().toString(36).toUpperCase()}`,
    processing_time_ms: Date.now() - startedAt,
  }
}

export async function analyzeImageUri(uri: string): Promise<InferenceResult> {
  const startedAt = Date.now()
  const baseUrl = inferenceBaseUrl()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  const form = new FormData()
  const uploadName = uploadNameFromUri(uri)

  form.append('file', {
    uri,
    name: uploadName,
    type: mimeTypeFromName(uploadName),
  } as unknown as Blob)

  let response: Response
  try {
    response = await fetch(`${baseUrl}/predict`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    })
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? `Inference request timed out after 30 seconds.${localApiHint(baseUrl)}`
      : `Could not reach the inference server at ${baseUrl}.${localApiHint(baseUrl)}`
    throw new Error(message)
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Inference request failed (${response.status})${detail ? `: ${detail}` : ''}`)
  }

  return mapPrediction(await response.json() as ApiPrediction, startedAt)
}
