import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Appointment, AppointmentFilters, AppointmentStatus, AppointmentTransfer, Doctor, Hospital, Patient } from './appointment.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private apiBaseUrl = environment.apiUrl;
  private apiUrl = `${this.apiBaseUrl}/api/appointments`;

  constructor(private http: HttpClient) { }

  // Get all appointments with optional filters
  getAppointments(filters?: AppointmentFilters): Observable<Appointment[]> {
    let params = new HttpParams();
    
    if (filters) {
      if (filters.date) params = params.set('date', filters.date);
      if (filters.doctorId) params = params.set('doctorId', filters.doctorId);
      if (filters.status) params = params.set('status', filters.status);
      if (filters.searchTerm) params = params.set('search', filters.searchTerm);
    }

    return this.http.get<Appointment[]>(this.apiUrl, { params }).pipe(
      catchError(this.handleError<Appointment[]>('getAppointments', []))
    );
  }

  // Get appointments for today
  getTodayAppointments(doctorId?: string): Observable<Appointment[]> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const filters: AppointmentFilters = { 
      date: today,
      doctorId: doctorId
    };
    return this.getAppointments(filters);
  }

  // Get appointment by ID
  getAppointment(id: string): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError<Appointment>(`getAppointment id=${id}`))
    );
  }

  // Create a new appointment
  createAppointment(appointment: Appointment): Observable<Appointment> {
    return this.http.post<Appointment>(this.apiUrl, appointment).pipe(
      catchError(this.handleError<Appointment>('createAppointment'))
    );
  }

  // Update an existing appointment
  updateAppointment(appointment: Appointment): Observable<Appointment> {
    return this.http.put<Appointment>(`${this.apiUrl}/${appointment.appointmentId}`, appointment).pipe(
      catchError(this.handleError<Appointment>(`updateAppointment id=${appointment.appointmentId}`))
    );
  }

  // Update appointment status
  updateStatus(id: string, status: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/status`, { status }).pipe(
      catchError(this.handleError<any>(`updateStatus id=${id} status=${status}`))
    );
  }
  
  // Update appointment type (In Clinic or Video Consultation)
  updateAppointmentType(id: string, appointmentType: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/type`, { appointmentType }).pipe(
      catchError(this.handleError<any>(`updateAppointmentType id=${id} type=${appointmentType}`))
    );
  }

  // Delete an appointment
  deleteAppointment(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError<any>(`deleteAppointment id=${id}`))
    );
  }

  // Transfer appointment(s) to another doctor/hospital
  transferAppointments(transfer: AppointmentTransfer): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${transfer.appointmentId}/transfer`, transfer).pipe(
      catchError(this.handleError<any>('transferAppointments'))
    );
  }

  // Get all hospitals
  getHospitals(): Observable<Hospital[]> {
    return this.http.get<Hospital[]>(`${this.apiBaseUrl}/api/hospitals`).pipe(
      catchError(this.handleError<Hospital[]>('getHospitals', []))
    );
  }

  // Get all doctors, optionally filtered by hospital
  getDoctors(hospitalId?: string): Observable<Doctor[]> {
    let params = new HttpParams();
    if (hospitalId) {
      params = params.set('hospitalId', hospitalId);
    }
    return this.http.get<Doctor[]>(`${this.apiBaseUrl}/api/doctors`, { params }).pipe(
      catchError(this.handleError<Doctor[]>('getDoctors', []))
    );
  }

  // Get patients data
  getPatients(): Observable<Patient[]> {
    return this.http.get<Patient[]>(`${this.apiBaseUrl}/api/patients`).pipe(
      catchError(this.handleError<Patient[]>('getPatients', []))
    );
  }

  // Error handling method
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed: ${error.message}`);
      // Let the app keep running by returning an empty result
      return of(result as T);
    };
  }
}
