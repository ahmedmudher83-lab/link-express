// ======== Unified Data Storage ========
// PRIMARY: Firebase Firestore (syncs across all devices)
// FALLBACK: localStorage (offline cache)

import { db } from '@/lib/firebase';
import {
  doc, setDoc, getDoc, deleteDoc, collection, getDocs, onSnapshot,
  type DocumentData
} from 'firebase/firestore';
import type {
  Center, Department, PricingDefaults, Admin, AdminAnnouncement,
  AppearanceVisibilitySettings, FeaturedEntity, PaymentMethodsSettings
} from '@/types/linex';

// ======== Collection Names ========
const COLLECTIONS = {
  ADMINS: 'admins',
  CENTERS: 'centers',
  DEPARTMENTS: 'departments',
  AUTH: 'auth_state',
  PRICING: 'pricing',
  VISIBILITY: 'appearanceVisibility',
  FEATURED: 'featured',
  PAYMENTS: 'paymentMethods',
  ANNOUNCEMENTS: 'announcements',
};

// ======== LocalStorage Keys (for cache/fallback) ========
export const STORAGE_KEYS = {
  ADMINS: 'linex_admins',
  CENTERS: 'linex_centers',
  DEPARTMENTS: 'linex_departments',
  AUTH: 'linex_auth',
  PRICING: 'linex_pricing',
  VISIBILITY: 'linex_appearance_visibility',
  FEATURED: 'linex_featured',
  PAYMENTS: 'linex_payment_methods',
  ANNOUNCEMENTS: 'linex_announcements',
};

const KEYS = {
  ADMINS: 'linex_admins',
  CENTERS: 'linex_centers',
  DEPARTMENTS: 'linex_departments',
  AUTH: 'linex_auth',
  PRICING: 'linex_pricing',
  VISIBILITY: 'linex_appearance_visibility',
  FEATURED: 'linex_featured',
  PAYMENTS: 'linex_payment_methods',
  ANNOUNCEMENTS: 'linex_announcements',
};

// Check if Firestore is available
const hasFirestore = () => !!db;

// ======== localStorage Helpers ========
function lsGet<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); if (s) return JSON.parse(s); } catch { /* ignore */ }
  return fallback;
}
function lsSet(key: string, val: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}
function lsRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ======== Firestore Helpers ========
async function fsGetDoc<T>(collection: string, id: string): Promise<T | null> {
  if (!hasFirestore()) return null;
  try {
    const snap = await getDoc(doc(db!, collection, id));
    return snap.exists() ? (snap.data() as T) : null;
  } catch { return null; }
}

async function fsSetDoc(collection: string, id: string, data: DocumentData): Promise<boolean> {
  if (!hasFirestore()) return false;
  try { await setDoc(doc(db!, collection, id), data); return true; } catch { return false; }
}

async function fsDeleteDoc(collection: string, id: string): Promise<boolean> {
  if (!hasFirestore()) return false;
  try { await deleteDoc(doc(db!, collection, id)); return true; } catch { return false; }
}

async function fsGetCollection<T>(collectionName: string): Promise<T[]> {
  if (!hasFirestore()) return [];
  try {
    const snap = await getDocs(collection(db!, collectionName));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as T));
  } catch { return []; }
}

// ======== ADMINS ========
export async function getAdmins(): Promise<Admin[]> {
  // Try Firestore first
  const fromFs = await fsGetCollection<Admin>(COLLECTIONS.ADMINS);
  if (fromFs.length > 0) {
    lsSet(KEYS.ADMINS, fromFs);
    return fromFs;
  }
  // Fallback to localStorage
  return lsGet<Admin[]>(KEYS.ADMINS, []);
}

export async function saveAdmin(admin: Admin): Promise<void> {
  // Write to Firestore first
  await fsSetDoc(COLLECTIONS.ADMINS, admin.id, admin);
  // Update localStorage
  const admins = await getAdmins();
  const idx = admins.findIndex(a => a.id === admin.id);
  if (idx >= 0) admins[idx] = admin;
  else admins.push(admin);
  lsSet(KEYS.ADMINS, admins);
}

export async function deleteAdmin(id: string): Promise<void> {
  await fsDeleteDoc(COLLECTIONS.ADMINS, id);
  const admins = (await getAdmins()).filter(a => a.id !== id);
  lsSet(KEYS.ADMINS, admins);
}

