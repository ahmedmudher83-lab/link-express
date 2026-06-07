import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Center, Department, ActivityLog, PricingDefaults, PaymentMethodsSettings, PaymentMethodConfig, AdminAnnouncement, AppearanceVisibilitySettings, FeaturedEntity } from '@/types/linex';
import { computeStatus } from '@/types/linex';
import {
  getCenters, saveCenter, removeCenter,
  getDepartments, saveDepartment, removeDepartment,
  getPricing, savePricing,
  getVisibility, saveVisibility,
  getFeatured, saveFeatured, removeFeatured,
  getPayments, savePayments,
  getAnnouncements, saveAnnouncement, removeAnnouncement as removeAnnouncementFromStorage,
  seedDefaults, subscribeToChanges,
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
  addCenter: (c: Center) => Promise<void>;
  closeCenter: (id: string) => Promise<void>;
  addDepartment: (d: Department) => Promise<void>;
  closeDepartment: (id: string) => Promise<void>;
  updatePricing: (p: PricingDefaults) => Promise<void>;
  renewCenter: (id: string, months: number) => Promise<void>;
  renewDepartment: (id: string, months: number) => Promise<void>;
  getCenterById: (id: string) => Center | undefined;
  getActiveCenters: () => Center[];
  getDepartmentsByCenter: (centerId: string) => Department[];
  getIndependentDepartments: () => Department[];
  getDepartmentById: (id: string) => Department | undefined;
  getActiveDepartments: () => Department[];
  addLog: (log: ActivityLog) => void;
  updatePaymentMethods: (p: PaymentMethodsSettings) => Promise<void>;
  getEnabledPaymentMethods: () => PaymentMethodConfig[];
  togglePaymentMethod: (id: string) => void;
  addAnnouncement: (a: AdminAnnouncement) => Promise<void>;
  removeAnnouncement: (id: string) => Promise<void>;
  getActiveAnnouncements: (adminId: string) => AdminAnnouncement[];
  appearanceVisibility: AppearanceVisibilitySettings;
  updateAppearanceVisibility: (s: AppearanceVisibilitySettings) => Promise<void>;
  shouldShowAppearanceTab: (entityType: 'center' | 'department') => boolean;
  featuredEntities: FeaturedEntity[];
  addFeaturedEntity: (e: FeaturedEntity) => Promise<void>;
  removeFeaturedEntity: (id: string) => Promise<void>;
  getActiveFeatured: () => FeaturedEntity[];
  refreshStatuses: () => void;
}

const LinexDataCtx = createContext<LinexDataContext | null>(null);

