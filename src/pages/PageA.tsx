import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useBooking } from '@/hooks/useBooking';
import { useLinexData } from '@/hooks/useLinexData';
import { isValidIraqiPhone } from '@/data/medicalData';
import type { Doctor } from '@/types/linex';
import type { BookingSlot, BookingData } from '@/types/booking';
import ProgressStepper from '@/components/ProgressStepper';
import Guide from '@/components/Guide';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import {
  Stethoscope, ChevronLeft, Clock, CalendarDays,
  Phone, Building2, Sun, Sunset, Moon, User, ArrowLeft
} from 'lucide-react';

// Generate slots from a doctor's individual schedule
function generateDoctorSlots(doctor: Doctor): BookingSlot[] {
  const slots: BookingSlot[] = [];
  const start = doctor.startTime;
  const end = doctor.endTime;
  const duration = doctor.consultationDuration || 15;

  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);

  let h = startH, m = startM;
  while (h < endH || (h === endH && m < endM)) {
    const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    const period = h < 12 ? 'morning' : h < 16 ? 'afternoon' : 'evening';
    slots.push({ time, available: true, period });
    m += duration;
    if (m >= 60) { h += 1; m -= 60; }
  }
  return slots;
}

export default function PageA() {
  const navigate = useNavigate();
  const { centerId, deptId } = useParams<{ centerId?: string; deptId?: string }>();
  const { booking, setSpecialty, setDoctor, setDateTime, setPatient, generateBookingId } = useBooking();
  const { getCenterById, getDepartmentById } = useLinexData();

  const [step, setStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [patientForm, setPatientForm] = useState({
    fullName: '', phone: '', email: '', age: '', gender: 'male' as 'male' | 'female', notes: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showGuide, setShowGuide] = useState(false);

  const center = centerId ? getCenterById(centerId) : null;
  const dept = deptId ? getDepartmentById(deptId) : null;
  const pageTitle = center?.name || dept?.name || 'حجز موعد طبي';

  // Get real doctors from center or department
  const realDoctors: Doctor[] = useMemo(() => {
    if (centerId && center) {
      return center.doctors.filter(d => d.isActive);
    }
    if (deptId && dept) {
      // Department has a single doctor
      return [{
        id: dept.id,
        name: dept.doctorName || dept.name,
        specialty: dept.name,
        title: 'أخصائي',
        email: dept.doctorEmail,
        phone: dept.doctorPhone || '',
        bio: dept.description,
        image: dept.logo || '',
        consultationDuration: dept.consultationDuration || 15,
        startTime: '09:00',
        endTime: '14:00',
        daysOff: ['الجمعة'],
        isActive: true,
      }];
    }
    return [];
  }, [center, dept, centerId, deptId]);

  // Get unique specialties from real doctors
  const availableSpecialties = useMemo(() => {
    const map = new Map<string, { id: string; name: string; icon: string; description: string; doctors: Doctor[] }>();
    realDoctors.forEach(doc => {
      if (map.has(doc.specialty)) {
        map.get(doc.specialty)!.doctors.push(doc);
      } else {
        map.set(doc.specialty, {
          id: doc.specialty,
          name: doc.specialty,
          icon: 'Stethoscope',
          description: `${doc.specialty}`,
          doctors: [doc],
        });
      }
    });
    return Array.from(map.values());
  }, [realDoctors]);

  // Selected specialty doctors
  const specialtyDoctors = useMemo(() => {
    if (!booking.specialty) return [];
    return realDoctors.filter(d => d.specialty === booking.specialty!.name);
  }, [booking.specialty, realDoctors]);

  const upcomingDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayName = days[date.getDay()];
    const dateStr = date.toLocaleDateString('ar-IQ', { day: 'numeric', month: 'long' });
    return { dayName, dateStr, fullDate: date.toISOString().split('T')[0], disabled: false };
  });

  const handleSpecialtySelect = (spec: typeof availableSpecialties[0]) => {
    setSpecialty({ id: spec.id, name: spec.name, icon: spec.icon, description: spec.description, doctorEmail: '' });
    setStep(1);
  };

  const handleDoctorSelect = (doc: Doctor) => {
    // Map Doctor to booking doctor format
    const bookingDoctor: BookingData['doctor'] = {
      id: doc.id,
      name: doc.name,
      title: doc.title,
      specialtyId: doc.specialty,
      experience: 0,
      rating: 5,
      about: doc.bio,
      image: doc.image || '/assets/linex-logo.jpg',
      schedule: {
        startTime: doc.startTime,
        endTime: doc.endTime,
        slotDuration: doc.consultationDuration,
        daysOff: doc.daysOff,
      },
    };
    setDoctor(bookingDoctor);
    setStep(2);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    if (booking.doctor) {
      const generatedSlots = generateDoctorSlots({
        startTime: booking.doctor.schedule.startTime,
        endTime: booking.doctor.schedule.endTime,
        consultationDuration: booking.doctor.schedule.slotDuration,
        daysOff: booking.doctor.schedule.daysOff,
      } as Doctor);
      setSlots(generatedSlots);
    }
  };

  const handleTimeSelect = (time: string) => setSelectedTime(time);

  const handleDateTimeConfirm = () => {
    if (selectedDate && selectedTime) {
      const day = upcomingDays.find(d => d.fullDate === selectedDate);
      if (day) {
        setDateTime(`${day.dayName} ${day.dateStr}`, selectedTime);
        setStep(3);
      }
    }
  };

  const validatePatientForm = () => {
    const newErrors: Record<string, string> = {};
    if (!patientForm.fullName.trim()) newErrors.fullName = 'الاسم الكامل مطلوب';
    if (!patientForm.phone.trim()) newErrors.phone = 'رقم الموبايل مطلوب';
    else if (!isValidIraqiPhone(patientForm.phone)) newErrors.phone = 'رقم موبايل عراقي غير صحيح (07xxxxxxxx)';
    if (!patientForm.age.trim()) newErrors.age = 'العمر مطلوب';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePatientSubmit = () => {
    if (validatePatientForm()) {
      setPatient({
        fullName: patientForm.fullName, phone: patientForm.phone, email: patientForm.email,
        age: patientForm.age, gender: patientForm.gender, notes: patientForm.notes,
      });
      setStep(4);
    }
  };

  const handleConfirm = () => {
    const bookingId = generateBookingId();
    if (centerId) navigate(`/center/${centerId}`, { state: { bookingId } });
    else navigate('/');
  };

  // Group slots by period
  const morningSlots = slots.filter(s => s.period === 'morning');
  const afternoonSlots = slots.filter(s => s.period === 'afternoon');
  const eveningSlots = slots.filter(s => s.period === 'evening');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-teal-700 via-teal-600 to-teal-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-3">
            {centerId && <button onClick={() => navigate(`/center/${centerId}`)} className="text-teal-200 hover:text-white transition-colors"><Building2 className="w-6 h-6" /></button>}
            <h1 className="text-3xl md:text-4xl font-bold">{pageTitle}</h1>
          </div>
          <p className="text-teal-100 text-lg max-w-2xl">اختر التخصص والطبيب والموعد المناسب لك، واملأ بياناتك للحصول على موعد مؤكد.</p>
          {center && <div className="flex items-center gap-4 mt-3 text-sm text-teal-200"><span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {center.phone}</span><span>{center.address}</span></div>}
          <div className="mt-4">
            <button onClick={() => setShowGuide(true)} className="text-teal-200 hover:text-white text-sm flex items-center gap-1 transition-colors">
              <span className="bg-white/20 px-3 py-1 rounded-full">كيف تحجز موعدك؟ دليل سريع</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <Card className="p-4 shadow-lg border-0"><ProgressStepper currentStep={step} /></Card>

        {/* Step 0: Specialties - ONLY show specialties that have doctors */}
        {step === 0 && (
          <div className="mt-6 pb-12">
            {realDoctors.length === 0 ? (
              <Card className="p-12 text-center">
                <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">لا يوجد أطباء مسجلين</h2>
                <p className="text-gray-500 mb-4">لم يقم مدير المركز بإضافة أطباء بعد.</p>
                <Button onClick={() => centerId ? navigate(`/center/${centerId}`) : navigate('/')} variant="outline" className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> رجوع
                </Button>
              </Card>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">اختر التخصص</h2>
                  <p className="text-gray-500">التخصصات المتوفرة في {pageTitle}</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {availableSpecialties.map(spec => (
                    <Card key={spec.id} className="p-4 cursor-pointer hover:shadow-xl hover:border-teal-300 transition-all group text-center border-2 border-transparent" onClick={() => handleSpecialtySelect(spec)}>
                      <div className="w-14 h-14 mx-auto bg-teal-50 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-teal-100">
                        <Stethoscope className="w-7 h-7 text-teal-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 text-sm">{spec.name}</h3>
                      <p className="text-xs text-gray-400 mt-1">{spec.doctors.length} طبيب</p>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 1: Real Doctors from center */}
        {step === 1 && booking.specialty && (
          <div className="mt-6 pb-12">
            <div className="flex items-center gap-4 mb-6">
              <Button variant="outline" size="sm" onClick={() => setStep(0)} className="gap-1"><ArrowLeft className="w-4 h-4" />عودة</Button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">أطباء {booking.specialty.name}</h2>
                <p className="text-gray-500 text-sm">اختر الطبيب المناسب - كل طبيب له مواعيد ومدة كشف منفصلة</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {specialtyDoctors.map(doc => (
                <Card key={doc.id} className="p-5 cursor-pointer hover:shadow-xl hover:border-teal-300 transition-all group border-2 border-transparent" onClick={() => handleDoctorSelect(doc)}>
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-teal-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {doc.image ? <img src={doc.image} alt={doc.name} className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-teal-600" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-gray-900">{doc.name}</h3>
                        <Badge variant="secondary" className="text-xs">{doc.title}</Badge>
                      </div>
                      <Badge className="mb-2 text-xs bg-teal-50 text-teal-700 border-teal-200">{doc.specialty}</Badge>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{doc.startTime} - {doc.endTime}</span>
                      </div>
                    </div>
                  </div>
                  {doc.bio && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{doc.bio}</p>}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-teal-500" />كشف {doc.consultationDuration} دقيقة</span>
                    <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">{Math.floor((parseInt(doc.endTime) - parseInt(doc.startTime)) * 60 / doc.consultationDuration)} حالة/يوم</span>
                    {doc.daysOff.length > 0 && <span className="text-amber-600">عطلة: {doc.daysOff.join('، ')}</span>}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && booking.doctor && (
          <div className="mt-6 pb-12">
            <div className="flex items-center gap-4 mb-6">
              <Button variant="outline" size="sm" onClick={() => setStep(1)} className="gap-1"><ArrowLeft className="w-4 h-4" />عودة</Button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">اختر الموعد</h2>
                <p className="text-gray-500 text-sm">{booking.doctor.name} - كشف {booking.doctor.schedule.slotDuration} دقيقة</p>
              </div>
            </div>

            <Card className="p-4 mb-4 bg-gradient-to-r from-teal-50 to-blue-50 border-teal-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div><p className="text-xs text-gray-500">وقت الدوام</p><p className="font-bold text-gray-900">{booking.doctor.schedule.startTime} - {booking.doctor.schedule.endTime}</p></div>
                <div><p className="text-xs text-gray-500">مدة الكشف</p><p className="font-bold text-teal-700">{booking.doctor.schedule.slotDuration} دقيقة</p></div>
                <div><p className="text-xs text-gray-500">السعة اليومية</p><p className="font-bold text-blue-700">{Math.floor((parseInt(booking.doctor.schedule.endTime) - parseInt(booking.doctor.schedule.startTime)) * 60 / booking.doctor.schedule.slotDuration)} حالة</p></div>
              </div>
            </Card>

            <Card className="p-6 mb-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-teal-600" />اختر اليوم</h3>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                {upcomingDays.map(day => {
                  const isOff = booking.doctor?.schedule.daysOff.includes(day.dayName);
                  const isSelected = selectedDate === day.fullDate;
                  return (
                    <button key={day.fullDate} disabled={isOff} onClick={() => handleDateSelect(day.fullDate)}
                      className={`p-3 rounded-xl text-center transition-all ${isSelected ? 'bg-teal-600 text-white shadow-lg' : isOff ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border-2 border-gray-200 hover:border-teal-300'}`}>
                      <div className="text-xs font-medium">{day.dayName}</div>
                      <div className="text-sm font-bold mt-1">{day.dateStr}</div>
                      {isOff && <div className="text-[10px] mt-1">عطلة</div>}
                    </button>
                  );
                })}
              </div>
            </Card>

            {selectedDate && slots.length > 0 && (
              <Card className="p-6 mb-4">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-teal-600" />اختر وقت الحجز</h3>
                {morningSlots.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-1"><Sun className="w-4 h-4" />فترة الصباح</h4>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {morningSlots.map(slot => (
                        <button key={slot.time} onClick={() => handleTimeSelect(slot.time)}
                          className={`p-2 rounded-lg text-center text-sm transition-all ${selectedTime === slot.time ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 hover:border-teal-300'}`}>
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {afternoonSlots.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-orange-600 mb-2 flex items-center gap-1"><Sunset className="w-4 h-4" />فترة الظهر</h4>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {afternoonSlots.map(slot => (
                        <button key={slot.time} onClick={() => handleTimeSelect(slot.time)}
                          className={`p-2 rounded-lg text-center text-sm transition-all ${selectedTime === slot.time ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 hover:border-teal-300'}`}>
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {eveningSlots.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-indigo-600 mb-2 flex items-center gap-1"><Moon className="w-4 h-4" />فترة المساء</h4>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {eveningSlots.map(slot => (
                        <button key={slot.time} onClick={() => handleTimeSelect(slot.time)}
                          className={`p-2 rounded-lg text-center text-sm transition-all ${selectedTime === slot.time ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 hover:border-teal-300'}`}>
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">مدة كل كشف: {booking.doctor.schedule.slotDuration} دقيقة</p>
              </Card>
            )}
            <div className="flex justify-start">
              <Button onClick={handleDateTimeConfirm} disabled={!selectedDate || !selectedTime} className="bg-teal-600 hover:bg-teal-700 gap-2">التالي<ChevronLeft className="w-4 h-4" /></Button>
            </div>
          </div>
        )}

        {/* Step 3: Patient Info */}
        {step === 3 && (
          <div className="mt-6 pb-12">
            <div className="flex items-center gap-4 mb-6">
              <Button variant="outline" size="sm" onClick={() => setStep(2)} className="gap-1"><ArrowLeft className="w-4 h-4" />عودة</Button>
              <div><h2 className="text-2xl font-bold text-gray-900">بيانات المريض</h2><p className="text-gray-500 text-sm">أدخل بياناتك لإكمال الحجز</p></div>
            </div>
            <Card className="p-6 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>الاسم الكامل <span className="text-red-500">*</span></Label>
                  <Input value={patientForm.fullName} onChange={e => setPatientForm({ ...patientForm, fullName: e.target.value })} placeholder="الاسم الثلاثي" className={errors.fullName ? 'border-red-500' : ''} />
                  {errors.fullName && <p className="text-xs text-red-500">{errors.fullName}</p>}
                </div>
                <div className="space-y-2">
                  <Label>رقم الموبايل (العراق) <span className="text-red-500">*</span></Label>
                  <Input value={patientForm.phone} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 11); setPatientForm({ ...patientForm, phone: v }); }} placeholder="07701234567" dir="ltr" className={errors.phone ? 'border-red-500' : ''} />
                  {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
                </div>
                <div className="space-y-2">
                  <Label>العمر <span className="text-red-500">*</span></Label>
                  <Input value={patientForm.age} onChange={e => setPatientForm({ ...patientForm, age: e.target.value.replace(/\D/g, '') })} placeholder="25" dir="ltr" className={errors.age ? 'border-red-500' : ''} />
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني <span className="text-gray-400">(اختياري)</span></Label>
                  <Input value={patientForm.email} onChange={e => setPatientForm({ ...patientForm, email: e.target.value })} placeholder="example@email.com" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>الجنس</Label>
                  <RadioGroup value={patientForm.gender} onValueChange={(v: 'male' | 'female') => setPatientForm({ ...patientForm, gender: v })} className="flex gap-4">
                    <div className="flex items-center gap-2"><RadioGroupItem value="male" id="male" /><Label htmlFor="male" className="cursor-pointer">ذكر</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="female" id="female" /><Label htmlFor="female" className="cursor-pointer">أنثى</Label></div>
                  </RadioGroup>
                </div>
              </div>
              <div className="mt-4 space-y-2 md:col-span-2">
                <Label>ملاحظات <span className="text-gray-400">(اختياري)</span></Label>
                <Textarea value={patientForm.notes} onChange={e => setPatientForm({ ...patientForm, notes: e.target.value })} placeholder="أي ملاحظات للطبيب..." rows={3} />
              </div>
              <div className="mt-6 flex justify-start">
                <Button onClick={handlePatientSubmit} className="bg-teal-600 hover:bg-teal-700 gap-2">التالي<ChevronLeft className="w-4 h-4" /></Button>
              </div>
            </Card>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="mt-6 pb-12">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">ملخص الحجز</h2>
              <p className="text-gray-500">راجع بيانات حجزك قبل التأكيد</p>
            </div>
            <Card className="p-6 max-w-2xl mx-auto border-2 border-teal-100">
              <div className="bg-teal-50 rounded-xl p-4 mb-6 text-center">
                <div className="w-16 h-16 bg-teal-600 text-white rounded-full flex items-center justify-center mx-auto mb-3"><CalendarDays className="w-8 h-8" /></div>
                <h3 className="text-lg font-bold text-teal-900">تأكيد موعدك</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">التخصص</span><span className="font-semibold">{booking.specialty?.name}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">الطبيب</span><span className="font-semibold">{booking.doctor?.name} ({booking.doctor?.title})</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">التاريخ</span><span className="font-semibold">{booking.date}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">الوقت</span><span className="font-semibold">{booking.time}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">مدة الكشف</span><span className="font-semibold text-teal-600">{booking.doctor?.schedule.slotDuration} دقيقة</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">المريض</span><span className="font-semibold">{booking.patient?.fullName}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">الموبايل</span><span className="font-semibold" dir="ltr">{booking.patient?.phone}</span></div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <Button variant="outline" onClick={() => setStep(3)} className="gap-2">تعديل البيانات</Button>
                <Button onClick={handleConfirm} className="bg-teal-600 hover:bg-teal-700 gap-2 flex-1">تأكيد الحجز</Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Guide Modal */}
      {showGuide && <Guide onClose={() => setShowGuide(false)} />}
    </div>
  );
}
