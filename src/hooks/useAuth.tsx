import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Admin, AuthState } from '@/types/linex';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  getAdmins,
  saveAdmin,
  getCenters,
  getDepartments,
  getAuth,
  setAuth,
  clearAuth,
  seedDefaults,
  STORAGE_KEYS,
} from '@/services/dataStorage';
import {
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
  logout: () => void;
  getAllAdmins: () => Admin[];
  addAdmin: (admin: Admin) => string | null;
  updateAdmin: (admin: Admin) => void;
  getAdminsByRole: (role: Admin['role']) => Admin[];
  getAdminById: (id: string) => Admin | undefined;
  getAdminByCenterId: (centerId: string) => Admin | undefined;
  getAdminByDepartmentId: (deptId: string) => Admin | undefined;
  removeAdmin: (adminId: string) => Promise<void>;
  // OTP Registration
  sendOTP: (identifier: string, method: 'gmail' | 'phone') => Promise<{ success: boolean; otpCode?: string; error?: string; cooldown?: number }>;
  verifyOTP: (identifier: string, code: string, method: 'gmail' | 'phone') => Promise<{ success: boolean; error?: string }>;
  createAccountWithOTP: (fullName: string, identifier: string, method: 'gmail' | 'phone', username: string, password: string, role?: 'center' | 'department') => Promise<{ success: boolean; admin?: Admin; error?: string }>;
  isUsernameAvailable: (username: string) => Promise<boolean>;
  // Password change
  changePassword: (adminId: string, currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState>(() => {
    // IMMEDIATELY restore from localStorage on first render
    const stored = getAuth();
    return stored.isAuthenticated && stored.admin ? stored : { isAuthenticated: false, admin: null };
  });
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<Admin[]>([]);

  // Initial load
  useEffect(() => {
    seedDefaults();

    // Ensure super admin exists
    const allAdmins = getAdmins();
    const hasSuper = allAdmins.find(a => a.email === 'admin@linex.com');
    if (!hasSuper) {
      const updated = [DEFAULT_SUPER_ADMIN, ...allAdmins];
      // Use saveAdmin for each
      saveAdmin(DEFAULT_SUPER_ADMIN);
      setAdmins(updated);
    } else {
      // Ensure super admin properties are correct
      const idx = allAdmins.findIndex(a => a.email === 'admin@linex.com');
      if (idx >= 0) {
        allAdmins[idx] = { ...DEFAULT_SUPER_ADMIN, ...allAdmins[idx], id: 'super-admin-linex', email: 'admin@linex.com', role: 'super', isActive: true };
        saveAdmin(allAdmins[idx]);
      }
      setAdmins(allAdmins);
    }

    // Sync auth state
    const storedAuth = getAuth();
    if (storedAuth.isAuthenticated && storedAuth.admin) {
      setAuthState(storedAuth);
    }

    // Listen for cross-tab auth changes
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.AUTH) {
        const newAuth = getAuth();
        setAuthState(newAuth.isAuthenticated && newAuth.admin ? newAuth : { isAuthenticated: false, admin: null });
      }
      if (e.key === STORAGE_KEYS.ADMINS) {
        setAdmins(getAdmins());
      }
    };
    window.addEventListener('storage', handleStorage);

    setLoading(false);

    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<Admin | null> => {
    const allAdmins = getAdmins();
    // Sort by createdAt descending to pick the newest admin (handles re-created accounts)
    const matching = allAdmins
      .filter(a => a.username === username && a.password === password && a.isActive !== false)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const found = matching[0] || null;
    if (found) {
      const authState = { isAuthenticated: true, admin: found };
      setAuth(authState);
      setAuthState(authState);
      return found;
    }
    return null;
  }, []);

  const logout = useCallback((): void => {
    clearAuth();
    setAuthState({ isAuthenticated: false, admin: null });
  }, []);

  // OTP Functions
  const sendOTPHandler = useCallback(async (identifier: string, method: 'gmail' | 'phone') => {
    return sendOTP(identifier, method);
  }, []);

  const verifyOTPHandler = useCallback(async (identifier: string, code: string, method: 'gmail' | 'phone') => {
    return verifyOTP(identifier, code, method);
  }, []);

  const createAccountWithOTPHandler = useCallback(async (
    fullName: string, identifier: string, method: 'gmail' | 'phone', username: string, password: string, role: 'center' | 'department' = 'center'
  ) => {
    const result = await createAccountWithOTP(fullName, identifier, method, username, password, role);
    if (result.success && result.admin) {
      const authState = { isAuthenticated: true, admin: result.admin };
      setAuth(authState);
      setAuthState(authState);
      setAdmins(getAdmins());
    }
    return result;
  }, []);

  const isUsernameAvailableHandler = useCallback(async (username: string) => {
    return isUsernameAvailable(username);
  }, []);

  // Password change handler
  const changePasswordHandler = useCallback(async (adminId: string, currentPassword: string, newPassword: string) => {
    const all = getAdmins();
    const admin = all.find(a => a.id === adminId);
    if (!admin) return { success: false, error: 'الحساب غير موجود' };
    if (admin.password !== currentPassword) return { success: false, error: 'كلمة المرور الحالية غير صحيحة' };
    if (newPassword.length < 6) return { success: false, error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' };
    
    const updated = { ...admin, password: newPassword };
    saveAdmin(updated);
    setAdmins(getAdmins());
    
    // If current admin changed their password, update auth state
    if (auth.admin?.id === adminId) {
      const newAuth = { isAuthenticated: true, admin: updated };
      setAuth(newAuth);
      setAuthState(newAuth);
    }
    return { success: true };
  }, [auth.admin?.id]);

  const getAllAdmins = useCallback((): Admin[] => admins, [admins]);

  const addAdmin = useCallback((admin: Admin): string | null => {
    const all = getAdmins();
    // Find existing admin with same email
    const existingByEmail = admin.email ? all.find(a => a.email?.toLowerCase() === admin.email.toLowerCase() && a.id !== admin.id) : undefined;
    const existingByUsername = all.find(a => a.username === admin.username && a.id !== admin.id);
    
    // Helper: check if an admin's associated center/department still exists
    const isOrphaned = (a: Admin): boolean => {
      if (a.role === 'center' && a.centerId) {
        return !getCenters().find(c => c.id === a.centerId);
      }
      if (a.role === 'department' && a.departmentId) {
        return !getDepartments().find(d => d.id === a.departmentId);
      }
      return false;
    };
    
    // If existing account is ACTIVE and NOT orphaned, reject
    if (existingByUsername && existingByUsername.isActive === true && !isOrphaned(existingByUsername)) {
      return 'اسم المستخدم "' + admin.username + '" مستخدم مسبقاً بحساب نشط.';
    }
    if (existingByEmail && existingByEmail.isActive === true && !isOrphaned(existingByEmail)) {
      return 'البريد الإلكتروني مستخدم مسبقاً بحساب نشط.';
    }
    
    // If same email exists (orphaned or inactive), UPDATE it instead of creating duplicate
    if (existingByEmail) {
      const updated = { ...existingByEmail, ...admin, id: existingByEmail.id };
      const filtered = all.filter(a => a.id !== existingByEmail.id);
      localStorage.setItem('linex_admins', JSON.stringify([...filtered, updated]));
      saveAdmin(updated);
      setAdmins([...filtered, updated]);
      return null;
    }
    
    // Remove any existing account with same username
    const filtered = all.filter(a => a.id === admin.id || a.username !== admin.username);
    
    localStorage.setItem('linex_admins', JSON.stringify([...filtered, admin]));
    saveAdmin(admin);
    setAdmins([...filtered, admin]);
    return null;
  }, []);

  const updateAdmin = useCallback((admin: Admin): void => {
    if (admin.email === 'admin@linex.com') {
      admin.role = 'super'; admin.isActive = true; admin.id = 'super-admin-linex';
    }
    saveAdmin(admin);
    setAdmins(getAdmins());
    if (auth.admin?.id === admin.id) {
      const newAuth = { isAuthenticated: true, admin };
      setAuth(newAuth);
      setAuthState(newAuth);
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

  const removeAdmin = useCallback(async (adminId: string): Promise<void> => {
    const stored = localStorage.getItem('linex_admins');
    if (!stored) return;
    const parsed = JSON.parse(stored) as Admin[];
    const adminToDelete = parsed.find(a => a.id === adminId);
    
    if (!adminToDelete) return;
    
    // 1. Delete from Firebase Auth via Cloud Function
    if (adminToDelete.email) {
      try {
        const functions = getFunctions();
        const deleteAuthUserFn = httpsCallable(functions, 'deleteAuthUser');
        await deleteAuthUserFn({ email: adminToDelete.email });
      } catch (err: any) {
        console.warn('Firebase Auth deletion warning:', err.message);
      }
    }
    
    // 2. Delete from Firestore FIRST — throw on error
    if (db) {
      await deleteDoc(doc(db, 'admins', adminId));
      console.log('[DEBUG] Deleted from Firestore:', adminId);
    }
    
    // 3. Delete from localStorage only after Firestore succeeds
    const updated = parsed.filter(a => a.id !== adminId);
    localStorage.setItem('linex_admins', JSON.stringify(updated));
    setAdmins(updated);
  }, []);

  return (
    <AuthContext.Provider value={{
      auth, loading, login, logout,
      getAllAdmins, addAdmin, updateAdmin, removeAdmin,
      getAdminsByRole, getAdminById,
      getAdminByCenterId, getAdminByDepartmentId,
      sendOTP: sendOTPHandler, verifyOTP: verifyOTPHandler,
      createAccountWithOTP: createAccountWithOTPHandler,
      isUsernameAvailable: isUsernameAvailableHandler,
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
