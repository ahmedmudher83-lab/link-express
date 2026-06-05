import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useLinexData } from '@/hooks/useLinexData';
import type { PaymentMethodConfig } from '@/types/linex';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, CreditCard, Building2, Banknote, Smartphone, ArrowLeft, Shield, AlertCircle } from 'lucide-react';

type PaymentMethod = 'zaincash' | 'asia' | 'fastpay' | 'bank' | 'cash';

interface PaymentState {
  name: string;
  type: 'center' | 'dept';
  activationType: string;
  price: number;
  months: number;
}

const iconMap: Record<string, React.ElementType> = {
  Smartphone, Building2, CreditCard, Banknote,
};

// Custom card brand colors
function getMethodColor(id: string): string {
  switch (id) {
    case 'zaincash': return 'text-yellow-600 bg-yellow-100';
    case 'asia': return 'text-blue-600 bg-blue-100';
    case 'fastpay': return 'text-green-600 bg-green-100';
    case 'mastercard': return 'text-orange-600 bg-orange-100';
    case 'visa': return 'text-indigo-600 bg-indigo-100';
    case 'bank': return 'text-purple-600 bg-purple-100';
    case 'cash': return 'text-gray-600 bg-gray-100';
    default: return 'text-gray-600 bg-gray-100';
  }
}

export default function PaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { getEnabledPaymentMethods } = useLinexData();
  const data = (location.state as PaymentState | null);

  const enabledMethods = getEnabledPaymentMethods();
  const [method, setMethod] = useState<PaymentMethod>(enabledMethods[0]?.id as PaymentMethod || 'zaincash');
  const [phone, setPhone] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">لا يوجد بيانات دفع</h2>
          <p className="text-gray-500 mb-4">يرجى العودة واختيار الاشتراك المدفوع</p>
          <Button onClick={() => navigate('/')} className="bg-teal-600 hover:bg-teal-700">العودة للرئيسية</Button>
        </Card>
      </div>
    );
  }

  const total = data.price * data.months;

  if (enabledMethods.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md border-2 border-red-200">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">طرق الدفع متوقفة حالياً</h2>
          <p className="text-gray-500 mb-4">لا توجد طرق دفع مفعلة. يرجى التواصل مع الإدارة.</p>
          <Button onClick={() => navigate('/')} className="bg-teal-600 hover:bg-teal-700">العودة للرئيسية</Button>
        </Card>
      </div>
    );
  }

  const handleConfirm = () => {
    setConfirming(true);
    setTimeout(() => { setDone(true); setConfirming(false); }, 2000);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md border-2 border-green-200">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">تم تأكيد الدفع!</h2>
          <p className="text-gray-500 mb-2">تم تفعيل اشتراك "{data.name}" بنجاح</p>
          <Button onClick={() => navigate('/')} className="bg-teal-600 hover:bg-teal-700 w-full">العودة للرئيسية</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8" dir="rtl">
      <div className="max-w-lg mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1"><ArrowLeft className="w-4 h-4" /></Button>
          <h1 className="text-xl font-bold text-gray-900">إتمام الاشتراك</h1>
        </div>

        {/* Order Summary */}
        <Card className="p-5 mb-4 bg-gradient-to-r from-teal-50 to-blue-50 border-teal-200">
          <h3 className="font-bold text-gray-900 mb-3">ملخص الطلب</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">الخدمة</span><span className="font-semibold">{data.type === 'center' ? 'مركز طبي (ب)' : 'قسم (أ)'} - {data.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">السعر الشهري</span><span className="font-semibold">{data.price.toLocaleString()} د.ع</span></div>
            <div className="flex justify-between"><span className="text-gray-500">المدة</span><span className="font-semibold">{data.months} شهر</span></div>
            <Separator />
            <div className="flex justify-between text-lg"><span className="font-bold text-gray-900">المجموع</span><span className="font-bold text-teal-700">{total.toLocaleString()} د.ع</span></div>
          </div>
        </Card>

        {/* Payment Methods - Only enabled ones */}
        <Card className="p-5 mb-4">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><CreditCard className="w-5 h-5 text-teal-600" />اختر طريقة الدفع</h3>
          <div className="space-y-2">
            {enabledMethods.map((m: PaymentMethodConfig) => {
              const Icon = iconMap[m.icon] || CreditCard;
              return (
                <button key={m.id} onClick={() => setMethod(m.id as PaymentMethod)}
                  className={`w-full p-4 rounded-xl border-2 text-right transition-all flex items-center gap-3 ${method === m.id ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${getMethodColor(m.id)}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{m.nameAr}</p>
                    <p className="text-xs text-gray-500">{m.description}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method === m.id ? 'border-teal-500 bg-teal-500' : 'border-gray-300'}`}>
                    {method === m.id && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Phone */}
        <Card className="p-5 mb-4">
          <Label className="mb-2 block">رقم الموبايل المرتبط بالدفع</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="07701234567" dir="ltr" />
          <p className="text-xs text-gray-400 mt-1">سيتم إرسال رمز التأكيد لهذا الرقم</p>
        </Card>

        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg mb-4 text-sm text-amber-800 flex items-start gap-2">
          <Shield className="w-4 h-4 shrink-0 mt-0.5" />
          <span>نسخة تجريبية (MVP). للتجربة، اضغط تأكيد.</span>
        </div>

        <Button onClick={handleConfirm} disabled={!phone || confirming} className="w-full bg-teal-600 hover:bg-teal-700 gap-2 text-lg py-6">
          {confirming ? <span className="flex items-center gap-2"><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />جاري المعالجة...</span> : <><CreditCard className="w-5 h-5" />تأكيد الدفع - {total.toLocaleString()} د.ع</>}
        </Button>
      </div>
    </div>
  );
}
