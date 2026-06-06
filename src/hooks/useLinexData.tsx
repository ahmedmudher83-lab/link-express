import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Center, Department, ActivityLog, PricingDefaults, PaymentMethodsSettings, PaymentMethodConfig, AdminAnnouncement } from '@/types/linex';
import { computeStatus } from '@/types/linex';
import {
  getAllCenters,
  saveCenter,
  deleteCenter,
  getAllDepartments,
  saveDepartment,
  deleteDepartment,
  getAllLogs,
  addLog as addLogService,
  getPricingSettings,
  savePricingSettings,
  getPaymentMethods,
  savePaymentMethods,
  getAnnouncements,
  saveAnnouncement,
  deleteAnnouncement,
  seedDefaultData,
} from '@/services/firebaseService';

const DEFAULT_PRICING: PricingDefaults = {
  platform: {
    centerMonthlyPrice: 50000,
    deptMonthlyPrice: 25000,
    freeTrialDays: 7,
  },
  appearance: {
    monthlyPrice: 10000,
    freeTrialDays: 3,
  },
  trial: {
    enabled: true,
    trialDays: 10,
    showNotice: true,
    noticeText: '',
  },
};

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
  // Loading state
  loading: boolean;
  // Data
  centers: Center[];
  departments: Department[];
  logs: ActivityLog[];
  pricing: PricingDefaults;
  paymentMethods: PaymentMethodsSettings;
  // Announcements
  announcements: AdminAnnouncement[];
  // Actions - Centers (fire-and-forget, async in background)
  addCenter: (c: Center) => void;
  closeCenter: (id: string) => void;
  // Actions - Departments
  addDepartment: (d: Department) => void;
  closeDepartment: (id: string) => void;
  // Actions - Pricing
  updatePricing: (p: PricingDefaults) => void;
  // Actions - Renewal
  renewCenter: (id: string, months: number) => void;
  renewDepartment: (id: string, months: number) => void;
  // Getters - all synchronous (read from local state)
  getCenterById: (id: string) => Center | undefined;
  getActiveCenters: () => Center[];
  getDepartmentsByCenter: (centerId: string) => Department[];
  getIndependentDepartments: () => Department[];
  getDepartmentById: (id: string) => Department | undefined;
  getActiveDepartments: () => Department[];
  // Logs
  addLog: (log: ActivityLog) => void;
  // Payment methods
  updatePaymentMethods: (p: PaymentMethodsSettings) => void;
  getEnabledPaymentMethods: () => PaymentMethodConfig[];
  togglePaymentMethod: (id: string) => void;
  // Announcements
  addAnnouncement: (a: AdminAnnouncement) => void;
  removeAnnouncement: (id: string) => void;
  getActiveAnnouncements: (adminId: string) => AdminAnnouncement[];
  // Refresh
  refreshStatuses: () => void;
  refreshData: () => Promise<void>;
}

const LinexDataCtx = createContext<LinexDataContext | null>(null);

