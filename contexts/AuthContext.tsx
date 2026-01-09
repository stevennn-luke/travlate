import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import {
  ApplicationVerifier,
  ConfirmationResult,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPhoneNumber,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  updateProfile,
  User
} from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { auth } from '../firebase.config';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithPhone: (phoneNumber: string, appVerifier?: ApplicationVerifier) => Promise<ConfirmationResult>;
  logout: () => Promise<void>;
  linkEmail: (email: string, password: string) => Promise<void>;
  linkPhone: (phoneNumber: string, appVerifier: ApplicationVerifier) => Promise<ConfirmationResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: () => void;

    if (Platform.OS === 'web') {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setLoading(false);
      });
    } else {
      // Native Listener
      const nativeAuth = require('@react-native-firebase/auth').default;
      unsubscribe = nativeAuth().onAuthStateChanged((user: User | null) => {
        setUser(user);
        setLoading(false);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting to sign in with:', email);
      if (Platform.OS !== 'web') {
        const nativeAuth = require('@react-native-firebase/auth').default;
        await nativeAuth().signInWithEmailAndPassword(email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      console.log('Attempting to sign up with:', email);
      if (Platform.OS !== 'web') {
        const nativeAuth = require('@react-native-firebase/auth').default;
        const result = await nativeAuth().createUserWithEmailAndPassword(email, password);
        await result.user.updateProfile({ displayName: name });
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
      }
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('Attempting Google sign in');

      // Create a random string for state parameter
      const state = await Crypto.getRandomBytesAsync(16).then(bytes =>
        bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
      );

      // Configure the OAuth request
      // Configure the OAuth request
      const redirectUri = AuthSession.makeRedirectUri();
      const request = new AuthSession.AuthRequest({
        clientId: '536935018297-your_web_client_id.apps.googleusercontent.com', // You'll need to get this from Firebase Console
        scopes: ['openid', 'profile', 'email'],
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        state,
        extraParams: {},
        prompt: AuthSession.Prompt.SelectAccount,
      });

      // Start the authentication flow
      const result = await request.promptAsync({
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      });

      if (result.type === 'success') {
        // Exchange the authorization code for an access token
        const tokenResponse = await AuthSession.exchangeCodeAsync(
          {
            clientId: '536935018297-your_web_client_id.apps.googleusercontent.com',
            code: result.params.code || '',
            redirectUri,
            extraParams: {
              code_verifier: request.codeChallenge || '',
            },
          },
          {
            tokenEndpoint: 'https://oauth2.googleapis.com/token',
          }
        );

        // Create a Google credential with the access token
        const { idToken } = tokenResponse;
        const credential = GoogleAuthProvider.credential(idToken);

        // Sign in with the credential
        if (Platform.OS !== 'web') {
          const nativeAuth = require('@react-native-firebase/auth').default;
          await nativeAuth().signInWithCredential(credential);
        } else {
          await signInWithCredential(auth, credential);
        }

        console.log('Google sign in successful:'); // User email will be updated by listener
      } else {
        throw new Error('Google sign-in was cancelled or failed');
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  };

  const signInWithPhone = async (phoneNumber: string, appVerifier?: ApplicationVerifier) => {
    try {
      console.log('Attempting phone sign in with:', phoneNumber);

      if (Platform.OS !== 'web') {
        // Use Native Firebase SDK for Android/iOS
        // We must use 'require' or dynamic import to avoid breaking web (if bundler is strict)
        // prompting the native auth module. 
        // Note: Users must ensure @react-native-firebase/auth is properly configured.
        const nativeAuth = require('@react-native-firebase/auth').default;
        const confirmation = await nativeAuth().signInWithPhoneNumber(phoneNumber);
        return confirmation;
      }

      // Web Fallback (JS SDK)
      if (!appVerifier) {
        throw new Error('Phone authentication requires reCAPTCHA verification on Web');
      }
      // @ts-ignore
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      return confirmationResult;
    } catch (error) {
      console.error('Phone sign in error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (Platform.OS !== 'web') {
        const nativeAuth = require('@react-native-firebase/auth').default;
        await nativeAuth().signOut();
      } else {
        await signOut(auth);
      }
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithPhone,
    logout,
    linkEmail: async (email: string, password: string) => {
      // This is simplified, for full hybrid support you'd need the same logic
      // But for now focusing on main auth flows
      if (!auth.currentUser) throw new Error('No user logged in (Web Check)');
      const credential = EmailAuthProvider.credential(email, password);
      await linkWithCredential(auth.currentUser, credential);
    },
    linkPhone: async (phoneNumber: string, appVerifier: ApplicationVerifier) => {
      if (!auth.currentUser) throw new Error('No user logged in (Web Check)');
      return await linkWithPhoneNumber(auth.currentUser, phoneNumber, appVerifier);
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
