import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useLinexData } from '@/hooks/useLinexData';
import type { Admin } from '@/types/linex';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus, Phone, Mail, ExternalLink, CalendarDays,
  X, Save, CheckCircle2, Stethoscope, Building2, Clock, MapPin,
  Send, ShieldCheck, Lock, AlertCircle
} from 'lucide-react';
import { sendEmailVerificationLink, checkEmailSignInLink, completeEmailSignIn } from '@/services/firebaseAuthService';

export default function LandingPage() {
  const navigate = useNavigate();
  const { addAdmin, createAccountWithOTP } = useAuth();
  const { pricing, getDepartmentsByCenter, getActiveCenters } = useLinexData();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'center' | 'dept'>('center');
  const [step, setStep] = useState(1);
  const [msg, setMsg] = useState('');

  // Gmail + Auth Link states
  const [gmail, setGmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [emailVerified, setEmailVerified] = useState(false);
  // Password states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [cForm, setCForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [dForm, setDForm] = useState({ name: '', description: '', doctorEmail: '', centerId: '' });

  const showMsg = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 3000); };
  const activeCenters = getActiveCenters();

  // Check email sign-in link on mount AND when user returns from email app
  useEffect(() => {
    // FIRST: Check URL params (cross-device: email link opened on different device)
    // Firebase adds oobCode to the URL when processing email link
    const urlParams = new URLSearchParams(window.location.search);
    const emailFromUrl = urlParams.get('email');
    const typeFromUrl = urlParams.get('type') as 'center' | 'dept' | null;
    const verified = urlParams.get('verified');
    const hasOobCode = urlParams.has('oobCode'); // Firebase adds this
    
    // Check if this is a verified email link (either via our verified param OR Firebase oobCode)
    if (emailFromUrl && (verified === '1' || hasOobCode)) {
      // User opened email link on this device - auto-open modal at Step 3
      setGmail(emailFromUrl);
      if (typeFromUrl) setCreateType(typeFromUrl);
      setOtpSent(true);
      setEmailVerified(true);
      localStorage.setItem('emailVerified', 'true');
      setShowCreateModal(true);
      showMsg('تم التحقق من بريدك! أكمل إنشاء الحساب');
      setStep(3);
      // Clean URL (remove Firebase params)
      window.history.replaceState({}, document.title, window.location.pathname);
      return; // Skip Firebase link verification - already verified
    }
    
    // Check if email was previously verified (survives page refresh)
    if (localStorage.getItem('emailVerified') === 'true') {
      setEmailVerified(true);
    }
    // Check if we have a pending email verification from localStorage
    const pendingEmail = localStorage.getItem('pendingVerificationEmail');
    const pendingType = localStorage.getItem('pendingVerificationType') as 'center' | 'dept' | null;
    if (pendingEmail) {
      setGmail(pendingEmail);
      if (pendingType) setCreateType(pendingType);
      setOtpSent(true);
    }

    const checkLink = () => {
      if (checkEmailSignInLink(window.location.href)) {
        showMsg('جاري التحقق من الرابط...');
        completeEmailSignIn(window.location.href).then(result => {
          if (result.success && result.email) {
            setGmail(result.email);
            if (result.type) setCreateType(result.type as 'center' | 'dept');
            setOtpSent(true);
            setEmailVerified(true);
            localStorage.setItem('emailVerified', 'true');
            setShowCreateModal(true); // ← فتح النافذة تلقائياً!
            showMsg('تم التحقق من بريدك بنجاح! أكمل إنشاء الحساب');
            setStep(3);
          } else {
            console.warn('Email link verification:', result.error);
          }
        });
      }
    };
    // Check immediately on mount
    checkLink();
    // Also check when user returns to this tab (from email app)
    const handleFocus = () => { setTimeout(checkLink, 500); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const visibleCenters = activeCenters.filter(c => {
    if (c.appearanceType === 'hidden') return false;
    if (c.appearanceType === 'free_trial') return new Date(c.appearanceExpiry) > new Date();
    return c.appearanceType === 'paid';
  });

  const handleCreate = async () => {
    console.log('[DEBUG] Step 1: handleCreate called');
    console.log('[DEBUG] gmail:', gmail, '| emailVerified:', emailVerified);
    console.log('[DEBUG] password exists:', !!password, '| step:', step, '| createType:', createType);
    
    // Check email verification
    if (!gmail) { console.log('[DEBUG] FAILED: no gmail'); showMsg('يرجى إدخال بريد Gmail'); return; }
    console.log('[DEBUG] Step 2: gmail check passed');

    const trialDays = pricing.trial.enabled ? pricing.trial.trialDays : 0;
    const now = new Date().toISOString();
    const expiry = new Date(Date.now() + (trialDays + 30) * 86400000).toISOString();
    const appearanceExpiry = new Date(Date.now() + 3 * 86400000).toISOString();
    console.log('[DEBUG] Step 3: dates calculated, trialDays:', trialDays);

    let finalPassword = password || Math.random().toString(36).slice(2) + Date.now().toString(36);
    console.log('[DEBUG] Step 4: finalPassword set, length:', finalPassword.length);

    const fullName = createType === 'center' ? cForm.name : dForm.name;
    const adminId = 'admin-' + Date.now();
    const centerId = createType === 'center' ? 'center-' + Date.now() : undefined;
    const deptId = createType === 'dept' ? 'dept-' + Date.now() : undefined;
    console.log('[DEBUG] Step 5: IDs generated - adminId:', adminId);

    const newAdmin: Admin = { id: adminId, fullName, username: gmail.toLowerCase(), password: finalPassword, role: createType === 'center' ? 'center' : 'department', phone: cForm.phone || '', email: gmail.toLowerCase(), centerId, departmentId: deptId, isActive: true, createdAt: now };
    console.log('[DEBUG] Step 6: newAdmin created');

    console.log('[DEBUG] Step 7: Calling addAdmin...');
    const error = addAdmin(newAdmin);
    console.log('[DEBUG] Step 8: addAdmin returned:', error || '(no error)');
    if (error) { showMsg(error); console.log('[DEBUG] FAILED: addAdmin error:', error); return; }

    console.log('[DEBUG] Step 9: Saving center/dept...');
    try {
      if (createType === 'center') {
        if (!cForm.name || !cForm.phone) { showMsg('يرجى إدخال اسم المركز ورقم الموبايل'); return; }
        const { saveCenter } = await import('@/services/dataStorage');
        console.log('[DEBUG] Step 10: saveCenter imported');
        await saveCenter({ id: centerId!, name: cForm.name, address: cForm.address, phone: cForm.phone, email: gmail, logo: '', workingDays: ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'], workingHours: '8:00 ص - 10:00 م', fridayHours: '4:00 م - 9:00 م', emergencyHours: '24 ساعة', consultationDuration: 15, doctors: [], adminId, activationType: 'paid', subscriptionPrice: pricing.platform.centerMonthlyPrice, freeTrialDays: trialDays, createdAt: now, expiresAt: expiry, isPaid: true, isActive: true, status: (trialDays > 0 ? 'trial' : 'active') as const, appearanceType: 'free_trial', appearanceExpiry, promoImages: [], promoText: '' });
        console.log('[DEBUG] Step 11: saveCenter DONE');
        const trialMsg = trialDays > 0 ? ` (اشتراك مجاني لمدة ${trialDays} أيام + 30 يوم مدفوع)` : '';
        setShowCreateModal(false); resetForm(); showMsg(`تم إنشاء مركز "${cForm.name}" بنجاح!${trialMsg}`);
        console.log('[DEBUG] Step 12: SUCCESS - center created');
      } else {
        if (!dForm.name) { showMsg('يرجى إدخال اسم القسم'); return; }
        const { saveDepartment } = await import('@/services/dataStorage');
        console.log('[DEBUG] Step 10: saveDepartment imported');
        await saveDepartment({ id: deptId!, name: dForm.name, description: dForm.description, icon: 'Stethoscope', doctorName: '', doctorEmail: dForm.doctorEmail, doctorPhone: '', logo: '', workingDays: ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'], workingHours: '8:00 ص - 10:00 م', fridayHours: '4:00 م - 9:00 م', consultationDuration: 15, centerId: dForm.centerId || null, adminId, activationType: 'paid', subscriptionPrice: pricing.platform.deptMonthlyPrice, freeTrialDays: trialDays, createdAt: now, expiresAt: expiry, isPaid: true, isActive: true, status: (trialDays > 0 ? 'trial' : 'active') as const, appearanceType: 'free_trial', appearanceExpiry, promoImages: [], promoText: '' });
        console.log('[DEBUG] Step 11: saveDepartment DONE');
        const trialMsg = trialDays > 0 ? ` (اشتراك مجاني لمدة ${trialDays} أيام + 30 يوم مدفوع)` : '';
        setShowCreateModal(false); resetForm(); showMsg(`تم إنشاء عيادة "${dForm.name}" بنجاح!${trialMsg}`);
        console.log('[DEBUG] Step 12: SUCCESS - department created');
      }
    } catch (err: any) {
      console.error('[DEBUG] CATCH ERROR:', err);
      showMsg('خطأ: ' + (err.message || 'Unknown'));
    }
  };

  const resetForm = () => {
    setCForm({ name: '', address: '', phone: '', email: '' });
    setDForm({ name: '', description: '', doctorEmail: '', centerId: '' });
    setGmail(''); setOtpSent(false); setOtpCooldown(0); setEmailVerified(false);
    setPassword(''); setConfirmPassword('');
    setStep(1);
    localStorage.removeItem('pendingVerificationEmail');
    localStorage.removeItem('pendingVerificationType');
    localStorage.removeItem('emailVerified');
  };

  // ==== Firebase Auth Link Functions ====
  const isValidGmail = (email: string) => /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email);

  const handleSendAuthLink = async () => {
    if (!isValidGmail(gmail)) { showMsg('يرجى إدخال بريد Gmail صحيح'); return; }
    setOtpSent(true);
    // Save pending verification state (survives page refresh)
    localStorage.setItem('pendingVerificationEmail', gmail);
    localStorage.setItem('pendingVerificationType', createType);
    // Send real Firebase Auth email link WITH type info in URL
    const result = await sendEmailVerificationLink(gmail, createType);
    if (result.success) {
      showMsg('تم إرسال رابط التحقق! تحقق من بريدك');
      setOtpCooldown(60);
      const timer = setInterval(() => { setOtpCooldown(c => { if (c <= 1) clearInterval(timer); return c - 1; }); }, 1000);
    } else {
      showMsg(result.error || 'فشل إرسال رابط التحقق');
      setOtpSent(false);
    }
  };

  const handleVerifyLink = async () => {
    // Try Firebase Email Link first
    if (checkEmailSignInLink(window.location.href)) {
      const result = await completeEmailSignIn(window.location.href);
      if (result.success) {
        showMsg('تم التحقق بنجاح! اختر كلمة المرور');
        setStep(3);
        return;
      }
    }
    // Fallback: verify OTP code locally
    if (!otpCode || otpCode.length !== 6) { showMsg('يرجى إدخال رمز التحقق المكون من 6 أرقام'); return; }
    showMsg('الرجاء فتح الرابط المرسل لبريدك أولاً');
  };

  const handleSetPassword = () => {
    if (!password || password.length < 6) { showMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (password !== confirmPassword) { showMsg('كلمة المرور وتأكيدها غير متطابقين'); return; }
    showMsg('تم حفظ كلمة المرور! أكمل بياناتك');
    setStep(4); // بيانات المركز/العيادة
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F0E6' }}>
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-50" style={{ backgroundColor: '#F5F0E6' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/linex-logo-transparent.png" alt="LinkEX" className="h-9 w-auto" />
            <span className="font-bold text-lg hidden sm:inline"><span style={{ color: '#283850' }}>Link</span><span style={{ color: '#f84000' }}>EX</span></span>
          </div>
          <div className="flex items-center gap-3">
            {msg && <span className="hidden md:flex text-sm text-green-400 bg-green-400/10 px-3 py-1 rounded-full"><CheckCircle2 className="w-4 h-4 ml-1" />{msg}</span>}
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => navigate('/login')}>
              <span className="ml-1">تسجيل الدخول</span>
              <Lock className="w-4 h-4" />
            </Button>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => { setCreateType('center'); setShowCreateModal(true); }}>
              <span className="ml-1">لأول مرة</span>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ===== HERO SECTION ===== */}
      <section className="py-16 md:py-24" style={{ backgroundColor: '#F5F0E6' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <img src="/assets/linex-logo-transparent.png" alt="Link Express" className="h-36 md:h-48 w-auto mx-auto mb-6 drop-shadow-2xl" />
          <h1 className="text-4xl md:text-6xl font-bold mb-4"><span style={{ color: '#283850' }}>Link</span><span style={{ color: '#f84000' }}>EX</span></h1>
          <p className="text-2xl md:text-3xl font-bold mb-8" style={{ color: '#0D9488' }}>خيارك الأفضل للإدارة الذكية</p>
        </div>
      </section>

      {/* ===== ADVERTISING CENTERS ===== */}
      <section className="py-12" style={{ backgroundColor: '#F5F0E6' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">


          {visibleCenters.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleCenters.map(c => {
                const depts = getDepartmentsByCenter(c.id);
                return (
                  <Card key={c.id} className="overflow-hidden hover:shadow-xl transition-all border-0 shadow-sm">
                    {/* Promo Images */}
                    {c.promoImages && c.promoImages.length > 0 && (
                      <div className="relative h-48 bg-gray-100">
                        <img src={c.promoImages[0]} alt={c.name} className="w-full h-full object-cover" />
                        {c.promoImages.length > 1 && (
                          <div className="absolute bottom-2 right-2 flex gap-1">
                            {c.promoImages.map((_, i) => (
                              <div key={i} className="w-2 h-2 rounded-full bg-white/80" />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-6">
                      {/* Logo + Name */}
                      <div className="text-center mb-3">
                        {c.logo ? (
                          <img src={c.logo} alt={c.name} className="w-16 h-16 mx-auto rounded-xl object-contain mb-2" />
                        ) : (
                          <Building2 className="w-10 h-10 mx-auto text-teal-600 mb-2" />
                        )}
                        <h3 className="text-lg font-bold text-gray-900">{c.name}</h3>
                      </div>
                      {/* Promo Text */}
                      {c.promoText && (
                        <p className="text-sm text-gray-600 mb-3 bg-teal-50 p-3 rounded-lg text-center">{c.promoText}</p>
                      )}
                      {/* Info */}
                      <div className="text-center text-sm text-gray-500 mb-3 space-y-1">
                        <p><MapPin className="w-4 h-4 inline text-gray-400 ml-1" />{c.address || 'غير محدد'}</p>
                        <p dir="ltr"><Phone className="w-4 h-4 inline text-gray-400 ml-1" />{c.phone}</p>
                      </div>
                      {/* Dept count */}
                      <p className="text-center text-xs text-gray-400 mb-4">
                        <Stethoscope className="w-3 h-3 inline ml-1" />{depts.length} تخصص | <Clock className="w-3 h-3 inline ml-1" />كشف {c.consultationDuration} دقيقة
                      </p>
                      {/* Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button className="bg-teal-600 hover:bg-teal-700" size="sm" onClick={() => navigate(`/center/${c.id}/booking`)}>
                          <CalendarDays className="w-4 h-4" /> احجز
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/center/${c.id}`)}>
                          <ExternalLink className="w-4 h-4" /> تفاصيل
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-12 text-gray-600" style={{ backgroundColor: '#F5F0E6' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <img src="/assets/linex-logo-transparent.png" alt="LinkEX" className="h-16 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2"><span style={{ color: '#283850' }}>Link</span><span style={{ color: '#f84000' }}>EX</span></h3>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm">
              <a href="mailto:info@nidaba.org" className="flex items-center gap-2 hover:text-teal-600 transition-colors">
                <Mail className="w-4 h-4" />
                <span>info@nidaba.org</span>
              </a>
              <a href="tel:009647904414044" className="flex items-center gap-2 hover:text-teal-600 transition-colors" dir="ltr">
                <Phone className="w-4 h-4" />
                <span>009647904414044</span>
              </a>
              <span className="flex items-center gap-2" style={{ color: '#0D9488' }}>
                <ExternalLink className="w-4 h-4" />
                <span>linkexpress.nidaba.org</span>
              </span>
            </div>

            <div className="mt-8 pt-6 text-xs" style={{ borderTop: '1px solid #D6CBB5' }}>
              <p>جميع الحقوق محفوظة &copy; 2025 <span style={{ color: '#283850' }} className="font-bold">Link</span><span style={{ color: '#f84000' }} className="font-bold">EX</span></p>
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
                <button onClick={() => setCreateType('center')} className={`w-full p-4 rounded-xl border-2 text-right transition-all ${createType === 'center' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-3">
                    <Building2 className={`w-8 h-8 ${createType === 'center' ? 'text-teal-600' : 'text-gray-400'}`} />
                    <div><p className="font-bold text-gray-900">مركز طبي</p><p className="text-sm text-gray-500">صفحة تعريفية + حجز مواعيد</p></div>
                  </div>
                </button>
                <button onClick={() => setCreateType('dept')} className={`w-full p-4 rounded-xl border-2 text-right transition-all ${createType === 'dept' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-3">
                    <Stethoscope className={`w-8 h-8 ${createType === 'dept' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div><p className="font-bold text-gray-900">عيادة</p><p className="text-sm text-gray-500">صفحة حجز لقسم داخل مركز أو مستقل</p></div>
                  </div>
                </button>
                <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={() => setStep(2)}>التالي</Button>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                {/* رسالة الفترة التجريبية */}
                {pricing.trial.enabled && pricing.trial.trialDays > 0 && (
                  <div className="p-4 rounded-xl border-2 border-teal-200 bg-teal-50 text-center">
                    <p className="font-bold text-teal-700">اشترك الآن واحصل على اشتراك مجاني لمدة {pricing.trial.trialDays} يوم</p>
                    <p className="text-xs text-teal-600 mt-1">(تبدأ الفترة المدفوعة بعد انتهاء الفترة المجانية)</p>
                  </div>
                )}
                {/* Gmail + Auth Link */}
                <div className="space-y-2">
                  <Label>بريد Gmail <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2">
                    <Input value={gmail} onChange={e => setGmail(e.target.value)} placeholder="example@gmail.com" dir="ltr" className="flex-1" />
                    <Button onClick={handleSendAuthLink} disabled={otpSent && otpCooldown > 0} className="bg-teal-600 hover:bg-teal-700 whitespace-nowrap">
                      <Send className="w-4 h-4 ml-1" />
                      {otpCooldown > 0 ? `${otpCooldown} ث` : 'إرسال رابط التحقق'}
                    </Button>
                  </div>
                </div>
                {otpSent && !emailVerified && (
                  <div className="space-y-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm font-bold text-amber-800">تم إرسال رابط التحقق!</p>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      تحقق من بريدك الإلكتروني <strong>({gmail})</strong> واضغط على الرابط المرسل.
                    </p>
                    <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      لم تجد الرابط؟ تحقق من مجلد Spam أو Junk
                    </p>
                    <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-xl text-center">
                      <p className="text-base text-blue-800 font-bold">📧 افتح الرابط من بريدك الإلكتروني</p>
                      <p className="text-sm text-blue-700 mt-2 leading-relaxed">
                        تم إرسال رابط خاص إلى بريدك. اضغط على الرابط في بريدك وأكمل خطوات إنشاء الحساب.
                      </p>
                    </div>
                    {otpCooldown === 0 && (
                      <Button onClick={handleSendAuthLink} variant="outline" className="w-full text-sm">
                        <Send className="w-3 h-3 ml-1" /> إعادة إرسال الرابط
                      </Button>
                    )}
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>رجوع</Button>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 mb-4">اختر كلمة المرور</p>
                <div className="space-y-2">
                  <Label>كلمة المرور <span className="text-red-500">*</span></Label>
                  <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" dir="ltr" type="password" minLength={6} />
                </div>
                <div className="space-y-2">
                  <Label>تأكيد كلمة المرور <span className="text-red-500">*</span></Label>
                  <Input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••" dir="ltr" type="password" />
                </div>
                {password && confirmPassword && password !== confirmPassword && (
                  <p className="text-sm text-red-500">كلمتا المرور غير متطابقتين</p>
                )}
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>رجوع</Button>
                  <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={handleSetPassword} disabled={!password || password.length < 6 || password !== confirmPassword}>
                    التالي
                  </Button>
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="space-y-4">
                {createType === 'center' ? (
                  <>
                    <div className="space-y-2"><Label>اسم المركز الطبي <span className="text-red-500">*</span></Label><Input value={cForm.name} onChange={e => setCForm({ ...cForm, name: e.target.value })} placeholder="مثال: مركز الشفاء الطبي" /></div>
                    <div className="space-y-2"><Label>العنوان</Label><Input value={cForm.address} onChange={e => setCForm({ ...cForm, address: e.target.value })} placeholder="بغداد - الكرادة" /></div>
                    <div className="space-y-2"><Label>رقم الموبايل <span className="text-red-500">*</span></Label><Input value={cForm.phone} onChange={e => setCForm({ ...cForm, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })} placeholder="07xxxxxxxx" dir="ltr" /></div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2"><Label>المركز التابع (اختياري)</Label>
                      <select value={dForm.centerId} onChange={e => setDForm({ ...dForm, centerId: e.target.value })} className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm">
                        <option value="">-- قسم مستقل --</option>
                        {activeCenters.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                      </select>
                    </div>
                    <div className="space-y-2"><Label>اسم القسم / التخصص <span className="text-red-500">*</span></Label><Input value={dForm.name} onChange={e => setDForm({ ...dForm, name: e.target.value })} placeholder="مثال: قسم العظام" /></div>
                    <div className="space-y-2"><Label>الوصف</Label><Input value={dForm.description} onChange={e => setDForm({ ...dForm, description: e.target.value })} placeholder="وصف مختصر" /></div>
                    <div className="space-y-2"><Label>إيميل الطبيب</Label><Input value={dForm.doctorEmail} onChange={e => setDForm({ ...dForm, doctorEmail: e.target.value })} placeholder="doctor@email.com" dir="ltr" /></div>
                  </>
                )}
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>رجوع</Button>
                  <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={() => handleCreate().catch(err => showMsg('خطأ: ' + err.message))} disabled={createType === 'center' ? !cForm.name || !cForm.phone : !dForm.name}>
                    <Save className="w-4 h-4" /> إنشاء
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
