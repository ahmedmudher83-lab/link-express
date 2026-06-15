import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Center, Department, ActivityLog, PricingDefaults, PaymentMethodsSettings, PaymentMethodConfig, AdminAnnouncement, AppearanceVisibilitySettings, FeaturedEntity } from '@/types/linex';
import { computeStatus } from '@/types/linex';
import {
  getCenters, saveCenter, removeCenter, softDeleteCenter, restoreCenter,
  getDepartments, saveDepartment, removeDepartment, softDeleteDepartment, restoreDepartment,
  getPricing, savePricing,
  getVisibility, saveVisibility,
  getFeatured, saveFeatured, removeFeatured,
  getPayments, savePayments,
  getAnnouncements, saveAnnouncement, removeAnnouncement,
  seedDefaults, syncFromFirestore, startRealtimeSync,
  STORAGE_KEYS,
} from '@/services/dataStorage';

const DEFAULT_PAYMENT_METHODS: PaymentMethodsSettings = {
  methods: [
    { id: 'zaincash', name: 'ZainCash', nameAr: 'زين كاش', enabled: true, icon: 'Smartphone', description: 'الدفع عبر محفظة زين كاش', recipientName: '', recipientNumber: '', recipientPhone: '', recipientBank: '', instructions: 'أرسل المبلغ إلى رقم المحفظة أدناه، ثم أدخل رقم العملية' },
    { id: 'asia', name: 'AsiaHawala', nameAr: 'آسيا حوالة', enabled: true, icon: 'Building2', description: 'الدفع عبر آسيا حوالة', recipientName: '', recipientNumber: '', recipientPhone: '', recipientBank: '', instructions: 'أرسل المبلغ عبر آسيا حوالة إلى الرقم أدناه' },
    { id: 'fastpay', name: 'FastPay', nameAr: 'فاست باي', enabled: true, icon: 'CreditCard', description: 'الدفع عبر فاست باي', recipientName: '', recipientNumber: '', recipientPhone: '', recipientBank: '', instructions: 'أرسل المبلغ عبر فاست باي إلى الرقم أدناه' },
    { id: 'mastercard', name: 'MasterCard', nameAr: 'ماستر كارد', enabled: true, icon: 'CreditCard', description: 'الدفع عبر بطاقة ماستر كارد', recipientName: '', recipientNumber: '', recipientPhone: '', recipientBank: '', instructions: 'أدخل بيانات البطاقة أدناه' },
    { id: 'visa', name: 'Visa', nameAr: 'فيزا كارد', enabled: true, icon: 'CreditCard', description: 'الدفع عبر بطاقة فيزا', recipientName: '', recipientNumber: '', recipientPhone: '', recipientBank: '', instructions: 'أدخل بيانات البطاقة أدناه' },
    { id: 'bank', name: 'BankTransfer', nameAr: 'تحويل بنكي', enabled: false, icon: 'Building2', description: 'تحويل مباشر إلى الحساب البنكي', recipientName: '', recipientNumber: '', recipientPhone: '', recipientBank: '', instructions: 'قم بالتحويل إلى الحساب البنكي أدناه' },
    { id: 'cash', name: 'Cash', nameAr: 'دفع نقدي', enabled: false, icon: 'Banknote', description: 'الدفع في مقر الشركة', recipientName: '', recipientNumber: '', recipientPhone: '', recipientBank: '', instructions: 'ادفع نقداً في مقر الشركة' },
  ],
};

function computeExpiry(createdAt: string, freeTrialDays: number): string {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + freeTrialDays);
  return d.toISOString();
}

