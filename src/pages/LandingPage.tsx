import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useLinexData } from '@/hooks/useLinexData';
import type { ActivationType, Admin } from '@/types/linex';
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
  const { addAdmin } = useAuth();
  const { pricing, getDepartmentsByCenter, getActiveCenters } = useLinexData();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'center' | 'dept'>('center');
  const [step, setStep] = useState(1);
  const [activationType, setActivationType] = useState<ActivationType>('free');
  const [msg, setMsg] = useState('');

  const [cForm, setCForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [dForm, setDForm] = useState({ name: '', description: '', doctorEmail: '', centerId: '' });
  const [adminForm, setAdminForm] = useState({ fullName: '', username: '', password: '' });

  const showMsg = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 3000); };
  const activeCenters = getActiveCenters();

  const visibleCenters = activeCenters.filter(c => {
    if (c.appearanceType === 'hidden') return false;
    if (c.appearanceType === 'free_trial') return new Date(c.appearanceExpiry) > new Date();
    return c.appearanceType === 'paid';
  });

  const handleCreate = () => {
    if (!adminForm.username || !adminForm.password) { showMsg('يرجى إدخال اسم المستخدم وكلمة المرور'); return; }

    if (activationType === 'paid') {
      navigate('/payment', { state: { name: createType === 'center' ? cForm.name : dForm.name, type: createType, activationType, price: createType === 'center' ? pricing.platform.centerMonthlyPrice : pricing.platform.deptMonthlyPrice, months: 1, formData: createType === 'center' ? { ...cForm, adminForm } : { ...dForm, adminForm } } });
      return;
    }

    const adminId = 'admin-' + Date.now();
    const appearanceExpiry = new Date(Date.now() + 3 * 86400000).toISOString();

    const admin: Admin = { id: adminId, fullName: adminForm.fullName || (createType === 'center' ? cForm.name : dForm.name), username: adminForm.username, password: adminForm.password, role: createType === 'center' ? 'center' : 'department', phone: cForm.phone || '', email: cForm.email || dForm.doctorEmail || '', centerId: createType === 'center' ? 'center-' + Date.now() : undefined, departmentId: createType === 'dept' ? 'dept-' + Date.now() : undefined, isActive: true, createdAt: new Date().toISOString() };
    addAdmin(admin);

    if (createType === 'center') {
      if (!cForm.name || !cForm.phone) return;
      import('@/services/dataStorage').then(({ saveCenter }) => {
        saveCenter({ id: admin.centerId!, name: cForm.name, address: cForm.address, phone: cForm.phone, email: cForm.email, logo: '', workingDays: ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'], workingHours: '8:00 ص - 10:00 م', fridayHours: '4:00 م - 9:00 م', emergencyHours: '24 ساعة', consultationDuration: 15, doctors: [], adminId, activationType: 'free', subscriptionPrice: 0, freeTrialDays: 7, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), isPaid: false, isActive: true, status: 'trial' as const, appearanceType: 'free_trial', appearanceExpiry, promoImages: [], promoText: '' });
      });
      setShowCreateModal(false); showMsg(`تم إنشاء مركز "${cForm.name}" وبيانات المدير!`);
    } else {
      if (!dForm.name) return;
      import('@/services/dataStorage').then(({ saveDepartment }) => {
        saveDepartment({ id: admin.departmentId!, name: dForm.name, description: dForm.description, icon: 'Stethoscope', doctorName: '', doctorEmail: dForm.doctorEmail, doctorPhone: '', logo: '', workingDays: ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'], workingHours: '8:00 ص - 10:00 م', fridayHours: '4:00 م - 9:00 م', consultationDuration: 15, centerId: dForm.centerId || null, adminId, activationType: 'free', subscriptionPrice: 0, freeTrialDays: 7, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), isPaid: false, isActive: true, status: 'trial' as const, appearanceType: 'free_trial', appearanceExpiry, promoImages: [], promoText: '' });
      });
      setShowCreateModal(false); showMsg(`تم إنشاء عيادة "${dForm.name}" وبيانات المدير!`);
    }
    resetForm();
  };

  const resetForm = () => { setCForm({ name: '', address: '', phone: '', email: '' }); setDForm({ name: '', description: '', doctorEmail: '', centerId: '' }); setAdminForm({ fullName: '', username: '', password: '' }); setStep(1); setActivationType('free'); };

  return (
    <div className="min-h-screen bg-white">
      {/* ===== HEADER ===== */}
      <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/linex-logo-transparent.png" alt="LinkEX" className="h-9 w-auto" />
            <span className="font-bold text-lg hidden sm:inline">Link Express</span>
          </div>
          <div className="flex items-center gap-3">
            {msg && <span className="hidden md:flex text-sm text-green-400 bg-green-400/10 px-3 py-1 rounded-full"><CheckCircle2 className="w-4 h-4 ml-1" />{msg}</span>}
            <Button variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10" onClick={() => navigate('/login')}>
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
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <img src="/assets/linex-logo-transparent.png" alt="Link Express" className="h-36 md:h-48 w-auto mx-auto mb-6 drop-shadow-2xl" />
          <h1 className="text-4xl md:text-6xl font-bold mb-4">Link Express</h1>
          <p className="text-2xl md:text-3xl font-light text-teal-300 mb-2">خيارك الأفضل</p>
          <p className="text-xl text-slate-300 mb-8">للحلول الذكية</p>
        </div>
      </section>

      {/* ===== ADVERTISING CENTERS ===== */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">المراكز والعيادات</h2>
          <p className="text-gray-500 mb-8 text-center">اكتشف أفضل المراكز الطبية واحجز موعدك</p>

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
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <img src="/assets/linex-logo-transparent.png" alt="LinkEX" className="h-16 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Link Express</h3>
            <p className="text-sm text-slate-500 mb-6">منصة إدارة الحجوزات الإلكترونية</p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm">
              <a href="mailto:info@nidaba.org" className="flex items-center gap-2 hover:text-teal-400 transition-colors">
                <Mail className="w-4 h-4" />
                <span>info@nidaba.org</span>
              </a>
              <a href="tel:009647904414044" className="flex items-center gap-2 hover:text-teal-400 transition-colors" dir="ltr">
                <Phone className="w-4 h-4" />
                <span>009647904414044</span>
              </a>
              <span className="flex items-center gap-2 text-teal-400">
                <ExternalLink className="w-4 h-4" />
                <span>linkexpress.nidaba.org</span>
              </span>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 text-xs">
              <p>جميع الحقوق محفوظة &copy; 2025 Link Express</p>
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
                <p className="text-sm text-gray-500 mb-4">اختر نوع الاشتراك</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setActivationType('free')} className={`p-4 rounded-xl border-2 text-center transition-all ${activationType === 'free' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                    <p className="font-bold">مجاني</p><p className="text-xs text-gray-500">7 أيام</p>
                  </button>
                  <button onClick={() => setActivationType('paid')} className={`p-4 rounded-xl border-2 text-center transition-all ${activationType === 'paid' ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}>
                    <p className="font-bold">مدفوع</p><p className="text-xs text-gray-500">{createType === 'center' ? pricing.platform.centerMonthlyPrice : pricing.platform.deptMonthlyPrice} د.ع/شهر</p>
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>رجوع</Button>
                  <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={() => setStep(3)}>التالي</Button>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-4">
                {createType === 'center' ? (
                  <>
                    <div className="space-y-2"><Label>اسم المركز الطبي <span className="text-red-500">*</span></Label><Input value={cForm.name} onChange={e => setCForm({ ...cForm, name: e.target.value })} placeholder="مثال: مركز الشفاء الطبي" /></div>
                    <div className="space-y-2"><Label>العنوان</Label><Input value={cForm.address} onChange={e => setCForm({ ...cForm, address: e.target.value })} placeholder="بغداد - الكرادة" /></div>
                    <div className="space-y-2"><Label>رقم الموبايل <span className="text-red-500">*</span></Label><Input value={cForm.phone} onChange={e => setCForm({ ...cForm, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })} placeholder="07xxxxxxxx" dir="ltr" /></div>
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
                    <div className="space-y-2"><Label>اسم القسم / التخصص <span className="text-red-500">*</span></Label><Input value={dForm.name} onChange={e => setDForm({ ...dForm, name: e.target.value })} placeholder="مثال: قسم العظام" /></div>
                    <div className="space-y-2"><Label>الوصف</Label><Input value={dForm.description} onChange={e => setDForm({ ...dForm, description: e.target.value })} placeholder="وصف مختصر" /></div>
                    <div className="space-y-2"><Label>إيميل الطبيب</Label><Input value={dForm.doctorEmail} onChange={e => setDForm({ ...dForm, doctorEmail: e.target.value })} placeholder="doctor@email.com" dir="ltr" /></div>
                  </>
                )}
                <div className="border-t pt-4 space-y-2">
                  <Label>اسم المستخدم <span className="text-red-500">*</span></Label><Input value={adminForm.username} onChange={e => setAdminForm({ ...adminForm, username: e.target.value })} placeholder="اسم المستخدم" dir="ltr" />
                  <Label>كلمة المرور <span className="text-red-500">*</span></Label><Input value={adminForm.password} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })} placeholder="••••••" dir="ltr" type="password" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>رجوع</Button>
                  <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={handleCreate} disabled={(createType === 'center' ? !cForm.name || !cForm.phone : !dForm.name) || !adminForm.username || !adminForm.password}>
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
