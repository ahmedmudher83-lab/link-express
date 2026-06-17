// ======== Unified Data Storage ========
// PRIMARY: localStorage (fast, sync, UI-friendly)
// SYNC: Firebase Firestore (cross-device sync in background)
//
// How it works:
// - All reads: from localStorage (immediate, no async)
// - All writes: to localStorage + Firestore (background)
// - On load: Firestore data overwrites localStorage (get other devices' changes)
// - Real-time: onSnapshot updates localStorage when other devices change data

import { db } from '@/lib/firebase';
import {
  doc, setDoc, getDoc, deleteDoc, collection, getDocs, onSnapshot,
  type DocumentData
} from 'firebase/firestore';
import type {
  Center, Department, PricingDefaults, Admin, AdminAnnouncement,
  AppearanceVisibilitySettings, FeaturedEntity, PaymentMethodsSettings
} from '@/types/linex';

// ======== LocalStorage Keys ========
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
function broadcast(key: string): void {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: localStorage.getItem(key) }));
}

// ======== Firestore Helpers (background) ========
async function fsSet(collection: string, id: string, data: DocumentData): Promise<void> {
  if (!hasFirestore()) return;
  try { await setDoc(doc(db!, collection, id), data); } catch { /* silent fail */ }
}

async function fsGetDoc<T>(collection: string, id: string): Promise<T | null> {
  if (!hasFirestore()) return null;
  try {
    const snap = await getDoc(doc(db!, collection, id));
    return snap.exists() ? (snap.data() as T) : null;
  } catch { return null; }
}

async function fsGetCollection<T>(collectionName: string): Promise<T[]> {
  if (!hasFirestore()) return [];
  try {
    const snap = await getDocs(collection(db!, collectionName));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as T));
  } catch { return []; }
}

async function fsDel(collection: string, id: string): Promise<void> {
  if (!hasFirestore()) return;
  await deleteDoc(doc(db!, collection, id));
}

// ======== SYNC: Firestore -> localStorage ========
// Call this ONCE on app load to pull data from Firestore
export async function syncFromFirestore(): Promise<void> {
  if (!hasFirestore()) return;

  // Pricing
  const pricing = await fsGetDoc<PricingDefaults>('pricing', 'default');
  if (pricing && pricing.trial) {
    lsSet(KEYS.PRICING, pricing);
  }

  // Visibility
  const vis = await fsGetDoc<AppearanceVisibilitySettings>('appearanceVisibility', 'default');
  if (vis) {
    lsSet(KEYS.VISIBILITY, vis);
  }

  // Centers - REPLACE local with Firestore (so deletions sync across devices)
  const fsCenters = await fsGetCollection<Center>('centers');
  lsSet(KEYS.CENTERS, fsCenters);

  // Departments - REPLACE local with Firestore
  const fsDepts = await fsGetCollection<Department>('departments');
  lsSet(KEYS.DEPARTMENTS, fsDepts);

  // Admins - REPLACE local with Firestore
  const fsAdmins = await fsGetCollection<Admin>('admins');
  lsSet(KEYS.ADMINS, fsAdmins);

  // Announcements
  const anns = await fsGetCollection<AdminAnnouncement>('announcements');
  if (anns.length > 0) {
    lsSet(KEYS.ANNOUNCEMENTS, anns);
  }

  // Featured
  const featured = await fsGetCollection<FeaturedEntity>('featured');
  if (featured.length > 0) {
    lsSet(KEYS.FEATURED, featured);
  }

  // Payment methods
  const payments = await fsGetDoc<PaymentMethodsSettings>('paymentMethods', 'default');
  if (payments) {
    lsSet(KEYS.PAYMENTS, payments);
  }
}

