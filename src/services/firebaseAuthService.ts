// ======== Firebase Authentication Service ========
// Wraps Firebase Auth with localStorage fallback + OTP system

import { auth, isConfigured } from '@/lib/firebase';
import type { Admin, OTPRecord, PendingRegistration } from '@/types/linex';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser
} from 'firebase/auth';
import { getAdminByUsername, getLocalAuth, setLocalAuth, clearLocalAuth, getAllAdmins, saveAdmin, getAdminById } from './firebaseService';

export interface AuthResult {
  success: boolean;
  admin?: Admin;
  error?: string;
}

// ======== OTP Storage (localStorage + Firestore hybrid) ========

const OTP_STORAGE_KEY = 'linex_otp_records';
const PENDING_REG_KEY = 'linex_pending_registrations';
const OTP_COOLDOWN_KEY = 'linex_otp_cooldown';

function lsGet<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); if (s) return JSON.parse(s); }
  catch { /* blocked */ }
  return fallback;
}

function lsSet(key: string, val: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* blocked */ }
}

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Check if email is Gmail
export function isGmail(email: string): boolean {
  return email.toLowerCase().endsWith('@gmail.com');
}

// Validate Iraq phone number
export function isValidIraqPhone(phone: string): boolean {
  const clean = phone.replace(/\s/g, '');
  return /^07[0-9]{9}$/.test(clean);
}

// Clean phone number
export function cleanPhone(phone: string): string {
  return phone.replace(/\s/g, '').trim();
}

// ======== OTP Operations ========

/**
 * Send OTP to email or phone
 * In production: integrate with email/SMS service
 * For now: simulate with localStorage + console.log
 */
export async function sendOTP(identifier: string, method: 'gmail' | 'phone'): Promise<{ success: boolean; otpCode?: string; error?: string; cooldown?: number }> {
  // Check cooldown
  const cooldowns = lsGet<Record<string, number>>(OTP_COOLDOWN_KEY, {});
  const now = Date.now();
  const lastSent = cooldowns[identifier] || 0;
  const cooldownRemaining = Math.ceil((lastSent + 60000 - now) / 1000);

  if (now < lastSent + 60000) {
    return { success: false, error: `يرجى الانتظار ${cooldownRemaining} ثانية`, cooldown: cooldownRemaining };
  }

  // Clean identifier for phone
  const clean = method === 'phone' ? cleanPhone(identifier) : identifier;

  // Check for duplicate email/phone in existing admins (localStorage only - reliable)
  const admins = lsGet<Admin[]>('linex_admins', []);
  if (method === 'gmail') {
    const existing = admins.find(a => a.email && a.email.toLowerCase() === identifier.toLowerCase());
    if (existing) return { success: false, error: 'هذا البريد مسجل مسبقاً' };
  } else {
    const existing = admins.find(a => a.phone && cleanPhone(a.phone) === clean);
    if (existing) return { success: false, error: 'هذا الرقم مسجل مسبقاً' };
  }

  // Generate OTP
  const otpCode = generateOTP();
  const expiresAt = new Date(now + 10 * 60 * 1000).toISOString();

  // Store OTP record
  const records = lsGet<OTPRecord[]>(OTP_STORAGE_KEY, []);
  // Remove old records for same identifier
  const filtered = records.filter(r => {
    if (method === 'gmail') return r.email !== identifier;
    return r.phone !== clean;
  });
  filtered.push({
    id: 'otp-' + Date.now(),
    email: method === 'gmail' ? identifier : undefined,
    phone: method === 'phone' ? cleanPhone(identifier) : undefined,
    code: otpCode,
    expiresAt,
    verified: false,
    attempts: 0,
    createdAt: new Date().toISOString(),
  });
  lsSet(OTP_STORAGE_KEY, filtered);

  // Set cooldown
  cooldowns[identifier] = now;
  lsSet(OTP_COOLDOWN_KEY, cooldowns);

  console.log(`OTP for ${identifier}: ${otpCode}`);
  return { success: true, otpCode };
}

/**
 * Verify OTP code
 */
