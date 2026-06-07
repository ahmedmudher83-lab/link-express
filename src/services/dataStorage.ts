// ======== Unified Data Storage ========
// Uses localStorage as PRIMARY data source (Firebase disabled for now)
// All reads/writes go through localStorage with event broadcasting

import type { Center, Department, PricingDefaults, Admin, AdminAnnouncement, AppearanceVisibilitySettings, FeaturedEntity, PaymentMethodsSettings } from '@/types/linex';

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
  LOGS: 'linex_logs',
};

// ======== Generic Helpers ========
function getItem<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  return fallback;
}

function setItem(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function removeItem(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function broadcastUpdate(key: string): void {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: localStorage.getItem(key) }));
}

// ======== Admins ========
export function getAdmins(): Admin[] {
  return getItem<Admin[]>(KEYS.ADMINS, []);
}

export function saveAdmin(admin: Admin): void {
  const admins = getAdmins();
  const idx = admins.findIndex(a => a.id === admin.id);
  if (idx >= 0) admins[idx] = admin;
  else admins.push(admin);
  setItem(KEYS.ADMINS, admins);
  broadcastUpdate(KEYS.ADMINS);
}

export function deleteAdmin(id: string): void {
  setItem(KEYS.ADMINS, getAdmins().filter(a => a.id !== id));
  broadcastUpdate(KEYS.ADMINS);
}

// ======== Auth ========
export function getAuth(): { isAuthenticated: boolean; admin: Admin | null } {
  return getItem<{ isAuthenticated: boolean; admin: Admin | null }>(KEYS.AUTH, { isAuthenticated: false, admin: null });
}

export function setAuth(auth: { isAuthenticated: boolean; admin: Admin | null }): void {
  setItem(KEYS.AUTH, auth);
  broadcastUpdate(KEYS.AUTH);
}

export function clearAuth(): void {
  removeItem(KEYS.AUTH);
  broadcastUpdate(KEYS.AUTH);
}

// ======== Centers ========
export function getCenters(): Center[] {
  return getItem<Center[]>(KEYS.CENTERS, []);
}

export function saveCenter(center: Center): void {
  const centers = getCenters();
  const idx = centers.findIndex(c => c.id === center.id);
  if (idx >= 0) centers[idx] = center;
  else centers.push(center);
  setItem(KEYS.CENTERS, centers);
  broadcastUpdate(KEYS.CENTERS);
}

export function removeCenter(id: string): void {
  setItem(KEYS.CENTERS, getCenters().filter(c => c.id !== id));
  broadcastUpdate(KEYS.CENTERS);
}

// ======== Departments ========
export function getDepartments(): Department[] {
  return getItem<Department[]>(KEYS.DEPARTMENTS, []);
}

export function saveDepartment(dept: Department): void {
  const depts = getDepartments();
  const idx = depts.findIndex(d => d.id === dept.id);
  if (idx >= 0) depts[idx] = dept;
  else depts.push(dept);
  setItem(KEYS.DEPARTMENTS, depts);
  broadcastUpdate(KEYS.DEPARTMENTS);
}

export function removeDepartment(id: string): void {
  setItem(KEYS.DEPARTMENTS, getDepartments().filter(d => d.id !== id));
  broadcastUpdate(KEYS.DEPARTMENTS);
}

// ======== Pricing ========
export function getPricing(): PricingDefaults {
  return getItem<PricingDefaults>(KEYS.PRICING, {
    platform: { centerMonthlyPrice: 50000, deptMonthlyPrice: 25000, freeTrialDays: 7 },
    appearance: { monthlyPrice: 10000, dailyPrice: 500, freeTrialDays: 3 },
    trial: { enabled: true, trialDays: 10, showNotice: true, noticeText: '' },
  });
}

export function savePricing(pricing: PricingDefaults): void {
  setItem(KEYS.PRICING, pricing);
  broadcastUpdate(KEYS.PRICING);
}

// ======== Appearance Visibility ========
export function getVisibility(): AppearanceVisibilitySettings {
  return getItem<AppearanceVisibilitySettings>(KEYS.VISIBILITY, { enabled: false, target: 'all' });
}

export function saveVisibility(settings: AppearanceVisibilitySettings): void {
  setItem(KEYS.VISIBILITY, settings);
  broadcastUpdate(KEYS.VISIBILITY);
}

// ======== Featured ========
export function getFeatured(): FeaturedEntity[] {
  return getItem<FeaturedEntity[]>(KEYS.FEATURED, []);
}

export function saveFeatured(entity: FeaturedEntity): void {
  const entities = getFeatured();
  const idx = entities.findIndex(e => e.id === entity.id);
  if (idx >= 0) entities[idx] = entity;
  else entities.push(entity);
  setItem(KEYS.FEATURED, entities);
}

export function removeFeatured(id: string): void {
  setItem(KEYS.FEATURED, getFeatured().filter(e => e.id !== id));
}

// ======== Payment Methods ========
export function getPayments(): PaymentMethodsSettings {
  return getItem<PaymentMethodsSettings>(KEYS.PAYMENTS, {
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
  setItem(KEYS.PAYMENTS, settings);
}

// ======== Announcements ========
export function getAnnouncements(): AdminAnnouncement[] {
  return getItem<AdminAnnouncement[]>(KEYS.ANNOUNCEMENTS, []);
}

export function saveAnnouncement(ann: AdminAnnouncement): void {
  const anns = getAnnouncements();
  const idx = anns.findIndex(a => a.id === ann.id);
  if (idx >= 0) anns[idx] = ann;
  else anns.push(ann);
  setItem(KEYS.ANNOUNCEMENTS, anns);
}

export function removeAnnouncement(id: string): void {
  setItem(KEYS.ANNOUNCEMENTS, getAnnouncements().filter(a => a.id !== id));
}

// ======== Seed Defaults ========
export function seedDefaults(): void {
  // Only seed if data doesn't exist
  if (!localStorage.getItem(KEYS.ADMINS)) {
    setItem(KEYS.ADMINS, [{
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
    setItem(KEYS.PRICING, {
      platform: { centerMonthlyPrice: 50000, deptMonthlyPrice: 25000, freeTrialDays: 7 },
      appearance: { monthlyPrice: 10000, dailyPrice: 500, freeTrialDays: 3 },
      trial: { enabled: true, trialDays: 10, showNotice: true, noticeText: '' },
    });
  }
  if (!localStorage.getItem(KEYS.VISIBILITY)) {
    setItem(KEYS.VISIBILITY, { enabled: false, target: 'all' });
  }
}

// ======== Export keys for external use ========
export { KEYS as STORAGE_KEYS };
