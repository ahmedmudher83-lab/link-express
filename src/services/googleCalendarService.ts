// ======== Google Calendar Integration Service ========
// Syncs doctor schedules and bookings with Google Calendar

import type { BookingRecord, DoctorCalendarSettings, Department } from '@/types/linex';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Check if Google Calendar is configured for a doctor
 */
export function isCalendarConfigured(settings: DoctorCalendarSettings): boolean {
  return settings?.enabled && !!settings?.googleAccessToken;
}

/**
 * Get Google Auth URL for Calendar scope
 */
export function getGoogleAuthUrl(clientId: string, redirectUri: string): string {
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ];
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: scopes.join(' '),
    include_granted_scopes: 'true',
    state: 'calendar_auth',
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Sync doctor's working schedule to Google Calendar
 * Creates recurring "busy" blocks for working hours
 */
export async function syncDoctorSchedule(
  settings: DoctorCalendarSettings,
  dept: Department
): Promise<boolean> {
  if (!isCalendarConfigured(settings)) return false;
  
  try {
    // Delete existing schedule events first
    await clearScheduleEvents(settings);
    
    // Create recurring events for each working day
    const daysMap: Record<string, number> = {
      'الأحد': 0, 'الإثنين': 1, 'الاثنين': 1, 'الثلاثاء': 2,
      'الأربعاء': 3, 'الخميس': 4, 'الجمعة': 5, 'السبت': 6,
    };
    
    const workingDays = dept.workingDays || [];
    const startTime = dept.startTime || '09:00';
    const endTime = dept.endTime || '14:00';
    const duration = dept.consultationDuration || 15;
    
    for (const dayName of workingDays) {
      const dayIndex = daysMap[dayName];
      if (dayIndex === undefined) continue;
      
      // Create recurring event for this working day
      const event = {
        summary: `دوام - ${dept.name}`,
        description: `جدول دوام ${dept.name}\nمدة الكشف: ${duration} دقيقة`,
        start: {
          dateTime: `2024-01-01T${startTime}:00`,
          timeZone: 'Asia/Baghdad',
        },
        end: {
          dateTime: `2024-01-01T${endTime}:00`,
          timeZone: 'Asia/Baghdad',
        },
        recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${getGoogleDayName(dayIndex)}`],
        colorId: '2', // Green
      };
      
      await createCalendarEvent(settings, event);
    }
    
    return true;
  } catch (err) {
    console.error('Failed to sync schedule:', err);
    return false;
  }
}

/**
 * Add a booking to Google Calendar
 */
export async function addBookingToCalendar(
  settings: DoctorCalendarSettings,
  booking: BookingRecord
): Promise<string | null> {
  if (!isCalendarConfigured(settings)) return null;
  
  try {
    const [year, month, day] = booking.date.split('-');
    const [hour, minute] = booking.time.split(':');
    
    const startDateTime = `${year}-${month}-${day}T${hour}:${minute}:00`;
    const endDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
    endDate.setMinutes(endDate.getMinutes() + 15); // Default 15 min
    
    const endDateTime = endDate.toISOString().replace('Z', '');
    
    const event = {
      summary: `حجز - ${booking.patientName}`,
      description: `مريض: ${booking.patientName}\nهاتف: ${booking.patientPhone}\n${booking.notes ? `ملاحظات: ${booking.notes}` : ''}`,
      start: {
        dateTime: startDateTime,
        timeZone: 'Asia/Baghdad',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Asia/Baghdad',
      },
      colorId: '11', // Red
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
        ],
      },
    };
    
    const eventId = await createCalendarEvent(settings, event);
    return eventId;
  } catch (err) {
    console.error('Failed to add booking to calendar:', err);
    return null;
  }
}

/**
 * Remove a booking from Google Calendar
 */
export async function removeBookingFromCalendar(
  settings: DoctorCalendarSettings,
  eventId: string
): Promise<boolean> {
  if (!isCalendarConfigured(settings)) return false;
  
  try {
    const res = await fetch(`${CALENDAR_API_BASE}/calendars/${settings.calendarId || 'primary'}/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${settings.googleAccessToken}`,
      },
    });
    
    return res.status === 204 || res.ok;
  } catch {
    return false;
  }
}

/**
 * Get today's bookings from Google Calendar
 */
export async function getTodayBookings(
  settings: DoctorCalendarSettings
): Promise<Array<{ start: string; end: string; summary: string; description?: string }>> {
  if (!isCalendarConfigured(settings)) return [];
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const timeMin = today.toISOString();
    const timeMax = tomorrow.toISOString();
    
    const res = await fetch(
      `${CALENDAR_API_BASE}/calendars/${settings.calendarId || 'primary'}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          'Authorization': `Bearer ${settings.googleAccessToken}`,
        },
      }
    );
    
    if (!res.ok) return [];
    
    const data = await res.json();
    return (data.items || []).map((item: { start: { dateTime: string }; end: { dateTime: string }; summary: string; description?: string }) => ({
      start: item.start?.dateTime,
      end: item.end?.dateTime,
      summary: item.summary,
      description: item.description,
    }));
  } catch {
    return [];
  }
}