export async function verifyOTP(identifier: string, code: string, method: 'gmail' | 'phone'): Promise<{ success: boolean; error?: string }> {
  const records = lsGet<OTPRecord[]>(OTP_STORAGE_KEY, []);
  const now = new Date().toISOString();

  const record = records.find(r => {
    if (method === 'gmail') return r.email?.toLowerCase() === identifier.toLowerCase();
    return r.phone === cleanPhone(identifier);
  });

  if (!record) {
    return { success: false, error: 'لم يتم إرسال رمز OTP لهذا الحساب' };
  }

  if (record.verified) {
    return { success: false, error: 'الرمز مستخدم مسبقاً' };
  }

  if (now > record.expiresAt) {
    return { success: false, error: 'انتهت صلاحية الرمز' };
  }

  if (record.attempts >= 5) {
    return { success: false, error: 'تم استنفاد المحاولات. اطلب رمزاً جديداً' };
  }

  // Increment attempts
  record.attempts += 1;

  if (record.code !== code) {
    lsSet(OTP_STORAGE_KEY, records);
    return { success: false, error: `الرمز غير صحيح. محاولة ${record.attempts} من 5` };
  }

  // Mark as verified
  record.verified = true;
  lsSet(OTP_STORAGE_KEY, records);

  return { success: true };
}

/**
 * Check if identifier (email/phone) is verified
 */
export function isIdentifierVerified(identifier: string, method: 'gmail' | 'phone'): boolean {
  const records = lsGet<OTPRecord[]>(OTP_STORAGE_KEY, []);
  return records.some(r => {
    if (method === 'gmail') return r.email?.toLowerCase() === identifier.toLowerCase() && r.verified;
    return r.phone === cleanPhone(identifier) && r.verified;
  });
}

/**
 * Create account after OTP verification
 */
export async function createAccountWithOTP(
  fullName: string,
  identifier: string,
  method: 'gmail' | 'phone',
  username: string,
  password: string,
  role: 'center' | 'department' = 'center'
): Promise<AuthResult> {
  // Check if OTP was verified
  if (!isIdentifierVerified(identifier, method)) {
    return { success: false, error: 'يرجى التحقق من الرمز أولاً' };
  }

  // Check duplicate username
  const existingUsername = await getAdminByUsername(username);
  if (existingUsername) {
    return { success: false, error: 'اسم المستخدم مستخدم مسبقاً. اختر اسماً آخر.' };
  }

  // Check duplicate identifier in admins
  const admins = await getAllAdmins();
  if (method === 'gmail') {
    const existing = admins.find(a => a.email.toLowerCase() === identifier.toLowerCase());
    if (existing) return { success: false, error: 'هذا البريد مسجل مسبقاً' };
  } else {
    const clean = cleanPhone(identifier);
    const existing = admins.find(a => cleanPhone(a.phone) === clean);
    if (existing) return { success: false, error: 'هذا الرقم مسجل مسبقاً' };
  }

  // Create admin
  const admin: Admin = {
    id: 'admin-' + Date.now(),
    fullName,
    username,
    password,
    role,
    phone: method === 'phone' ? cleanPhone(identifier) : '',
    email: method === 'gmail' ? identifier.toLowerCase() : '',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  await saveAdmin(admin);

  // Auto-login
  const authState = { isAuthenticated: true, admin };
  setLocalAuth(authState);

  return { success: true, admin };
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

export async function firebaseGoogleSignIn(): Promise<AuthResult> {
  if (!isConfigured || !auth) {
    return { success: false, error: 'Firebase not configured' };
  }
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    if (!user.email?.toLowerCase().endsWith('@gmail.com')) {
      await signOut(auth);
      return { success: false, error: 'يُسمح فقط بحسابات Gmail' };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Google sign-in failed';
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

// ======== Password Change (Secure) ========

export async function changePassword(
  adminId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await getAdminById(adminId);
  if (!admin) {
    return { success: false, error: 'الحساب غير موجود' };
  }

  if (admin.password !== currentPassword) {
    return { success: false, error: 'كلمة المرور الحالية غير صحيحة' };
  }

  if (newPassword.length < 6) {
    return { success: false, error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' };
  }

  const updated = { ...admin, password: newPassword };
  await saveAdmin(updated);

  // Update local auth
  const currentAuth = getLocalAuth();
  if (currentAuth.isAuthenticated && currentAuth.admin?.id === adminId) {
    setLocalAuth({ isAuthenticated: true, admin: updated });
  }

  return { success: true };
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

// ======== Check username availability ========

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const admin = await getAdminByUsername(username);
  return !admin;
}