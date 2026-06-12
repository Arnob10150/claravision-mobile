import { useState, useEffect, useRef } from 'react'
import { router } from 'expo-router'
import {
  Animated, Easing, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native'
import {
  ScanLine, Clock, AlertCircle, TrendingUp, TrendingDown,
  ArrowRight, RefreshCw, Brain, Microscope, ClipboardList, FileText,
} from 'lucide-react-native'
import { UncertaintyBadge } from '../../components/UncertaintyBadge'
import { Skeleton } from '../../components/Skeleton'
import { supabase, isSupabaseReady } from '../../lib/supabase'
import { C } from '../../lib/colors'

function formatAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  pending:    { bg: C.amberBg,   text: C.amberText,  label: 'Pending' },
  reviewed:   { bg: C.blueBg,    text: C.blueText,   label: 'Reviewed' },
  signed_off: { bg: C.lowBg,     text: C.lowText,    label: 'Signed Off' },
}

// ── Animated KPI card ────────────────────────────────────────────────────────
function KpiCard({ label, value, diff, icon: Icon, accent, loading, delay }:
  { label: string; value: number; diff: number; icon: any; accent: string; loading: boolean; delay: number }) {
  const anim  = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.92)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim,  { toValue:1, duration:500, delay, easing:Easing.out(Easing.quad), useNativeDriver:true }),
      Animated.spring(scale, { toValue:1, delay, friction:8, tension:60, useNativeDriver:true }),
    ]).start()
  }, [])
  const up = diff >= 0
  return (
    <Animated.View style={[styles.kpiCard, { opacity:anim, transform:[{scale}], borderLeftColor:accent }]}>
      <View style={styles.kpiRow}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <View style={[styles.kpiIcon, { backgroundColor: accent + '20' }]}>
          <Icon color={accent} size={16} />
        </View>
      </View>
      {loading
        ? <Skeleton height={32} width={80} radius={6} style={{ marginTop:4 }} />
        : <Text style={styles.kpiValue}>{value.toLocaleString()}</Text>
      }
      {!loading && (
        <View style={styles.kpiTrend}>
          {up ? <TrendingUp color={C.lowText} size={12}/> : <TrendingDown color={C.dangerText} size={12}/>}
          <Text style={[styles.kpiTrendTxt, { color: up ? C.lowText : C.dangerText }]}>
            {diff >= 0 ? '+' : ''}{diff} vs last week
          </Text>
        </View>
      )}
    </Animated.View>
  )
}

