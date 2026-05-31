import { useState } from 'react'
import { router } from 'expo-router'
import {
  Animated, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native'
import { ChevronLeft, Calculator, AlertTriangle, TrendingUp, CheckCircle, Info } from 'lucide-react-native'
import { calculateDRRisk, calculateGlaucomaRisk, type RiskInput } from '../lib/clinical'
import { C } from '../lib/colors'

type RiskLevel = 'Low' | 'Moderate' | 'High'

const RISK_CFG: Record<RiskLevel, { bg:string; border:string; text:string; barColor:string }> = {
  High:     { bg:'#FCEBEB', border:'#f5c5c0', text:C.dangerText, barColor:C.danger },
  Moderate: { bg:C.amberBg, border:'#fcd34d', text:C.amberText,  barColor:C.amber },
  Low:      { bg:C.lowBg,   border:C.primaryBorder, text:C.lowText, barColor:C.primary },
}

function RiskResult({ score, riskLevel, factors, title }: {
  score: number; riskLevel: RiskLevel; factors: string[]; title: string
}) {
  const cfg = RISK_CFG[riskLevel]
  return (
    <View style={[res.card, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View style={res.header}>
        <View style={{ flex:1 }}>
          <Text style={res.title}>{title}</Text>
          <Text style={[res.level, { color: cfg.text }]}>{riskLevel} Risk</Text>
        </View>
        <Text style={[res.score, { color: cfg.text }]}>{score}<Text style={res.scoreMax}>/100</Text></Text>
      </View>
      {/* Score bar */}
      <View style={res.track}>
        <View style={[res.fill, { width:`${score}%` as any, backgroundColor: cfg.barColor }]}/>
      </View>
      {/* Factors */}
      <Text style={res.factorsTitle}>Risk Factors</Text>
      {factors.map((f, i) => (
        <View key={i} style={res.factorRow}>
          <View style={[res.dot, { backgroundColor: cfg.barColor }]}/>
          <Text style={res.factorTxt}>{f}</Text>
        </View>
      ))}
      {factors.length === 0 && (
        <Text style={res.noFactors}>No significant risk factors identified with the provided data.</Text>
      )}
    </View>
  )
}
const res = StyleSheet.create({
  card:        { borderRadius:16, padding:16, borderWidth:1.5, gap:10 },
  header:      { flexDirection:'row', alignItems:'flex-start' },
  title:       { color:C.text, fontSize:13, fontWeight:'600', marginBottom:2 },
  level:       { fontSize:20, fontWeight:'900' },
  score:       { fontSize:42, fontWeight:'900' },
  scoreMax:    { fontSize:16, fontWeight:'600', color:C.textMuted },
  track:       { height:10, backgroundColor:'rgba(0,0,0,0.08)', borderRadius:5, overflow:'hidden' },
  fill:        { height:10, borderRadius:5 },
  factorsTitle:{ color:C.text, fontSize:12, fontWeight:'800', textTransform:'uppercase', letterSpacing:0.5 },
  factorRow:   { flexDirection:'row', alignItems:'flex-start', gap:8 },
  dot:         { width:6, height:6, borderRadius:3, marginTop:6, flexShrink:0 },
  factorTxt:   { color:C.textSub, fontSize:13, lineHeight:19, flex:1 },
  noFactors:   { color:C.textMuted, fontSize:13 },
})

function NumField({ label, unit, placeholder, value, onChange, hint }:
  { label:string; unit?:string; placeholder:string; value:string; onChange:(v:string)=>void; hint:string }) {
  return (
    <View style={f.wrap}>
      <View style={f.labelRow}>
        <Text style={f.label}>{label}</Text>
        {unit && <Text style={f.unit}> ({unit})</Text>}
      </View>
      <TextInput
        style={f.input} placeholder={placeholder} placeholderTextColor={C.textMuted}
        value={value} onChangeText={onChange} keyboardType="decimal-pad"
      />
      <Text style={f.hint}>{hint}</Text>
    </View>
  )
}
const f = StyleSheet.create({
  wrap:     { gap:4 },
  labelRow: { flexDirection:'row', alignItems:'center' },
  label:    { color:C.text, fontSize:13, fontWeight:'700' },
  unit:     { color:C.textMuted, fontSize:12 },
  input:    { height:46, borderRadius:12, borderWidth:1.5, borderColor:C.border, paddingHorizontal:14, fontSize:14, color:C.text, backgroundColor:'white' },
  hint:     { color:C.textMuted, fontSize:11 },
})

export default function RiskCalculatorScreen() {
  // DR fields
  const [drAge,      setDrAge]      = useState('')
  const [drHba1c,    setDrHba1c]    = useState('')
  const [drYears,    setDrYears]    = useState('')
  const [drBp,       setDrBp]       = useState('')
  const [drSmoker,   setDrSmoker]   = useState(false)
  const [drResult,   setDrResult]   = useState<ReturnType<typeof calculateDRRisk> | null>(null)

  // Glaucoma fields
  const [gAge,       setGAge]       = useState('')
  const [gIop,       setGIop]       = useState('')
  const [gCdr,       setGCdr]       = useState('')
  const [gFH,        setGFH]        = useState(false)
  const [gResult,    setGResult]    = useState<ReturnType<typeof calculateGlaucomaRisk> | null>(null)

  function calcDR() {
    const input: Partial<RiskInput> = {}
    if (drAge)   input.age               = parseFloat(drAge)
    if (drHba1c) input.hba1c             = parseFloat(drHba1c)
    if (drYears) input.diabetesDuration  = parseFloat(drYears)
    if (drBp)    input.systolicBP        = parseFloat(drBp)
    input.smoker = drSmoker
    setDrResult(calculateDRRisk(input as RiskInput))
  }

  function calcGlaucoma() {
    const input: Partial<RiskInput> = {}
    if (gAge) input.age = parseFloat(gAge)
    if (gIop) input.iop = parseFloat(gIop)
    if (gCdr) input.cdr = parseFloat(gCdr)
    input.familyHistoryGlaucoma = gFH
    setGResult(calculateGlaucomaRisk(input as RiskInput))
  }

  function CheckBox({ value, onToggle, label }: { value:boolean; onToggle:()=>void; label:string }) {
    return (
      <Pressable style={cb.row} onPress={onToggle}>
        <View style={[cb.box, value && cb.boxActive]}>
          {value && <Text style={cb.tick}>✓</Text>}
        </View>
        <Text style={cb.label}>{label}</Text>
      </Pressable>
    )
  }

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color={C.primary} size={22}/>
        </Pressable>
        <Text style={styles.topTitle}>Clinical Risk Calculator</Text>
        <View style={{ width:38 }}/>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerIcon}><Calculator color={C.primary} size={22}/></View>
          <View style={{ flex:1 }}>
            <Text style={styles.headerTitle}>Evidence-Based Risk Tools</Text>
            <Text style={styles.headerSub}>DR · Glaucoma · Ophthalmic risk stratification</Text>
          </View>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Info color={C.amberText} size={14}/>
          <Text style={styles.disclaimerTxt}>Decision-support only — not a diagnostic tool. Interpret in full clinical context.</Text>
        </View>

        {/* ── Diabetic Retinopathy ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor:'#FEF2F2' }]}><TrendingUp color="#ef4444" size={16}/></View>
            <View>
              <Text style={styles.sectionTitle}>Diabetic Retinopathy Risk</Text>
              <Text style={styles.sectionSub}>UKPDS · DCCT/EDIC · WESDR cohort data</Text>
            </View>
          </View>

          <View style={styles.fields}>
            <NumField label="Age" unit="years" placeholder="65" value={drAge} onChange={setDrAge} hint="Patient age in years"/>
            <NumField label="HbA1c" unit="%" placeholder="7.2" value={drHba1c} onChange={setDrHba1c} hint="Most recent HbA1c (target < 7.0%)"/>
            <NumField label="Diabetes duration" unit="years" placeholder="10" value={drYears} onChange={setDrYears} hint="Years since diabetes diagnosis"/>
            <NumField label="Systolic BP" unit="mmHg" placeholder="130" value={drBp} onChange={setDrBp} hint="Most recent systolic BP (target < 130)"/>
          </View>

          <CheckBox value={drSmoker} onToggle={() => setDrSmoker(v => !v)} label="Current smoker"/>

          <Pressable style={({pressed}) => [styles.calcBtn, pressed && {opacity:0.85}]} onPress={calcDR}>
            <Calculator color="white" size={17}/>
            <Text style={styles.calcBtnTxt}>Calculate DR Risk</Text>
          </Pressable>

          {drResult && (
            <RiskResult {...drResult} title="Diabetic Retinopathy Risk Score"/>
          )}
        </View>

        {/* ── Glaucoma ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor:'#EFF6FF' }]}><TrendingUp color="#3b82f6" size={16}/></View>
            <View>
              <Text style={styles.sectionTitle}>Glaucoma Risk Stratification</Text>
              <Text style={styles.sectionSub}>OHTS · European Glaucoma Prevention Study</Text>
            </View>
          </View>

          <View style={styles.fields}>
            <NumField label="Age" unit="years" placeholder="55" value={gAge} onChange={setGAge} hint="Patient age"/>
            <NumField label="IOP" unit="mmHg" placeholder="18" value={gIop} onChange={setGIop} hint="GAT intraocular pressure (normal < 21 mmHg)"/>
            <NumField label="C/D ratio" placeholder="0.5" value={gCdr} onChange={setGCdr} hint="Vertical cup-to-disc ratio (normal < 0.65)"/>
          </View>

          <CheckBox value={gFH} onToggle={() => setGFH(v => !v)} label="First-degree family history of glaucoma (2–3× increased risk)"/>

          <Pressable style={({pressed}) => [styles.calcBtn, { backgroundColor:'#3b82f6' }, pressed && {opacity:0.85}]} onPress={calcGlaucoma}>
            <Calculator color="white" size={17}/>
            <Text style={styles.calcBtnTxt}>Calculate Glaucoma Risk</Text>
          </Pressable>

          {gResult && (
            <RiskResult {...gResult} title="Glaucoma Risk Score"/>
          )}
        </View>

        {/* Full disclaimer */}
        <View style={styles.fullDisclaimer}>
          <AlertTriangle color={C.amberText} size={14}/>
          <Text style={styles.fullDisclaimerTxt}>
            These calculators are decision-support tools based on published epidemiological data. They are not diagnostic instruments and do not replace clinical examination, investigation, or specialist judgement. All management decisions must be made by a qualified clinician.
          </Text>
        </View>

      </ScrollView>
    </View>
  )
}

const cb = StyleSheet.create({
  row:      { flexDirection:'row', alignItems:'center', gap:10 },
  box:      { width:22, height:22, borderRadius:6, borderWidth:1.5, borderColor:C.border, backgroundColor:'white', alignItems:'center', justifyContent:'center' },
  boxActive:{ backgroundColor:C.primary, borderColor:C.primary },
  tick:     { color:'white', fontSize:13, fontWeight:'900' },
  label:    { color:C.text, fontSize:13, flex:1 },
})

const styles = StyleSheet.create({
  root:             { flex:1, backgroundColor:C.bg },
  topBar:           { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingTop:52, paddingBottom:12, backgroundColor:C.card, borderBottomWidth:1, borderBottomColor:C.border },
  backBtn:          { width:38, height:38, borderRadius:12, backgroundColor:C.primaryBg, alignItems:'center', justifyContent:'center' },
  topTitle:         { color:C.text, fontSize:16, fontWeight:'800' },
  content:          { padding:16, gap:16, paddingBottom:40 },
  headerCard:       { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:C.card, borderRadius:14, padding:14, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  headerIcon:       { width:44, height:44, borderRadius:13, backgroundColor:C.primaryBg, alignItems:'center', justifyContent:'center' },
  headerTitle:      { color:C.text, fontSize:16, fontWeight:'800' },
  headerSub:        { color:C.textMuted, fontSize:12, marginTop:2 },
  disclaimer:       { flexDirection:'row', alignItems:'flex-start', gap:8, backgroundColor:C.amberBg, borderRadius:10, padding:12, borderWidth:1, borderColor:'#fcd34d' },
  disclaimerTxt:    { color:C.amberText, fontSize:12, lineHeight:18, flex:1, fontWeight:'600' },
  section:          { backgroundColor:C.card, borderRadius:16, padding:16, gap:14, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  sectionHeader:    { flexDirection:'row', alignItems:'flex-start', gap:10 },
  sectionIcon:      { width:36, height:36, borderRadius:10, alignItems:'center', justifyContent:'center', flexShrink:0 },
  sectionTitle:     { color:C.text, fontSize:15, fontWeight:'800' },
  sectionSub:       { color:C.textMuted, fontSize:11, marginTop:2 },
  fields:           { gap:12 },
  calcBtn:          { height:50, borderRadius:14, backgroundColor:C.primary, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, shadowColor:C.primary, shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:8, elevation:5 },
  calcBtnTxt:       { color:'white', fontSize:15, fontWeight:'800' },
  fullDisclaimer:   { flexDirection:'row', alignItems:'flex-start', gap:8, backgroundColor:'#FFFBEB', borderRadius:12, padding:14, borderWidth:1, borderColor:'#FCD34D' },
  fullDisclaimerTxt:{ color:C.amberText, fontSize:12, lineHeight:18, flex:1 },
})
