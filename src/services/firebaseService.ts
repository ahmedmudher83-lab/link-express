// ======== Firebase Firestore Service - Hybrid Mode ========
// Uses Firestore when Firebase is configured, falls back to localStorage

import { db, isConfigured } from '@/lib/firebase';
import type { Center, Department, Admin, ActivityLog, PricingDefaults, PaymentMethodsSettings } from '@/types/linex';
import { computeStatus } from '@/types/linex';
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc,
  query, where, orderBy
} from 'firebase/firestore';

// ======== Collection Names ========
const COLLECTIONS = {
  ADMINS: 'admins',
  CENTERS: 'centers',
  DEPARTMENTS: 'departments',
  LOGS: 'logs',
  SETTINGS: 'settings',
  ANNOUNCEMENTS: 'announcements',
  FEATURED: 'featured',
};

// ======== Safe localStorage wrappers ========
function lsGet<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); if (s) return JSON.parse(s); }
  catch { /* blocked */ }
  return fallback;
}

function lsSet(key: string, val: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* blocked */ }
}

// ======== Admin Operations ========

export async function getAllAdmins(): Promise<Admin[]> {
  if (isConfigured && db) {
    const snap = await getDocs(collection(db, COLLECTIONS.ADMINS));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Admin));
  }
  return lsGet<Admin[]>('linex_admins', []);
}

export async function getAdminById(id: string): Promise<Admin | null> {
  if (isConfigured && db) {
    const snap = await getDoc(doc(db, COLLECTIONS.ADMINS, id));
    return snap.exists() ? { ...snap.data(), id: snap.id } as Admin : null;
  }
  const admins = await getAllAdmins();
  return admins.find(a => a.id === id) || null;
}

export async function getAdminByUsername(username: string): Promise<Admin | null> {
  if (isConfigured && db) {
    const q = query(collection(db, COLLECTIONS.ADMINS), where('username', '==', username));
    const snap = await getDocs(q);
    return snap.empty ? null : { ...snap.docs[0].data(), id: snap.docs[0].id } as Admin;
  }
  const admins = await getAllAdmins();
  return admins.find(a => a.username === username) || null;
}

export async function saveAdmin(admin: Admin): Promise<void> {
  if (isConfigured && db) {
    await setDoc(doc(db, COLLECTIONS.ADMINS, admin.id), admin);
    return;
  }
  const admins = await getAllAdmins();
  const idx = admins.findIndex(a => a.id === admin.id);
  if (idx >= 0) admins[idx] = admin;
  else admins.push(admin);
  lsSet('linex_admins', admins);
}

export async function deleteAdmin(id: string): Promise<void> {
  if (isConfigured && db) {
    await deleteDoc(doc(db, COLLECTIONS.ADMINS, id));
    return;
  }
  const admins = (await getAllAdmins()).filter(a => a.id !== id);
  lsSet('linex_admins', admins);
}

// ======== Center Operations ========

export async function getAllCenters(): Promise<Center[]> {
  if (isConfigured && db) {
    const snap = await getDocs(query(collection(db, COLLECTIONS.CENTERS), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Center));
  }
  return lsGet<Center[]>('linex_centers', []);
}

export async function getCenterById(id: string): Promise<Center | null> {
  if (isConfigured && db) {
    const snap = await getDoc(doc(db, COLLECTIONS.CENTERS, id));
    return snap.exists() ? { ...snap.data(), id: snap.id } as Center : null;
  }
  const centers = await getAllCenters();
  return centers.find(c => c.id === id) || null;
}

export async function saveCenter(center: Center): Promise<void> {
  if (isConfigured && db) {
    await setDoc(doc(db, COLLECTIONS.CENTERS, center.id), center);
    return;
  }
  const centers = await getAllCenters();
  const idx = centers.findIndex(c => c.id === center.id);
  if (idx >= 0) centers[idx] = center;
  else centers.push(center);
  lsSet('linex_centers', centers);
}

export async function deleteCenter(id: string): Promise<void> {
  if (isConfigured && db) {
    await deleteDoc(doc(db, COLLECTIONS.CENTERS, id));
    return;
  }
  const centers = (await getAllCenters()).filter(c => c.id !== id);
  lsSet('linex_centers', centers);
}