export function LinexDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [pricing, setPricing] = useState<PricingDefaults>(DEFAULT_PRICING);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsSettings>(DEFAULT_PAYMENT_METHODS);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);

  // Initial load from Firestore (primary) with localStorage fallback
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        // Try Firestore FIRST (real database)
        await seedDefaultData();
        const [c, d, l, p, pm, anns] = await Promise.all([
          getAllCenters(),
          getAllDepartments(),
          getAllLogs(),
          getPricingSettings(),
          getPaymentMethods(),
          getAnnouncements(),
        ]);

        if (!mounted) return;

        // If Firestore has data, use it
        if (c.length > 0 || d.length > 0) {
          setCenters(c);
          setDepartments(d);
          setLogs(l);
          if (p) setPricing(p);
          if (pm) setPaymentMethods(pm);
          setAnnouncements(anns);
          setLoading(false);
          return;
        }

        // Fallback: check if localStorage has legacy data to migrate
        let localCenters: Center[] = [];
        let localDepts: Department[] = [];
        try {
          const storedCenters = localStorage.getItem('linex_centers');
          const storedDepts = localStorage.getItem('linex_departments');
          if (storedCenters) localCenters = JSON.parse(storedCenters);
          if (storedDepts) localDepts = JSON.parse(storedDepts);
        } catch { /* ignore */ }

        if (localCenters.length > 0 || localDepts.length > 0) {
          // Migrate localStorage data to Firestore
          for (const center of localCenters) await saveCenter(center);
          for (const dept of localDepts) await saveDepartment(dept);
          
          if (!mounted) return;
          setCenters(localCenters);
          setDepartments(localDepts);
        }
      } catch (err) {
        console.error('Error loading from Firestore:', err);
        // Last resort: localStorage only
        try {
          const sc = localStorage.getItem('linex_centers');
          const sd = localStorage.getItem('linex_departments');
          if (sc) setCenters(JSON.parse(sc));
          if (sd) setDepartments(JSON.parse(sd));
        } catch { /* ignore */ }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  // Refresh all data from Firebase/localStorage
  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, d, l, p, pm] = await Promise.all([
        getAllCenters(),
        getAllDepartments(),
        getAllLogs(),
        getPricingSettings(),
        getPaymentMethods(),
      ]);
      setCenters(c);
      setDepartments(d);
      setLogs(l);
      if (p) setPricing(p);
      if (pm) setPaymentMethods(pm);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh statuses for all entities
  const refreshStatuses = useCallback(() => {
    setCenters(prev =>
      prev.map(c => ({
        ...c,
        status: computeStatus(c.isActive, c.createdAt, c.expiresAt, c.isPaid, c.freeTrialDays)
      }))
    );
    setDepartments(prev =>
      prev.map(d => ({
        ...d,
        status: computeStatus(d.isActive, d.createdAt, d.expiresAt, d.isPaid, d.freeTrialDays)
      }))
    );
    // Also persist to storage
    getAllCenters().then(all => all.forEach(c => saveCenter({ ...c, status: computeStatus(c.isActive, c.createdAt, c.expiresAt, c.isPaid, c.freeTrialDays) }))).catch(() => {});
    getAllDepartments().then(all => all.forEach(d => saveDepartment({ ...d, status: computeStatus(d.isActive, d.createdAt, d.expiresAt, d.isPaid, d.freeTrialDays) }))).catch(() => {});
  }, []);

  // ======== Center Operations ========

  const addCenter = useCallback((c: Center) => {
    const exp = computeExpiry(c.createdAt, c.freeTrialDays);
    const withExp = {
      ...c,
      expiresAt: exp,
      status: computeStatus(true, c.createdAt, exp, c.isPaid, c.freeTrialDays) as Center['status']
    };
    // Save to Firestore FIRST (real database)
    saveCenter(withExp)
      .then(() => {
        // Also save to localStorage as cache
        const existing = JSON.parse(localStorage.getItem('linex_centers') || '[]');
        localStorage.setItem('linex_centers', JSON.stringify([...existing, withExp]));
      })
      .catch(() => {
        // Fallback: save to localStorage only
        const existing = JSON.parse(localStorage.getItem('linex_centers') || '[]');
        localStorage.setItem('linex_centers', JSON.stringify([...existing, withExp]));
      });
    setCenters(prev => [...prev, withExp]);
  }, []);

  const closeCenter = useCallback((id: string) => {
    deleteCenter(id).catch(() => {});
    setCenters(prev => prev.filter(c => c.id !== id));
    // Also close related departments in background
    const relatedDepts = departments.filter(d => d.centerId === id);
    for (const d of relatedDepts) {
      deleteDepartment(d.id).catch(() => {});
    }
    setDepartments(prev => prev.filter(d => d.centerId !== id));
  }, [departments]);

  // ======== Department Operations ========

  const addDepartment = useCallback((d: Department) => {
    const exp = computeExpiry(d.createdAt, d.freeTrialDays);
    const withExp = {
      ...d,
      expiresAt: exp,
      status: computeStatus(true, d.createdAt, exp, d.isPaid, d.freeTrialDays) as Department['status']
    };
    // Save to Firestore FIRST (real database)
    saveDepartment(withExp)
      .then(() => {
        // Also save to localStorage as cache
        const existing = JSON.parse(localStorage.getItem('linex_departments') || '[]');
        localStorage.setItem('linex_departments', JSON.stringify([...existing, withExp]));
      })
      .catch(() => {
        // Fallback: save to localStorage only
        const existing = JSON.parse(localStorage.getItem('linex_departments') || '[]');
        localStorage.setItem('linex_departments', JSON.stringify([...existing, withExp]));
      });
    setDepartments(prev => [...prev, withExp]);
  }, []);

  const closeDepartment = useCallback((id: string) => {
    deleteDepartment(id).catch(() => {});
    setDepartments(prev => prev.filter(d => d.id !== id));
  }, []);

  // ======== Pricing ========

  const updatePricing = useCallback((p: PricingDefaults) => {
    savePricingSettings(p).catch(() => {});
    setPricing(p);
  }, []);

  // ======== Renewal ========

  const renewCenter = useCallback((id: string, months: number) => {
    setCenters(prev => {
      return prev.map(c => {
        if (c.id !== id) return c;
        const now = new Date(), cur = new Date(c.expiresAt);
        const base = cur > now ? cur : now;
        const ne = new Date(base);
        ne.setMonth(ne.getMonth() + months);
        const updated = {
          ...c,
          isPaid: true,
          expiresAt: ne.toISOString(),
          status: computeStatus(true, c.createdAt, ne.toISOString(), true, c.freeTrialDays) as Center['status']
        };
        saveCenter(updated).catch(() => {});
        return updated;
      });
    });
  }, []);

  const renewDepartment = useCallback((id: string, months: number) => {
    setDepartments(prev => {
      return prev.map(d => {
        if (d.id !== id) return d;
        const now = new Date(), cur = new Date(d.expiresAt);
        const base = cur > now ? cur : now;
        const ne = new Date(base);
        ne.setMonth(ne.getMonth() + months);
        const updated = {
          ...d,
          isPaid: true,
          expiresAt: ne.toISOString(),
          status: computeStatus(true, d.createdAt, ne.toISOString(), true, d.freeTrialDays) as Department['status']
        };
        saveDepartment(updated).catch(() => {});
        return updated;
      });
    });
  }, []);

  // ======== Synchronous Getters ========

  const getCenterById = useCallback((id: string): Center | undefined => {
    return centers.find(c => c.id === id);
  }, [centers]);

  const getActiveCenters = useCallback((): Center[] => {
    return centers.filter(c => c.isActive && c.status !== 'expired');
  }, [centers]);

  const getDepartmentsByCenter = useCallback((centerId: string): Department[] => {
    return departments.filter(d => d.centerId === centerId && d.isActive);
  }, [departments]);

  const getIndependentDepartments = useCallback((): Department[] => {
    return departments.filter(d => d.centerId === null && d.isActive);
  }, [departments]);

  const getDepartmentById = useCallback((id: string): Department | undefined => {
    return departments.find(d => d.id === id);
  }, [departments]);

  const getActiveDepartments = useCallback((): Department[] => {
    return departments.filter(d => d.isActive && d.status !== 'expired');
  }, [departments]);

  // ======== Logs ========

  const addLog = useCallback((log: ActivityLog) => {
    addLogService(log).catch(() => {});
    setLogs(prev => [log, ...prev]);
  }, []);

  // ======== Payment Methods ========

  const updatePaymentMethods = useCallback((p: PaymentMethodsSettings) => {
    savePaymentMethods(p).catch(() => {});
    setPaymentMethods(p);
  }, []);

  const getEnabledPaymentMethods = useCallback((): PaymentMethodConfig[] => {
    return paymentMethods.methods.filter(m => m.enabled);
  }, [paymentMethods]);

  const togglePaymentMethod = useCallback((id: string) => {
    setPaymentMethods(prev => {
      const updated = {
        ...prev,
        methods: prev.methods.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m)
      };
      savePaymentMethods(updated).catch(() => {});
      return updated;
    });
  }, []);

  // ======== Announcement Operations ========

  const addAnnouncement = useCallback((a: AdminAnnouncement) => {
    saveAnnouncement(a).catch(() => {});
    setAnnouncements(prev => [a, ...prev]);
  }, []);

  const removeAnnouncement = useCallback((id: string) => {
    deleteAnnouncement(id).catch(() => {});
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  }, []);

  const getActiveAnnouncements = useCallback((adminId: string) => {
    return announcements.filter(a => {
      if (!a.active) return false;
      if (a.showToAll) return true;
      return a.targetAdminIds.includes(adminId);
    });
  }, [announcements]);

  const value = {
    loading,
    centers,
    departments,
    logs,
    pricing,
    paymentMethods,
    addCenter,
    closeCenter,
    addDepartment,
    closeDepartment,
    updatePricing,
    renewCenter,
    renewDepartment,
    getCenterById,
    getActiveCenters,
    getDepartmentsByCenter,
    getIndependentDepartments,
    getDepartmentById,
    getActiveDepartments,
    addLog,
    updatePaymentMethods,
    getEnabledPaymentMethods,
    togglePaymentMethod,
    announcements,
    addAnnouncement,
    removeAnnouncement,
    getActiveAnnouncements,
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
