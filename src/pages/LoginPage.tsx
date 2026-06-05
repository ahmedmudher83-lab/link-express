import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '', showPass: false, error: '', loading: false });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) return;
    setForm(p => ({ ...p, loading: true, error: '' }));
    const admin = await login(form.username, form.password);
    if (admin) {
      // Redirect based on role
      if (admin.role === 'super') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } else {
      setForm(p => ({ ...p, loading: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="w-full max-w-md px-6" style={{ textAlign: 'right' }}>
        {/* Back */}
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white mb-6 flex items-center gap-2 text-sm">
          <span>العودة للرئيسية</span>
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/assets/linex-logo-transparent.png" alt="LinkEX" className="h-44 md:h-52 w-auto mx-auto object-contain drop-shadow-2xl mb-4" style={{ maxWidth: '90%' }} />
          <h1 className="text-3xl font-bold tracking-wide"><span style={{ color: '#2c3e50' }}>Link</span><span style={{ color: '#FF5722' }}>EX</span></h1>
          <p className="text-slate-400 mt-2 text-sm">تسجيل دخول مدير المركز أو العيادة</p>
        </div>

        <Card className="p-6 border-0 shadow-2xl bg-white/95 backdrop-blur">
          <h2 className="text-lg font-bold text-gray-900 mb-4 text-center flex items-center justify-center gap-2">
            <Lock className="w-5 h-5 text-teal-600" />
            دخول المدير
          </h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label>اسم المستخدم</Label>
              <Input
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value, error: '' })}
                placeholder="أدخل اسم المستخدم"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <div className="relative">
                <Input
                  type={form.showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value, error: '' })}
                  placeholder="••••••"
                  dir="ltr"
                  className="pl-10 text-left"
                />
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, showPass: !p.showPass }))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {form.showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {form.error && <p className="text-sm text-red-500 text-center bg-red-50 py-2 rounded-lg">{form.error}</p>}
            <Button type="submit" disabled={form.loading} className="w-full bg-teal-600 hover:bg-teal-700 gap-2">
              <Lock className="w-4 h-4" />
              {form.loading ? 'جاري الدخول...' : 'دخول'}
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-center text-gray-400">
              إذا نسيت كلمة المرور، تواصل مع المدير العام
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
