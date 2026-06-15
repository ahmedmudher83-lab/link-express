import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { BookingData, PatientInfo } from '@/types/booking';

interface BookingContextType {
  booking: BookingData;
  setSpecialty: (specialty: BookingData['specialty']) => void;
  setDoctor: (doctor: BookingData['doctor']) => void;
  setDateTime: (date: string, time: string) => void;
  setPatient: (patient: PatientInfo) => void;
  generateBookingId: () => string;
  resetBooking: () => void;
}

const initialBooking: BookingData = {
  specialty: null,
  doctor: null,
  date: '',
  time: '',
  patient: null,
};

const BookingContext = createContext<BookingContextType | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [booking, setBooking] = useState<BookingData>(initialBooking);

  const setSpecialty = (specialty: BookingData['specialty']) => {
    setBooking(prev => ({ ...prev, specialty, doctor: null }));
  };

  const setDoctor = (doctor: BookingData['doctor']) => {
    setBooking(prev => ({ ...prev, doctor }));
  };

  const setDateTime = (date: string, time: string) => {
    setBooking(prev => ({ ...prev, date, time }));
  };

  const setPatient = (patient: PatientInfo) => {
    setBooking(prev => ({ ...prev, patient }));
  };

  const generateBookingId = () => {
    const id = 'BK' + Date.now().toString(36).toUpperCase();
    setBooking(prev => ({ ...prev, bookingId: id }));
    return id;
  };

  const resetBooking = () => {
    setBooking(initialBooking);
  };

  return (
    <BookingContext.Provider
      value={{ booking, setSpecialty, setDoctor, setDateTime, setPatient, generateBookingId, resetBooking }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}
