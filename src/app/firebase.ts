import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env?.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID,
  databaseURL: import.meta.env?.VITE_FIREBASE_DATABASE_URL,
};

// Initialize Firebase safely
const app = firebaseConfig.apiKey ? initializeApp(firebaseConfig) : ({} as any);

// Export service instances
export const auth = firebaseConfig.apiKey ? getAuth(app) : ({} as any);
export const db = firebaseConfig.apiKey ? getFirestore(app) : ({} as any);
export const rtdb = firebaseConfig.apiKey ? getDatabase(app) : ({} as any);
export const storage = firebaseConfig.apiKey ? getStorage(app) : ({} as any);

export default app;
