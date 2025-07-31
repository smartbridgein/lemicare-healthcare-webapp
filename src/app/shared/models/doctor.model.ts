export interface Doctor {
  id?: string;
  name: string;
  email: string;
  phoneNumber: string;
  specialization: string;
  qualification: string;
  licenseNumber: string;
  hospital?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  available: boolean; // Changed from isAvailable to available to match API
  profileImage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiResponse<T> {
  status: string;
  message: string;
  data: T;
}
