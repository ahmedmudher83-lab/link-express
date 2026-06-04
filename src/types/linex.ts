// ======== LINK EXPRESS - نظام إدارة المراكز الطبية ========

export type AdminRole = 'super' | 'center' | 'department';

export type ActivationType = 'free' | 'paid';

export interface Admin {
  id: string;
  fullName: string;
  username: string;
  password: string;
  role: AdminRole;
  phone: string;
  email: string;
  centerId?: string;
  departmentId?: string;
  isActive: boolean;
  createdAt: string;
}

// طبيب داخل المركز
export interface Doctor {
  id: string;
  name: string;
  specialty: string;       // اسم التخصص (مثال: "جراحة العظام")
  title: string;           // اللقب (مثال: "استشاري"، "أخصائي")
  email: string;           // ايميل الطبيب (للتقويم)
  phone: string;
  bio: string;
  image: string;           // صورة الطبيب (URL أو base64)
  // جدولة منفصلة لكل طبيب
  consultationDuration: number; // مدة الكشف بالدقائق (افتراضي 15)
  startTime: string;       // بداية الدوام (مثال: "09:00")
  endTime: string;         // نهاية الدوام (مثال: "14:00")
  daysOff: string[];       // أيام العطلة
  isActive: boolean;
}

// مركز طبي = صفحة (ب)
export interface Center {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo: string; // رابط الشعار أو base64
  workingDays: string;
  workingHours: string;
  fridayHours: string;
  emergencyHours: string;
  // جدولة المواعيد
  consultationDuration: number; // مدة الكشف بالدقائق (افتراضي 15)
  // الأطباء والتخصصات
  doctors: Doctor[];
  adminId: string;
  // تفعيل الاشتراك
  activationType: ActivationType;
  subscriptionPrice: number;
  freeTrialDays: number;
  createdAt: string;
  expiresAt: string;
  isPaid: boolean;
  isActive: boolean;
  status: 'active' | 'trial' | 'expired' | 'closed';
  // الظهور في الصفحة الرئيسية
  appearanceType: 'hidden' | 'free_trial' | 'paid';
  appearanceExpiry: string; // تاريخ انتهاء الظهور
  // إعلان ونبذة
  promoImages: string[]; // صور دعائية
  promoText: string; // نبذة دعائية
  // إعدادات مخصصة من الأدمن (ج) - تتجاوز الإعدادات العامة
  customPlatformPrice?: number;    // سعر مخصص للاشتراك في المنصة
  customPlatformTrial?: number;    // فترة تجريبية مخصصة للمنصة
  customAppearancePrice?: number;  // سعر مخصص للظهور الإعلاني
  customAppearanceTrial?: number;  // فترة تجريبية مخصصة للظهور
}

// قسم / تخصص = صفحة (أ)
export interface Department {
  id: string;
  name: string;
  description: string;
  icon: string;
  doctorName: string;
  doctorEmail: string;
  doctorPhone: string;
  logo: string; // رابط الشعار أو base64
  // جدولة المواعيد - المركز يحدد المواعيد الأساسية وكل قسم يرثها ويعدلها
  workingDays: string;
  workingHours: string;
  fridayHours: string;
  consultationDuration: number; // مدة الكشف بالدقائق (افتراضي 15)
  startTime: string;       // بداية الدوام (مثال: "08:00") - يرث من المركز
  endTime: string;         // نهاية الدوام (مثال: "22:00") - يرث من المركز
  daysOff: string[];       // أيام العطلة (افتراضياً الجمعة)
  centerId: string | null;
  adminId: string;
  // تفعيل الاشتراك
  activationType: ActivationType;
  subscriptionPrice: number;
  freeTrialDays: number;
  createdAt: string;
  expiresAt: string;
  isPaid: boolean;
  isActive: boolean;
  status: 'active' | 'trial' | 'expired' | 'closed';
  // الظهور في الصفحة الرئيسية
  appearanceType: 'hidden' | 'free_trial' | 'paid';
  appearanceExpiry: string;
  // إعلان ونبذة
  promoImages: string[];
  promoText: string;
  // إعدادات مخصصة من الأدمن (ج) - تتجاوز الإعدادات العامة
  customPlatformPrice?: number;
  customPlatformTrial?: number;
  customAppearancePrice?: number;
  customAppearanceTrial?: number;
}

