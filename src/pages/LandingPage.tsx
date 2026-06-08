import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useLinexData } from '@/hooks/useLinexData';
import type { ActivationType, Center, Department } from '@/types/linex';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Lock, Plus, Phone, Mail, ExternalLink, CalendarDays,
  X, Save, CheckCircle2, Stethoscope, Building2, Clock, MapPin
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const { pricing, getDepartmentsByCenter, getActiveCenters, addCenter, addDepartment } = useLinexData();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'center' | 'dept'>('center');
  const [step, setStep] = useState(1);
  const [activationType, setActivationType] = useState<ActivationType>('paid');
  const [msg, setMsg] = useState('');

  const [cForm, setCForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [dForm, setDForm] = useState({ name: '', description: '', doctorName: '', doctorEmail: '', doctorPhone: '', centerId: '' });
  const [adminForm, setAdminForm] = useState({ fullName: '', username: '', password: '' });

  const showMsg = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 3000); };
  const activeCenters = getActiveCenters();

  const visibleCenters = activeCenters.filter(c => {
    if (c.appearanceType === 'hidden') return false;
    return c.appearanceType === 'paid';
  });

  const handleCreate = () => {
    if (!adminForm.username || !adminForm.password) { showMsg('يرجى إدخال اسم المستخدم وكلمة المرور'); return; }

    const adminId = 'admin-' + Date.now();
    const trialDays = pricing.trial?.enabled ? (pricing.trial?.trialDays || 10) : 0;
    const centerId = 'center-' + Date.now();
    const deptId = 'dept-' + Date.now();

    // Save admin to localStorage
    const existingAdmins = JSON.parse(localStorage.getItem('linex_admins') || '[]');
    const admin: Admin = {
      id: adminId,
      fullName: adminForm.fullName || (createType === 'center' ? cForm.name : dForm.name),
      username: adminForm.username,
      password: adminForm.password,
      role: createType === 'center' ? 'center' : 'department',
      phone: cForm.phone || '',
      email: cForm.email || dForm.doctorEmail || '',
      centerId: createType === 'center' ? centerId : (dForm.centerId || undefined),
      departmentId: createType === 'dept' ? deptId : undefined,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    existingAdmins.push(admin);
    localStorage.setItem('linex_admins', JSON.stringify(existingAdmins));

    if (createType === 'center') {
      if (!cForm.name || !cForm.phone) return;
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
        subscriptionPrice: pricing.platform.centerMonthlyPrice,
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
      const existingCenters = JSON.parse(localStorage.getItem('linex_centers') || '[]');
      existingCenters.push(newCenter);
      localStorage.setItem('linex_centers', JSON.stringify(existingCenters));
      addCenter(newCenter);
      setShowCreateModal(false);
      showMsg(`تم إنشاء مركز "${cForm.name}" بنجاح! يمكنك تسجيل الدخول باسم المستخدم: ${adminForm.username}`);
    } else {
      if (!dForm.name) return;
      const newDept: Department = {
        id: deptId,
        name: dForm.name,
        description: dForm.description,
        icon: 'Stethoscope',
        doctorName: dForm.doctorName,
        doctorEmail: dForm.doctorEmail,
        doctorPhone: dForm.doctorPhone,
        logo: '',
        // ===== Department's OWN independent schedule =====
        workingDays: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
        startTime: '09:00',
        endTime: '14:00',
        consultationDuration: 15,
        daysOff: ['الجمعة'],
        vacationDays: [],
        bookingWindow: 7,
        // Legacy fields
        workingHours: '09:00 - 14:00',
        fridayHours: '',
        centerId: dForm.centerId || null,
        adminId,
        activationType: 'paid',
        subscriptionPrice: pricing.platform.deptMonthlyPrice,
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
      const existingDepts = JSON.parse(localStorage.getItem('linex_departments') || '[]');
      existingDepts.push(newDept);
      localStorage.setItem('linex_departments', JSON.stringify(existingDepts));
      addDepartment(newDept);
      setShowCreateModal(false);
      showMsg(`تم إنشاء عيادة "${dForm.name}" بنجاح! يمكنك تسجيل الدخول باسم المستخدم: ${adminForm.username}`);
    }
    resetForm();
  };

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
                {pricing.trial?.enabled && (
                  <div className="bg-teal-50 p-4 rounded-xl border border-teal-200">
                    <p className="text-sm text-teal-700 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span>سجل الآن واحصل على <strong>{pricing.trial?.trialDays || 10} أيام</strong> مجاناً كفترة تجريبية</span>
                    </p>
                  </div>
                )}

                {/* Subscription Price - Always Paid */}
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">الاشتراك الشهري</span>
                    <Badge className="bg-amber-100 text-amber-700 text-lg">{createType === 'center' ? pricing.platform.centerMonthlyPrice : pricing.platform.deptMonthlyPrice} د.ع/شهر</Badge>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>رجوع</Button>
                  <Button className="flex-1 hover:opacity-90" style={{ backgroundColor: '#5C7A6B' }} onClick={() => setStep(3)}>التالي</Button>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-4">
                {createType === 'center' ? (
                  <>
                    <div className="space-y-2"><Label>اسم المركز الطبي <span className="text-red-500">*</span></Label><Input value={cForm.name} onChange={e => setCForm({ ...cForm, name: e.target.value })} placeholder="مثال: مركز الشفاء الطبي" /></div>
                    <div className="space-y-2"><Label>العنوان</Label><Input value={cForm.address} onChange={e => setCForm({ ...cForm, address: e.target.value })} placeholder="بغداد - الكرادة" /></div>
                    <div className="space-y-2"><Label>رقم الموبايل <span className="text-red-500">*</span></Label><Input value={cForm.phone} onChange={e => setCForm({ ...cForm, phone: e.target.value })} placeholder="07701234567" dir="ltr" /></div>
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
                  <Button onClick={handleCreate} className="hover:opacity-90" style={{ backgroundColor: '#5C7A6B' }}>
                    إنشاء {createType === 'center' ? 'المركز' : 'العيادة'}
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
