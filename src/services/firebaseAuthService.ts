// ======== Firebase Authentication Service ========
// Wraps Firebase Auth with localStorage fallback

import { auth, isConfigured } from '@/lib/firebase';
import type { Admin } from '@/types/linex';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User as FirebaseUser
} from 'firebase/auth';
import { getAdminByUsername, getLocalAuth, setLocalAuth, clearLocalAuth } from './firebaseService';

export interface AuthResult {
  success: boolean;
  admin?: Admin;
  error?: string;
}

// ======== Firebase Auth Operations ========

export async function firebaseRegister(email: string, password: string, displayName: string): Promise<AuthResult> {
  if (!isConfigured || !auth) {
    return { success: false, error: 'Firebase not configured' };
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    return { success: false, error: msg };
  }
}

export async function firebaseLogin(email: string, password: string): Promise<AuthResult> {
  if (!isConfigured || !auth) {
    return { success: false, error: 'Firebase not configured' };
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Login failed';
    return { success: false, error: msg };
  }
}

export async function firebaseLogout(): Promise<void> {
  if (!isConfigured || !auth) return;
  await signOut(auth);
}

export function onFirebaseAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  if (!isConfigured || !auth) return () => {};
  return onAuthStateChanged(auth, callback);
}

// ======== Admin Login (Username/Password) ========
// This uses our own admin system (Firestore/localStorage) NOT Firebase Auth

export async function adminLogin(username: string, password: string): Promise<AuthResult> {
  // Try to find admin by username
  const admin = await getAdminByUsername(username);
  
  if (!admin) {
    return { success: false, error: 'اسم المستخدم غير موجود' };
  }
  
  if (!admin.isActive) {
    return { success: false, error: 'الحساب غير مفعل' };
  }
  
  if (admin.password !== password) {
    return { success: false, error: 'كلمة المرور غير صحيحة' };
  }
  
  // Success - store in local auth
  const authState = { isAuthenticated: true, admin };
  setLocalAuth(authState);
  
  // If Firebase Auth is configured, also sign in there for future use
  if (isConfigured && auth && admin.email) {
    try {
      await signInWithEmailAndPassword(auth, admin.email, password);
    } catch {
      // Silent fail - local auth is what matters for admin
    }
  }
  
  return { success: true, admin };
}

export async function adminLogout(): Promise<void> {
  clearLocalAuth();
  try {
    await firebaseLogout();
  } catch { /* ignore */ }
}

export function getCurrentAdmin(): { isAuthenticated: boolean; admin: Admin | null } {
  return getLocalAuth();
}

// ======== Auth State Listener ========

export function subscribeToAuth(callback: (auth: { isAuthenticated: boolean; admin: Admin | null }) => void): () => void {
  // First, check local auth immediately
  const local = getLocalAuth();
  callback(local);
  
  // If Firebase is configured, also listen to Firebase Auth state
  let unsubFirebase = () => {};
  
  if (isConfigured && auth) {
    unsubFirebase = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Firebase signed out - but keep local admin auth if it exists
        const current = getLocalAuth();
        if (!current.isAuthenticated) {
          callback({ isAuthenticated: false, admin: null });
        }
        return;
      }
      
      // Firebase user signed in - try to match with admin record
      // This is optional enhancement for future email-based auth
    });
  }
  
  // Return cleanup function
  return () => {
    unsubFirebase();
  };
}
