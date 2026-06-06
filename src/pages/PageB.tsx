import { useParams, useNavigate } from 'react-router';
import { useBooking } from '@/hooks/useBooking';
import { useSettings } from '@/hooks/useSettings';
import { useLinexData } from '@/hooks/useLinexData';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import html2canvas from 'html2canvas';
import { useRef, useEffect } from 'react';
import {
  CalendarCheck, Clock, Stethoscope, Phone,
  MapPin, Download, RotateCcw, CheckCircle2, AlertCircle,
  CalendarDays, Award, Star, Home, Building2,
  Mail, ChevronLeft, Users
} from 'lucide-react';

// Helper: get Arabic day name from date string
function getArabicDay(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return days[d.getDay()];
  } catch { return ''; }
}

export default function PageB() {
  const { centerId } = useParams<{ centerId: string }>();
  const navigate = useNavigate();
  const { booking, resetBooking } = useBooking();
  const { settings } = useSettings();
  const { getCenterById, getDepartmentsByCenter } = useLinexData();
  const center = centerId ? getCenterById(centerId) : null;
  const ticketRef = useRef<HTMLDivElement>(null);
  const autoSaved = useRef(false);

  // Auto-save ticket as image when confirmed
  useEffect(() => {
    if (ticketRef.current && !autoSaved.current && booking.patient?.fullName) {
      autoSaved.current = true;
      // Small delay to ensure rendering is complete
      const timer = setTimeout(async () => {
        try {
          const canvas = await html2canvas(ticketRef.current!, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
          });
          const link = document.createElement('a');
          link.download = `LinkEX-حجز-${booking.patient?.fullName || 'موعد'}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        } catch (err) {
          console.error('Auto-save ticket failed:', err);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [booking]);

  const handleNewBooking = () => {
    resetBooking();
    if (centerId) navigate(`/center/${centerId}/booking`);
    else navigate('/');
  };

  // Manual save ticket as image
  const handleSaveTicket = async () => {
    if (!ticketRef.current) return;
    try {
      const canvas = await html2canvas(ticketRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `LinkEX-حجز-${booking.patient?.fullName || 'موعد'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Save ticket failed:', err);
    }
  };

  // If center not found
  if (!center || !center.isActive) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">المركز غير موجود</h2>
          <p className="text-gray-500 mb-6">لم يتم العثور على هذا المركز أو أنه غير نشط حالياً.</p>
          <Button onClick={() => navigate('/')} className="bg-teal-600 hover:bg-teal-700 gap-2">
            <Home className="w-4 h-4" />
            الرئيسية
          </Button>
        </Card>
      </div>
    );
  }

  // Use center data OR fallback to settings
  const displayName = center?.name || settings.centerName;
  const displayAddress = center?.address || settings.centerAddress;
  const displayPhone = center?.phone || settings.centerPhone;
  const displayEmail = center?.email || settings.centerEmail;
  const displayWorkingDays = center?.workingDays || settings.workingDays;
  const displayWorkingHours = center?.workingHours || settings.workingHours;
  const displayFriday = center?.fridayHours || settings.fridayHours;
  const displayEmergency = center?.emergencyHours || settings.emergencyHours;

  const linkedDepts = centerId ? getDepartmentsByCenter(centerId) : [];
  const bookingId = booking.bookingId;

  // Empty state (no booking)
  if (!booking.specialty || !booking.doctor || !booking.patient) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-gradient-to-br from-teal-700 via-teal-600 to-teal-800 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold mb-2">{displayName}</h1>
            <p className="text-teal-100">نظام تأكيد الحجوزات - صفحة ب</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="p-8 max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarCheck className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">لا يوجد حجز حالي</h2>
            <p className="text-gray-500 mb-4">لم يتم العثور على بيانات حجز.</p>
            {linkedDepts.length > 0 && (
              <div className="text-right mb-4 bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-2">الأقسام المتاحة:</p>
                <div className="flex flex-wrap gap-2">
                  {linkedDepts.map(d => (
                    <Badge key={d.id} variant="outline" className="cursor-pointer hover:bg-teal-50"
                      onClick={() => navigate(`/center/${centerId}/booking`)}>
                      {d.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button onClick={handleNewBooking} className="bg-teal-600 hover:bg-teal-700 gap-2">
                <Home className="w-4 h-4" />
                حجز موعد جديد
              </Button>
              <Button variant="outline" onClick={() => navigate('/')} className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                <span style={{ color: '#2c3e50' }}>Link</span><span style={{ color: '#FF5722' }}>EX</span>
              </Button>
            </div>
          </Card>

          {/* Center Info */}
          <Card className="p-6 mt-6 max-w-md mx-auto">
            <h3 className="font-bold text-gray-900 mb-3">معلومات المركز</h3>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-teal-600" /> {displayAddress}</p>
              <p className="flex items-center gap-2" dir="ltr"><Phone className="w-4 h-4 text-teal-600" /> {displayPhone}</p>
              {displayEmail && <p className="flex items-center gap-2" dir="ltr"><Mail className="w-4 h-4 text-teal-600" /> {displayEmail}</p>}
              <Separator className="my-2" />
              <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-teal-600" /> {displayWorkingDays}: {displayWorkingHours}</p>
              <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-600" /> الجمعة: {displayFriday}</p>
              <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-red-500" /> الطوارئ: {displayEmergency}</p>
            </div>
          </Card>

        </div>
      </div>
    );
  }

  // Main booking confirmation view
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-gradient-to-br from-teal-700 via-teal-600 to-teal-800 text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">تم تأكيد حجزك بنجاح!</h1>
          <p className="text-teal-100">
            تم حفظ موعدك في {displayName}. نتمنى لك الصحة والعافية.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 pb-12">
        {/* Patient Ticket Card - Name + Day + Date + Time */}
        <div ref={ticketRef}>
        <Card className="p-6 mb-4 border-2 border-teal-200 shadow-xl bg-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center sm:text-right">
                <div>
                  <p className="text-sm text-gray-500 mb-1">اسم المريض</p>
                  <p className="text-lg font-bold text-teal-700">
                    {booking.patient?.fullName || 'غير محدد'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">يوم الحجز</p>
                  <p className="text-lg font-bold text-teal-700">
                    {getArabicDay(booking.date) || 'غير محدد'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">تاريخ الحجز</p>
                  <p className="text-lg font-bold text-teal-700">
                    {booking.date || 'غير محدد'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">وقت الحجز</p>
                  <p className="text-lg font-bold text-teal-700" dir="ltr">
                    {booking.time || 'غير محدد'}
                  </p>
                </div>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-700 border-green-200 px-4 py-1.5 text-sm shrink-0">
              <CheckCircle2 className="w-4 h-4 ml-1" />
              حجز مؤكد
            </Badge>
          </div>
        </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-teal-600" />
                تفاصيل الموعد
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
                    <Stethoscope className="w-6 h-6 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">التخصص</p>
                    <p className="font-semibold text-gray-900 text-lg">{booking.specialty?.name}</p>
                    {booking.specialty?.doctorEmail && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3" />
                        {booking.specialty.doctorEmail}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <img
                    src={booking.doctor?.image}
                    alt={booking.doctor?.name}
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-lg">{booking.doctor?.name}</p>
                      <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-full">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs font-semibold text-yellow-700">{booking.doctor?.rating}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant="secondary" className="text-xs">{booking.doctor?.title}</Badge>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        {booking.doctor?.experience} سنة خبرة
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-teal-50 rounded-xl border border-teal-100">
                    <CalendarDays className="w-6 h-6 text-teal-600" />
                    <div>
                      <p className="text-sm text-teal-600">التاريخ</p>
                      <p className="font-bold text-teal-900">{booking.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-teal-50 rounded-xl border border-teal-100">
                    <Clock className="w-6 h-6 text-teal-600" />
                    <div>
                      <p className="text-sm text-teal-600">الوقت</p>
                      <p className="font-bold text-teal-900">{booking.time}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                بيانات المريض
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">الاسم الكامل</p>
                  <p className="font-semibold text-gray-900">{booking.patient?.fullName}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">رقم الموبايل</p>
                  <p className="font-semibold text-gray-900" dir="ltr">{booking.patient?.phone}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">العمر</p>
                  <p className="font-semibold text-gray-900">{booking.patient?.age} سنة</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">الجنس</p>
                  <p className="font-semibold text-gray-900">{booking.patient?.gender === 'male' ? 'ذكر' : 'أنثى'}</p>
                </div>
                {booking.patient?.email && (
                  <div className="p-3 bg-gray-50 rounded-lg sm:col-span-2">
                    <p className="text-xs text-gray-500 mb-1">البريد الإلكتروني</p>
                    <p className="font-semibold text-gray-900" dir="ltr">{booking.patient?.email}</p>
                  </div>
                )}
              </div>
              {booking.patient?.notes && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                  <p className="text-xs text-yellow-700 mb-1">ملاحظات</p>
                  <p className="text-sm text-gray-700">{booking.patient.notes}</p>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-600" />
                معلومات المركز
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="text-gray-900 font-medium">{displayName}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="text-gray-600">{displayAddress}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="text-gray-600" dir="ltr">{displayPhone}</span>
                </div>
                {displayEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="text-gray-600" dir="ltr">{displayEmail}</span>
                  </div>
                )}
                <Separator />
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="text-gray-600">{displayWorkingDays}: {displayWorkingHours}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-gray-600">الجمعة: {displayFriday}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-gray-600">الطوارئ: {displayEmergency}</span>
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-amber-50 border-amber-200">
              <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                ملاحظات مهمة
              </h3>
              <ul className="space-y-2 text-sm text-amber-800">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 shrink-0" />
                  الرجاء الوصول قبل 15 دقيقة من موعدك.
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 shrink-0" />
                  احضر بطاقة الهوية والتأمين الطبي.
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 shrink-0" />
                  يمكنك إلغاء الحجز قبل 24 ساعة.
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 shrink-0" />
                  سيتم إرسال تذكير عبر الرسائل القصيرة.
                </li>
              </ul>
            </Card>

            {/* Save Ticket */}
            <Card className="p-5">
              <h3 className="font-bold text-center mb-3" style={{ color: '#2D2825' }}>تذكرة الحجز</h3>
              <p className="text-xs text-gray-500 text-center mb-3">
                تم حفظ التذكرة تلقائياً. يمكنك إعادة الحفظ يدوياً.
              </p>
              <div className="space-y-2">
                <Button variant="outline" className="w-full gap-2" onClick={handleSaveTicket}>
                  <Download className="w-4 h-4" />
                  حفظ التذكرة كصورة
                </Button>
                                <Button variant="outline" className="w-full gap-2" onClick={handleNewBooking}>
                  <RotateCcw className="w-4 h-4" />
                  حجز جديد
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8">
          <Button onClick={() => navigate('/')} className="bg-teal-600 hover:bg-teal-700 gap-2">
            <Home className="w-4 h-4" />
            <span style={{ color: '#2c3e50' }}>Link</span><span style={{ color: '#FF5722' }}>EX</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
