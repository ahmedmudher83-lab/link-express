// ======== Firebase Configuration ========

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Real Firebase config from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAL1SHqvzeFmZfjdsIJTtBadPHDir_I6yo",
  authDomain: "link-express-iq.firebaseapp.com",
  projectId: "link-express-iq",
  storageBucket: "link-express-iq.firebasestorage.app",
  messagingSenderId: "630038187361",
  appId: "1:630038187361:web:08ba05a8baf4de9df04920"
};

// Initialize Firebase
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let isConfigured = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  isConfigured = true;
  console.log('✅ Firebase initialized successfully');
} catch (err) {
  console.error('❌ Firebase initialization error:', err);
  isConfigured = false;
}

export { app, auth, db, storage, isConfigured };
