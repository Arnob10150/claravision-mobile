import { StyleSheet, Text, View } from 'react-native'
import { C } from '../lib/colors'

interface Props {
  level: 'low' | 'medium' | 'high'
  score?: number
  size?: 'sm' | 'md'
}

const CFG = {
  low:    { bg: C.lowBg,  text: C.lowText,  label: 'Low' },
  medium: { bg: C.medBg,  text: C.medText,  label: 'Medium' },
  high:   { bg: C.highBg, text: C.highText, label: 'High' },
}

export function UncertaintyBadge({ level, score, size = 'sm' }: Props) {
  const cfg = CFG[level]
  const small = size === 'sm'
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, small ? styles.sm : styles.md]}>
      <Text style={[styles.text, { color: cfg.text }, small ? styles.smText : styles.mdText]}>
        {cfg.label}{score !== undefined ? ` ${(score * 100).toFixed(0)}%` : ''}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge:  { borderRadius: 99, alignSelf: 'flex-start' },
  sm:     { paddingHorizontal: 8, paddingVertical: 2 },
  md:     { paddingHorizontal: 12, paddingVertical: 4 },
  text:   { fontWeight: '700' },
  smText: { fontSize: 11 },
  mdText: { fontSize: 13 },
})
