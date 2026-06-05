// Seed data for MVP demo
(function() {
  // Only seed if no data exists
  if (localStorage.getItem('linex_centers') || localStorage.getItem('has_seeded')) return;
  
  localStorage.setItem('has_seeded', 'true');
  
  // Seed a demo center
  var center = {
    id: 'demo-center',
    name: 'مركز الشفاء الطبي',
    address: 'بغداد - الكرادة - شارع السعدون',
    phone: '07701234567',
    email: 'info@alshifa.iq',
    workingDays: 'السبت - الخميس',
    workingHours: '8:00 ص - 10:00 م',
    fridayHours: '4:00 م - 9:00 م',
    emergencyHours: '24 ساعة',
    adminId: 'demo-admin',
    activationType: 'free',
    subscriptionPrice: 0,
    freeTrialDays: 30,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    isPaid: true,
    isActive: true,
    status: 'active'
  };
  
  localStorage.setItem('linex_centers', JSON.stringify([center]));
  
  var admin = {
    id: 'demo-admin',
    fullName: 'مدير مركز الشفاء',
    username: 'shifa_admin',
    password: 'shifa123',
    role: 'center',
    phone: '07701234567',
    email: 'admin@alshifa.iq',
    centerId: 'demo-center',
    isActive: true,
    createdAt: new Date().toISOString()
  };
  
  var admins = JSON.parse(localStorage.getItem('linex_admins') || '[]');
  // Add default super admin if not exists
  var hasDefault = admins.some(function(a) { return a.username === 'admin'; });
  if (!hasDefault) {
    admins.push({ id: 'super-1', fullName: 'المدير العام', username: 'admin', password: 'admin123', role: 'super', phone: '07700000000', email: 'admin@linex.com', isActive: true, createdAt: new Date().toISOString() });
  }
  admins.push(admin);
  localStorage.setItem('linex_admins', JSON.stringify(admins));
  
  // Seed departments
  var depts = [
    { id: 'dept-cardio', name: 'أمراض القلب', description: 'تشخيص وعلاج أمراض القلب', icon: 'Heart', doctorEmail: 'cardio@alshifa.iq', centerId: 'demo-center', adminId: 'admin-cardio', activationType: 'free', subscriptionPrice: 0, freeTrialDays: 30, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), isPaid: true, isActive: true, status: 'active' },
    { id: 'dept-derma', name: 'الجلدية', description: 'علاج الأمراض الجلدية والتجميل', icon: 'ScanFace', doctorEmail: 'derma@alshifa.iq', centerId: 'demo-center', adminId: 'admin-derma', activationType: 'free', subscriptionPrice: 0, freeTrialDays: 30, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), isPaid: true, isActive: true, status: 'active' },
    { id: 'dept-ortho', name: 'العظام', description: 'علاج إصابات وامراض العظام', icon: 'Bone', doctorEmail: 'ortho@alshifa.iq', centerId: 'demo-center', adminId: 'admin-ortho', activationType: 'free', subscriptionPrice: 0, freeTrialDays: 30, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), isPaid: true, isActive: true, status: 'active' },
    { id: 'dept-dental', name: 'الأسنان', description: 'علاج أسنان وتجميل الابتسامة', icon: 'Smile', doctorEmail: 'dental@alshifa.iq', centerId: 'demo-center', adminId: 'admin-dental', activationType: 'free', subscriptionPrice: 0, freeTrialDays: 30, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), isPaid: true, isActive: true, status: 'active' },
  ];
  
  localStorage.setItem('linex_departments', JSON.stringify(depts));
  
  console.log('[LINEX] Demo data seeded successfully!');
})();
