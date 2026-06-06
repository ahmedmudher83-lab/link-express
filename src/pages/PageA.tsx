import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useBooking } from '@/hooks/useBooking';
import { useLinexData } from '@/hooks/useLinexData';
import { isValidIraqiPhone } from '@/data/medicalData';
import { saveBooking, getDepartmentBookings } from '@/services/googleCalendarService';
import type { BookingSlot, BookingData } from '@/types/booking';
import type { Department, BookingRecord } from '@/types/linex';
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
  Phone, Building2, Sun, Sunset, Moon, User, ArrowLeft,
  Hospital, Mail, CheckCircle2
} from 'lucide-react';

// Generate slots from department schedule
function generateDeptSlots(dept: Department, selectedDate?: string): BookingSlot[] {
  const slots: BookingSlot[] = [];
  const duration = dept.consultationDuration || 15;
  
  // Parse working hours
  const start = dept.startTime || '09:00';
  const end = dept.endTime || '14:00';
  
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);

  // Get current time for filtering past slots
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const today = now.toISOString().split('T')[0];
  const isToday = selectedDate === today;

  let h = startH, m = startM;
  while (h < endH || (h === endH && m < endM)) {
    const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    
    // Skip past slots if today
    if (isToday) {
      if (h < currentHour || (h === currentHour && m <= currentMinute)) {
        m += duration;
        if (m >= 60) { h += 1; m -= 60; }
        continue;
      }
    }
    
    const period = h < 12 ? 'morning' : h < 16 ? 'afternoon' : 'evening';
    slots.push({ time, available: true, period });
    m += duration;
    if (m >= 60) { h += 1; m -= 60; }
  }
  return slots;
}

// Helper: get all upcoming dates filtered by department's working days
function getUpcomingWorkingDays(dept: Department) {
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const workingDays = dept.workingDays || [];
  const vacationDays = dept.vacationDays || [];
  const daysOff = dept.daysOff || ['الجمعة'];
  const window = dept.bookingWindow || 7;
  
  const result: { dayName: string; dateStr: string; fullDate: string }[] = [];
  
  for (let i = 0; i < 90; i++) { // check up to 90 days ahead
    if (result.length >= window) break;
    
    const date = new Date();
    date.setDate(date.getDate() + i);
    
    const dayName = days[date.getDay()];
    const fullDate = date.toISOString().split('T')[0];
    
    // Skip if not a working day for this department
    if (!workingDays.includes(dayName)) continue;
    
    // Skip if it's a weekly day off
    if (daysOff.includes(dayName)) continue;
    
    // Skip if it's a vacation day
    if (vacationDays.includes(fullDate)) continue;
    
    const dateStr = date.toLocaleDateString('ar-IQ', { day: 'numeric', month: 'long' });
    result.push({ dayName, dateStr, fullDate });
  }
  
  return result;
}

// Simulated booked slots (in production this comes from Firebase/database)
const getBookedSlots = (deptId: string, date: string): string[] => {
  // For demo: 30% of slots appear booked
  const stored = localStorage.getItem(`booked_${deptId}_${date}`);
  if (stored) return JSON.parse(stored);
  return [];
};

