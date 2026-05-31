import { useState, useRef, useEffect } from 'react'
import { router } from 'expo-router'
import {
  Animated, Easing, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { EyeOff, Eye, ChevronRight, ChevronDown } from 'lucide-react-native'
import { EyeAnimation } from '../components/EyeAnimation'
import { C } from '../lib/colors'
import { isSupabaseReady, supabase } from '../lib/supabase'

const ROLES = [
  { value: 'ophthalmologist', label: 'Ophthalmologist' },
  { value: 'optometrist',     label: 'Optometrist' },
  { value: 'resident',        label: 'Ophthalmology Resident' },
  { value: 'researcher',      label: 'Retinal Researcher' },
  { value: 'admin',           label: 'Administrator' },
]

export default function RegisterScreen() {
  const [form, setForm] = useState({ full_name:'', email:'', password:'', role:'', institution:'' })
  const [showPw, setShowPw]       = useState(false)
  const [showRoles, setShowRoles] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const fadeHero  = useRef(new Animated.Value(0)).current
  const fadeForm  = useRef(new Animated.Value(0)).current
  const slideForm = useRef(new Animated.Value(24)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeHero,  { toValue:1, duration:700, delay:80,  easing:Easing.out(Easing.quad), useNativeDriver:true }),
      Animated.timing(fadeForm,  { toValue:1, duration:600, delay:350, easing:Easing.out(Easing.quad), useNativeDriver:true }),
      Animated.timing(slideForm, { toValue:0, duration:600, delay:350, easing:Easing.out(Easing.quad), useNativeDriver:true }),
    ]).start()
  }, [])

  function update(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleRegister() {
    if (!form.full_name || !form.email || !form.password || !form.role) {
      setError('Please fill in all required fields.'); return
    }
    setError(''); setLoading(true)
    try {
      if (!isSupabaseReady()) {
        setError('Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/mobile/.env.')
        return
      }
      const { error: e } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.full_name, role: form.role, institution: form.institution } },
      })
      if (e) throw e
      router.replace('/(tabs)')
    } catch (e: any) {
      setError(e?.message ?? 'Registration failed. Please try again.')
    } finally { setLoading(false) }
  }

  const selectedRoleLabel = ROLES.find(r => r.value === form.role)?.label ?? 'Select your role'

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Hero */}
        <Animated.View style={[styles.hero, { opacity: fadeHero }]}>
          <Text style={styles.brand}>ClaraVision</Text>
          <Text style={styles.brandSub}>Clinical AI · Retinal Disease Diagnosis</Text>
          <View style={styles.eyeBox}>
            <EyeAnimation size={260} dark />
          </View>
          <Text style={styles.heroH}>Join the Clinical AI Platform</Text>
          <Text style={styles.heroAccent}>Built for Eye Care Professionals</Text>
          <Text style={styles.heroBody}>
            Submit retinal fundus images for AI-assisted triage, explainability-driven sign-off workflows, and structured PDF reporting — all in one clinical workspace.
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View style={[styles.card, { opacity: fadeForm, transform:[{translateY:slideForm}] }]}>
          <Text style={styles.cardH}>Create Clinician Account</Text>
          <Text style={styles.cardSub}>Register for access to ClaraVision</Text>

          {[
            { key:'full_name',   label:'Full Name & Title',      ph:'Dr. Sarah Chen',          kb:'default' as const },
            { key:'email',       label:'Institutional Email',    ph:'clinician@hospital.org',  kb:'email-address' as const },
            { key:'institution', label:'Hospital / Institution', ph:'City Eye Institute',      kb:'default' as const },
          ].map(f => (
            <View key={f.key}>
              <Text style={styles.lbl}>{f.label}</Text>
              <TextInput
                style={styles.inp}
                placeholder={f.ph} placeholderTextColor={C.textMuted}
                value={(form as any)[f.key]}
                onChangeText={v => update(f.key as keyof typeof form, v)}
                keyboardType={f.kb}
                autoCapitalize={f.kb === 'email-address' ? 'none' : 'words'}
                autoCorrect={false}
              />
            </View>
          ))}

          <Text style={styles.lbl}>Password</Text>
          <View style={styles.pwRow}>
            <TextInput style={styles.pwInp} placeholder="Min. 8 characters" placeholderTextColor={C.textMuted}
              value={form.password} onChangeText={v => update('password',v)} secureTextEntry={!showPw} autoCapitalize="none" />
            <Pressable style={styles.eyeBtn} onPress={() => setShowPw(v => !v)}>
              {showPw ? <EyeOff color={C.textMuted} size={18}/> : <Eye color={C.textMuted} size={18}/>}
            </Pressable>
          </View>

          <Text style={styles.lbl}>Clinical Role</Text>
          <Pressable style={styles.selectBtn} onPress={() => setShowRoles(v => !v)}>
            <Text style={[styles.selectTxt, !form.role && {color:C.textMuted}]}>{selectedRoleLabel}</Text>
            <ChevronDown color={C.textMuted} size={16}/>
          </Pressable>
          {showRoles && (
            <View style={styles.dropdown}>
              {ROLES.map(r => (
                <Pressable key={r.value} style={[styles.dropItem, form.role === r.value && styles.dropItemActive]}
                  onPress={() => { update('role', r.value); setShowRoles(false) }}>
                  <Text style={[styles.dropTxt, form.role === r.value && styles.dropTxtActive]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {!!error && <View style={styles.errBox}><Text style={styles.errTxt}>{error}</Text></View>}

          <Pressable style={({pressed}) => [styles.btn, pressed && {opacity:0.85}, !form.role && styles.btnDisabled]}
            onPress={handleRegister} disabled={loading || !form.role}>
            <Text style={styles.btnTxt}>{loading ? 'Creating account…' : 'Create Clinician Account'}</Text>
            {!loading && <ChevronRight color="white" size={18}/>}
          </Pressable>

          <View style={styles.rowC}>
            <Text style={styles.grayTxt}>Already registered?  </Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.link}>Sign in</Text>
            </Pressable>
          </View>

          <Text style={styles.disc}>
            By registering, you confirm this platform will be used solely as clinical decision support under qualified clinician oversight.
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root:          { flex:1, backgroundColor:C.bg },
  scroll:        { flexGrow:1 },
  hero:          { backgroundColor:'#071a10', paddingHorizontal:24, paddingTop:52, paddingBottom:24, overflow:'hidden' },
  brand:         { color:'white', fontSize:26, fontWeight:'900', letterSpacing:-0.5 },
  brandSub:      { color:'rgba(167,243,208,0.6)', fontSize:11, marginTop:2, marginBottom:16, textTransform:'uppercase', letterSpacing:1.2 },
  eyeBox:        { alignItems:'center', marginBottom:16, borderRadius:18, overflow:'hidden', backgroundColor:'rgba(255,255,255,0.03)', paddingVertical:8 },
  heroH:         { color:'white', fontSize:19, fontWeight:'800', textAlign:'center' },
  heroAccent:    { color:'#34d399', fontSize:13, fontWeight:'700', textAlign:'center', marginTop:2, marginBottom:10 },
  heroBody:      { color:'rgba(209,250,229,0.7)', fontSize:12, textAlign:'center', lineHeight:18 },
  card:          { backgroundColor:C.card, margin:16, borderRadius:20, padding:24, shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.08, shadowRadius:16, elevation:4 },
  cardH:         { fontSize:22, fontWeight:'900', color:C.text, marginBottom:4 },
  cardSub:       { fontSize:13, color:C.textMuted, marginBottom:22 },
  lbl:           { fontSize:13, fontWeight:'700', color:C.text, marginBottom:6 },
  inp:           { height:46, borderRadius:12, borderWidth:1.5, borderColor:C.border, paddingHorizontal:14, fontSize:14, color:C.text, backgroundColor:'white', marginBottom:14 },
  pwRow:         { flexDirection:'row', alignItems:'center', height:46, borderRadius:12, borderWidth:1.5, borderColor:C.border, backgroundColor:'white', paddingLeft:14, marginBottom:14 },
  pwInp:         { flex:1, fontSize:14, color:C.text },
  eyeBtn:        { padding:10 },
  selectBtn:     { height:46, borderRadius:12, borderWidth:1.5, borderColor:C.border, backgroundColor:'white', paddingHorizontal:14, flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:4 },
  selectTxt:     { fontSize:14, color:C.text },
  dropdown:      { borderRadius:12, borderWidth:1.5, borderColor:C.border, backgroundColor:'white', marginBottom:14, overflow:'hidden' },
  dropItem:      { paddingHorizontal:14, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.borderLight },
  dropItemActive:{ backgroundColor:C.primaryBg },
  dropTxt:       { fontSize:14, color:C.text },
  dropTxtActive: { color:C.primary, fontWeight:'700' },
  errBox:        { backgroundColor:'#FCEBEB', borderRadius:10, borderWidth:1, borderColor:'#f5c5c0', padding:10, marginBottom:12, marginTop:4 },
  errTxt:        { color:C.dangerText, fontSize:13 },
  btn:           { height:50, borderRadius:14, backgroundColor:C.primary, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, shadowColor:C.primary, shadowOffset:{width:0,height:4}, shadowOpacity:0.35, shadowRadius:10, elevation:6, marginTop:8 },
  btnDisabled:   { opacity:0.5 },
  btnTxt:        { color:'white', fontSize:16, fontWeight:'800' },
  rowC:          { flexDirection:'row', justifyContent:'center', marginTop:18 },
  grayTxt:       { color:C.textMuted, fontSize:14 },
  link:          { color:C.primary, fontSize:14, fontWeight:'700' },
  disc:          { marginTop:20, textAlign:'center', color:C.textMuted, fontSize:11, lineHeight:16, opacity:0.6 },
})
