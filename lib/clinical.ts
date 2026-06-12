/**
 * ClaraVision Clinical Reference Data
 * Disease staging, ICD-10 codes, treatment guidelines, follow-up intervals,
 * and Grad-CAM anatomical region annotations.
 * All content is drawn from published clinical guidelines (AAO PPP, NICE, WHO).
 */

import type { DiseaseClass } from './inference'

// ── Severity / treatment priority ────────────────────────────────────────────
export type TreatmentPriority = 'urgent' | 'soon' | 'routine' | 'monitor'

export interface DiseaseStage {
  grade: string
  shortLabel: string
  icd10: string
  description: string
  prevalence: string   // rough epidemiological note
}

export interface ClinicalGuidance {
  stages: DiseaseStage[]
  /** Map stage.grade → ordered treatment steps */
  treatmentByStage: Record<string, string[]>
  /** Map stage.grade → weeks until next review */
  followUpWeeksByStage: Record<string, number>
  /** Map stage.grade → priority */
  priorityByStage: Record<string, TreatmentPriority>
  /** Overview for the disease */
  overview: string
  specialistType: string
}

// ── Full clinical guidance per disease ───────────────────────────────────────
export const CLINICAL_GUIDANCE: Partial<Record<DiseaseClass, ClinicalGuidance>> = {

  'Diabetic Retinopathy': {
    overview: 'Diabetic retinopathy (DR) is a microvascular complication of diabetes and the leading cause of preventable blindness in working-age adults globally.',
    specialistType: 'Medical Retina Specialist',
    stages: [
      { grade: 'Mild NPDR',     shortLabel: 'Mild',     icd10: 'E11.319', description: 'Microaneurysms only — no haemorrhages or exudates',                                               prevalence: '~25% of T2DM at diagnosis' },
      { grade: 'Moderate NPDR', shortLabel: 'Moderate', icd10: 'E11.329', description: 'Microaneurysms + dot/blot haemorrhages and/or hard exudates, not fulfilling severe criteria',       prevalence: '~40% of DR cases' },
      { grade: 'Severe NPDR',   shortLabel: 'Severe',   icd10: 'E11.349', description: '4-2-1 rule: haemorrhages in ≥4 quadrants, or venous beading in ≥2, or IRMA in ≥1 quadrant',       prevalence: 'High risk of progression to PDR in 1 year' },
      { grade: 'PDR',           shortLabel: 'PDR',      icd10: 'E11.359', description: 'Neovascularisation of disc (NVD) or elsewhere (NVE); vitreous or pre-retinal haemorrhage possible', prevalence: '5–10% of DR; sight-threatening without treatment' },
    ],
    treatmentByStage: {
      'Mild NPDR':     ['Optimise glycaemic control (target HbA1c < 7.0%)', 'Blood pressure < 130/80 mmHg', 'Annual dilated fundus examination', 'Lipid management per guidelines'],
      'Moderate NPDR': ['Quarterly ophthalmology review', 'OCT macula to screen for CSME', 'Anti-VEGF injection if CSME confirmed (ETDRS threshold)', 'Tight glycaemic and BP control'],
      'Severe NPDR':   ['Ophthalmology referral within 1–2 weeks', 'Consider prophylactic panretinal photocoagulation (PRP)', 'Anti-VEGF for diabetic macular oedema', 'HbA1c optimisation — risk of early worsening on rapid improvement'],
      'PDR':           ['URGENT referral ≤ 1 week', 'Panretinal photocoagulation (PRP) is standard of care', 'Anti-VEGF (ranibizumab / aflibercept) as adjunct or monotherapy', 'Pars plana vitrectomy if vitreous haemorrhage does not clear or tractional RD'],
    },
    followUpWeeksByStage: { 'Mild NPDR': 52, 'Moderate NPDR': 13, 'Severe NPDR': 4, 'PDR': 1 },
    priorityByStage:      { 'Mild NPDR': 'monitor', 'Moderate NPDR': 'routine', 'Severe NPDR': 'soon', 'PDR': 'urgent' },
  },

  'Myopic Retinopathy': {
    overview: 'Pathological myopia (PM) is defined as axial length > 26 mm or refraction worse than −6.0D with structural myopic maculopathy. It is the leading cause of blindness in East Asia.',
    specialistType: 'Medical Retina / Vitreoretinal Specialist',
    stages: [
      { grade: 'Tessellated Fundus', shortLabel: 'Tessellated',  icd10: 'H44.23', description: 'Visible choroidal vessels due to RPE/choroidal thinning — no maculopathy',       prevalence: 'Early stage PM' },
      { grade: 'Diffuse Atrophy',    shortLabel: 'Diffuse Atr.', icd10: 'H44.23', description: 'Diffuse RPE and choroidal atrophy involving the posterior pole',                  prevalence: 'META-PM Category M2' },
      { grade: 'Patchy Atrophy',     shortLabel: 'Patchy Atr.',  icd10: 'H44.23', description: 'Well-defined patchy areas of RPE and choriocapillaris atrophy',                   prevalence: 'META-PM Category M3; significant VA threat' },
      { grade: 'Macular Atrophy',    shortLabel: 'Macular Atr.', icd10: 'H44.23', description: 'Complete atrophy involving the fovea; also includes myopic CNV if present',       prevalence: 'META-PM Category M4; poor VA prognosis' },
    ],
    treatmentByStage: {
      'Tessellated Fundus': ['Baseline OCT and fundus photo documentation', 'Annual review', 'Advise on warning symptoms (metamorphopsia, new floaters, flashes)'],
      'Diffuse Atrophy':    ['6-monthly OCT macula', 'Screen for myopic CNV (OCT-A)', 'Low vision assessment if VA < 6/18', 'Protective spectacles for high-impact sport'],
      'Patchy Atrophy':     ['Quarterly review', 'Anti-VEGF if CNV confirmed', 'Genetic counselling if early-onset', 'Low vision rehabilitation referral'],
      'Macular Atrophy':    ['Anti-VEGF for active CNV only (no treatment for atrophy itself)', 'Low vision rehabilitation', 'Eccentric viewing training', 'Registration for visual impairment if criteria met'],
    },
    followUpWeeksByStage: { 'Tessellated Fundus': 52, 'Diffuse Atrophy': 26, 'Patchy Atrophy': 13, 'Macular Atrophy': 13 },
    priorityByStage:      { 'Tessellated Fundus': 'monitor', 'Diffuse Atrophy': 'routine', 'Patchy Atrophy': 'routine', 'Macular Atrophy': 'soon' },
  },

  'Optic Disc Disorder': {
    overview: 'Optic disc disorders encompass a range of conditions including optic neuritis, anterior ischaemic optic neuropathy (AION), optic disc drusen, and papilloedema.',
    specialistType: 'Neuro-Ophthalmologist',
    stages: [
      { grade: 'Optic Disc Drusen', shortLabel: 'Drusen',      icd10: 'H47.39', description: 'Calcified hyaline deposits at the optic disc; pseudo-papilloedema appearance',       prevalence: 'Autosomal dominant; ~1–2% prevalence' },
      { grade: 'Optic Neuropathy',  shortLabel: 'Neuropathy',  icd10: 'H46.9',  description: 'Pale, swollen, or atrophic disc — indicates neural insult (ischaemia, inflammation)', prevalence: 'Varies by aetiology' },
      { grade: 'Papilloedema',      shortLabel: 'Papilloedema',icd10: 'H47.10', description: 'Bilateral disc swelling secondary to raised intracranial pressure — URGENT',          prevalence: 'Always urgent to exclude space-occupying lesion' },
    ],
    treatmentByStage: {
      'Optic Disc Drusen': ['Annual visual field monitoring', 'OCT optic nerve head annually', 'Advise on risk of peripheral field loss', 'No active treatment — monitor only'],
      'Optic Neuropathy':  ['Urgent neuro-ophthalmic evaluation', 'MRI brain and orbits with contrast', 'IV methylprednisolone if acute demyelinating ON (ONTT protocol)', 'ESR/CRP, FBC, GCA screen if > 50 years old'],
      'Papilloedema':      ['EMERGENCY — CT head immediately to exclude raised ICP', 'Neurological and neurosurgical assessment', 'Lumbar puncture if CT clear', 'Acetazolamide for IIH'],
    },
    followUpWeeksByStage: { 'Optic Disc Drusen': 52, 'Optic Neuropathy': 1, 'Papilloedema': 0 },
    priorityByStage:      { 'Optic Disc Drusen': 'monitor', 'Optic Neuropathy': 'urgent', 'Papilloedema': 'urgent' },
  },

  'Media Hazy': {
    overview: 'Media opacity (corneal, lenticular, or vitreous) attenuates fundus visibility and limits the diagnostic reliability of any AI retinal assessment.',
    specialistType: 'General Ophthalmologist / Anterior Segment Specialist',
    stages: [
      { grade: 'Mild Haze',     shortLabel: 'Mild',     icd10: 'H57.89', description: 'Fundus structures visible but with reduced clarity; some diagnostic loss',     prevalence: 'Common in nuclear sclerosis LOCS II' },
      { grade: 'Moderate Haze', shortLabel: 'Moderate', icd10: 'H57.89', description: 'Significant attenuation; posterior segment incompletely assessed',               prevalence: 'LOCS III+ or moderate vitreous opacity' },
      { grade: 'Dense Haze',    shortLabel: 'Dense',    icd10: 'H57.89', description: 'Fundus details not assessable; AI result unreliable — repeat after clarification', prevalence: 'Dense cataract, vitreous haemorrhage' },
    ],
    treatmentByStage: {
      'Mild Haze':     ['Proceed with clinical assessment — note reduced AI reliability', 'Cataract grading if lenticular cause suspected', 'Repeat imaging post-dilation'],
      'Moderate Haze': ['Do not rely on AI output — direct clinician examination required', 'B-scan ultrasound to assess posterior segment', 'Treat underlying opacity (cataract referral / vitreous haemorrhage investigation)'],
      'Dense Haze':    ['AI result must NOT inform clinical decisions until media cleared', 'B-scan USS mandatory', 'Urgent cataract or vitreoretinal surgical referral as appropriate', 'Treat primary cause of opacity (DM, trauma, haemorrhage)'],
    },
    followUpWeeksByStage: { 'Mild Haze': 13, 'Moderate Haze': 4, 'Dense Haze': 2 },
    priorityByStage:      { 'Mild Haze': 'routine', 'Moderate Haze': 'soon', 'Dense Haze': 'urgent' },
  },

  'Normal': {
    overview: 'No significant retinal pathology detected. Routine screening interval is appropriate for age and systemic risk factors.',
    specialistType: 'Routine Screening / Optometrist',
    stages: [
      { grade: 'Normal — Low Risk',      shortLabel: 'Low Risk',  icd10: 'Z01.01', description: 'No fundus pathology; no systemic risk factors for retinal disease',        prevalence: 'Healthy adult population' },
      { grade: 'Normal — Moderate Risk', shortLabel: 'Mod. Risk', icd10: 'Z01.01', description: 'Normal fundus but systemic risk (DM, HTN, family history of glaucoma)',   prevalence: 'Screened populations with comorbidities' },
    ],
    treatmentByStage: {
      'Normal — Low Risk':      ['Routine screening per national guidelines (every 2 years in UK)', 'Lifestyle advice: smoking cessation, UV protection, omega-3 diet', 'Update spectacle prescription if needed'],
      'Normal — Moderate Risk': ['Annual dilated fundus examination given systemic risk', 'Baseline OCT and Humphrey visual field', 'Treat systemic risk factors aggressively', 'Patient education on warning symptoms: flashes, floaters, curtain/shadow'],
    },
    followUpWeeksByStage: { 'Normal — Low Risk': 104, 'Normal — Moderate Risk': 52 },
    priorityByStage:      { 'Normal — Low Risk': 'monitor', 'Normal — Moderate Risk': 'monitor' },
  },
}

