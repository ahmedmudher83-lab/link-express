import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, MousePointer, CalendarDays, User, CheckCircle2, ChevronLeft, ChevronRight, Smartphone, Share2, Clock } from 'lucide-react';

interface GuideProps {
  onClose: () => void;
}

const steps = [
  {
    icon: MousePointer,
    title: 'اختر التخصص',
    description: 'من الصفحة الرئيسية، اختر التخصص الطبي المناسب لحالتك (مثل: العظام، الجلدية، الأسنان...)',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: User,
    title: 'اختر الطبيب',
    description: 'ستظهر قائمة الأطباء المتاحين. كل طبيب يعرض خبرته وتقييمه وأوقات دوامه. اختر الطبيب المناسب.',
    color: 'text-teal-600 bg-teal-50',
  },
  {
    icon: CalendarDays,
    title: 'اختر اليوم والوقت',
    description: 'اختر اليوم المناسب من الأيام المتاحة، ثم اختر وقت الحجز من المواعيل المتاحة. كل كشف له مدته المحددة.',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    icon: User,
    title: 'أدخل بياناتك',
    description: 'أدخل اسمك الكامل ورقم موبايلك (العراقي) والعمر. الإيميل والملاحظات اختيارية.',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    icon: CheckCircle2,
    title: 'تأكيد الحجز',
    description: 'راجع بياناتك واضغط "تأكيد الحجز". سيظهر لك رقم الحجز والرقم المرجعي. احفظه!',
    color: 'text-green-600 bg-green-50',
  },
];

export default function Guide({ onClose }: GuideProps) {
  const [step, setStep] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
      <Card className="w-full max-w-lg p-6 relative">
        <button onClick={onClose} className="absolute left-4 top-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">كيف تحجز موعدك؟</h2>
          <p className="text-gray-500 text-sm">دليل سريع لحجز موعدك في 5 خطوات</p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {steps.map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-teal-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Step Content */}
        <div className="text-center py-6">
          <div className={`w-16 h-16 ${steps[step].color} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
            {(() => {
              const Icon = steps[step].icon;
              return <Icon className="w-8 h-8" />;
            })()}
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-3">
            الخطوة {step + 1}: {steps[step].title}
          </h3>
          <p className="text-gray-600 leading-relaxed">{steps[step].description}</p>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="gap-2">
            <ChevronRight className="w-4 h-4" /> السابق
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} className="bg-teal-600 hover:bg-teal-700 gap-2">
              التالي <ChevronLeft className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={onClose} className="bg-teal-600 hover:bg-teal-700 gap-2">
              <CheckCircle2 className="w-4 h-4" /> فهمت
            </Button>
          )}
        </div>

        {/* Quick Tips */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-teal-600" />
            نصائح سريعة
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <span>وصل قبل 15 دقيقة من موعدك</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
              <Share2 className="w-4 h-4 text-blue-500 shrink-0" />
              <span>احفظ رقم الحجز في هاتفك</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
