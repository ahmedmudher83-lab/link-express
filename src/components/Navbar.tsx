import { Link, useLocation } from 'react-router';
import { Activity, CalendarCheck, Home } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';

export default function Navbar() {
  const location = useLocation();
  const { settings } = useSettings();
  const isBooking = location.pathname === '/booking' || location.pathname === '/';
  const isConfirm = location.pathname === '/confirm';

  return (
    <nav className="bg-white shadow-md border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-teal-600 text-white p-2 rounded-xl group-hover:bg-teal-700 transition-colors">
              <Activity className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900 leading-tight">{settings.centerName}</span>
              <span className="text-xs text-gray-500 leading-tight">حجز المواعيد الإلكتروني</span>
            </div>
          </Link>

          <div className="flex items-center gap-1">
            <Link to="/" className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${isBooking ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">حجز موعد</span>
            </Link>
            <Link to="/confirm" className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${isConfirm ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
              <CalendarCheck className="w-4 h-4" />
              <span className="hidden sm:inline">تأكيد الحجز</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-2 text-gray-600">
            <span className="text-xs text-gray-400">التواصل:</span>
            <span dir="ltr" className="text-sm font-medium">{settings.centerPhone}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
