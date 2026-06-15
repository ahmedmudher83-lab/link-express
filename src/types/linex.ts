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
  // Soft Delete Fields
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
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
  workingDays: string[]; // أيام دوام المركز: ["السبت", "الأحد", ...]
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
  // ===== Soft Delete Fields =====
  deleted?: boolean;               // هل تم الحذف الناعم
  deletedAt?: string;              // تاريخ الحذف الناعم
  deletedBy?: string;              // معرف الأدمن الذي قام بالحذف
}

// قسم / تخصص = صفحة (أ)
// كل قسم له جدوله الخاص مستقل عن المركز
export interface Department {
  id: string;
  name: string;
  description: string;
  icon: string;
  doctorName: string;
  doctorEmail: string;
  doctorPhone: string;
  logo: string; // رابط الشعار أو base64
  // ===== جدولة المواعيد الخاصة بالقسم (مستقلة تماماً) =====
  workingDays: string[];   // أيام الدوام: ["السبت", "الأحد", "الاثنين", ...]
  startTime: string;       // بداية الدوام ("09:00")
  endTime: string;         // نهاية الدوام ("14:00")
  consultationDuration: number; // مدة الكشف بالدقائق (افتراضي 15)
  daysOff: string[];       // أيام العطلة الأسبوعية (افتراضياً ["الجمعة"])
  vacationDays: string[];  // أيام إجازة اضطرارية (تواريخ YYYY-MM-DD)
  bookingWindow: number;   // عدد الأيام المقبلة الظاهرة للحجز (افتراضي 7)
  // حقول قديمة للتوافق - لا تستخدم في الجدولة
  workingHours: string;
  fridayHours: string;
  // =====
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
  // ===== Soft Delete Fields =====
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
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
  dailyPrice: number;             // سعر الظهور الإعلاني يومياً
  freeTrialDays: number;          // فترة تجريبية للظهور
}

// إعدادات ظهور ميزة الاشتراك الإعلاني للعملاء - يتحكم فيها المدير العام
export type AppearanceTarget = 'all' | 'centers' | 'departments';

export interface AppearanceVisibilitySettings {
  enabled: boolean;           // هل ميزة الظهور الإعلاني مفعلة للعملاء
  target: AppearanceTarget;   // لمن تظهر: الكل / مراكز فقط / عيادات فقط
}

// كيان مُظهر يدوياً في الواجهة من قبل المدير العام
export interface FeaturedEntity {
  id: string;
  entityId: string;           // centerId أو deptId
  entityType: 'center' | 'department';
  name: string;
  startDate: string;          // تاريخ بداية الظهور
  endDate: string;            // تاريخ نهاية الظهور
  isPaid: boolean;            // هل مدفوع أم مجاني
  price: number;              // السعر (0 إذا مجاني)
  isManual: boolean;          // هل إظهار يدوي من المدير العام
  createdAt: string;
}

// إعدادات تقويم Google للطبيب
export interface DoctorCalendarSettings {
  enabled: boolean;           // هل التقويم مفعل
  googleAccessToken: string;  // Access Token من Google OAuth
  googleRefreshToken: string; // Refresh Token
  googleEmail: string;        // بريد Gmail المرتبط
  calendarId: string;         // ID التقويم (عادةً 'primary')
}

// إعدادات التقرير اليومي
export interface DailyReportSettings {
  enabled: boolean;           // هل التقرير مفعل
  reportTime: string;         // وقت إرسال التقرير (مثال: "11:00")
  sendToEmail: boolean;       // إرسال للبريد
  sendToWhatsApp: boolean;    // إرسال لواتساب
  whatsappNumber: string;     // رقم الواتساب
  doctorEmail: string;        // بريد الطبيب
}

// حجز مسجل (لحفظ في قاعدة البيانات)
export interface BookingRecord {
  id: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  patientAge?: string;
  patientGender?: string;
  departmentId: string;
  departmentName: string;
  centerId?: string;
  doctorName: string;
  date: string;               // YYYY-MM-DD
  time: string;               // HH:MM
  dateTimeDisplay: string;    // عرض للمستخدم
  notes?: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  googleEventId?: string;     // ID الحدث في Google Calendar
  createdAt: string;
  updatedAt?: string;
}

// إعدادات الفترة التجريبية العامة - يتحكم فيها المدير العام
export interface GlobalTrialSettings {
  enabled: boolean;           // هل الفترة التجريبية مفعلة
  trialDays: number;          // عدد أيام الفترة التجريبية
  showNotice: boolean;        // هل تظهر الملاحظة للمشتركين الجدد
  noticeText: string;         // نص الملاحظة (اختياري - يُولد تلقائياً)
}

// إعدادات عامة - تجمع الإعدادات
export interface PricingDefaults {
  platform: PlatformPricing;
  appearance: AppearancePricing;
  trial: GlobalTrialSettings;  // إعدادات الفترة التجريبية العامة
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

// ===== OTP System Types =====

export type RegistrationMethod = 'gmail' | 'phone';

export interface OTPRecord {
  id: string;
  email?: string;
  phone?: string;
  code: string;
  expiresAt: string;
  verified: boolean;
  attempts: number;
  createdAt: string;
}

export interface PendingRegistration {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  method: RegistrationMethod;
  otpCode: string;
  otpExpiresAt: string;
  verified: boolean;
  createdAt: string;
}

// ===== Password Change Request =====

export interface PasswordChangeRequest {
  adminId: string;
  currentPassword: string;
  newPassword: string;
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
  // إذا كانت هناك فترة تجريبية والآن ضمنها => trial (بغض النظر عن الدفع)
  if (freeTrialDays > 0 && now <= trialEnd) return 'trial';
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
