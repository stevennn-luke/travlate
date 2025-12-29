import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

function RootNavigator() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('Auth state changed:', { user: !!user, loading });
    if (!loading) {
      if (user) {
        console.log('User authenticated, navigating to home');
        router.replace('/home');
      } else {
        console.log('No user, navigating to splash');
        router.replace('/');
      }
    }
  }, [user, loading]);

  if (loading) {
    return null; // You can add a loading screen here
  }

  return (
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="signin" options={{ headerShown: false }} />
              <Stack.Screen name="signup" options={{ headerShown: false }} />
              <Stack.Screen name="home" options={{ headerShown: false }} />
              <Stack.Screen name="text-conversion" options={{ headerShown: false }} />
              <Stack.Screen name="voice-to-text" options={{ headerShown: false }} />
              <Stack.Screen name="ocr-camera" options={{ headerShown: false }} />
              <Stack.Screen name="map-screen" options={{ headerShown: false }} />
            </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="light" />
    </AuthProvider>
  );
}
