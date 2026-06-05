import { Activity, MapPin, Phone, Mail, Clock } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';

export default function Footer() {
  const { settings } = useSettings();

  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-teal-600 text-white p-2 rounded-xl">
                <Activity className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold text-white">{settings.centerName}</span>
            </div>
            <p className="text-sm leading-relaxed">
              نقدم رعاية طبية متميزة بأحدث التقنيات وأفضل الكوادر الطبية المتخصصة. 
              احجز موعدك بسهولة وراحة.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">معلومات التواصل</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
                <span>{settings.centerAddress}</span>
              </li>
              <li className="flex items-center gap-2 text-sm" dir="ltr">
                <Phone className="w-4 h-4 text-teal-400 shrink-0" />
                <span>{settings.centerPhone}</span>
              </li>
              {settings.centerEmail && (
                <li className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>{settings.centerEmail}</span>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">أوقات العمل</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-teal-400 shrink-0" />
                <span>{settings.workingDays}: {settings.workingHours}</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-teal-400 shrink-0" />
                <span>الجمعة: {settings.fridayHours}</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-red-400 shrink-0" />
                <span>الطوارئ: {settings.emergencyHours}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-6 text-center text-xs text-gray-500">
          <p>جميع الحقوق محفوظة. {settings.centerName}.</p>
        </div>
      </div>
    </footer>
  );
}