// ======== Department Operations ========

export async function getAllDepartments(): Promise<Department[]> {
  if (isConfigured && db) {
    const snap = await getDocs(query(collection(db, COLLECTIONS.DEPARTMENTS), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Department));
  }
  return lsGet<Department[]>('linex_depts', []);
}

export async function getDepartmentById(id: string): Promise<Department | null> {
  if (isConfigured && db) {
    const snap = await getDoc(doc(db, COLLECTIONS.DEPARTMENTS, id));
    return snap.exists() ? { ...snap.data(), id: snap.id } as Department : null;
  }
  const depts = await getAllDepartments();
  return depts.find(d => d.id === id) || null;
}

export async function getDepartmentsByCenter(centerId: string): Promise<Department[]> {
  if (isConfigured && db) {
    const q = query(collection(db, COLLECTIONS.DEPARTMENTS), where('centerId', '==', centerId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Department));
  }
  const depts = await getAllDepartments();
  return depts.filter(d => d.centerId === centerId);
}

export async function saveDepartment(dept: Department): Promise<void> {
  if (isConfigured && db) {
    await setDoc(doc(db, COLLECTIONS.DEPARTMENTS, dept.id), dept);
    return;
  }
  const depts = await getAllDepartments();
  const idx = depts.findIndex(d => d.id === dept.id);
  if (idx >= 0) depts[idx] = dept;
  else depts.push(dept);
  lsSet('linex_depts', depts);
}

export async function deleteDepartment(id: string): Promise<void> {
  if (isConfigured && db) {
    await deleteDoc(doc(db, COLLECTIONS.DEPARTMENTS, id));
    return;
  }
  const depts = (await getAllDepartments()).filter(d => d.id !== id);
  lsSet('linex_depts', depts);
}

// ======== Log Operations ========

export async function getAllLogs(): Promise<ActivityLog[]> {
  if (isConfigured && db) {
    const snap = await getDocs(query(collection(db, COLLECTIONS.LOGS), orderBy('timestamp', 'desc')));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ActivityLog));
  }
  return lsGet<ActivityLog[]>('linex_logs', []);
}

export async function addLog(log: ActivityLog): Promise<void> {
  if (isConfigured && db) {
    await setDoc(doc(db, COLLECTIONS.LOGS, log.id), log);
    return;
  }
  const logs = await getAllLogs();
  logs.unshift(log);
  lsSet('linex_logs', logs);
}

// ======== Settings Operations ========

export async function getPricingSettings(): Promise<PricingDefaults | null> {
  if (isConfigured && db) {
    const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'pricing'));
    return snap.exists() ? snap.data() as PricingDefaults : null;
  }
  return lsGet<PricingDefaults | null>('linex_pricing', null);
}

export async function savePricingSettings(pricing: PricingDefaults): Promise<void> {
  if (isConfigured && db) {
    await setDoc(doc(db, COLLECTIONS.SETTINGS, 'pricing'), pricing);
    return;
  }
  lsSet('linex_pricing', pricing);
}

export async function getPaymentMethods(): Promise<PaymentMethodsSettings | null> {
  if (isConfigured && db) {
    const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'paymentMethods'));
    return snap.exists() ? snap.data() as PaymentMethodsSettings : null;
  }
  return lsGet<PaymentMethodsSettings | null>('linex_payment_methods', null);
}

export async function savePaymentMethods(methods: PaymentMethodsSettings): Promise<void> {
  if (isConfigured && db) {
    await setDoc(doc(db, COLLECTIONS.SETTINGS, 'paymentMethods'), methods);
    return;
  }
  lsSet('linex_payment_methods', methods);
}

// ======== Auth State (local only - Firebase Auth uses separate system) ========

export function getLocalAuth(): { isAuthenticated: boolean; admin: Admin | null } {
  return lsGet('linex_auth', { isAuthenticated: false, admin: null });
}

export function setLocalAuth(auth: { isAuthenticated: boolean; admin: Admin | null }): void {
  lsSet('linex_auth', auth);
}

