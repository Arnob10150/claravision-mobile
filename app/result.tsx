import { useState, useEffect, useRef } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import {
  Animated, Easing, Image, Pressable, Alert,
  ScrollView, StyleSheet, Text, View,
} from 'react-native'
import {
  Brain, ChevronLeft, AlertTriangle, Save,
  ChevronRight, Eye, CheckCircle, Mail, Calendar,
  Stethoscope, Clock, AlertCircle, ClipboardList,
} from 'lucide-react-native'
import { UncertaintyBadge } from '../components/UncertaintyBadge'
import { Skeleton } from '../components/Skeleton'
import { isSupabaseReady, supabase } from '../lib/supabase'
import { C } from '../lib/colors'
import type { InferenceResult } from '../lib/inference'
import { deriveStage, urgencyToText, type TreatmentPriority } from '../lib/clinical'

/* ── Animated probability bar ──────────────────────────────────────────────── */
function ProbBar({ label, value, isPrimary, index }:
  { label: string; value: number; isPrimary: boolean; index: number }) {
  const width = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(width, {
      toValue: value * 100, duration: 800,
      delay: 80 + index * 55,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start()
  }, [value])
  const pct = (value * 100).toFixed(1)
  return (
    <View style={bar.row}>
      <View style={bar.labelRow}>
        <Text style={[bar.label, isPrimary && bar.labelPrimary]} numberOfLines={1}>
          {label}{isPrimary && <Text style={bar.top}> PRIMARY</Text>}
        </Text>
        <Text style={[bar.pct, isPrimary && bar.pctPrimary]}>{pct}%</Text>
      </View>
      <View style={bar.track}>
        <Animated.View style={[
          bar.fill,
          { width: width.interpolate({ inputRange:[0,100], outputRange:['0%','100%'] }) },
          isPrimary ? bar.fillPrimary : bar.fillMuted,
        ]} />
      </View>
    </View>
  )
}
const bar = StyleSheet.create({
  row:{ marginBottom:10 }, labelRow:{ flexDirection:'row', justifyContent:'space-between', marginBottom:4 },
  label:{ color:C.text, fontSize:12, fontWeight:'600', flex:1, marginRight:8 }, labelPrimary:{ color:C.primary, fontWeight:'800' },
  top:{ color:C.primary, fontSize:9, fontWeight:'800' }, pct:{ color:C.textSub, fontSize:12, fontWeight:'700' }, pctPrimary:{ color:C.primary },
  track:{ height:6, backgroundColor:C.borderLight, borderRadius:3, overflow:'hidden' }, fill:{ height:6, borderRadius:3 },
  fillPrimary:{ backgroundColor:C.primary }, fillMuted:{ backgroundColor:'#b0c4ba' },
})

/* ── Tab button ─────────────────────────────────────────────────────────────── */
function TabBtn({ label, active, onPress, alert }: { label:string; active:boolean; onPress:()=>void; alert?:boolean }) {
  return (
    <Pressable onPress={onPress} style={[tab.btn, active && tab.active]}>
      {alert && !active && <View style={tab.dot}/>}
      <Text style={[tab.txt, active && tab.txtActive]}>{label}</Text>
    </Pressable>
  )
}
const tab = StyleSheet.create({
  btn:{ paddingHorizontal:12, paddingVertical:8, borderRadius:99, position:'relative' },
  active:{ backgroundColor:C.primary }, txt:{ color:C.textMuted, fontSize:12, fontWeight:'600' }, txtActive:{ color:'white', fontWeight:'800' },
  dot:{ position:'absolute', top:4, right:4, width:6, height:6, borderRadius:3, backgroundColor:C.danger },
})

