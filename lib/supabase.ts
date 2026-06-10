import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? ''
const supabaseKey  = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
const hasSupabaseConfig = !!supabaseUrl && supabaseUrl.startsWith('https://') && !!supabaseKey

// SecureStore has no native module on web, so fall back to localStorage there
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') return Promise.resolve(globalThis.localStorage?.getItem(key) ?? null)
    return SecureStore.getItemAsync(key)
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') return Promise.resolve(globalThis.localStorage?.setItem(key, value))
    return SecureStore.setItemAsync(key, value)
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') return Promise.resolve(globalThis.localStorage?.removeItem(key))
    return SecureStore.deleteItemAsync(key)
  },
}

const missingSupabase = () => {
  throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env.')
}

const unavailableSupabase = new Proxy({}, {
  get: missingSupabase,
}) as ReturnType<typeof createClient>

export const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage:          ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,
  },
}) : unavailableSupabase

export const isSupabaseReady = () =>
  hasSupabaseConfig
