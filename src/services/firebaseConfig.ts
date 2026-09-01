import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, Auth } from 'firebase/auth';

export interface FirebaseProjectConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  databaseURL?: string;
}

const CUSTOM_CONFIG_KEY = 'love_app_firebase_custom_config';

// 1. Get configuration from environment variables or custom local storage
export function getStoredFirebaseConfig(): FirebaseProjectConfig | null {
  try {
    const raw = localStorage.getItem(CUSTOM_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse custom Firebase config:', e);
  }

  // Fallback to import.meta.env
  const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
  if (env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && !env.VITE_FIREBASE_API_KEY.includes('AIzaSyDemoKey')) {
    return {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || `${env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: env.VITE_FIREBASE_APP_ID || '',
      databaseURL: env.VITE_FIREBASE_DATABASE_URL || `https://${env.VITE_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
    };
  }

  return null;
}

export function saveCustomFirebaseConfig(config: FirebaseProjectConfig): void {
  localStorage.setItem(CUSTOM_CONFIG_KEY, JSON.stringify(config));
  // Re-initialize Firebase
  initFirebaseApp(true);
}

export function clearCustomFirebaseConfig(): void {
  localStorage.removeItem(CUSTOM_CONFIG_KEY);
}

let firebaseAppInstance: FirebaseApp | null = null;
let firestoreDbInstance: Firestore | null = null;
let realtimeDbInstance: Database | null = null;
let firebaseAuthInstance: Auth | null = null;
let isInitialized = false;

export function initFirebaseApp(forceReinit = false): {
  app: FirebaseApp | null;
  db: Firestore | null;
  rtdb: Database | null;
  auth: Auth | null;
  isConnected: boolean;
} {
  if (isInitialized && !forceReinit && firebaseAppInstance) {
    return {
      app: firebaseAppInstance,
      db: firestoreDbInstance,
      rtdb: realtimeDbInstance,
      auth: firebaseAuthInstance,
      isConnected: Boolean(firestoreDbInstance),
    };
  }

  const config = getStoredFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return {
      app: null,
      db: null,
      rtdb: null,
      auth: null,
      isConnected: false,
    };
  }

  try {
    if (getApps().length === 0) {
      firebaseAppInstance = initializeApp(config);
    } else {
      firebaseAppInstance = getApp();
    }

    firestoreDbInstance = getFirestore(firebaseAppInstance);
    
    // Attempt offline persistence cache
    try {
      if (typeof window !== 'undefined') {
        enableIndexedDbPersistence(firestoreDbInstance).catch((err) => {
          if (err.code === 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled in one tab at a time.
          } else if (err.code === 'unimplemented') {
            // Browser doesn't support indexedDB persistence
          }
        });
      }
    } catch {
      // Ignore persistence error
    }

    if (config.databaseURL) {
      try {
        realtimeDbInstance = getDatabase(firebaseAppInstance);
      } catch (e) {
        console.warn('Realtime database init fallback', e);
      }
    }

    try {
      firebaseAuthInstance = getAuth(firebaseAppInstance);
      firebaseAuthInstance.languageCode = 'ko';
    } catch (e) {
      console.warn('Firebase Auth init fallback', e);
    }

    isInitialized = true;
    return {
      app: firebaseAppInstance,
      db: firestoreDbInstance,
      rtdb: realtimeDbInstance,
      auth: firebaseAuthInstance,
      isConnected: true,
    };
  } catch (err) {
    console.error('Firebase initialization failed:', err);
    return {
      app: null,
      db: null,
      rtdb: null,
      auth: null,
      isConnected: false,
    };
  }
}

// Initial bootstrap attempt
const initialSetup = initFirebaseApp();
export const firebaseApp = initialSetup.app;
export const firestoreDb = initialSetup.db;
export const realtimeDb = initialSetup.rtdb;
export const firebaseAuth = initialSetup.auth;

export function isFirebaseConfigured(): boolean {
  const config = getStoredFirebaseConfig();
  return Boolean(config && config.apiKey && config.projectId);
}
