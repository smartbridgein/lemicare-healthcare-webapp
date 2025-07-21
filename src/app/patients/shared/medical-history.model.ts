export interface MedicalHistory {
  id?: string;
  patientId: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicDiseases?: string[];
  currentMedications?: string[];
  pastSurgeries?: PastSurgery[];
  familyHistory?: string;
  lastUpdated?: string;
}

export interface PastSurgery {
  surgeryName: string;
  date: string;
  hospital?: string;
  notes?: string;
}
