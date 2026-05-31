import { useState, useEffect, useRef } from 'react'
import { router } from 'expo-router'
import {
  Animated, Easing, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View, Alert,
} from 'react-native'
import {
  Building2, LogOut, FileText,
  CheckCircle, XCircle, Calendar, Shield, Calculator,
} from 'lucide-react-native'
import { UncertaintyBadge } from '../../components/UncertaintyBadge'
import { Skeleton } from '../../components/Skeleton'
import { supabase } from '../../lib/supabase'
import { C } from '../../lib/colors'

const ROLE_LABELS: Record<string,string> = {
  ophthalmologist: 'Ophthalmologist',
  optometrist:     'Optometrist',
  resident:        'Ophthalmology Resident',
  researcher:      'Retinal Researcher',
  admin:           'Administrator',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}

export default function ProfileScreen() {
  const [profile, setProfile]   = useState<any>(null)
  const [reports, setReports]   = useState<any[]>([])
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
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        setProfile(prof ?? { full_name:'Administrator', role:'admin', institution:'ClaraVision', email: user.email })
      } else {
        // Local admin fallback
        setProfile({ full_name:'Administrator', role:'admin', institution:'ClaraVision' })
      }

      const { data: rev } = await supabase
        .from('reviews')
        .select(`
          id,agreement,final_diagnosis,notes,signed_off_at,
          scans(predicted_class,confidence,uncertainty_level,patients(patient_code))
        `)
        .order('signed_off_at', { ascending: false })
        .limit(20)
      setReports((rev ?? []).filter((r:any) => r.scans).map((r:any) => ({
        id: r.id,
        code: r.scans.patients?.patient_code ?? 'PT-XXXX',
        diagnosis: r.scans.predicted_class,
        final: r.final_diagnosis,
        confidence: r.scans.confidence,
        uncertainty: r.scans.uncertainty_level,
        agreement: r.agreement === 'agree',
        date: r.signed_off_at,
        notes: r.notes,
      })))
    } catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of ClaraVision?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
          router.replace('/login' as any)
        },
      },
    ])
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n:string) => n[0]).join('').toUpperCase().slice(0,2)
    : 'CV'

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
          <Text style={styles.title}>Profile & Reports</Text>
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          {loading ? (
            <View style={styles.profileRow}>
              <Skeleton height={56} width={56} radius={18}/>
              <View style={{ gap:8, flex:1 }}>
                <Skeleton height={16} width={160} radius={4}/>
                <Skeleton height={12} width={120} radius={4}/>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarTxt}>{initials}</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.name}>{profile?.full_name ?? 'Clinician'}</Text>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleTxt}>{ROLE_LABELS[profile?.role ?? ''] ?? 'Clinician'}</Text>
                  </View>
                </View>
              </View>
              {profile?.institution && (
                <View style={styles.metaRow}>
                  <Building2 color={C.textMuted} size={14}/>
                  <Text style={styles.metaTxt}>{profile.institution}</Text>
                </View>
              )}
              <View style={styles.trustRow}>
                {['HIPAA', 'FDA', 'CE', 'ISO 13485'].map(b => (
                  <View key={b} style={styles.trustBadge}>
                    <Shield color={C.primary} size={10}/>
                    <Text style={styles.trustTxt}>{b}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Clinical tools */}
        <Pressable
          style={({ pressed }) => [styles.toolBtn, pressed && { opacity:0.85 }]}
          onPress={() => router.push('/risk-calculator' as any)}
        >
          <View style={styles.toolIcon}><Calculator color={C.primary} size={18}/></View>
          <View style={{ flex:1 }}>
            <Text style={styles.toolTitle}>Clinical Risk Calculators</Text>
            <Text style={styles.toolSub}>DR risk · Glaucoma risk stratification</Text>
          </View>
          <Text style={styles.toolArrow}>›</Text>
        </Pressable>

        {/* Sign out */}
        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && { opacity:0.8 }]}
          onPress={handleSignOut}
        >
          <LogOut color={C.danger} size={18}/>
          <Text style={styles.signOutTxt}>Sign Out of ClaraVision</Text>
        </Pressable>

        {/* Reports */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>My Signed Reports</Text>
            <Text style={styles.count}>{loading ? '–' : reports.length}</Text>
          </View>

          {loading && [...Array(2)].map((_,i) => (
            <View key={i} style={styles.reportCard}>
              <Skeleton height={14} width={130} radius={4} style={{ marginBottom:8 }}/>
              <Skeleton height={12} width={200} radius={4} style={{ marginBottom:6 }}/>
              <Skeleton height={12} width={160} radius={4}/>
            </View>
          ))}

          {!loading && reports.length === 0 && (
            <View style={styles.emptyWrap}>
              <FileText color={C.textMuted} size={32}/>
              <Text style={styles.emptyH}>No signed reports yet</Text>
              <Text style={styles.emptySub}>Reports are created when you sign off on a scan review.</Text>
            </View>
          )}

          {!loading && reports.map(r => (
            <View key={r.id} style={styles.reportCard}>
              <View style={styles.reportTop}>
                <View style={styles.reportLeft}>
                  <Text style={styles.reportCode}>{r.code}</Text>
                  <Text style={styles.reportDiag}>{r.diagnosis}</Text>
                </View>
                <View style={styles.reportRight}>
                  <UncertaintyBadge level={r.uncertainty} size="sm"/>
                  <View style={[styles.agreeBadge, r.agreement ? styles.agreedBadge : styles.overriddenBadge]}>
                    {r.agreement
                      ? <CheckCircle color={C.lowText} size={11}/>
                      : <XCircle color={C.amberText} size={11}/>
                    }
                    <Text style={[styles.agreeTxt, { color: r.agreement ? C.lowText : C.amberText }]}>
                      {r.agreement ? 'Confirmed' : 'Overridden'}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.finalDiag}>{r.final}</Text>
              {r.notes ? <Text style={styles.notes} numberOfLines={2}>{r.notes}</Text> : null}
              <View style={styles.reportMeta}>
                <Calendar color={C.textMuted} size={12}/>
                <Text style={styles.metaTxt}>{fmtDate(r.date)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* About */}
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>About ClaraVision</Text>
          <Text style={styles.aboutTxt}>
            ClaraVision is an explainable AI clinical decision-support platform for retinal disease diagnosis, built by Arnob Aich Anurag as part of the Research Symposium initiative.
          </Text>
          <View style={styles.aboutRow}>
            <View style={styles.aboutChip}><Text style={styles.aboutChipTxt}>v1.0.0</Text></View>
            <View style={styles.aboutChip}><Text style={styles.aboutChipTxt}>ResNet-50 XAI</Text></View>
            <View style={styles.aboutChip}><Text style={styles.aboutChipTxt}>Supabase</Text></View>
          </View>
          <Text style={styles.credit}>Built by Arnob Aich Anurag</Text>
        </View>
      </ScrollView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root:           { flex:1, backgroundColor:C.bg },
  content:        { padding:16, gap:14, paddingBottom:40 },
  header:         { gap:2 },
  eyebrow:        { color:C.primary, fontSize:11, fontWeight:'700', textTransform:'uppercase', letterSpacing:1 },
  title:          { color:C.text, fontSize:22, fontWeight:'900' },
  profileCard:    { backgroundColor:C.card, borderRadius:16, padding:18, gap:12, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.07, shadowRadius:10, elevation:3 },
  profileRow:     { flexDirection:'row', alignItems:'center', gap:14 },
  avatar:         { width:56, height:56, borderRadius:18, backgroundColor:C.primary, alignItems:'center', justifyContent:'center', shadowColor:C.primary, shadowOffset:{width:0,height:3}, shadowOpacity:0.3, shadowRadius:8, elevation:4 },
  avatarTxt:      { color:'white', fontSize:20, fontWeight:'900' },
  profileInfo:    { flex:1, gap:4 },
  name:           { color:C.text, fontSize:18, fontWeight:'900' },
  roleBadge:      { backgroundColor:C.primaryBg, borderRadius:99, paddingHorizontal:10, paddingVertical:3, alignSelf:'flex-start' },
  roleTxt:        { color:C.primary, fontSize:11, fontWeight:'700' },
  metaRow:        { flexDirection:'row', alignItems:'center', gap:6 },
  metaTxt:        { color:C.textMuted, fontSize:13 },
  trustRow:       { flexDirection:'row', flexWrap:'wrap', gap:6 },
  trustBadge:     { flexDirection:'row', alignItems:'center', gap:4, borderRadius:99, borderWidth:1, borderColor:C.primaryBorder, backgroundColor:C.primaryBg, paddingHorizontal:8, paddingVertical:3 },
  trustTxt:       { color:C.primary, fontSize:10, fontWeight:'700' },
  toolBtn:        { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:C.card, borderRadius:14, padding:14, borderWidth:1.5, borderColor:C.primaryBorder, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.05, shadowRadius:6, elevation:2 },
  toolIcon:       { width:40, height:40, borderRadius:12, backgroundColor:C.primaryBg, alignItems:'center', justifyContent:'center' },
  toolTitle:      { color:C.text, fontSize:14, fontWeight:'800' },
  toolSub:        { color:C.textMuted, fontSize:12, marginTop:1 },
  toolArrow:      { color:C.primary, fontSize:22, fontWeight:'300', marginLeft:4 },
  signOutBtn:     { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:C.card, borderRadius:12, padding:14, borderWidth:1.5, borderColor:'#f5c5c0' },
  signOutTxt:     { color:C.danger, fontSize:15, fontWeight:'700', flex:1 },
  section:        { gap:10 },
  sectionRow:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  sectionTitle:   { color:C.text, fontSize:16, fontWeight:'800' },
  count:          { color:C.textMuted, fontSize:13, fontWeight:'600' },
  reportCard:     { backgroundColor:C.card, borderRadius:14, padding:14, gap:8, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  reportTop:      { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' },
  reportLeft:     { flex:1 },
  reportRight:    { alignItems:'flex-end', gap:4 },
  reportCode:     { color:C.text, fontSize:13, fontWeight:'800' },
  reportDiag:     { color:C.textMuted, fontSize:12, marginTop:2 },
  agreeBadge:     { flexDirection:'row', alignItems:'center', gap:4, borderRadius:99, paddingHorizontal:7, paddingVertical:3 },
  agreedBadge:    { backgroundColor:C.lowBg },
  overriddenBadge:{ backgroundColor:C.amberBg },
  agreeTxt:       { fontSize:10, fontWeight:'700' },
  finalDiag:      { color:C.text, fontSize:13, fontWeight:'700' },
  notes:          { color:C.textMuted, fontSize:12, lineHeight:17 },
  reportMeta:     { flexDirection:'row', alignItems:'center', gap:6 },
  emptyWrap:      { alignItems:'center', paddingVertical:32, gap:8 },
  emptyH:         { color:C.text, fontSize:15, fontWeight:'700' },
  emptySub:       { color:C.textMuted, fontSize:13, textAlign:'center' },
  aboutCard:      { backgroundColor:C.card, borderRadius:16, padding:18, gap:10, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  aboutTitle:     { color:C.text, fontSize:15, fontWeight:'800' },
  aboutTxt:       { color:C.textMuted, fontSize:13, lineHeight:19 },
  aboutRow:       { flexDirection:'row', flexWrap:'wrap', gap:6 },
  aboutChip:      { backgroundColor:C.primaryBg, borderRadius:99, paddingHorizontal:10, paddingVertical:4 },
  aboutChipTxt:   { color:C.primary, fontSize:11, fontWeight:'700' },
  credit:         { color:C.primary, fontSize:12, fontWeight:'700', textAlign:'center', marginTop:2 },
})