// ======== REAL-TIME LISTENERS ========
// Call this to start listening for changes from other devices
export function startRealtimeSync(): () => void {
  if (!hasFirestore()) return () => {};

  const unsubscribers: (() => void)[] = [];

  // Listen for pricing changes
  try {
    const unsub = onSnapshot(doc(db!, 'pricing', 'default'), (snap) => {
      if (snap.exists()) {
        lsSet(KEYS.PRICING, snap.data());
        broadcast(KEYS.PRICING);
      }
    });
    unsubscribers.push(unsub);
  } catch { /* ignore */ }

  // Listen for centers changes - REPLACE local with Firestore (so deletions sync)
  try {
    const unsub = onSnapshot(collection(db!, 'centers'), (snap) => {
      const fsData = snap.docs.map(d => ({ ...d.data(), id: d.id })) as Center[];
      lsSet(KEYS.CENTERS, fsData);
      broadcast(KEYS.CENTERS);
    });
    unsubscribers.push(unsub);
  } catch { /* ignore */ }

  // Listen for departments changes - REPLACE local with Firestore
  try {
    const unsub = onSnapshot(collection(db!, 'departments'), (snap) => {
      const fsData = snap.docs.map(d => ({ ...d.data(), id: d.id })) as Department[];
      lsSet(KEYS.DEPARTMENTS, fsData);
      broadcast(KEYS.DEPARTMENTS);
    });
    unsubscribers.push(unsub);
  } catch { /* ignore */ }

  // Listen for visibility changes
  try {
    const unsub = onSnapshot(doc(db!, 'appearanceVisibility', 'default'), (snap) => {
      if (snap.exists()) {
        lsSet(KEYS.VISIBILITY, snap.data());
        broadcast(KEYS.VISIBILITY);
      }
    });
    unsubscribers.push(unsub);
  } catch { /* ignore */ }

  // Listen for admins changes - MERGE
  try {
    const unsub = onSnapshot(collection(db!, 'admins'), (snap) => {
      const fsData = snap.docs.map(d => ({ ...d.data(), id: d.id })) as Admin[];
      if (fsData.length > 0) {
        const localAdmins = getAdmins();
        const fsIds = new Set(fsData.map(a => a.id));
        const merged = [...localAdmins.filter(a => !fsIds.has(a.id)), ...fsData];
        lsSet(KEYS.ADMINS, merged);
        broadcast(KEYS.ADMINS);
      }
    });
    unsubscribers.push(unsub);
  } catch { /* ignore */ }

  return () => unsubscribers.forEach(u => u());
}

// ======== ADMINS (localStorage + Firestore background) ========
export function getAdmins(): Admin[] {
  return lsGet<Admin[]>(KEYS.ADMINS, []);
}

export function saveAdmin(admin: Admin): void {
  const admins = getAdmins();
  const idx = admins.findIndex(a => a.id === admin.id);
  if (idx >= 0) admins[idx] = admin;
  else admins.push(admin);
  lsSet(KEYS.ADMINS, admins);
  broadcast(KEYS.ADMINS);
  // Sync to Firestore in background
  fsSet('admins', admin.id, admin);
}

export function deleteAdmin(id: string): void {
  lsSet(KEYS.ADMINS, getAdmins().filter(a => a.id !== id));
  broadcast(KEYS.ADMINS);
  fsDel('admins', id);
}

// ======== AUTH (localStorage only - device specific) ========
export function getAuth(): { isAuthenticated: boolean; admin: Admin | null } {
  return lsGet<{ isAuthenticated: boolean; admin: Admin | null }>(KEYS.AUTH, { isAuthenticated: false, admin: null });
}

export function setAuth(auth: { isAuthenticated: boolean; admin: Admin | null }): void {
  lsSet(KEYS.AUTH, auth);
  broadcast(KEYS.AUTH);
}

export function clearAuth(): void {
  lsRemove(KEYS.AUTH);
  broadcast(KEYS.AUTH);
}

// ======== CENTERS (localStorage + Firestore background) ========
export function getCenters(): Center[] {
  return lsGet<Center[]>(KEYS.CENTERS, []);
}

export function saveCenter(center: Center): void {
  const centers = getCenters();
  const idx = centers.findIndex(c => c.id === center.id);
  if (idx >= 0) centers[idx] = center;
  else centers.push(center);
  lsSet(KEYS.CENTERS, centers);
  broadcast(KEYS.CENTERS);
  fsSet('centers', center.id, center);
}

export async function removeCenter(id: string): Promise<void> {
  await fsDel('centers', id);
  lsSet(KEYS.CENTERS, lsGet<Center[]>(KEYS.CENTERS, []).filter(c => c.id !== id));
  broadcast(KEYS.CENTERS);
}

// ======== DEPARTMENTS (localStorage + Firestore background) ========
export function getDepartments(): Department[] {
  return lsGet<Department[]>(KEYS.DEPARTMENTS, []);
}

export function saveDepartment(dept: Department): void {
  const depts = getDepartments();
  const idx = depts.findIndex(d => d.id === dept.id);
  if (idx >= 0) depts[idx] = dept;
  else depts.push(dept);
  lsSet(KEYS.DEPARTMENTS, depts);
  broadcast(KEYS.DEPARTMENTS);
  fsSet('departments', dept.id, dept);
}

