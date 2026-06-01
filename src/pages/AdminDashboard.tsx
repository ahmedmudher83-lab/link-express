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
  DollarSign, Shield, ToggleLeft, ToggleRight, CreditCard, Smartphone, Banknote
} from 'lucide-react';

type Tab = 'overview' | 'centers' | 'departments' | 'pricing' | 'payments' | 'announcements' | 'logs';

export default function AdminDashboard() {
  const { auth, login, logout, addAdmin, getAdminById } = useAuth();
  const {
    centers, departments, logs, pricing,
    addCenter, closeCenter, addDepartment, closeDepartment,
    updatePricing, renewCenter, renewDepartment,
    getCenterById, getDepartmentsByCenter,
    getActiveCenters, getActiveDepartments,
    addLog, refreshStatuses,
    paymentMethods, togglePaymentMethod, updatePaymentMethods,
    announcements, addAnnouncement, removeAnnouncement,
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
    freeTrialDays: pricing.platform.freeTrialDays,
  });

  // Department form
  const [dForm, setDForm] = useState({
    name: '', description: '', icon: 'Stethoscope', doctorEmail: '', centerId: '',
    activationType: 'paid' as ActivationType,
    subscriptionPrice: pricing.platform.deptMonthlyPrice,
    freeTrialDays: pricing.platform.freeTrialDays,
  });

  // Admin form
  const [aForm, setAForm] = useState({ fullName: '', username: '', password: '', phone: '', email: '' });

  // Pricing form
  const [pForm, setPForm] = useState({ ...pricing });
  const [annForm, setAnnForm] = useState({ message: '', showToAll: true });
  const [renewMonths, setRenewMonths] = useState(1);

  // Stats
  const activeCenters = getActiveCenters();
  const activeDepts = getActiveDepartments();
  const totalRevenue = centers.reduce((s, c) => s + (c.isPaid ? c.subscriptionPrice : 0), 0) + departments.filter(d => !d.centerId).reduce((s, d) => s + (d.isPaid ? d.subscriptionPrice : 0), 0);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(loginForm.username, loginForm.password);
    if (success) { setLoginForm({ username: '', password: '', showPass: false, error: '' }); showMsg('تم تسجيل الدخول'); }
    else setLoginForm(p => ({ ...p, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }));
  };

  const createCenter = () => {
    if (!cForm.name || !cForm.phone) return;
    const aid = 'admin-' + Date.now();
    addAdmin({ id: aid, fullName: aForm.fullName || 'أدمن ' + cForm.name, username: aForm.username || 'admin_' + Date.now().toString(36).slice(-6), password: aForm.password || '123456', role: 'center', phone: aForm.phone || cForm.phone, email: aForm.email || cForm.email, isActive: true, createdAt: new Date().toISOString() });

    const center: Center = { id: 'center-' + Date.now(), name: cForm.name, address: cForm.address, phone: cForm.phone, email: cForm.email, logo: '', workingDays: cForm.workingDays, workingHours: cForm.workingHours, fridayHours: cForm.fridayHours, emergencyHours: cForm.emergencyHours, consultationDuration: 15, doctors: [], adminId: aid, activationType: cForm.activationType, subscriptionPrice: cForm.activationType === 'free' ? 0 : cForm.subscriptionPrice, freeTrialDays: cForm.freeTrialDays, createdAt: new Date().toISOString(), expiresAt: '', isPaid: cForm.activationType === 'free', isActive: true, status: 'active', appearanceType: 'free_trial', appearanceExpiry: new Date(Date.now() + 7 * 86400000).toISOString(), promoImages: [], promoText: '' };
    addCenter(center);
    addLog({ id: 'log-' + Date.now(), action: 'create_center', adminName: auth.admin?.fullName || '', targetName: center.name, timestamp: new Date().toISOString(), details: `إنشاء مركز "${center.name}" - ${getActivationLabel(center.activationType)}${center.activationType === 'paid' ? ` - ${center.subscriptionPrice.toLocaleString()} د.ع/شهر` : ''}` });
    setShowCenterModal(false);
    setCForm({ name: '', address: '', phone: '', email: '', workingDays: 'السبت - الخميس', workingHours: '8:00 ص - 10:00 م', fridayHours: '4:00 م - 9:00 م', emergencyHours: '24 ساعة', activationType: 'paid', subscriptionPrice: pricing.platform.centerMonthlyPrice, freeTrialDays: pricing.platform.freeTrialDays });
    setAForm({ fullName: '', username: '', password: '', phone: '', email: '' });
    showMsg('تم إنشاء المركز الطبي بنجاح');
  };

  const createDept = () => {
    if (!dForm.name) return;
    const aid = 'admin-' + Date.now();
    addAdmin({ id: aid, fullName: aForm.fullName || 'أدمن ' + dForm.name, username: aForm.username || 'admin_' + Date.now().toString(36).slice(-6), password: aForm.password || '123456', role: 'department', phone: aForm.phone || '', email: aForm.email || dForm.doctorEmail, isActive: true, createdAt: new Date().toISOString() });

    const dept: Department = { id: 'dept-' + Date.now(), name: dForm.name, description: dForm.description, icon: dForm.icon, doctorName: '', doctorEmail: dForm.doctorEmail, doctorPhone: '', logo: '', workingDays: 'السبت - الخميس', workingHours: '8:00 ص - 10:00 م', fridayHours: '4:00 م - 9:00 م', consultationDuration: 15, centerId: dForm.centerId || null, adminId: aid, activationType: dForm.activationType, subscriptionPrice: dForm.activationType === 'free' ? 0 : dForm.subscriptionPrice, freeTrialDays: dForm.freeTrialDays, createdAt: new Date().toISOString(), expiresAt: '', isPaid: dForm.activationType === 'free', isActive: true, status: 'active', appearanceType: 'free_trial', appearanceExpiry: new Date(Date.now() + 7 * 86400000).toISOString(), promoImages: [], promoText: '' };
    addDepartment(dept);
    const parent = dept.centerId ? centers.find(c => c.id === dept.centerId)?.name : 'مستقل';
    addLog({ id: 'log-' + Date.now(), action: 'create_department', adminName: auth.admin?.fullName || '', targetName: dept.name, timestamp: new Date().toISOString(), details: `إنشاء عيادة "${dept.name}" (${parent}) - ${getActivationLabel(dept.activationType)}` });
    setShowDeptModal(false);
    setDForm({ name: '', description: '', icon: 'Stethoscope', doctorEmail: '', centerId: '', activationType: 'paid', subscriptionPrice: pricing.platform.deptMonthlyPrice, freeTrialDays: pricing.platform.freeTrialDays });
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
  <img src="/assets/linex-logo.jpg" alt="Link Express" className="h-44 md:h-52 w-auto mx-auto object-contain drop-shadow-2xl" style={{ maxWidth: '90%' }} />
</div>
          <h1 className="text-3xl font-bold text-white tracking-wide">Link Express</h1>
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
            <img src="/assets/linex-logo.jpg" alt="LinkEX" className="h-9 w-auto rounded bg-white px-1 py-0.5" />
            <div><span className="font-bold text-gray-900">Link Express</span><span className="text-xs text-gray-500 block">لوحة التحكم العامة</span></div>
          </div>
          <div className="flex items-center gap-3">
            {msg && <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-lg flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />{msg}</span>}
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg"><Shield className="w-4 h-4" /><span>{auth.admin?.fullName}</span><Badge variant="secondary" className="text-xs">{auth.admin?.role === 'super' ? 'مدير عام' : 'أدمن'}</Badge></div>
            <Button variant="ghost" size="sm" onClick={async () => { await logout(); }} className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1"><LogOut className="w-4 h-4" /><span className="hidden sm:inline">خروج</span></Button>
          </div>
        </div>
      </header>

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
          {([{ id: 'overview', label: 'نظرة عامة', icon: Star }, { id: 'centers', label: 'المراكز الطبية (ب)', icon: Building2 }, { id: 'departments', label: 'العيادات (أ)', icon: Briefcase }, { id: 'pricing', label: 'أسعار الاشتراكات', icon: Coins }, { id: 'payments', label: 'طرق الدفع', icon: CreditCard }, { id: 'announcements', label: 'رسائل المدراء', icon: Mail }, { id: 'logs', label: 'سجل العمليات', icon: FileText }] as const).map(t => (
            <Button key={t.id} variant={tab === t.id ? 'default' : 'outline'} onClick={() => setTab(t.id as Tab)} className={tab === t.id ? 'bg-teal-600 hover:bg-teal-700 gap-2' : 'gap-2'}><t.icon className="w-4 h-4" />{t.label}</Button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="flex gap-3 flex-wrap">
              <Button onClick={() => setShowCenterModal(true)} className="bg-teal-600 hover:bg-teal-700 gap-2"><Plus className="w-4 h-4" />إنشاء مركز طبي (ب)</Button>
              <Button onClick={() => setShowDeptModal(true)} className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="w-4 h-4" />إنشاء عيادة جديدة (أ)</Button>
              <Button variant="outline" onClick={() => { refreshStatuses(); showMsg('تم تحديث الحالات'); }} className="gap-2"><RefreshCw className="w-4 h-4" />تحديث الحالات</Button>
            </div>
            {/* Centers */}
            <div>
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Building2 className="w-5 h-5 text-teal-600" />المراكز الطبية</h3>
              {centers.length === 0 ? <Card className="p-8 text-center text-gray-500"><Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" /><p>لا يوجد مراكز طبية مسجلة</p></Card> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {centers.map(c => { const a = getAdminById(c.adminId); const rem = getRemainingDays(c.expiresAt); return (
                    <Card key={c.id} className={`p-4 border-2 ${c.status === 'expired' ? 'border-red-200 bg-red-50' : 'hover:shadow-lg border-transparent hover:border-teal-200'} transition-all`}>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-gray-900">{c.name}</h4>
                        <Badge className={getStatusColor(c.status)}>{getStatusLabel(c.status)}</Badge>
                      </div>
                      <Badge className={getActivationBadge(c.activationType) + ' mb-1'}>{getActivationLabel(c.activationType)}</Badge>
                      <p className="text-sm text-gray-500"><Phone className="w-3 h-3 inline ml-1" />{c.phone}</p>
                      <p className="text-xs text-gray-400 mt-1">المدير: {a?.fullName || '-'} | {c.activationType === 'paid' ? c.subscriptionPrice.toLocaleString() + ' د.ع/شهر' : 'مجاني'}{rem > 0 && c.status !== 'closed' ? ` | متبقي ${rem} يوم` : ''}</p>
                      <div className="flex gap-2 mt-3">
                        {c.status !== 'expired' && c.status !== 'closed' && (<div className="flex gap-2"><Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => nav(`/center/${c.id}`)}><Eye className="w-3 h-3" /> عرض</Button><Button size="sm" className="gap-1 text-xs bg-teal-600 hover:bg-teal-700" onClick={() => nav(`/center/${c.id}/booking`)}><ExternalLink className="w-3 h-3" /> صفحة الحجز</Button></div>)}
                        {c.status !== 'closed' && (<div className="flex gap-2"><Button size="sm" variant="outline" className="gap-1 text-xs text-purple-600" onClick={() => { setPricingTarget({ type: 'center', id: c.id, name: c.name }); setCustomPrices({ platformPrice: c.customPlatformPrice || c.subscriptionPrice, platformTrial: c.customPlatformTrial || c.freeTrialDays, appearancePrice: c.customAppearancePrice || pricing.appearance.monthlyPrice, appearanceTrial: c.customAppearanceTrial || pricing.appearance.freeTrialDays }); }}><Coins className="w-3 h-3" /> تعديل الأسعار</Button>{c.activationType === 'paid' && <Button size="sm" variant="outline" className="gap-1 text-xs text-amber-600" onClick={() => setRenewTarget({ type: 'center', id: c.id, name: c.name })}><RefreshCw className="w-3 h-3" /> تجديد</Button>}<Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => { if (confirm(`إغلاق المركز "${c.name}" وكل أقسامه؟`)) { closeCenter(c.id); showMsg('تم الإغلاق'); } }}><Trash2 className="w-4 h-4" /></Button></div>)}
                      </div>
                    </Card>
                  ); })}
                </div>
              )}
            </div>
            {/* Depts */}
            <div>
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Briefcase className="w-5 h-5 text-blue-600" />العيادات</h3>
              {departments.length === 0 ? <Card className="p-8 text-center text-gray-500"><Briefcase className="w-12 h-12 mx-auto text-gray-300 mb-3" /><p>لا يوجد أقسام مسجلة</p></Card> : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {departments.map(d => { const a = getAdminById(d.adminId); const p = d.centerId ? getCenterById(d.centerId) : null; const rem = getRemainingDays(d.expiresAt); return (
                    <Card key={d.id} className={`p-4 border-2 ${d.status === 'expired' ? 'border-red-200 bg-red-50' : 'hover:shadow-lg border-transparent hover:border-blue-200'} transition-all`}>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-gray-900">{d.name}</h4>
                        <Badge className={getStatusColor(d.status)}>{getStatusLabel(d.status)}</Badge>
                      </div>
                      <Badge className={getActivationBadge(d.activationType) + ' mb-1'}>{getActivationLabel(d.activationType)}</Badge>
                      {p && <p className="text-xs text-blue-600">تابع لمركز: {p.name}</p>}
                      {!p && <p className="text-xs text-purple-600">قسم مستقل</p>}
                      <p className="text-sm text-gray-500">{d.description}</p>
                      <p className="text-xs text-gray-400 mt-1">المدير: {a?.fullName || '-'} | {d.activationType === 'paid' ? d.subscriptionPrice.toLocaleString() + ' د.ع/شهر' : 'مجاني'}{rem > 0 && d.status !== 'closed' ? ` | متبقي ${rem} يوم` : ''}</p>
                      <div className="flex gap-2 mt-3">
                        {d.status !== 'expired' && d.status !== 'closed' && <Button size="sm" className="gap-1 text-xs bg-teal-600 hover:bg-teal-700" onClick={() => d.centerId ? nav(`/center/${d.centerId}/booking`) : nav(`/dept/${d.id}/booking`)}><ExternalLink className="w-3 h-3" /> فتح صفحة الحجز</Button>}
                        {d.status !== 'closed' && (<div className="flex gap-2"><Button size="sm" variant="outline" className="gap-1 text-xs text-purple-600" onClick={() => { setPricingTarget({ type: 'dept', id: d.id, name: d.name }); setCustomPrices({ platformPrice: d.customPlatformPrice || d.subscriptionPrice, platformTrial: d.customPlatformTrial || d.freeTrialDays, appearancePrice: d.customAppearancePrice || pricing.appearance.monthlyPrice, appearanceTrial: d.customAppearanceTrial || pricing.appearance.freeTrialDays }); }}><Coins className="w-3 h-3" /> تعديل الأسعار</Button>{d.activationType === 'paid' && <Button size="sm" variant="outline" className="gap-1 text-xs text-amber-600" onClick={() => setRenewTarget({ type: 'dept', id: d.id, name: d.name })}><RefreshCw className="w-3 h-3" /> تجديد</Button>}<Button size="sm" variant="ghost" className="text-red-500" onClick={() => { if (confirm(`إغلاق القسم "${d.name}"؟`)) { closeDepartment(d.id); showMsg('تم الإغلاق'); } }}><Trash2 className="w-4 h-4" /></Button></div>)}
                      </div>
                    </Card>
                  ); })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CENTERS TAB */}
        {tab === 'centers' && (
          <div>
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-gray-900">المراكز الطبية (صفحة ب) - {centers.length}</h3><Button onClick={() => setShowCenterModal(true)} className="bg-teal-600 hover:bg-teal-700 gap-2"><Plus className="w-4 h-4" />إنشاء مركز طبي</Button></div>
            <div className="space-y-3">
              {centers.map(c => { const a = getAdminById(c.adminId); const dc = getDepartmentsByCenter(c.id).length; return (
                <Card key={c.id} className={`p-5 ${c.status === 'expired' ? 'border-red-200 bg-red-50/50' : ''}`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-lg font-bold text-gray-900">{c.name}</h4>
                        <Badge className={getStatusColor(c.status)}>{getStatusLabel(c.status)}</Badge>
                        <Badge className={getActivationBadge(c.activationType)}>{getActivationLabel(c.activationType)}</Badge>
                        <Badge variant="outline" className="text-xs">{dc} قسم</Badge>
                      </div>
                      <div className="flex gap-4 mt-2 text-sm text-gray-500 flex-wrap"><span><MapPin className="w-3 h-3 inline" /> {c.address}</span><span dir="ltr"><Phone className="w-3 h-3 inline" /> {c.phone}</span>{c.email && <span><Mail className="w-3 h-3 inline" /> {c.email}</span>}</div>
                      <div className="flex gap-4 mt-1 text-xs text-gray-400 flex-wrap"><span>المدير: {a?.fullName || '-'}</span><span>الاشتراك: {c.activationType === 'paid' ? c.subscriptionPrice.toLocaleString() + ' د.ع/شهر' : 'مجاني'}</span><span>فترة تجريبية: {c.freeTrialDays} يوم</span>{c.status !== 'closed' && <span>متبقي: {getRemainingDays(c.expiresAt)} يوم</span>}</div>
                    </div>
                    <div className="flex gap-2">
                      {c.status !== 'expired' && c.status !== 'closed' && <Button size="sm" variant="outline" onClick={() => nav(`/center/${c.id}`)}><Eye className="w-4 h-4" /></Button>}
                      {c.status !== 'closed' && <>{c.activationType === 'paid' && <Button size="sm" variant="outline" className="text-amber-600" onClick={() => setRenewTarget({ type: 'center', id: c.id, name: c.name })}><RefreshCw className="w-4 h-4" /></Button>}<Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => { if (confirm(`إغلاق المركز "${c.name}" وكل أقسامه المرتبطة؟`)) { closeCenter(c.id); showMsg('تم الإغلاق'); } }}><Trash2 className="w-4 h-4" /></Button></>}
                    </div>
                  </div>
                </Card>
              ); })}
            </div>
          </div>
        )}

        {/* DEPTS TAB */}
        {tab === 'departments' && (
          <div>
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-gray-900">العيادات (صفحة أ) - {departments.length}</h3><Button onClick={() => setShowDeptModal(true)} className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="w-4 h-4" />إنشاء عيادة جديدة</Button></div>
            <div className="space-y-3">
              {departments.map(d => { const a = getAdminById(d.adminId); const p = d.centerId ? getCenterById(d.centerId) : null; return (
                <Card key={d.id} className={`p-5 ${d.status === 'expired' ? 'border-red-200 bg-red-50/50' : ''}`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-lg font-bold text-gray-900">{d.name}</h4>
                        <Badge className={getStatusColor(d.status)}>{getStatusLabel(d.status)}</Badge>
                        <Badge className={getActivationBadge(d.activationType)}>{getActivationLabel(d.activationType)}</Badge>
                        {p ? <Badge variant="outline" className="bg-blue-50 text-blue-700">{p.name}</Badge> : <Badge variant="outline" className="bg-purple-50 text-purple-700">مستقل</Badge>}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{d.description}</p>
                      <div className="flex gap-4 mt-1 text-xs text-gray-400 flex-wrap"><span>المدير: {a?.fullName || '-'}</span><span>الاشتراك: {d.activationType === 'paid' ? d.subscriptionPrice.toLocaleString() + ' د.ع/شهر' : 'مجاني'}</span><span>فترة تجريبية: {d.freeTrialDays} يوم</span>{d.status !== 'closed' && <span>متبقي: {getRemainingDays(d.expiresAt)} يوم</span>}</div>
                    </div>
                    <div className="flex gap-2">
                      {d.status !== 'expired' && d.status !== 'closed' && <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => d.centerId ? nav(`/center/${d.centerId}/booking`) : nav(`/dept/${d.id}/booking`)}><ExternalLink className="w-4 h-4" /></Button>}
                      {d.status !== 'closed' && <>{d.activationType === 'paid' && <Button size="sm" variant="outline" className="text-amber-600" onClick={() => setRenewTarget({ type: 'dept', id: d.id, name: d.name })}><RefreshCw className="w-4 h-4" /></Button>}<Button size="sm" variant="ghost" className="text-red-500" onClick={() => { if (confirm(`إغلاق القسم "${d.name}"؟`)) { closeDepartment(d.id); showMsg('تم الإغلاق'); } }}><Trash2 className="w-4 h-4" /></Button></>}
                    </div>
                  </div>
                </Card>
              ); })}
            </div>
          </div>
        )}

        {/* PRICING TAB */}
        {tab === 'pricing' && (
          <div className="max-w-2xl">
            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Coins className="w-5 h-5 text-amber-600" />إعدادات أسعار الاشتراكات</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>سعر اشتراك المركز الطبي (ب) شهرياً (د.ع)</Label><Input type="number" value={pForm.platform?.centerMonthlyPrice || pricing.platform.centerMonthlyPrice} onChange={e => setPForm({ ...pForm, platform: { ...(pForm.platform || pricing.platform), centerMonthlyPrice: Number(e.target.value) } })} /></div>
                  <div className="space-y-2"><Label>سعر اشتراك القسم المستقل (أ) شهرياً (د.ع)</Label><Input type="number" value={pForm.platform?.deptMonthlyPrice || pricing.platform.deptMonthlyPrice} onChange={e => setPForm({ ...pForm, platform: { ...(pForm.platform || pricing.platform), deptMonthlyPrice: Number(e.target.value) } })} /></div>
                  <div className="space-y-2"><Label>فترة تجريبية للمنصة (بالأيام)</Label><Input type="number" value={pForm.platform?.freeTrialDays || pricing.platform.freeTrialDays} onChange={e => setPForm({ ...pForm, platform: { ...(pForm.platform || pricing.platform), freeTrialDays: Number(e.target.value) } })} /><p className="text-xs text-gray-400">فترة تجريبية للاشتراك في المنصة</p></div>
                  <div className="space-y-2"><Label>سعر الظهور الإعلاني الشهري (د.ع)</Label><Input type="number" value={pForm.appearance?.monthlyPrice || pricing.appearance.monthlyPrice} onChange={e => setPForm({ ...pForm, appearance: { ...(pForm.appearance || pricing.appearance), monthlyPrice: Number(e.target.value) } })} /><p className="text-xs text-gray-400">سعر الظهور في الصفحة الرئيسية</p></div>
                  <div className="space-y-2"><Label>فترة تجريبية للظهور (بالأيام)</Label><Input type="number" value={pForm.appearance?.freeTrialDays || pricing.appearance.freeTrialDays} onChange={e => setPForm({ ...pForm, appearance: { ...(pForm.appearance || pricing.appearance), freeTrialDays: Number(e.target.value) } })} /><p className="text-xs text-gray-400">فترة تجريبية مجانية للظهور الإعلاني</p></div>
                </div>
                <Button onClick={() => { updatePricing(pForm); showMsg('تم حفظ الإعدادات'); }} className="bg-amber-600 hover:bg-amber-700 gap-2"><Save className="w-4 h-4" />حفظ الإعدادات</Button>
              </div>
              <Separator className="my-6" />
              <h4 className="font-semibold text-gray-900 mb-3">الأسعار الحالية</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <Card className="p-3 bg-teal-50"><p className="text-sm text-gray-500">مركز طبي (ب)</p><p className="text-xl font-bold text-teal-700">{pricing.platform.centerMonthlyPrice.toLocaleString()}</p><p className="text-xs text-gray-400">د.ع / شهر</p></Card>
                <Card className="p-3 bg-blue-50"><p className="text-sm text-gray-500">قسم مستقل (أ)</p><p className="text-xl font-bold text-blue-700">{pricing.platform.deptMonthlyPrice.toLocaleString()}</p><p className="text-xs text-gray-400">د.ع / شهر</p></Card>
                <Card className="p-3 bg-purple-50"><p className="text-sm text-gray-500">ظهور إعلاني</p><p className="text-xl font-bold text-purple-700">{pricing.appearance.monthlyPrice.toLocaleString()}</p><p className="text-xs text-gray-400">د.ع / شهر</p></Card>
                <Card className="p-3 bg-amber-50"><p className="text-sm text-gray-500">تجربة منصة</p><p className="text-xl font-bold text-amber-700">{pricing.platform.freeTrialDays}</p><p className="text-xs text-gray-400">يوم</p></Card>
                <Card className="p-3 bg-pink-50"><p className="text-sm text-gray-500">تجربة ظهور</p><p className="text-xl font-bold text-pink-700">{pricing.appearance.freeTrialDays}</p><p className="text-xs text-gray-400">يوم</p></Card>
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
              اكتب رسالة تظهر لمدراء المراكز والعيادات في لوحات تحكمهم. تظهر أعلى الصفحة مع شعار Link Express.
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
              {/* نوع التفعيل */}
              <div className="bg-gray-50 p-3 rounded-lg"><Label className="text-sm font-semibold mb-2 block">نوع التفعيل</Label>
                <div className="flex gap-3">
                  <button onClick={() => setCForm({ ...cForm, activationType: 'free' })} className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${cForm.activationType === 'free' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                    <ToggleLeft className={`w-6 h-6 mx-auto mb-1 ${cForm.activationType === 'free' ? 'text-purple-600' : 'text-gray-400'}`} />
                    <p className="text-sm font-semibold">مجاني</p>
                    <p className="text-xs text-gray-500">بدون اشتراك شهري</p>
                  </button>
                  <button onClick={() => setCForm({ ...cForm, activationType: 'paid' })} className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${cForm.activationType === 'paid' ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}>
                    <ToggleRight className={`w-6 h-6 mx-auto mb-1 ${cForm.activationType === 'paid' ? 'text-amber-600' : 'text-gray-400'}`} />
                    <p className="text-sm font-semibold">مدفوع</p>
                    <p className="text-xs text-gray-500">اشتراك شهري</p>
                  </button>
                </div>
              </div>

              <h4 className="font-semibold text-sm bg-gray-50 p-2 rounded">معلومات المركز الطبي</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1 md:col-span-2"><Label className="text-xs">اسم المركز الطبي <span className="text-red-500">*</span></Label><Input value={cForm.name} onChange={e => setCForm({ ...cForm, name: e.target.value })} placeholder="مثال: مركز الشفاء الطبي" /></div>
                <div className="space-y-1 md:col-span-2"><Label className="text-xs">العنوان</Label><Input value={cForm.address} onChange={e => setCForm({ ...cForm, address: e.target.value })} placeholder="عنوان المركز" /></div>
                <div className="space-y-1"><Label className="text-xs">رقم الموبايل <span className="text-red-500">*</span></Label><Input value={cForm.phone} onChange={e => setCForm({ ...cForm, phone: e.target.value })} placeholder="07xxxxxxxx" dir="ltr" /></div>
                <div className="space-y-1"><Label className="text-xs">البريد الإلكتروني</Label><Input value={cForm.email} onChange={e => setCForm({ ...cForm, email: e.target.value })} placeholder="email@example.com" dir="ltr" /></div>
              </div>
              {cForm.activationType === 'paid' && <>
                <h4 className="font-semibold text-sm bg-gray-50 p-2 rounded">إعدادات الاشتراك المدفوع</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">السعر الشهري (د.ع)</Label><Input type="number" value={cForm.subscriptionPrice} onChange={e => setCForm({ ...cForm, subscriptionPrice: Number(e.target.value) })} /></div>
                  <div className="space-y-1"><Label className="text-xs">فترة تجريبية (أيام)</Label><Input type="number" value={cForm.freeTrialDays} onChange={e => setCForm({ ...cForm, freeTrialDays: Number(e.target.value) })} /></div>
                </div>
              </>}
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

              {/* نوع التفعيل */}
              {!dForm.centerId && (
                <div className="bg-gray-50 p-3 rounded-lg"><Label className="text-sm font-semibold mb-2 block">نوع التفعيل</Label>
                  <div className="flex gap-3">
                    <button onClick={() => setDForm({ ...dForm, activationType: 'free' })} className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${dForm.activationType === 'free' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                      <ToggleLeft className={`w-6 h-6 mx-auto mb-1 ${dForm.activationType === 'free' ? 'text-purple-600' : 'text-gray-400'}`} />
                      <p className="text-sm font-semibold">مجاني</p>
                      <p className="text-xs text-gray-500">بدون اشتراك شهري</p>
                    </button>
                    <button onClick={() => setDForm({ ...dForm, activationType: 'paid' })} className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${dForm.activationType === 'paid' ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}>
                      <ToggleRight className={`w-6 h-6 mx-auto mb-1 ${dForm.activationType === 'paid' ? 'text-amber-600' : 'text-gray-400'}`} />
                      <p className="text-sm font-semibold">مدفوع</p>
                      <p className="text-xs text-gray-500">اشتراك شهري</p>
                    </button>
                  </div>
                </div>
              )}

              <h4 className="font-semibold text-sm bg-gray-50 p-2 rounded">معلومات القسم / التخصص</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1 md:col-span-2"><Label className="text-xs">اسم القسم / التخصص <span className="text-red-500">*</span></Label><Input value={dForm.name} onChange={e => setDForm({ ...dForm, name: e.target.value })} placeholder="مثال: قسم العظام" /></div>
                <div className="space-y-1 md:col-span-2"><Label className="text-xs">الوصف</Label><Input value={dForm.description} onChange={e => setDForm({ ...dForm, description: e.target.value })} placeholder="وصف مختصر" /></div>
                <div className="space-y-1 md:col-span-2"><Label className="text-xs">إيميل الطبيب المسؤول</Label><Input value={dForm.doctorEmail} onChange={e => setDForm({ ...dForm, doctorEmail: e.target.value })} placeholder="doctor@email.com" dir="ltr" /></div>
              </div>
              {dForm.activationType === 'paid' && !dForm.centerId && <>
                <h4 className="font-semibold text-sm bg-gray-50 p-2 rounded">إعدادات الاشتراك المدفوع</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">السعر الشهري (د.ع)</Label><Input type="number" value={dForm.subscriptionPrice} onChange={e => setDForm({ ...dForm, subscriptionPrice: Number(e.target.value) })} /></div>
                  <div className="space-y-1"><Label className="text-xs">فترة تجريبية (أيام)</Label><Input type="number" value={dForm.freeTrialDays} onChange={e => setDForm({ ...dForm, freeTrialDays: Number(e.target.value) })} /></div>
                </div>
              </>}
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
                <p className="text-xs text-teal-600 mt-2">السعر العام: {pricing.platform.centerMonthlyPrice.toLocaleString()} د.ع | الفترة العامة: {pricing.platform.freeTrialDays} يوم</p>
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