// ======== AUTH ========
export function getAuth(): { isAuthenticated: boolean; admin: Admin | null } {
  return lsGet<{ isAuthenticated: boolean; admin: Admin | null }>(KEYS.AUTH, { isAuthenticated: false, admin: null });
}

export function setAuth(auth: { isAuthenticated: boolean; admin: Admin | null }): void {
  lsSet(KEYS.AUTH, auth);
}

export function clearAuth(): void {
  lsRemove(KEYS.AUTH);
}

// ======== CENTERS ========
export async function getCenters(): Promise<Center[]> {
  const fromFs = await fsGetCollection<Center>(COLLECTIONS.CENTERS);
  if (fromFs.length > 0) {
    lsSet(KEYS.CENTERS, fromFs);
    return fromFs;
  }
  return lsGet<Center[]>(KEYS.CENTERS, []);
}

export async function saveCenter(center: Center): Promise<void> {
  await fsSetDoc(COLLECTIONS.CENTERS, center.id, center);
  const centers = await getCenters();
  const idx = centers.findIndex(c => c.id === center.id);
  if (idx >= 0) centers[idx] = center;
  else centers.push(center);
  lsSet(KEYS.CENTERS, centers);
}

export async function removeCenter(id: string): Promise<void> {
  await fsDeleteDoc(COLLECTIONS.CENTERS, id);
  const centers = (await getCenters()).filter(c => c.id !== id);
  lsSet(KEYS.CENTERS, centers);
}

// ======== DEPARTMENTS ========
export async function getDepartments(): Promise<Department[]> {
  const fromFs = await fsGetCollection<Department>(COLLECTIONS.DEPARTMENTS);
  if (fromFs.length > 0) {
    lsSet(KEYS.DEPARTMENTS, fromFs);
    return fromFs;
  }
  return lsGet<Department[]>(KEYS.DEPARTMENTS, []);
}

export async function saveDepartment(dept: Department): Promise<void> {
  await fsSetDoc(COLLECTIONS.DEPARTMENTS, dept.id, dept);
  const depts = await getDepartments();
  const idx = depts.findIndex(d => d.id === dept.id);
  if (idx >= 0) depts[idx] = dept;
  else depts.push(dept);
  lsSet(KEYS.DEPARTMENTS, depts);
}

export async function removeDepartment(id: string): Promise<void> {
  await fsDeleteDoc(COLLECTIONS.DEPARTMENTS, id);
  const depts = (await getDepartments()).filter(d => d.id !== id);
  lsSet(KEYS.DEPARTMENTS, depts);
}

// ======== PRICING ========
export async function getPricing(): Promise<PricingDefaults> {
  const fromFs = await fsGetDoc<PricingDefaults>(COLLECTIONS.PRICING, 'default');
  if (fromFs) {
    lsSet(KEYS.PRICING, fromFs);
    return fromFs;
  }
  return lsGet<PricingDefaults>(KEYS.PRICING, {
    platform: { centerMonthlyPrice: 50000, deptMonthlyPrice: 25000, freeTrialDays: 7 },
    appearance: { monthlyPrice: 10000, dailyPrice: 500, freeTrialDays: 3 },
    trial: { enabled: true, trialDays: 10, showNotice: true, noticeText: '' },
  });
}

export async function savePricing(pricing: PricingDefaults): Promise<void> {
  await fsSetDoc(COLLECTIONS.PRICING, 'default', pricing);
  lsSet(KEYS.PRICING, pricing);
}

// ======== APPEARANCE VISIBILITY ========
export async function getVisibility(): Promise<AppearanceVisibilitySettings> {
  const fromFs = await fsGetDoc<AppearanceVisibilitySettings>(COLLECTIONS.VISIBILITY, 'default');
  if (fromFs) {
    lsSet(KEYS.VISIBILITY, fromFs);
    return fromFs;
  }
  return lsGet<AppearanceVisibilitySettings>(KEYS.VISIBILITY, { enabled: false, target: 'all' });
}

export async function saveVisibility(settings: AppearanceVisibilitySettings): Promise<void> {
  await fsSetDoc(COLLECTIONS.VISIBILITY, 'default', settings);
  lsSet(KEYS.VISIBILITY, settings);
}

