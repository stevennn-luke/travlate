import { Ionicons } from '@expo/vector-icons';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ConfirmationResult, RecaptchaVerifier, sendPasswordResetEmail } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { auth, firebaseConfig } from '../firebase.config';

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
  }
}

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, signInWithGoogle, signInWithPhone } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password State
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Animation Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

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

  // Phone Auth State
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);


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

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      await signIn(email, password);
      router.replace('/home');
    } catch (error: any) {
      console.error('Sign in error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      // Navigate to home screen after signin
      router.replace('/home');
    } catch (error: any) {
      console.error('Google sign in error:', error);
      Alert.alert('Error', error.message || 'Google Sign In not available yet. Please use email/password.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, resetEmail);
      Alert.alert('Success', 'Password reset email sent. Please check your inbox.', [
        { text: 'OK', onPress: () => setIsForgotPassword(false) }
      ]);
      setResetEmail('');
    } catch (error: any) {
      console.error('Forgot password error:', error);
      Alert.alert('Error', error.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }


    let formattedNumber = phoneNumber.trim();

    // Remove any non-digit characters from the phone number input
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
        // Native Phone Auth
        if (!recaptchaVerifier.current) {
          Alert.alert('Error', 'Recaptcha not initialized');
          return;
        }
        const confirmation = await signInWithPhone(fullPhoneNumber, recaptchaVerifier.current);
        setConfirmResult(confirmation);
      }
    } catch (error: any) {
      console.error('Send code error:', error);
      if (error.code === 'auth/billing-not-enabled') {
        Alert.alert('Service Unavailable', 'Phone authentication is currently unavailable due to configuration.');
      } else {

        Alert.alert(
          'Authentication',
          'If you do not have an account already, please Sign Up.',
          [
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
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
      await confirmResult.confirm(verificationCode);
      router.replace('/home');
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
              {isForgotPassword ? (
                <>
                  <Text style={styles.title}>Forgot Password</Text>

                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email"
                      placeholderTextColor="#999"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={resetEmail}
                      onChangeText={setResetEmail}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.loginButton}
                    onPress={handleForgotPassword}
                    disabled={loading}
                  >
                    <Text style={styles.loginButtonText}>
                      {loading ? 'Sending...' : 'Reset Password'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setIsForgotPassword(false)}
                    style={{ alignItems: 'center', marginTop: 16 }}
                  >
                    <Text style={styles.signUpLink}>Back to Login</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.title}>Sign in to your Account</Text>

                  {authMethod === 'email' ? (
                    <>
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

                      {/* Forgot password */}
                      <View style={styles.forgotPasswordContainer}>
                        <TouchableOpacity onPress={() => setIsForgotPassword(true)}>
                          <Text style={styles.forgotPassword}>Forgot Password ?</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Log In Button */}
                      <TouchableOpacity
                        style={styles.loginButton}
                        onPress={handleSignIn}
                        disabled={loading}
                      >
                        <Text style={styles.loginButtonText}>
                          {loading ? 'Signing In...' : 'Log In'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      {!confirmResult ? (
                        <>
                          {/* Phone Number Field with Country Code */}
                          <Text style={styles.inputLabel}>Phone number <Text style={styles.requiredStar}>*</Text></Text>
                          <View style={styles.phoneInputWrapper}>
                            <View style={styles.unifiedPhoneContainer}>
                              <TouchableOpacity
                                style={styles.countryTrigger}
                                onPress={() => setShowCountryPicker(!showCountryPicker)}
                              >
                                <Image
                                  source={{ uri: countryCodes.find(c => c.code === countryCode)?.flag }}
                                  style={styles.circularFlag}
                                />
                                <Ionicons name="chevron-down" size={16} color="#000" />
                              </TouchableOpacity>

                              <View style={styles.verticalDivider} />

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

                          {/* Recaptcha Container for Web */}
                          {Platform.OS === 'web' && <View nativeID="recaptcha-container" />}

                          {/* Send Code Button */}
                          <TouchableOpacity
                            style={styles.loginButton}
                            onPress={handleSendCode}
                            disabled={loading}
                          >
                            <Text style={styles.loginButtonText}>
                              {loading ? 'Sending Code...' : 'Send Verification Code'}
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          {/* Verification Code Field */}
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

                          {/* Verify Button */}
                          <TouchableOpacity
                            style={styles.loginButton}
                            onPress={handleVerifyCode}
                            disabled={loading}
                          >
                            <Text style={styles.loginButtonText}>
                              {loading ? 'Verifying...' : 'Verify Code'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity onPress={() => {
                            setConfirmResult(null);
                            setVerificationCode('');
                          }}>
                            <Text style={[styles.signUpLink, { textAlign: 'center', marginBottom: 20 }]}>Change Phone Number</Text>
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

                  {/* Social Buttons Container */}
                  <View style={styles.socialContainer}>
                    {/* Google Sign In Button */}
                    <TouchableOpacity
                      style={styles.socialButton}
                      onPress={handleGoogleSignIn}
                      disabled={loading}
                    >
                      <Image
                        source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                        style={styles.socialIcon}
                        contentFit="contain"
                      />
                      <Text style={styles.socialButtonText}>Google</Text>
                    </TouchableOpacity>

                    {/* Phone Sign In Button (Visible only in Email mode) */}
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
                    {/* Email Sign In Button (Visible only in Phone mode) */}
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

                  {/* Sign Up Link */}
                  <View style={styles.signUpContainer}>
                    <Text style={styles.signUpText}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => router.push('/signup')}>
                      <Text style={styles.signUpLink}>Sign Up</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <View style={styles.recaptchaContainer}>
        <FirebaseRecaptchaVerifierModal
          ref={recaptchaVerifier}
          firebaseConfig={firebaseConfig}
          attemptInvisibleVerification={true}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPassword: {
    fontSize: 14,
    color: '#007AFF',
  },
  loginButton: {
    backgroundColor: '#000',
    borderRadius: 10,
    width: '100%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    alignSelf: 'center',
  },
  loginButtonText: {
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
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  signUpText: {
    fontSize: 14,
    color: '#666',
  },
  signUpLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#000',
    fontWeight: '600',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
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
  verticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e0e0e0',
    marginRight: 12,
    display: 'none',
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
});