export default function DashboardScreen() {
  const [kpi, setKpi]       = useState({ total:0, pending:0, highUnc:0, today:0, lastWTotal:0, lastWPend:0 })
  const [scans, setScans]   = useState<any[]>([])
  const [disease, setDisease] = useState<{ name:string; pct:number; color:string }[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fadeTitle = useRef(new Animated.Value(0)).current
  const slideTitle = useRef(new Animated.Value(-12)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeTitle,  { toValue:1, duration:500, easing:Easing.out(Easing.quad), useNativeDriver:true }),
      Animated.timing(slideTitle, { toValue:0, duration:500, easing:Easing.out(Easing.quad), useNativeDriver:true }),
    ]).start()
    loadData()
  }, [])

  async function loadData(refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true)
    try {
      if (!isSupabaseReady()) return

      const today = new Date(); today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
      const weekAgoISO = weekAgo.toISOString()
      const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
      const twoWeeksAgoISO = twoWeeksAgo.toISOString()

      const [
        totalRes, pendingRes, highUncRes, todayRes,
        lastWeekTotalRes, lastWeekPendingRes, recentRes, allClassRes,
      ] = await Promise.all([
        supabase.from('scans').select('id', { count: 'exact', head: true }),
        supabase.from('scans').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('scans').select('id', { count: 'exact', head: true }).eq('uncertainty_level', 'high'),
        supabase.from('scans').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
        supabase.from('scans').select('id', { count: 'exact', head: true })
          .gte('created_at', twoWeeksAgoISO).lt('created_at', weekAgoISO),
        supabase.from('scans').select('id', { count: 'exact', head: true })
          .eq('status', 'pending').gte('created_at', twoWeeksAgoISO).lt('created_at', weekAgoISO),
        supabase.from('scans')
          .select('id,predicted_class,uncertainty_level,status,created_at,patients(patient_code)')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase.from('scans').select('predicted_class'),
      ])

      for (const res of [totalRes, pendingRes, highUncRes, todayRes, lastWeekTotalRes, lastWeekPendingRes, recentRes, allClassRes]) {
        if (res.error) console.error('Dashboard query error:', res.error)
      }

      setKpi({
        total:      totalRes.count ?? 0,
        pending:    pendingRes.count ?? 0,
        highUnc:    highUncRes.count ?? 0,
        today:      todayRes.count ?? 0,
        lastWTotal: lastWeekTotalRes.count ?? 0,
        lastWPend:  lastWeekPendingRes.count ?? 0,
      })

      setScans((recentRes.data ?? []).map((s: any) => ({
        id: s.id,
        code: s.patients?.patient_code ?? `SC-${s.id.slice(0, 6).toUpperCase()}`,
        diagnosis: s.predicted_class,
        uncertainty: s.uncertainty_level,
        status: s.status,
        ago: formatAgo(s.created_at),
      })))

      const counts: Record<string, number> = {}
      ;(allClassRes.data ?? []).forEach((s: any) => { counts[s.predicted_class] = (counts[s.predicted_class] ?? 0) + 1 })
      const total = (allClassRes.data ?? []).length || 1
      setDisease(
        Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([name, count], i) => ({
            name: name.length > 16 ? name.slice(0, 14) + '…' : name,
            pct:  Math.round(count / total * 100),
            color: C.chart[i % C.chart.length],
          }))
      )
    } catch(e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }

  const kpiCards = [
    { label:'Total Scans',      value:kpi.total,   diff:kpi.total-kpi.lastWTotal, icon:ScanLine,     accent:C.primary },
    { label:'Pending Reviews',  value:kpi.pending, diff:kpi.pending-kpi.lastWPend,icon:Clock,        accent:C.amber },
    { label:'High Uncertainty', value:kpi.highUnc, diff:0,                         icon:AlertCircle,  accent:C.danger },
    { label:'Scans Today',      value:kpi.today,   diff:0,                         icon:TrendingUp,   accent:C.blue },
  ]

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={C.primary} />}
    >
      {/* Header */}
      <Animated.View style={[styles.header, { opacity:fadeTitle, transform:[{translateY:slideTitle}] }]}>
        <View>
          <Text style={styles.headerEyebrow}>ClaraVision</Text>
          <Text style={styles.headerTitle}>Clinical Dashboard</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={() => loadData(true)}>
          <RefreshCw color={C.primary} size={18} />
        </Pressable>
      </Animated.View>

      {/* KPI grid */}
      <View style={styles.kpiGrid}>
        {kpiCards.map((k,i) => (
          <KpiCard key={k.label} {...k} loading={loading} delay={i*80} />
        ))}
      </View>

      {/* Recent Scans */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Recent Scans</Text>
          <Pressable onPress={() => router.push('/(tabs)/patients' as any)} style={styles.viewAll}>
            <Text style={styles.viewAllTxt}>View all</Text>
            <ArrowRight color={C.primary} size={14}/>
          </Pressable>
        </View>

        <View style={styles.card}>
          {loading ? (
            [...Array(4)].map((_,i) => (
              <View key={i} style={styles.scanRow}>
                <Skeleton height={14} width={100} radius={4}/>
                <Skeleton height={14} width={140} radius={4}/>
                <Skeleton height={20} width={48}  radius={99}/>
              </View>
            ))
          ) : scans.length === 0 ? (
            <View style={styles.empty}>
              <Brain color={C.textMuted} size={36} />
              <Text style={styles.emptyTxt}>No scans yet</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push('/(tabs)/capture' as any)}>
                <Text style={styles.emptyBtnTxt}>Analyse first scan</Text>
              </Pressable>
            </View>
          ) : (
            scans.map((s,i) => {
              const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.pending
              return (
                <Pressable
                  key={s.id}
                  style={[styles.scanRow, i < scans.length-1 && styles.scanBorder]}
                  onPress={() => router.push({ pathname:'/result', params:{ id:s.id } } as any)}
                >
                  <View style={styles.scanLeft}>
                    <View style={styles.scanIcon}><ScanLine color={C.primary} size={14}/></View>
                    <View>
                      <Text style={styles.scanCode}>{s.code}</Text>
                      <Text style={styles.scanDiag}>{s.diagnosis}</Text>
                    </View>
                  </View>
                  <View style={styles.scanRight}>
                    <UncertaintyBadge level={s.uncertainty} size="sm"/>
                    <View style={[styles.statusBadge, { backgroundColor:st.bg }]}>
                      <Text style={[styles.statusTxt, { color:st.text }]}>{st.label}</Text>
                    </View>
                    <Text style={styles.scanAgo}>{s.ago}</Text>
                  </View>
                </Pressable>
              )
            })
          )}
        </View>
      </View>

      {/* Disease distribution */}
      {!loading && disease.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disease Distribution</Text>
          <View style={styles.card}>
            {disease.map(d => (
              <View key={d.name} style={styles.distRow}>
                <View style={[styles.distDot, { backgroundColor:d.color }]}/>
                <Text style={styles.distName}>{d.name}</Text>
                <View style={styles.distBarWrap}>
                  <View style={[styles.distBar, { width:`${d.pct}%` as any, backgroundColor:d.color }]}/>
                </View>
                <Text style={styles.distPct}>{d.pct}%</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Quick actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          {[
            { icon:Microscope,   label:'Analyse Scan',     sub:'Upload fundus image', path:'/(tabs)/capture', accent:C.primary },
            { icon:ClipboardList,label:'Review Queue',     sub:`${kpi.highUnc} high uncertainty`, path:'/(tabs)/queue', accent:C.danger },
            { icon:FileText,     label:'View Reports',     sub:'Signed reports',      path:'/(tabs)/profile', accent:C.blue },
          ].map(({ icon:Icon, label, sub, path, accent }) => (
            <Pressable
              key={label}
              style={({ pressed }) => [styles.actionCard, pressed && { opacity:0.8, transform:[{scale:0.97}] }]}
              onPress={() => router.push(path as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: accent + '18' }]}>
                <Icon color={accent} size={22}/>
              </View>
              <Text style={styles.actionLabel}>{label}</Text>
              <Text style={styles.actionSub}>{sub}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root:         { flex:1, backgroundColor:C.bg },
  content:      { padding:16, gap:16, paddingBottom:32 },
  header:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingTop:8 },
  headerEyebrow:{ color:C.primary, fontSize:11, fontWeight:'700', textTransform:'uppercase', letterSpacing:1 },
  headerTitle:  { color:C.text, fontSize:24, fontWeight:'900', marginTop:2 },
  refreshBtn:   { width:38, height:38, borderRadius:12, backgroundColor:C.primaryBg, alignItems:'center', justifyContent:'center' },
  kpiGrid:      { flexDirection:'row', flexWrap:'wrap', gap:10 },
  kpiCard:      { flex:1, minWidth:'45%', backgroundColor:C.card, borderRadius:14, padding:14, borderLeftWidth:3, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  kpiRow:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:6 },
  kpiLabel:     { color:C.textMuted, fontSize:11, fontWeight:'600', textTransform:'uppercase', letterSpacing:0.5, flex:1 },
  kpiIcon:      { width:30, height:30, borderRadius:9, alignItems:'center', justifyContent:'center' },
  kpiValue:     { color:C.text, fontSize:26, fontWeight:'900', fontVariant:['tabular-nums'] },
  kpiTrend:     { flexDirection:'row', alignItems:'center', gap:4, marginTop:4 },
  kpiTrendTxt:  { fontSize:11, fontWeight:'600' },
  section:      { gap:8 },
  sectionRow:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  sectionTitle: { color:C.text, fontSize:16, fontWeight:'800' },
  viewAll:      { flexDirection:'row', alignItems:'center', gap:2 },
  viewAllTxt:   { color:C.primary, fontSize:12, fontWeight:'700' },
  card:         { backgroundColor:C.card, borderRadius:16, overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  scanRow:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:14, paddingVertical:12 },
  scanBorder:   { borderBottomWidth:1, borderBottomColor:C.borderLight },
  scanLeft:     { flexDirection:'row', alignItems:'center', gap:10, flex:1 },
  scanIcon:     { width:32, height:32, borderRadius:10, backgroundColor:C.primaryBg, alignItems:'center', justifyContent:'center' },
  scanCode:     { color:C.text, fontSize:13, fontWeight:'700' },
  scanDiag:     { color:C.textMuted, fontSize:12, marginTop:1 },
  scanRight:    { alignItems:'flex-end', gap:4 },
  statusBadge:  { borderRadius:99, paddingHorizontal:7, paddingVertical:2 },
  statusTxt:    { fontSize:10, fontWeight:'700' },
  scanAgo:      { color:C.textMuted, fontSize:10 },
  empty:        { alignItems:'center', paddingVertical:32, gap:8 },
  emptyTxt:     { color:C.textMuted, fontSize:14, fontWeight:'600' },
  emptyBtn:     { backgroundColor:C.primary, borderRadius:10, paddingHorizontal:16, paddingVertical:8, marginTop:4 },
  emptyBtnTxt:  { color:'white', fontSize:13, fontWeight:'700' },
  distRow:      { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:14, paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.borderLight },
  distDot:      { width:8, height:8, borderRadius:4 },
  distName:     { color:C.text, fontSize:12, width:90 },
  distBarWrap:  { flex:1, height:6, backgroundColor:C.borderLight, borderRadius:3, overflow:'hidden' },
  distBar:      { height:6, borderRadius:3 },
  distPct:      { color:C.text, fontSize:12, fontWeight:'700', width:32, textAlign:'right' },
  actionsRow:   { flexDirection:'row', gap:10 },
  actionCard:   { flex:1, backgroundColor:C.card, borderRadius:14, padding:14, alignItems:'center', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2, gap:6 },
  actionIcon:   { width:44, height:44, borderRadius:13, alignItems:'center', justifyContent:'center' },
  actionLabel:  { color:C.text, fontSize:12, fontWeight:'800', textAlign:'center' },
  actionSub:    { color:C.textMuted, fontSize:10, textAlign:'center' },
})
