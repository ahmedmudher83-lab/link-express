import { Routes, Route, Navigate } from 'react-router';
import { AuthProvider } from '@/hooks/useAuth';
import { LinexDataProvider } from '@/hooks/useLinexData';
import { BookingProvider } from '@/hooks/useBooking';
import { SettingsProvider } from '@/hooks/useSettings';
import LandingPage from '@/pages/LandingPage';
import AdminDashboard from '@/pages/AdminDashboard';
import LoginPage from '@/pages/LoginPage';
import Dashboard from '@/pages/Dashboard';
import PageA from '@/pages/PageA';
import PageB from '@/pages/PageB';
import PaymentPage from '@/pages/PaymentPage';

export default function App() {
  return (
    <AuthProvider>
      <LinexDataProvider>
        <BookingProvider>
          <SettingsProvider>
            <Routes>
              {/* Landing Page (C) - for everyone */}
              <Route path="/" element={<LandingPage />} />

              {/* Public Login - for center/department managers */}
              <Route path="/login" element={<LoginPage />} />

              {/* Manager Dashboard - for center/department admins */}
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Super Admin Dashboard */}
              <Route path="/admin" element={<AdminDashboard />} />

              {/* Page (B) - Center confirmation page */}
              <Route path="/center/:centerId" element={<PageB />} />

              {/* Page (A) - Booking page linked to center */}
              <Route path="/center/:centerId/booking" element={<PageA />} />

              {/* Page (A) - Independent booking page */}
              <Route path="/dept/:deptId/booking" element={<PageA />} />

              {/* Payment Page */}
              <Route path="/payment" element={<PaymentPage />} />

              {/* Legacy redirects */}
              <Route path="/confirm" element={<Navigate to="/" replace />} />
              <Route path="/booking" element={<Navigate to="/" replace />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SettingsProvider>
        </BookingProvider>
      </LinexDataProvider>
    </AuthProvider>
  );
}
