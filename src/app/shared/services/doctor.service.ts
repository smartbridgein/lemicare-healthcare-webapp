import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Doctor, ApiResponse } from '../models/doctor.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DoctorService {
  private apiUrl = `${environment.opdApiUrl}/api/doctors`;

  constructor(private http: HttpClient) {
    console.log('Doctor Service initialized with API URL:', this.apiUrl);
  }
  
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred!';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server error: ${error.status} - ${error.statusText || ''} - ${JSON.stringify(error.error)}`;
    }
    
    console.error('Doctor API Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  // Get all doctors
  getAllDoctors(): Observable<ApiResponse<Doctor[]>> {
    console.log('Fetching all doctors from:', this.apiUrl);
    return this.http.get<ApiResponse<Doctor[]>>(this.apiUrl)
      .pipe(
        tap(response => console.log('Doctors API response:', response)),
        catchError(this.handleError)
      );
  }

  // Get doctor by ID
  getDoctorById(id: string): Observable<ApiResponse<Doctor>> {
    const url = `${this.apiUrl}/${id}`;
    console.log('Fetching doctor by ID from:', url);
    return this.http.get<ApiResponse<Doctor>>(url)
      .pipe(
        tap(response => console.log(`Doctor ${id} API response:`, response)),
        catchError(this.handleError)
      );
  }

  // Create a new doctor
  createDoctor(doctor: Doctor): Observable<ApiResponse<Doctor>> {
    console.log('Creating doctor at:', this.apiUrl, 'with data:', doctor);
    return this.http.post<ApiResponse<Doctor>>(this.apiUrl, doctor)
      .pipe(
        tap(response => console.log('Create doctor API response:', response)),
        catchError(this.handleError)
      );
  }

  // Update a doctor
  updateDoctor(id: string, doctor: Doctor): Observable<ApiResponse<Doctor>> {
    const url = `${this.apiUrl}/${id}`;
    console.log('Updating doctor at:', url, 'with data:', doctor);
    return this.http.put<ApiResponse<Doctor>>(url, doctor)
      .pipe(
        tap(response => console.log(`Update doctor ${id} API response:`, response)),
        catchError(this.handleError)
      );
  }

  // Delete a doctor
  deleteDoctor(id: string): Observable<ApiResponse<void>> {
    const url = `${this.apiUrl}/${id}`;
    console.log('Deleting doctor from:', url);
    return this.http.delete<ApiResponse<void>>(url)
      .pipe(
        tap(response => console.log(`Delete doctor ${id} API response:`, response)),
        catchError(this.handleError)
      );
  }

  // Get doctors by specialization
  getDoctorsBySpecialization(specialization: string): Observable<ApiResponse<Doctor[]>> {
    const url = `${this.apiUrl}/specialization/${specialization}`;
    console.log('Fetching doctors by specialization from:', url);
    return this.http.get<ApiResponse<Doctor[]>>(url)
      .pipe(
        tap(response => console.log(`Doctors with specialization ${specialization} API response:`, response)),
        catchError(this.handleError)
      );
  }

  // Get available doctors
  getAvailableDoctors(): Observable<ApiResponse<Doctor[]>> {
    const url = `${this.apiUrl}/available`;
    console.log('Fetching available doctors from:', url);
    return this.http.get<ApiResponse<Doctor[]>>(url)
      .pipe(
        tap(response => console.log('Available doctors API response:', response)),
        catchError(this.handleError)
      );
  }

  // Update doctor availability
  updateAvailability(id: string, isAvailable: boolean): Observable<ApiResponse<Doctor>> {
    const url = `${this.apiUrl}/${id}/availability?isAvailable=${isAvailable}`;
    console.log('Updating doctor availability at:', url);
    return this.http.patch<ApiResponse<Doctor>>(url, {})
      .pipe(
        tap(response => console.log(`Update doctor ${id} availability API response:`, response)),
        catchError(this.handleError)
      );
  }
}