// ── Derive staging from AI confidence and findings ────────────────────────────
export function deriveStage(
  disease: DiseaseClass,
  confidence: number,
  concepts: string[]
): { stage: DiseaseStage | null; guidance: ClinicalGuidance | null } {
  const g = CLINICAL_GUIDANCE[disease]
  if (!g) return { stage: null, guidance: null }

  const stages = g.stages
  let stageIdx = 0

  // Use confidence and concept names as proxy for severity
  const conceptStr = concepts.join(' ').toLowerCase()

  if (disease === 'Diabetic Retinopathy') {
    if (conceptStr.includes('neovascular') || confidence < 0.70) stageIdx = 3        // PDR
    else if (conceptStr.includes('irma') || confidence < 0.78)    stageIdx = 2        // Severe NPDR
    else if (conceptStr.includes('exudate') && conceptStr.includes('haem')) stageIdx = 1 // Moderate
    else stageIdx = 0                                                                  // Mild
  } else if (disease === 'Media Hazy') {
    if (confidence > 0.85) stageIdx = 2       // Dense
    else if (confidence > 0.70) stageIdx = 1  // Moderate
    else stageIdx = 0                          // Mild
  } else if (disease === 'Normal') {
    stageIdx = 0  // default low-risk; clinician can override if comorbidities present
  } else {
    // Default: map confidence quartiles to stage index
    const n = stages.length
    stageIdx = Math.min(n - 1, Math.floor((1 - confidence) * n))
  }

  return { stage: stages[stageIdx] ?? stages[0], guidance: g }
}

