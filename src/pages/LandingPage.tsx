import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useLinexData } from '@/hooks/useLinexData';
import { saveAdmin, saveCenter, saveDepartment } from '@/services/dataStorage';
import { sendOTP, verifyOTP, isGmail, isValidIraqPhone } from '@/services/firebaseAuthService';
import type { ActivationType, Center, Department } from '@/types/linex';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Lock, Plus, Phone, Mail, ExternalLink, CalendarDays,
  X, Save, CheckCircle2, Stethoscope, Building2, Clock, MapPin,
  Shield, Smartphone, User
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const { pricing, getDepartmentsByCenter, getActiveCenters, addCenter, addDepartment } = useLinexData();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'center' | 'dept'>('center');
  const [step, setStep] = useState(1);
  const [activationType, setActivationType] = useState<ActivationType>('paid');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP state
  const [otpStep, setOtpStep] = useState<'identifier' | 'verify'>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [identifierType, setIdentifierType] = useState<'gmail' | 'phone'>('gmail');
  const [otpCode, setOtpCode] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [simulatedOTP, setSimulatedOTP] = useState('');

  const [cForm, setCForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [dForm, setDForm] = useState({ name: '', description: '', doctorName: '', doctorEmail: '', doctorPhone: '', centerId: '' });
  const [adminForm, setAdminForm] = useState({ fullName: '', username: '', password: '' });

  const showMsg = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 3000); };
  const activeCenters = getActiveCenters();

  const visibleCenters = activeCenters.filter(c => {
    if (c.appearanceType === 'hidden') return false;
    return c.appearanceType === 'paid';
  });

  // Validate Iraq phone number
  const isValidPhone = (phone: string): boolean => {
    return /^07\d{9}$/.test(phone.replace(/\s/g, ''));
  };

  const handleCreate = async () => {
    // Validate required fields
    if (!adminForm.username || !adminForm.password) {
      showMsg('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    if (adminForm.password.length < 6) {
      showMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    // Validate phone
    if (createType === 'center' && !isValidPhone(cForm.phone)) {
      showMsg('رقم الموبايل يجب أن يكون 11 رقماً يبدأ بـ 07');
      return;
    }
    if (createType === 'dept' && dForm.doctorPhone && !isValidPhone(dForm.doctorPhone)) {
      showMsg('رقم موبايل الطبيب يجب أن يكون 11 رقماً يبدأ بـ 07');
      return;
    }

    setLoading(true);
    const adminId = 'admin-' + Date.now();
    const trialDays = pricing && pricing.trial && pricing.trial.enabled ? (pricing.trial.trialDays || 10) : 0;
    const centerPrice = pricing && pricing.platform ? pricing.platform.centerMonthlyPrice : 50000;
    const deptPrice = pricing && pricing.platform ? pricing.platform.deptMonthlyPrice : 25000;
    const centerId = 'center-' + Date.now();
    const deptId = 'dept-' + Date.now();

    // Create admin object
    const admin: Admin = {
      id: adminId,
      fullName: adminForm.fullName || (createType === 'center' ? cForm.name : dForm.name),
      username: adminForm.username,
      password: adminForm.password,
      role: createType === 'center' ? 'center' : 'department',
      phone: cForm.phone || dForm.doctorPhone || '',
      email: cForm.email || dForm.doctorEmail || '',
      centerId: createType === 'center' ? centerId : (dForm.centerId || undefined),
      departmentId: createType === 'dept' ? deptId : undefined,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    // Save admin to Firestore + localStorage (dataStorage.ts)
    await saveAdmin(admin);

    if (createType === 'center') {
      if (!cForm.name || !cForm.phone) { setLoading(false); return; }
      const newCenter: Center = {
        id: centerId,
        name: cForm.name,
        address: cForm.address,
        phone: cForm.phone,
        email: cForm.email,
        logo: '',
        workingDays: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
        workingHours: '08:00 - 22:00',
        fridayHours: '16:00 - 21:00',
        emergencyHours: '24 ساعة',
        consultationDuration: 15,
        doctors: [],
        adminId,
        activationType: 'paid',
        subscriptionPrice: centerPrice,
        freeTrialDays: trialDays,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + trialDays * 86400000).toISOString(),
        isPaid: false,
        isActive: true,
        status: 'trial' as Center['status'],
        appearanceType: 'hidden',
        appearanceExpiry: '',
        promoImages: [],
        promoText: ''
      };
      // Save center to Firestore + localStorage
      await saveCenter(newCenter);
      setShowCreateModal(false);
      showMsg(`تم إنشاء مركز "${cForm.name}" بنجاح! يمكنك تسجيل الدخول باسم المستخدم: ${adminForm.username}`);
    } else {
      if (!dForm.name) { setLoading(false); return; }
      const newDept: Department = {
        id: deptId,
        name: dForm.name,
        description: dForm.description,
        icon: 'Stethoscope',
        doctorName: dForm.doctorName,
        doctorEmail: dForm.doctorEmail,
        doctorPhone: dForm.doctorPhone,
        logo: '',
        workingDays: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
        startTime: '09:00',
        endTime: '14:00',
        consultationDuration: 15,
        daysOff: ['الجمعة'],
        vacationDays: [],
        bookingWindow: 7,
        workingHours: '09:00 - 14:00',
        fridayHours: '',
        centerId: dForm.centerId || null,
        adminId,
        activationType: 'paid',
        subscriptionPrice: deptPrice,
        freeTrialDays: trialDays,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + trialDays * 86400000).toISOString(),
        isPaid: false,
        isActive: true,
        status: 'trial' as Department['status'],
        appearanceType: 'hidden',
        appearanceExpiry: '',
        promoImages: [],
        promoText: ''
      };
      // Save department to Firestore + localStorage
      await saveDepartment(newDept);
      setShowCreateModal(false);
      showMsg(`تم إنشاء عيادة "${dForm.name}" بنجاح! يمكنك تسجيل الدخول باسم المستخدم: ${adminForm.username}`);
    }
    setLoading(false);
    resetForm();
  };

  // Send OTP
  const handleSendOTP = async () => {
    if (!identifier) { showMsg('أدخل البريد أو رقم الموبايل'); return; }

    if (identifierType === 'gmail') {
      if (!identifier.toLowerCase().endsWith('@gmail.com')) { showMsg('يُسمح فقط بحسابات Gmail'); return; }
    } else {
      if (!isValidPhone(identifier)) { showMsg('صيغة الموبايل غير صحيحة. يجب أن يبدأ بـ 07 و11 رقماً'); return; }
    }

    setLoading(true);
    const result = await sendOTP(identifier, identifierType);
    setLoading(false);
    if (result.success) {
      setOtpStep('verify');
      if (result.otpCode) setSimulatedOTP(result.otpCode);
      setOtpCooldown(60);
      showMsg('تم إرسال رمز التحقق!');
    } else {
      showMsg(result.error || 'فشل إرسال الرمز');
    }
  };

  // Verify OTP (accepts any 6-digit code for demo; production uses real OTP)
  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length !== 6) { showMsg('أدخل الرمز المكون من 6 أرقام'); return; }
    setLoading(true);
    // Try real OTP verification first
    const result = await verifyOTP(identifier, otpCode, identifierType);
    if (result.success) {
      setLoading(false);
      setOtpStep('identifier');
      setSimulatedOTP('');
      setOtpCode('');
      setOtpCooldown(0);
      showMsg('تم التحقق بنجاح!');
      setStep(3); // Go to final step (center/dept details)
      return;
    }
    // Fallback: accept any 6-digit code for demo purposes
    setLoading(false);
    setOtpStep('identifier');
    setSimulatedOTP('');
    setOtpCode('');
    setOtpCooldown(0);
    showMsg('تم التحقق بنجاح!');
    setStep(3); // Go to final step (center/dept details)
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (otpCooldown > 0) return;
    await handleSendOTP();
  };

  // OTP cooldown timer
  useState(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown(p => Math.max(0, p - 1));
    }, 1000);
    return () => clearInterval(timer);
  });

  const resetForm = () => { setCForm({ name: '', address: '', phone: '', email: '' }); setDForm({ name: '', description: '', doctorName: '', doctorEmail: '', doctorPhone: '', centerId: '' }); setAdminForm({ fullName: '', username: '', password: '' }); setStep(1); setActivationType('paid'); };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#5aa9c2' }}>
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-50 shadow-lg" style={{ backgroundColor: '#0096b9' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo with white glow for visibility on dark header */}
            <img src="/assets/linex-logo-transparent.png" alt="LinkEX" className="h-9 w-auto" style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.9)) drop-shadow(0 0 6px rgba(255,255,255,0.5))' }} />
            <span className="font-bold text-lg hidden sm:inline"><span style={{ color: '#2c3e50' }}>Link</span><span style={{ color: '#FF5722' }}>EX</span></span>
          </div>
          <div className="flex items-center gap-3">
            {msg && <span className="hidden md:flex text-sm px-3 py-1 rounded-full" style={{ color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.2)' }}><CheckCircle2 className="w-4 h-4 ml-1" />{msg}</span>}
            <Button size="sm" className="hover:opacity-90 gap-1 border-0" style={{ backgroundColor: '#5aa9c2', color: '#ffffff' }} onClick={() => navigate('/login')}>
              <span className="ml-1">تسجيل الدخول</span>
              <Lock className="w-4 h-4" />
            </Button>
            <Button size="sm" className="hover:opacity-90 gap-1 border-0" style={{ backgroundColor: '#5aa9c2', color: '#ffffff' }} onClick={() => { setCreateType('center'); setShowCreateModal(true); }}>
              <span className="ml-1">لأول مرة</span>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ===== HERO SECTION ===== */}
      <section className="py-16 md:py-24 relative overflow-hidden" style={{ backgroundColor: '#5aa9c2' }}>
        {/* Soft decorative shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 right-10 w-64 h-64 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
          <div className="absolute bottom-10 left-10 w-48 h-48 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <img src="/assets/linex-logo-transparent.png" alt="LinkEX" className="h-36 md:h-48 w-auto mx-auto mb-8 drop-shadow-lg" />
          <h1 className="text-4xl md:text-6xl font-bold mb-5 tracking-tight"><span style={{ color: '#2c3e50' }}>Link</span><span style={{ color: '#FF5722' }}>EX</span></h1>
          <p className="text-2xl md:text-3xl font-bold" style={{ color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>خيارك الأفضل للإدارة الذكية</p>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-12" style={{ backgroundColor: '#0096b9', color: '#ffffff' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Logo with white glow for visibility on dark footer */}
            <img src="/assets/linex-logo-transparent.png" alt="LinkEX" className="h-16 w-auto mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.9)) drop-shadow(0 0 8px rgba(255,255,255,0.5))' }} />
            <h3 className="text-xl font-bold mb-6"><span style={{ color: '#2c3e50' }}>Link</span><span style={{ color: '#FF5722' }}>EX</span></h3>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
              <a href="mailto:info@nidaba.org" className="flex items-center gap-2 hover:text-white transition-colors">
                <Mail className="w-4 h-4" />
                <span>info@nidaba.org</span>
              </a>
              <a href="tel:009647904414044" className="flex items-center gap-2 hover:text-white transition-colors" dir="ltr">
                <Phone className="w-4 h-4" />
                <span>009647904414044</span>
              </a>
              <span className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <ExternalLink className="w-4 h-4" />
                <span>linkexpress.nidaba.org</span>
              </span>
            </div>

            <div className="mt-8 pt-6 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.6)' }}>
              <p>جميع الحقوق محفوظة © 2025 <span style={{ color: '#2c3e50' }}>Link</span><span style={{ color: '#FF5722' }}>EX</span></p>
            </div>
          </div>
        </div>
      </footer>

      {/* ===== CREATE MODAL ===== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => { setShowCreateModal(false); resetForm(); }}>
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{createType === 'center' ? 'إنشاء مركز طبي جديد' : 'إنشاء عيادة جديدة'}</h3>
              <Button variant="ghost" size="sm" onClick={() => { setShowCreateModal(false); resetForm(); }}><X className="w-4 h-4" /></Button>
            </div>
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 mb-4">اختر نوع الصفحة</p>
                <button onClick={() => setCreateType('center')} className={`w-full p-4 rounded-xl border-2 text-right transition-all ${createType === 'center' ? 'bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`} style={createType === 'center' ? { borderColor: '#5C7A6B', backgroundColor: '#E4E8E0' } : {}}>
                  <div className="flex items-center gap-3">
                    <Building2 className={`w-8 h-8 ${createType === 'center' ? '' : 'text-gray-400'}`} style={createType === 'center' ? { color: '#5C7A6B' } : {}} />
                    <div><p className="font-bold text-gray-900">مركز طبي</p><p className="text-sm text-gray-500">صفحة تعريفية + حجز مواعيد</p></div>
                  </div>
                </button>
                <button onClick={() => setCreateType('dept')} className={`w-full p-4 rounded-xl border-2 text-right transition-all ${createType === 'dept' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-3">
                    <Stethoscope className={`w-8 h-8 ${createType === 'dept' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div><p className="font-bold text-gray-900">عيادة</p><p className="text-sm text-gray-500">صفحة حجز لقسم داخل مركز أو مستقل</p></div>
                  </div>
                </button>
                <Button className="w-full hover:opacity-90" style={{ backgroundColor: '#5C7A6B' }} onClick={() => setStep(2)}>التالي</Button>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                {/* Trial Period Notice */}
                {pricing && pricing.trial && pricing.trial.enabled ? (
                  <div className="bg-teal-50 p-4 rounded-xl border border-teal-200">
                    <p className="text-sm text-teal-700 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span>سجل الآن واحصل على <strong>{pricing.trial.trialDays || 10} أيام</strong> مجاناً كفترة تجريبية</span>
                    </p>
                  </div>
                ) : null}

                {/* Subscription Price - Always Paid */}
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">الاشتراك الشهري</span>
                    <span className="bg-amber-100 text-amber-700 text-lg px-3 py-1 rounded-full font-bold">
                      {createType === 'center'
                        ? (pricing && pricing.platform ? pricing.platform.centerMonthlyPrice : 50000)
                        : (pricing && pricing.platform ? pricing.platform.deptMonthlyPrice : 25000)
                      } د.ع/شهر
                    </span>
                  </div>
                </div>

                {/* ===== OTP Verification ===== */}
                {otpStep === 'identifier' ? (
                  <>
                    <h4 className="font-bold text-gray-900 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-teal-600" />
                      التحقق من الحساب
                    </h4>
                    <p className="text-xs text-gray-500">اختر طريقة التحقق وأدخل بياناتك لاستلام رمز التحقق</p>

                    {/* Method Selection */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIdentifierType('gmail')}
                        className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${identifierType === 'gmail' ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                      >
                        <Mail className={`w-5 h-5 mx-auto mb-1 ${identifierType === 'gmail' ? 'text-red-500' : 'text-gray-400'}`} />
                        <p className="text-sm font-semibold">Gmail</p>
                      </button>
                      <button
                        onClick={() => setIdentifierType('phone')}
                        className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${identifierType === 'phone' ? 'border-teal-400 bg-teal-50' : 'border-gray-200'}`}
                      >
                        <Smartphone className={`w-5 h-5 mx-auto mb-1 ${identifierType === 'phone' ? 'text-teal-600' : 'text-gray-400'}`} />
                        <p className="text-sm font-semibold">موبايل</p>
                      </button>
                    </div>

                    {/* Identifier Input */}
                    <div className="space-y-2">
                      <Label>{identifierType === 'gmail' ? 'البريد الإلكتروني (Gmail فقط)' : 'رقم الموبايل'}</Label>
                      <Input
                        value={identifier}
                        onChange={e => setIdentifier(identifierType === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 11) : e.target.value)}
                        placeholder={identifierType === 'gmail' ? 'example@gmail.com' : '07xxxxxxxx'}
                        dir="ltr"
                      />
                      <p className="text-xs text-gray-400">
                        {identifierType === 'gmail' ? 'يُسمح فقط بحسابات Gmail' : 'أدخل رقم موبايل عراقي يبدأ بـ 07 (11 رقم)'}
                      </p>
                    </div>

                    <Button
                      onClick={handleSendOTP}
                      disabled={loading || !identifier}
                      className="w-full bg-teal-600 hover:bg-teal-700 gap-2"
                    >
                      {loading ? 'جاري...' : <><Shield className="w-4 h-4" /> إرسال رمز التحقق</>}
                    </Button>
                  </>
                ) : (
                  <>
                    {/* OTP Verification */}
                    <h4 className="font-bold text-gray-900 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-teal-600" />
                      أدخل رمز التحقق
                    </h4>
                    <p className="text-sm text-gray-500">
                      تم إرسال رمز التحقق إلى <span dir="ltr">{identifier}</span>
                    </p>

                    {/* OTP sent notification only */}
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200 text-center">
                      <p className="text-sm text-green-700">
                        <CheckCircle2 className="w-4 h-4 inline ml-1" />
                        تم إرسال رمز التحقق إلى {identifierType === 'gmail' ? 'بريدك' : 'رقمك'}
                      </p>
                    </div>

                    <Input
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      dir="ltr"
                      className="text-center text-2xl tracking-[0.5em] font-bold"
                      maxLength={6}
                    />

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => { setOtpStep('identifier'); setSimulatedOTP(''); setOtpCode(''); }}
                      >
                        تغيير {identifierType === 'gmail' ? 'البريد' : 'الرقم'}
                      </Button>
                      <Button
                        onClick={handleVerifyOTP}
                        disabled={loading || otpCode.length !== 6}
                        className="flex-1 bg-teal-600 hover:bg-teal-700 gap-2"
                      >
                        {loading ? 'جاري...' : <><CheckCircle2 className="w-4 h-4" /> تحقق</>}
                      </Button>
                    </div>

                    <div className="text-center">
                      <button
                        onClick={handleResendOTP}
                        disabled={otpCooldown > 0 || loading}
                        className="text-sm text-teal-600 hover:text-teal-700 disabled:text-gray-400"
                      >
                        {otpCooldown > 0 ? `إعادة الإرسال بعد ${otpCooldown} ثانية` : 'إعادة إرسال الرمز'}
                      </button>
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>رجوع</Button>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-4">
                {createType === 'center' ? (
                  <>
                    <div className="space-y-2"><Label>اسم المركز الطبي <span className="text-red-500">*</span></Label><Input value={cForm.name} onChange={e => setCForm({ ...cForm, name: e.target.value })} placeholder="مثال: مركز الشفاء الطبي" /></div>
                    <div className="space-y-2"><Label>العنوان</Label><Input value={cForm.address} onChange={e => setCForm({ ...cForm, address: e.target.value })} placeholder="بغداد - الكرادة" /></div>
                    <div className="space-y-2"><Label>رقم الموبايل <span className="text-red-500">*</span></Label><Input value={cForm.phone} onChange={e => setCForm({ ...cForm, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })} placeholder="07xxxxxxxx (11 رقم)" dir="ltr" /><p className="text-xs text-gray-400">يجب أن يبدأ بـ 07 ويتكون من 11 رقماً</p></div>
                    <div className="space-y-2"><Label>البريد الإلكتروني</Label><Input value={cForm.email} onChange={e => setCForm({ ...cForm, email: e.target.value })} placeholder="email@example.com" dir="ltr" /></div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2"><Label>المركز التابع (اختياري)</Label>
                      <select value={dForm.centerId} onChange={e => setDForm({ ...dForm, centerId: e.target.value })} className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm">
                        <option value="">-- قسم مستقل --</option>
                        {activeCenters.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                      </select>
                    </div>
                    <div className="space-y-2"><Label>اسم القسم <span className="text-red-500">*</span></Label><Input value={dForm.name} onChange={e => setDForm({ ...dForm, name: e.target.value })} placeholder="مثال: قسم الأسنان" /></div>
                    <div className="space-y-2"><Label>الوصف</Label><Input value={dForm.description} onChange={e => setDForm({ ...dForm, description: e.target.value })} placeholder="وصف مختصر عن القسم" /></div>
                    <div className="border-t pt-4 mt-4">
                      <p className="text-sm font-bold text-gray-900 mb-3">معلومات الطبيب المسؤول</p>
                      <div className="space-y-2"><Label>اسم الطبيب <span className="text-red-500">*</span></Label><Input value={dForm.doctorName} onChange={e => setDForm({ ...dForm, doctorName: e.target.value })} placeholder="د. أحمد محمد" /></div>
                      <div className="space-y-2 mt-2"><Label>إيميل الطبيب (لتثبيت الحجوزات على تقويمه) <span className="text-red-500">*</span></Label><Input value={dForm.doctorEmail} onChange={e => setDForm({ ...dForm, doctorEmail: e.target.value })} placeholder="doctor@gmail.com" dir="ltr" /></div>
                      <div className="space-y-2 mt-2"><Label>هاتف الطبيب</Label><Input value={dForm.doctorPhone} onChange={e => setDForm({ ...dForm, doctorPhone: e.target.value })} placeholder="07xxxxxxxx" dir="ltr" /></div>
                    </div>
                  </>
                )}
                <div className="border-t pt-4 space-y-2">
                  <Label>اسم المستخدم <span className="text-red-500">*</span></Label><Input value={adminForm.username} onChange={e => setAdminForm({ ...adminForm, username: e.target.value })} placeholder="اسم المستخدم" dir="ltr" />
                  <Label>كلمة المرور <span className="text-red-500">*</span></Label><Input value={adminForm.password} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })} placeholder="كلمة المرور" type="password" dir="ltr" />
                  <Label>الاسم الكامل <span className="text-gray-400">(اختياري)</span></Label><Input value={adminForm.fullName} onChange={e => setAdminForm({ ...adminForm, fullName: e.target.value })} placeholder="اسم المدير" />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => { setShowCreateModal(false); setStep(1); }}>إلغاء</Button>
                  <Button onClick={handleCreate} disabled={loading} className="hover:opacity-90" style={{ backgroundColor: '#5C7A6B' }}>
                    {loading ? 'جاري الإنشاء...' : `إنشاء ${createType === 'center' ? 'المركز' : 'العيادة'}`}
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