interface LinexDataContext {
  loading: boolean;
  centers: Center[];
  departments: Department[];
  logs: ActivityLog[];
  pricing: PricingDefaults;
  paymentMethods: PaymentMethodsSettings;
  announcements: AdminAnnouncement[];
  // Actions
  addCenter: (c: Center) => void;
  closeCenter: (id: string) => void;
  softDeleteCenter: (id: string, adminId?: string) => Promise<void>;
  restoreCenter: (id: string) => Promise<void>;
  addDepartment: (d: Department) => void;
  closeDepartment: (id: string) => void;
  softDeleteDepartment: (id: string, adminId?: string) => Promise<void>;
  restoreDepartment: (id: string) => Promise<void>;
  updatePricing: (p: PricingDefaults) => void;
  renewCenter: (id: string, months: number) => void;
  renewDepartment: (id: string, months: number) => void;
  // Getters
  getCenterById: (id: string) => Center | undefined;
  getActiveCenters: () => Center[];
  getDepartmentsByCenter: (centerId: string) => Department[];
  getIndependentDepartments: () => Department[];
  getDepartmentById: (id: string) => Department | undefined;
  getActiveDepartments: () => Department[];
  // Deleted items
  deletedCenters: Center[];
  deletedDepartments: Department[];
  // Logs
  addLog: (log: ActivityLog) => void;
  // Payment
  updatePaymentMethods: (p: PaymentMethodsSettings) => void;
  getEnabledPaymentMethods: () => PaymentMethodConfig[];
  togglePaymentMethod: (id: string) => void;
  // Announcements
  addAnnouncement: (a: AdminAnnouncement) => void;
  removeAnnouncement: (id: string) => void;
  getActiveAnnouncements: (adminId: string) => AdminAnnouncement[];
  // Appearance
  appearanceVisibility: AppearanceVisibilitySettings;
  updateAppearanceVisibility: (s: AppearanceVisibilitySettings) => void;
  shouldShowAppearanceTab: (entityType: 'center' | 'department') => boolean;
  // Featured
  featuredEntities: FeaturedEntity[];
  addFeaturedEntity: (e: FeaturedEntity) => void;
  removeFeaturedEntity: (id: string) => void;
  getActiveFeatured: () => FeaturedEntity[];
  // Refresh
  refreshStatuses: () => void;
}

const LinexDataCtx = createContext<LinexDataContext | null>(null);

