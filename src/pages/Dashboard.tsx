import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useLinexData } from '@/hooks/useLinexData';
import { saveCenter, saveDepartment } from '@/services/firebaseService';
import {
  syncDoctorSchedule,
  generateDailyReport,
  sendReportByEmail,
  sendReportByWhatsApp,
  getTodayDepartmentBookings,
  isCalendarConfigured,
  type DoctorCalendarSettings,
  type DailyReportSettings,
} from '@/services/googleCalendarService';
import type { Center, Department, Doctor, BookingRecord } from '@/types/linex';
import { getStatusLabel, getStatusColor, getRemainingDays } from '@/types/linex';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Clock, ImagePlus, Save, LogOut, User, Phone, Mail,
  Plus, Trash2, ExternalLink, Copy, CheckCircle2, AlertCircle,
  Stethoscope, CalendarDays, Shield, Edit3, Eye, EyeOff, Megaphone,
  Hospital, RefreshCw, FileText
} from 'lucide-react';

type Tab = 'info' | 'schedule' | 'doctors' | 'departments' | 'visibility' | 'calendar' | 'reports' | 'share';

export default function Dashboard() {
  const navigate = useNavigate();
  const { auth, logout, updateAdmin, changePassword } = useAuth();
  const {
    centers, departments, getActiveAnnouncements,
    addDepartment, closeDepartment,
    appearanceVisibility, shouldShowAppearanceTab, pricing,
    restoreCenter, restoreDepartment,
  } = useLinexData();

  // Get managed entity
  const [entity, setEntity] = useState<Center | Department | null>(null);
  const [entityType, setEntityType] = useState<'center' | 'department'>('center');
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<Tab>('info');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit states
  const [editInfo, setEditInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({ name: '', address: '', phone: '', email: '' });

  const [editSchedule, setEditSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ workingDays: '', workingHours: '', fridayHours: '', emergencyHours: '', consultationDuration: 15, startTime: '09:00', endTime: '14:00' });

  // Doctor form (for centers)
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [doctorForm, setDoctorForm] = useState<Partial<Doctor>>({
    name: '', specialty: '', title: 'أخصائي', email: '', phone: '', bio: '', image: '',
    consultationDuration: 15, startTime: '09:00', endTime: '14:00', daysOff: ['الجمعة'], isActive: true
  });

  // Department form (for centers)
  const [showDeptForm, setShowDeptForm] = useState(false);
  // Available days for checkbox selection
  const ALL_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

  const [deptForm, setDeptForm] = useState({
    name: '', description: '', doctorName: '', doctorEmail: '', doctorPhone: '',
    specialty: '',
    // Each department has its OWN independent schedule
    workingDays: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'] as string[],
    startTime: '09:00', endTime: '14:00',
    consultationDuration: 15,
    daysOff: ['الجمعة'] as string[],
    vacationDays: '' as string, // comma-separated dates YYYY-MM-DD
    bookingWindow: 7,
    price: 0
  });
  const [editDeptId, setEditDeptId] = useState<string | null>(null);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '', error: '' });

  // Appearance days state
  const [appearanceDays, setAppearanceDays] = useState(7);
  const [appearanceStartDate, setAppearanceStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Google Calendar settings
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);
  const [calendarForm, setCalendarForm] = useState({
    enabled: false,
    googleEmail: '',
    calendarId: 'primary',
  });

  // Daily report settings
  const [showReportSettings, setShowReportSettings] = useState(false);
  const [reportForm, setReportForm] = useState({
    enabled: false,
    reportTime: '11:00',
    sendToEmail: true,
    sendToWhatsApp: true,
    whatsappNumber: '',
    doctorEmail: '',
  });

  // Today's bookings preview
  const [todayBookings, setTodayBookings] = useState<BookingRecord[]>([]);

  const showMsg = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 4000); };

  // Get active announcements for this admin
  const activeAnns = auth.admin ? getActiveAnnouncements(auth.admin.id) : [];

  // Check if entity was soft-deleted
  const [isDeletedEntity, setIsDeletedEntity] = useState(false);
  const [deletedEntityName, setDeletedEntityName] = useState('');

  // Helper: get all centers including deleted (from localStorage)
  const getAllCentersIncludingDeleted = (): Center[] => {
    try { const s = localStorage.getItem('linex_centers'); return s ? JSON.parse(s) : []; } catch { return []; }
  };
  const getAllDeptsIncludingDeleted = (): Department[] => {
    try { const s = localStorage.getItem('linex_departments'); return s ? JSON.parse(s) : []; } catch { return []; }
  };

  // Load entity on mount
  useEffect(() => {
    console.log('[DEBUG Dashboard] auth:', auth.isAuthenticated, auth.admin ? { id: auth.admin.id, role: auth.admin.role, centerId: auth.admin.centerId, deptId: auth.admin.departmentId } : 'no admin');
    console.log('[DEBUG Dashboard] centers count:', centers.length, 'departments count:', departments.length);
    if (centers.length > 0) console.log('[DEBUG Dashboard] first center id:', centers[0].id);
    if (!auth.isAuthenticated || !auth.admin) return;

    if (auth.admin.role === 'center') {
      console.log('[DEBUG Dashboard] looking for centerId:', auth.admin.centerId);
      let c = centers.find(x => x.id === auth.admin!.centerId);
      // Fallback 1: search active centers by adminId
      if (!c && auth.admin) {
        console.log('[DEBUG Dashboard] Fallback 1: searching active by adminId:', auth.admin.id);
        c = centers.find(x => x.adminId === auth.admin!.id);
        if (c && auth.admin.centerId !== c.id) {
          const updatedAdmin = { ...auth.admin, centerId: c.id };
          updateAdmin(updatedAdmin);
          console.log('[DEBUG Dashboard] Updated admin centerId to:', c.id);
        }
      }
      // Fallback 2: search ALL centers (including deleted) by adminId
      if (!c && auth.admin) {
        console.log('[DEBUG Dashboard] Fallback 2: searching ALL centers including deleted');
        const allCenters = getAllCentersIncludingDeleted();
        const deletedCenter = allCenters.find(x => x.adminId === auth.admin!.id && x.deleted);
        if (deletedCenter) {
          console.log('[DEBUG Dashboard] Found DELETED center:', deletedCenter.name);
          setIsDeletedEntity(true);
          setDeletedEntityName(deletedCenter.name);
          setEntity(null);
          return; // Stop here, show deleted message
        }
        // Also try by centerId in all centers
        const deletedById = allCenters.find(x => x.id === auth.admin!.centerId && x.deleted);
        if (deletedById) {
          console.log('[DEBUG Dashboard] Found DELETED center by centerId:', deletedById.name);
          setIsDeletedEntity(true);
          setDeletedEntityName(deletedById.name);
          setEntity(null);
          return;
        }
      }
      console.log('[DEBUG Dashboard] center found:', c ? 'YES' : 'NO');
      if (c) {
        setIsDeletedEntity(false);
        setEntity(c);
        setEntityType('center');
        setInfoForm({ name: c.name, address: c.address, phone: c.phone, email: c.email });
        setScheduleForm({
          workingDays: c.workingDays,
          workingHours: c.workingHours,
          fridayHours: c.fridayHours,
          emergencyHours: c.emergencyHours,
          consultationDuration: c.consultationDuration || 15,
        });
      }
    } else if (auth.admin.role === 'department' && auth.admin.departmentId) {
      let d = departments.find(x => x.id === auth.admin!.departmentId);
      // Fallback 1: search active departments by adminId
      if (!d && auth.admin) {
        d = departments.find(x => x.adminId === auth.admin!.id);
        if (d && auth.admin.departmentId !== d.id) {
          const updatedAdmin = { ...auth.admin, departmentId: d.id };
          updateAdmin(updatedAdmin);
        }
      }
      // Fallback 2: search ALL departments (including deleted) by adminId
      if (!d && auth.admin) {
        const allDepts = getAllDeptsIncludingDeleted();
        const deletedDept = allDepts.find(x => x.adminId === auth.admin!.id && x.deleted);
        if (deletedDept) {
          setIsDeletedEntity(true);
          setDeletedEntityName(deletedDept.name);
          setEntity(null);
          return;
        }
        const deletedById = allDepts.find(x => x.id === auth.admin!.departmentId && x.deleted);
        if (deletedById) {
          setIsDeletedEntity(true);
          setDeletedEntityName(deletedById.name);
          setEntity(null);
          return;
        }
      }
      if (d) {
        setIsDeletedEntity(false);
        setEntity(d);
        setEntityType('department');
        setInfoForm({ name: d.name, address: '', phone: '', email: d.doctorEmail });
        setScheduleForm({
          workingDays: d.workingDays || 'السبت - الخميس',
          workingHours: d.workingHours || '8:00 ص - 10:00 م',
          fridayHours: d.fridayHours || '4:00 م - 9:00 م',
          emergencyHours: '',
          consultationDuration: d.consultationDuration || 15,
        });
      }
    }
  }, [auth, centers, departments]);

  // Not logged in or no entity
  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">يجب تسجيل الدخول أولاً</h2>
          <p className="text-gray-500 mb-4">لا يمكنك الوصول للوحة التحكم بدون تسجيل الدخول</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/login')} className="bg-teal-600 hover:bg-teal-700">تسجيل الدخول</Button>
            <Button variant="outline" onClick={() => navigate('/')}>الرئيسية</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Daily report scheduler - checks every minute
  useEffect(() => {
    if (!entity) return;
    
    const checkReportTime = () => {
      const reportStr = localStorage.getItem(`report_${entity.id}`);
      if (!reportStr) return;
      
      try {
        const settings: DailyReportSettings = JSON.parse(reportStr);
        if (!settings.enabled) return;
        
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        // Check if it's time to send report (within the same minute)
        if (currentTime === settings.reportTime) {
          // Check if we already sent report today
          const lastSent = localStorage.getItem(`report_sent_${entity.id}_${now.toISOString().split('T')[0]}`);
          if (lastSent) return; // Already sent today
          
          const report = generateDailyReport(entity.id, entity.name, (entity as Department).doctorName || entity.name);
          
          // Send via email
          if (settings.sendToEmail && settings.doctorEmail) {
            sendReportByEmail(settings.doctorEmail, 'جدول مواعيد اليوم - LinkEX', report);
          }
          
          // Send via WhatsApp
          if (settings.sendToWhatsApp && settings.whatsappNumber) {
            sendReportByWhatsApp(settings.whatsappNumber, report);
          }
          
          // Mark as sent for today
          localStorage.setItem(`report_sent_${entity.id}_${now.toISOString().split('T')[0]}`, 'true');
          showMsg('تم إرسال التقرير اليومي');
        }
      } catch { /* ignore */ }
    };
    
    const interval = setInterval(checkReportTime, 60000); // Check every minute
    checkReportTime(); // Check immediately on mount
    
    return () => clearInterval(interval);
  }, [entity]);

  if (!entity) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <Card className="p-8 text-center max-w-md">
          {isDeletedEntity ? (
            <>
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">الحساب محذوف ناعماً</h2>
              <p className="text-gray-600 mb-2">
                "{deletedEntityName}" تم حذفه ناعماً من قبل المدير العام
              </p>
              <p className="text-sm text-gray-500 mb-4">
                يمكنك استعادة حسابك ومتابعة العمل، أو التواصل مع المدير العام لمزيد من المعلومات
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  className="bg-green-600 hover:bg-green-700 gap-2"
                  onClick={async () => {
                    // Find and restore the entity
                    if (auth.admin?.role === 'center') {
                      const allCenters = getAllCentersIncludingDeleted();
                      const deletedC = allCenters.find(x => x.adminId === auth.admin!.id && x.deleted) || allCenters.find(x => x.id === auth.admin!.centerId && x.deleted);
                      if (deletedC) {
                        await restoreCenter(deletedC.id);
                        // Also restore admin
                        const updatedAdmin = { ...auth.admin, isActive: true, centerId: deletedC.id };
                        updateAdmin(updatedAdmin);
                        setIsDeletedEntity(false);
                        showMsg('تم استعادة الحساب بنجاح! جاري إعادة التحميل...');
                        setTimeout(() => window.location.reload(), 1500);
                      }
                    } else if (auth.admin?.role === 'department') {
                      const allDepts = getAllDeptsIncludingDeleted();
                      const deletedD = allDepts.find(x => x.adminId === auth.admin!.id && x.deleted) || allDepts.find(x => x.id === auth.admin!.departmentId && x.deleted);
                      if (deletedD) {
                        await restoreDepartment(deletedD.id);
                        const updatedAdmin = { ...auth.admin, isActive: true, departmentId: deletedD.id };
                        updateAdmin(updatedAdmin);
                        setIsDeletedEntity(false);
                        showMsg('تم استعادة الحساب بنجاح! جاري إعادة التحميل...');
                        setTimeout(() => window.location.reload(), 1500);
                      }
                    }
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  استعادة الحساب
                </Button>
                <Button variant="outline" onClick={() => { logout(); navigate('/'); }}>خروج</Button>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">لم يتم العثور على المركز أو العيادة</h2>
              <p className="text-gray-500 mb-4">قد يكون الحساب غير مرتبط بأي مركز أو عيادة. يرجى التواصل مع المدير العام.</p>
              <Button variant="outline" onClick={() => { logout(); navigate('/'); }}>خروج</Button>
            </>
          )}
        </Card>
      </div>
    );
  }

  const remDays = getRemainingDays(entity.expiresAt);
  const isCenter = entityType === 'center';
  const cEntity = isCenter ? entity as Center : null;
  const dEntity = !isCenter ? entity as Department : null;

  // Get departments linked to this center (for center admins)
  const myDepts = isCenter && cEntity
    ? departments.filter(d => d.centerId === cEntity.id)
    : [];

  // Get public URL
  const deptCenterId = !isCenter ? (entity as Department).centerId : null;
  const publicUrl = isCenter
    ? `${window.location.origin}/#/center/${entity.id}`
    : deptCenterId
      ? `${window.location.origin}/#/center/${deptCenterId}/booking`
      : `${window.location.origin}/#/dept/${entity.id}/booking`;

  // Save info
  const saveInfo = async () => {
    if (isCenter && cEntity) {
      const updated = { ...cEntity, name: infoForm.name, address: infoForm.address, phone: infoForm.phone, email: infoForm.email };
      setEntity(updated);
      await saveCenter(updated);
    } else if (!isCenter && dEntity) {
      const updated = { ...dEntity, name: infoForm.name, doctorEmail: infoForm.email };
      setEntity(updated);
      await saveDepartment(updated);
    }
    setEditInfo(false);
    showMsg('تم حفظ المعلومات بنجاح');
  };

  // Save schedule — DEPARTMENT ONLY (schedule moved from center to department level)
  const saveSchedule = async () => {
    if (!isCenter && dEntity) {
      const workingDays = typeof scheduleForm.workingDays === 'string' 
        ? (scheduleForm.workingDays || 'السبت,الأحد,الاثنين,الثلاثاء,الأربعاء,الخميس').split(',').filter(Boolean)
        : (scheduleForm.workingDays || []);
      const updated = {
        ...dEntity,
        workingDays,
        startTime: scheduleForm.startTime || dEntity.startTime || '09:00',
        endTime: scheduleForm.endTime || dEntity.endTime || '14:00',
        consultationDuration: scheduleForm.consultationDuration || dEntity.consultationDuration || 15,
        workingHours: `${scheduleForm.startTime || dEntity.startTime || '09:00'} - ${scheduleForm.endTime || dEntity.endTime || '14:00'}`,
      };
      setEntity(updated);
      await saveDepartment(updated);
      setEditSchedule(false);
      showMsg('تم حفظ جدولة القسم بنجاح');
    } else {
      showMsg('الجدولة متاحة فقط للأقسام');
    }
  };

  // Logo upload (simulated)
  const handlePromoImageUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      if (isCenter && cEntity) {
        const images = [...(cEntity.promoImages || [])];
        images[index] = result;
        const updated = { ...cEntity, promoImages: images };
        setEntity(updated);
        await saveCenter(updated);
      } else if (!isCenter && dEntity) {
        const images = [...(dEntity.promoImages || [])];
        images[index] = result;
        const updated = { ...dEntity, promoImages: images };
        setEntity(updated);
        await saveDepartment(updated);
      }
      showMsg('تم إضافة الصورة');
    };
    reader.readAsDataURL(file);
  };

  const removePromoImage = async (index: number) => {
    if (isCenter && cEntity) {
      const images = [...(cEntity.promoImages || [])];
      images.splice(index, 1);
      const updated = { ...cEntity, promoImages: images };
      setEntity(updated);
      await saveCenter(updated);
    } else if (!isCenter && dEntity) {
      const images = [...(dEntity.promoImages || [])];
      images.splice(index, 1);
      const updated = { ...dEntity, promoImages: images };
      setEntity(updated);
      await saveDepartment(updated);
    }
    showMsg('تم حذف الصورة');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      if (isCenter && cEntity) {
        const updated = { ...cEntity, logo: result };
        setEntity(updated);
        await saveCenter(updated);
      } else if (!isCenter && dEntity) {
        const updated = { ...dEntity, logo: result };
        setEntity(updated);
        await saveDepartment(updated);
      }
      showMsg('تم تحديث الشعار بنجاح');
    };
    reader.readAsDataURL(file);
  };

  // Add doctor
  const addDoctor = async () => {
    if (!doctorForm.name || !cEntity) return;
    const newDoctor: Doctor = {
      id: 'doc-' + Date.now(),
      name: doctorForm.name || '',
      specialty: doctorForm.specialty || '',
      title: doctorForm.title || 'أخصائي',
      email: doctorForm.email || '',
      phone: doctorForm.phone || '',
      bio: doctorForm.bio || '',
      image: doctorForm.image || '',
      consultationDuration: doctorForm.consultationDuration || 15,
      startTime: doctorForm.startTime || '09:00',
      endTime: doctorForm.endTime || '14:00',
      daysOff: doctorForm.daysOff || ['الجمعة'],
      isActive: true,
    };
    const updated = { ...cEntity, doctors: [...cEntity.doctors, newDoctor] };
    setEntity(updated);
    await saveCenter(updated);
    setDoctorForm({ name: '', specialty: '', title: 'أخصائي', email: '', phone: '', bio: '', image: '', consultationDuration: 15, startTime: '09:00', endTime: '14:00', daysOff: ['الجمعة'], isActive: true });
    setShowDoctorForm(false);
    showMsg('تم إضافة الطبيب بنجاح');
  };

  // Remove doctor
  const removeDoctor = async (docId: string) => {
    if (!cEntity) return;
    if (!confirm('هل أنت متأكد من حذف هذا الطبيب؟')) return;
    const updated = { ...cEntity, doctors: cEntity.doctors.filter(d => d.id !== docId) };
    setEntity(updated);
    await saveCenter(updated);
    showMsg('تم حذف الطبيب');
  };

  // Add department - each department has its own schedule
  const addDept = async () => {
    if (!cEntity || !auth.admin) return;
    if (!deptForm.name || !deptForm.doctorEmail) { showMsg('يرجى إدخال اسم القسم وإيميل الطبيب'); return; }

    // Parse vacation days from comma-separated string
    const vacationDays = deptForm.vacationDays
      .split(',')
      .map(d => d.trim())
      .filter(d => d.length > 0);

    const newDept: Department = {
      id: editDeptId || 'dept-' + Date.now(),
      name: deptForm.name,
      description: deptForm.description,
      icon: 'Stethoscope',
      doctorName: deptForm.doctorName,
      doctorEmail: deptForm.doctorEmail,
      doctorPhone: deptForm.doctorPhone,
      logo: '',
      // ===== Department's OWN independent schedule =====
      workingDays: deptForm.workingDays,        // array of specific days
      startTime: deptForm.startTime || '09:00',  // department start time
      endTime: deptForm.endTime || '14:00',      // department end time
      consultationDuration: deptForm.consultationDuration, // per-department duration
      daysOff: deptForm.daysOff,                 // weekly days off
      vacationDays: vacationDays,                // emergency vacation dates
      bookingWindow: deptForm.bookingWindow || 7, // how many upcoming days to show
      // Legacy fields for compatibility
      workingHours: `${deptForm.startTime} - ${deptForm.endTime}`,
      fridayHours: '',
      // =====
      centerId: cEntity.id,
      adminId: auth.admin.id,
      activationType: 'paid',
      subscriptionPrice: pricing.platform.deptMonthlyPrice,
      freeTrialDays: pricing.trial?.trialDays || 10,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (pricing.trial?.trialDays || 10) * 86400000).toISOString(),
      isPaid: false,
      isActive: true,
      status: 'trial' as Department['status'],
      appearanceType: 'hidden',
      appearanceExpiry: '',
      promoImages: [],
      promoText: ''
    };

    // Save to both localStorage and context
    const existing = JSON.parse(localStorage.getItem('linex_departments') || '[]');
    if (editDeptId) {
      // Edit existing
      const idx = existing.findIndex((d: Department) => d.id === editDeptId);
      if (idx >= 0) existing[idx] = newDept; else existing.push(newDept);
    } else {
      // Create new
      existing.push(newDept);
    }
    localStorage.setItem('linex_departments', JSON.stringify(existing));
    addDepartment(newDept);

    setShowDeptForm(false);
    setEditDeptId(null);
    setDeptForm({ name: '', description: '', doctorName: '', doctorEmail: '', doctorPhone: '', specialty: '', workingDays: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'], startTime: '09:00', endTime: '14:00', consultationDuration: 15, daysOff: ['الجمعة'], vacationDays: '', bookingWindow: 7, price: 0 });
    showMsg(editDeptId ? `تم تعديل قسم "${deptForm.name}" بنجاح!` : `تم إضافة قسم "${deptForm.name}" بنجاح!`);
  };

  // Edit department - load data into form
  const startEditDept = (dept: Department) => {
    setEditDeptId(dept.id);
    setDeptForm({
      name: dept.name,
      description: dept.description || '',
      doctorName: dept.doctorName || '',
      doctorEmail: dept.doctorEmail || '',
      doctorPhone: dept.doctorPhone || '',
      specialty: '',
      workingDays: Array.isArray(dept.workingDays) ? dept.workingDays : ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
      startTime: dept.startTime || '09:00',
      endTime: dept.endTime || '14:00',
      consultationDuration: dept.consultationDuration || 15,
      daysOff: dept.daysOff || ['الجمعة'],
      vacationDays: (dept.vacationDays || []).join(', '),
      bookingWindow: dept.bookingWindow || 7,
      price: 0
    });
    setShowDeptForm(true);
  };

  // Remove department
  const removeDept = async (deptId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) return;
    closeDepartment(deptId);
    showMsg('تم حذف القسم');
  };

  // Copy URL
  const copyUrl = () => {
    navigator.clipboard.writeText(publicUrl).then(() => showMsg('تم نسخ الرابط!'));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/linex-logo-transparent.png" alt="LinkEX" className="h-9 w-auto rounded" style={{ backgroundColor: 'transparent', mixBlendMode: 'multiply' }} />
            <div>
              <span className="font-bold text-gray-900">لوحة التحكم</span>
              <span className="text-xs text-gray-500 block">
                {isCenter ? 'مدير مركز طبي' : 'مدير عيادة'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {msg && (
              <span className="hidden md:flex text-sm text-green-600 bg-green-50 px-3 py-1 rounded-lg items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />{msg}
              </span>
            )}
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
              <Shield className="w-4 h-4" />
              <span>{auth.admin?.fullName}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowPasswordForm(!showPasswordForm)} className="text-gray-600 hover:text-gray-800">
              <User className="w-4 h-4" /><span className="hidden sm:inline">كلمة المرور</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={async () => { await logout(); navigate('/'); }} className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1">
              <LogOut className="w-4 h-4" /><span className="hidden sm:inline">خروج</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Admin Announcement Banner */}
      {activeAnns.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          {activeAnns.map(a => (
            <div key={a.id} className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-4 rounded-xl shadow-lg mb-3">
              <div className="flex items-start gap-3">
                <img src="/assets/linex-logo-transparent.png" alt="LinkEX" className="w-10 h-10 rounded-lg bg-white p-1 shrink-0" />
                <div>
                  <p className="text-sm font-bold mb-1">رسالة من <span style={{ color: '#2c3e50' }}>Link</span><span style={{ color: '#FF5722' }}>EX</span></p>
                  <p className="text-sm text-teal-100">{a.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Change Password Modal - Secure */}
      {showPasswordForm && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <Card className="p-4 border-2 border-teal-200 bg-teal-50/30">
            <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-600" />
              تغيير كلمة المرور
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">كلمة المرور الحالية</Label>
                <Input type="password" placeholder="••••••" value={passwordForm.current} onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value, error: '' })} dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">كلمة المرور الجديدة</Label>
                <Input type="password" placeholder="••••••" value={passwordForm.newPass} onChange={e => setPasswordForm({ ...passwordForm, newPass: e.target.value, error: '' })} dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">تأكيد الجديدة</Label>
                <Input type="password" placeholder="••••••" value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value, error: '' })} dir="ltr" />
              </div>
            </div>
            {passwordForm.error && (
              <div className="flex items-center gap-2 mt-2 text-sm text-red-500 bg-red-50 p-2 rounded">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {passwordForm.error}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => { setShowPasswordForm(false); setPasswordForm({ current: '', newPass: '', confirm: '', error: '' }); }}>
                إلغاء
              </Button>
              <Button 
                size="sm" 
                className="bg-teal-600 hover:bg-teal-700 gap-2" 
                disabled={!passwordForm.current || !passwordForm.newPass || !passwordForm.confirm}
                onClick={async () => {
                  if (!passwordForm.current || !passwordForm.newPass || !passwordForm.confirm) { 
                    setPasswordForm({ ...passwordForm, error: 'املأ جميع الحقول' }); 
                    return; 
                  }
                  if (passwordForm.newPass !== passwordForm.confirm) { 
                    setPasswordForm({ ...passwordForm, error: 'كلمتا المرور غير متطابقتين' }); 
                    return; 
                  }
                  if (passwordForm.newPass.length < 6) {
                    setPasswordForm({ ...passwordForm, error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
                    return;
                  }
                  if (!auth.admin) {
                    setPasswordForm({ ...passwordForm, error: 'يجب تسجيل الدخول أولاً' });
                    return;
                  }
                  
                  const result = await changePassword(auth.admin.id, passwordForm.current, passwordForm.newPass);
                  if (result.success) {
                    setShowPasswordForm(false); 
                    setPasswordForm({ current: '', newPass: '', confirm: '', error: '' }); 
                    showMsg('تم تغيير كلمة المرور بنجاح');
                  } else {
                    setPasswordForm({ ...passwordForm, error: result.error || 'فشل تغيير كلمة المرور' });
                  }
                }}
              >
                <Save className="w-4 h-4" />
                حفظ
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Entity Card */}
        <Card className="p-6 mb-6 border-2 border-teal-100">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Logo */}
            <div className="shrink-0">
              <div
                className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors overflow-hidden border-2 border-dashed border-gray-300"
                onClick={() => fileInputRef.current?.click()}
                title="انقر لتغيير الشعار"
              >
                {entity.logo ? (
                  <img src={entity.logo} alt="logo" className="w-full h-full object-contain" />
                ) : (
                  <ImagePlus className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <p className="text-xs text-gray-400 text-center mt-1">انقر لتغيير الشعار</p>
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{entity.name}</h1>
                <Badge className={getStatusColor(entity.status)}>{getStatusLabel(entity.status)}</Badge>
                {isCenter ? (
                  <Badge className="bg-teal-100 text-teal-700">مركز طبي (ب)</Badge>
                ) : (
                  <Badge className="bg-blue-100 text-blue-700">عيادة (أ)</Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 mb-2">
                {isCenter && cEntity && cEntity.address && (
                  <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{cEntity.address}</span>
                )}
                <span className="flex items-center gap-1" dir="ltr"><Phone className="w-4 h-4" />{isCenter ? (cEntity?.phone || '-') : (dEntity?.doctorPhone || '-')}</span>
                <span className="flex items-center gap-1"><Mail className="w-4 h-4" />{isCenter ? (cEntity?.email || '-') : (dEntity?.doctorEmail || '-')}</span>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                <span>مدة الكشف: {isCenter ? (cEntity?.consultationDuration || 15) : (dEntity?.consultationDuration || 15)} دقيقة</span>
                <span>فترة التجربة: {entity.freeTrialDays} يوم</span>
                {entity.status !== 'closed' && <span>متبقي: {remDays > 0 ? remDays + ' يوم' : 'منتهي'}</span>}
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0 flex flex-col gap-2">
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 gap-1" onClick={() => {
                if (isCenter) navigate(`/center/${entity.id}`);
                else if (dEntity?.centerId) navigate(`/center/${dEntity.centerId}/booking`);
                else navigate(`/dept/${entity.id}/booking`);
              }}>
                <ExternalLink className="w-4 h-4" /> عرض الصفحة العامة
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={copyUrl}>
                <Copy className="w-4 h-4" /> نسخ رابط الصفحة
              </Button>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'info' as Tab, label: 'المعلومات الأساسية', icon: Edit3 },
            // أوقات العمل تظهر فقط للأقسام — لا للمركز
            ...(!isCenter ? [{ id: 'schedule' as Tab, label: 'جدولة مواعيد القسم', icon: Clock }] : []),
            ...(isCenter ? [{ id: 'doctors' as Tab, label: 'الأطباء والتخصصات', icon: Stethoscope }] : []),
            ...(isCenter ? [{ id: 'departments' as Tab, label: 'الأقسام الطبية', icon: Hospital }] : []),
            ...(shouldShowAppearanceTab(entityType) ? [{ id: 'visibility' as Tab, label: 'الظهور والإعلان', icon: Eye }] : []),
            { id: 'calendar' as Tab, label: 'تقويم Google', icon: CalendarDays },
            { id: 'reports' as Tab, label: 'التقارير اليومية', icon: FileText },
            { id: 'share' as Tab, label: 'مشاركة الرابط', icon: ExternalLink },
          ].map(t => (
            <Button
              key={t.id}
              variant={tab === t.id ? 'default' : 'outline'}
              onClick={() => setTab(t.id)}
              className={tab === t.id ? 'gap-2' : 'gap-2'}
              style={tab === t.id ? { backgroundColor: '#5C7A6B', color: 'white' } : {}}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </Button>
          ))}
        </div>

        {/* INFO TAB */}
        {tab === 'info' && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-teal-600" />
                المعلومات الأساسية
              </h3>
              <Button size="sm" variant="outline" onClick={() => setEditInfo(!editInfo)}>
                {editInfo ? 'إلغاء' : <><Edit3 className="w-4 h-4" /> تعديل</>}
              </Button>
            </div>

            {!editInfo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <Label className="text-xs text-gray-400">الاسم</Label>
                    <p className="font-semibold text-gray-900">{entity.name}</p>
                  </div>
                  {isCenter && cEntity && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <Label className="text-xs text-gray-400">العنوان</Label>
                      <p className="font-semibold text-gray-900">{cEntity.address || '-'}</p>
                    </div>
                  )}
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <Label className="text-xs text-gray-400">رقم الهاتف</Label>
                    <p className="font-semibold text-gray-900" dir="ltr">{isCenter ? (cEntity?.phone || '-') : (dEntity?.doctorPhone || '-')}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <Label className="text-xs text-gray-400">البريد الإلكتروني</Label>
                    <p className="font-semibold text-gray-900" dir="ltr">{isCenter ? (cEntity?.email || '-') : (dEntity?.doctorEmail || '-')}</p>
                  </div>
                  {!isCenter && dEntity && (
                    <>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <Label className="text-xs text-gray-400">اسم الطبيب</Label>
                        <p className="font-semibold text-gray-900">{dEntity.doctorName || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <Label className="text-xs text-gray-400">الوصف</Label>
                        <p className="font-semibold text-gray-900">{dEntity.description || '-'}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>الاسم {isCenter ? 'المركز' : 'العيادة'} <span className="text-red-500">*</span></Label>
                  <Input value={infoForm.name} onChange={e => setInfoForm({ ...infoForm, name: e.target.value })} />
                </div>
                {isCenter && (
                  <div className="space-y-2">
                    <Label>العنوان</Label>
                    <Input value={infoForm.address} onChange={e => setInfoForm({ ...infoForm, address: e.target.value })} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <Input value={infoForm.phone} onChange={e => setInfoForm({ ...infoForm, phone: e.target.value })} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input value={infoForm.email} onChange={e => setInfoForm({ ...infoForm, email: e.target.value })} dir="ltr" />
                </div>
                <Button onClick={saveInfo} className="bg-teal-600 hover:bg-teal-700 gap-2">
                  <Save className="w-4 h-4" /> حفظ التغييرات
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* SCHEDULE TAB — Department only (center schedule moved to department level) */}
        {tab === 'schedule' && dEntity && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-600" />
                جدولة مواعيد القسم
              </h3>
              <Button size="sm" variant="outline" onClick={() => setEditSchedule(!editSchedule)}>
                {editSchedule ? 'إلغاء' : <><Edit3 className="w-4 h-4" /> تعديل</>}
              </Button>
            </div>

            {!editSchedule ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <Label className="text-xs text-gray-400">أيام الدوام</Label>
                    <p className="font-semibold text-gray-900">{(dEntity.workingDays || []).join('، ')}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <Label className="text-xs text-gray-400">ساعات الدوام</Label>
                    <p className="font-semibold text-gray-900">{dEntity.startTime || '09:00'} - {dEntity.endTime || '14:00'}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <Label className="text-xs text-gray-400">أيام العطلة</Label>
                    <p className="font-semibold text-gray-900">{(dEntity.daysOff || ['الجمعة']).join('، ')}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <Label className="text-xs text-gray-400">نافذة الحجز</Label>
                    <p className="font-semibold text-gray-900">{dEntity.bookingWindow || 7} أيام مقبلة</p>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 md:col-span-2">
                    <Label className="text-xs text-amber-600">مدة كل كشف (بالدقائق)</Label>
                    <p className="font-semibold text-amber-800 text-xl">{dEntity.consultationDuration || 15} دقيقة</p>
                    <p className="text-xs text-amber-500 mt-1">
                      النظام سيُنشئ موعد كل {dEntity.consultationDuration || 15} دقيقة
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>أيام الدوام</Label>
                    <div className="flex flex-wrap gap-2">
                      {ALL_DAYS.map(day => (
                        <label key={day} className="flex items-center gap-1 bg-gray-50 px-3 py-2 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(scheduleForm.workingDays as any)?.includes ? (scheduleForm.workingDays as any).includes(day) : (scheduleForm.workingDays || '').toString().includes(day)}
                            onChange={e => {
                              const current = typeof scheduleForm.workingDays === 'string' ? (scheduleForm.workingDays || 'السبت,الأحد,الاثنين,الثلاثاء,الأربعاء,الخميس').split(',').filter(Boolean) : (scheduleForm.workingDays as any || []);
                              const updated = e.target.checked ? [...current, day] : current.filter((d: string) => d !== day);
                              setScheduleForm({ ...scheduleForm, workingDays: updated.join(',') });
                            }}
                          />
                          <span className="text-sm">{day}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>بداية الدوام</Label>
                    <Input type="time" value={scheduleForm.startTime || dEntity.startTime || '09:00'} onChange={e => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>نهاية الدوام</Label>
                    <Input type="time" value={scheduleForm.endTime || dEntity.endTime || '14:00'} onChange={e => setScheduleForm({ ...scheduleForm, endTime: e.target.value })} />
                  </div>
                  <div className="space-y-2 md:col-span-2 bg-amber-50 p-4 rounded-xl border border-amber-200">
                    <Label className="text-amber-700">مدة كل كشف (بالدقائق) <span className="text-red-500">*</span></Label>
                    <Input type="number" min={5} max={120} value={scheduleForm.consultationDuration || dEntity.consultationDuration || 15} onChange={e => setScheduleForm({ ...scheduleForm, consultationDuration: Number(e.target.value) })} />
                    <p className="text-xs text-amber-600 mt-1">النظام سيحسب المواعيد تلقائياً</p>
                  </div>
                </div>
                <Button onClick={saveSchedule} className="bg-teal-600 hover:bg-teal-700 gap-2">
                  <Save className="w-4 h-4" /> حفظ جدولة القسم
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* DOCTORS TAB (center only) */}
        {tab === 'doctors' && isCenter && cEntity && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-teal-600" />
                الأطباء والتخصصات ({cEntity.doctors.length})
              </h3>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 gap-1" onClick={() => setShowDoctorForm(true)}>
                <Plus className="w-4 h-4" /> إضافة طبيب
              </Button>
            </div>

            {/* Doctor list */}
            {cEntity.doctors.length === 0 ? (
              <Card className="p-8 text-center text-gray-500">
                <Stethoscope className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>لا يوجد أطباء مسجلين</p>
                <p className="text-sm text-gray-400 mt-1">أضف أول طبيب لمركزك</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cEntity.doctors.map(doc => (
                  <Card key={doc.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {doc.image ? <img src={doc.image} alt={doc.name} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-teal-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900">{doc.name}</h4>
                        <p className="text-sm text-teal-600">{doc.specialty} <Badge variant="outline" className="text-xs mr-1">{doc.title}</Badge></p>
                        {doc.email && <p className="text-xs text-gray-500" dir="ltr"><Mail className="w-3 h-3 inline ml-1" />{doc.email}</p>}
                        {doc.phone && <p className="text-xs text-gray-500" dir="ltr"><Phone className="w-3 h-3 inline ml-1" />{doc.phone}</p>}
                        <p className="text-xs text-gray-500"><CalendarDays className="w-3 h-3 inline ml-1" />{doc.startTime} - {doc.endTime} | كشف {doc.consultationDuration} دقيقة</p>
                        {doc.daysOff.length > 0 && <p className="text-xs text-amber-600">عطلة: {doc.daysOff.join('، ')}</p>}
                        {doc.bio && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{doc.bio}</p>}
                      </div>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 shrink-0" onClick={() => removeDoctor(doc.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Add Doctor Form */}
            {showDoctorForm && (
              <Card className="p-6 border-2 border-teal-200 bg-teal-50/30">
                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-teal-600" />
                  إضافة طبيب جديد
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">اسم الطبيب <span className="text-red-500">*</span></Label>
                    <Input value={doctorForm.name} onChange={e => setDoctorForm({ ...doctorForm, name: e.target.value })} placeholder="د. أحمد محمد" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">التخصص <span className="text-red-500">*</span></Label>
                    <Input value={doctorForm.specialty} onChange={e => setDoctorForm({ ...doctorForm, specialty: e.target.value })} placeholder="جراحة العظام" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">اللقب</Label>
                    <select value={doctorForm.title} onChange={e => setDoctorForm({ ...doctorForm, title: e.target.value })} className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm">
                      <option value="استشاري">استشاري</option>
                      <option value="أخصائي">أخصائي</option>
                      <option value="طبيب">طبيب</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">مدة الكشف (دقيقة)</Label>
                    <Input type="number" min={5} max={120} value={doctorForm.consultationDuration} onChange={e => setDoctorForm({ ...doctorForm, consultationDuration: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">بداية الدوام</Label>
                    <Input value={doctorForm.startTime} onChange={e => setDoctorForm({ ...doctorForm, startTime: e.target.value })} placeholder="09:00" dir="ltr" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">نهاية الدوام</Label>
                    <Input value={doctorForm.endTime} onChange={e => setDoctorForm({ ...doctorForm, endTime: e.target.value })} placeholder="14:00" dir="ltr" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">البريد الإلكتروني (للتقويم)</Label>
                    <Input value={doctorForm.email} onChange={e => setDoctorForm({ ...doctorForm, email: e.target.value })} placeholder="doctor@email.com" dir="ltr" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">رقم الهاتف</Label>
                    <Input value={doctorForm.phone} onChange={e => setDoctorForm({ ...doctorForm, phone: e.target.value })} placeholder="07xxxxxxxx" dir="ltr" />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">نبذة عن الطبيب</Label>
                    <Input value={doctorForm.bio} onChange={e => setDoctorForm({ ...doctorForm, bio: e.target.value })} placeholder="خبرة 10 سنوات في..." />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => setShowDoctorForm(false)}>إلغاء</Button>
                  <Button className="bg-teal-600 hover:bg-teal-700 gap-2" onClick={addDoctor} disabled={!doctorForm.name || !doctorForm.specialty}>
                    <Save className="w-4 h-4" /> إضافة الطبيب
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* DEPARTMENTS TAB */}
        {tab === 'departments' && isCenter && cEntity && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Hospital className="w-5 h-5" style={{ color: '#5C7A6B' }} />
                الأقسام الطبية ({myDepts.length})
              </h3>
              <Button size="sm" className="hover:opacity-90 gap-1" style={{ backgroundColor: '#5C7A6B' }} onClick={() => setShowDeptForm(true)}>
                <Plus className="w-4 h-4" /> إضافة قسم
              </Button>
            </div>

            {myDepts.length === 0 ? (
              <Card className="p-8 text-center text-gray-500">
                <Hospital className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>لا يوجد أقسام مسجلة</p>
                <p className="text-sm text-gray-400 mt-1">أضف أول قسم طبي لمركزك</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myDepts.map(dept => (
                  <Card key={dept.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#E4E8E0' }}>
                        <Hospital className="w-6 h-6" style={{ color: '#5C7A6B' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900">{dept.name}</h4>
                        {dept.description && <p className="text-sm text-gray-500">{dept.description}</p>}
                        {dept.doctorName && <p className="text-sm text-teal-600">{dept.doctorName}</p>}
                        {dept.doctorEmail && <p className="text-xs text-gray-500" dir="ltr"><Mail className="w-3 h-3 inline ml-1" />{dept.doctorEmail}</p>}
                        {dept.doctorPhone && <p className="text-xs text-gray-500" dir="ltr"><Phone className="w-3 h-3 inline ml-1" />{dept.doctorPhone}</p>}
                        {dept.workingDays && Array.isArray(dept.workingDays) && (
                          <p className="text-xs text-teal-600 mt-1">{dept.workingDays.join('، ')} | {dept.startTime}-{dept.endTime} | {dept.consultationDuration}د</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="text-blue-500 hover:text-blue-700" onClick={() => startEditDept(dept)} title="تعديل القسم">
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => removeDept(dept.id)} title="حذف القسم">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Add Department Form */}
            {showDeptForm && (
              <Card className="p-6 border-2" style={{ borderColor: '#5C7A6B', backgroundColor: '#F8F6F0' }}>
                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5" style={{ color: '#5C7A6B' }} />
                  {editDeptId ? 'تعديل قسم طبي' : 'إضافة قسم طبي جديد'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Basic Info */}
                  <div className="space-y-1">
                    <Label className="text-xs">اسم القسم <span className="text-red-500">*</span></Label>
                    <Input value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} placeholder="قسم الأسنان" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">التخصص</Label>
                    <Input value={deptForm.specialty} onChange={e => setDeptForm({ ...deptForm, specialty: e.target.value })} placeholder="طب الأسنان" />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">وصف القسم</Label>
                    <Input value={deptForm.description} onChange={e => setDeptForm({ ...deptForm, description: e.target.value })} placeholder="وصف مختصر عن القسم..." />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">اسم الطبيب المسؤول</Label>
                    <Input value={deptForm.doctorName} onChange={e => setDeptForm({ ...deptForm, doctorName: e.target.value })} placeholder="د. أحمد محمد" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">إيميل الطبيب (للتقويم) <span className="text-red-500">*</span></Label>
                    <Input value={deptForm.doctorEmail} onChange={e => setDeptForm({ ...deptForm, doctorEmail: e.target.value })} placeholder="doctor@gmail.com" dir="ltr" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">هاتف الطبيب</Label>
                    <Input value={deptForm.doctorPhone} onChange={e => setDeptForm({ ...deptForm, doctorPhone: e.target.value })} placeholder="07xxxxxxxx" dir="ltr" />
                  </div>

                  {/* ===== Department Schedule Section ===== */}
                  <div className="md:col-span-2 bg-teal-50 p-4 rounded-xl border border-teal-200 mt-2">
                    <p className="text-sm font-bold text-teal-800 mb-1">جدولة مواعيد القسم</p>
                    <p className="text-xs text-teal-600 mb-3">
                      كل قسم له جدوله الخاص المستقل. أيام الدوام وساعات الكشف خاصة بهذا القسم فقط.
                    </p>

                    {/* Working Days - Checkboxes */}
                    <div className="mb-4">
                      <Label className="text-xs text-teal-700 mb-2 block">أيام دوام القسم <span className="text-red-500">*</span></Label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_DAYS.map(day => (
                          <label key={day} className={`flex items-center gap-1 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${deptForm.workingDays.includes(day) ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'}`}>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={deptForm.workingDays.includes(day)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setDeptForm({ ...deptForm, workingDays: [...deptForm.workingDays, day] });
                                } else {
                                  setDeptForm({ ...deptForm, workingDays: deptForm.workingDays.filter(d => d !== day) });
                                }
                              }}
                            />
                            <span className="text-sm">{day}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Time & Duration */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-teal-700">بداية الدوام</Label>
                        <Input value={deptForm.startTime} onChange={e => setDeptForm({ ...deptForm, startTime: e.target.value })} placeholder="09:00" dir="ltr" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-teal-700">نهاية الدوام</Label>
                        <Input value={deptForm.endTime} onChange={e => setDeptForm({ ...deptForm, endTime: e.target.value })} placeholder="14:00" dir="ltr" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-teal-700">مدة الكشف (دقيقة)</Label>
                        <Input type="number" min={5} max={120} value={deptForm.consultationDuration} onChange={e => setDeptForm({ ...deptForm, consultationDuration: Number(e.target.value) })} />
                      </div>
                    </div>
                  </div>

                  {/* Days Off */}
                  <div className="md:col-span-2 bg-amber-50 p-4 rounded-xl border border-amber-200">
                    <Label className="text-xs text-amber-700 mb-2 block">أيام العطلة الأسبوعية</Label>
                    <div className="flex flex-wrap gap-2">
                      {ALL_DAYS.map(day => (
                        <label key={day} className={`flex items-center gap-1 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${deptForm.daysOff.includes(day) ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'}`}>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={deptForm.daysOff.includes(day)}
                            onChange={e => {
                              if (e.target.checked) {
                                setDeptForm({ ...deptForm, daysOff: [...deptForm.daysOff, day] });
                              } else {
                                setDeptForm({ ...deptForm, daysOff: deptForm.daysOff.filter(d => d !== day) });
                              }
                            }}
                          />
                          <span className="text-sm">{day}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Vacation Days & Booking Window */}
                  <div className="space-y-1">
                    <Label className="text-xs">إجازات اضطرارية (تواريخ YYYY-MM-DD مفصولة بفاصلة)</Label>
                    <Input value={deptForm.vacationDays} onChange={e => setDeptForm({ ...deptForm, vacationDays: e.target.value })} placeholder="2026-06-10, 2026-06-15" dir="ltr" />
                    <p className="text-[10px] text-gray-400">لن يظهر القسم للحجز في هذه التواريخ</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">عدد الأيام الظاهرة للحجز</Label>
                    <Input type="number" min={1} max={60} value={deptForm.bookingWindow} onChange={e => setDeptForm({ ...deptForm, bookingWindow: Number(e.target.value) })} />
                    <p className="text-[10px] text-gray-400">كم يوماً مقبلاً يظهر للمريض للحجز</p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">سعر الكشف (دينار)</Label>
                    <Input type="number" min={0} value={deptForm.price} onChange={e => setDeptForm({ ...deptForm, price: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => { setShowDeptForm(false); setEditDeptId(null); }}>إلغاء</Button>
                  <Button className="hover:opacity-90 gap-2" style={{ backgroundColor: '#5C7A6B' }} onClick={addDept} disabled={!deptForm.name || !deptForm.doctorEmail}>
                    <Save className="w-4 h-4" /> {editDeptId ? 'حفظ التعديل' : 'إضافة القسم'}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* VISIBILITY TAB */}
        {tab === 'visibility' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4" style={{ textAlign: 'center' }}>
                <Eye className="w-5 h-5 inline text-teal-600 ml-2" />
                إعدادات الظهور في الصفحة الرئيسية
              </h3>

              {/* Appearance Type */}
              <div className="mb-6">
                <Label className="block mb-3">حالة الظهور</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={async () => {
                      const updated = isCenter
                        ? { ...cEntity!, appearanceType: 'hidden' as const, appearanceExpiry: '' }
                        : { ...dEntity!, appearanceType: 'hidden' as const, appearanceExpiry: '' };
                      isCenter ? setEntity(updated as Center) : setEntity(updated as Department);
                      isCenter ? await saveCenter(updated as Center) : await saveDepartment(updated as Department);
                      showMsg('تم الحفظ - المركز مخفي الآن');
                    }}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${(isCenter ? cEntity?.appearanceType : dEntity?.appearanceType) === 'hidden' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                  >
                    <EyeOff className={`w-8 h-8 mx-auto mb-2 ${(isCenter ? cEntity?.appearanceType : dEntity?.appearanceType) === 'hidden' ? 'text-red-600' : 'text-gray-400'}`} />
                    <p className="font-bold">مخفي</p>
                    <p className="text-xs text-gray-500">لا يظهر في الصفحة الرئيسية</p>
                  </button>

                  <button
                    onClick={async () => {
                      const expiry = new Date(Date.now() + 30 * 86400000).toISOString();
                      const updated = isCenter
                        ? { ...cEntity!, appearanceType: 'paid' as const, appearanceExpiry: expiry }
                        : { ...dEntity!, appearanceType: 'paid' as const, appearanceExpiry: expiry };
                      isCenter ? setEntity(updated as Center) : setEntity(updated as Department);
                      isCenter ? await saveCenter(updated as Center) : await saveDepartment(updated as Department);
                      showMsg('تم تفعيل الظهور المدفوع لمدة شهر');
                    }}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${(isCenter ? cEntity?.appearanceType : dEntity?.appearanceType) === 'paid' ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}
                  >
                    <Megaphone className={`w-8 h-8 mx-auto mb-2 ${(isCenter ? cEntity?.appearanceType : dEntity?.appearanceType) === 'paid' ? 'text-amber-600' : 'text-gray-400'}`} />
                    <p className="font-bold">اشتراك شهري</p>
                    <p className="text-xs text-gray-500">{pricing.appearance.monthlyPrice.toLocaleString()} د.ع / 30 يوم</p>
                  </button>

                  {/* Limited Days Option */}
                  <button
                    onClick={async () => {
                      if (appearanceDays < 1) { showMsg('اختر عدد أيام أولاً'); return; }
                      const start = new Date(appearanceStartDate);
                      const expiry = new Date(start.getTime() + appearanceDays * 86400000).toISOString();
                      const updated = isCenter
                        ? { ...cEntity!, appearanceType: 'paid' as const, appearanceExpiry: expiry }
                        : { ...dEntity!, appearanceType: 'paid' as const, appearanceExpiry: expiry };
                      isCenter ? setEntity(updated as Center) : setEntity(updated as Department);
                      isCenter ? await saveCenter(updated as Center) : await saveDepartment(updated as Department);
                      showMsg(`تم تفعيل الظهور لمدة ${appearanceDays} يوم`);
                    }}
                    className="p-4 rounded-xl border-2 border-gray-200 text-center hover:border-amber-300 transition-all"
                  >
                    <CalendarDays className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="font-bold">عدد أيام محدود</p>
                    <div className="space-y-2 mt-2" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={appearanceStartDate}
                          onChange={e => setAppearanceStartDate(e.target.value)}
                          className="text-xs h-8"
                        />
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={appearanceDays}
                          onChange={e => setAppearanceDays(Number(e.target.value))}
                          placeholder="أيام"
                          className="text-xs h-8 w-20 text-center"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        {(appearanceDays * (pricing.appearance.dailyPrice || 500)).toLocaleString()} د.ع
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Promo Text */}
              <div className="mb-6">
                <Label className="block mb-2">نبذة دعائية عن المركز</Label>
                <textarea
                  value={isCenter ? (cEntity?.promoText || '') : (dEntity?.promoText || '')}
                  onChange={async e => {
                    const updated = isCenter
                      ? { ...cEntity!, promoText: e.target.value }
                      : { ...dEntity!, promoText: e.target.value };
                    isCenter ? setEntity(updated as Center) : setEntity(updated as Department);
                    isCenter ? await saveCenter(updated as Center) : await saveDepartment(updated as Department);
                  }}
                  placeholder="اكتب نبذة قصيرة تظهر للزائرين في الصفحة الرئيسية..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                />
              </div>

              {/* Promo Images Upload */}
              <div className="mb-6">
                <Label className="block mb-3">صور دعائية (3 صور كحد أقصى)</Label>
                <p className="text-xs text-gray-500 mb-3">هذه الصور تظهر في الصفحة الرئيسية عند تفعيل الظهور الإعلاني</p>
                <div className="grid grid-cols-3 gap-3">
                  {/* Image 1 */}
                  <div className="relative">
                    <div className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 hover:bg-gray-100 cursor-pointer" onClick={() => document.getElementById('promo-img-1')?.click()}>
                      {(isCenter ? cEntity?.promoImages?.[0] : dEntity?.promoImages?.[0]) ? (
                        <img src={isCenter ? cEntity?.promoImages?.[0] : dEntity?.promoImages?.[0]} alt="Promo 1" className="w-full h-full object-cover" />
                      ) : (
                        <ImagePlus className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <input id="promo-img-1" type="file" accept="image/*" className="hidden" onChange={e => handlePromoImageUpload(e, 0)} />
                    {(isCenter ? cEntity?.promoImages?.[0] : dEntity?.promoImages?.[0]) && (
                      <button className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs" onClick={() => removePromoImage(0)}>×</button>
                    )}
                  </div>
                  {/* Image 2 */}
                  <div className="relative">
                    <div className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 hover:bg-gray-100 cursor-pointer" onClick={() => document.getElementById('promo-img-2')?.click()}>
                      {(isCenter ? cEntity?.promoImages?.[1] : dEntity?.promoImages?.[1]) ? (
                        <img src={isCenter ? cEntity?.promoImages?.[1] : dEntity?.promoImages?.[1]} alt="Promo 2" className="w-full h-full object-cover" />
                      ) : (
                        <ImagePlus className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <input id="promo-img-2" type="file" accept="image/*" className="hidden" onChange={e => handlePromoImageUpload(e, 1)} />
                    {(isCenter ? cEntity?.promoImages?.[1] : dEntity?.promoImages?.[1]) && (
                      <button className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs" onClick={() => removePromoImage(1)}>×</button>
                    )}
                  </div>
                  {/* Image 3 */}
                  <div className="relative">
                    <div className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 hover:bg-gray-100 cursor-pointer" onClick={() => document.getElementById('promo-img-3')?.click()}>
                      {(isCenter ? cEntity?.promoImages?.[2] : dEntity?.promoImages?.[2]) ? (
                        <img src={isCenter ? cEntity?.promoImages?.[2] : dEntity?.promoImages?.[2]} alt="Promo 3" className="w-full h-full object-cover" />
                      ) : (
                        <ImagePlus className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <input id="promo-img-3" type="file" accept="image/*" className="hidden" onChange={e => handlePromoImageUpload(e, 2)} />
                    {(isCenter ? cEntity?.promoImages?.[2] : dEntity?.promoImages?.[2]) && (
                      <button className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs" onClick={() => removePromoImage(2)}>×</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Current Status */}
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-600">
                  {(isCenter ? cEntity?.appearanceType : dEntity?.appearanceType) === 'hidden' && 'المركز مخفي حالياً عن الزائرين'}
                  {(isCenter ? cEntity?.appearanceType : dEntity?.appearanceType) === 'paid' && 'الظهور مفعل باشتراك مدفوع'}
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* CALENDAR TAB */}
        {tab === 'calendar' && (
          <div className="space-y-6">
            <Card className="p-6 border-2 border-blue-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-600" />
                ربط مع Google Calendar
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                اربط تقويم Google الخاص بك ليتم تزامن جدول المواعيد تلقائياً. عندما يقوم مريض بالحجز، يُسجل الموعد مباشرة في تقويمك.
              </p>

              {/* Enable/Disable */}
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${calendarForm.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">تفعيل التزامن مع Google Calendar</p>
                    <p className="text-xs text-gray-500">تسجيل الحجوزات تلقائياً في تقويم Google</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const newVal = !calendarForm.enabled;
                    setCalendarForm({ ...calendarForm, enabled: newVal });
                    if (entity) {
                      localStorage.setItem(`calendar_${entity.id}`, JSON.stringify({ ...calendarForm, enabled: newVal }));
                    }
                    showMsg(newVal ? 'تم تفعيل التزامن' : 'تم تعطيل التزامن');
                  }}
                  className={`relative w-14 h-8 rounded-full transition-all ${calendarForm.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${calendarForm.enabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {calendarForm.enabled && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>بريد Gmail</Label>
                    <Input
                      type="email"
                      value={calendarForm.googleEmail}
                      onChange={e => setCalendarForm({ ...calendarForm, googleEmail: e.target.value })}
                      placeholder="doctor@gmail.com"
                      dir="ltr"
                    />
                    <p className="text-xs text-gray-400">أدخل بريد Gmail المرتبط بتقويم Google</p>
                  </div>

                  <Button
                    onClick={() => {
                      // In production, this triggers Google OAuth flow
                      // For now, save settings
                      const settings: DoctorCalendarSettings = {
                        enabled: true,
                        googleAccessToken: '',
                        googleRefreshToken: '',
                        googleEmail: calendarForm.googleEmail,
                        calendarId: calendarForm.calendarId,
                      };
                      if (entity) {
                        localStorage.setItem(`calendar_${entity.id}`, JSON.stringify(settings));
                      }
                      showMsg('تم حفظ إعدادات التقويم');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 gap-2"
                  >
                    <Save className="w-4 h-4" />
                    حفظ الإعدادات
                  </Button>

                  {/* Sync Schedule Button */}
                  <div className="pt-4 border-t">
                    <p className="text-sm text-gray-600 mb-2">مزامنة جدول الدوام:</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!entity) return;
                        const settingsStr = localStorage.getItem(`calendar_${entity.id}`);
                        if (!settingsStr) { showMsg('أكمل إعدادات التقويم أولاً'); return; }
                        try {
                          const settings = JSON.parse(settingsStr);
                          if (!isCalendarConfigured(settings)) {
                            showMsg('يجب تفعيل Google Calendar أولاً');
                            return;
                          }
                          syncDoctorSchedule(settings, entity as Department).then(success => {
                            showMsg(success ? 'تمت مزامنة الجدول بنجاح' : 'فشلت المزامنة');
                          });
                        } catch { showMsg('خطأ في الإعدادات'); }
                      }}
                      className="gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      مزامنة الجدول مع Google Calendar
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* REPORTS TAB */}
        {tab === 'reports' && (
          <div className="space-y-6">
            {/* Report Settings */}
            <Card className="p-6 border-2 border-green-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                إعدادات التقرير اليومي
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                اضبط وقت إرسال تقرير حجوزات اليوم. يصلك التقرير قبل بدء الدوام بوقت كافٍ.
              </p>

              {/* Enable/Disable */}
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${reportForm.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">تفعيل التقرير اليومي</p>
                    <p className="text-xs text-gray-500">استلام جدول حجوزات اليوم تلقائياً</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const newVal = !reportForm.enabled;
                    setReportForm({ ...reportForm, enabled: newVal });
                    if (entity) {
                      localStorage.setItem(`report_${entity.id}`, JSON.stringify({ ...reportForm, enabled: newVal }));
                    }
                    showMsg(newVal ? 'تم تفعيل التقرير اليومي' : 'تم تعطيل التقرير');
                  }}
                  className={`relative w-14 h-8 rounded-full transition-all ${reportForm.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${reportForm.enabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {reportForm.enabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>وقت إرسال التقرير</Label>
                      <Input
                        type="time"
                        value={reportForm.reportTime}
                        onChange={e => setReportForm({ ...reportForm, reportTime: e.target.value })}
                      />
                      <p className="text-xs text-gray-400">الوقت الذي يصلك فيه التقرير (قبل الدوام)</p>
                    </div>
                    <div className="space-y-2">
                      <Label>بريد الطبيب</Label>
                      <Input
                        type="email"
                        value={reportForm.doctorEmail}
                        onChange={e => setReportForm({ ...reportForm, doctorEmail: e.target.value })}
                        placeholder="doctor@example.com"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>رقم واتساب</Label>
                      <Input
                        value={reportForm.whatsappNumber}
                        onChange={e => setReportForm({ ...reportForm, whatsappNumber: e.target.value })}
                        placeholder="07xxxxxxxx"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={reportForm.sendToEmail}
                        onChange={e => setReportForm({ ...reportForm, sendToEmail: e.target.checked })}
                      />
                      <span>إرسال بالبريد الإلكتروني</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={reportForm.sendToWhatsApp}
                        onChange={e => setReportForm({ ...reportForm, sendToWhatsApp: e.target.checked })}
                      />
                      <span>إرسال بواتساب</span>
                    </label>
                  </div>

                  <Button
                    onClick={() => {
                      const settings: DailyReportSettings = {
                        enabled: reportForm.enabled,
                        reportTime: reportForm.reportTime,
                        sendToEmail: reportForm.sendToEmail,
                        sendToWhatsApp: reportForm.sendToWhatsApp,
                        whatsappNumber: reportForm.whatsappNumber,
                        doctorEmail: reportForm.doctorEmail,
                      };
                      if (entity) {
                        localStorage.setItem(`report_${entity.id}`, JSON.stringify(settings));
                      }
                      showMsg('تم حفظ إعدادات التقرير');
                    }}
                    className="bg-green-600 hover:bg-green-700 gap-2"
                  >
                    <Save className="w-4 h-4" />
                    حفظ الإعدادات
                  </Button>
                </div>
              )}
            </Card>

            {/* Manual Report */}
            <Card className="p-6 border-2 border-amber-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                إرسال تقرير يدوي
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                أرسل تقرير حجوزات اليوم يدوياً الآن.
              </p>

              {/* Preview */}
              {todayBookings.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg mb-4 max-h-60 overflow-y-auto">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    حجوزات اليوم: {todayBookings.length}
                  </p>
                  {todayBookings.map((b, i) => (
                    <div key={b.id} className="text-xs text-gray-600 py-1 border-b last:border-0">
                      {i + 1}. {b.time} - {b.patientName} ({b.patientPhone})
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!entity) { showMsg('لا يوجد كيان'); return; }
                    const bookings = getTodayDepartmentBookings(entity.id);
                    setTodayBookings(bookings);
                    showMsg(`تم تحميل ${bookings.length} حجز`);
                  }}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  تحميل الحجوزات
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    if (!entity) { showMsg('لا يوجد كيان'); return; }
                    const report = generateDailyReport(entity.id, entity.name, (entity as Department).doctorName || entity.name);
                    if (reportForm.doctorEmail) {
                      sendReportByEmail(reportForm.doctorEmail, 'جدول مواعيد اليوم - LinkEX', report);
                      showMsg('تم فتح البريد للإرسال');
                    } else {
                      showMsg('أدخل بريد الطبيب أولاً');
                    }
                  }}
                  className="gap-2"
                >
                  <Mail className="w-4 h-4" />
                  إرسال بالبريد
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    if (!entity) { showMsg('لا يوجد كيان'); return; }
                    const report = generateDailyReport(entity.id, entity.name, (entity as Department).doctorName || entity.name);
                    if (reportForm.whatsappNumber) {
                      sendReportByWhatsApp(reportForm.whatsappNumber, report);
                      showMsg('تم فتح واتساب للإرسال');
                    } else {
                      showMsg('أدخل رقم واتساب أولاً');
                    }
                  }}
                  className="gap-2"
                >
                  <Phone className="w-4 h-4" />
                  إرسال بواتساب
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* SHARE TAB */}
        {tab === 'share' && (
          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-teal-600" />
              مشاركة رابط صفحتك
            </h3>
            <p className="text-gray-500 mb-4">
              انسخ هذا الرابط وشاركه مع مرضاك على فيسبوك، واتساب، تلغرام، أو اطبعه على كرتك:
            </p>
            <div className="flex gap-2 mb-6">
              <div className="flex-1 bg-gray-100 p-3 rounded-lg text-sm font-mono text-gray-700 break-all" dir="ltr">
                {publicUrl}
              </div>
              <Button onClick={copyUrl} className="bg-teal-600 hover:bg-teal-700 gap-1 shrink-0">
                <Copy className="w-4 h-4" /> نسخ
              </Button>
            </div>

            <div className="bg-teal-50 p-4 rounded-xl border border-teal-200">
              <h4 className="font-semibold text-teal-800 mb-2">كيف تستخدم الرابط؟</h4>
              <ul className="text-sm text-teal-700 space-y-2">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> أنشره على صفحتك في فيسبوك</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> أرسله لمرضاك عبر واتساب</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> اطبعه على الكرت الشخصي</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> ضعه في البايو الخاص بك</li>
              </ul>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-teal-600" />
                إعلاناتك الحالية
              </h4>
              {entity && getActiveAnnouncements(entity.id).length > 0 ? (
                <div className="space-y-3">
                  {getActiveAnnouncements(entity.id).map((ad: any) => (
                    <div key={ad.id} className="p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-700">{ad.text}</p>
                      <p className="text-xs text-gray-400 mt-1">ينتهي: {new Date(ad.expiry).toLocaleDateString('ar-IQ')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">لا توجد إعلانات نشطة حالياً</p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}