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
} from '@/services/firebaseAuthService';

interface AuthContextType {
  auth: AuthState;
  loading: boolean;
  login: (username: string, password: string) => Promise<Admin | null>;
  logout: () => Promise<void>;
  getAllAdmins: () => Admin[];
  addAdmin: (admin: Admin) => void;
  updateAdmin: (admin: Admin) => void;
  getAdminsByRole: (role: Admin['role']) => Admin[];
  getAdminById: (id: string) => Admin | undefined;
  getAdminByCenterId: (centerId: string) => Admin | undefined;
  getAdminByDepartmentId: (deptId: string) => Admin | undefined;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Default super admin for initial seed
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false, admin: null });
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<Admin[]>([]);

  // Subscribe to auth changes on mount & load admins
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        let loadedAdmins = await fetchAllAdmins();
        if (loadedAdmins.length === 0) {
          await saveAdminToFirebase(DEFAULT_SUPER_ADMIN);
          loadedAdmins = [DEFAULT_SUPER_ADMIN];
        }
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
        if (mounted) setLoading(false);
      }
    };

    init();

    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<Admin | null> => {
    const result = await adminLogin(username, password);
    if (result.success && result.admin) {
      setAuth({ isAuthenticated: true, admin: result.admin });
      // Refresh admins cache
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

  // Synchronous reads from local state
  const getAllAdmins = useCallback((): Admin[] => admins, [admins]);

  const addAdmin = useCallback((admin: Admin): void => {
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
  }, []);

  const updateAdmin = useCallback((admin: Admin): void => {
    saveAdminToFirebase(admin).then(() => {
      fetchAllAdmins().then(setAdmins);
    });
    setAdmins(prev => prev.map(a => a.id === admin.id ? admin : a));
  }, []);

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
