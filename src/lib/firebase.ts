// ======== LinkEX Configuration ========
// Domain: nidaba.org
// Firebase Project: link-express-iq

export const DOMAIN = 'linkexpress.nidaba.org';
export const APP_NAME = 'LinkEX';
export const APP_SHORT = 'LinkEX';
export const COMPANY = 'Nidaba';

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAL1SHqvzeFmZfjdsIJTtBadPHDir_I6yo",
  authDomain: "link-express-iq.firebaseapp.com",
  projectId: "link-express-iq",
  storageBucket: "link-express-iq.firebasestorage.app",
  messagingSenderId: "630038187361",
  appId: "1:630038187361:web:08ba05a8baf4de9df04920"
};

const isConfigured = true;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log("✅ Firebase initialized successfully");
  } catch (err) {
    console.error("❌ Firebase initialization failed:", err);
  }
} else {
  console.log("⚠️ Firebase not configured - running in offline mode (localStorage)");
}

export { app, auth, db, storage, isConfigured };
export default app;
