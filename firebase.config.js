import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCD5yBOOEmumJJS8Cge21Tw68UNFzjnUKo",
  authDomain: "travlate-3bc0d.firebaseapp.com",
  projectId: "travlate-3bc0d",
  storageBucket: "travlate-3bc0d.firebasestorage.app",
  messagingSenderId: "536935018297",
  appId: "1:536935018297:web:1da4281bd669bb409882e8",
  measurementId: "G-CY9487W10X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication with AsyncStorage persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// Initialize Firestore
import { getFirestore } from 'firebase/firestore';
export const db = getFirestore(app);

export default app;