export function LinexDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [logs] = useState<ActivityLog[]>([]);
  const [pricing, setPricing] = useState<PricingDefaults>({
    platform: { centerMonthlyPrice: 50000, deptMonthlyPrice: 25000, freeTrialDays: 7 },
    appearance: { monthlyPrice: 10000, dailyPrice: 500, freeTrialDays: 3 },
    trial: { enabled: true, trialDays: 10, showNotice: true, noticeText: '' },
  });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsSettings>(DEFAULT_PAYMENT_METHODS);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [appearanceVisibility, setAppearanceVisibility] = useState<AppearanceVisibilitySettings>({ enabled: false, target: 'all' });
  const [featuredEntities, setFeaturedEntities] = useState<FeaturedEntity[]>([]);

  // Load everything from Firestore on mount
  useEffect(() => {
    const loadAll = async () => {
      await seedDefaults();
      const [c, d, p, pm, anns, av, fe] = await Promise.all([
        getCenters(), getDepartments(), getPricing(),
        getPayments(), getAnnouncements(), getVisibility(), getFeatured(),
      ]);
      setCenters(c);
      setDepartments(d);
      if (p) setPricing(p);
      if (pm) setPaymentMethods(pm);
      setAnnouncements(anns);
      setAppearanceVisibility(av);
      setFeaturedEntities(fe);
      setLoading(false);
    };
    loadAll();

    // Subscribe to real-time changes
    const unsubCenters = subscribeToChanges('centers', (data) => {
      setCenters(data as Center[]);
    });
    const unsubDepts = subscribeToChanges('departments', (data) => {
      setDepartments(data as Department[]);
    });
    const unsubPricing = subscribeToChanges('pricing', (data) => {
      if (data.length > 0) setPricing(data[0] as PricingDefaults);
    });
    const unsubVis = subscribeToChanges('appearanceVisibility', (data) => {
      if (data.length > 0) setAppearanceVisibility(data[0] as AppearanceVisibilitySettings);
    });

    return () => {
      unsubCenters(); unsubDepts(); unsubPricing(); unsubVis();
    };
  }, []);

  // ======== Center Operations ========
  const addCenter = useCallback(async (c: Center) => {
    const exp = computeExpiry(c.createdAt, c.freeTrialDays);
    const withExp = { ...c, expiresAt: exp, status: computeStatus(true, c.createdAt, exp, c.isPaid, c.freeTrialDays) as Center['status'] };
    await saveCenter(withExp);
    setCenters(await getCenters());
  }, []);

  const closeCenter = useCallback(async (id: string) => {
    await removeCenter(id);
    const depts = (await getDepartments()).filter(d => d.centerId === id);
    await Promise.all(depts.map(d => removeDepartment(d.id)));
    setCenters(await getCenters());
    setDepartments(await getDepartments());
  }, []);

  // ======== Department Operations ========
  const addDepartment = useCallback(async (d: Department) => {
    const exp = computeExpiry(d.createdAt, d.freeTrialDays);
    const withExp = { ...d, expiresAt: exp, status: computeStatus(true, d.createdAt, exp, d.isPaid, d.freeTrialDays) as Department['status'] };
    await saveDepartment(withExp);
    setDepartments(await getDepartments());
  }, []);

  const closeDepartment = useCallback(async (id: string) => {
    await removeDepartment(id);
    setDepartments(await getDepartments());
  }, []);

  // ======== Pricing - NOW SAVES TO FIRESTORE ========
  const updatePricing = useCallback(async (p: PricingDefaults) => {
    await savePricing(p);
    setPricing({ ...p });
  }, []);

  // ======== Renewal ========
  const renewCenter = useCallback(async (id: string, months: number) => {
    const all = await getCenters();
    const target = all.find(c => c.id === id);
    if (!target) return;
    const now = new Date(), cur = new Date(target.expiresAt);
    const base = cur > now ? cur : now;
    const ne = new Date(base);
    ne.setMonth(ne.getMonth() + months);
    const updated = { ...target, isPaid: true, expiresAt: ne.toISOString(), status: computeStatus(true, target.createdAt, ne.toISOString(), true, target.freeTrialDays) as Center['status'] };
    await saveCenter(updated);
    setCenters(await getCenters());
  }, []);

  const renewDepartment = useCallback(async (id: string, months: number) => {
    const all = await getDepartments();
    const target = all.find(d => d.id === id);
    if (!target) return;
    const now = new Date(), cur = new Date(target.expiresAt);
    const base = cur > now ? cur : now;
    const ne = new Date(base);
    ne.setMonth(ne.getMonth() + months);
    const updated = { ...target, isPaid: true, expiresAt: ne.toISOString(), status: computeStatus(true, target.createdAt, ne.toISOString(), true, target.freeTrialDays) as Department['status'] };
    await saveDepartment(updated);
    setDepartments(await getDepartments());
  }, []);

  // ======== Getters ========
  const getCenterById = useCallback((id: string) => centers.find(c => c.id === id), [centers]);
  const getActiveCenters = useCallback(() => centers.filter(c => c.isActive && c.status !== 'expired'), [centers]);
  const getDepartmentsByCenter = useCallback((centerId: string) => departments.filter(d => d.centerId === centerId && d.isActive), [departments]);
  const getIndependentDepartments = useCallback(() => departments.filter(d => d.centerId === null && d.isActive), [departments]);
  const getDepartmentById = useCallback((id: string) => departments.find(d => d.id === id), [departments]);
  const getActiveDepartments = useCallback(() => departments.filter(d => d.isActive && d.status !== 'expired'), [departments]);

  // ======== Logs ========
  const addLog = useCallback((log: ActivityLog) => {}, []);

  // ======== Payment ========
  const updatePaymentMethods = useCallback(async (p: PaymentMethodsSettings) => {
    await savePayments(p);
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
  const addAnnouncement = useCallback(async (a: AdminAnnouncement) => {
    await saveAnnouncement(a);
    setAnnouncements(await getAnnouncements());
  }, []);

  const removeAnnouncement = useCallback(async (id: string) => {
    await removeAnnouncementFromStorage(id);
    setAnnouncements(await getAnnouncements());
  }, []);

  const getActiveAnnouncements = useCallback((adminId: string) => {
    return announcements.filter(a => {
      if (!a.active) return false;
      if (a.showToAll) return true;
      return a.targetAdminIds.includes(adminId);
    });
  }, [announcements]);

  // ======== Appearance ========
  const updateAppearanceVisibility = useCallback(async (s: AppearanceVisibilitySettings) => {
    await saveVisibility(s);
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
  const addFeaturedEntity = useCallback(async (e: FeaturedEntity) => {
    await saveFeatured(e);
    setFeaturedEntities(await getFeatured());
  }, []);

  const removeFeaturedEntity = useCallback(async (id: string) => {
    await removeFeatured(id);
    setFeaturedEntities(await getFeatured());
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
    addCenter, closeCenter, addDepartment, closeDepartment,
    updatePricing, renewCenter, renewDepartment,
    getCenterById, getActiveCenters, getDepartmentsByCenter,
    getIndependentDepartments, getDepartmentById, getActiveDepartments,
    addLog, updatePaymentMethods, getEnabledPaymentMethods, togglePaymentMethod,
    addAnnouncement, removeAnnouncement, getActiveAnnouncements,
    appearanceVisibility, updateAppearanceVisibility, shouldShowAppearanceTab,
    featuredEntities, addFeaturedEntity, removeFeaturedEntity, getActiveFeatured,
    refreshStatuses,
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