export function LinexDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [logs] = useState<ActivityLog[]>([]);
  const [pricing, setPricing] = useState<PricingDefaults>(getPricing());
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsSettings>(DEFAULT_PAYMENT_METHODS);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [appearanceVisibility, setAppearanceVisibility] = useState<AppearanceVisibilitySettings>(getVisibility());
  const [featuredEntities, setFeaturedEntities] = useState<FeaturedEntity[]>(getFeatured());
  const [deletedCenters, setDeletedCenters] = useState<Center[]>([]);
  const [deletedDepartments, setDeletedDepartments] = useState<Department[]>([]);

  // Load everything from localStorage on mount + sync from Firestore
  useEffect(() => {
    const init = async () => {
      // Step 1: Seed defaults + load from localStorage (immediate, no delay)
      seedDefaults();
      setCenters(getCenters());
      setDepartments(getDepartments());
      setDeletedCenters(getCenters(true).filter(c => c.deleted));
      setDeletedDepartments(getDepartments(true).filter(d => d.deleted));
      setPricing(getPricing());
      setPaymentMethods(getPayments());
      setAnnouncements(getAnnouncements());
      setAppearanceVisibility(getVisibility());
      setFeaturedEntities(getFeatured());
      setLoading(false);

      // Step 2: Try to pull data from Firestore (background, non-blocking)
      try {
        await syncFromFirestore();
        // Reload from localStorage (now possibly updated from Firestore)
        setCenters(getCenters());
        setDepartments(getDepartments());
        setPricing(getPricing());
        setPaymentMethods(getPayments());
        setAnnouncements(getAnnouncements());
        setAppearanceVisibility(getVisibility());
        setFeaturedEntities(getFeatured());
      } catch {
        // Firestore failed - localStorage data is already loaded, ignore
      }

      // Step 3: Start real-time sync (background, non-blocking)
      try {
        const unsub = startRealtimeSync();
        return unsub;
      } catch {
        return () => {};
      }
    };

    init();

    // Listen for cross-tab changes
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.CENTERS) setCenters(getCenters());
      if (e.key === STORAGE_KEYS.DEPARTMENTS) setDepartments(getDepartments());
      if (e.key === STORAGE_KEYS.PRICING) setPricing(getPricing());
      if (e.key === STORAGE_KEYS.VISIBILITY) setAppearanceVisibility(getVisibility());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // ======== Center Operations ========
  const addCenter = useCallback((c: Center) => {
    const exp = computeExpiry(c.createdAt, c.freeTrialDays);
    const withExp = { ...c, expiresAt: exp, status: computeStatus(true, c.createdAt, exp, c.isPaid, c.freeTrialDays) as Center['status'] };
    saveCenter(withExp);
    setCenters(getCenters());
  }, []);

  const closeCenter = useCallback((id: string) => {
    // Remove center and all related departments
    removeCenter(id);
    const depts = getDepartments().filter(d => d.centerId === id);
    depts.forEach(d => removeDepartment(d.id));
    setCenters(getCenters());
    setDepartments(getDepartments());
  }, []);

  // ======== Soft Delete Center ========
  const softDeleteCenterFn = useCallback(async (id: string, adminId?: string) => {
    await softDeleteCenter(id, adminId);
    // Also soft delete all related departments
    const relatedDepts = getDepartments(true).filter(d => d.centerId === id);
    for (const d of relatedDepts) {
      await softDeleteDepartment(d.id, adminId);
    }
    setCenters(getCenters());
    setDepartments(getDepartments());
    setDeletedCenters(getCenters(true).filter(c => c.deleted));
    setDeletedDepartments(getDepartments(true).filter(d => d.deleted));
  }, []);

  // ======== Restore Center ========
  const restoreCenterFn = useCallback(async (id: string) => {
    await restoreCenter(id);
    setCenters(getCenters());
    setDepartments(getDepartments());
    setDeletedCenters(getCenters(true).filter(c => c.deleted));
    setDeletedDepartments(getDepartments(true).filter(d => d.deleted));
  }, []);

  // ======== Department Operations ========
  const addDepartment = useCallback((d: Department) => {
    const exp = computeExpiry(d.createdAt, d.freeTrialDays);
    const withExp = { ...d, expiresAt: exp, status: computeStatus(true, d.createdAt, exp, d.isPaid, d.freeTrialDays) as Department['status'] };
    saveDepartment(withExp);
    setDepartments(getDepartments());
  }, []);

  const closeDepartment = useCallback((id: string) => {
    removeDepartment(id);
    setDepartments(getDepartments());
  }, []);

  // ======== Soft Delete Department ========
  const softDeleteDepartmentFn = useCallback(async (id: string, adminId?: string) => {
    await softDeleteDepartment(id, adminId);
    setCenters(getCenters());
    setDepartments(getDepartments());
    setDeletedCenters(getCenters(true).filter(c => c.deleted));
    setDeletedDepartments(getDepartments(true).filter(d => d.deleted));
  }, []);

  // ======== Restore Department ========
  const restoreDepartmentFn = useCallback(async (id: string) => {
    await restoreDepartment(id);
    setCenters(getCenters());
    setDepartments(getDepartments());
    setDeletedCenters(getCenters(true).filter(c => c.deleted));
    setDeletedDepartments(getDepartments(true).filter(d => d.deleted));
  }, []);

  // ======== Pricing - NOW ACTUALLY SAVES ========
  const updatePricing = useCallback((p: PricingDefaults) => {
    savePricing(p);
    setPricing({ ...p }); // Force new reference
  }, []);

  // ======== Renewal ========
  const renewCenter = useCallback((id: string, months: number) => {
    const all = getCenters();
    const target = all.find(c => c.id === id);
    if (!target) return;
    const now = new Date(), cur = new Date(target.expiresAt);
    const base = cur > now ? cur : now;
    const ne = new Date(base);
    ne.setMonth(ne.getMonth() + months);
    const updated = { ...target, isPaid: true, expiresAt: ne.toISOString(), status: computeStatus(true, target.createdAt, ne.toISOString(), true, target.freeTrialDays) as Center['status'] };
    saveCenter(updated);
    setCenters(getCenters());
  }, []);

  const renewDepartment = useCallback((id: string, months: number) => {
    const all = getDepartments();
    const target = all.find(d => d.id === id);
    if (!target) return;
    const now = new Date(), cur = new Date(target.expiresAt);
    const base = cur > now ? cur : now;
    const ne = new Date(base);
    ne.setMonth(ne.getMonth() + months);
    const updated = { ...target, isPaid: true, expiresAt: ne.toISOString(), status: computeStatus(true, target.createdAt, ne.toISOString(), true, target.freeTrialDays) as Department['status'] };
    saveDepartment(updated);
    setDepartments(getDepartments());
  }, []);

  // ======== Getters ========
  const getCenterById = useCallback((id: string) => centers.find(c => c.id === id), [centers]);
  const getActiveCenters = useCallback(() => centers.filter(c => c.isActive && c.status !== 'expired'), [centers]);
  const getDepartmentsByCenter = useCallback((centerId: string) => departments.filter(d => d.centerId === centerId && d.isActive), [departments]);
  const getIndependentDepartments = useCallback(() => departments.filter(d => d.centerId === null && d.isActive), [departments]);
  const getDepartmentById = useCallback((id: string) => departments.find(d => d.id === id), [departments]);
  const getActiveDepartments = useCallback(() => departments.filter(d => d.isActive && d.status !== 'expired'), [departments]);

  // ======== Logs ========
  const addLog = useCallback((log: ActivityLog) => { /* logs not persisted yet */ }, []);

  // ======== Payment ========
  const updatePaymentMethods = useCallback((p: PaymentMethodsSettings) => {
    savePayments(p);
    setPaymentMethods({ ...p });
  }, []);

  const getEnabledPaymentMethods = useCallback((): PaymentMethodConfig[] => {
    return paymentMethods.methods.filter(m => m.enabled);
  }, [paymentMethods]);

  const togglePaymentMethod = useCallback((id: string) => {
    setPaymentMethods(prev => {
      const updated = { ...prev, methods: prev.methods.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m) };
      savePayments(updated);
      return updated;
    });
  }, []);

  // ======== Announcements ========
  const addAnnouncement = useCallback((a: AdminAnnouncement) => {
    saveAnnouncement(a);
    setAnnouncements(getAnnouncements());
  }, []);

  const removeAnnouncement = useCallback((id: string) => {
    removeAnnouncement_(id);
    setAnnouncements(getAnnouncements());
  }, []);

  const getActiveAnnouncements = useCallback((adminId: string) => {
    return announcements.filter(a => {
      if (!a.active) return false;
      if (a.showToAll) return true;
      return a.targetAdminIds.includes(adminId);
    });
  }, [announcements]);

  // ======== Appearance ========
  const updateAppearanceVisibility = useCallback((s: AppearanceVisibilitySettings) => {
    saveVisibility(s);
    setAppearanceVisibility({ ...s });
  }, []);

  const shouldShowAppearanceTab = useCallback((entityType: 'center' | 'department'): boolean => {
    if (!appearanceVisibility.enabled) return false;
    if (appearanceVisibility.target === 'all') return true;
    if (appearanceVisibility.target === 'centers' && entityType === 'center') return true;
    if (appearanceVisibility.target === 'departments' && entityType === 'department') return true;
    return false;
  }, [appearanceVisibility]);

  // ======== Featured ========
  const addFeaturedEntity = useCallback((e: FeaturedEntity) => {
    saveFeatured(e);
    setFeaturedEntities(getFeatured());
  }, []);

  const removeFeaturedEntity = useCallback((id: string) => {
    removeFeatured(id);
    setFeaturedEntities(getFeatured());
  }, []);

  const getActiveFeatured = useCallback((): FeaturedEntity[] => {
    const now = new Date().toISOString();
    return featuredEntities.filter(f => f.startDate <= now && f.endDate >= now);
  }, [featuredEntities]);

  // ======== Refresh ========
  const refreshStatuses = useCallback(() => {
    setCenters(prev => prev.map(c => ({
      ...c,
      status: computeStatus(c.isActive, c.createdAt, c.expiresAt, c.isPaid, c.freeTrialDays)
    })));
    setDepartments(prev => prev.map(d => ({
      ...d,
      status: computeStatus(d.isActive, d.createdAt, d.expiresAt, d.isPaid, d.freeTrialDays)
    })));
  }, []);

  const value = {
    loading, centers, departments, logs, pricing, paymentMethods, announcements,
    addCenter, closeCenter, softDeleteCenter: softDeleteCenterFn, restoreCenter: restoreCenterFn,
    addDepartment, closeDepartment, softDeleteDepartment: softDeleteDepartmentFn, restoreDepartment: restoreDepartmentFn,
    updatePricing, renewCenter, renewDepartment,
    getCenterById, getActiveCenters, getDepartmentsByCenter,
    getIndependentDepartments, getDepartmentById, getActiveDepartments,
    addLog, updatePaymentMethods, getEnabledPaymentMethods, togglePaymentMethod,
    addAnnouncement, removeAnnouncement, getActiveAnnouncements,
    appearanceVisibility, updateAppearanceVisibility, shouldShowAppearanceTab,
    featuredEntities, addFeaturedEntity, removeFeaturedEntity, getActiveFeatured,
    refreshStatuses,
    deletedCenters, deletedDepartments,
  };

  return (
    <LinexDataCtx.Provider value={value}>
      {children}
    </LinexDataCtx.Provider>
  );
}

export function useLinexData() {
  const c = useContext(LinexDataCtx);
  if (!c) throw new Error('useLinexData must be used within LinexDataProvider');
  return c;
}