export function clearLocalAuth(): void {
  lsSet('linex_auth', { isAuthenticated: false, admin: null });
}

// ======== Helper: Refresh statuses ========

export async function refreshAllStatuses(): Promise<{ centers: Center[]; departments: Department[] }> {
  const centers = await getAllCenters();
  const departments = await getAllDepartments();
  
  const updatedCenters = centers.map(c => ({
    ...c,
    status: computeStatus(c.isActive, c.createdAt, c.expiresAt, c.isPaid, c.freeTrialDays)
  }));
  
  const updatedDepts = departments.map(d => ({
    ...d,
    status: computeStatus(d.isActive, d.createdAt, d.expiresAt, d.isPaid, d.freeTrialDays)
  }));

  if (isConfigured && db) {
    // Batch update in Firestore
    for (const c of updatedCenters) await saveCenter(c);
    for (const d of updatedDepts) await saveDepartment(d);
  }

  return { centers: updatedCenters, departments: updatedDepts };
}

// ======== Announcement Operations ========

import type { AdminAnnouncement } from '@/types/linex';

export async function getAnnouncements(): Promise<AdminAnnouncement[]> {
  if (isConfigured && db) {
    const snap = await getDocs(query(collection(db, COLLECTIONS.ANNOUNCEMENTS), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as AdminAnnouncement));
  }
  return lsGet<AdminAnnouncement[]>('linex_announcements', []);
}

export async function saveAnnouncement(ann: AdminAnnouncement): Promise<void> {
  if (isConfigured && db) {
    await setDoc(doc(db, COLLECTIONS.ANNOUNCEMENTS, ann.id), ann);
    return;
  }
  const anns = await getAnnouncements();
  const idx = anns.findIndex(a => a.id === ann.id);
  if (idx >= 0) anns[idx] = ann;
  else anns.push(ann);
  lsSet('linex_announcements', anns);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  if (isConfigured && db) {
    await deleteDoc(doc(db, COLLECTIONS.ANNOUNCEMENTS, id));
    return;
  }
  const anns = (await getAnnouncements()).filter(a => a.id !== id);
  lsSet('linex_announcements', anns);
}

// ======== Appearance Visibility Settings ========

import type { AppearanceVisibilitySettings, FeaturedEntity } from '@/types/linex';

export async function getAppearanceVisibility(): Promise<AppearanceVisibilitySettings | null> {
  if (isConfigured && db) {
    const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'appearanceVisibility'));
    return snap.exists() ? snap.data() as AppearanceVisibilitySettings : null;
  }
  return lsGet<AppearanceVisibilitySettings | null>('linex_appearance_visibility', null);
}

export async function saveAppearanceVisibility(settings: AppearanceVisibilitySettings): Promise<void> {
  if (isConfigured && db) {
    await setDoc(doc(db, COLLECTIONS.SETTINGS, 'appearanceVisibility'), settings);
    return;
  }
  lsSet('linex_appearance_visibility', settings);
}

// ======== Featured Entities (Manual display by super admin) ========

export async function getFeaturedEntities(): Promise<FeaturedEntity[]> {
  if (isConfigured && db) {
    const snap = await getDocs(query(collection(db, COLLECTIONS.FEATURED), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as FeaturedEntity));
  }
  return lsGet<FeaturedEntity[]>('linex_featured', []);
}

export async function saveFeaturedEntity(entity: FeaturedEntity): Promise<void> {
  if (isConfigured && db) {
    await setDoc(doc(db, COLLECTIONS.FEATURED, entity.id), entity);
    return;
  }
  const entities = await getFeaturedEntities();
  const idx = entities.findIndex(e => e.id === entity.id);
  if (idx >= 0) entities[idx] = entity;
  else entities.push(entity);
  lsSet('linex_featured', entities);
}

export async function deleteFeaturedEntity(id: string): Promise<void> {
  if (isConfigured && db) {
    await deleteDoc(doc(db, COLLECTIONS.FEATURED, id));
    return;
  }
  const entities = (await getFeaturedEntities()).filter(e => e.id !== id);
  lsSet('linex_featured', entities);
}