// إعدادات رقم (1) - اشتراك المنصة
export interface PlatformPricing {
  centerMonthlyPrice: number;     // سعر اشتراك المركز شهرياً
  deptMonthlyPrice: number;       // سعر اشتراك العيادة شهرياً
  freeTrialDays: number;          // فترة تجريبية للمنصة
}

// إعدادات رقم (2) - الظهور الإعلاني
export interface AppearancePricing {
  monthlyPrice: number;           // سعر الظهور الإعلاني شهرياً
  freeTrialDays: number;          // فترة تجريبية للظهور
}

// إعدادات عامة - تجمع الإعدادتين
export interface PricingDefaults {
  platform: PlatformPricing;
  appearance: AppearancePricing;
}

// Payment method config - controlled by admin (ج)
export interface PaymentMethodConfig {
  id: string;
  name: string;
  nameAr: string;
  enabled: boolean;
  icon: string;
  description: string;
  // بيانات المستلم
  recipientName: string;     // اسم صاحب الحساب/المحفظة
  recipientNumber: string;   // رقم الحساب/المحفظة/البطاقة
  recipientPhone: string;    // رقم الهاتف المرتبط
  recipientBank: string;     // اسم البنك (للتحويل البنكي)
  instructions: string;      // تعليمات إضافية للمستخدم
}

export interface PaymentMethodsSettings {
  methods: PaymentMethodConfig[];
}

// رسالة إعلانية من الأدمن (ج) تظهر في صفحات المدراء
export interface AdminAnnouncement {
  id: string;
  message: string;           // نص الرسالة
  active: boolean;           // هل الرسالة مفعلة
  showToAll: boolean;        // هل تظهر للجميع
  targetAdminIds: string[];  // إذا لم تكن للجميع، أرسل لهؤلاء فقط
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  action: 'create_center' | 'create_department' | 'close_center' | 'close_department' | 'login' | 'logout' | 'update_settings' | 'renew_subscription';
  adminName: string;
  targetName: string;
  timestamp: string;
  details: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  admin: Admin | null;
}

export function computeStatus(
  isActive: boolean,
  createdAt: string,
  expiresAt: string,
  isPaid: boolean,
  freeTrialDays: number
): 'active' | 'trial' | 'expired' | 'closed' {
  if (!isActive) return 'closed';
  const now = new Date();
  const expiry = new Date(expiresAt);
  if (now > expiry) return 'expired';
  const created = new Date(createdAt);
  const trialEnd = new Date(created);
  trialEnd.setDate(trialEnd.getDate() + freeTrialDays);
  if (!isPaid && now <= trialEnd) return 'trial';
  return 'active';
}

export function getRemainingDays(expiresAt: string): number {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getStatusLabel(status: 'active' | 'trial' | 'expired' | 'closed'): string {
  switch (status) {
    case 'active': return 'نشط';
    case 'trial': return 'فترة تجريبية';
    case 'expired': return 'منتهي';
    case 'closed': return 'مغلق';
  }
}

export function getStatusColor(status: 'active' | 'trial' | 'expired' | 'closed'): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700 border-green-200';
    case 'trial': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'expired': return 'bg-red-100 text-red-700 border-red-200';
    case 'closed': return 'bg-gray-100 text-gray-500 border-gray-200';
  }
}

export function getActivationLabel(type: ActivationType): string {
  return type === 'free' ? 'اشتراك مجاني' : 'اشتراك مدفوع';
}

export function getActivationBadge(type: ActivationType): string {
  return type === 'free' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-amber-100 text-amber-700 border-amber-200';
}
