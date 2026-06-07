import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useLinexData } from '@/hooks/useLinexData';
import { saveCenter, saveDepartment } from '@/services/firebaseService';
import type { ActivationType, Center, Department } from '@/types/linex';
import { getStatusLabel, getStatusColor, getRemainingDays, getActivationLabel, getActivationBadge } from '@/types/linex';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Building2, Briefcase, Eye, LogOut, Plus,
  Trash2, EyeOff, X, Save,
  FileText, Lock, User,
  Phone, Mail, Clock, MapPin, Star, ExternalLink,
  CheckCircle2, Coins, CalendarX, RefreshCw,
  DollarSign, Shield, ToggleLeft, ToggleRight, CreditCard, Smartphone, Banknote,
  AlertCircle
} from 'lucide-react';

type Tab = 'overview' | 'centers' | 'departments' | 'pricing' | 'payments' | 'announcements' | 'logs' | 'appearance';

// ======== Super Admin Protection ========
const SUPER_ADMIN_EMAIL = 'admin@linex.com';
const SUPER_ADMIN_ID = 'super-admin-linex';

function isSuperAdminProtected(adminId: string, adminEmail?: string): boolean {
  return adminId === SUPER_ADMIN_ID || adminEmail === SUPER_ADMIN_EMAIL;
}

export default function AdminDashboard() {
  const { auth, login, logout, addAdmin, getAdminById, updateAdmin, changePassword } = useAuth();
  const {
    centers, departments, logs, pricing,
    addCenter, closeCenter, addDepartment, closeDepartment,
    updatePricing, renewCenter, renewDepartment,
    getCenterById, getDepartmentsByCenter,
    getActiveCenters, getActiveDepartments, getIndependentDepartments,
    addLog, refreshStatuses,
    paymentMethods, togglePaymentMethod, updatePaymentMethods,
    announcements, addAnnouncement, removeAnnouncement,
    appearanceVisibility, updateAppearanceVisibility,
    featuredEntities, addFeaturedEntity, removeFeaturedEntity,
  } = useLinexData();
  const nav = useNavigate();

  useEffect(() => { refreshStatuses(); }, [refreshStatuses]);

  // Login
  const [loginForm, setLoginForm] = useState({ username: '', password: '', showPass: false, error: '' });

  // Dashboard
  const [tab, setTab] = useState<Tab>('overview');
  const [showCenterModal, setShowCenterModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [renewTarget, setRenewTarget] = useState<{ type: 'center' | 'dept'; id: string; name: string } | null>(null);
  const [pricingTarget, setPricingTarget] = useState<{ type: 'center' | 'dept'; id: string; name: string } | null>(null);
  const [customPrices, setCustomPrices] = useState({ platformPrice: 0, platformTrial: 7, appearancePrice: 0, appearanceTrial: 3 });
  const [msg, setMsg] = useState('');
  const showMsg = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 3000); };

  // Center form
  const [cForm, setCForm] = useState({
    name: '', address: '', phone: '', email: '',
    workingDays: 'السبت - الخميس', workingHours: '8:00 ص - 10:00 م',
    fridayHours: '4:00 م - 9:00 م', emergencyHours: '24 ساعة',
    activationType: 'paid' as ActivationType,
    subscriptionPrice: pricing.platform.centerMonthlyPrice,
    freeTrialDays: pricing.trial?.trialDays || 10,
  });

  // Department form
  const [dForm, setDForm] = useState({
    name: '', description: '', icon: 'Stethoscope', doctorEmail: '', centerId: '',
    activationType: 'paid' as ActivationType,
    subscriptionPrice: pricing.platform.deptMonthlyPrice,
    freeTrialDays: pricing.trial?.trialDays || 10,
  });

  // Admin form
  const [aForm, setAForm] = useState({ fullName: '', username: '', password: '', phone: '', email: '' });

  // Super admin password change
  const [showSuperAdminPasswordForm, setShowSuperAdminPasswordForm] = useState(false);
  const [superPwForm, setSuperPwForm] = useState({ current: '', newPass: '', confirm: '', error: '' });

  // Pricing form
  const [pForm, setPForm] = useState({ ...pricing });
  const [annForm, setAnnForm] = useState({ message: '', showToAll: true });
  const [renewMonths, setRenewMonths] = useState(1);

  // Featured entity form (manual display by super admin)
  const [featuredForm, setFeaturedForm] = useState({
    entityId: '',
    entityType: 'center' as 'center' | 'department',
    name: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    isPaid: false,
    price: 0,
  });

  // Stats - independent clinics only (not center departments)
  const activeCenters = getActiveCenters();
  const independentDepts = departments.filter(d => !d.centerId);
  const activeDepts = independentDepts.filter(d => d.isActive);
  const totalRevenue = centers.reduce((s, c) => s + (c.isPaid ? c.subscriptionPrice : 0), 0) + independentDepts.reduce((s, d) => s + (d.isPaid ? d.subscriptionPrice : 0), 0);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(loginForm.username, loginForm.password);
    if (success) { setLoginForm({ username: '', password: '', showPass: false, error: '' }); showMsg('تم تسجيل الدخول'); }
    else setLoginForm(p => ({ ...p, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }));
  };

  const createCenter = async () => {
    if (!cForm.name || !cForm.phone) return;
    
    // Use global trial settings
    const trialDays = pricing.trial?.enabled ? (pricing.trial?.trialDays || 10) : 0;
    
    // Check for duplicate username
    const username = aForm.username || 'admin_' + Date.now().toString(36).slice(-6);
    const allAdmins = await (async () => {
      const stored = localStorage.getItem('linex_admins');
      if (stored) return JSON.parse(stored);
      return [];
    })();
    const existingUser = allAdmins.find((a: { username: string }) => a.username === username);
    if (existingUser) {
      showMsg('اسم المستخدم "' + username + '" مستخدم مسبقاً');
      return;
    }
    
    const aid = 'admin-' + Date.now();
    const result = addAdmin({ id: aid, fullName: aForm.fullName || 'أدمن ' + cForm.name, username, password: aForm.password || '123456', role: 'center', phone: aForm.phone || cForm.phone, email: aForm.email || cForm.email, isActive: true, createdAt: new Date().toISOString() });
    if (result) { showMsg(result); return; }

    const center: Center = { 
      id: 'center-' + Date.now(), name: cForm.name, address: cForm.address, phone: cForm.phone, email: cForm.email, logo: '', workingDays: cForm.workingDays, workingHours: cForm.workingHours, fridayHours: cForm.fridayHours, emergencyHours: cForm.emergencyHours, consultationDuration: 15, doctors: [], adminId: aid, 
      activationType: 'paid', 
      subscriptionPrice: cForm.subscriptionPrice, 
      freeTrialDays: trialDays, 
      createdAt: new Date().toISOString(), 
      expiresAt: new Date(Date.now() + trialDays * 86400000).toISOString(), 
      isPaid: false, 
      isActive: true, 
      status: 'trial' as Center['status'], 
      appearanceType: 'free_trial', 
      appearanceExpiry: new Date(Date.now() + 7 * 86400000).toISOString(), 
      promoImages: [], 
      promoText: '' 
    };
    addCenter(center);
    addLog({ id: 'log-' + Date.now(), action: 'create_center', adminName: auth.admin?.fullName || '', targetName: center.name, timestamp: new Date().toISOString(), details: `إنشاء مركز "${center.name}" - ${getActivationLabel(center.activationType)}${center.activationType === 'paid' ? ` - ${center.subscriptionPrice.toLocaleString()} د.ع/شهر` : ''}` });
    setShowCenterModal(false);
    setCForm({ name: '', address: '', phone: '', email: '', workingDays: 'السبت - الخميس', workingHours: '8:00 ص - 10:00 م', fridayHours: '4:00 م - 9:00 م', emergencyHours: '24 ساعة', activationType: 'paid', subscriptionPrice: pricing.platform.centerMonthlyPrice, freeTrialDays: pricing.trial?.trialDays || 10 });
    setAForm({ fullName: '', username: '', password: '', phone: '', email: '' });
    showMsg('تم إنشاء المركز الطبي بنجاح');
  };

  const createDept = async () => {
    if (!dForm.name) return;
    
    // Use global trial settings
    const trialDays = pricing.trial?.enabled ? (pricing.trial?.trialDays || 10) : 0;
    
    // Check for duplicate username
    const username = aForm.username || 'admin_' + Date.now().toString(36).slice(-6);
    const allAdmins = await (async () => {
      const stored = localStorage.getItem('linex_admins');
      if (stored) return JSON.parse(stored);
      return [];
    })();
    const existingUser = allAdmins.find((a: { username: string }) => a.username === username);
    if (existingUser) {
      showMsg('اسم المستخدم "' + username + '" مستخدم مسبقاً');
      return;
    }
    
    const aid = 'admin-' + Date.now();
    const result = addAdmin({ id: aid, fullName: aForm.fullName || 'أدمن ' + dForm.name, username, password: aForm.password || '123456', role: 'department', phone: aForm.phone || '', email: aForm.email || dForm.doctorEmail, isActive: true, createdAt: new Date().toISOString() });
    if (result) { showMsg(result); return; }

    const dept: Department = { 
      id: 'dept-' + Date.now(), name: dForm.name, description: dForm.description, icon: dForm.icon, doctorName: '', doctorEmail: dForm.doctorEmail, doctorPhone: '', logo: '', workingDays: 'السبت - الخميس', workingHours: '8:00 ص - 10:00 م', fridayHours: '4:00 م - 9:00 م', consultationDuration: 15, centerId: dForm.centerId || null, adminId: aid, 
      activationType: 'paid', 
      subscriptionPrice: dForm.subscriptionPrice, 
      freeTrialDays: trialDays, 
      createdAt: new Date().toISOString(), 
      expiresAt: new Date(Date.now() + trialDays * 86400000).toISOString(), 
      isPaid: false, 
      isActive: true, 
      status: 'trial' as Department['status'], 
      appearanceType: 'free_trial', 
      appearanceExpiry: new Date(Date.now() + 7 * 86400000).toISOString(), 
      promoImages: [], 
      promoText: '' 
    };
    addDepartment(dept);
    const parent = dept.centerId ? centers.find(c => c.id === dept.centerId)?.name : 'مستقل';
    addLog({ id: 'log-' + Date.now(), action: 'create_department', adminName: auth.admin?.fullName || '', targetName: dept.name, timestamp: new Date().toISOString(), details: `إنشاء عيادة "${dept.name}" (${parent}) - ${getActivationLabel(dept.activationType)}` });
    setShowDeptModal(false);
    setDForm({ name: '', description: '', icon: 'Stethoscope', doctorEmail: '', centerId: '', activationType: 'paid', subscriptionPrice: pricing.platform.deptMonthlyPrice, freeTrialDays: pricing.trial?.trialDays || 10 });
    setAForm({ fullName: '', username: '', password: '', phone: '', email: '' });
    showMsg('تم إنشاء القسم بنجاح');
  };

  const handleRenew = () => {
    if (!renewTarget) return;
    if (renewTarget.type === 'center') renewCenter(renewTarget.id, renewMonths);
    else renewDepartment(renewTarget.id, renewMonths);
    addLog({ id: 'log-' + Date.now(), action: 'renew_subscription', adminName: auth.admin?.fullName || '', targetName: renewTarget.name, timestamp: new Date().toISOString(), details: `تجديد اشتراك "${renewTarget.name}" لـ ${renewMonths} شهر` });
    setRenewTarget(null); setRenewMonths(1); showMsg('تم تجديد الاشتراك');
  };

  if (!auth.isAuthenticated) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 text-center">
  <img src="/assets/linex-logo-transparent.png" alt="LinkEX" className="h-44 md:h-52 w-auto mx-auto object-contain drop-shadow-2xl" style={{ maxWidth: '90%' }} />
