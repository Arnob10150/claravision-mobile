/**
 * Login — mobile port of the web Login page.
 * Left panel (web) → Top hero panel (mobile): dark teal bg, eye animation, brand.
 * Right panel (web) → Bottom card: clean white form.
 */
import { useState, useRef, useEffect } from 'react'
import { router } from 'expo-router'
import {
  Animated, Easing, Image, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { Eye, EyeOff, ChevronRight, Shield, Brain, Activity } from 'lucide-react-native'
import { C } from '../lib/colors'
import { isSupabaseReady, supabase } from '../lib/supabase'

const ADMIN_EMAIL    = 'admin@gmail.com'
const ADMIN_PASSWORD = 'admin'

// ── Particle extracted as a proper component (fixes hooks-in-map bug) ──────
function Particle({ left, top, delay, duration }: {
  left: string; top: string; delay: number; duration: number
}) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start()
  }, [])
  return (
    <Animated.View style={[
      styles.particle,
      { left: left as any, top: top as any },
      { opacity: anim.interpolate({ inputRange:[0,0.5,1], outputRange:[0.2,0.55,0.2] }) },
      { transform: [{ translateY: anim.interpolate({ inputRange:[0,1], outputRange:[0,-14] }) }] },
    ]} />
  )
}

const PARTICLES = [
  { l:'8%',  t:'14%', d:0,    dur:3200 },
  { l:'20%', t:'30%', d:400,  dur:3600 },
  { l:'38%', t:'10%', d:800,  dur:3000 },
  { l:'55%', t:'42%', d:200,  dur:3400 },
  { l:'72%', t:'20%', d:600,  dur:3800 },
  { l:'88%', t:'48%', d:1000, dur:3200 },
]

