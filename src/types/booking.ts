export interface Specialty {
  id: string;
  name: string;
  icon: string;
  description: string;
  doctorEmail: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialtyId: string;
  title: string;
  image: string;
  rating: number;
  experience: number;
  about: string;
  // Schedule config determines available slots
  schedule: ScheduleConfig;
}

export interface ScheduleConfig {
  startTime: string;     // e.g. "16:00" (4:00 PM)
  endTime: string;       // e.g. "22:00" (10:00 PM)
  slotDuration: number;  // in minutes, e.g. 20
  daysOff: string[];     // e.g. ["الجمعة"]
}

export interface PatientInfo {
  fullName: string;
  phone: string;
  email: string;
  age: string;
  gender: 'male' | 'female';
  notes: string;
}

export interface BookingSlot {
  time: string;
  period: 'morning' | 'afternoon' | 'evening';
  available: boolean;
}

export interface BookingData {
  specialty: Specialty | null;
  doctor: Doctor | null;
  date: string;
  time: string;
  patient: PatientInfo | null;
  bookingId?: string;
}

export interface CenterSettings {
  centerName: string;
  centerAddress: string;
  centerPhone: string;
  centerEmail: string;
  workingDays: string;
  workingHours: string;
  fridayHours: string;
  emergencyHours: string;
}

export type BookingStep = 'specialty' | 'doctor' | 'datetime' | 'patient' | 'confirm';

// ====== Schedule Helpers ======

// Parse "HH:MM" to minutes since midnight
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Convert minutes to display string
export function minutesToDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? 'م' : 'ص';
  const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${displayH}:${m.toString().padStart(2, '0')} ${suffix}`;
}

// Generate all booking slots from schedule config
export function generateSlots(schedule: ScheduleConfig, bookedSlots: string[] = []): BookingSlot[] {
  const start = timeToMinutes(schedule.startTime);
  const end = timeToMinutes(schedule.endTime);
  const slots: BookingSlot[] = [];

  for (let t = start; t < end; t += schedule.slotDuration) {
    const timeStr = minutesToDisplay(t);
    const h = Math.floor(t / 60);
    const period = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
    slots.push({
      time: timeStr,
      period,
      available: !bookedSlots.includes(timeStr),
    });
  }

  return slots;
}

// Calculate total capacity
export function calculateCapacity(schedule: ScheduleConfig): { slotsPerHour: number; totalSlots: number; hours: number } {
  const start = timeToMinutes(schedule.startTime);
  const end = timeToMinutes(schedule.endTime);
  const hours = (end - start) / 60;
  const slotsPerHour = 60 / schedule.slotDuration;
  const totalSlots = Math.floor(hours * slotsPerHour);
  return { slotsPerHour, totalSlots, hours };
}
