export interface Patient {
  id?: string;
  patientId?: string;  // System generated ID like P-1001
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  age?: number;
  gender: string;
  mobileNumber: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  registrationDate: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
}