export async function removeDepartment(id: string): Promise<void> {
  await fsDel('departments', id);
  lsSet(KEYS.DEPARTMENTS, lsGet<Department[]>(KEYS.DEPARTMENTS, []).filter(d => d.id !== id));
  broadcast(KEYS.DEPARTMENTS);
}

// ======== PRICING (localStorage + Firestore background) ========
export function getPricing(): PricingDefaults {
  return lsGet<PricingDefaults>(KEYS.PRICING, {
    platform: { centerMonthlyPrice: 50000, deptMonthlyPrice: 25000, freeTrialDays: 7 },
    appearance: { monthlyPrice: 10000, dailyPrice: 500, freeTrialDays: 3 },
    trial: { enabled: true, trialDays: 10, showNotice: true, noticeText: '' },
  });
}

export function savePricing(pricing: PricingDefaults): void {
  lsSet(KEYS.PRICING, pricing);
  broadcast(KEYS.PRICING);
  fsSet('pricing', 'default', pricing);
}

// ======== APPEARANCE VISIBILITY (localStorage + Firestore background) ========
export function getVisibility(): AppearanceVisibilitySettings {
  return lsGet<AppearanceVisibilitySettings>(KEYS.VISIBILITY, { enabled: false, target: 'all' });
}

export function saveVisibility(settings: AppearanceVisibilitySettings): void {
  lsSet(KEYS.VISIBILITY, settings);
  broadcast(KEYS.VISIBILITY);
  fsSet('appearanceVisibility', 'default', settings);
}

// ======== FEATURED (localStorage + Firestore background) ========
export function getFeatured(): FeaturedEntity[] {
  return lsGet<FeaturedEntity[]>(KEYS.FEATURED, []);
}

export function saveFeatured(entity: FeaturedEntity): void {
  const entities = getFeatured();
  const idx = entities.findIndex(e => e.id === entity.id);
  if (idx >= 0) entities[idx] = entity;
  else entities.push(entity);
  lsSet(KEYS.FEATURED, entities);
  fsSet('featured', entity.id, entity);
}

export function removeFeatured(id: string): void {
  lsSet(KEYS.FEATURED, getFeatured().filter(e => e.id !== id));
  fsDel('featured', id);
}

// ======== PAYMENT METHODS (localStorage + Firestore background) ========
export function getPayments(): PaymentMethodsSettings {
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

export function savePayments(settings: PaymentMethodsSettings): void {
  lsSet(KEYS.PAYMENTS, settings);
  fsSet('paymentMethods', 'default', settings);
}

// ======== ANNOUNCEMENTS (localStorage + Firestore background) ========
export function getAnnouncements(): AdminAnnouncement[] {
  return lsGet<AdminAnnouncement[]>(KEYS.ANNOUNCEMENTS, []);
}

export function saveAnnouncement(ann: AdminAnnouncement): void {
  const anns = getAnnouncements();
  const idx = anns.findIndex(a => a.id === ann.id);
  if (idx >= 0) anns[idx] = ann;
  else anns.push(ann);
  lsSet(KEYS.ANNOUNCEMENTS, anns);
  fsSet('announcements', ann.id, ann);
}

export function removeAnnouncement(id: string): void {
  lsSet(KEYS.ANNOUNCEMENTS, getAnnouncements().filter(a => a.id !== id));
  fsDel('announcements', id);
}

// ======== Seed Defaults ========
export function seedDefaults(): void {
  if (!localStorage.getItem(KEYS.ADMINS)) {
    lsSet(KEYS.ADMINS, [{
      id: 'super-admin-linex',
      fullName: 'المدير العام',
      username: 'admin@linex.com',
      password: 'admin123',
      role: 'super',
      phone: '07700000000',
      email: 'admin@linex.com',
      isActive: true,
      createdAt: new Date().toISOString(),
    }]);
  }
  if (!localStorage.getItem(KEYS.PRICING)) {
    lsSet(KEYS.PRICING, {
      platform: { centerMonthlyPrice: 50000, deptMonthlyPrice: 25000, freeTrialDays: 7 },
      appearance: { monthlyPrice: 10000, dailyPrice: 500, freeTrialDays: 3 },
      trial: { enabled: true, trialDays: 10, showNotice: true, noticeText: '' },
    });
  }
  if (!localStorage.getItem(KEYS.VISIBILITY)) {
    lsSet(KEYS.VISIBILITY, { enabled: false, target: 'all' });
  }
}

// ======== Export keys ========
export { KEYS as STORAGE_KEYS };