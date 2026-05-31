/**
 * EyeAnimation — animated eye using react-native-svg with pure state-driven animation.
 * No Animated.createAnimatedComponent needed; SVG attributes are updated via setState at ~30fps.
 * Mirrors the keyframe animations from eye_exam_color_0F6E56.html:
 *   irisLook, pupilPulse, highlightFloat, scanPulse, veinTrace, dropFall, eyeBreath
 */

import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import Svg, {
  Defs, RadialGradient, Stop, ClipPath,
  Ellipse, Circle, G, Path,
} from 'react-native-svg'

interface Props {
  size?: number
  dark?: boolean
}

// Ease in-out function
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

export function EyeAnimation({ size = 320, dark = false }: Props) {
  const H   = Math.round(size * 0.56)
  const sc  = size / 732   // scale factor from original 732-wide viewBox

  // ── Animation state ────────────────────────────────────────────────
  const [iris,    setIris]    = useState({ x: 0, y: 0 })
  const [pupilS,  setPupilS]  = useState(1)
  const [hl,      setHl]      = useState({ x: 0, y: 0 })
  const [ring,    setRing]    = useState({ opacity: 0, scale: 0.76 })
  const [veins,   setVeins]   = useState([75, 75, 75, 75])
  const [drops,   setDrops]   = useState([
    { opacity: 0, tx: 0, ty: 0 },
    { opacity: 0, tx: 0, ty: 0 },
  ])
  const [blinkY,  setBlinkY]  = useState(0)   // eyelid close: 1 = fully closed

  const t = useRef(0)

  useEffect(() => {
    let frame: ReturnType<typeof setTimeout>
    const TICK = 33   // ~30fps

    const tick = () => {
      t.current += TICK / 1000  // seconds
      const T = t.current

      // ── irisLook 4.2 s loop ──────────────────────────────────────
      const irisPhase = (T % 4.2) / 4.2
      let ix = 0, iy = 0
      if (irisPhase < 0.24)      { const p = irisPhase / 0.24;        ix = -5 * easeInOut(p);   iy = -3 * easeInOut(p) }
      else if (irisPhase < 0.54) { const p = (irisPhase-0.24) / 0.30; ix = -5+(5+5)*easeInOut(p); iy = -3+(3+4)*easeInOut(p) }
      else if (irisPhase < 0.77) { const p = (irisPhase-0.54) / 0.23; ix = 5+(1-5)*easeInOut(p); iy = 4+(-5-4)*easeInOut(p) }
      else                       { const p = (irisPhase-0.77) / 0.23; ix = 1+(0-1)*easeInOut(p); iy = -5*(1-easeInOut(p)) }
      setIris({ x: ix, y: iy })

      // ── pupilPulse 2.6 s ─────────────────────────────────────────
      const pp = (T % 2.6) / 2.6
      setPupilS(1 - 0.09 * Math.sin(pp * Math.PI * 2))

      // ── highlightFloat 3.8 s ─────────────────────────────────────
      const hp = (T % 3.8) / 3.8
      setHl({ x: 6 * Math.sin(hp * Math.PI), y: 4 * Math.sin(hp * Math.PI) })

      // ── scanPulse 3.4 s ──────────────────────────────────────────
      const rp = (T % 3.4) / 3.4
      const rOpacity = rp < 0.38 ? 0.44 * (rp / 0.38) : 0.44 * (1 - (rp - 0.38) / 0.62)
      const rScale   = 0.76 + 0.36 * rp
      setRing({ opacity: Math.max(0, rOpacity), scale: rScale })

      // ── veinTrace 3.1 s, staggered 0.35 s ───────────────────────
      const newVeins = [0, 0.35, 0.7, 1.0].map(delay => {
        const vp = ((T - delay) % 3.1 + 3.1) % 3.1 / 3.1
        if (vp < 0.45) return 75 * (1 - vp / 0.45)
        if (vp < 0.72) return 0
        return 75 * ((vp - 0.72) / 0.28)
      })
      setVeins(newVeins)

      // ── dropFall 2.9 s, 2 drops ──────────────────────────────────
      const newDrops = [0, 0.18].map(delay => {
        const dp = ((T - delay) % 2.9 + 2.9) % 2.9 / 2.9
        if (dp < 0.35) return { opacity: 0, tx: 0, ty: 0 }
        const p = Math.min((dp - 0.35) / 0.65, 1)
        const opacity = dp < 0.48 ? 0.95 : Math.max(0, 0.95 - (dp - 0.65) / 0.35)
        return { opacity, tx: -82 * p, ty: 88 * p }
      })
      setDrops(newDrops)

      // ── blink every ~4.5 s ───────────────────────────────────────
      const blinkCycle = T % 5.0
      if (blinkCycle < 0.08)       setBlinkY(blinkCycle / 0.08)
      else if (blinkCycle < 0.16)  setBlinkY(1 - (blinkCycle - 0.08) / 0.08)
      else if (blinkCycle < 0.36)  setBlinkY((blinkCycle - 0.20) / 0.08 > 1 ? 1 : 0)
      else                         setBlinkY(0)

      frame = setTimeout(tick, TICK)
    }

    tick()
    return () => clearTimeout(frame)
  }, [])

  const s = (v: number) => Math.round(v * sc * 100) / 100
  const cx = size / 2
  const cy = H / 2

  return (
    <View style={{ width: size, height: H }}>
      <Svg width={size} height={H}>
        <Defs>
          <RadialGradient id="egIrisGrad" cx="38%" cy="34%" r="68%">
            <Stop offset="0%"   stopColor="#68c2a8" />
            <Stop offset="24%"  stopColor="#33a486" />
            <Stop offset="70%"  stopColor="#0F6E56" />
            <Stop offset="100%" stopColor="#063d30" />
          </RadialGradient>
          <ClipPath id="egClip">
            <Ellipse cx={cx} cy={cy} rx={s(360)} ry={s(254)} />
          </ClipPath>
        </Defs>

        {/* Outer glow rings */}
        <Ellipse cx={cx} cy={cy} rx={s(370)} ry={s(264)} fill="none" stroke="rgba(15,110,86,0.15)" strokeWidth={s(6)} />
        <Ellipse cx={cx} cy={cy} rx={s(364)} ry={s(258)} fill="none" stroke="rgba(15,110,86,0.22)" strokeWidth={s(3)} />

        {/* Sclera */}
        <Ellipse cx={cx} cy={cy} rx={s(360)} ry={s(254)} fill={dark ? '#d1fae5' : '#f0fdf4'} />

        {/* Iris + pupil (iris look) */}
        <G clipPath="url(#egClip)" transform={`translate(${iris.x},${iris.y})`}>
          <Circle cx={cx} cy={cy} r={s(255)} fill="url(#egIrisGrad)" />
          {/* Iris texture rings */}
          <Circle cx={cx} cy={cy} r={s(255)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={s(1.5)} />
          <Circle cx={cx} cy={cy} r={s(200)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={s(1)} />
          {/* Iris shine */}
          <Path
            d={`M${s(309)} ${s(275)} c${s(6)}-${s(27)} ${s(28)}-${s(45)} ${s(55)}-${s(47)} c${s(12)}-${s(1)} ${s(23)} ${s(2)} ${s(33)} ${s(8)} c-${s(22)} ${s(8)}-${s(42)} ${s(24)}-${s(54)} ${s(48)} c-${s(9)} ${s(17)}-${s(10)} ${s(36)}-${s(5)} ${s(53)} c-${s(24)}-${s(8)}-${s(36)}-${s(32)}-${s(29)}-${s(62)}z`}
            fill="rgba(255,255,255,0.18)"
          />
          {/* Limbal ring */}
          <Circle cx={cx} cy={cy} r={s(255)} fill="none" stroke="rgba(0,40,20,0.45)" strokeWidth={s(3)} />
          {/* Pupil (scale) */}
          <Circle
            cx={cx} cy={cy}
            r={s(119) * pupilS}
            fill="#070f0a"
          />
          {/* Highlights */}
          <Ellipse
            cx={s(326) + hl.x} cy={s(244) + hl.y}
            rx={s(115)} ry={s(92)}
            fill="rgba(255,255,255,0.36)"
          />
          <Circle cx={s(350) + hl.x} cy={s(262) + hl.y} r={s(28)} fill="rgba(255,255,255,0.18)" />
        </G>

        {/* Pulse ring */}
        <Ellipse
          cx={cx} cy={cy}
          rx={s(465) * ring.scale} ry={s(465) * ring.scale}
          fill="none"
          stroke="#0F6E56"
          strokeWidth={s(1.7)}
          strokeDasharray={`${s(7)} ${s(8)}`}
          opacity={ring.opacity}
        />

        {/* Veins */}
        <Path d={`M${s(288)} ${s(327)} c-${s(9)} ${s(1)}-${s(16)} ${s(6)}-${s(19)} ${s(16)} m${s(18)}-${s(13)} c${s(4)} ${s(10)} ${s(1)} ${s(19)}-${s(8)} ${s(27)} m-${s(6)}-${s(13)} c-${s(8)} 0-${s(13)} ${s(4)}-${s(16)} ${s(12)}`}
          fill="none" stroke="#0F6E56" strokeWidth={s(1.5)} strokeLinecap="round"
          strokeDasharray={`${s(75)} ${s(75)}`} strokeDashoffset={veins[0]}
          opacity={veins[0] < 70 ? 0.6 : 0.18}
        />
        <Path d={`M${s(355)} ${s(198)} c${s(9)} ${s(7)} ${s(11)} ${s(15)} ${s(5)} ${s(25)} m-${s(4)}-${s(24)} c-${s(5)} ${s(4)}-${s(8)} ${s(9)}-${s(8)} ${s(16)}`}
          fill="none" stroke="#0F6E56" strokeWidth={s(1.5)} strokeLinecap="round"
          strokeDasharray={`${s(75)} ${s(75)}`} strokeDashoffset={veins[1]}
          opacity={veins[1] < 70 ? 0.6 : 0.18}
        />
        <Path d={`M${s(428)} ${s(225)} c${s(9)} ${s(7)} ${s(13)} ${s(15)} ${s(13)} ${s(27)} m-${s(15)}-${s(26)} c-${s(8)} ${s(4)}-${s(12)} ${s(10)}-${s(12)} ${s(20)}`}
          fill="none" stroke="#0F6E56" strokeWidth={s(1.5)} strokeLinecap="round"
          strokeDasharray={`${s(75)} ${s(75)}`} strokeDashoffset={veins[2]}
          opacity={veins[2] < 70 ? 0.6 : 0.18}
        />
        <Path d={`M${s(429)} ${s(255)} c${s(11)} ${s(6)} ${s(17)} ${s(14)} ${s(19)} ${s(26)} m-${s(19)}-${s(25)} c-${s(6)} ${s(6)}-${s(8)} ${s(14)}-${s(7)} ${s(24)}`}
          fill="none" stroke="#0F6E56" strokeWidth={s(1.5)} strokeLinecap="round"
          strokeDasharray={`${s(75)} ${s(75)}`} strokeDashoffset={veins[3]}
          opacity={veins[3] < 70 ? 0.6 : 0.18}
        />

        {/* Drops */}
        {drops.map((d, i) => (
          <Circle
            key={i}
            cx={s(i === 0 ? 446 : 450) + d.tx}
            cy={s(i === 0 ? 171 : 176) + d.ty}
            r={s(i === 0 ? 3.6 : 2.8)}
            fill="#0F6E56"
            opacity={d.opacity}
          />
        ))}

        {/* Blink eyelid */}
        {blinkY > 0 && (
          <Ellipse
            cx={cx} cy={cy - s(254) * (1 - blinkY)}
            rx={s(360)} ry={s(254) * blinkY}
            fill="#0F6E56"
          />
        )}

        {/* Eye outline */}
        <Ellipse cx={cx} cy={cy} rx={s(360)} ry={s(254)} fill="none" stroke="rgba(15,110,86,0.3)" strokeWidth={s(2)} />
      </Svg>
    </View>
  )
}
