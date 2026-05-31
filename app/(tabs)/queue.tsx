import { useState, useEffect, useRef } from 'react'
import { router } from 'expo-router'
import {
  Animated, Easing, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { AlertTriangle, AlertCircle, Clock, ChevronRight, CheckCircle } from 'lucide-react-native'
import { UncertaintyBadge } from '../../components/UncertaintyBadge'
import { Skeleton } from '../../components/Skeleton'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/colors'

function ago(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function QueueScreen() {
  const [items, setItems]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fade = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fade, { toValue:1, duration:500, easing:Easing.out(Easing.quad), useNativeDriver:true }).start()
    loadData()
  }, [])

  async function loadData(refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true)
    try {
      const { data } = await supabase
        .from('scans')
        .select('id,predicted_class,confidence,uncertainty_score,uncertainty_level,referral_flag,status,created_at,patients(patient_code)')
        .eq('status', 'pending')
        .in('uncertainty_level', ['high', 'medium'])
        .order('uncertainty_score', { ascending: false })
        .limit(80)
      setItems((data ?? []).map((s: any) => ({
        id: s.id,
        code: s.patients?.patient_code ?? `SC-${s.id.slice(0,6).toUpperCase()}`,
        diagnosis: s.predicted_class,
        confidence: s.confidence,
        uncScore: s.uncertainty_score ?? 0,
        uncLevel: s.uncertainty_level,
        referral: s.referral_flag,
        ago: ago(s.created_at),
      })))
    } catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }

  const high    = items.filter(i => i.uncLevel === 'high').length
  const medium  = items.filter(i => i.uncLevel === 'medium').length
  const referrals = items.filter(i => i.referral).length

  return (
    <Animated.View style={[{ flex: 1 }, { opacity: fade }]}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={C.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ClaraVision</Text>
          <Text style={styles.title}>Review Queue</Text>
          <Text style={styles.sub}>High and medium uncertainty cases awaiting senior specialist review</Text>
        </View>

        {/* Summary cards */}
        <View style={styles.kpiRow}>
          {[
            { label:'High Uncertainty', value:high,     icon:AlertTriangle, accent:C.danger },
            { label:'Medium',           value:medium,   icon:AlertCircle,   accent:C.amber  },
            { label:'Referrals',        value:referrals,icon:Clock,         accent:C.blue   },
          ].map(({ label, value, icon:Icon, accent }) => (
            <View key={label} style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: accent + '20' }]}>
                <Icon color={accent} size={18} />
              </View>
              <Text style={styles.kpiLabel}>{label}</Text>
              {loading
                ? <Skeleton height={26} width={40} radius={6} style={{ marginTop:4 }}/>
                : <Text style={[styles.kpiValue, { color: accent }]}>{value}</Text>
              }
            </View>
          ))}
        </View>

        {/* Queue items */}
        {loading && [...Array(3)].map((_,i) => (
          <View key={i} style={styles.itemCard}>
            <Skeleton height={14} width={160} radius={4} style={{ marginBottom:8 }}/>
            <Skeleton height={12} width={240} radius={4} style={{ marginBottom:8 }}/>
            <Skeleton height={6}  width={'100%'} radius={3}/>
          </View>
        ))}

        {!loading && items.length === 0 && (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <CheckCircle color="#3B6D11" size={32} />
            </View>
            <Text style={styles.emptyH}>Queue is clear</Text>
            <Text style={styles.emptySub}>No pending high or medium uncertainty scans. All caught up.</Text>
          </View>
        )}

        {!loading && items.map((item) => {
          const isHigh = item.uncLevel === 'high'
          const barW   = `${Math.round(item.uncScore * 100)}%`
          return (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.itemCard,
                { borderLeftColor: isHigh ? C.danger : C.amber },
                pressed && { opacity: 0.85 }
              ]}
              onPress={() => router.push({ pathname: '/result', params: { id: item.id } } as any)}
            >
              {/* Top row */}
              <View style={styles.itemTop}>
                <View style={styles.itemMeta}>
                  <Text style={[styles.itemPriority, { color: isHigh ? C.danger : C.amber }]}>
                    {isHigh ? '⚠ HIGH' : '△ MEDIUM'}
                  </Text>
                  <Text style={styles.itemCode}>{item.code}</Text>
                  {item.referral && (
                    <View style={styles.referralBadge}>
                      <Text style={styles.referralTxt}>REFERRAL</Text>
                    </View>
                  )}
                </View>
                <ChevronRight color={C.textMuted} size={16} />
              </View>

              {/* Diagnosis */}
              <Text style={styles.itemDiag}>{item.diagnosis}</Text>

              {/* Metrics */}
              <View style={styles.metricsRow}>
                <Text style={styles.metricTxt}>
                  Conf: <Text style={styles.metricVal}>{(item.confidence * 100).toFixed(1)}%</Text>
                </Text>
                <Text style={styles.metricTxt}>
                  Uncertainty: <Text style={[styles.metricVal, { color: isHigh ? C.danger : C.amber }]}>
                    {(item.uncScore * 100).toFixed(0)}%
                  </Text>
                </Text>
                <Text style={styles.metricTxt}>{item.ago}</Text>
              </View>

              {/* Progress bar */}
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: barW as any, backgroundColor: isHigh ? C.danger : C.amber }]} />
              </View>

              <UncertaintyBadge level={item.uncLevel} size="sm" />
            </Pressable>
          )
        })}
      </ScrollView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root:          { flex:1, backgroundColor:C.bg },
  content:       { padding:16, gap:12, paddingBottom:32 },
  header:        { gap:3 },
  eyebrow:       { color:C.primary, fontSize:11, fontWeight:'700', textTransform:'uppercase', letterSpacing:1 },
  title:         { color:C.text, fontSize:22, fontWeight:'900' },
  sub:           { color:C.textMuted, fontSize:13, lineHeight:19 },
  kpiRow:        { flexDirection:'row', gap:10 },
  kpiCard:       { flex:1, backgroundColor:C.card, borderRadius:14, padding:12, alignItems:'center', gap:4, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  kpiIcon:       { width:36, height:36, borderRadius:10, alignItems:'center', justifyContent:'center' },
  kpiLabel:      { color:C.textMuted, fontSize:10, fontWeight:'600', textTransform:'uppercase', textAlign:'center' },
  kpiValue:      { fontSize:24, fontWeight:'900' },
  itemCard:      { backgroundColor:C.card, borderRadius:14, padding:14, gap:8, borderLeftWidth:4, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  itemTop:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  itemMeta:      { flexDirection:'row', alignItems:'center', gap:8, flex:1, flexWrap:'wrap' },
  itemPriority:  { fontSize:11, fontWeight:'800', textTransform:'uppercase' },
  itemCode:      { color:C.text, fontSize:13, fontWeight:'700' },
  referralBadge: { backgroundColor:C.dangerBg, borderRadius:6, paddingHorizontal:6, paddingVertical:2 },
  referralTxt:   { color:C.dangerText, fontSize:9, fontWeight:'800', textTransform:'uppercase' },
  itemDiag:      { color:C.textSub, fontSize:14, fontWeight:'600' },
  metricsRow:    { flexDirection:'row', gap:12, flexWrap:'wrap' },
  metricTxt:     { color:C.textMuted, fontSize:12 },
  metricVal:     { fontWeight:'700', color:C.text },
  barBg:         { height:5, backgroundColor:C.borderLight, borderRadius:3, overflow:'hidden' },
  barFill:       { height:5, borderRadius:3 },
  emptyWrap:     { alignItems:'center', paddingVertical:48, gap:10 },
  emptyIcon:     { width:64, height:64, borderRadius:18, backgroundColor:C.lowBg, alignItems:'center', justifyContent:'center' },
  emptyH:        { color:C.text, fontSize:17, fontWeight:'800' },
  emptySub:      { color:C.textMuted, fontSize:13, textAlign:'center', lineHeight:19, maxWidth:280 },
})