export default function PageA() {
  const navigate = useNavigate();
  const { centerId, deptId } = useParams<{ centerId?: string; deptId?: string }>();
  const { booking, setSpecialty, setDoctor, setDateTime, setPatient, generateBookingId } = useBooking();
  const { getCenterById, getDepartmentById, getDepartmentsByCenter } = useLinexData();

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

  // Get departments for this center
  const centerDepts = useMemo(() => {
    if (!centerId) return dept ? [dept] : [];
    return getDepartmentsByCenter(centerId).filter(d => d.isActive);
  }, [centerId, dept, getDepartmentsByCenter]);

  // Selected department
  const selectedDept = useMemo(() => {
    if (!booking.specialty) return null;
    return centerDepts.find(d => d.id === booking.specialty?.id) || null;
  }, [booking.specialty, centerDepts]);

  // Generate upcoming days filtered by department's actual working schedule
  const upcomingDays = useMemo(() => {
    if (!selectedDept) return [];
    return getUpcomingWorkingDays(selectedDept);
  }, [selectedDept]);

  // Step 0: Select department
  const handleDeptSelect = (dept: Department) => {
    setSpecialty({
      id: dept.id,
      name: dept.name,
      icon: 'Stethoscope',
      description: dept.description || '',
      doctorEmail: dept.doctorEmail || ''
    });
    setStep(1);
  };

  // Step 1: Show department doctor and proceed to booking
  const handleDeptDoctorSelect = () => {
    if (!selectedDept) return;
    
    // Create a doctor object from department data
    const bookingDoctor: BookingData['doctor'] = {
      id: selectedDept.id,
      name: selectedDept.doctorName || selectedDept.name,
      title: 'أخصائي',
      specialtyId: selectedDept.name,
      experience: 0,
      rating: 5,
      about: selectedDept.description,
      image: selectedDept.logo || '/assets/linex-logo-transparent.png',
      schedule: {
        startTime: selectedDept.startTime || '08:00',
        endTime: selectedDept.endTime || '22:00',
        slotDuration: selectedDept.consultationDuration || 15,
        daysOff: selectedDept.daysOff || ['الجمعة'],
      },
    };
    setDoctor(bookingDoctor);
    setStep(2);
  };

  // Step 2: Select date
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    if (selectedDept) {
      const generatedSlots = generateDeptSlots(selectedDept, date);
      // Remove booked slots from database
      const bookedRecords = getDepartmentBookings(selectedDept.id, date);
      const bookedTimes = bookedRecords.map(b => b.time);
      const availableSlots = generatedSlots.filter(s => !bookedTimes.includes(s.time));
      setSlots(availableSlots);
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

  // ... (keep remaining functions: validatePatientForm, handlePatientSubmit, handleConfirm)
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
    if (!selectedDept || !selectedDate || !selectedTime) return;
    
    // Create booking record
    const bookingRecord: BookingRecord = {
      id: 'BK' + Date.now().toString(36).toUpperCase(),
      patientName: patientForm.fullName,
      patientPhone: patientForm.phone,
      patientEmail: patientForm.email || undefined,
      patientAge: patientForm.age || undefined,
      patientGender: patientForm.gender || undefined,
      departmentId: selectedDept.id,
      departmentName: selectedDept.name,
      centerId: centerId || undefined,
      doctorName: selectedDept.doctorName || selectedDept.name,
      date: selectedDate,
      time: selectedTime,
      dateTimeDisplay: booking.date,
      notes: patientForm.notes || undefined,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };
    
    // Save booking to database
    saveBooking(bookingRecord);
    
    // Sync with Google Calendar if configured (async, non-blocking)
    const calendarSettingsStr = localStorage.getItem(`calendar_${selectedDept.id}`);
    if (calendarSettingsStr) {
      import('@/services/googleCalendarService').then(({ addBookingToCalendar }) => {
        try {
          const settings = JSON.parse(calendarSettingsStr);
          addBookingToCalendar(settings, bookingRecord).then(eventId => {
            if (eventId) {
              // Update booking with Google Event ID
              const bookings = JSON.parse(localStorage.getItem('linex_bookings') || '[]');
              const idx = bookings.findIndex((b: BookingRecord) => b.id === bookingRecord.id);
              if (idx >= 0) {
                bookings[idx].googleEventId = eventId;
                localStorage.setItem('linex_bookings', JSON.stringify(bookings));
              }
            }
          });
        } catch { /* ignore */ }
      });
    }
    
    const bookingId = generateBookingId();
    if (centerId) navigate(`/center/${centerId}`, { state: { bookingId } });
    else navigate('/');
  };

  // Group slots by period
  const morningSlots = slots.filter(s => s.period === 'morning');
  const afternoonSlots = slots.filter(s => s.period === 'afternoon');
  const eveningSlots = slots.filter(s => s.period === 'evening');

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F6F0' }}>
      {/* Header */}
      <div className="text-white py-12" style={{ background: 'linear-gradient(135deg, #3D3632 0%, #5C534D 40%, #7A8B7F 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-3">
            {centerId && <button onClick={() => navigate(`/center/${centerId}`)} className="transition-colors" style={{ color: '#C8DDD0' }}><Building2 className="w-6 h-6" /></button>}
            <h1 className="text-3xl md:text-4xl font-bold">{pageTitle}</h1>
          </div>
          <p className="text-lg max-w-2xl" style={{ color: '#D4CFC9' }}>اختر القسم المناسب ثم حدد موعدك</p>
          {center && <div className="flex items-center gap-4 mt-3 text-sm" style={{ color: '#C8DDD0' }}><span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {center.phone}</span><span>{center.address}</span></div>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <Card className="p-4 shadow-lg border-0"><ProgressStepper currentStep={step} /></Card>

        {/* Step 0: Departments */}
        {step === 0 && (
          <div className="mt-6 pb-12">
            {centerDepts.length === 0 ? (
              <Card className="p-12 text-center">
                <Hospital className="w-16 h-16 mx-auto mb-4" style={{ color: '#C4BFB9' }} />
                <h2 className="text-xl font-bold text-gray-900 mb-2">لا يوجد أقسام مسجلة</h2>
                <p className="text-gray-500 mb-4">لم يقم مدير المركز بإضافة أقسام طبية بعد.</p>
                <Button onClick={() => centerId ? navigate(`/center/${centerId}`) : navigate('/')} variant="outline" className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> رجوع
                </Button>
              </Card>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#E4E8E0' }}>
                    <Hospital className="w-8 h-8" style={{ color: '#5C7A6B' }} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">اختر القسم الطبي</h2>
                  <p className="text-gray-500">الأقسام المتاحة في {pageTitle}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {centerDepts.map(dept => (
                    <Card key={dept.id} className="p-5 cursor-pointer hover:shadow-xl transition-all border-2 border-transparent text-right"
                      style={{ borderColor: 'transparent' }}
                      onClick={() => handleDeptSelect(dept)}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#5C7A6B')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}>
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#E4E8E0' }}>
                          <Stethoscope className="w-7 h-7" style={{ color: '#5C7A6B' }} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900">{dept.name}</h3>
                          {dept.description && <p className="text-sm text-gray-500 mt-1">{dept.description}</p>}
                          {dept.doctorName && <p className="text-sm mt-1" style={{ color: '#5C7A6B' }}>د. {dept.doctorName}</p>}
                          {dept.startTime && <p className="text-xs text-gray-400 mt-1">{dept.startTime} - {dept.endTime} | {dept.consultationDuration || 15} دقيقة</p>}
                          {dept.workingDays && Array.isArray(dept.workingDays) && dept.workingDays.length > 0 && (
                            <p className="text-xs text-teal-600 mt-1">{dept.workingDays.join('، ')}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 1: Department Doctor */}
        {step === 1 && selectedDept && (
          <div className="mt-6 pb-12">
            <div className="flex items-center gap-4 mb-6">
              <Button variant="outline" size="sm" onClick={() => setStep(0)} className="gap-1"><ArrowLeft className="w-4 h-4" />عودة</Button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedDept.name}</h2>
                <p className="text-gray-500 text-sm">معلومات القسم والطبيب المسؤول</p>
              </div>
            </div>

            <Card className="p-6 max-w-2xl mx-auto border-2" style={{ borderColor: '#D4CFC9' }}>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#E4E8E0' }}>
                  <Stethoscope className="w-8 h-8" style={{ color: '#5C7A6B' }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">{selectedDept.name}</h3>
                  {selectedDept.description && <p className="text-gray-600 mt-1">{selectedDept.description}</p>}
                  
                  <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: '#F0EDE6' }}>
                    <p className="text-sm font-bold text-gray-700 mb-2">الطبيب المسؤول:</p>
                    <p className="text-lg font-bold" style={{ color: '#5C7A6B' }}>{selectedDept.doctorName || 'غير محدد'}</p>
                    {selectedDept.doctorEmail && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1" dir="ltr">
                        <Mail className="w-4 h-4" />{selectedDept.doctorEmail}
                      </p>
                    )}
                    {selectedDept.doctorPhone && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1" dir="ltr">
                        <Phone className="w-4 h-4" />{selectedDept.doctorPhone}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-gray-500">
                    {selectedDept.workingDays && Array.isArray(selectedDept.workingDays) && selectedDept.workingDays.length > 0 && (
                      <Badge variant="outline">{selectedDept.workingDays.join('، ')}</Badge>
                    )}
                    <Badge variant="outline">{selectedDept.startTime} - {selectedDept.endTime}</Badge>
                    <Badge variant="outline">كشف {selectedDept.consultationDuration || 15} دقيقة</Badge>
                    {selectedDept.vacationDays && selectedDept.vacationDays.length > 0 && (
                      <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                        إجازة: {selectedDept.vacationDays.join('، ')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button 
                  onClick={handleDeptDoctorSelect}
                  className="gap-2 hover:opacity-90"
                  style={{ backgroundColor: '#5C7A6B' }}
                  disabled={!selectedDept.doctorName}
                >
                  حجز موعد مع {selectedDept.doctorName || 'الطبيب'}
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </Card>
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

            <Card className="p-4 mb-4" style={{ background: 'linear-gradient(135deg, #E4E8E0 0%, #D4CFC9 100%)', borderColor: '#5C7A6B' }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div><p className="text-xs text-gray-500">وقت الدوام</p><p className="font-bold text-gray-900">{booking.doctor.schedule.startTime} - {booking.doctor.schedule.endTime}</p></div>
                <div><p className="text-xs text-gray-500">مدة الكشف</p><p className="font-bold" style={{ color: '#5C7A6B' }}>{booking.doctor.schedule.slotDuration} دقيقة</p></div>
                <div><p className="text-xs text-gray-500">السعة اليومية</p><p className="font-bold" style={{ color: '#5C7A6B' }}>{Math.floor((parseInt(booking.doctor.schedule.endTime) - parseInt(booking.doctor.schedule.startTime)) * 60 / booking.doctor.schedule.slotDuration)} حالة</p></div>
              </div>
            </Card>

            <Card className="p-6 mb-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><CalendarDays className="w-5 h-5" style={{ color: '#5C7A6B' }} />اختر اليوم</h3>
              <p className="text-xs text-gray-500 mb-3">
                أيام دوام {booking.doctor?.name || 'الطبيب'}: {selectedDept?.workingDays?.join('، ') || 'غير محدد'}
              </p>
              {upcomingDays.length === 0 ? (
                <div className="text-center p-6 bg-gray-50 rounded-xl">
                  <p className="text-gray-500">لا توجد أيام دوام متاحة في الفترة القادمة</p>
                  <p className="text-xs text-gray-400 mt-1">قد يكون الطبيب في إجازة أو لم يحدد أيام دوام</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                  {upcomingDays.map(day => {
                    const isSelected = selectedDate === day.fullDate;
                    return (
                      <button key={day.fullDate} onClick={() => handleDateSelect(day.fullDate)}
                        className={`p-3 rounded-xl text-center transition-all ${isSelected ? 'text-white shadow-lg' : 'bg-white border-2 border-gray-200 hover:border-teal-400'}`}
                        style={isSelected ? { backgroundColor: '#5C7A6B' } : {}}>
                        <div className="text-xs font-medium">{day.dayName}</div>
                        <div className="text-sm font-bold mt-1">{day.dateStr}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {selectedDate && slots.length > 0 && (
              <Card className="p-6 mb-4">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Clock className="w-5 h-5" style={{ color: '#5C7A6B' }} />اختر وقت الحجز</h3>
                {slots.length === 0 ? (
                  <div className="text-center p-8">
                    <p className="text-gray-500">لا توجد مواعيد متاحة لهذا اليوم</p>
                    <p className="text-sm text-gray-400 mt-1">جميع المواعيد محجوزة</p>
                  </div>
                ) : (
                  <>
                    {morningSlots.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1" style={{ color: '#8B6914' }}><Sun className="w-4 h-4" />فترة الصباح</h4>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {morningSlots.map(slot => (
                            <button key={slot.time} onClick={() => handleTimeSelect(slot.time)}
                              className={`p-2 rounded-lg text-center text-sm transition-all ${selectedTime === slot.time ? 'text-white' : 'bg-white border border-gray-200'}`}
                              style={selectedTime === slot.time ? { backgroundColor: '#5C7A6B' } : {}}>
                              {slot.time}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {afternoonSlots.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1" style={{ color: '#9A3412' }}><Sunset className="w-4 h-4" />فترة الظهر</h4>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {afternoonSlots.map(slot => (
                            <button key={slot.time} onClick={() => handleTimeSelect(slot.time)}
                              className={`p-2 rounded-lg text-center text-sm transition-all ${selectedTime === slot.time ? 'text-white' : 'bg-white border border-gray-200'}`}
                              style={selectedTime === slot.time ? { backgroundColor: '#5C7A6B' } : {}}>
                              {slot.time}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {eveningSlots.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1" style={{ color: '#3730A3' }}><Moon className="w-4 h-4" />فترة المساء</h4>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {eveningSlots.map(slot => (
                            <button key={slot.time} onClick={() => handleTimeSelect(slot.time)}
                              className={`p-2 rounded-lg text-center text-sm transition-all ${selectedTime === slot.time ? 'text-white' : 'bg-white border border-gray-200'}`}
                              style={selectedTime === slot.time ? { backgroundColor: '#5C7A6B' } : {}}>
                              {slot.time}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                <p className="text-xs text-gray-400 mt-2">مدة كل كشف: {booking.doctor.schedule.slotDuration} دقيقة</p>
              </Card>
            )}
            {selectedDate && slots.length === 0 && (
              <Card className="p-8 text-center mb-4">
                <p className="text-gray-500 text-lg">لا توجد مواعيد متاحة لهذا اليوم</p>
                <p className="text-sm text-gray-400 mt-1">جميع المواعيد محجوزة. يرجى اختيار يوم آخر.</p>
              </Card>
            )}
            <div className="flex justify-start">
              <Button onClick={handleDateTimeConfirm} disabled={!selectedDate || !selectedTime} className="gap-2 hover:opacity-90" style={{ backgroundColor: '#5C7A6B' }}>التالي<ChevronLeft className="w-4 h-4" /></Button>
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
                <Button onClick={handlePatientSubmit} className="gap-2 hover:opacity-90" style={{ backgroundColor: '#5C7A6B' }}>التالي<ChevronLeft className="w-4 h-4" /></Button>
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
            <Card className="p-6 max-w-2xl mx-auto border-2" style={{ borderColor: '#D4CFC9' }}>
              <div className="rounded-xl p-4 mb-6 text-center" style={{ backgroundColor: '#E4E8E0' }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: '#5C7A6B' }}>
                  <CalendarDays className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold" style={{ color: '#2D2825' }}>تأكيد موعدك</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">القسم</span><span className="font-semibold">{booking.specialty?.name}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">الطبيب</span><span className="font-semibold">{booking.doctor?.name}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">التاريخ</span><span className="font-semibold">{booking.date}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">الوقت</span><span className="font-semibold">{booking.time}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">مدة الكشف</span><span className="font-semibold" style={{ color: '#5C7A6B' }}>{booking.doctor?.schedule.slotDuration} دقيقة</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">المريض</span><span className="font-semibold">{booking.patient?.fullName}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">الموبايل</span><span className="font-semibold" dir="ltr">{booking.patient?.phone}</span></div>
                {booking.patient?.email && (
                  <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">البريد</span><span className="font-semibold" dir="ltr">{booking.patient?.email}</span></div>
                )}
              </div>

              {/* Google Calendar + Email Actions */}
              <div className="mt-6 space-y-3">
                <p className="text-sm text-gray-500 text-center">بعد التأكيد، يمكنك:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      const title = encodeURIComponent(`موعد طبي - ${booking.specialty?.name} - ${booking.doctor?.name}`);
                      const details = encodeURIComponent(`مركز: ${pageTitle}\nمريض: ${booking.patient?.fullName}\nهاتف: ${booking.patient?.phone}`);
                      const location = encodeURIComponent(center?.address || '');
                      // Add doctor email to recipients if available
                      const docEmail = selectedDept?.doctorEmail || '';
                      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&add=${docEmail}`;
                      window.open(url, '_blank');
                    }}
                  >
                    <CalendarDays className="w-4 h-4" />
                    إضافة لتقويم Google
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      const subject = encodeURIComponent(`تأكيد حجز موعد - ${booking.patient?.fullName}`);
                      const body = encodeURIComponent(`تم حجز موعد جديد:\n\nالقسم: ${booking.specialty?.name}\nالطبيب: ${booking.doctor?.name}\nالتاريخ: ${booking.date}\nالوقت: ${booking.time}\nالمريض: ${booking.patient?.fullName}\nالهاتف: ${booking.patient?.phone}`);
                      const docEmail = selectedDept?.doctorEmail || '';
                      window.open(`mailto:${docEmail}?subject=${subject}&body=${body}`, '_blank');
                    }}
                  >
                    <Mail className="w-4 h-4" />
                    إرسال إشعار للطبيب
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Button variant="outline" onClick={() => setStep(3)} className="gap-2">تعديل البيانات</Button>
                <Button onClick={handleConfirm} className="gap-2 flex-1 hover:opacity-90" style={{ backgroundColor: '#5C7A6B' }}>
                  <CheckCircle2 className="w-4 h-4" />
                  تأكيد الحجز
                </Button>
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
