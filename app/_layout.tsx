import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

// Ensure native firebase is initialized
if (Platform.OS !== 'web') {
  require('@react-native-firebase/app');
}

function RootNavigator() {
  // ... existing code ...
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('Auth state changed:', { user: !!user, loading });
    if (!loading) {
      if (user) {
        console.log('User authenticated, navigating to tabs');
        router.replace('/(tabs)');
      } else {
        console.log('No user, navigating to splash');
        router.replace('/');
      }
    }
  }, [user, loading]);

  if (loading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="signin" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
