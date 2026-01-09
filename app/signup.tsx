import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ConfirmationResult, RecaptchaVerifier, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../firebase.config';

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
  }
}

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, signInWithGoogle, signInWithPhone } = useAuth();

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Phone Auth State
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);

  // Animation Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Country Codes
  const countryCodes = [
    { code: '+1', country: 'United States', flag: 'https://flagcdn.com/w80/us.png' },
    { code: '+91', country: 'India', flag: 'https://flagcdn.com/w80/in.png' },
    { code: '+44', country: 'United Kingdom', flag: 'https://flagcdn.com/w80/gb.png' },
    { code: '+61', country: 'Australia', flag: 'https://flagcdn.com/w80/au.png' },
    { code: '+81', country: 'Japan', flag: 'https://flagcdn.com/w80/jp.png' },
    { code: '+49', country: 'Germany', flag: 'https://flagcdn.com/w80/de.png' },
    { code: '+33', country: 'France', flag: 'https://flagcdn.com/w80/fr.png' },
    { code: '+86', country: 'China', flag: 'https://flagcdn.com/w80/cn.png' },
  ];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      await signUp(email, password, name);
      // Logic for navigation is typically handled by auth state listener or:
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Sign up error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      // Logic for navigation is typically handled by auth state listener
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Google sign up error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (!name) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }

    let formattedNumber = phoneNumber.trim();
    formattedNumber = formattedNumber.replace(/\D/g, '');

    if (formattedNumber.length < 4) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    const fullPhoneNumber = `${countryCode}${formattedNumber}`;

    try {
      setLoading(true);
      if (Platform.OS === 'web') {
        if (!window.recaptchaVerifier) {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
          });
        }
        const confirmation = await signInWithPhone(fullPhoneNumber, window.recaptchaVerifier);
        setConfirmResult(confirmation);
      } else {
        // Native Phone Auth - @react-native-firebase handles recaptcha automatically
        const confirmation = await signInWithPhone(fullPhoneNumber);
        setConfirmResult(confirmation);
      }
    } catch (error: any) {
      console.error('Send code error:', error);
      Alert.alert('Error', error.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || !confirmResult) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    try {
      setLoading(true);
      const userCredential = await confirmResult.confirm(verificationCode);
      const user = userCredential.user;

      if (user && name) {
        // Update Auth Profile
        await updateProfile(user, {
          displayName: name
        });

        // Create User Document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          name: name,
          email: user.email || null,
          phoneNumber: user.phoneNumber,
          createdAt: new Date(),
          notificationsEnabled: true,
        }, { merge: true });
      }

      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Verify code error:', error);
      Alert.alert('Error', error.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={() => {
          Keyboard.dismiss();
          setShowCountryPicker(false);
        }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={28} color="#000" />
            </TouchableOpacity>

            {/* Form */}
            <Animated.View
              style={[
                styles.form,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }
              ]}
            >
              <Text style={styles.title}>Create your Account</Text>

              {/* Toggle Buttons (Optional UI choice to stick to one form or allow switching) */}
              {/* Note: User asked to be able to sign up using name and phone number. 
                  We can default to one or toggle. Let's provide links/switches like Sign In page. */}

              {authMethod === 'email' ? (
                <>
                  {/* Name Field */}
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="Full Name"
                      placeholderTextColor="#999"
                      autoCapitalize="words"
                      autoCorrect={false}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>

                  {/* Email Field */}
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      placeholderTextColor="#999"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>

                  {/* Password Field */}
                  <View style={styles.inputContainer}>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="Password"
                        placeholderTextColor="#999"
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={password}
                        onChangeText={setPassword}
                      />
                      <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowPassword(!showPassword)}
                      >
                        <Ionicons
                          name={showPassword ? "eye" : "eye-off"}
                          size={20}
                          color="#999"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Terms Checkbox (Visual Only for now) */}
                  <View style={styles.termsContainer}>
                    <View style={styles.termsCheckbox}>
                      <Ionicons name="checkbox" size={20} color="#000" />
                      <Text style={styles.termsText}>
                        I agree to the <Text style={styles.linkText}>Terms</Text> & <Text style={styles.linkText}>Privacy Policy</Text>
                      </Text>
                    </View>
                  </View>

                  {/* Sign Up Button */}
                  <TouchableOpacity
                    style={styles.signUpButtonMain}
                    onPress={handleSignUp}
                    disabled={loading}
                  >
                    <Text style={styles.signUpButtonText}>
                      {loading ? 'Creating Account...' : 'Sign Up'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {!confirmResult ? (
                    <>
                      {/* Name Field for Phone Auth too */}
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={styles.input}
                          placeholder="Full Name"
                          placeholderTextColor="#999"
                          autoCapitalize="words"
                          autoCorrect={false}
                          value={name}
                          onChangeText={setName}
                        />
                      </View>

                      {/* Phone Number Field */}
                      <Text style={styles.inputLabel}>Phone number <Text style={styles.requiredStar}>*</Text></Text>
                      <View style={styles.phoneInputWrapper}>
                        <View style={styles.unifiedPhoneContainer}>
                          <TouchableOpacity
                            style={styles.countryTrigger}
                            onPress={(e) => {
                              e.stopPropagation();
                              setShowCountryPicker(!showCountryPicker);
                            }}
                          >
                            <Image
                              source={{ uri: countryCodes.find(c => c.code === countryCode)?.flag }}
                              style={styles.circularFlag}
                            />
                            <Ionicons name="chevron-down" size={16} color="#000" />
                          </TouchableOpacity>
                          <Text style={styles.countryCodePrefix}>{countryCode}</Text>
                          <TextInput
                            style={styles.phoneInputUnified}
                            placeholder="0000000000"
                            placeholderTextColor="#999"
                            keyboardType="number-pad"
                            autoCapitalize="none"
                            autoCorrect={false}
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                          />
                        </View>
                        {/* Custom Dropdown Menu */}
                        {showCountryPicker && (
                          <View style={styles.dropdownMenu}>
                            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                              {countryCodes.map((item) => (
                                <TouchableOpacity
                                  key={item.code}
                                  style={styles.dropdownItem}
                                  onPress={() => {
                                    setCountryCode(item.code);
                                    setShowCountryPicker(false);
                                  }}
                                >
                                  <Image source={{ uri: item.flag }} style={styles.dropdownFlag} />
                                  <Text style={styles.dropdownCode}>{item.code}</Text>
                                  <Text style={styles.dropdownCountry}>{item.country}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                      </View>

                      {Platform.OS === 'web' && <View nativeID="recaptcha-container" />}

                      <TouchableOpacity
                        style={styles.signUpButtonMain}
                        onPress={handleSendCode}
                        disabled={loading}
                      >
                        <Text style={styles.signUpButtonText}>
                          {loading ? 'Sending Code...' : 'Send Verification Code'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      {/* Verification Code */}
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={styles.input}
                          placeholder="Verification Code"
                          placeholderTextColor="#999"
                          keyboardType="number-pad"
                          autoCapitalize="none"
                          autoCorrect={false}
                          value={verificationCode}
                          onChangeText={setVerificationCode}
                        />
                      </View>

                      <TouchableOpacity
                        style={styles.signUpButtonMain}
                        onPress={handleVerifyCode}
                        disabled={loading}
                      >
                        <Text style={styles.signUpButtonText}>
                          {loading ? 'Verifying...' : 'Verify & Create Account'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity onPress={() => {
                        setConfirmResult(null);
                        setVerificationCode('');
                      }}>
                        <Text style={[styles.loginLink, { textAlign: 'center', marginBottom: 20 }]}>Change Phone Number</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Social Buttons */}
              <View style={styles.socialContainer}>
                {/* Google */}
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={handleGoogleSignUp}
                  disabled={loading}
                >
                  <Image
                    source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                    style={styles.socialIcon}
                    contentFit="contain"
                  />
                  <Text style={styles.socialButtonText}>Google</Text>
                </TouchableOpacity>

                {/* Switch to Phone/Email */}
                {authMethod === 'email' && (
                  <TouchableOpacity
                    style={styles.socialButton}
                    onPress={() => setAuthMethod('phone')}
                    disabled={loading}
                  >
                    <Ionicons name="call" size={20} color="#333" style={{ marginRight: 8 }} />
                    <Text style={styles.socialButtonText}>Phone</Text>
                  </TouchableOpacity>
                )}
                {authMethod === 'phone' && (
                  <TouchableOpacity
                    style={styles.socialButton}
                    onPress={() => setAuthMethod('email')}
                    disabled={loading}
                  >
                    <Ionicons name="mail" size={20} color="#333" style={{ marginRight: 8 }} />
                    <Text style={styles.socialButtonText}>Email</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Login Link */}
              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/signin')}>
                  <Text style={styles.loginLink}>Log In</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF1F3',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  form: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'left',
    marginBottom: 40,
    fontFamily: 'Inter',
  },
  inputContainer: {
    marginBottom: 16,
    width: '100%',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderWidth: 0,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    fontFamily: 'Inter',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 15,
    color: '#333',
    fontFamily: 'Inter',
  },
  eyeIcon: {
    padding: 4,
  },
  signUpButtonMain: {
    backgroundColor: '#000',
    borderRadius: 10,
    width: '100%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    alignSelf: 'center',
  },
  signUpButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#999',
    fontFamily: 'Inter',
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 48,
    width: 160,
    height: 55,
  },
  socialIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  socialButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  loginText: {
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  // Phone Imput Styles
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
    fontFamily: 'Inter',
    width: '100%',
  },
  requiredStar: {
    color: 'red',
  },
  phoneInputWrapper: {
    zIndex: 100,
    marginBottom: 16,
    width: '100%',
  },
  unifiedPhoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 56,
    backgroundColor: '#fff',
  },
  countryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 12,
  },
  circularFlag: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  countryCodePrefix: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
    marginRight: 8,
  },
  phoneInputUnified: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    height: '100%',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    maxHeight: 200,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownFlag: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  dropdownCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 40,
  },
  dropdownCountry: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  recaptchaContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  termsContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  termsCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  termsText: {
    fontSize: 12,
    color: '#666',
  },
  linkText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
});