// ======== FEATURED ========
export async function getFeatured(): Promise<FeaturedEntity[]> {
  const fromFs = await fsGetCollection<FeaturedEntity>(COLLECTIONS.FEATURED);
  if (fromFs.length > 0) {
    lsSet(KEYS.FEATURED, fromFs);
    return fromFs;
  }
  return lsGet<FeaturedEntity[]>(KEYS.FEATURED, []);
}

export async function saveFeatured(entity: FeaturedEntity): Promise<void> {
  await fsSetDoc(COLLECTIONS.FEATURED, entity.id, entity);
  const entities = await getFeatured();
  const idx = entities.findIndex(e => e.id === entity.id);
  if (idx >= 0) entities[idx] = entity;
  else entities.push(entity);
  lsSet(KEYS.FEATURED, entities);
}

export async function removeFeatured(id: string): Promise<void> {
  await fsDeleteDoc(COLLECTIONS.FEATURED, id);
  const entities = (await getFeatured()).filter(e => e.id !== id);
  lsSet(KEYS.FEATURED, entities);
}

// ======== PAYMENT METHODS ========
export async function getPayments(): Promise<PaymentMethodsSettings> {
  const fromFs = await fsGetDoc<PaymentMethodsSettings>(COLLECTIONS.PAYMENTS, 'default');
  if (fromFs) {
    lsSet(KEYS.PAYMENTS, fromFs);
    return fromFs;
  }
  return lsGet<PaymentMethodsSettings>(KEYS.PAYMENTS, {
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

export async function savePayments(settings: PaymentMethodsSettings): Promise<void> {
  await fsSetDoc(COLLECTIONS.PAYMENTS, 'default', settings);
  lsSet(KEYS.PAYMENTS, settings);
}

// ======== ANNOUNCEMENTS ========
export async function getAnnouncements(): Promise<AdminAnnouncement[]> {
  const fromFs = await fsGetCollection<AdminAnnouncement>(COLLECTIONS.ANNOUNCEMENTS);
  if (fromFs.length > 0) {
    lsSet(KEYS.ANNOUNCEMENTS, fromFs);
    return fromFs;
  }
  return lsGet<AdminAnnouncement[]>(KEYS.ANNOUNCEMENTS, []);
}

export async function saveAnnouncement(ann: AdminAnnouncement): Promise<void> {
  await fsSetDoc(COLLECTIONS.ANNOUNCEMENTS, ann.id, ann);
  const anns = await getAnnouncements();
  const idx = anns.findIndex(a => a.id === ann.id);
  if (idx >= 0) anns[idx] = ann;
  else anns.push(ann);
  lsSet(KEYS.ANNOUNCEMENTS, anns);
}

export async function removeAnnouncement(id: string): Promise<void> {
  await fsDeleteDoc(COLLECTIONS.ANNOUNCEMENTS, id);
  const anns = (await getAnnouncements()).filter(a => a.id !== id);
  lsSet(KEYS.ANNOUNCEMENTS, anns);
}

// ======== Real-time Sync Listener ========
export function subscribeToChanges(
  collectionName: string,
  callback: (data: unknown[]) => void
): () => void {
  if (!hasFirestore()) return () => {};
  try {
    return onSnapshot(collection(db!, collectionName), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      callback(data);
    });
  } catch { return () => {}; }
}

// ======== Seed Defaults ========
export async function seedDefaults(): Promise<void> {
  // Seed pricing if not exists
  const pricing = await getPricing();
  if (!pricing || !pricing.trial) {
    await savePricing({
      platform: { centerMonthlyPrice: 50000, deptMonthlyPrice: 25000, freeTrialDays: 7 },
      appearance: { monthlyPrice: 10000, dailyPrice: 500, freeTrialDays: 3 },
      trial: { enabled: true, trialDays: 10, showNotice: true, noticeText: '' },
    });
  }

  // Seed visibility if not exists
  const vis = await getVisibility();
  if (!vis) {
    await saveVisibility({ enabled: false, target: 'all' });
  }

  // Seed super admin if not exists
  const admins = await getAdmins();
  if (!admins.find(a => a.email === 'admin@linex.com')) {
    await saveAdmin({
      id: 'super-admin-linex',
      fullName: 'المدير العام',
      username: 'admin@linex.com',
      password: 'admin123',
      role: 'super',
      phone: '07700000000',
      email: 'admin@linex.com',
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  }
}
