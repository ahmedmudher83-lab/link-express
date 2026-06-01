import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { CenterSettings, Specialty } from '@/types/booking';

const DEFAULT_SETTINGS: CenterSettings = {
  centerName: 'مركز الشفاء الطبي',
  centerAddress: 'طريق الملك فهد، حي العليا، الرياض',
  centerPhone: '9200 12345',
  centerEmail: 'info@alshifa-medical.com',
  workingDays: 'السبت - الخميس',
  workingHours: '8:00 ص - 10:00 م',
  fridayHours: '4:00 م - 9:00 م',
  emergencyHours: '24 ساعة',
};

const DEFAULT_SPECIALTIES: Specialty[] = [
  { id: 'cardiology', name: 'أمراض القلب', icon: 'Heart', description: 'تشخيص وعلاج أمراض القلب والأوعية الدموية', doctorEmail: '' },
  { id: 'dermatology', name: 'الجلدية', icon: 'ScanFace', description: 'علاج الأمراض الجلدية والتجميل', doctorEmail: '' },
  { id: 'orthopedics', name: 'العظام', icon: 'Bone', description: 'علاج إصابات وامراض العظام والمفاصل', doctorEmail: '' },
  { id: 'pediatrics', name: 'الأطفال', icon: 'Baby', description: 'رعاية صحة الأطفال والرضع', doctorEmail: '' },
  { id: 'neurology', name: 'المخ والأعصاب', icon: 'Brain', description: 'تشخيص وعلاج أمراض الجهاز العصبي', doctorEmail: '' },
  { id: 'ophthalmology', name: 'العيون', icon: 'Eye', description: 'فحص وعلاج أمراض العيون', doctorEmail: '' },
  { id: 'ent', name: 'أنف وأذن وحنجرة', icon: 'Ear', description: 'علاج أمراض الأنف والأذن والحنجرة', doctorEmail: '' },
  { id: 'dental', name: 'الأسنان', icon: 'Smile', description: 'علاج أسنان وتجميل الابتسامة', doctorEmail: '' },
  { id: 'internal', name: 'الباطنية', icon: 'Stethoscope', description: 'تشخيص وعلاج الأمراض الباطنية', doctorEmail: '' },
  { id: 'gynecology', name: 'النساء والولادة', icon: 'HeartPulse', description: 'رعاية صحة المرأة والحمل والولادة', doctorEmail: '' },
  { id: 'urology', name: 'المسالك البولية', icon: 'Droplets', description: 'علاج أمراض الجهاز البولي', doctorEmail: '' },
  { id: 'psychiatry', name: 'الطب النفسي', icon: 'Sparkles', description: 'علاج الاضطرابات النفسية والعقلية', doctorEmail: '' },
];

const STORAGE_KEY_SETTINGS = 'medical_center_settings';
const STORAGE_KEY_SPECIALTIES = 'medical_center_specialties';

interface SettingsContextType {
  settings: CenterSettings;
  specialties: Specialty[];
  updateSettings: (s: CenterSettings) => void;
  updateSpecialties: (s: Specialty[]) => void;
  addSpecialty: (s: Specialty) => void;
  deleteSpecialty: (id: string) => void;
  resetAll: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CenterSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [specialties, setSpecialties] = useState<Specialty[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SPECIALTIES);
      return saved ? JSON.parse(saved) : DEFAULT_SPECIALTIES;
    } catch {
      return DEFAULT_SPECIALTIES;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SPECIALTIES, JSON.stringify(specialties));
  }, [specialties]);

  const updateSettings = (s: CenterSettings) => setSettings(s);
  const updateSpecialties = (s: Specialty[]) => setSpecialties(s);

  const addSpecialty = (s: Specialty) => {
    setSpecialties(prev => [...prev, s]);
  };

  const deleteSpecialty = (id: string) => {
    setSpecialties(prev => prev.filter(sp => sp.id !== id));
  };

  const resetAll = () => {
    setSettings(DEFAULT_SETTINGS);
    setSpecialties(DEFAULT_SPECIALTIES);
    localStorage.removeItem(STORAGE_KEY_SETTINGS);
    localStorage.removeItem(STORAGE_KEY_SPECIALTIES);
  };

  return (
    <SettingsContext.Provider value={{ settings, specialties, updateSettings, updateSpecialties, addSpecialty, deleteSpecialty, resetAll }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
