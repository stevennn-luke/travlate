import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SplashScreen() {
  const logoFadeAnim = useRef(new Animated.Value(0)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const textSlideAnim = useRef(new Animated.Value(30)).current;
  const buttonFadeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  useEffect(() => {
    // First: Animate logo fade in
    Animated.timing(logoFadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // Second: After 2 seconds, animate text fade in and slide up
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(textFadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(textSlideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    }, 2000);

    // Third: After 3 seconds, animate button fade in
    setTimeout(() => {
      Animated.timing(buttonFadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }, 3000);
  }, []);

  const handleGetStarted = () => {
    router.replace('/signin');
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/splash-bg.jpg')}
        style={styles.backgroundImage}
        contentFit="cover"
      />
      <Animated.View style={[styles.logoContainer, { opacity: logoFadeAnim }]}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
          contentFit="contain"
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: textFadeAnim,
            transform: [{ translateY: textSlideAnim }]
          }
        ]}
      >
        <Text style={styles.tagline}>
          Your travel partner for - Travel, Translate, Discover
        </Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.buttonContainer,
          {
            opacity: buttonFadeAnim
          }
        ]}
      >
        <TouchableOpacity style={styles.getStartedButton} onPress={handleGetStarted}>
          <Text style={styles.getStartedText}>Get Started</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  logoContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -100 }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 100,
  },
  textContainer: {
    position: 'absolute',
    top: '50%',
    width: '100%',
    transform: [{ translateY: 0 }],
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  tagline: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    fontWeight: '300',
    lineHeight: 24,
  },
  buttonContainer: {
    position: 'absolute',
    top: '50%',
    alignItems: 'center',
    width: '100%',
    transform: [{ translateY: 273.375 }],
  },
  getStartedButton: {
    backgroundColor: 'white',
    borderRadius: 48,
    paddingVertical: 18.72,
    paddingHorizontal: 39,
    borderWidth: 0,
  },
  getStartedText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});