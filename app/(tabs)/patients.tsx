import { useState, useEffect, useRef } from 'react'
import { router } from 'expo-router'
import {
  Animated, Easing, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { Search, ScanLine, Building2, Hash, UserPlus } from 'lucide-react-native'
import { UncertaintyBadge } from '../../components/UncertaintyBadge'
import { Skeleton } from '../../components/Skeleton'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/colors'

function ago(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d/60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m/60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h/24)}d ago`
}

export default function PatientsScreen() {
  const [search, setSearch]   = useState('')
  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
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
        .from('patients')
        .select('id,patient_code,age,gender,institution,scans(id,predicted_class,uncertainty_level,created_at)')
        .order('created_at', { ascending: false })
        .limit(100)
      setPatients((data ?? []).map((p: any) => {
        const scans = (p.scans ?? []).sort((a:any,b:any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const latest = scans[0]
        return {
          id: p.id,
          code: p.patient_code,
          age: p.age,
          gender: p.gender,
          institution: p.institution,
          scanCount: scans.length,
          lastAgo: latest ? ago(latest.created_at) : null,
          lastClass: latest?.predicted_class ?? null,
          lastUnc: latest?.uncertainty_level ?? null,
        }
      }))
    } catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }

  const filtered = patients.filter(p => {
    const q = search.toLowerCase()
    return p.code.toLowerCase().includes(q) ||
      (p.institution ?? '').toLowerCase().includes(q) ||
      (p.lastClass ?? '').toLowerCase().includes(q)
  })

  return (
    <Animated.View style={[{ flex:1 }, { opacity:fade }]}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={C.primary}/>}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ClaraVision</Text>
          <Text style={styles.title}>Patient Records</Text>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Search color={C.textMuted} size={16} style={styles.searchIcon as any}/>
          <TextInput
            style={styles.searchInp}
            placeholder="Search patient, institution or diagnosis…"
            placeholderTextColor={C.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} style={styles.clearSearch}>
              <Text style={styles.clearTxt}>✕</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.count}>{loading ? '–' : `${filtered.length} patient${filtered.length!==1?'s':''}`}</Text>

        {/* Loading */}
        {loading && [...Array(4)].map((_,i) => (
          <View key={i} style={styles.card}>
            <Skeleton height={14} width={120} radius={4} style={{marginBottom:8}}/>
            <Skeleton height={12} width={200} radius={4} style={{marginBottom:6}}/>
            <Skeleton height={12} width={160} radius={4}/>
          </View>
        ))}

        {/* Empty */}
        {!loading && patients.length === 0 && (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}><UserPlus color={C.primary} size={32}/></View>
            <Text style={styles.emptyH}>No patient records yet</Text>
            <Text style={styles.emptySub}>Patient records are created automatically when you save a scan. Analyse a retinal image to create the first record.</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/(tabs)/capture' as any)}>
              <ScanLine color="white" size={16}/>
              <Text style={styles.emptyBtnTxt}>Analyse First Scan</Text>
            </Pressable>
          </View>
        )}

        {/* No search results */}
        {!loading && patients.length > 0 && filtered.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyH}>No match for &quot;{search}&quot;</Text>
          </View>
        )}

        {/* Patient cards */}
        {!loading && filtered.map((p) => (
          <Pressable
            key={p.id}
            style={({ pressed }) => [styles.card, pressed && { opacity:0.85, transform:[{scale:0.99}] }]}
            onPress={() => router.push('/(tabs)/capture' as any)}
          >
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.code}>{p.code}</Text>
                <Text style={styles.demo}>
                  {[p.age ? `${p.age} yr` : null, p.gender].filter(Boolean).join(' · ') || 'Demographics not recorded'}
                </Text>
              </View>
              {p.lastUnc && <UncertaintyBadge level={p.lastUnc} size="sm"/>}
            </View>

            {p.institution && (
              <View style={styles.row}>
                <Building2 color={C.textMuted} size={13}/>
                <Text style={styles.metaTxt}>{p.institution}</Text>
              </View>
            )}

            <View style={styles.row}>
              <Hash color={C.textMuted} size={13}/>
              <Text style={styles.metaTxt}>{p.scanCount} scan{p.scanCount!==1?'s':''}</Text>
              {p.lastAgo && <Text style={styles.metaTxt}> · {p.lastAgo}</Text>}
            </View>

            {p.lastClass && (
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Latest finding</Text>
                <Text style={styles.diagValue}>{p.lastClass}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root:        { flex:1, backgroundColor:C.bg },
  content:     { padding:16, gap:12, paddingBottom:32 },
  header:      { gap:2 },
  eyebrow:     { color:C.primary, fontSize:11, fontWeight:'700', textTransform:'uppercase', letterSpacing:1 },
  title:       { color:C.text, fontSize:22, fontWeight:'900' },
  searchWrap:  { flexDirection:'row', alignItems:'center', backgroundColor:C.card, borderRadius:12, borderWidth:1.5, borderColor:C.border, paddingLeft:12 },
  searchIcon:  { marginRight:8 },
  searchInp:   { flex:1, height:44, fontSize:14, color:C.text },
  clearSearch: { padding:12 },
  clearTxt:    { color:C.textMuted, fontSize:14 },
  count:       { color:C.textMuted, fontSize:12, fontWeight:'600' },
  card:        { backgroundColor:C.card, borderRadius:14, padding:14, gap:8, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  cardTop:     { flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between' },
  code:        { color:C.text, fontSize:15, fontWeight:'800' },
  demo:        { color:C.textMuted, fontSize:12, marginTop:2 },
  row:         { flexDirection:'row', alignItems:'center', gap:6 },
  metaTxt:     { color:C.textMuted, fontSize:12 },
  diagRow:     { borderTopWidth:1, borderTopColor:C.borderLight, paddingTop:8, marginTop:2 },
  diagLabel:   { color:C.textMuted, fontSize:11 },
  diagValue:   { color:C.text, fontSize:13, fontWeight:'700', marginTop:2 },
  emptyWrap:   { alignItems:'center', paddingVertical:40, gap:10 },
  emptyIcon:   { width:64, height:64, borderRadius:18, backgroundColor:C.primaryBg, alignItems:'center', justifyContent:'center' },
  emptyH:      { color:C.text, fontSize:16, fontWeight:'800', textAlign:'center' },
  emptySub:    { color:C.textMuted, fontSize:13, textAlign:'center', lineHeight:19, maxWidth:280 },
  emptyBtn:    { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.primary, borderRadius:12, paddingHorizontal:18, paddingVertical:10, marginTop:4 },
  emptyBtnTxt: { color:'white', fontSize:14, fontWeight:'700' },
})
