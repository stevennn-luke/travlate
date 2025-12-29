import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import {
    GoogleAuthProvider,
    User,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithCredential,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase.config';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting to sign in with:', email);
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('Sign in successful:', result.user.email);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      console.log('Attempting to sign up with:', email);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      // Update the user's display name
      await updateProfile(result.user, {
        displayName: name
      });
      console.log('Sign up successful:', result.user.email);
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
      const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
      const request = new AuthSession.AuthRequest({
        clientId: '536935018297-your_web_client_id.apps.googleusercontent.com', // You'll need to get this from Firebase Console
        scopes: ['openid', 'profile', 'email'],
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        state,
        extraParams: {},
        additionalParameters: {},
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
            code: result.params.code,
            redirectUri,
            extraParams: {
              code_verifier: request.codeChallenge,
            },
          },
          {
            tokenEndpoint: 'https://oauth2.googleapis.com/token',
          }
        );
        
        // Create a Google credential with the access token
        const credential = GoogleAuthProvider.credential(tokenResponse.idToken);
        
        // Sign in with the credential
        const authResult = await signInWithCredential(auth, credential);
        
        console.log('Google sign in successful:', authResult.user.email);
      } else {
        throw new Error('Google sign-in was cancelled or failed');
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
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
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
