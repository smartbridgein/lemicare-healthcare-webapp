// Backend DTO model that matches the Java PatientDTO
export interface PatientDto {
  id?: string;
  name: string;
  email?: string;
  phoneNumber: string;
  address: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string;
  allergies?: string;
  medicalHistory?: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
  isActive?: boolean;
  registrationDate?: string; // Add registration date field
}