// ── Grad-CAM region annotations ───────────────────────────────────────────────
export interface GradCamRegion {
  id: string
  label: string
  cx: number   // centre x as % of image width
  cy: number   // centre y as % of image height
  radius: number // radius as % of image width
  color: string
  significance: string
  clinicalNote: string
}

export const GRAD_CAM_REGIONS_BY_DISEASE: Record<DiseaseClass, GradCamRegion[]> = {
  'Diabetic Retinopathy': [
    { id: 'mac', label: 'Macula / Fovea',    cx: 50, cy: 50, radius: 12, color: '#ef4444', significance: 'High', clinicalNote: 'Primary site for diabetic macular oedema (DME). Hard exudate clustering within 500 µm of fovea fulfils CSME criteria — anti-VEGF indicated.' },
    { id: 'tmp', label: 'Temporal Quadrant', cx: 68, cy: 48, radius: 10, color: '#f97316', significance: 'High', clinicalNote: 'Temporal quadrant haemorrhages and microaneurysms are among the earliest DR signs (ETDRS standard field 2).' },
    { id: 'nas', label: 'Nasal Quadrant',    cx: 32, cy: 48, radius: 9,  color: '#f97316', significance: 'Medium', clinicalNote: 'Nasal quadrant neovascularisation (NVE) indicates progression toward proliferative DR.' },
    { id: 'odc', label: 'Optic Disc',        cx: 28, cy: 50, radius: 8,  color: '#eab308', significance: 'Medium', clinicalNote: 'NVD (neovascularisation of the disc) is the most sight-threatening sign in PDR — defines PDR if present.' },
  ],
  'Myopic Retinopathy': [
    { id: 'mac', label: 'Myopic Macula',     cx: 50, cy: 50, radius: 14, color: '#8b5cf6', significance: 'High', clinicalNote: 'Focal choroidal atrophy, lacquer crack, or myopic CNV at the foveal centre. Myopic CNV is smaller and more subtle than AMD-related CNV.' },
    { id: 'pap', label: 'Temporal Crescent', cx: 33, cy: 50, radius: 10, color: '#a855f7', significance: 'Medium', clinicalNote: 'Temporal (peripapillary) atrophic crescent indicating scleral stretching. Gamma-zone PPA beyond beta-zone is associated with PM.' },
    { id: 'lac', label: 'Lacquer Cracks',    cx: 54, cy: 44, radius: 7,  color: '#ec4899', significance: 'High', clinicalNote: 'Linear breaks in Bruch\'s membrane — high-risk site for myopic CNV development. Any sub-retinal fluid here requires urgent OCT.' },
  ],
  'Optic Disc Disorder': [
    { id: 'odc', label: 'Optic Disc Head',   cx: 28, cy: 50, radius: 14, color: '#ef4444', significance: 'High', clinicalNote: 'Pale, swollen, or drusenoid disc. Bilateral disc oedema with intact vessels = papilloedema until proven otherwise — EMERGENCY investigation.' },
    { id: 'rim', label: 'Disc Rim Tissue',   cx: 32, cy: 50, radius: 8,  color: '#f97316', significance: 'High', clinicalNote: 'Pallor of neuroretinal rim tissue confirms optic atrophy. Diffuse pallor = toxic/nutritional; sectoral = ischaemic (AION); temporal = demyelinating ON.' },
  ],
  'Media Hazy': [
    { id: 'cen', label: 'Central Opacity',   cx: 50, cy: 50, radius: 22, color: '#94a3b8', significance: 'Medium', clinicalNote: 'Central media opacity significantly degrades image quality. AI confidence is reduced — all findings should be interpreted with caution and verified by direct clinical examination.' },
  ],
  'Normal': [
    { id: 'odc', label: 'Optic Disc',        cx: 28, cy: 50, radius: 9,  color: '#22c55e', significance: 'Normal', clinicalNote: 'Normal optic disc: pink rim tissue, C/D ≤ 0.5, sharp margins. Symmetrical with fellow eye.' },
    { id: 'mac', label: 'Macula / Fovea',    cx: 50, cy: 50, radius: 8,  color: '#22c55e', significance: 'Normal', clinicalNote: 'Normal foveal reflex. No drusen, haemorrhages, or exudates within the macular region (2 disc diameters from foveal centre).' },
    { id: 'vas', label: 'Vasculature',        cx: 40, cy: 44, radius: 6,  color: '#22c55e', significance: 'Normal', clinicalNote: 'Normal A/V ratio ~2:3. No AV nicking, arteriolar attenuation, or vascular abnormalities.' },
  ],
}