</div>
          <h1 className="text-3xl font-bold tracking-wide"><span style={{ color: '#2c3e50' }}>Link</span><span style={{ color: '#FF5722' }}>EX</span></h1>
          <p className="text-slate-400 mt-2 text-sm">منصة إدارة المراكز الطبية والحجوزات الإلكترونية</p>
        </div>
        <Card className="p-6 border-0 shadow-2xl bg-white/95 backdrop-blur">
          <h2 className="text-lg font-bold text-gray-900 mb-4 text-center flex items-center justify-center gap-2"><Lock className="w-5 h-5 text-teal-600" />تسجيل دخول الأدمن</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2"><Label>اسم المستخدم</Label><Input value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value, error: '' })} placeholder="admin" dir="ltr" /></div>
            <div className="space-y-2"><Label>كلمة المرور</Label><div className="relative"><Input type={loginForm.showPass ? 'text' : 'password'} value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value, error: '' })} placeholder="••••••" dir="ltr" /><button type="button" onClick={() => setLoginForm(p => ({ ...p, showPass: !p.showPass }))} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{loginForm.showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
            {loginForm.error && <p className="text-sm text-red-500 text-center">{loginForm.error}</p>}
            <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 gap-2"><Lock className="w-4 h-4" />دخول</Button>
          </form>
          <p className="text-xs text-center text-gray-400 mt-4">الافتراضي: <span dir="ltr">admin</span> / <span dir="ltr">admin123</span></p>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/linex-logo-transparent.png" alt="LinkEX" className="h-9 w-auto rounded bg-white px-1 py-0.5" />
            <div><span className="font-bold text-gray-900">Link</span><span className="font-bold" style={{ color: '#FF5722' }}>EX</span><span className="text-xs text-gray-500 block">لوحة التحكم العامة</span></div>
          </div>
          <div className="flex items-center gap-3">
            {msg && <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-lg flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />{msg}</span>}
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
              <Shield className="w-4 h-4" />
              <span>{auth.admin?.fullName}</span>
              <Badge variant="secondary" className="text-xs">{auth.admin?.role === 'super' ? 'مدير عام' : 'أدمن'}</Badge>
              {auth.admin?.email === SUPER_ADMIN_EMAIL && (
                <Badge className="bg-amber-100 text-amber-700 text-xs">حساب محمي</Badge>
              )}
            </div>
            {/* Super Admin Password Change Button */}
            {auth.admin?.role === 'super' && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowSuperAdminPasswordForm(!showSuperAdminPasswordForm)}
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1"
              >
                <Lock className="w-4 h-4" />
                <span className="hidden sm:inline">الباسورد</span>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={async () => { await logout(); }} className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1"><LogOut className="w-4 h-4" /><span className="hidden sm:inline">خروج</span></Button>
          </div>
        </div>
      </header>

      {/* Super Admin Password Change Modal */}
      {showSuperAdminPasswordForm && auth.admin?.role === 'super' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <Card className="p-4 border-2 border-amber-200 bg-amber-50/30">
            <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600" />
              تغيير باسورد المدير العام
              <Badge className="bg-amber-100 text-amber-700 text-xs">حساب محمي</Badge>
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              هذا الحساب ({SUPER_ADMIN_EMAIL}) هو حساب ثابت ولا يمكن حذفه. يمكنك تغيير باسورد فقط.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">الباسورد الحالي</Label>
                <Input 
                  type="password" 
                  placeholder="••••••" 
                  value={superPwForm.current} 
                  onChange={e => setSuperPwForm({ ...superPwForm, current: e.target.value, error: '' })} 
                  dir="ltr" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">الباسورد الجديد</Label>
                <Input 
                  type="password" 
                  placeholder="••••••" 
                  value={superPwForm.newPass} 
                  onChange={e => setSuperPwForm({ ...superPwForm, newPass: e.target.value, error: '' })} 
                  dir="ltr" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">تأكيد الجديد</Label>
                <Input 
                  type="password" 
                  placeholder="••••••" 
                  value={superPwForm.confirm} 
                  onChange={e => setSuperPwForm({ ...superPwForm, confirm: e.target.value, error: '' })} 
                  dir="ltr" 
                />
              </div>
            </div>
            {superPwForm.error && (
              <div className="flex items-center gap-2 mt-2 text-sm text-red-500 bg-red-50 p-2 rounded">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {superPwForm.error}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => { setShowSuperAdminPasswordForm(false); setSuperPwForm({ current: '', newPass: '', confirm: '', error: '' }); }}
              >
                إلغاء
              </Button>
              <Button 
                size="sm" 
                className="bg-amber-600 hover:bg-amber-700 gap-2"
                disabled={!superPwForm.current || !superPwForm.newPass || !superPwForm.confirm}
                onClick={async () => {
                  if (!superPwForm.current || !superPwForm.newPass || !superPwForm.confirm) {
                    setSuperPwForm({ ...superPwForm, error: 'املأ جميع الحقول' });
                    return;
                  }
                  if (superPwForm.newPass !== superPwForm.confirm) {
                    setSuperPwForm({ ...superPwForm, error: 'كلمتا المرور غير متطابقتين' });
                    return;
                  }
                  if (superPwForm.newPass.length < 6) {
                    setSuperPwForm({ ...superPwForm, error: 'الباسورد الجديد يجب أن يكون 6 أحرف على الأقل' });
                    return;
                  }
                  if (!auth.admin) {
                    setSuperPwForm({ ...superPwForm, error: 'يجب تسجيل الدخول' });
                    return;
                  }
                  
                  const result = await changePassword(auth.admin.id, superPwForm.current, superPwForm.newPass);
                  if (result.success) {
                    setShowSuperAdminPasswordForm(false);
                    setSuperPwForm({ current: '', newPass: '', confirm: '', error: '' });
                    showMsg('تم تغيير باسورد المدير العام بنجاح');
                  } else {
                    setSuperPwForm({ ...superPwForm, error: result.error || 'فشل تغيير الباسورد' });
                  }
                }}
              >
                <Save className="w-4 h-4" />
                حفظ
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="p-4 bg-gradient-to-br from-teal-600 to-teal-700 text-white border-0 text-center">
            <Building2 className="w-8 h-8 opacity-80 mx-auto mb-2" />
            <p className="text-2xl font-bold">{activeCenters.length}</p>
            <p className="text-xs opacity-80">مركز طبي</p>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-blue-600 to-blue-700 text-white border-0 text-center">
            <Briefcase className="w-8 h-8 opacity-80 mx-auto mb-2" />
            <p className="text-2xl font-bold">{activeDepts.length}</p>
            <p className="text-xs opacity-80">عيادة / تخصص</p>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-purple-600 to-purple-700 text-white border-0 text-center">
            <Eye className="w-8 h-8 opacity-80 mx-auto mb-2" />
            <p className="text-2xl font-bold">{pricing.appearance.monthlyPrice.toLocaleString()}</p>
            <p className="text-xs opacity-80">د.ع / ظهور</p>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-amber-600 to-amber-700 text-white border-0 text-center">
            <DollarSign className="w-8 h-8 opacity-80 mx-auto mb-2" />
            <p className="text-2xl font-bold">{totalRevenue.toLocaleString()}</p>
            <p className="text-xs opacity-80">د.ع / شهر</p>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-rose-600 to-rose-700 text-white border-0 text-center">
            <CalendarX className="w-8 h-8 opacity-80 mx-auto mb-2" />
            <p className="text-2xl font-bold">{[...centers, ...departments].filter(c => c.status === 'expired').length}</p>
            <p className="text-xs opacity-80">اشتراك منتهي</p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {([{ id: 'overview', label: 'نظرة عامة', icon: Star }, { id: 'centers', label: 'المراكز الطبية (ب)', icon: Building2 }, { id: 'departments', label: 'العيادات (أ)', icon: Briefcase }, { id: 'pricing', label: 'أسعار الاشتراكات', icon: Coins }, { id: 'payments', label: 'طرق الدفع', icon: CreditCard }, { id: 'announcements', label: 'رسائل المدراء', icon: Mail }, { id: 'appearance', label: 'الظهور الإعلاني', icon: Eye }, { id: 'logs', label: 'سجل العمليات', icon: FileText }] as const).map(t => (
            <Button key={t.id} variant={tab === t.id ? 'default' : 'outline'} onClick={() => setTab(t.id as Tab)} className={tab === t.id ? 'bg-teal-600 hover:bg-teal-700 gap-2' : 'gap-2'}><t.icon className="w-4 h-4" />{t.label}</Button>
          ))}
        </div>

        {/* OVERVIEW - Stats only, NO center/dept details */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="flex gap-3 flex-wrap">
              <Button onClick={() => { setTab('centers'); setShowCenterModal(true); }} className="bg-teal-600 hover:bg-teal-700 gap-2"><Plus className="w-4 h-4" />إنشاء مركز طبي (ب)</Button>
              <Button onClick={() => { setTab('departments'); setShowDeptModal(true); }} className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="w-4 h-4" />إنشاء عيادة جديدة (أ)</Button>
              <Button variant="outline" onClick={() => { refreshStatuses(); showMsg('تم تحديث الحالات'); }} className="gap-2"><RefreshCw className="w-4 h-4" />تحديث الحالات</Button>
            </div>
            {/* Summary Cards Only - no details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 border-2 border-teal-200">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-teal-600" />ملخص المراكز الطبية</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-teal-50 rounded-lg">
                    <p className="text-2xl font-bold text-teal-700">{centers.length}</p>
                    <p className="text-xs text-teal-600">إجمالي المراكز</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-700">{centers.filter(c => c.status === 'active').length}</p>
                    <p className="text-xs text-green-600">نشطة</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3 text-center">اذهب لقسم "المراكز الطبية (ب)" للتفاصيل</p>
              </Card>
              <Card className="p-6 border-2 border-blue-200">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5 text-blue-600" />ملsummary العيادات المستقلة</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-700">{departments.filter(d => !d.centerId).length}</p>
                    <p className="text-xs text-blue-600">إجمالي العيادات</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-700">{departments.filter(d => !d.centerId && d.status === 'active').length}</p>
                    <p className="text-xs text-green-600">نشطة</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3 text-center">اذهب لقسم "العيادات (أ)" للتفاصيل</p>
              </Card>
            </div>
          </div>
        )}

        {/* CENTERS TAB - Shows centers with their internal departments */}
        {tab === 'centers' && (
          <div>
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-gray-900">المراكز الطبية (صفحة ب) - {centers.length}</h3><Button onClick={() => setShowCenterModal(true)} className="bg-teal-600 hover:bg-teal-700 gap-2"><Plus className="w-4 h-4" />إنشاء مركز طبي</Button></div>
            <div className="space-y-4">
              {centers.map(c => { const a = getAdminById(c.adminId); const centerDepts = getDepartmentsByCenter(c.id); return (
                <Card key={c.id} className={`p-5 ${c.status === 'expired' ? 'border-red-200 bg-red-50/50' : ''}`}>
                  {/* Center Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-lg font-bold text-gray-900">{c.name}</h4>
                        <Badge className={getStatusColor(c.status)}>{getStatusLabel(c.status)}</Badge>
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">اشتراك مدفوع</Badge>
                        <Badge variant="outline" className="text-xs">{centerDepts.length} قسم</Badge>
                      </div>
                      <div className="flex gap-4 mt-2 text-sm text-gray-500 flex-wrap"><span><MapPin className="w-3 h-3 inline" /> {c.address}</span><span dir="ltr"><Phone className="w-3 h-3 inline" /> {c.phone}</span>{c.email && <span><Mail className="w-3 h-3 inline" /> {c.email}</span>}</div>
                      <div className="flex gap-4 mt-1 text-xs text-gray-400 flex-wrap"><span>المدير: {a?.fullName || '-'}</span><span>الاشتراك: {c.subscriptionPrice.toLocaleString()} د.ع/شهر</span><span>فترة تجريبية: {c.freeTrialDays} يوم</span>{c.status !== 'closed' && <span>متبقي: {getRemainingDays(c.expiresAt)} يوم</span>}</div>
                    </div>
                    <div className="flex gap-2">
                      {c.status !== 'expired' && c.status !== 'closed' && <><Button size="sm" variant="outline" onClick={() => nav(`/center/${c.id}`)}><Eye className="w-4 h-4" /></Button><Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => nav(`/center/${c.id}/booking`)}><ExternalLink className="w-4 h-4" /></Button></>}
                      {c.status !== 'closed' && <><Button size="sm" variant="outline" className="text-amber-600" onClick={() => setRenewTarget({ type: 'center', id: c.id, name: c.name })}><RefreshCw className="w-4 h-4" /></Button><Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => { if (confirm(`إغلاق المركز "${c.name}" وكل أقسامه المرتبطة؟`)) { closeCenter(c.id); showMsg('تم الإغلاق'); } }}><Trash2 className="w-4 h-4" /></Button></>}
                    </div>
                  </div>
                  {/* Center's Internal Departments */}
                  {centerDepts.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm font-semibold text-gray-700 mb-3">أقسام المركز الداخلية:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {centerDepts.map(dept => (
                          <div key={dept.id} className={`p-3 rounded-lg border ${dept.status === 'expired' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">{dept.name}</p>
                                <p className="text-xs text-gray-500">{dept.doctorName || 'بدون طبيب'}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(dept.status) + ' text-xs'}>{getStatusLabel(dept.status)}</Badge>
                                {dept.status !== 'expired' && dept.status !== 'closed' && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => nav(`/center/${c.id}/booking`)}>حجز</Button>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              ); })}
            </div>
          </div>
        )}

        {/* DEPTS TAB - Independent clinics only (no center departments) */}
        {tab === 'departments' && (
          <div>
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-gray-900">العيادات المستقلة (صفحة أ) - {departments.filter(d => !d.centerId).length}</h3><Button onClick={() => setShowDeptModal(true)} className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="w-4 h-4" />إنشاء عيادة جديدة</Button></div>
            {departments.filter(d => !d.centerId).length === 0 ? <Card className="p-8 text-center text-gray-500"><Briefcase className="w-12 h-12 mx-auto text-gray-300 mb-3" /><p>لا يوجد عيادات مستقلة مسجلة</p></Card> : (
              <div className="space-y-3">
                {departments.filter(d => !d.centerId).map(d => { const a = getAdminById(d.adminId); return (
                  <Card key={d.id} className={`p-5 ${d.status === 'expired' ? 'border-red-200 bg-red-50/50' : ''}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-lg font-bold text-gray-900">{d.name}</h4>
                          <Badge className={getStatusColor(d.status)}>{getStatusLabel(d.status)}</Badge>
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200">اشتراك مدفوع</Badge>
                          <Badge variant="outline" className="bg-purple-50 text-purple-700">مستقل</Badge>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{d.description}</p>
                        <div className="flex gap-4 mt-1 text-xs text-gray-400 flex-wrap"><span>المدير: {a?.fullName || '-'}</span><span>الاشتراك: {d.subscriptionPrice.toLocaleString()} د.ع/شهر</span><span>فترة تجريبية: {d.freeTrialDays} يوم</span>{d.status !== 'closed' && <span>متبقي: {getRemainingDays(d.expiresAt)} يوم</span>}</div>
                      </div>
                      <div className="flex gap-2">
                        {d.status !== 'expired' && d.status !== 'closed' && <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => nav(`/dept/${d.id}/booking`)}><ExternalLink className="w-4 h-4" /></Button>}
                        {d.status !== 'closed' && <><Button size="sm" variant="outline" className="text-amber-600" onClick={() => setRenewTarget({ type: 'dept', id: d.id, name: d.name })}><RefreshCw className="w-4 h-4" /></Button><Button size="sm" variant="ghost" className="text-red-500" onClick={() => { if (confirm(`إغلاق العيادة "${d.name}"؟`)) { closeDepartment(d.id); showMsg('تم الإغلاق'); } }}><Trash2 className="w-4 h-4" /></Button></>}
                      </div>
                    </div>
                  </Card>
                ); })}
              </div>
            )}
          </div>
        )}

        {/* PRICING TAB */}
        {tab === 'pricing' && (
          <div className="max-w-2xl space-y-6">
            {/* ===== Global Trial Settings ===== */}
            <Card className="p-6 border-2 border-teal-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-teal-600" />الفترة التجريبية العامة</h3>
              <p className="text-sm text-gray-500 mb-4">
                تحكم في الفترة التجريبية التي تُمنح لكل حساب جديد. عند تفعيلها، يظهر تنبيه للمشتركين الجدد ويحصلون على الأيام المجانية تلقائياً.
              </p>
              
              <div className="space-y-4">
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${(pForm.trial?.enabled ?? pricing.trial?.enabled) ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">تفعيل الفترة التجريبية</p>
                      <p className="text-xs text-gray-500">منح أيام مجانية لكل حساب جديد</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const newEnabled = !(pForm.trial?.enabled ?? pricing.trial?.enabled);
                      setPForm({ 
                        ...pForm, 
                        trial: { 
                          ...(pForm.trial || pricing.trial || { trialDays: 10, showNotice: true, noticeText: '' }), 
                          enabled: newEnabled 
                        } 
                      });
                    }}
                    className={`relative w-14 h-8 rounded-full transition-all ${(pForm.trial?.enabled ?? pricing.trial?.enabled) ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${(pForm.trial?.enabled ?? pricing.trial?.enabled) ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {/* Trial Days */}
                {(pForm.trial?.enabled ?? pricing.trial?.enabled) && (
                  <>
                    <div className="space-y-2">
                      <Label>عدد أيام الفترة التجريبية</Label>
                      <Input 
                        type="number" 
                        min={1} 
                        max={90}
                        value={pForm.trial?.trialDays ?? pricing.trial?.trialDays ?? 10} 
                        onChange={e => setPForm({ 
                          ...pForm, 
                          trial: { 
                            ...(pForm.trial || pricing.trial || { enabled: true, showNotice: true, noticeText: '' }), 
                            trialDays: Number(e.target.value) 
                          } 
                        })} 
                      />
                      <p className="text-xs text-gray-400">عدد الأيام المجانية التي يحصل عليها كل مشترك جديد</p>
                    </div>

                    {/* Preview Notice */}
                    <div className="bg-teal-50 p-4 rounded-xl border border-teal-200">
                      <p className="text-sm font-semibold text-teal-800 mb-2">الملاحظة التي تظهر للمشتركين:</p>
                      <p className="text-sm text-teal-700">
                        <CheckCircle2 className="w-4 h-4 inline ml-1" />
                        سجل اشتراكك اليوم واحصل على {(pForm.trial?.trialDays ?? pricing.trial?.trialDays ?? 10)} أيام مجاناً كفترة تجريبية
                      </p>
                    </div>
                  </>
                )}

                <Button onClick={() => { updatePricing(pForm); showMsg('تم حفظ إعدادات الفترة التجريبية'); }} className="bg-teal-600 hover:bg-teal-700 gap-2">
                  <Save className="w-4 h-4" />حفظ إعدادات الفترة التجريبية
                </Button>
              </div>
            </Card>

            {/* ===== Pricing Settings ===== */}
            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Coins className="w-5 h-5 text-amber-600" />إعدادات أسعار الاشتراكات</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>سعر اشتراك المركز الطبي (ب) شهرياً (د.ع)</Label><Input type="number" value={pForm.platform?.centerMonthlyPrice || pricing.platform.centerMonthlyPrice} onChange={e => setPForm({ ...pForm, platform: { ...(pForm.platform || pricing.platform), centerMonthlyPrice: Number(e.target.value) } })} /></div>
                  <div className="space-y-2"><Label>سعر اشتراك القسم المستقل (أ) شهرياً (د.ع)</Label><Input type="number" value={pForm.platform?.deptMonthlyPrice || pricing.platform.deptMonthlyPrice} onChange={e => setPForm({ ...pForm, platform: { ...(pForm.platform || pricing.platform), deptMonthlyPrice: Number(e.target.value) } })} /></div>
                  <div className="space-y-2"><Label>سعر الظهور الإعلاني الشهري (د.ع)</Label><Input type="number" value={pForm.appearance?.monthlyPrice || pricing.appearance.monthlyPrice} onChange={e => setPForm({ ...pForm, appearance: { ...(pForm.appearance || pricing.appearance), monthlyPrice: Number(e.target.value) } })} /><p className="text-xs text-gray-400">سعر الاشتراك الشهري للظهور</p></div>
                  <div className="space-y-2"><Label>سعر الظهور الإعلاني اليومي (د.ع)</Label><Input type="number" value={pForm.appearance?.dailyPrice || pricing.appearance.dailyPrice || 500} onChange={e => setPForm({ ...pForm, appearance: { ...(pForm.appearance || pricing.appearance), dailyPrice: Number(e.target.value) } })} /><p className="text-xs text-gray-400">سعر الظهور لعدد أيام محدد</p></div>
                  <div className="space-y-2"><Label>فترة تجريبية للظهور (بالأيام)</Label><Input type="number" value={pForm.appearance?.freeTrialDays || pricing.appearance.freeTrialDays} onChange={e => setPForm({ ...pForm, appearance: { ...(pForm.appearance || pricing.appearance), freeTrialDays: Number(e.target.value) } })} /><p className="text-xs text-gray-400">فترة تجريبية مجانية للظهور الإعلاني</p></div>
                </div>
                <Button onClick={() => { updatePricing(pForm); showMsg('تم حفظ الإعدادات'); }} className="bg-amber-600 hover:bg-amber-700 gap-2"><Save className="w-4 h-4" />حفظ الإعدادات</Button>
              </div>
              <Separator className="my-6" />
              <h4 className="font-semibold text-gray-900 mb-3">الأسعار الحالية</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <Card className="p-3 bg-teal-50"><p className="text-sm text-gray-500">مركز طبي (ب)</p><p className="text-xl font-bold text-teal-700">{pricing.platform.centerMonthlyPrice.toLocaleString()}</p><p className="text-xs text-gray-400">د.ع / شهر</p></Card>
                <Card className="p-3 bg-blue-50"><p className="text-sm text-gray-500">قسم مستقل (أ)</p><p className="text-xl font-bold text-blue-700">{pricing.platform.deptMonthlyPrice.toLocaleString()}</p><p className="text-xs text-gray-400">د.ع / شهر</p></Card>
                <Card className="p-3 bg-purple-50"><p className="text-sm text-gray-500">ظهور شهري</p><p className="text-xl font-bold text-purple-700">{pricing.appearance.monthlyPrice.toLocaleString()}</p><p className="text-xs text-gray-400">د.ع / شهر</p></Card>
                <Card className="p-3 bg-pink-50"><p className="text-sm text-gray-500">ظهور يومي</p><p className="text-xl font-bold text-pink-700">{(pricing.appearance.dailyPrice || 500).toLocaleString()}</p><p className="text-xs text-gray-400">د.ع / يوم</p></Card>
              </div>
            </Card>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {tab === 'payments' && (
          <div className="max-w-2xl">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-teal-600" />إدارة طرق الدفع</h3>
            <Card className="p-6">
              <p className="text-sm text-gray-500 mb-4">فعّل أو عطّل طرق الدفع التي تريد عرضها للمستخدمين عند الاشتراك المدفوع</p>
              <div className="space-y-4">
                {paymentMethods.methods.map(m => (
                  <div key={m.id} className={`p-4 rounded-xl border-2 transition-all ${m.enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          m.id === 'mastercard' ? (m.enabled ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-400') :
                          m.id === 'visa' ? (m.enabled ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-400') :
                          m.id === 'zaincash' ? (m.enabled ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-200 text-gray-400') :
                          m.id === 'asia' ? (m.enabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400') :
                          m.id === 'fastpay' ? (m.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400') :
                          m.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'
                        }`}>
                          {m.icon === 'Smartphone' && <Smartphone className="w-5 h-5" />}
                          {m.icon === 'Building2' && <Building2 className="w-5 h-5" />}
                          {m.icon === 'CreditCard' && <CreditCard className="w-5 h-5" />}
                          {m.icon === 'Banknote' && <Banknote className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{m.nameAr}</p>
                          <p className="text-xs text-gray-500">{m.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { togglePaymentMethod(m.id); showMsg(m.enabled ? `تم تعطيل ${m.nameAr}` : `تم تفعيل ${m.nameAr}`); }}
                        className={`relative w-14 h-8 rounded-full transition-all ${m.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${m.enabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    {/* Recipient Details */}
                    <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">اسم صاحب الحساب</Label>
                        <Input className="h-8 text-sm" value={m.recipientName} onChange={e => { const updated = { ...paymentMethods, methods: paymentMethods.methods.map(pm => pm.id === m.id ? { ...pm, recipientName: e.target.value } : pm) }; updatePaymentMethods(updated); }} placeholder="اسم المستلم" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">{m.id === 'bank' ? 'رقم الحساب البنكي' : m.id === 'mastercard' || m.id === 'visa' ? 'رقم البطاقة' : 'رقم المحفظة/الحساب'}</Label>
                        <Input className="h-8 text-sm" value={m.recipientNumber} onChange={e => { const updated = { ...paymentMethods, methods: paymentMethods.methods.map(pm => pm.id === m.id ? { ...pm, recipientNumber: e.target.value } : pm) }; updatePaymentMethods(updated); }} placeholder="الرقم" dir="ltr" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">رقم الهاتف المرتبط</Label>
                        <Input className="h-8 text-sm" value={m.recipientPhone} onChange={e => { const updated = { ...paymentMethods, methods: paymentMethods.methods.map(pm => pm.id === m.id ? { ...pm, recipientPhone: e.target.value } : pm) }; updatePaymentMethods(updated); }} placeholder="07xxxxxxxx" dir="ltr" />
                      </div>
                      {m.id === 'bank' && (
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">اسم البنك</Label>
                          <Input className="h-8 text-sm" value={m.recipientBank} onChange={e => { const updated = { ...paymentMethods, methods: paymentMethods.methods.map(pm => pm.id === m.id ? { ...pm, recipientBank: e.target.value } : pm) }; updatePaymentMethods(updated); }} placeholder="اسم البنك" />
                        </div>
                      )}
                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-xs text-gray-500">تعليمات للمستخدم</Label>
                        <Input className="h-8 text-sm" value={m.instructions} onChange={e => { const updated = { ...paymentMethods, methods: paymentMethods.methods.map(pm => pm.id === m.id ? { ...pm, instructions: e.target.value } : pm) }; updatePaymentMethods(updated); }} placeholder="تعليمات الدفع" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-amber-50 rounded-lg text-sm text-amber-700">
                <p>الطرق المفعلة حالياً: {paymentMethods.methods.filter(m => m.enabled).length} من {paymentMethods.methods.length}</p>
              </div>
            </Card>
          </div>
        )}

        {/* ANNOUNCEMENTS TAB */}
        {tab === 'announcements' && (
          <div className="max-w-2xl">
            <h3 className="font-bold text-gray-900 mb-4" style={{ textAlign: 'center' }}>
              <Mail className="w-5 h-5 inline text-teal-600 ml-2" />
              رسائل المدراء
            </h3>
            <p className="text-sm text-gray-500 mb-4" style={{ textAlign: 'center' }}>
              اكتب رسالة تظهر لمدراء المراكز والعيادات في لوحات تحكمهم. تظهر أعلى الصفحة مع شعار LinkEX.
            </p>
            {/* Create New */}
            <Card className="p-4 mb-6 border-2 border-teal-200 bg-teal-50/30">
              <h4 className="font-bold text-gray-900 mb-3">رسالة جديدة</h4>
              <div className="space-y-3">
                <textarea
                  value={annForm.message}
                  onChange={e => setAnnForm({ ...annForm, message: e.target.value })}
                  placeholder="اكتب رسالتك هنا..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                />
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={annForm.showToAll} onChange={e => setAnnForm({ ...annForm, showToAll: e.target.checked })} />
                    <span>إرسال للجميع</span>
                  </label>
                </div>
                <Button
                  onClick={() => {
                    if (!annForm.message.trim()) return;
                    addAnnouncement({ id: 'ann-' + Date.now(), message: annForm.message, active: true, showToAll: annForm.showToAll, targetAdminIds: [], createdAt: new Date().toISOString() });
                    setAnnForm({ message: '', showToAll: true });
                    showMsg('تم إرسال الرسالة');
                  }}
                  disabled={!annForm.message.trim()}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  <Save className="w-4 h-4" /> إرسال الرسالة
                </Button>
              </div>
            </Card>
            {/* List */}
            {announcements.length === 0 ? (
              <p className="text-center text-gray-400">لا توجد رسائل</p>
            ) : (
              <div className="space-y-3">
                {announcements.map(a => (
                  <Card key={a.id} className={`p-4 ${!a.active ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between">
                      <p className="text-sm text-gray-800 flex-1">{a.message}</p>
                      <div className="flex items-center gap-2">
                        <Badge className={a.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                          {a.active ? 'نشطة' : 'معطلة'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <span>{a.showToAll ? 'للجميع' : 'لمستلمين محددين'}</span>
                      <span>|</span>
                      <span>{new Date(a.createdAt).toLocaleDateString('ar-IQ')}</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" onClick={() => { removeAnnouncement(a.id); showMsg('تم حذف الرسالة'); }}>
                        <Trash2 className="w-3 h-3" /> حذف
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* APPEARANCE TAB - Visibility Settings + Manual Featured */}
        {tab === 'appearance' && (
          <div className="max-w-3xl space-y-6">
            {/* Section 1: Enable/Disable Appearance Feature */}
            <Card className="p-6 border-2 border-purple-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-600" />
                إعدادات الظهور الإعلاني
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                تحكم في ظهور ميزة الاشتراك الإعلاني لعملاء المنصة (مدراء المراكز والعيادات). عند التفعيل، يظهر جدول الظهور الإعلاني في لوحة تحكم العميل.
              </p>

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${appearanceVisibility.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">تفعيل ميزة الظهور الإعلاني</p>
                    <p className="text-xs text-gray-500">إظهار جدول الاشتراك الإعلاني للعملاء</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const newVal = !appearanceVisibility.enabled;
                    updateAppearanceVisibility({ ...appearanceVisibility, enabled: newVal });
                    showMsg(newVal ? 'تم تفعيل الظهور الإعلاني' : 'تم تعطيل الظهور الإعلاني');
                  }}
                  className={`relative w-14 h-8 rounded-full transition-all ${appearanceVisibility.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${appearanceVisibility.enabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* Target Selection */}
              {appearanceVisibility.enabled && (
                <div className="space-y-4">
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <Label className="text-sm font-semibold mb-3 block">مين يشوف ميزة الظهور؟</Label>
                    <div className="flex gap-3">
                      {([
                        { value: 'all' as const, label: 'الكل', desc: 'المراكز والعيادات', icon: Eye },
                        { value: 'centers' as const, label: 'المراكز فقط', desc: 'مراكز طبية فقط', icon: Building2 },
                        { value: 'departments' as const, label: 'العيادات فقط', desc: 'عيادات فقط', icon: Briefcase },
                      ]).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            updateAppearanceVisibility({ ...appearanceVisibility, target: opt.value });
                            showMsg('تم تحديد: ' + opt.label);
                          }}
                          className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${
                            appearanceVisibility.target === opt.value
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <opt.icon className={`w-5 h-5 mx-auto mb-1 ${appearanceVisibility.target === opt.value ? 'text-purple-600' : 'text-gray-400'}`} />
                          <p className="text-sm font-semibold">{opt.label}</p>
                          <p className="text-xs text-gray-500">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Section 2: Manual Featured Display */}
            <Card className="p-6 border-2 border-amber-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-600" />
                إظهار يدوي في الواجهة
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                اختر مركز أو عيادة لإظهارها في واجهة المنصة لمدة محددة. يمكن أن يكون الظهور مجاناً أو مقابل مادي.
              </p>

              {/* Add Featured Form */}
              <div className="space-y-3 bg-amber-50/50 p-4 rounded-lg border border-amber-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">الكيان</Label>
                    <select
                      value={featuredForm.entityId}
                      onChange={e => {
                        const selected = e.target.value;
                        const center = centers.find(c => c.id === selected);
                        const dept = departments.find(d => d.id === selected);
                        setFeaturedForm({
                          ...featuredForm,
                          entityId: selected,
                          entityType: center ? 'center' : 'department',
                          name: center?.name || dept?.name || '',
                        });
                      }}
                      className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm"
                    >
                      <option value="">-- اختر مركز أو عيادة --</option>
                      <optgroup label="المراكز الطبية">
                        {getActiveCenters().map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="العيادات">
                        {getActiveDepartments().map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">النوع</Label>
                    <Input value={featuredForm.entityType === 'center' ? 'مركز طبي' : 'عيادة'} readOnly className="bg-gray-50" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">من تاريخ</Label>
                    <Input type="date" value={featuredForm.startDate} onChange={e => setFeaturedForm({ ...featuredForm, startDate: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">إلى تاريخ</Label>
                    <Input type="date" value={featuredForm.endDate} onChange={e => setFeaturedForm({ ...featuredForm, endDate: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">السعر (د.ع) - 0 للمجاني</Label>
                    <Input type="number" value={featuredForm.price} onChange={e => setFeaturedForm({ ...featuredForm, price: Number(e.target.value), isPaid: Number(e.target.value) > 0 })} />
                  </div>
                  <div className="flex items-end">
                    <Badge className={featuredForm.isPaid ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}>
                      {featuredForm.isPaid ? 'مدفوع' : 'مجاني'}
                    </Badge>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (!featuredForm.entityId || !featuredForm.endDate) {
                      showMsg('اختر كيان وحدد تاريخ النهاية');
                      return;
                    }
                    addFeaturedEntity({
                      id: 'feat-' + Date.now(),
                      entityId: featuredForm.entityId,
                      entityType: featuredForm.entityType,
                      name: featuredForm.name,
                      startDate: new Date(featuredForm.startDate).toISOString(),
                      endDate: new Date(featuredForm.endDate).toISOString(),
                      isPaid: featuredForm.isPaid,
                      price: featuredForm.price,
                      isManual: true,
                      createdAt: new Date().toISOString(),
                    });
                    setFeaturedForm({ entityId: '', entityType: 'center', name: '', startDate: new Date().toISOString().split('T')[0], endDate: '', isPaid: false, price: 0 });
                    showMsg('تم إضافة الظهور اليدوي');
                  }}
                  disabled={!featuredForm.entityId || !featuredForm.endDate}
                  className="bg-amber-600 hover:bg-amber-700 gap-2 w-full"
                >
                  <Star className="w-4 h-4" />
                  إضافة للواجهة
                </Button>
              </div>

              {/* List of Featured Entities */}
              {featuredEntities.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="font-semibold text-sm text-gray-700">الكيانات المُظهرة حالياً:</h4>
                  {featuredEntities.map(fe => {
                    const now = new Date().toISOString();
                    const isActive = fe.startDate <= now && fe.endDate >= now;
                    return (
                      <Card key={fe.id} className={`p-3 ${isActive ? 'border-green-200' : 'border-gray-200 opacity-50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{fe.name}</p>
                              <p className="text-xs text-gray-500">
                                {fe.entityType === 'center' ? 'مركز طبي' : 'عيادة'} |
                                {new Date(fe.startDate).toLocaleDateString('ar-IQ')} - {new Date(fe.endDate).toLocaleDateString('ar-IQ')} |
                                <Badge className={fe.isPaid ? 'bg-amber-100 text-amber-700 text-xs' : 'bg-green-100 text-green-700 text-xs'}>
                                  {fe.isPaid ? fe.price.toLocaleString() + ' د.ع' : 'مجاني'}
                                </Badge>
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => { removeFeaturedEntity(fe.id); showMsg('تم الحذف'); }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* LOGS TAB */}
        {tab === 'logs' && (
          <div>
            <h3 className="font-bold text-gray-900 mb-4">سجل العمليات - {logs.length}</h3>
            {logs.length === 0 ? <Card className="p-8 text-center text-gray-500"><FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" /><p>لا يوجد سجلات</p></Card> : (
              <div className="space-y-2">
                {logs.map(l => (
                  <Card key={l.id} className="p-4 flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${l.action.includes('close') ? 'bg-red-500' : l.action.includes('create') ? 'bg-green-500' : l.action === 'renew_subscription' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    <div className="flex-1"><p className="text-sm font-medium text-gray-900">{l.details}</p><div className="flex items-center gap-3 mt-1 text-xs text-gray-400"><span><User className="w-3 h-3 inline ml-1" />{l.adminName}</span><span><Clock className="w-3 h-3 inline ml-1" />{new Date(l.timestamp).toLocaleString('ar-IQ')}</span></div></div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== CENTER MODAL ===== */}
      {showCenterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowCenterModal(false)}>
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold flex items-center gap-2"><Building2 className="w-5 h-5 text-teal-600" />إنشاء مركز طبي جديد (ب)</h3><Button variant="ghost" size="sm" onClick={() => setShowCenterModal(false)}><X className="w-4 h-4" /></Button></div>
            <div className="space-y-4">
              {/* سعر الاشتراك + فترة تجريبية */}
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold">الاشتراك الشهري</Label>
                  <Badge className="bg-amber-100 text-amber-700">{cForm.subscriptionPrice.toLocaleString()} د.ع/شهر</Badge>
                </div>
                {pricing.trial?.enabled && (
                  <p className="text-xs text-teal-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    سجل اشتراكك اليوم واحصل على {pricing.trial?.trialDays || 10} أيام مجاناً كفترة تجريبية
                  </p>
                )}
              </div>

              <h4 className="font-semibold text-sm bg-gray-50 p-2 rounded">معلومات المركز الطبي</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1 md:col-span-2"><Label className="text-xs">اسم المركز الطبي <span className="text-red-500">*</span></Label><Input value={cForm.name} onChange={e => setCForm({ ...cForm, name: e.target.value })} placeholder="مثال: مركز الشفاء الطبي" /></div>
                <div className="space-y-1 md:col-span-2"><Label className="text-xs">العنوان</Label><Input value={cForm.address} onChange={e => setCForm({ ...cForm, address: e.target.value })} placeholder="عنوان المركز" /></div>
                <div className="space-y-1"><Label className="text-xs">رقم الموبايل <span className="text-red-500">*</span></Label><Input value={cForm.phone} onChange={e => setCForm({ ...cForm, phone: e.target.value })} placeholder="07xxxxxxxx" dir="ltr" /></div>
                <div className="space-y-1"><Label className="text-xs">البريد الإلكتروني</Label><Input value={cForm.email} onChange={e => setCForm({ ...cForm, email: e.target.value })} placeholder="email@example.com" dir="ltr" /></div>
              </div>
              <Separator />
              <h4 className="font-semibold text-sm bg-gray-50 p-2 rounded">مدير المركز الطبي</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">الاسم الكامل</Label><Input value={aForm.fullName} onChange={e => setAForm({ ...aForm, fullName: e.target.value })} placeholder="اسم المدير" /></div>
                <div className="space-y-1"><Label className="text-xs">اسم المستخدم</Label><Input value={aForm.username} onChange={e => setAForm({ ...aForm, username: e.target.value })} placeholder="username" dir="ltr" /></div>
                <div className="space-y-1"><Label className="text-xs">كلمة المرور</Label><Input value={aForm.password} onChange={e => setAForm({ ...aForm, password: e.target.value })} placeholder="••••••" dir="ltr" type="password" /></div>
                <div className="space-y-1"><Label className="text-xs">رقم الموبايل</Label><Input value={aForm.phone} onChange={e => setAForm({ ...aForm, phone: e.target.value })} placeholder="07xxxxxxxx" dir="ltr" /></div>
              </div>
              <Button onClick={createCenter} disabled={!cForm.name || !cForm.phone} className="w-full bg-teal-600 hover:bg-teal-700 gap-2"><Save className="w-4 h-4" />إنشاء المركز الطبي ومديره</Button>
            </div>
          </Card>
        </div>
      )}

      {/* ===== DEPT MODAL ===== */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDeptModal(false)}>
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold flex items-center gap-2"><Briefcase className="w-5 h-5 text-blue-600" />إنشاء عيادة جديد (أ)</h3><Button variant="ghost" size="sm" onClick={() => setShowDeptModal(false)}><X className="w-4 h-4" /></Button></div>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">المركز الطبي التابع <span className="text-gray-400">(اختياري)</span></Label>
                <select value={dForm.centerId} onChange={e => setDForm({ ...dForm, centerId: e.target.value })} className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm">
                  <option value="">-- قسم مستقل (بدون مركز طبي) --</option>
                  {activeCenters.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>

              {/* سعر الاشتراك + فترة تجريبية */}
              {!dForm.centerId && (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">الاشتراك الشهري</Label>
                    <Badge className="bg-amber-100 text-amber-700">{dForm.subscriptionPrice.toLocaleString()} د.ع/شهر</Badge>
                  </div>
                  {pricing.trial?.enabled && (
                    <p className="text-xs text-teal-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      سجل اشتراكك اليوم واحصل على {pricing.trial?.trialDays || 10} أيام مجاناً كفترة تجريبية
                    </p>
                  )}
                </div>
              )}

              <h4 className="font-semibold text-sm bg-gray-50 p-2 rounded">معلومات القسم / التخصص</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1 md:col-span-2"><Label className="text-xs">اسم القسم / التخصص <span className="text-red-500">*</span></Label><Input value={dForm.name} onChange={e => setDForm({ ...dForm, name: e.target.value })} placeholder="مثال: قسم العظام" /></div>
                <div className="space-y-1 md:col-span-2"><Label className="text-xs">الوصف</Label><Input value={dForm.description} onChange={e => setDForm({ ...dForm, description: e.target.value })} placeholder="وصف مختصر" /></div>
                <div className="space-y-1 md:col-span-2"><Label className="text-xs">إيميل الطبيب المسؤول</Label><Input value={dForm.doctorEmail} onChange={e => setDForm({ ...dForm, doctorEmail: e.target.value })} placeholder="doctor@email.com" dir="ltr" /></div>
              </div>
              <Separator />
              <h4 className="font-semibold text-sm bg-gray-50 p-2 rounded">مدير القسم</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">الاسم الكامل</Label><Input value={aForm.fullName} onChange={e => setAForm({ ...aForm, fullName: e.target.value })} placeholder="اسم المدير" /></div>
                <div className="space-y-1"><Label className="text-xs">اسم المستخدم</Label><Input value={aForm.username} onChange={e => setAForm({ ...aForm, username: e.target.value })} placeholder="username" dir="ltr" /></div>
                <div className="space-y-1"><Label className="text-xs">كلمة المرور</Label><Input value={aForm.password} onChange={e => setAForm({ ...aForm, password: e.target.value })} placeholder="••••••" dir="ltr" type="password" /></div>
              </div>
              <Button onClick={createDept} disabled={!dForm.name} className="w-full bg-blue-600 hover:bg-blue-700 gap-2"><Save className="w-4 h-4" />إنشاء القسم ومديره</Button>
            </div>
          </Card>
        </div>
      )}

      {/* ===== CUSTOM PRICING MODAL ===== */}
      {pricingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setPricingTarget(null)}>
          <Card className="w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Coins className="w-5 h-5 text-purple-600" />
              تعديل أسعار "{pricingTarget.name}"
            </h3>
            <div className="space-y-4">
              {/* Platform Pricing */}
              <div className="bg-teal-50 p-4 rounded-xl border border-teal-200">
                <h4 className="font-bold text-teal-800 mb-3">إعدادات رقم (1) - اشتراك المنصة</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">سعر الاشتراك (د.ع/شهر)</Label>
                    <Input type="number" min={0} value={customPrices.platformPrice} onChange={e => setCustomPrices({ ...customPrices, platformPrice: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">فترة تجريبية (أيام)</Label>
                    <Input type="number" min={0} value={customPrices.platformTrial} onChange={e => setCustomPrices({ ...customPrices, platformTrial: Number(e.target.value) })} />
                  </div>
                </div>
                <p className="text-xs text-teal-600 mt-2">السعر العام: {pricing.platform.centerMonthlyPrice.toLocaleString()} د.ع | الفترة العامة: {pricing.trial?.trialDays || 10} يوم</p>
              </div>
              {/* Appearance Pricing */}
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                <h4 className="font-bold text-purple-800 mb-3">إعدادات رقم (2) - الظهور الإعلاني</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">سعر الظهور (د.ع/شهر)</Label>
                    <Input type="number" min={0} value={customPrices.appearancePrice} onChange={e => setCustomPrices({ ...customPrices, appearancePrice: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">فترة تجريبية (أيام)</Label>
                    <Input type="number" min={0} value={customPrices.appearanceTrial} onChange={e => setCustomPrices({ ...customPrices, appearanceTrial: Number(e.target.value) })} />
                  </div>
                </div>
                <p className="text-xs text-purple-600 mt-2">السعر العام: {pricing.appearance.monthlyPrice.toLocaleString()} د.ع | الفترة العامة: {pricing.appearance.freeTrialDays} يوم</p>
              </div>
              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setPricingTarget(null)}>إلغاء</Button>
                <Button className="flex-1 bg-purple-600 hover:bg-purple-700 gap-2" onClick={() => {
                  if (pricingTarget.type === 'center') {
                    const target = centers.find(c => c.id === pricingTarget.id);
                    if (target) { const updated: Center = { ...target, customPlatformPrice: customPrices.platformPrice, customPlatformTrial: customPrices.platformTrial, customAppearancePrice: customPrices.appearancePrice, customAppearanceTrial: customPrices.appearanceTrial }; saveCenter(updated); showMsg('تم تحديث الأسعار المخصصة'); }
                  } else {
                    const target = departments.find(d => d.id === pricingTarget.id);
                    if (target) { const updated: Department = { ...target, customPlatformPrice: customPrices.platformPrice, customPlatformTrial: customPrices.platformTrial, customAppearancePrice: customPrices.appearancePrice, customAppearanceTrial: customPrices.appearanceTrial }; saveDepartment(updated); showMsg('تم تحديث الأسعار المخصصة'); }
                  }
                  setPricingTarget(null);
                }}>
                  <Save className="w-4 h-4" />حفظ الأسعار
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ===== RENEW MODAL ===== */}
      {renewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setRenewTarget(null)}>
          <Card className="w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><RefreshCw className="w-5 h-5 text-amber-600" />تجديد الاشتراك المدفوع</h3>
            <p className="text-sm text-gray-500 mb-4">تجديد اشتراك "{renewTarget.name}"</p>
            <div className="space-y-3">
              <div className="space-y-1"><Label>عدد الأشهر</Label><Input type="number" min={1} max={12} value={renewMonths} onChange={e => setRenewMonths(Number(e.target.value))} /></div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <p className="text-sm text-gray-500">المبلغ الإجمالي</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(((renewTarget.type === 'center' ? centers.find(c => c.id === renewTarget.id)?.subscriptionPrice : departments.find(d => d.id === renewTarget.id)?.subscriptionPrice) || 0) * renewMonths).toLocaleString()} د.ع
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setRenewTarget(null)}>إلغاء</Button>
                <Button className="flex-1 bg-amber-600 hover:bg-amber-700 gap-2" onClick={handleRenew}><RefreshCw className="w-4 h-4" />تأكيد التجديد</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}