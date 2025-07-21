export interface VisitHistory {
  id?: string;
  patientId: string;
  visitDate: string;
  doctorId?: string;
  doctorName: string;
  symptoms: string[];
  diagnosis: string;
  treatment: string;
  prescriptions?: Prescription[];
  followUpDate?: string;
  notes?: string;
}

export interface Prescription {
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}