// ======== Seed default super admin ========

const DEFAULT_SUPER_ADMIN: Admin = {
  id: 'super-1',
  fullName: 'المدير العام',
  username: 'admin',
  password: 'admin123',
  role: 'super',
  phone: '07700000000',
  email: 'admin@linex.com',
  isActive: true,
  createdAt: new Date().toISOString(),
};

export async function seedDefaultData(): Promise<void> {
  const admins = await getAllAdmins();
  if (admins.length === 0) {
    await saveAdmin(DEFAULT_SUPER_ADMIN);
    console.log('✅ Default super admin seeded');
  }
  
  let pricing = await getPricingSettings();
  if (!pricing) {
    pricing = {
      platform: { centerMonthlyPrice: 50000, deptMonthlyPrice: 25000, freeTrialDays: 7 },
      appearance: { monthlyPrice: 10000, dailyPrice: 500, freeTrialDays: 3 },
      trial: { enabled: true, trialDays: 10, showNotice: true, noticeText: '' },
    };
    await savePricingSettings(pricing);
  } else {
    // Migrate old pricing data
    if (!pricing.trial) {
      pricing.trial = { enabled: true, trialDays: 10, showNotice: true, noticeText: '' };
    }
    if (!pricing.appearance.dailyPrice) {
      pricing.appearance.dailyPrice = 500;
    }
    await savePricingSettings(pricing);
  }

  // Seed default appearance visibility
  const av = await getAppearanceVisibility();
  if (!av) {
    await saveAppearanceVisibility({ enabled: false, target: 'all' });
  }

  const pms = await getPaymentMethods();
  if (!pms) {
    await savePaymentMethods({
      methods: [
        { id: 'zaincash', name: 'ZainCash', nameAr: 'زين كاش', enabled: true, icon: 'Smartphone', description: 'الدفع عبر محفظة زين كاش', recipientName: '', recipientNumber: '', recipientPhone: '', recipientBank: '', instructions: 'أرسل المبلغ إلى رقم المحفظة أدناه، ثم أدخل رقم العملية' },
        { id: 'asia', name: 'AsiaHawala', nameAr: 'آسيا حوالة', enabled: true, icon: 'Building2', description: 'الدفع عبر آسيا حوالة', recipientName: '', recipientNumber: '', recipientPhone: '', recipientBank: '', instructions: 'أرسل المبلغ عبر آسيا حوالة إلى الرقم أدناه' },
        { id: 'fastpay', name: 'FastPay', nameAr: 'فاست باي', enabled: true, icon: 'CreditCard', description: 'الدفع عبر فاست باي', recipientName: '', recipientNumber: '', recipientPhone: '', recipientBank: '', instructions: 'أرسل المبلغ عبر فاست باي إلى الرقم أدناه' },
        { id: 'mastercard', name: 'MasterCard', nameAr: 'ماستر كارد', enabled: true, icon: 'CreditCard', description: 'الدفع عبر بطاقة ماستر كارد', recipientName: '', recipientNumber: '', recipientPhone: '', recipientBank: '', instructions: 'أدخل بيانات البطاقة أدناه' },
        { id: 'visa', name: 'Visa', nameAr: 'فيزا كارد', enabled: true, icon: 'CreditCard', description: 'الدفع عبر بطاقة فيزا', recipientName: '', recipientNumber: '', recipientPhone: '', recipientBank: '', instructions: 'أدخل بيانات البطاقة أدناه' },
        { id: 'bank', name: 'BankTransfer', nameAr: 'تحويل بنكي', enabled: false, icon: 'Building2', description: 'تحويل مباشر إلى الحساب البنكي', recipientName: '', recipientNumber: '', recipientPhone: '', recipientBank: '', instructions: 'قم بالتحويل إلى الحساب البنكي أدناه' },
        { id: 'cash', name: 'Cash', nameAr: 'دفع نقدي', enabled: false, icon: 'Banknote', description: 'الدفع في مقر الشركة', recipientName: '', recipientNumber: '', recipientPhone: '', recipientBank: '', instructions: 'ادفع نقداً في مقر الشركة' },
      ],
    });
  }
}