// ── Risk Calculators ──────────────────────────────────────────────────────────
export interface RiskInput {
  age: number
  hba1c?: number         // % (for DR)
  diabetesDuration?: number // years
  systolicBP?: number
  iop?: number           // mmHg (for Glaucoma)
  cdr?: number           // cup-to-disc ratio
  familyHistoryGlaucoma?: boolean
  smoker?: boolean
}

export function calculateDRRisk(input: RiskInput): { score: number; riskLevel: 'Low' | 'Moderate' | 'High'; factors: string[] } {
  let score = 0
  const factors: string[] = []

  if (input.hba1c) {
    if (input.hba1c > 10) { score += 30; factors.push(`HbA1c ${input.hba1c}% (very high — target < 7%)`) }
    else if (input.hba1c > 8) { score += 20; factors.push(`HbA1c ${input.hba1c}% (elevated — tighten control)`) }
    else if (input.hba1c > 7) { score += 10; factors.push(`HbA1c ${input.hba1c}% (above target — optimise)`) }
    else factors.push(`HbA1c ${input.hba1c}% (at target ✓)`)
  }
  if (input.diabetesDuration) {
    if (input.diabetesDuration > 20) { score += 30; factors.push(`${input.diabetesDuration} years diabetes duration (very high-risk)`) }
    else if (input.diabetesDuration > 10) { score += 20; factors.push(`${input.diabetesDuration} years duration (significant risk)`) }
    else if (input.diabetesDuration > 5) { score += 10; factors.push(`${input.diabetesDuration} years duration`) }
  }
  if (input.systolicBP && input.systolicBP > 140) { score += 15; factors.push(`Systolic BP ${input.systolicBP} mmHg (elevated — target < 130)`) }
  if (input.age > 70) { score += 10; factors.push(`Age ${input.age} — cumulative exposure risk`) }
  if (input.smoker) { score += 10; factors.push('Active smoker — cessation strongly advised') }

  return {
    score: Math.min(100, score),
    riskLevel: score >= 50 ? 'High' : score >= 25 ? 'Moderate' : 'Low',
    factors,
  }
}

