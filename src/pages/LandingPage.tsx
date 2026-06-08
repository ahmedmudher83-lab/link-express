import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useLinexData } from '@/hooks/useLinexData';
import { saveAdmin, saveCenter, saveDepartment } from '@/services/dataStorage';
import type { Center, Department, Admin } from '@/types/linex';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Lock, Plus, Phone, Mail, ExternalLink, CalendarDays,
  X, CheckCircle2, Stethoscope, Building2, Clock, MapPin,
  User, Shield
} from 'lucide-react';

const ADMIN = { fullName: 'أحمد خالد', username: 'ahmed2025', password: '2025', role: 'super' as const, phone: '07700000000', email: 'ahmed@linex.com', isActive: true, createdAt: new Date().toISOString() };

export default function LandingPage() {
  const navigate = useNavigate();
  const { pricing, getActiveCenters, getIndependentDepartments, addCenter, addDepartment } = useLinexData();

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'center' | 'dept'>('center');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Form state - simplified (gmail + password first, then details)
  const [gmail, setGmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Center/Dept details
  const [cName, setCName] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [dName, setDName] = useState('');
  const [dDesc, setDDesc] = useState('');
  const [dDoctor, setDDoctor] = useState('');

  const activeCenters = getActiveCenters();
  const activeDepts = getIndependentDepartments();

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 5000); };

  const isValidGmail = (email: string) => email.toLowerCase().endsWith('@gmail.com');
  const isValidPhone = (phone: string) => /^07\d{9}$/.test(phone.replace(/\s/g, ''));

  const resetForm = () => {
    setGmail(''); setPassword(''); setConfirmPassword('');
    setCName(''); setCAddress(''); setCPhone(''); setDName(''); setDDesc(''); setDDoctor('');
  };

  const handleCreate = async () => {
    // Validate Gmail
    if (!gmail || !isValidGmail(gmail)) { showMsg('أدخل بريد Gmail صحيح (@gmail.com)'); return; }
    
    // Validate password
    if (!password || password.length < 6) { showMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (password !== confirmPassword) { showMsg('كلمتا المرور غير متطابقتين'); return; }

    // Validate center/dept info
    if (createType === 'center') {
      if (!cName || !cPhone) { showMsg('أدخل اسم المركز ورقم الموبايل'); return; }
      if (!isValidPhone(cPhone)) { showMsg('رقم الموبايل يجب أن يكون 11 رقماً يبدأ بـ 07'); return; }
    } else {
      if (!dName || !dDoctor) { showMsg('أدخل اسم العيادة واسم الطبيب'); return; }
    }

    // Check duplicate gmail
    const existingAdmins = JSON.parse(localStorage.getItem('linex_admins') || '[]');
    if (existingAdmins.find((a: Admin) => a.email?.toLowerCase() === gmail.toLowerCase())) {
      showMsg('هذا البريد مسجل مسبقاً'); return;
    }
    // Check duplicate username (use gmail prefix as username)
    const username = gmail.split('@')[0];
    if (existingAdmins.find((a: Admin) => a.username === username)) {
      showMsg('اسم المستخدم مستخدم مسبقاً'); return;
    }

    setLoading(true);
    const adminId = 'admin-' + Date.now();
    const centerId = 'center-' + Date.now();
    const deptId = 'dept-' + Date.now();
    const trialDays = pricing?.trial?.enabled ? (pricing?.trial?.trialDays || 10) : 0;
    const subPrice = pricing?.platform 
      ? (createType === 'center' ? pricing.platform.centerMonthlyPrice : pricing.platform.deptMonthlyPrice)
      : (createType === 'center' ? 50000 : 25000);

    // Create admin
    const admin: Admin = {
      id: adminId,
      fullName: createType === 'center' ? cName : dName,
      username,
      password,
      role: createType === 'center' ? 'center' : 'department',
      phone: cPhone || '',
      email: gmail,
      centerId: createType === 'center' ? centerId : undefined,
      departmentId: createType === 'dept' ? deptId : undefined,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    await saveAdmin(admin);

    if (createType === 'center') {
      const center: Center = {
        id: centerId, name: cName, address: cAddress, phone: cPhone, email: gmail,
        logo: '', workingDays: ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'],
        workingHours: '08:00 - 22:00', fridayHours: '16:00 - 21:00', emergencyHours: '24 ساعة',
        consultationDuration: 15, doctors: [], adminId,
        activationType: 'paid', subscriptionPrice: subPrice, freeTrialDays: trialDays,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + trialDays * 86400000).toISOString(),
        isPaid: false, isActive: true, status: 'trial' as Center['status'],
        appearanceType: 'hidden', appearanceExpiry: '', promoImages: [], promoText: ''
      };
      await saveCenter(center);
      showMsg(`تم إنشاء مركز "${cName}" بنجاح! يمكنك تسجيل الدخول بـ: ${username}`);
    } else {
      const dept: Department = {
        id: deptId, name: dName, description: dDesc, icon: 'Stethoscope',
        doctorName: dDoctor, doctorEmail: gmail, doctorPhone: '', logo: '',
        workingDays: ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'],
        startTime: '09:00', endTime: '14:00', consultationDuration: 15,
        daysOff: ['الجمعة'], vacationDays: [], bookingWindow: 7,
        workingHours: '09:00 - 14:00', fridayHours: '', centerId: null, adminId,
        activationType: 'paid', subscriptionPrice: subPrice, freeTrialDays: trialDays,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + trialDays * 86400000).toISOString(),
        isPaid: false, isActive: true, status: 'trial' as Department['status'],
        appearanceType: 'hidden', appearanceExpiry: '', promoImages: [], promoText: ''
      };
      await saveDepartment(dept);
      showMsg(`تم إنشاء عيادة "${dName}" بنجاح! يمكنك تسجيل الدخول بـ: ${username}`);
    }

    setLoading(false);
    setShowCreateModal(false);
    resetForm();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src="/assets/linex-logo-transparent.png" alt="LinkEX" className="h-10 w-auto object-contain" />
              <h1 className="text-2xl font-bold">
                <span style={{ color: '#2c3e50' }}>Link</span>
                <span style={{ color: '#FF5722' }}>EX</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => navigate('/login')} className="gap-1">
                <Lock className="w-4 h-4" />تسجيل الدخول
              </Button>
              <Button size="sm" className="gap-1" style={{ backgroundColor: '#5C7A6B' }} onClick={() => { resetForm(); setShowCreateModal(true); }}>
                <Plus className="w-4 h-4" />لأول مرة
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <img src="/assets/linex-logo-transparent.png" alt="LinkEX" className="h-32 w-auto mx-auto mb-6 object-contain" />
          <h2 className="text-4xl font-bold mb-4">
            <span style={{ color: '#2c3e50' }}>Link</span>
            <span style={{ color: '#FF5722' }}>EX</span>
          </h2>
          <p className="text-lg text-gray-600 mb-8">نظام إدارة المراكز الطبية الذكي</p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" style={{ backgroundColor: '#5C7A6B' }} className="gap-2" onClick={() => navigate('/login')}>
              <Lock className="w-5 h-5" />تسجيل دخول المدير
            </Button>
            <Button size="lg" variant="outline" className="gap-2" onClick={() => { resetForm(); setShowCreateModal(true); }}>
              <Plus className="w-5 h-5" />اشترك الآن
            </Button>
          </div>
          {pricing?.trial?.enabled && (
            <p className="mt-4 text-sm text-teal-600 font-medium">
              <CheckCircle2 className="w-4 h-4 inline ml-1" />
              سجل الآن واحصل على {pricing.trial.trialDays || 10} أيام مجاناً كفترة تجريبية
            </p>
          )}
        </div>
      </section>

      {/* Centers & Depts */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-2xl font-bold mb-6 text-center">المراكز الطبية</h3>
          {activeCenters.length === 0 ? (
            <p className="text-center text-gray-400">لا توجد مراكز مسجلة حالياً</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeCenters.map(c => (
                <Card key={c.id} className="p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/center/${c.id}`)}>
                  <div className="flex items-center gap-3">
                    <Building2 className="w-10 h-10 text-teal-600" />
                    <div>
                      <p className="font-bold">{c.name}</p>
                      <p className="text-sm text-gray-500">{c.address}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Create Account Modal - Simplified */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md p-6 relative">
            <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="absolute top-4 left-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-center mb-4">
              إنشاء حساب جديد - {createType === 'center' ? 'مركز طبي' : 'عيادة'}
            </h3>

            {msg && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm text-center">{msg}</div>}

            {/* Trial Notice */}
            {pricing?.trial?.enabled && (
              <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                <p className="text-sm text-teal-700 text-center">
                  <CheckCircle2 className="w-4 h-4 inline ml-1" />
                  سجل الآن واحصل على <strong>{pricing.trial.trialDays || 10} أيام</strong> مجاناً
                </p>
              </div>
            )}

            {/* Subscription Price */}
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">الاشتراك الشهري</span>
                <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold">
                  {(createType === 'center' 
                    ? (pricing?.platform?.centerMonthlyPrice ?? 50000)
                    : (pricing?.platform?.deptMonthlyPrice ?? 25000)
                  ).toLocaleString()} د.ع
                </span>
              </div>
            </div>

            {/* Type Selection */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => setCreateType('center')} className={`flex-1 p-3 rounded-lg border-2 text-center ${createType === 'center' ? 'border-teal-500 bg-teal-50' : 'border-gray-200'}`}>
                <Building2 className={`w-6 h-6 mx-auto mb-1 ${createType === 'center' ? 'text-teal-600' : 'text-gray-400'}`} />
                <p className="text-sm font-semibold">مركز طبي</p>
              </button>
              <button onClick={() => setCreateType('dept')} className={`flex-1 p-3 rounded-lg border-2 text-center ${createType === 'dept' ? 'border-teal-500 bg-teal-50' : 'border-gray-200'}`}>
                <Stethoscope className={`w-6 h-6 mx-auto mb-1 ${createType === 'dept' ? 'text-teal-600' : 'text-gray-400'}`} />
                <p className="text-sm font-semibold">عيادة</p>
              </button>
            </div>

            {/* Gmail */}
            <div className="space-y-2 mb-3">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-red-500" />
                بريد Gmail <span className="text-red-500">*</span>
              </Label>
              <Input value={gmail} onChange={e => setGmail(e.target.value)} placeholder="example@gmail.com" dir="ltr" />
              <p className="text-xs text-gray-400">يُسمح فقط بحسابات Gmail</p>
            </div>

            {/* Password */}
            <div className="space-y-2 mb-3">
              <Label className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                كلمة المرور <span className="text-red-500">*</span>
              </Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6 أحرف على الأقل" dir="ltr" />
            </div>

            {/* Confirm Password */}
            <div className="space-y-2 mb-3">
              <Label>تأكيد كلمة المرور <span className="text-red-500">*</span></Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="أعد كتابة كلمة المرور" dir="ltr" />
            </div>

            {/* Center Fields */}
            {createType === 'center' && (
              <>
                <div className="space-y-2 mb-3">
                  <Label className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    اسم المركز <span className="text-red-500">*</span>
                  </Label>
                  <Input value={cName} onChange={e => setCName(e.target.value)} placeholder="اسم المركز الطبي" />
                </div>
                <div className="space-y-2 mb-3">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    العنوان
                  </Label>
                  <Input value={cAddress} onChange={e => setCAddress(e.target.value)} placeholder="عنوان المركز" />
                </div>
                <div className="space-y-2 mb-3">
                  <Label className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    رقم الموبايل <span className="text-red-500">*</span>
                  </Label>
                  <Input value={cPhone} onChange={e => setCPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="07xxxxxxxx (11 رقم)" dir="ltr" />
                  <p className="text-xs text-gray-400">يجب أن يبدأ بـ 07 و11 رقماً</p>
                </div>
              </>
            )}

            {/* Dept Fields */}
            {createType === 'dept' && (
              <>
                <div className="space-y-2 mb-3">
                  <Label className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4" />
                    اسم العيادة <span className="text-red-500">*</span>
                  </Label>
                  <Input value={dName} onChange={e => setDName(e.target.value)} placeholder="اسم العيادة" />
                </div>
                <div className="space-y-2 mb-3">
                  <Label>الوصف</Label>
                  <Input value={dDesc} onChange={e => setDDesc(e.target.value)} placeholder="وصف العيادة والتخصصات" />
                </div>
                <div className="space-y-2 mb-3">
                  <Label className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    اسم الطبيب <span className="text-red-500">*</span>
                  </Label>
                  <Input value={dDoctor} onChange={e => setDDoctor(e.target.value)} placeholder="اسم الطبيب المختص" />
                </div>
              </>
            )}

            <Button 
              onClick={handleCreate} 
              disabled={loading}
              className="w-full" 
              style={{ backgroundColor: '#5C7A6B' }}
            >
              {loading ? 'جاري الإنشاء...' : `إنشاء ${createType === 'center' ? 'المركز' : 'العيادة'}`}
            </Button>

            <p className="text-xs text-gray-400 text-center mt-3">
              عند إنشاء الحساب فإنك توافق على شروط الاستخدام وسياسة الخصوصية
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
