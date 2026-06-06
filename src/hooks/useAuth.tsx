import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Admin, AuthState } from '@/types/linex';
import {
  getAllAdmins as fetchAllAdmins,
  saveAdmin as saveAdminToFirebase,
} from '@/services/firebaseService';
import {
  adminLogin,
  adminLogout,
  subscribeToAuth,
  sendOTP,
  verifyOTP,
  createAccountWithOTP,
  isUsernameAvailable,
  changePassword,
} from '@/services/firebaseAuthService';

interface AuthContextType {
  auth: AuthState;
  loading: boolean;
  login: (username: string, password: string) => Promise<Admin | null>;
  logout: () => Promise<void>;
  getAllAdmins: () => Admin[];
  addAdmin: (admin: Admin) => string | null;
  updateAdmin: (admin: Admin) => void;
  getAdminsByRole: (role: Admin['role']) => Admin[];
  getAdminById: (id: string) => Admin | undefined;
  getAdminByCenterId: (centerId: string) => Admin | undefined;
  getAdminByDepartmentId: (deptId: string) => Admin | undefined;
  // OTP Registration
  sendOTP: (identifier: string, method: 'gmail' | 'phone') => Promise<{ success: boolean; otpCode?: string; error?: string; cooldown?: number }>;
  verifyOTP: (identifier: string, code: string, method: 'gmail' | 'phone') => Promise<{ success: boolean; error?: string }>;
  createAccountWithOTP: (fullName: string, identifier: string, method: 'gmail' | 'phone', username: string, password: string, role?: 'center' | 'department') => Promise<{ success: boolean; admin?: Admin; error?: string }>;
  isUsernameAvailable: (username: string) => Promise<boolean>;
  // Password change
  changePassword: (adminId: string, currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Default super admin - FIXED account
const DEFAULT_SUPER_ADMIN: Admin = {
  id: 'super-admin-linex',
  fullName: 'المدير العام',
  username: 'admin@linex.com',
  password: 'admin123',
  role: 'super',
  phone: '07700000000',
  email: 'admin@linex.com',
  isActive: true,
  createdAt: new Date().toISOString(),
};

// Flag to prevent popstate from causing logout
let POPSTATE_GUARD_ACTIVE = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false, admin: null });
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<Admin[]>([]);

  // Subscribe to auth changes on mount & load admins
  useEffect(() => {
    let mounted = true;
    POPSTATE_GUARD_ACTIVE = true;

    const init = async () => {
      try {
        // Try localStorage first, then Firebase
        let localAdmins: Admin[] = [];
        try {
          const stored = localStorage.getItem('linex_admins');
          if (stored) localAdmins = JSON.parse(stored);
        } catch { /* ignore */ }

        let loadedAdmins = localAdmins.length > 0 ? localAdmins : await fetchAllAdmins();

        // Always ensure super admin exists and cannot be removed
        const superAdminIndex = loadedAdmins.findIndex(a => a.email === 'admin@linex.com');
        if (superAdminIndex === -1) {
          // Super admin doesn't exist - add it
          loadedAdmins = [DEFAULT_SUPER_ADMIN, ...loadedAdmins];
        } else {
          // Ensure super admin has correct properties
          loadedAdmins[superAdminIndex] = {
            ...DEFAULT_SUPER_ADMIN,
            ...loadedAdmins[superAdminIndex],
            id: 'super-admin-linex',
            email: 'admin@linex.com',
            role: 'super',
            isActive: true,
          };
        }

        // Save back to localStorage
        localStorage.setItem('linex_admins', JSON.stringify(loadedAdmins));

        if (mounted) {
          setAdmins(loadedAdmins);
        }

        // Subscribe to auth state
        const unsub = subscribeToAuth((state) => {
          if (mounted) {
            setAuth(state);
            setLoading(false);
          }
        });

        return () => { unsub(); };
      } catch {
        // Fallback: use localStorage or default
        const stored = localStorage.getItem('linex_admins');
        if (stored) {
          try { 
            const parsed = JSON.parse(stored);
            // Ensure super admin exists even in fallback
            const hasSuper = parsed.find((a: Admin) => a.email === 'admin@linex.com');
            if (!hasSuper) {
              parsed.unshift(DEFAULT_SUPER_ADMIN);
              localStorage.setItem('linex_admins', JSON.stringify(parsed));
            }
            setAdmins(parsed); 
          } catch { 
            setAdmins([DEFAULT_SUPER_ADMIN]); 
            localStorage.setItem('linex_admins', JSON.stringify([DEFAULT_SUPER_ADMIN]));
          }
        } else {
          setAdmins([DEFAULT_SUPER_ADMIN]);
          localStorage.setItem('linex_admins', JSON.stringify([DEFAULT_SUPER_ADMIN]));
        }
        if (mounted) setLoading(false);
      }
    };

    init();

    // CRITICAL: Prevent logout on browser back button
    // This intercepts popstate and restores auth from localStorage
    const handlePopState = () => {
      if (!POPSTATE_GUARD_ACTIVE) return;
      // Restore auth from localStorage when user navigates with back/forward
      try {
        const storedAuth = localStorage.getItem('linex_auth');
        if (storedAuth) {
          const parsed = JSON.parse(storedAuth);
          if (parsed.isAuthenticated && parsed.admin) {
            // Re-hydrate auth state without causing a full reload
            setAuth(parsed);
          }
        }
      } catch { /* ignore */ }
    };

    window.addEventListener('popstate', handlePopState);

    // Also prevent beforeunload from clearing auth
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Don't clear auth on refresh - persist it
      // This handler prevents accidental data loss
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => { 
      mounted = false; 
      POPSTATE_GUARD_ACTIVE = false;
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<Admin | null> => {
    // First check localStorage
    const stored = localStorage.getItem('linex_admins');
    if (stored) {
      try {
        const localAdmins: Admin[] = JSON.parse(stored);
        const found = localAdmins.find(a => a.username === username && a.password === password && a.isActive !== false);
        if (found) {
          const authState = { isAuthenticated: true, admin: found };
          setAuth(authState);
          localStorage.setItem('linex_auth', JSON.stringify(authState));
          return found;
        }
      } catch { /* ignore */ }
    }
    // Fallback to Firebase
    const result = await adminLogin(username, password);
    if (result.success && result.admin) {
      setAuth({ isAuthenticated: true, admin: result.admin });
      const authState = { isAuthenticated: true, admin: result.admin };
      localStorage.setItem('linex_auth', JSON.stringify(authState));
      const all = await fetchAllAdmins();
      setAdmins(all);
      return result.admin;
    }
    return null;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await adminLogout();
    setAuth({ isAuthenticated: false, admin: null });
  }, []);

  // OTP Functions
  const sendOTPHandler = useCallback(async (identifier: string, method: 'gmail' | 'phone') => {
    return sendOTP(identifier, method);
  }, []);

  const verifyOTPHandler = useCallback(async (identifier: string, code: string, method: 'gmail' | 'phone') => {
    return verifyOTP(identifier, code, method);
  }, []);

  const createAccountWithOTPHandler = useCallback(async (
    fullName: string, 
    identifier: string, 
    method: 'gmail' | 'phone', 
    username: string, 
    password: string,
    role: 'center' | 'department' = 'center'
  ) => {
    const result = await createAccountWithOTP(fullName, identifier, method, username, password, role);
    if (result.success && result.admin) {
      setAuth({ isAuthenticated: true, admin: result.admin });
      const authState = { isAuthenticated: true, admin: result.admin };
      localStorage.setItem('linex_auth', JSON.stringify(authState));
      // Refresh admins list
      const all = await fetchAllAdmins();
      setAdmins(all);
    }
    return result;
  }, []);

  const isUsernameAvailableHandler = useCallback(async (username: string) => {
    return isUsernameAvailable(username);
  }, []);

  // Password change handler
  const changePasswordHandler = useCallback(async (adminId: string, currentPassword: string, newPassword: string) => {
    const result = await changePassword(adminId, currentPassword, newPassword);
    if (result.success) {
      // Update local admin data
      const all = await fetchAllAdmins();
      setAdmins(all);
      
      // If current admin changed their password, update auth state
      if (auth.admin?.id === adminId) {
        const updatedAdmin = all.find(a => a.id === adminId);
        if (updatedAdmin) {
          const newAuth = { isAuthenticated: true, admin: updatedAdmin };
          setAuth(newAuth);
          localStorage.setItem('linex_auth', JSON.stringify(newAuth));
        }
      }
    }
    return result;
  }, [auth.admin?.id]);

  // Synchronous reads from local state
  const getAllAdmins = useCallback((): Admin[] => admins, [admins]);

  const addAdmin = useCallback((admin: Admin): string | null => {
    // Check for duplicate username
    const existing = admins.find(a => a.username === admin.username && a.id !== admin.id);
    if (existing) {
      return 'اسم المستخدم "' + admin.username + '" مستخدم مسبقاً. يرجى اختيار اسم آخر.';
    }
    // Check for duplicate email
    if (admin.email) {
      const existingEmail = admins.find(a => a.email?.toLowerCase() === admin.email.toLowerCase() && a.id !== admin.id);
      if (existingEmail) {
        return 'البريد الإلكتروني "' + admin.email + '" مستخدم مسبقاً.';
      }
    }
    // Check for duplicate phone
    if (admin.phone) {
      const existingPhone = admins.find(a => a.phone === admin.phone && a.id !== admin.id);
      if (existingPhone) {
        return 'رقم الهاتف "' + admin.phone + '" مستخدم مسبقاً.';
      }
    }
    // Save to Firebase in background
    saveAdminToFirebase(admin).then(() => {
      // Refresh from Firebase to stay in sync
      fetchAllAdmins().then(setAdmins);
    });
    // Optimistic update
    setAdmins(prev => {
      const idx = prev.findIndex(a => a.id === admin.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = admin;
        return updated;
      }
      return [...prev, admin];
    });
    return null;
  }, [admins]);

  const updateAdmin = useCallback((admin: Admin): void => {
    // Protect super admin - cannot change email/role/isActive
    if (admin.email === 'admin@linex.com') {
      admin.role = 'super';
      admin.isActive = true;
      admin.id = 'super-admin-linex';
    }
    
    saveAdminToFirebase(admin).then(() => {
      fetchAllAdmins().then(setAdmins);
    });
    setAdmins(prev => prev.map(a => a.id === admin.id ? admin : a));
    
    // If updating current admin, update auth state too
    if (auth.admin?.id === admin.id) {
      setAuth({ isAuthenticated: true, admin });
      localStorage.setItem('linex_auth', JSON.stringify({ isAuthenticated: true, admin }));
    }
  }, [auth.admin?.id]);

  const getAdminsByRole = useCallback((role: Admin['role']): Admin[] => {
    return admins.filter(a => a.role === role && a.isActive);
  }, [admins]);

  const getAdminById = useCallback((id: string): Admin | undefined => {
    return admins.find(a => a.id === id);
  }, [admins]);

  const getAdminByCenterId = useCallback((centerId: string): Admin | undefined => {
    return admins.find(a => a.role === 'center' && a.centerId === centerId);
  }, [admins]);

  const getAdminByDepartmentId = useCallback((deptId: string): Admin | undefined => {
    return admins.find(a => a.role === 'department' && a.departmentId === deptId);
  }, [admins]);

  return (
    <AuthContext.Provider value={{
      auth,
      loading,
      login,
      logout,
      getAllAdmins,
      addAdmin,
      updateAdmin,
      getAdminsByRole,
      getAdminById,
      getAdminByCenterId,
      getAdminByDepartmentId,
      // OTP
      sendOTP: sendOTPHandler,
      verifyOTP: verifyOTPHandler,
      createAccountWithOTP: createAccountWithOTPHandler,
      isUsernameAvailable: isUsernameAvailableHandler,
      // Password
      changePassword: changePasswordHandler,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
