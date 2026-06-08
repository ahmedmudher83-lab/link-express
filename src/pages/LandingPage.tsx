import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useLinexData } from '@/hooks/useLinexData';
import { saveAdmin, saveCenter, saveDepartment } from '@/services/dataStorage';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import type { Center, Department, Admin } from '@/types/linex';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Lock, Plus, Phone, Mail, ExternalLink, CalendarDays,
  X, Save, CheckCircle2, Stethoscope, Building2, Clock, MapPin,
  User, Shield
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const { pricing, getActiveCenters, getIndependentDepartments, addCenter, addDepartment } = useLinexData();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'center' | 'dept'>('center');
  const [step, setStep] = useState(1);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Form state
  const [gmail, setGmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verified, setVerified] = useState(false);

  // Center/Dept details
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

  const resetForm = () => {
    setGmail(''); setPassword(''); setConfirmPassword('');
    setVerificationSent(false); setVerified(false);
    setCName(''); setCAddress(''); setCPhone('');
    setDName(''); setDDesc(''); setDDoctor('');
    setStep(1);
  };

  // Check if email is verified
  useEffect(() => {
    if (!verificationSent || !auth || !gmail) return;
    const interval = setInterval(async () => {
      try {
        await signInWithEmailAndPassword(auth, gmail, password);
        if (auth.currentUser?.emailVerified) {
          setVerified(true);
          clearInterval(interval);
        } else {
          await auth.currentUser?.reload();
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [verificationSent, gmail, password]);

  // Step 2: Send verification email via Firebase Auth
  const handleSendVerification = async () => {
    if (!gmail || !isValidGmail(gmail)) { showMsg('أدخل بريد Gmail صحيح (@gmail.com)'); return; }
    if (!password || password.length < 6) { showMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (password !== confirmPassword) { showMsg('كلمتا المرور غير متطابقتين'); return; }

    setLoading(true);
    try {
      if (!auth) throw new Error('Firebase not initialized');
      
      // Create Firebase Auth user (sends verification email automatically)
      await createUserWithEmailAndPassword(auth, gmail, password);
      
      // Send verification email
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
      }
      
      setVerificationSent(true);
      showMsg('تم إرسال رابط التحقق لبريدك! اذهب لبريدك واضغط الرابط');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        showMsg('هذا البريد مسجل مسبقاً');
      } else {
        showMsg(err.message || 'فشل إرسال رابط التحقق');
      }
    }
    setLoading(false);
  };

  // Step 3: Create account after verification
  const handleCreate = async () => {
    if (!verified) { showMsg('يرجى التحقق من بريدك أولاً'); return; }
    if (createType === 'center' && (!cName || !cPhone)) { showMsg('أدخل اسم المركز ورقم الموبايل'); return; }
    if (createType === 'center' && !isValidPhone(cPhone)) { showMsg('رقم الموبايل يجب أن يكون 11 رقماً يبدأ بـ 07'); return; }
    if (createType === 'dept' && (!dName || !dDoctor)) { showMsg('أدخل اسم العيادة واسم الطبيب'); return; }

    setLoading(true);
    const adminId = 'admin-' + Date.now();
    const centerId = 'center-' + Date.now();
    const deptId = 'dept-' + Date.now();
    const trialDays = pricing?.trial?.enabled ? (pricing?.trial?.trialDays || 10) : 0;
    const subPrice = pricing?.platform
      ? (createType === 'center' ? pricing.platform.centerMonthlyPrice : pricing.platform.deptMonthlyPrice)
      : (createType === 'center' ? 50000 : 25000);

    // Generate username from Gmail prefix
    const username = gmail.split('@')[0];

    // Create admin
    const admin: Admin = {
      id: adminId,
      fullName: createType === 'center' ? cName : dName,
      username,
      password, // Note: in production, hash this
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
      showMsg(`تم إنشاء مركز "${cName}" بنجاح! تسجيل الدخول بـ: ${username}`);
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
      showMsg(`تم إنشاء عيادة "${dName}" بنجاح! تسجيل الدخول بـ: ${username}`);
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
              {step === 2 && 'التحقق من البريد الإلكتروني'}
              {step === 3 && `بيانات ${createType === 'center' ? 'المركز' : 'العيادة'}`}
            </h3>

            {msg && (
              <div className={`mb-4 p-3 rounded-lg text-sm text-center ${msg.includes('فشل') || msg.includes('خطأ') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {msg}
              </div>
            )}

            {/* Step 1: Select Type */}
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
                  التالي
                </Button>
              </div>
            )}

            {/* Step 2: Gmail + Password + Verification */}
            {step === 2 && (
              <div className="space-y-4">
                {!verificationSent ? (
                  <>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-red-500" />
                        بريد Gmail <span className="text-red-500">*</span>
                      </Label>
                      <Input value={gmail} onChange={e => setGmail(e.target.value)} placeholder="example@gmail.com" dir="ltr" />
                      <p className="text-xs text-gray-400">يُسمح فقط بحسابات Gmail (@gmail.com)</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        كلمة المرور <span className="text-red-500">*</span>
                      </Label>
                      <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6 أحرف على الأقل" dir="ltr" />
                    </div>

                    <div className="space-y-2">
                      <Label>تأكيد كلمة المرور <span className="text-red-500">*</span></Label>
                      <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="أعد كتابة كلمة المرور" dir="ltr" />
                    </div>

                    <Button
                      onClick={handleSendVerification}
                      disabled={loading}
                      className="w-full bg-teal-600 hover:bg-teal-700 gap-2"
                    >
                      {loading ? 'جاري الإرسال...' : <><Shield className="w-4 h-4" /> إرسال رابط التحقق</>}
                    </Button>
                  </>
                ) : (
                  <div className="text-center space-y-4">
                    {!verified ? (
                      <>
                        <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                          <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
                          <p className="text-lg font-bold text-green-800">تم إرسال رابط التحقق!</p>
                          <p className="text-sm text-green-600 mt-1">
                            اذهب إلى بريدك <strong dir="ltr">{gmail}</strong> واضغط على رابط التحقق
                          </p>
                        </div>
                        <p className="text-xs text-gray-500">يتم التحقق تلقائياً...</p>
                      </>
                    ) : (
                      <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                        <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
                        <p className="text-lg font-bold text-green-800">تم التحقق بنجاح!</p>
                        <p className="text-sm text-green-600">يمكنك الآن إكمال إنشاء الحساب</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>رجوع</Button>
                  {verified && (
                    <Button className="flex-1" style={{ backgroundColor: '#5C7A6B' }} onClick={() => setStep(3)}>
                      أكمل التسجيل
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Center/Dept Details */}
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
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>رجوع</Button>
                  <Button
                    onClick={handleCreate}
                    disabled={loading}
                    className="flex-1"
                    style={{ backgroundColor: '#5C7A6B' }}
                  >
                    {loading ? 'جاري...' : 'إنشاء الحساب'}
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