// ======== Internal Helpers ========

async function createCalendarEvent(
  settings: DoctorCalendarSettings,
  event: Record<string, unknown>
): Promise<string | null> {
  try {
    const res = await fetch(`${CALENDAR_API_BASE}/calendars/${settings.calendarId || 'primary'}/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.googleAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
    
    if (!res.ok) {
      // Try refreshing token if unauthorized
      if (res.status === 401) {
        const newToken = await refreshAccessToken(settings.googleRefreshToken);
        if (newToken) {
          settings.googleAccessToken = newToken;
          return createCalendarEvent(settings, event);
        }
      }
      return null;
    }
    
    const data = await res.json();
    return data.id;
  } catch {
    return null;
  }
}

async function clearScheduleEvents(settings: DoctorCalendarSettings): Promise<void> {
  try {
    const res = await fetch(
      `${CALENDAR_API_BASE}/calendars/${settings.calendarId || 'primary'}/events?q=دوام`,
      {
        headers: {
          'Authorization': `Bearer ${settings.googleAccessToken}`,
        },
      }
    );
    
    if (!res.ok) return;
    
    const data = await res.json();
    const events = data.items || [];
    
    for (const evt of events) {
      await fetch(`${CALENDAR_API_BASE}/calendars/${settings.calendarId || 'primary'}/events/${evt.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${settings.googleAccessToken}`,
        },
      });
    }
  } catch {
    // Silent fail
  }
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

function getGoogleDayName(dayIndex: number): string {
  const names = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  return names[dayIndex] || 'SU';
}

// ======== Booking Storage (localStorage + Firestore) ========

const BOOKINGS_KEY = 'linex_bookings';

export function saveBooking(booking: BookingRecord): void {
  const bookings = getAllBookings();
  bookings.push(booking);
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
}

export function getAllBookings(): BookingRecord[] {
  try {
    const stored = localStorage.getItem(BOOKINGS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function getDepartmentBookings(deptId: string, date: string): BookingRecord[] {
  return getAllBookings().filter(b => b.departmentId === deptId && b.date === date && b.status === 'confirmed');
}

export function getTodayDepartmentBookings(deptId: string): BookingRecord[] {
  const today = new Date().toISOString().split('T')[0];
  return getDepartmentBookings(deptId, today);
}

export function cancelBooking(bookingId: string): void {
  const bookings = getAllBookings();
  const idx = bookings.findIndex(b => b.id === bookingId);
  if (idx >= 0) {
    bookings[idx].status = 'cancelled';
    bookings[idx].updatedAt = new Date().toISOString();
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  }
}

export function completeBooking(bookingId: string): void {
  const bookings = getAllBookings();
  const idx = bookings.findIndex(b => b.id === bookingId);
  if (idx >= 0) {
    bookings[idx].status = 'completed';
    bookings[idx].updatedAt = new Date().toISOString();
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  }
}

/**
 * Generate daily report for a department
 */
export function generateDailyReport(deptId: string, deptName: string, doctorName: string): string {
  const today = new Date().toISOString().split('T')[0];
  const bookings = getAllBookings().filter(
    b => b.departmentId === deptId && b.date === today && b.status === 'confirmed'
  );
  
  // Sort by time
  bookings.sort((a, b) => a.time.localeCompare(b.time));
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-IQ', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  
  let report = `📋 جدول مواعيد اليوم - ${deptName}\n`;
  report += `👨‍⚕️ الدكتور: ${doctorName}\n`;
  report += `📅 ${dateStr}\n`;
  report += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  if (bookings.length === 0) {
    report += `لا توجد حجوزات لهذا اليوم.\n`;
  } else {
    report += `إجمالي الحجوزات: ${bookings.length}\n\n`;
    
    bookings.forEach((b, i) => {
      report += `${i + 1}. ⏰ ${b.time} - ${b.patientName}\n`;
      report += `   📱 ${b.patientPhone}\n`;
      if (b.notes) report += `   📝 ${b.notes}\n`;
      report += `\n`;
    });
  }
  
  report += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `تم الإنشاء بواسطة LinkEX`;
  
  return report;
}

/**
 * Send report via email (using mailto: link as basic implementation)
 * In production, use Firebase Cloud Functions or email service
 */
export function sendReportByEmail(email: string, subject: string, body: string): void {
  const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailtoLink, '_blank');
}

/**
 * Send report via WhatsApp
 */
export function sendReportByWhatsApp(phone: string, message: string): void {
  const cleanPhone = phone.replace(/\D/g, '');
  const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(waLink, '_blank');
}