/* ── Priority badge helper ──────────────────────────────────────────────────── */
function PriorityBadge({ priority }: { priority: TreatmentPriority }) {
  const cfg = {
    urgent:  { bg:'#FCEBEB', text:'#A32D2D', label:'URGENT' },
    soon:    { bg:'#FAEEDA', text:'#854F0B', label:'SOON' },
    routine: { bg:C.blueBg,  text:C.blueText, label:'ROUTINE' },
    monitor: { bg:C.lowBg,   text:C.lowText,  label:'MONITOR' },
  }[priority]
  return (
    <View style={[pb.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[pb.txt, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  )
}
const pb = StyleSheet.create({
  badge:{ borderRadius:99, paddingHorizontal:8, paddingVertical:3 },
  txt:{ fontSize:10, fontWeight:'800', textTransform:'uppercase', letterSpacing:0.5 },
})

/* ── Referral letter HTML ──────────────────────────────────────────────────── */
function buildReferralHTML(
  result: InferenceResult,
  stage: string,
  priority: TreatmentPriority,
  findings: string[],
  specialist: string,
): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;margin:44px 50px;color:#111;font-size:13px;line-height:1.65}
  .header{border-bottom:2.5px solid #0F6E56;padding-bottom:14px;margin-bottom:20px}
  .brand{color:#0F6E56;font-size:19px;font-weight:900}
  .brand-sub{color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:1px}
  .urgency{display:inline-block;padding:3px 12px;border-radius:99px;font-size:10px;font-weight:900;text-transform:uppercase}
  .urgent{background:#FCEBEB;color:#A32D2D} .soon{background:#FAEEDA;color:#854F0B}
  .routine{background:#EBF2FC;color:#1a4e8a} .monitor{background:#EAF3DE;color:#3B6D11}
  pre{font-family:inherit;white-space:pre-wrap;line-height:1.7}
  .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af}
  @page{margin:18mm 16mm}
</style></head><body>
<div class="header">
  <div class="brand">ClaraVision</div>
  <div class="brand-sub">Clinical AI · Retinal Disease Diagnosis</div>
</div>
<div style="margin-bottom:14px">
  <strong>Ophthalmology Referral Letter</strong>
  <span class="urgency ${priority}" style="margin-left:10px">${urgencyToText(priority)}</span>
</div>
<pre>
Dear Colleague,

I am writing to refer the above patient for specialist ${specialist} assessment.

AI-ASSISTED DIAGNOSIS (ClaraVision-XAI):
• Predicted pathology: ${result.predicted_class}
• Disease stage / grade: ${stage}
• Model confidence: ${(result.confidence * 100).toFixed(1)}%
• Analysis ID: ${result.analysis_id}
• Uncertainty level: ${result.uncertainty_level}

CLINICAL FINDINGS:
${findings.map(f => `• ${f}`).join('\n')}

REFERRAL URGENCY: ${urgencyToText(priority)}

I would be grateful for your review and any further investigations or treatment you consider appropriate. Please advise on further management and copy me in on any clinic letters.

Yours sincerely,

ClaraVision Clinician
ClaraVision Platform
Date: ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })}
</pre>
<div class="footer">Generated by ClaraVision Clinical AI · Decision-support software — not for autonomous clinical use · ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })}</div>
</body></html>`
}

/* ── Main Result screen ─────────────────────────────────────────────────────── */
export default function ResultScreen() {
  const params = useLocalSearchParams<{ result?: string; imageUri?: string; id?: string; eye?: string }>()
  const [result, setResult]       = useState<InferenceResult | null>(null)
  const [imageUri, setImageUri]   = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'probs'|'evidence'|'diff'|'uncertainty'|'clinical'>('probs')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [stagingData, setStagingData] = useState<{ stage: any; guidance: any } | null>(null)
  const [generatingLetter, setGeneratingLetter] = useState(false)

  const fade  = useRef(new Animated.Value(0)).current
  const slide = useRef(new Animated.Value(30)).current

  useEffect(() => {
    if (params.result) {
      try {
        const r = JSON.parse(params.result) as InferenceResult
        setResult(r)
        setImageUri(params.imageUri ?? null)
        // Derive clinical staging immediately
        const conceptNames = r.activated_concepts.map(c => c.name)
        setStagingData(deriveStage(r.predicted_class, r.confidence, conceptNames))
      } catch { /* ignore */ }
    }
    Animated.parallel([
      Animated.timing(fade,  { toValue:1, duration:500, easing:Easing.out(Easing.quad), useNativeDriver:true }),
      Animated.timing(slide, { toValue:0, duration:500, easing:Easing.out(Easing.quad), useNativeDriver:true }),
    ]).start()
  }, [params.result])

  async function saveToRecords() {
    if (!result) return
    if (!isSupabaseReady()) {
      Alert.alert('Not configured', 'Add Supabase credentials to .env to save records.')
      return
    }
    setSaving(true)
    try {
      await supabase.from('scans').insert({
        predicted_class: result.predicted_class, confidence: result.confidence,
        uncertainty_score: result.uncertainty_score, uncertainty_level: result.uncertainty_level,
        all_probabilities: result.all_probabilities, referral_flag: result.referral_flag,
        eye_side: params.eye || 'unknown', status: 'pending',
        analysis_metadata: { analysis_id: result.analysis_id, processing_time_ms: result.processing_time_ms, concepts: result.activated_concepts, reasons: result.supporting_reasons },
      })
      setSaved(true)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  async function generateReferralLetter() {
    if (!result) return
    setGeneratingLetter(true)
    try {
      const priority: TreatmentPriority = stagingData?.guidance?.priorityByStage?.[stagingData?.stage?.grade ?? ''] ?? 'routine'
      const specialist = stagingData?.guidance?.specialistType ?? 'Ophthalmologist'
      const stage = stagingData?.stage?.grade ?? result.predicted_class
      const html = buildReferralHTML(result, stage, priority, result.supporting_reasons, specialist)
      const { uri } = await Print.printToFileAsync({ html, base64: false })
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Referral Letter' })
    } catch (e) {
      Alert.alert('Error', 'Could not generate referral letter. Please try again.')
      console.error(e)
    } finally {
      setGeneratingLetter(false)
    }
  }

  if (!result) {
    return (
      <View style={styles.loading}>
        <Skeleton height={200} radius={16} style={{ width:'100%', marginBottom:16 }}/>
        <Skeleton height={20} width={200} radius={6} style={{ marginBottom:10 }}/>
        <Skeleton height={14} width={280} radius={6} style={{ marginBottom:6 }}/>
        <Skeleton height={14} width={240} radius={6}/>
      </View>
    )
  }

  const isHigh = result.uncertainty_level === 'high'
  const sortedProbs = Object.entries(result.all_probabilities).sort(([,a],[,b]) => b - a)
  const priority: TreatmentPriority = stagingData?.guidance?.priorityByStage?.[stagingData?.stage?.grade ?? ''] ?? 'routine'

  return (
    <Animated.View style={[styles.root, { opacity:fade }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color={C.primary} size={22}/>
        </Pressable>
        <Text style={styles.topTitle}>Analysis Result</Text>
        <View style={{ width:38 }}/>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Primary finding banner */}
        <Animated.View
          style={[
            styles.bannerCard,
            { borderColor: isHigh ? C.danger : result.uncertainty_level === 'medium' ? C.amber : C.primary },
            { transform:[{translateY:slide}] }
          ]}
        >
          <View style={styles.bannerRow}>
            <View style={[styles.diagIcon, { backgroundColor: C.primary + '20' }]}>
              <Brain color={C.primary} size={28}/>
            </View>
            <View style={styles.diagInfo}>
              <Text style={styles.diagEyebrow}>ClaraVision-XAI — Primary Finding</Text>
              <Text style={styles.diagName}>{result.predicted_class}</Text>
              {stagingData?.stage && (
                <Text style={styles.stageLine}>
                  {stagingData.stage.grade} · <Text style={styles.icd10}>{stagingData.stage.icd10}</Text>
                </Text>
              )}
              <View style={styles.diagMeta}>
                <Text style={styles.confTxt}>{(result.confidence * 100).toFixed(1)}% confidence</Text>
                <UncertaintyBadge level={result.uncertainty_level} size="sm"/>
                {stagingData?.stage && <PriorityBadge priority={priority}/>}
              </View>
            </View>
          </View>

          {/* Meta */}
          <View style={styles.metaRow2}>
            <Text style={styles.metaItem}>⏱ {result.processing_time_ms}ms</Text>
            <Text style={styles.metaItem}>ID: {result.analysis_id.slice(0,16)}</Text>
          </View>

          {/* Referral alert */}
          {result.referral_flag && (
            <View style={styles.referralAlert}>
              <AlertTriangle color={C.dangerText} size={16}/>
              <View style={styles.referralText}>
                <Text style={styles.referralH}>Senior Specialist Review Required</Text>
                <Text style={styles.referralSub}>High uncertainty or high-risk pathology. Review by a consultant ophthalmologist before any clinical decision.</Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Fundus image */}
        {imageUri && (
          <View style={styles.imageCard}>
            <Text style={styles.imageLabel}>Fundus Image</Text>
            <Image source={{ uri: imageUri }} style={styles.fundusImage} resizeMode="contain"/>
          </View>
        )}

        {/* Tab bar — 5 tabs */}
        <View style={styles.tabRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:4, paddingHorizontal:4 }}>
            <TabBtn label="Probs"        active={activeTab==='probs'}       onPress={() => setActiveTab('probs')}/>
            <TabBtn label="Evidence"     active={activeTab==='evidence'}    onPress={() => setActiveTab('evidence')}/>
            <TabBtn label="Differential" active={activeTab==='diff'}        onPress={() => setActiveTab('diff')}/>
            <TabBtn label="Uncertainty"  active={activeTab==='uncertainty'} onPress={() => setActiveTab('uncertainty')}/>
            <TabBtn label="Clinical"     active={activeTab==='clinical'}    onPress={() => setActiveTab('clinical')} alert={!!stagingData?.stage}/>
          </ScrollView>
        </View>

        {/* Tab content */}
        <View style={styles.tabContent}>

          {/* Probabilities */}
          {activeTab === 'probs' && (
            <View>
              <Text style={styles.tabDesc}>ClaraVision-XAI posterior probability across all 9 retinal pathology classes</Text>
              {sortedProbs.map(([disease, prob], i) => (
                <ProbBar key={disease} label={disease} value={prob} isPrimary={disease === result.predicted_class} index={i}/>
              ))}
            </View>
          )}

          {/* Evidence */}
          {activeTab === 'evidence' && (
            <View style={styles.evidenceWrap}>
              <Text style={styles.evidenceSection}>Activated Clinical Features</Text>
              <View style={styles.chipWrap}>
                {result.activated_concepts.map((c, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipTxt}>{c.name}</Text>
                    <Text style={styles.chipConf}>{(c.confidence*100).toFixed(0)}%</Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.evidenceSection, { marginTop:16 }]}>Clinical Reasoning</Text>
              {result.supporting_reasons.map((r, i) => (
                <View key={i} style={styles.reasonRow}>
                  <ChevronRight color={C.primary} size={14}/>
                  <Text style={styles.reasonTxt}>{r}</Text>
                </View>
              ))}
              <Text style={[styles.evidenceSection, { marginTop:16 }]}>Feature Descriptions</Text>
              {result.activated_concepts.map((c, i) => (
                <View key={i} style={styles.featureCard}>
                  <View style={{ flex:1 }}>
                    <Text style={styles.featureName}>{c.name}</Text>
                    <Text style={styles.featureDesc}>{c.description}</Text>
                  </View>
                  <Text style={styles.featureConf}>{(c.confidence*100).toFixed(0)}%</Text>
                </View>
              ))}
            </View>
          )}

          {/* Differential */}
          {activeTab === 'diff' && (
            <View>
              <Text style={styles.tabDesc}>Alternative diagnoses considered and excluded during classification</Text>
              {result.differential.map((d, idx) => (
                <View key={idx} style={styles.diffCard}>
                  <View style={styles.diffTop}>
                    <Text style={styles.diffDisease}>{d.disease}</Text>
                    <Text style={styles.diffPct}>{(d.probability*100).toFixed(1)}%</Text>
                  </View>
                  <View style={styles.diffTrack}>
                    <View style={[styles.diffFill, { width:`${d.probability*100}%` as any }]}/>
                  </View>
                  <Text style={styles.diffRuled}><Text style={{ fontWeight:'700', color:C.text }}>Excluded: </Text>{d.ruled_out_because}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Uncertainty */}
          {activeTab === 'uncertainty' && (
            <View style={styles.uncWrap}>
              <View style={styles.gauge}>
                <View style={styles.gaugeTrack}>
                  <View style={[styles.gaugeFill, { width:`${result.uncertainty_score*100}%` as any, backgroundColor: isHigh ? C.danger : result.uncertainty_level === 'medium' ? C.amber : C.primary }]}/>
                </View>
                <Text style={[styles.gaugePct, { color: isHigh ? C.danger : result.uncertainty_level === 'medium' ? C.amber : C.primary }]}>
                  {(result.uncertainty_score * 100).toFixed(0)}%
                </Text>
                <UncertaintyBadge level={result.uncertainty_level} size="md"/>
              </View>
              <Text style={styles.uncInterpTitle}>Interpretation</Text>
              <Text style={styles.uncInterp}>
                {result.uncertainty_level === 'high'
                  ? 'High model uncertainty indicates atypical features, suboptimal image quality, or ambiguous presentation. Senior ophthalmologist review is mandatory.'
                  : result.uncertainty_level === 'medium'
                  ? 'Moderate uncertainty — clinical context, patient history, and OCT/HVF investigations should supplement this AI finding.'
                  : 'Low uncertainty — prediction is well-supported by image features. Standard clinical review is recommended.'}
              </Text>
              <View style={styles.metricsCard}>
                {[['Confidence',`${(result.confidence*100).toFixed(1)}%`],['Uncertainty',`${(result.uncertainty_score*100).toFixed(1)}%`],['Inference',`${result.processing_time_ms} ms`],['Analysis ID',result.analysis_id.slice(0,16)+'…']].map(([l,v]) => (
                  <View key={l} style={styles.metricRow}>
                    <Text style={styles.metricLabel}>{l}</Text>
                    <Text style={styles.metricValue}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Clinical staging + treatment guidelines ────────────────────── */}
          {activeTab === 'clinical' && (
            <View style={styles.clinicalWrap}>
              {stagingData?.stage ? (
                <>
                  {/* Stage header */}
                  <View style={styles.stageCard}>
                    <View style={styles.stageIconWrap}>
                      <Stethoscope color={C.primary} size={20}/>
                    </View>
                    <View style={{ flex:1 }}>
                      <View style={styles.stageTopRow}>
                        <Text style={styles.stageName}>{stagingData.stage.grade}</Text>
                        <View style={styles.icdBadge}>
                          <Text style={styles.icdTxt}>{stagingData.stage.icd10}</Text>
                        </View>
                      </View>
                      <PriorityBadge priority={priority}/>
                      <Text style={styles.stageDesc}>{stagingData.stage.description}</Text>
                      {stagingData.stage.prevalence && (
                        <Text style={styles.stagePrevalence}>{stagingData.stage.prevalence}</Text>
                      )}
                    </View>
                  </View>

                  {/* Follow-up */}
                  {stagingData.guidance?.followUpWeeksByStage?.[stagingData.stage.grade] !== undefined && (
                    <View style={styles.infoRow}>
                      <Calendar color={C.primary} size={15}/>
                      <Text style={styles.infoLabel}>Recommended follow-up:</Text>
                      <Text style={styles.infoValue}>
                        {stagingData.guidance.followUpWeeksByStage[stagingData.stage.grade] === 0
                          ? 'IMMEDIATE'
                          : stagingData.guidance.followUpWeeksByStage[stagingData.stage.grade] === 1
                          ? 'Within 1 week'
                          : `${stagingData.guidance.followUpWeeksByStage[stagingData.stage.grade]} weeks`}
                      </Text>
                    </View>
                  )}

                  {/* Specialist */}
                  {stagingData.guidance?.specialistType && (
                    <View style={styles.infoRow}>
                      <AlertCircle color={C.primary} size={15}/>
                      <Text style={styles.infoLabel}>Refer to:</Text>
                      <Text style={styles.infoValue}>{stagingData.guidance.specialistType}</Text>
                    </View>
                  )}

                  {/* Treatment steps */}
                  {stagingData.guidance?.treatmentByStage?.[stagingData.stage.grade]?.length > 0 && (
                    <View>
                      <Text style={styles.stepHeader}>Treatment / Management Steps</Text>
                      {(stagingData.guidance.treatmentByStage[stagingData.stage.grade] as string[]).map((step: string, i: number) => (
                        <View key={i} style={styles.stepRow}>
                          <View style={styles.stepDot}><CheckCircle color={C.primary} size={13}/></View>
                          <Text style={styles.stepTxt}>{step}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Disease overview */}
                  {stagingData.guidance?.overview && (
                    <View style={styles.overviewBox}>
                      <Text style={styles.overviewTitle}>Disease Overview</Text>
                      <Text style={styles.overviewTxt}>{stagingData.guidance.overview}</Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.emptyStaging}>
                  <Clock color={C.textMuted} size={32}/>
                  <Text style={styles.emptyStagingTxt}>No staging data available for this pathology.</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {/* Referral letter */}
          <Pressable
            style={({ pressed }) => [styles.referralBtn, pressed && { opacity:0.85 }, generatingLetter && { opacity:0.6 }]}
            onPress={generateReferralLetter}
            disabled={generatingLetter}
          >
            <Mail color={C.primary} size={18}/>
            <Text style={styles.referralBtnTxt}>{generatingLetter ? 'Generating…' : 'Referral Letter (PDF)'}</Text>
          </Pressable>

          {/* Save to records */}
          {!saved ? (
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity:0.85 }, saving && { opacity:0.6 }]}
              onPress={saveToRecords} disabled={saving}
            >
              <Save color="white" size={18}/>
              <Text style={styles.saveTxt}>{saving ? 'Saving…' : 'Save to Patient Records'}</Text>
            </Pressable>
          ) : (
            <View style={styles.savedRow}>
              <CheckCircle color={C.lowText} size={18}/>
              <Text style={styles.savedTxt}>Saved to patient records</Text>
            </View>
          )}

          <Pressable style={styles.analyseAnotherBtn} onPress={() => router.replace('/(tabs)/capture' as any)}>
            <Text style={styles.analyseAnotherTxt}>Analyse Another Image</Text>
          </Pressable>
        </View>

      </ScrollView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root:           { flex:1, backgroundColor:C.bg },
  loading:        { flex:1, padding:20, backgroundColor:C.bg, paddingTop:60 },
  topBar:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingTop:52, paddingBottom:12, backgroundColor:C.card, borderBottomWidth:1, borderBottomColor:C.border },
  backBtn:        { width:38, height:38, borderRadius:12, backgroundColor:C.primaryBg, alignItems:'center', justifyContent:'center' },
  topTitle:       { color:C.text, fontSize:16, fontWeight:'800' },
  content:        { padding:16, gap:14, paddingBottom:40 },

  // Banner
  bannerCard:     { backgroundColor:C.card, borderRadius:16, padding:16, borderWidth:2, gap:12, shadowColor:'#000', shadowOffset:{width:0,height:3}, shadowOpacity:0.08, shadowRadius:10, elevation:3 },
  bannerRow:      { flexDirection:'row', alignItems:'flex-start', gap:12 },
  diagIcon:       { width:52, height:52, borderRadius:14, alignItems:'center', justifyContent:'center', flexShrink:0 },
  diagInfo:       { flex:1, gap:4 },
  diagEyebrow:    { color:C.textMuted, fontSize:10, fontWeight:'700', textTransform:'uppercase', letterSpacing:0.5 },
  diagName:       { color:C.text, fontSize:20, fontWeight:'900' },
  stageLine:      { color:C.textSub, fontSize:12, marginTop:2 },
  icd10:          { color:C.textMuted, fontFamily:'monospace' },
  diagMeta:       { flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' },
  confTxt:        { color:C.text, fontSize:13, fontWeight:'700' },
  metaRow2:       { flexDirection:'row', gap:16, flexWrap:'wrap' },
  metaItem:       { color:C.textMuted, fontSize:11 },
  referralAlert:  { flexDirection:'row', alignItems:'flex-start', gap:10, backgroundColor:C.dangerBg, borderRadius:10, padding:12, borderWidth:1, borderColor:'#f5c5c0' },
  referralText:   { flex:1, gap:3 },
  referralH:      { color:C.dangerText, fontSize:13, fontWeight:'800' },
  referralSub:    { color:C.dangerText, fontSize:12, lineHeight:17, opacity:0.85 },

  // Image
  imageCard:      { backgroundColor:C.card, borderRadius:16, overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  imageLabel:     { color:C.text, fontSize:13, fontWeight:'700', paddingHorizontal:14, paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.borderLight },
  fundusImage:    { width:'100%', height:220 },

  // Tabs
  tabRow:         { backgroundColor:C.card, borderRadius:14, padding:4, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:6, elevation:1 },
  tabContent:     { backgroundColor:C.card, borderRadius:16, padding:16, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  tabDesc:        { color:C.textMuted, fontSize:12, lineHeight:18, marginBottom:14 },

  // Evidence
  evidenceWrap:   { gap:4 },
  evidenceSection:{ color:C.text, fontSize:12, fontWeight:'800', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 },
  chipWrap:       { flexDirection:'row', flexWrap:'wrap', gap:6 },
  chip:           { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:C.primaryBg, borderRadius:99, paddingHorizontal:10, paddingVertical:5, borderWidth:1, borderColor:C.primaryBorder },
  chipTxt:        { color:C.primary, fontSize:12, fontWeight:'700' },
  chipConf:       { color:C.textMuted, fontSize:11 },
  reasonRow:      { flexDirection:'row', alignItems:'flex-start', gap:8, marginBottom:8 },
  reasonTxt:      { color:C.textSub, fontSize:13, lineHeight:19, flex:1 },
  featureCard:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:C.bg, borderRadius:10, padding:12, marginBottom:8, borderWidth:1, borderColor:C.border },
  featureName:    { color:C.text, fontSize:13, fontWeight:'700' },
  featureDesc:    { color:C.textMuted, fontSize:12, lineHeight:17, marginTop:2 },
  featureConf:    { color:C.primary, fontSize:13, fontWeight:'800', marginLeft:8 },

  // Differential
  diffCard:       { backgroundColor:C.bg, borderRadius:12, padding:12, marginBottom:10, borderWidth:1, borderColor:C.border },
  diffTop:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:6 },
  diffDisease:    { color:C.text, fontSize:14, fontWeight:'700' },
  diffPct:        { color:C.textMuted, fontSize:13, fontWeight:'700' },
  diffTrack:      { height:4, backgroundColor:C.borderLight, borderRadius:2, overflow:'hidden', marginBottom:8 },
  diffFill:       { height:4, backgroundColor:'#b0c4ba', borderRadius:2 },
  diffRuled:      { color:C.textMuted, fontSize:12, lineHeight:17 },

  // Uncertainty
  uncWrap:        { gap:14 },
  gauge:          { alignItems:'center', gap:8, paddingVertical:8 },
  gaugeTrack:     { width:'100%', height:12, backgroundColor:C.borderLight, borderRadius:6, overflow:'hidden' },
  gaugeFill:      { height:12, borderRadius:6 },
  gaugePct:       { fontSize:36, fontWeight:'900' },
  uncInterpTitle: { color:C.text, fontSize:14, fontWeight:'800' },
  uncInterp:      { color:C.textSub, fontSize:13, lineHeight:20 },
  metricsCard:    { backgroundColor:C.bg, borderRadius:12, padding:12, gap:8, borderWidth:1, borderColor:C.border },
  metricRow:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  metricLabel:    { color:C.textMuted, fontSize:12 },
  metricValue:    { color:C.text, fontSize:12, fontWeight:'700' },

  // Clinical tab
  clinicalWrap:   { gap:14 },
  stageCard:      { flexDirection:'row', gap:12, backgroundColor:C.primaryBg, borderRadius:14, padding:14, borderWidth:1, borderColor:C.primaryBorder },
  stageIconWrap:  { width:40, height:40, borderRadius:12, backgroundColor:C.primary+'20', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 },
  stageTopRow:    { flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 },
  stageName:      { color:C.text, fontSize:16, fontWeight:'900' },
  icdBadge:       { borderRadius:6, borderWidth:1, borderColor:C.border, backgroundColor:C.card, paddingHorizontal:6, paddingVertical:2 },
  icdTxt:         { color:C.textMuted, fontSize:10, fontFamily:'monospace' },
  stageDesc:      { color:C.textSub, fontSize:13, lineHeight:19, marginTop:8 },
  stagePrevalence:{ color:C.textMuted, fontSize:11, fontStyle:'italic', marginTop:4 },
  infoRow:        { flexDirection:'row', alignItems:'center', gap:8 },
  infoLabel:      { color:C.textMuted, fontSize:13 },
  infoValue:      { color:C.text, fontSize:13, fontWeight:'700', flex:1 },
  stepHeader:     { color:C.text, fontSize:12, fontWeight:'800', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 },
  stepRow:        { flexDirection:'row', alignItems:'flex-start', gap:10, backgroundColor:C.bg, borderRadius:10, padding:12, marginBottom:6, borderWidth:1, borderColor:C.border },
  stepDot:        { flexShrink:0, marginTop:1 },
  stepTxt:        { color:C.textSub, fontSize:13, lineHeight:19, flex:1 },
  overviewBox:    { backgroundColor:C.bg, borderRadius:12, padding:14, borderWidth:1, borderColor:C.border, gap:6 },
  overviewTitle:  { color:C.text, fontSize:13, fontWeight:'800' },
  overviewTxt:    { color:C.textSub, fontSize:13, lineHeight:19 },
  emptyStaging:   { alignItems:'center', paddingVertical:32, gap:8 },
  emptyStagingTxt:{ color:C.textMuted, fontSize:14, textAlign:'center' },

  // Actions
  actions:         { gap:10 },
  referralBtn:     { height:50, borderRadius:14, backgroundColor:C.card, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, borderWidth:1.5, borderColor:C.primaryBorder },
  referralBtnTxt:  { color:C.primary, fontSize:15, fontWeight:'800' },
  saveBtn:         { height:52, borderRadius:14, backgroundColor:C.primary, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, shadowColor:C.primary, shadowOffset:{width:0,height:4}, shadowOpacity:0.35, shadowRadius:10, elevation:6 },
  saveTxt:         { color:'white', fontSize:16, fontWeight:'800' },
  savedRow:        { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, height:52, borderRadius:14, backgroundColor:C.lowBg, borderWidth:1.5, borderColor:C.primaryBorder },
  savedTxt:        { color:C.lowText, fontSize:15, fontWeight:'800' },
  analyseAnotherBtn: { height:46, borderRadius:12, borderWidth:1.5, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  analyseAnotherTxt: { color:C.textSub, fontSize:14, fontWeight:'700' },
})
