import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useLinexData } from '@/hooks/useLinexData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Lock, Eye, EyeOff, ArrowLeft, Mail, Smartphone, 
  Shield, User, ArrowRight, CheckCircle2, AlertCircle,
  Loader2
} from 'lucide-react';

type AuthMode = 'login' | 'register' | 'verify-otp';
type RegMethod = 'gmail' | 'phone';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, sendOTP, verifyOTP, createAccountWithOTP, isUsernameAvailable } = useAuth();
  const { pricing } = useLinexData();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [regMethod, setRegMethod] = useState<RegMethod>('gmail');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Login form
  const [loginForm, setLoginForm] = useState({ username: '', password: '', showPass: false });
  
  // Registration form
  const [regForm, setRegForm] = useState({
    fullName: '',
    identifier: '', // email or phone
    username: '',
    password: '',
    confirmPassword: '',
    showPass: false,
  });
  
  // OTP form
  const [otpForm, setOtpForm] = useState({
    otpCode: '',
    otpSent: false,
    otpCooldown: 0,
    verifiedIdentifier: '',
    verifiedMethod: 'gmail' as RegMethod,
  });

  // Simulated OTP display (for demo)
  const [simulatedOTP, setSimulatedOTP] = useState('');

  const showError = (msg: string) => { setError(msg); setTimeout(() => setError(''), 5000); };
  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

  // Countdown timer for OTP cooldown
  useState(() => {
    if (otpForm.otpCooldown > 0) {
      const timer = setTimeout(() => {
        setOtpForm(p => ({ ...p, otpCooldown: p.otpCooldown - 1 }));
      }, 1000);
      return () => clearTimeout(timer);
    }
  });

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      showError('يرجى ملء جميع الحقول');
      return;
    }
    setLoading(true);
    setError('');
    const admin = await login(loginForm.username, loginForm.password);
    setLoading(false);
    if (admin) {
      if (admin.role === 'super') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } else {
      showError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  // Handle send OTP
  const handleSendOTP = async () => {
    setError('');
    setSimulatedOTP('');
    
    // Validate
    if (!regForm.fullName || !regForm.identifier) {
      showError('يرجى ملء جميع الحقول');
      return;
    }

    // Validate identifier format
    if (regMethod === 'gmail') {
      if (!regForm.identifier.toLowerCase().endsWith('@gmail.com')) {
        showError('يُسمح فقط بحسابات Gmail');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(regForm.identifier)) {
        showError('صيغة البريد الإلكتروني غير صحيحة');
        return;
      }
    } else {
      const cleanPhone = regForm.identifier.replace(/\s/g, '');
      if (!/^07[0-9]{9}$/.test(cleanPhone)) {
        showError('صيغة رقم الموبايل غير صحيحة. يجب أن يبدأ بـ 07 ويتكون من 11 رقماً');
        return;
      }
    }

    setLoading(true);
    const result = await sendOTP(regForm.identifier, regMethod);
    setLoading(false);

    if (result.success) {
      setOtpForm(p => ({
        ...p,
        otpSent: true,
        otpCooldown: 60,
        verifiedIdentifier: regForm.identifier,
        verifiedMethod: regMethod,
      }));
      if (result.otpCode) {
        setSimulatedOTP(result.otpCode);
      }
      showSuccess('تم إرسال رمز التحقق!');
      setMode('verify-otp');
    } else {
      showError(result.error || 'فشل إرسال الرمز');
    }
  };

  // Handle verify OTP
  const handleVerifyOTP = async () => {
    if (!otpForm.otpCode || otpForm.otpCode.length !== 6) {
      showError('يرجى إدخال الرمز المكون من 6 أرقام');
      return;
    }
    
    setLoading(true);
    const result = await verifyOTP(otpForm.verifiedIdentifier, otpForm.otpCode, otpForm.verifiedMethod);
    setLoading(false);

    if (result.success) {
      showSuccess('تم التحقق بنجاح! أكمل إنشاء الحساب');
      setMode('register');
      setOtpForm(p => ({ ...p, otpSent: true }));
    } else {
      showError(result.error || 'الرمز غير صحيح');
    }
  };

  // Handle register (final step after OTP)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate
    if (!regForm.fullName || !regForm.identifier || !regForm.username || !regForm.password) {
      showError('يرجى ملء جميع الحقول');
      return;
    }

    if (regForm.password !== regForm.confirmPassword) {
      showError('كلمتا المرور غير متطابقتين');
      return;
    }

    if (regForm.password.length < 6) {
      showError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    // Check username availability
    const available = await isUsernameAvailable(regForm.username);
    if (!available) {
      showError('اسم المستخدم "' + regForm.username + '" مستخدم مسبقاً. اختر اسماً آخر.');
      return;
    }

    setLoading(true);
    const result = await createAccountWithOTP(
      regForm.fullName,
      regForm.identifier,
      regMethod,
      regForm.username,
      regForm.password,
      'center'
    );
    setLoading(false);

    if (result.success && result.admin) {
      showSuccess('تم إنشاء الحساب بنجاح!');
      // Redirect based on role
      setTimeout(() => {
        if (result.admin!.role === 'super') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      }, 1000);
    } else {
      showError(result.error || 'فشل إنشاء الحساب');
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (otpForm.otpCooldown > 0) return;
    setSimulatedOTP('');
    setLoading(true);
    const result = await sendOTP(otpForm.verifiedIdentifier, otpForm.verifiedMethod);
    setLoading(false);
    if (result.success) {
      setOtpForm(p => ({ ...p, otpCooldown: 60 }));
      if (result.otpCode) setSimulatedOTP(result.otpCode);
      showSuccess('تم إعادة إرسال الرمز!');
    } else {
      showError(result.error || 'فشل إعادة الإرسال');
    }
  };

  // Cooldown timer effect
  useState(() => {
    if (otpForm.otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpForm(p => ({ ...p, otpCooldown: Math.max(0, p.otpCooldown - 1) }));
    }, 1000);
    return () => clearInterval(timer);
  });

  return (
    <div className="min-h-screen bg-[#F8F6F0] flex items-center justify-center p-4">
      <div className="w-full max-w-md" style={{ textAlign: 'right' }}>
        {/* Back */}
        <button onClick={() => mode === 'login' ? navigate('/') : setMode('login')} className="text-gray-500 hover:text-gray-800 mb-6 flex items-center gap-2 text-sm">
          <span>{mode === 'login' ? 'العودة للرئيسية' : 'العودة لتسجيل الدخول'}</span>
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/assets/linex-logo-transparent.png" alt="LinkEX" className="h-44 md:h-52 w-auto mx-auto object-contain drop-shadow-2xl mb-4" style={{ maxWidth: '90%' }} />
          <h1 className="text-3xl font-bold tracking-wide">
            <span style={{ color: '#2c3e50' }}>Link</span>
            <span style={{ color: '#FF5722' }}>EX</span>
          </h1>
        </div>

        {/* Success / Error Messages */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Simulated OTP display (for demo) */}
        {simulatedOTP && mode === 'verify-otp' && (
          <div className="mb-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-xs text-amber-400 mb-1">رمز التحقق (للتجربة فقط)</p>
            <p className="text-2xl font-bold text-amber-300 tracking-[0.3em]" dir="ltr">{simulatedOTP}</p>
          </div>
        )}

        <Card className="p-6 border-0 shadow-2xl bg-white/95 backdrop-blur">
          
          {/* ===== LOGIN MODE ===== */}
          {mode === 'login' && (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-4 text-center flex items-center justify-center gap-2">
                <Lock className="w-5 h-5 text-teal-600" />
                دخول المدير
              </h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>اسم المستخدم</Label>
                  <Input
                    value={loginForm.username}
                    onChange={e => setLoginForm({ ...loginForm, username: e.target.value, error: '' })}
                    placeholder="أدخل اسم المستخدم"
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <div className="space-y-2">
                  <Label>كلمة المرور</Label>
                  <div className="relative">
                    <Input
                      type={loginForm.showPass ? 'text' : 'password'}
                      value={loginForm.password}
                      onChange={e => setLoginForm({ ...loginForm, password: e.target.value, error: '' })}
                      placeholder="••••••"
                      dir="ltr"
                      className="pl-10 text-left"
                    />
                    <button
                      type="button"
                      onClick={() => setLoginForm(p => ({ ...p, showPass: !p.showPass }))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {loginForm.showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  {loading ? 'جاري الدخول...' : 'دخول'}
                </Button>
              </form>

              <div className="mt-6 pt-4 border-t border-gray-100">
                <button 
                  onClick={() => { setMode('verify-otp'); setRegMethod('gmail'); setError(''); setSuccess(''); }}
                  className="w-full text-center text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center justify-center gap-2"
                >
                  <User className="w-4 h-4" />
                  إنشاء حساب جديد
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-xs text-center text-gray-400 mt-3">
                  إذا نسيت كلمة المرور، تواصل مع المدير العام
                </p>
              </div>
            </>
          )}

          {/* ===== VERIFY OTP MODE (First step of registration) ===== */}
          {mode === 'verify-otp' && !otpForm.otpSent && (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-4 text-center flex items-center justify-center gap-2">
                <Shield className="w-5 h-5 text-teal-600" />
                التحقق من الحساب
              </h2>
              <p className="text-sm text-gray-500 text-center mb-4">
                اختر طريقة التسجيل وأدخل بياناتك لاستلام رمز التحقق
              </p>

              {/* Trial Period Notice */}
              {pricing.trial?.enabled && (
                <div className="bg-teal-50 p-3 rounded-lg border border-teal-200 mb-4">
                  <p className="text-sm text-teal-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>سجل اشتراكك اليوم واحصل على <strong>{pricing.trial?.trialDays || 10} أيام</strong> مجاناً كفترة تجريبية</span>
                  </p>
                </div>
              )}

              {/* Method Selection */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setRegMethod('gmail')}
                  className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${
                    regMethod === 'gmail' 
                      ? 'border-red-400 bg-red-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Mail className={`w-6 h-6 mx-auto mb-1 ${regMethod === 'gmail' ? 'text-red-500' : 'text-gray-400'}`} />
                  <p className="text-sm font-semibold">Gmail</p>
                </button>
                <button
                  onClick={() => setRegMethod('phone')}
                  className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${
                    regMethod === 'phone' 
                      ? 'border-teal-400 bg-teal-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Smartphone className={`w-6 h-6 mx-auto mb-1 ${regMethod === 'phone' ? 'text-teal-600' : 'text-gray-400'}`} />
                  <p className="text-sm font-semibold">موبايل</p>
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>الاسم الكامل</Label>
                  <Input
                    value={regForm.fullName}
                    onChange={e => setRegForm({ ...regForm, fullName: e.target.value })}
                    placeholder="الاسم الكامل"
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {regMethod === 'gmail' ? 'البريد الإلكتروني (Gmail فقط)' : 'رقم الموبايل'}
                  </Label>
                  <div className="relative">
                    {regMethod === 'gmail' ? (
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    ) : (
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    )}
                    <Input
                      value={regForm.identifier}
                      onChange={e => setRegForm({ ...regForm, identifier: e.target.value })}
                      placeholder={regMethod === 'gmail' ? 'example@gmail.com' : '07xxxxxxxx'}
                      dir="ltr"
                      className="pl-10 text-left"
                      type={regMethod === 'phone' ? 'tel' : 'email'}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    {regMethod === 'gmail' 
                      ? 'يُسمح فقط بحسابات Gmail (@gmail.com)' 
                      : 'أدخل رقم موبايل عراقي يبدأ بـ 07'}
                  </p>
                </div>
                <Button 
                  onClick={handleSendOTP} 
                  disabled={loading} 
                  className="w-full bg-teal-600 hover:bg-teal-700 gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  {loading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
                </Button>
              </div>
            </>
          )}

          {/* ===== OTP CODE INPUT MODE ===== */}
          {mode === 'verify-otp' && otpForm.otpSent && (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-4 text-center flex items-center justify-center gap-2">
                <Shield className="w-5 h-5 text-teal-600" />
                أدخل رمز التحقق
              </h2>
              <p className="text-sm text-gray-500 text-center mb-4">
                تم إرسال رمز التحقق إلى{' '}
                <span className="font-medium text-gray-700" dir="ltr">
                  {otpForm.verifiedIdentifier}
                </span>
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>رمز التحقق (6 أرقام)</Label>
                  <Input
                    value={otpForm.otpCode}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtpForm({ ...otpForm, otpCode: val });
                    }}
                    placeholder="000000"
                    dir="ltr"
                    className="text-center text-2xl tracking-[0.5em] font-bold"
                    maxLength={6}
                  />
                </div>
                <Button 
                  onClick={handleVerifyOTP} 
                  disabled={loading || otpForm.otpCode.length !== 6} 
                  className="w-full bg-teal-600 hover:bg-teal-700 gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {loading ? 'جاري التحقق...' : 'تحقق'}
                </Button>
                
                <div className="text-center">
                  <button
                    onClick={handleResendOTP}
                    disabled={otpForm.otpCooldown > 0 || loading}
                    className="text-sm text-teal-600 hover:text-teal-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    {otpForm.otpCooldown > 0 
                      ? `إعادة الإرسال بعد ${otpForm.otpCooldown} ثانية` 
                      : 'إعادة إرسال الرمز'}
                  </button>
                </div>

                <button 
                  onClick={() => { setOtpForm(p => ({ ...p, otpSent: false, otpCode: '' })); setSimulatedOTP(''); }}
                  className="w-full text-center text-sm text-gray-400 hover:text-gray-600"
                >
                  تغيير {otpForm.verifiedMethod === 'gmail' ? 'البريد الإلكتروني' : 'رقم الموبايل'}
                </button>
              </div>
            </>
          )}

          {/* ===== REGISTER MODE (Final step after OTP) ===== */}
          {mode === 'register' && (
            <>
              <div className="text-center mb-4">
                <Badge className="bg-green-100 text-green-700 mb-2">
                  <CheckCircle2 className="w-3 h-3 inline ml-1" />
                  تم التحقق بنجاح
                </Badge>
                <h2 className="text-lg font-bold text-gray-900 flex items-center justify-center gap-2">
                  <User className="w-5 h-5 text-teal-600" />
                  أكمل إنشاء الحساب
                </h2>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label>الاسم الكامل</Label>
                  <Input
                    value={regForm.fullName}
                    onChange={e => setRegForm({ ...regForm, fullName: e.target.value })}
                    placeholder="الاسم الكامل"
                  />
                </div>
                <div className="space-y-2">
                  <Label>اسم المستخدم</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      value={regForm.username}
                      onChange={e => setRegForm({ ...regForm, username: e.target.value.replace(/\s/g, '') })}
                      placeholder="username"
                      dir="ltr"
                      className="pl-10 text-left"
                    />
                  </div>
                  <p className="text-xs text-gray-400">اسم فريد للدخول إلى حسابك</p>
                </div>
                <div className="space-y-2">
                  <Label>كلمة المرور</Label>
                  <div className="relative">
                    <Input
                      type={regForm.showPass ? 'text' : 'password'}
                      value={regForm.password}
                      onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                      placeholder="••••••"
                      dir="ltr"
                      className="pl-10 text-left"
                    />
                    <button
                      type="button"
                      onClick={() => setRegForm(p => ({ ...p, showPass: !p.showPass }))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {regForm.showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">6 أحرف على الأقل</p>
                </div>
                <div className="space-y-2">
                  <Label>تأكيد كلمة المرور</Label>
                  <Input
                    type="password"
                    value={regForm.confirmPassword}
                    onChange={e => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                    placeholder="••••••"
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
                </Button>
              </form>

              <button 
                onClick={() => setMode('login')}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-4"
              >
                لديك حساب؟ سجل الدخول
              </button>
            </>
          )}
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-6">
          نظام LinkEX لإدارة المراكز الطبية
        </p>
      </div>
    </div>
  );
}