export function calculateGlaucomaRisk(input: RiskInput): { score: number; riskLevel: 'Low' | 'Moderate' | 'High'; factors: string[] } {
  let score = 0
  const factors: string[] = []

  if (input.iop) {
    if (input.iop > 24) { score += 35; factors.push(`IOP ${input.iop} mmHg (above normal range > 21 mmHg)`) }
    else if (input.iop > 21) { score += 20; factors.push(`IOP ${input.iop} mmHg (borderline — 6-monthly monitoring)`) }
    else factors.push(`IOP ${input.iop} mmHg (within normal range ✓)`)
  }
  if (input.cdr) {
    if (input.cdr > 0.8) { score += 30; factors.push(`C/D ratio ${input.cdr} (significantly enlarged)`) }
    else if (input.cdr > 0.65) { score += 20; factors.push(`C/D ratio ${input.cdr} (suspicious — HVF + OCT indicated)`) }
    else factors.push(`C/D ratio ${input.cdr} (within normal limits ✓)`)
  }
  if (input.familyHistoryGlaucoma) { score += 15; factors.push('First-degree family history of glaucoma (2–3× increased risk)') }
  if (input.age > 60) { score += 10; factors.push(`Age ${input.age} — prevalence doubles each decade after 40`) }
  if (input.age > 40 && input.age <= 60) { score += 5; factors.push(`Age ${input.age} — entering at-risk age group`) }

  return {
    score: Math.min(100, score),
    riskLevel: score >= 50 ? 'High' : score >= 25 ? 'Moderate' : 'Low',
    factors,
  }
}

// ── Referral letter helpers ───────────────────────────────────────────────────
export interface ReferralData {
  patientCode: string
  patientAge?: number
  patientGender?: string
  eyeSide: string
  diagnosis: string
  stage: string
  confidence: number
  urgency: TreatmentPriority
  clinicalFindings: string[]
  referringClinician: string
  referringInstitution: string
  specialistType: string
  date: string
}

export function urgencyToText(u: TreatmentPriority): string {
  return { urgent: 'URGENT — within 24–48 hours', soon: 'Soon — within 1–2 weeks', routine: 'Routine — within 4–6 weeks', monitor: 'Routine monitoring — within 3 months' }[u]
}