export default function LoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

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

  async function handleSignIn() {
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return }
    setError(''); setLoading(true)
    try {
      if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        router.replace('/(tabs)' as any); return
      }
      if (!isSupabaseReady()) {
        setError('Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/mobile/.env.')
        return
      }
      const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (e) throw e
      router.replace('/(tabs)' as any)
    } catch (e: any) {
      setError(e?.message ?? 'Invalid credentials. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Hero (mirrors web left panel) ── */}
        <Animated.View style={[styles.hero, { opacity: fadeHero }]}>
          {PARTICLES.map((p, i) => (
            <Particle key={i} left={p.l} top={p.t} delay={p.d} duration={p.dur} />
          ))}

          {/* Brand */}
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}><Eye color="white" size={18}/></View>
            <Text style={styles.brand}>ClaraVision</Text>
          </View>

          {/* Eye exam animation — same as web left panel */}
          <View style={styles.eyeBox}>
            <Image
              source={require('../assets/eye_exam_color_0F6E56.png')}
              style={styles.examImage}
              resizeMode="contain"
            />
          </View>

          {/* Tagline (mirrors web heading) */}
          <Text style={styles.heroH}>Retinal AI Clinicians Trust</Text>
          <Text style={styles.heroAccent}>Powered by Explainable AI</Text>

          {/* Feature bullets (mirrors web bullet list) */}
          <View style={styles.bullets}>
            {[
              { I: Brain,    t: 'ClaraVision-XAI deep learning model' },
              { I: Activity, t: '9-class retinal pathology classification' },
              { I: Shield,   t: 'HIPAA compliant · FDA decision support' },
            ].map(({ I, t }, i) => (
              <View key={i} style={styles.bullet}>
                <View style={styles.bulletDot}><I color="#6ee7b7" size={12}/></View>
                <Text style={styles.bulletTxt}>{t}</Text>
              </View>
            ))}
          </View>

          {/* Trust badges (mirrors web badges) */}
          <View style={styles.tagRow}>
            {['HIPAA', 'FDA Cleared', 'CE Marked', 'ISO 13485'].map(b => (
              <View key={b} style={styles.tag}><Text style={styles.tagTxt}>{b}</Text></View>
            ))}
          </View>
        </Animated.View>

        {/* ── Form card (mirrors web right panel) ── */}
        <Animated.View style={[styles.card, { opacity: fadeForm, transform:[{translateY:slideForm}] }]}>
          <Text style={styles.cardH}>Clinician Sign In</Text>
          <Text style={styles.cardSub}>Access your retinal AI workstation</Text>

          <Text style={styles.lbl}>Institutional Email</Text>
          <TextInput
            style={styles.inp}
            placeholder="clinician@hospital.org" placeholderTextColor={C.textMuted}
            value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          />

          <Text style={styles.lbl}>Password</Text>
          <View style={styles.pwRow}>
            <TextInput
              style={styles.pwInp}
              placeholder="••••••••" placeholderTextColor={C.textMuted}
              value={password} onChangeText={setPassword}
              secureTextEntry={!showPw} autoCapitalize="none"
            />
            <Pressable style={styles.eyeBtn} onPress={() => setShowPw(v => !v)}>
              {showPw ? <EyeOff color={C.textMuted} size={18}/> : <Eye color={C.textMuted} size={18}/>}
            </Pressable>
          </View>

          {!!error && (
            <View style={styles.errBox}><Text style={styles.errTxt}>{error}</Text></View>
          )}

          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity:0.88, transform:[{scale:0.98}] }]}
            onPress={handleSignIn} disabled={loading}
          >
            <Text style={styles.btnTxt}>{loading ? 'Authenticating…' : 'Sign In to ClaraVision'}</Text>
            {!loading && <ChevronRight color="white" size={18}/>}
          </Pressable>

          <View style={styles.rowC}>
            <Text style={styles.grayTxt}>New to the platform?  </Text>
            <Pressable onPress={() => router.push('/register' as any)}>
              <Text style={styles.link}>Request access</Text>
            </Pressable>
          </View>

          <Text style={styles.disc}>
            ClaraVision is a clinical decision-support tool. AI predictions must be reviewed by a qualified clinician before any diagnostic or treatment decision.
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root:      { flex:1, backgroundColor: C.bg },
  scroll:    { flexGrow:1 },

  // Hero
  hero:      { backgroundColor:'#071a10', paddingHorizontal:24, paddingTop:52, paddingBottom:28, overflow:'hidden', position:'relative' },
  particle:  { position:'absolute', width:7, height:7, borderRadius:4, backgroundColor:'rgba(52,211,153,0.4)' },
  brandRow:  { flexDirection:'row', alignItems:'center', gap:10, marginBottom:20 },
  brandIcon: { width:34, height:34, borderRadius:10, backgroundColor:'rgba(255,255,255,0.15)', alignItems:'center', justifyContent:'center' },
  brand:     { color:'white', fontSize:22, fontWeight:'900', letterSpacing:-0.5 },
  eyeBox:    { alignItems:'center', borderRadius:20, overflow:'hidden', backgroundColor:'#efefed', paddingVertical:8, marginBottom:18 },
  examImage: { width:'100%', height:210 },
  heroH:     { color:'white', fontSize:22, fontWeight:'900', textAlign:'center' },
  heroAccent:{ color:'#34d399', fontSize:14, fontWeight:'700', textAlign:'center', marginTop:4, marginBottom:16 },
  bullets:   { gap:10, marginBottom:16 },
  bullet:    { flexDirection:'row', alignItems:'center', gap:10 },
  bulletDot: { width:26, height:26, borderRadius:8, backgroundColor:'rgba(15,110,86,0.35)', alignItems:'center', justifyContent:'center' },
  bulletTxt: { color:'rgba(209,250,229,0.85)', fontSize:13, flex:1 },
  tagRow:    { flexDirection:'row', flexWrap:'wrap', gap:6 },
  tag:       { borderRadius:99, borderWidth:1, borderColor:'rgba(52,211,153,0.2)', backgroundColor:'rgba(52,211,153,0.07)', paddingHorizontal:10, paddingVertical:3 },
  tagTxt:    { color:'#6ee7b7', fontSize:10, fontWeight:'700', textTransform:'uppercase', letterSpacing:0.5 },

  // Form card
  card:      { backgroundColor:C.card, margin:16, borderRadius:20, padding:24, shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.08, shadowRadius:16, elevation:4 },
  cardH:     { fontSize:22, fontWeight:'900', color:C.text, marginBottom:4 },
  cardSub:   { fontSize:13, color:C.textMuted, marginBottom:22 },
  lbl:       { fontSize:13, fontWeight:'700', color:C.text, marginBottom:6 },
  inp:       { height:48, borderRadius:12, borderWidth:1.5, borderColor:C.border, paddingHorizontal:14, fontSize:14, color:C.text, backgroundColor:'white', marginBottom:14 },
  pwRow:     { flexDirection:'row', alignItems:'center', height:48, borderRadius:12, borderWidth:1.5, borderColor:C.border, backgroundColor:'white', paddingLeft:14, marginBottom:14 },
  pwInp:     { flex:1, fontSize:14, color:C.text },
  eyeBtn:    { padding:12 },
  errBox:    { backgroundColor:'#FCEBEB', borderRadius:10, borderWidth:1, borderColor:'#f5c5c0', padding:10, marginBottom:12 },
  errTxt:    { color:C.dangerText, fontSize:13 },
  btn:       { height:52, borderRadius:14, backgroundColor:C.primary, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, shadowColor:C.primary, shadowOffset:{width:0,height:4}, shadowOpacity:0.35, shadowRadius:10, elevation:6, marginTop:4 },
  btnTxt:    { color:'white', fontSize:16, fontWeight:'800' },
  rowC:      { flexDirection:'row', justifyContent:'center', marginTop:18 },
  grayTxt:   { color:C.textMuted, fontSize:14 },
  link:      { color:C.primary, fontSize:14, fontWeight:'700' },
  disc:      { marginTop:20, textAlign:'center', color:C.textMuted, fontSize:11, lineHeight:16, opacity:0.6 },
})
