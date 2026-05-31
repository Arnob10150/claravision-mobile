import { Tabs } from 'expo-router'
import { LayoutDashboard, Microscope, Users, FileText, AlertTriangle } from 'lucide-react-native'
import { C } from '../../lib/colors'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   C.primary,
        tabBarInactiveTintColor: C.textMuted,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor:  C.border,
          borderTopWidth:  1,
          paddingTop:      4,
          height:          60,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 4 },
      }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} />
      <Tabs.Screen name="capture"  options={{ title: 'Analyse',   tabBarIcon: ({ color, size }) => <Microscope color={color} size={size} /> }} />
      <Tabs.Screen name="patients" options={{ title: 'Patients',  tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
      <Tabs.Screen name="queue"    options={{ title: 'Queue',     tabBarIcon: ({ color, size }) => <AlertTriangle color={color} size={size} /> }} />
      <Tabs.Screen name="profile"  options={{ title: 'Profile',   tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }} />
    </Tabs>
  )
}
