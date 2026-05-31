import { useState, useRef, useEffect } from 'react'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import {
  Animated, Easing, Image, Pressable, ScrollView,
  StyleSheet, Text, View, ActivityIndicator,
} from 'react-native'
import { Camera, ImagePlus, Brain, ChevronRight, Zap, ScanLine, X } from 'lucide-react-native'
import { analyzeImageUri } from '../../lib/inference'
import { C } from '../../lib/colors'

const STEPS = [
  'Loading fundus image…',
  'Preprocessing: contrast normalisation…',
  'Extracting deep features (ResNet-50)…',
  'Running ClaraVision-XAI classifier…',
  'Generating Grad-CAM saliency map…',
  'Calibrating uncertainty estimate…',
  'Compiling clinical reasoning…',
]

export default function CaptureScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [eye, setEye]           = useState<'left'|'right'|''>('')
  const [analysing, setAnalysing] = useState(false)
  const [step, setStep]           = useState(0)
  const [error, setError]         = useState<string | null>(null)

  const scanY = useRef(new Animated.Value(0)).current

  // Entrance
  const fade  = useRef(new Animated.Value(0)).current
  const slide = useRef(new Animated.Value(20)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue:1, duration:500, easing:Easing.out(Easing.quad), useNativeDriver:true }),
      Animated.timing(slide, { toValue:0, duration:500, easing:Easing.out(Easing.quad), useNativeDriver:true }),
    ]).start()
  }, [])

  useEffect(() => {
    if (!analysing) { setStep(0); return }
    const iv = setInterval(() => setStep(p => Math.min(p+1, STEPS.length-1)), 300)
    // Scan line loop
    Animated.loop(
      Animated.timing(scanY, { toValue:1, duration:1500, easing:Easing.linear, useNativeDriver:false })
    ).start()
    return () => { clearInterval(iv) }
  }, [analysing])

  async function pickImage(fromCamera: boolean) {
    setError(null)
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 })
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri)
    }
  }

  async function runAnalysis() {
    if (!imageUri) return
    setAnalysing(true)
    setError(null)
    try {
      const result = await analyzeImageUri(imageUri)
      router.push({ pathname: '/result', params: { result: JSON.stringify(result), imageUri } } as any)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Analysis failed. Check the inference server and try again.')
    } finally {
      setAnalysing(false)
      scanY.stopAnimation()
      scanY.setValue(0)
    }
  }

  const scanTop = scanY.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] })

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Animated.View style={{ opacity:fade, transform:[{translateY:slide}] }}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ClaraVision-XAI</Text>
          <Text style={styles.title}>Retinal Image Analysis</Text>
          <Text style={styles.sub}>
            Upload or capture a fundus photograph. The AI pipeline classifies across 9 retinal pathology classes with Grad-CAM explainability.
          </Text>
        </View>

        {/* Drop zone / image preview */}
        <View style={styles.dropCard}>
          {!imageUri ? (
            <>
              <View style={styles.uploadIcon}><Brain color={C.primary} size={36}/></View>
              <Text style={styles.dropTitle}>Submit Fundus Image</Text>
              <Text style={styles.dropSub}>PNG · JPEG · TIFF · Fundus or OCT</Text>
              <View style={styles.pickRow}>
                <Pressable style={styles.pickBtn} onPress={() => pickImage(true)}>
                  <Camera color={C.primary} size={22}/>
                  <Text style={styles.pickTxt}>Open Camera</Text>
                </Pressable>
                <Pressable style={styles.pickBtn} onPress={() => pickImage(false)}>
                  <ImagePlus color={C.primary} size={22}/>
                  <Text style={styles.pickTxt}>Choose Gallery</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.previewWrap}>
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain"/>
              {analysing && (
                <>
                  <Animated.View style={[styles.scanLine, { top: scanTop }]}/>
                  <View style={styles.analysisOverlay}>
                    <ActivityIndicator color={C.primary} size="large"/>
                    <Text style={styles.stepTxt}>{STEPS[step]}</Text>
                  </View>
                </>
              )}
              {!analysing && (
                <Pressable style={styles.clearBtn} onPress={() => setImageUri(null)}>
                  <X color="white" size={14}/>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Metadata */}
        {imageUri && !analysing && (
          <View style={styles.metaCard}>
            <Text style={styles.metaTitle}>Patient Metadata <Text style={styles.optional}>(optional)</Text></Text>
            <View style={styles.metaRow}>
              <Pressable style={[styles.eyeBtn, eye==='left'  && styles.eyeBtnActive]} onPress={() => setEye(v => v==='left'  ? '' : 'left')}>
                <Text style={[styles.eyeBtnTxt, eye==='left'  && styles.eyeBtnTxtActive]}>Left Eye (OS)</Text>
              </Pressable>
              <Pressable style={[styles.eyeBtn, eye==='right' && styles.eyeBtnActive]} onPress={() => setEye(v => v==='right' ? '' : 'right')}>
                <Text style={[styles.eyeBtnTxt, eye==='right' && styles.eyeBtnTxtActive]}>Right Eye (OD)</Text>
              </Pressable>
            </View>
          </View>
        )}

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Analysis failed</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Pipeline features */}
        <View style={styles.featCard}>
          <Text style={styles.featTitle}>ClaraVision-XAI Pipeline</Text>
          {[
            { icon:ScanLine, label:'Preprocessing',   sub:'CLAHE contrast normalisation & quality gate' },
            { icon:Brain,    label:'Classification',  sub:'ResNet-50 9-class pathology prediction' },
            { icon:Zap,      label:'Explainability',  sub:'Grad-CAM saliency map generation' },
          ].map(({ icon:Icon, label, sub }) => (
            <View key={label} style={styles.featRow}>
              <View style={styles.featIcon}><Icon color={C.primary} size={16}/></View>
              <View style={styles.featText}>
                <Text style={styles.featLabel}>{label}</Text>
                <Text style={styles.featSub}>{sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Run button */}
        {imageUri && !analysing && (
          <Pressable
            style={({ pressed }) => [styles.runBtn, pressed && { opacity:0.85 }]}
            onPress={runAnalysis}
          >
            <Brain color="white" size={20}/>
            <Text style={styles.runTxt}>Analyse with ClaraVision-XAI</Text>
            <ChevronRight color="white" size={18}/>
          </Pressable>
        )}
      </Animated.View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root:           { flex:1, backgroundColor:C.bg },
  content:        { padding:16, gap:14, paddingBottom:32 },
  header:         { gap:4 },
  eyebrow:        { color:C.primary, fontSize:11, fontWeight:'700', textTransform:'uppercase', letterSpacing:1 },
  title:          { color:C.text, fontSize:22, fontWeight:'900' },
  sub:            { color:C.textMuted, fontSize:13, lineHeight:19, marginTop:2 },
  dropCard:       { backgroundColor:C.card, borderRadius:16, padding:20, alignItems:'center', borderWidth:2, borderColor:C.primaryBorder, borderStyle:'dashed', minHeight:200, justifyContent:'center', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  uploadIcon:     { width:64, height:64, borderRadius:18, backgroundColor:C.primaryBg, alignItems:'center', justifyContent:'center', marginBottom:12 },
  dropTitle:      { color:C.text, fontSize:15, fontWeight:'700', marginBottom:4 },
  dropSub:        { color:C.textMuted, fontSize:12, marginBottom:16 },
  pickRow:        { flexDirection:'row', gap:12 },
  pickBtn:        { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.primaryBg, borderRadius:12, paddingHorizontal:16, paddingVertical:10, borderWidth:1, borderColor:C.primaryBorder },
  pickTxt:        { color:C.primary, fontSize:13, fontWeight:'700' },
  previewWrap:    { width:'100%', position:'relative' },
  preview:        { width:'100%', height:220, borderRadius:12 },
  scanLine:       { position:'absolute', left:0, right:0, height:2, backgroundColor:C.primary, shadowColor:C.primary, shadowOffset:{width:0,height:0}, shadowOpacity:0.8, shadowRadius:8 },
  analysisOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.5)', borderRadius:12, alignItems:'center', justifyContent:'center', gap:12 },
  stepTxt:        { color:'white', fontSize:13, fontWeight:'600', textAlign:'center', paddingHorizontal:16 },
  clearBtn:       { position:'absolute', top:8, right:8, width:24, height:24, borderRadius:12, backgroundColor:'rgba(0,0,0,0.6)', alignItems:'center', justifyContent:'center' },
  metaCard:       { backgroundColor:C.card, borderRadius:16, padding:16, gap:10, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  metaTitle:      { color:C.text, fontSize:14, fontWeight:'700' },
  optional:       { color:C.textMuted, fontWeight:'400' },
  metaRow:        { flexDirection:'row', gap:10 },
  eyeBtn:         { flex:1, height:40, borderRadius:10, borderWidth:1.5, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  eyeBtnActive:   { borderColor:C.primary, backgroundColor:C.primaryBg },
  eyeBtnTxt:      { color:C.textMuted, fontSize:13, fontWeight:'600' },
  eyeBtnTxtActive:{ color:C.primary },
  errorCard:      { backgroundColor:C.dangerBg, borderRadius:14, padding:14, gap:4, borderWidth:1, borderColor:'#F4B6B6' },
  errorTitle:     { color:C.dangerText, fontSize:14, fontWeight:'800' },
  errorText:      { color:C.dangerText, fontSize:12, lineHeight:18 },
  featCard:       { backgroundColor:C.card, borderRadius:16, padding:16, gap:12, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 },
  featTitle:      { color:C.text, fontSize:14, fontWeight:'800' },
  featRow:        { flexDirection:'row', alignItems:'center', gap:12 },
  featIcon:       { width:36, height:36, borderRadius:10, backgroundColor:C.primaryBg, alignItems:'center', justifyContent:'center' },
  featText:       { flex:1 },
  featLabel:      { color:C.text, fontSize:13, fontWeight:'700' },
  featSub:        { color:C.textMuted, fontSize:12, marginTop:1 },
  runBtn:         { height:52, borderRadius:14, backgroundColor:C.primary, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, shadowColor:C.primary, shadowOffset:{width:0,height:4}, shadowOpacity:0.35, shadowRadius:10, elevation:6 },
  runTxt:         { color:'white', fontSize:16, fontWeight:'800' },
})
