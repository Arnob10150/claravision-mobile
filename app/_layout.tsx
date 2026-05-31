import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { isSupabaseReady, supabase } from '../lib/supabase'

export default function RootLayout() {
  useEffect(() => {
    if (!isSupabaseReady()) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/(tabs)' as any)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace('/login' as any)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="login"    />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)"   />
      <Stack.Screen name="result"          options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="risk-calculator" options={{ animation: 'slide_from_right' }} />
    </Stack>
  )
}
