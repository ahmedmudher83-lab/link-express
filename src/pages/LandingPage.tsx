import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useLinexData } from '@/hooks/useLinexData';
import { saveAdmin, saveCenter, saveDepartment } from '@/services/dataStorage';
import { sendOTP, verifyOTP, createAccountWithOTP } from '@/services/firebaseAuthService';
import type { Center, Department, Admin } from '@/types/linex';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Lock, Plus, Phone, Mail, Shield, CheckCircle2,
  Stethoscope, Building2, X, User, Smartphone,
  Loader2, ArrowLeft, ArrowRight
} from 'lucide-react';

type RegMethod = 'gmail' | 'phone';

export default function LandingPage() {
  const navigate = useNavigate();
  const { pricing, getActiveCenters, getIndependentDepartments } = useLinexData();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'center' | 'dept'>('center');
  const [step, setStep] = useState(1);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Registration method
  const [regMethod, setRegMethod] = useState<RegMethod>('gmail');

  // Step 1: Account info + OTP
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // OTP
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [simulatedOTP, setSimulatedOTP] = useState('');

  // Step 2: Center/Dept details
  const [cName, setCName] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [dName, setDName] = useState('');
  const [dDesc, setDDesc] = useState('');
  const [dDoctor, setDDoctor] = useState('');

  const activeCenters = getActiveCenters();
  const activeDepts = getIndependentDepartments();

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 6000); };
  const isValidGmail = (email: string) => email.toLowerCase().endsWith('@gmail.com');
  const isValidPhone = (phone: string) => /^07\d{9}$/.test(phone.replace(/\s/g, ''));

  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => setOtpCooldown(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const resetForm = () => {
    setIdentifier(''); setFullName(''); setUsername(''); setPassword(''); setConfirmPassword('');
    setOtpSent(false); setOtpCode(''); setVerified(false); setOtpCooldown(0); setSimulatedOTP('');
    setRegMethod('gmail');
    setCName(''); setCAddress(''); setCPhone('');
    setDName(''); setDDesc(''); setDDoctor('');
    setStep(1); setMsg(''); setLoading(false);
  };

  // ======== STEP 1: Send OTP ========
  const handleSendOTP = async () => {
    setError('');
    // Validate fields
    if (!fullName || !identifier) { showMsg('أدخل الاسم والبريد/الموبايل'); return; }

    if (regMethod === 'gmail') {
      if (!isValidGmail(identifier)) { showMsg('يُسمح فقط بحسابات Gmail (@gmail.com)'); return; }
    } else {
      if (!isValidPhone(identifier)) { showMsg('رقم الموبايل يجب أن يكون 11 رقماً يبدأ بـ 07'); return; }
    }

    setLoading(true);
    const result = await sendOTP(identifier, regMethod);
    setLoading(false);

    if (result.success) {
      setOtpSent(true);
      setOtpCooldown(60);
      if (result.otpCode) setSimulatedOTP(result.otpCode);
      showMsg('تم إرسال رمز التحقق!');
    } else {
      showMsg(result.error || 'فشل إرسال الرمز');
    }
  };

  // ======== Verify OTP ========
  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length !== 6) { showMsg('أدخل الرمز المكون من 6 أرقام'); return; }
    setLoading(true);
    const result = await verifyOTP(identifier, otpCode, regMethod);
    setLoading(false);
    if (result.success) {
      setVerified(true);
      showMsg('تم التحقق بنجاح!');
    } else {
      showMsg(result.error || 'الرمز غير صحيح');
    }
  };

  // ======== Resend OTP ========
  const handleResendOTP = async () => {
    if (otpCooldown > 0) return;
    setSimulatedOTP('');
    setLoading(true);
    const result = await sendOTP(identifier, regMethod);
    setLoading(false);
    if (result.success) {
      setOtpCooldown(60);
      if (result.otpCode) setSimulatedOTP(result.otpCode);
      showMsg('تم إعادة إرسال الرمز!');
    } else {
      showMsg(result.error || 'فشل إعادة الإرسال');
    }
  };

  // ======== STEP 2: Validate account info ========
  const handleStep2Next = () => {
    if (!username) { showMsg('أدخل اسم المستخدم'); return; }
    if (username.includes(' ')) { showMsg('اسم المستخدم لا يجب أن يحتوي على مسافات'); return; }
    if (!password || password.length < 6) { showMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (password !== confirmPassword) { showMsg('كلمتا المرور غير متطابقتين'); return; }
    setStep(3);
  };

  // ======== STEP 3: Create account ========
  const handleCreate = async () => {
    if (!verified) { showMsg('يرجى التحقق من الرمز أولاً'); return; }
    if (createType === 'center' && (!cName || !cPhone)) { showMsg('أدخل اسم المركز ورقم الموبايل'); return; }
    if (createType === 'center' && !isValidPhone(cPhone)) { showMsg('رقم الموبايل يجب أن يكون 11 رقماً يبدأ بـ 07'); return; }
    if (createType === 'dept' && (!dName || !dDoctor)) { showMsg('أدخل اسم العيادة واسم الطبيب'); return; }

    setLoading(true);
    const trialDays = pricing?.trial?.enabled ? (pricing?.trial?.trialDays || 10) : 0;
    const subPrice = pricing?.platform
      ? (createType === 'center' ? pricing.platform.centerMonthlyPrice : pricing.platform.deptMonthlyPrice)
      : (createType === 'center' ? 50000 : 25000);

    // Create account via OTP service
    const role = createType === 'center' ? 'center' as const : 'department' as const;
    const result = await createAccountWithOTP(fullName, identifier, regMethod, username, password, role);

    if (!result.success) {
      setLoading(false);
      showMsg(result.error || 'فشل إنشاء الحساب');
      return;
    }

    const admin = result.admin;
    if (!admin) {
      setLoading(false);
      showMsg('فشل إنشاء الحساب');
      return;
    }

    // Update admin with center/dept info
    const updatedAdmin: Admin = {
      ...admin,
      fullName: createType === 'center' ? cName : dName,
      phone: cPhone || admin.phone || '',
      email: regMethod === 'gmail' ? identifier : (admin.email || ''),
    };
    await saveAdmin(updatedAdmin);

    if (createType === 'center') {
      const centerId = 'center-' + Date.now();
      const center: Center = {
        id: centerId, name: cName, address: cAddress, phone: cPhone, email: admin.email || '',
        logo: '', workingDays: ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'],
        workingHours: '08:00 - 22:00', fridayHours: '16:00 - 21:00', emergencyHours: '24 ساعة',
        consultationDuration: 15, doctors: [], adminId: admin.id,
        activationType: 'paid', subscriptionPrice: subPrice, freeTrialDays: trialDays,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + trialDays * 86400000).toISOString(),
        isPaid: false, isActive: true, status: 'trial' as Center['status'],
        appearanceType: 'hidden', appearanceExpiry: '', promoImages: [], promoText: ''
      };
      await saveCenter(center);
      showMsg(`تم إنشاء مركز "${cName}" بنجاح! تسجيل الدخول بـ: ${username}`);
    } else {
      const deptId = 'dept-' + Date.now();
      const dept: Department = {
        id: deptId, name: dName, description: dDesc, icon: 'Stethoscope',
        doctorName: dDoctor, doctorEmail: admin.email || '', doctorPhone: '', logo: '',
        workingDays: ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'],
        startTime: '09:00', endTime: '14:00', consultationDuration: 15,
        daysOff: ['الجمعة'], vacationDays: [], bookingWindow: 7,
        workingHours: '09:00 - 14:00', fridayHours: '', centerId: null, adminId: admin.id,
        activationType: 'paid', subscriptionPrice: subPrice, freeTrialDays: trialDays,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + trialDays * 86400000).toISOString(),
        isPaid: false, isActive: true, status: 'trial' as Department['status'],
        appearanceType: 'hidden', appearanceExpiry: '', promoImages: [], promoText: ''
      };
      await saveDepartment(dept);
      showMsg(`تم إنشاء عيادة "${dName}" بنجاح! تسجيل الدخول بـ: ${username}`);
    }

    setLoading(false);
    setShowCreateModal(false);
    resetForm();
  };

  const [error, setError] = useState('');
  const showError = (text: string) => { setError(text); setTimeout(() => setError(''), 5000); };

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

      {/* Centers */}
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

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="absolute top-4 left-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-center mb-4">
              {step === 1 && 'اختر نوع الاشتراك'}
              {step === 2 && 'التحقق من الحساب'}
              {step === 3 && `بيانات ${createType === 'center' ? 'المركز' : 'العيادة'}`}
            </h3>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-teal-600 text-white' : 'bg-gray-200'}`}>1</span>
              <span className="w-8 h-0.5 bg-gray-200"><span className={`block h-full bg-teal-600 transition-all ${step >= 2 ? 'w-full' : 'w-0'}`} /></span>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-teal-600 text-white' : 'bg-gray-200'}`}>2</span>
              <span className="w-8 h-0.5 bg-gray-200"><span className={`block h-full bg-teal-600 transition-all ${step >= 3 ? 'w-full' : 'w-0'}`} /></span>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 3 ? 'bg-teal-600 text-white' : 'bg-gray-200'}`}>3</span>
            </div>

            {msg && (
              <div className={`mb-4 p-3 rounded-lg text-sm text-center ${msg.includes('فشل') || msg.includes('خطأ') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {msg}
              </div>
            )}
            {error && (
              <div className="mb-4 p-3 rounded-lg text-sm text-center bg-red-50 text-red-700">
                {error}
              </div>
            )}

            {/* ===== STEP 1: Select Type ===== */}
            {step === 1 && (
              <div className="space-y-4">
                {pricing?.trial?.enabled && (
                  <div className="bg-teal-50 p-3 rounded-lg border border-teal-200 text-center">
                    <p className="text-sm text-teal-700">
                      <CheckCircle2 className="w-4 h-4 inline ml-1" />
                      سجل الآن واحصل على <strong>{pricing.trial.trialDays || 10} أيام</strong> مجاناً
                    </p>
                  </div>
                )}

                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
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

                <div className="flex gap-3">
                  <button onClick={() => setCreateType('center')} className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${createType === 'center' ? 'border-teal-500 bg-teal-50' : 'border-gray-200'}`}>
                    <Building2 className={`w-8 h-8 mx-auto mb-2 ${createType === 'center' ? 'text-teal-600' : 'text-gray-400'}`} />
                    <p className="font-bold">مركز طبي</p>
                  </button>
                  <button onClick={() => setCreateType('dept')} className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${createType === 'dept' ? 'border-teal-500 bg-teal-50' : 'border-gray-200'}`}>
                    <Stethoscope className={`w-8 h-8 mx-auto mb-2 ${createType === 'dept' ? 'text-teal-600' : 'text-gray-400'}`} />
                    <p className="font-bold">عيادة</p>
                  </button>
                </div>

                <Button className="w-full" style={{ backgroundColor: '#5C7A6B' }} onClick={() => setStep(2)}>
                  التالي <ArrowLeft className="w-4 h-4 mr-1" />
                </Button>
              </div>
            )}

            {/* ===== STEP 2: OTP Verification ===== */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Registration method toggle */}
                {!otpSent && !verified && (
                  <>
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => { setRegMethod('gmail'); setIdentifier(''); }}
                        className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${regMethod === 'gmail' ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                      >
                        <Mail className={`w-6 h-6 mx-auto mb-1 ${regMethod === 'gmail' ? 'text-red-500' : 'text-gray-400'}`} />
                        <p className="text-sm font-semibold">Gmail</p>
                      </button>
                      <button
                        onClick={() => { setRegMethod('phone'); setIdentifier(''); }}
                        className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${regMethod === 'phone' ? 'border-teal-400 bg-teal-50' : 'border-gray-200'}`}
                      >
                        <Smartphone className={`w-6 h-6 mx-auto mb-1 ${regMethod === 'phone' ? 'text-teal-600' : 'text-gray-400'}`} />
                        <p className="text-sm font-semibold">موبايل</p>
                      </button>
                    </div>

                    {/* Full Name */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        الاسم الكامل <span className="text-red-500">*</span>
                      </Label>
                      <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="الاسم الكامل" />
                    </div>

                    {/* Identifier: Gmail or Phone */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        {regMethod === 'gmail' ? <Mail className="w-4 h-4 text-red-500" /> : <Smartphone className="w-4 h-4 text-teal-600" />}
                        {regMethod === 'gmail' ? 'بريد Gmail' : 'رقم الموبايل'} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={identifier}
                        onChange={e => setIdentifier(regMethod === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 11) : e.target.value)}
                        placeholder={regMethod === 'gmail' ? 'example@gmail.com' : '07xxxxxxxx'}
                        dir="ltr"
                      />
                      <p className="text-xs text-gray-400">
                        {regMethod === 'gmail' ? 'يُسمح فقط بحسابات Gmail (@gmail.com)' : 'يجب أن يبدأ بـ 07 و11 رقماً'}
                      </p>
                    </div>

                    {/* Username */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        اسم المستخدم <span className="text-red-500">*</span>
                      </Label>
                      <Input value={username} onChange={e => setUsername(e.target.value.replace(/\s/g, ''))} placeholder="اسم المستخدم للدخول" dir="ltr" />
                      <p className="text-xs text-gray-400">اسم فريد لتسجيل الدخول (بدون مسافات)</p>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        كلمة المرور <span className="text-red-500">*</span>
                      </Label>
                      <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6 أحرف على الأقل" dir="ltr" />
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                      <Label>تأكيد كلمة المرور <span className="text-red-500">*</span></Label>
                      <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="أعد كتابة كلمة المرور" dir="ltr" />
                    </div>

                    <Button
                      onClick={handleSendOTP}
                      disabled={loading}
                      className="w-full bg-teal-600 hover:bg-teal-700 gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      {loading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
                    </Button>
                  </>
                )}

                {/* OTP Input (after sending) */}
                {otpSent && !verified && (
                  <div className="text-center space-y-4">
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                      <Shield className="w-10 h-10 text-amber-600 mx-auto mb-2" />
                      <p className="text-lg font-bold text-amber-800">تم إرسال رمز التحقق!</p>
                      <p className="text-sm text-amber-600 mt-1">
                        تم الإرسال إلى <strong dir="ltr">{identifier}</strong>
                      </p>
                    </div>

                    {simulatedOTP && (
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
                        <p className="text-xs text-blue-500 mb-1">رمز التحقق (للتجربة)</p>
                        <p className="text-2xl font-bold text-blue-700 tracking-[0.3em]" dir="ltr">{simulatedOTP}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>رمز التحقق (6 أرقام)</Label>
                      <Input
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        dir="ltr"
                        className="text-center text-2xl tracking-[0.5em] font-bold"
                        maxLength={6}
                      />
                    </div>

                    <Button
                      onClick={handleVerifyOTP}
                      disabled={loading || otpCode.length !== 6}
                      className="w-full bg-teal-600 hover:bg-teal-700 gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {loading ? 'جاري التحقق...' : 'تحقق'}
                    </Button>

                    <div className="text-center">
                      <button
                        onClick={handleResendOTP}
                        disabled={otpCooldown > 0 || loading}
                        className="text-sm text-teal-600 hover:text-teal-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        {otpCooldown > 0 ? `إعادة الإرسال بعد ${otpCooldown} ث` : 'إعادة إرسال الرمز'}
                      </button>
                    </div>

                    <button
                      onClick={() => { setOtpSent(false); setOtpCode(''); setSimulatedOTP(''); }}
                      className="w-full text-center text-sm text-gray-400 hover:text-gray-600"
                    >
                      تغيير {regMethod === 'gmail' ? 'البريد' : 'الرقم'}
                    </button>
                  </div>
                )}

                {/* Verified */}
                {verified && (
                  <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
                    <p className="text-lg font-bold text-green-800">تم التحقق بنجاح!</p>
                    <p className="text-sm text-green-600">يمكنك الآن إكمال التسجيل</p>
                  </div>
                )}

                {/* Navigation buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    <ArrowRight className="w-4 h-4 ml-1" /> رجوع
                  </Button>
                  {verified && (
                    <Button className="flex-1" style={{ backgroundColor: '#5C7A6B' }} onClick={handleStep2Next}>
                      أكمل التسجيل <ArrowLeft className="w-4 h-4 mr-1" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ===== STEP 3: Center/Dept Details ===== */}
            {step === 3 && (
              <div className="space-y-4">
                {createType === 'center' ? (
                  <>
                    <div className="space-y-2">
                      <Label>اسم المركز <span className="text-red-500">*</span></Label>
                      <Input value={cName} onChange={e => setCName(e.target.value)} placeholder="اسم المركز الطبي" />
                    </div>
                    <div className="space-y-2">
                      <Label>العنوان</Label>
                      <Input value={cAddress} onChange={e => setCAddress(e.target.value)} placeholder="عنوان المركز" />
                    </div>
                    <div className="space-y-2">
                      <Label>رقم الموبايل <span className="text-red-500">*</span></Label>
                      <Input value={cPhone} onChange={e => setCPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="07xxxxxxxx" dir="ltr" />
                      <p className="text-xs text-gray-400">يجب أن يبدأ بـ 07 و11 رقماً</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>اسم العيادة <span className="text-red-500">*</span></Label>
                      <Input value={dName} onChange={e => setDName(e.target.value)} placeholder="اسم العيادة" />
                    </div>
                    <div className="space-y-2">
                      <Label>الوصف</Label>
                      <Input value={dDesc} onChange={e => setDDesc(e.target.value)} placeholder="وصف العيادة" />
                    </div>
                    <div className="space-y-2">
                      <Label>اسم الطبيب <span className="text-red-500">*</span></Label>
                      <Input value={dDoctor} onChange={e => setDDoctor(e.target.value)} placeholder="اسم الطبيب المختص" />
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                    <ArrowRight className="w-4 h-4 ml-1" /> رجوع
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={loading}
                    className="flex-1"
                    style={{ backgroundColor: '#5C7A6B' }}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إنشاء الحساب'}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
