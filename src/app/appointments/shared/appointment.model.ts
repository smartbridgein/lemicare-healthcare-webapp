export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  RESCHEDULED = 'RESCHEDULED',
  ENGAGED = 'ENGAGED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  QUEUE = 'QUEUE',
  ARRIVED = 'ARRIVED',
  FINISHED = 'FINISHED',
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE'
}

export enum TokenStatus {
  WAITING = 'WAITING',
  CURRENT = 'CURRENT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  SKIPPED = 'SKIPPED'
}

export interface Appointment {
  appointmentId: string;
  patientId: string;
  patientName?: string; // Added to display patient name in UI
  doctorId: string;
  appointmentDateTime: string | null;
  appointmentType: string; // Added appointment type field
  status: string;
  category: string;
  subCategory: string;
  notes: string;
  patientLatitude: number | null;
  patientLongitude: number | null;
  doctorLatitude: number | null;
  doctorLongitude: number | null;
  billingCompleted?: boolean; // Flag to indicate if billing has been completed for this appointment
  
  // Token system fields
  tokenNumber?: number; // Assigned token number for the appointment
  tokenStatus?: string; // Current status of the token (WAITING, CURRENT, COMPLETED, CANCELLED, SKIPPED)
  tokenTime?: string; // Time when the token was issued
  tokenOrder?: number; // Order in the queue for the day
}

export interface AppointmentFilters {
  date?: string;
  doctorId?: string;
  status?: string;
  searchTerm?: string;
}

export interface Patient {
  patientId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
}

export interface Hospital {
  hospitalId: string;
  name: string;
}

export interface Doctor {
  id: string;                 // API uses id, not doctorId
  doctorId?: string;          // For backward compatibility
  name: string;               // Full name from API
  firstName?: string;         // May be extracted from name
  lastName?: string;          // May be extracted from name
  specialization?: string;    // API uses specialization, not specialty
  specialty?: string;         // For backward compatibility
  hospitalId?: string;
  qualification?: string;
  email?: string;
  available?: boolean;
}

export interface AppointmentTransfer {
  appointmentId: string;
  doctorId?: string;
  hospitalId?: string;
  transferReason: string;
  notifyPatient: boolean;
}
