import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Observable, map, catchError, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Patient } from '../shared/patient.model';
import { PatientDto } from '../shared/patient-dto.model';
import { ApiResponse } from '../../shared/models/api-response.model';
import { MedicalHistory } from '../shared/medical-history.model';
import { VisitHistory } from '../shared/visit-history.model';
import { Doctor } from '../../appointments/shared/appointment.model';

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  // Reactive subjects for data changes
  private visitHistorySubject = new BehaviorSubject<{[patientId: string]: any[]}>({});
  visitHistoryChanged$ = this.visitHistorySubject.asObservable();
  
  private medicalHistorySubject = new BehaviorSubject<{[patientId: string]: any}>({});
  medicalHistoryChanged$ = this.medicalHistorySubject.asObservable();
  
  // Subject for patient list changes
  private patientsSubject = new BehaviorSubject<Patient[]>([]);
  patientsChanged$ = this.patientsSubject.asObservable();
  
  private apiBaseUrl = environment.apiUrl;
  
  constructor(private http: HttpClient) { }

  // Patient Registration APIs
  getAllPatients(): Observable<Patient[]> {
    console.log('Getting all patients');
    return this.http.get<PatientDto[]>(`${this.apiBaseUrl}/api/patients`)
      .pipe(
        map(dtos => {
          console.log('Patients loaded successfully:', dtos.length);
          const patients = dtos.map(dto => this.convertToPatient(dto));
          // Update patients subject with latest data
          this.patientsSubject.next(patients);
          return patients;
        })
      );
  }

  getPatientById(id: string): Observable<Patient> {
    return this.http.get<PatientDto>(`${this.apiBaseUrl}/api/patients/${id}`)
      .pipe(map(dto => this.convertToPatient(dto)));
  }

  createPatient(patient: Patient): Observable<Patient> {
    const dto = this.convertToDto(patient);
    return this.http.post<PatientDto>(`${this.apiBaseUrl}/api/patients`, dto)
      .pipe(map(createdDto => this.convertToPatient(createdDto)));
  }

  updatePatient(id: string, patient: Patient): Observable<Patient> {
    const dto = this.convertToDto(patient);
    return this.http.put<PatientDto>(`${this.apiBaseUrl}/api/patients/${id}`, dto)
      .pipe(map(updatedDto => this.convertToPatient(updatedDto)));
  }

  deletePatient(id: string): Observable<ApiResponse<boolean>> {
    console.log('Attempting to delete patient:', id);
    return this.http.delete<ApiResponse<boolean>>(`${this.apiBaseUrl}/api/patients/${id}`)
      .pipe(
        tap(response => {
          console.log('Delete API response:', response);
          if (response && response.success) {
            // Update the local cache immediately for responsive UI
            const currentPatients = this.patientsSubject.value || [];
            const updatedPatients = currentPatients.filter(p => p.id !== id);
            this.patientsSubject.next(updatedPatients);
            console.log(`Patient ${id} removed from local cache, new count:`, updatedPatients.length);
          }
        }),
        catchError(error => {
          console.error('Error deleting patient:', error);
          // Return a formatted error response
          return of({ success: false, message: 'Failed to delete patient', data: false });
        })
      );
  }

  // Helper method to reload all patients after operations
  private reloadAllPatients(): void {
    console.log('Reloading all patients');
    this.http.get<PatientDto[]>(`${this.apiBaseUrl}/api/patients`)
      .subscribe({
        next: (dtos) => {
          const patients = dtos.map(dto => this.convertToPatient(dto));
          console.log('Patients reloaded successfully:', patients.length);
          this.patientsSubject.next(patients);
        },
        error: (err) => {
          console.error('Failed to reload patients:', err);
        }
      });
  }

  // Patient Search for Billing Forms
  searchPatients(searchTerm: string): Observable<Patient[]> {
    // Updated to match actual backend API path - likely looking for patients by name or ID
    return this.http.get<PatientDto[]>(`${this.apiBaseUrl}/api/patients?search=${encodeURIComponent(searchTerm)}`) 
      .pipe(
        map((response: any) => {
          // Handle both direct array responses and responses wrapped in data property
          const patients = response.data ? response.data : response;
          return patients.map((dto: PatientDto) => this.convertToPatient(dto));
        })
      );
  }

  // Medical History APIs
  getMedicalHistoryByPatientId(patientId: string): Observable<ApiResponse<MedicalHistory>> {
    return this.http.get<ApiResponse<MedicalHistory>>(`${this.apiBaseUrl}/api/medical-history/patient/${patientId}`)
      .pipe(map(response => {
        if (response.success && response.data) {
          // Update subject with new data
          const currentData = this.medicalHistorySubject.value;
          currentData[patientId] = response.data;
          console.log('Updating medicalHistorySubject with data:', response.data);
          this.medicalHistorySubject.next({...currentData});
        } else {
          console.log('No medical history data received or success=false', response);
        }
        return response;
      }));
  }

  createMedicalHistory(medicalHistory: MedicalHistory): Observable<ApiResponse<MedicalHistory>> {
    return this.http.post<ApiResponse<MedicalHistory>>(`${this.apiBaseUrl}/api/medical-history`, medicalHistory)
      .pipe(map(response => {
        if (response.success && response.data && medicalHistory.patientId) {
          // Update subject with new data
          const currentData = this.medicalHistorySubject.value;
          const patientId = medicalHistory.patientId;
          currentData[patientId] = response.data;
          console.log('Created medical history, updating subject:', response.data);
          this.medicalHistorySubject.next({...currentData});
          
          // Reload the full medical history to ensure synchronization
          this.getMedicalHistoryByPatientId(medicalHistory.patientId).subscribe();
        } else {
          console.log('Error creating medical history or missing patientId', response);
        }
        return response;
      }));
  }

  updateMedicalHistory(id: string, medicalHistory: MedicalHistory): Observable<ApiResponse<MedicalHistory>> {
    return this.http.put<ApiResponse<MedicalHistory>>(`${this.apiBaseUrl}/api/medical-history/${id}`, medicalHistory)
      .pipe(map(response => {
        if (response.success && response.data && medicalHistory.patientId) {
          // Update subject with updated data
          const currentData = this.medicalHistorySubject.value;
          const patientId = medicalHistory.patientId;
          currentData[patientId] = response.data;
          console.log('Updated medical history, updating subject:', response.data);
          this.medicalHistorySubject.next({...currentData});
          
          // Reload the full medical history to ensure synchronization
          this.getMedicalHistoryByPatientId(patientId).subscribe();
        } else {
          console.log('Error updating medical history or missing patientId', response);
        }
        return response;
      }));
  }

  // Visit History APIs
  getVisitHistoryByPatientId(patientId: string): Observable<ApiResponse<VisitHistory[]>> {
    return this.http.get<ApiResponse<VisitHistory[]>>(`${this.apiBaseUrl}/api/visit-history/patient/${patientId}`)
      .pipe(map(response => {
        if (response.success && response.data) {
          // Update subject with new data
          const currentData = this.visitHistorySubject.value;
          currentData[patientId] = response.data;
          console.log('Loaded visit history, updating subject:', response.data);
          this.visitHistorySubject.next({...currentData});
        } else {
          console.log('No visit history data received or success=false', response);
        }
        return response;
      }));
  }

  getVisitById(id: string): Observable<ApiResponse<VisitHistory>> {
    return this.http.get<ApiResponse<VisitHistory>>(`${this.apiBaseUrl}/api/visit-history/${id}`);
  }
  
  createVisit(visit: VisitHistory): Observable<ApiResponse<VisitHistory>> {
    return this.http.post<ApiResponse<VisitHistory>>(`${this.apiBaseUrl}/api/visit-history`, visit)
      .pipe(map(response => {
        if (response.success && response.data && visit.patientId) {
          // Update subject with new data
          const currentData = this.visitHistorySubject.value;
          const patientId = visit.patientId;
          if (!currentData[patientId]) {
            currentData[patientId] = [];
          }
          currentData[patientId] = [response.data, ...currentData[patientId]];
          console.log('Created visit, updating subject with:', patientId, response.data);
          // Creating a new object to trigger change detection
          this.visitHistorySubject.next({...currentData});
          
          // Reload the full visit history to ensure synchronization
          this.getVisitHistoryByPatientId(patientId).subscribe();
        } else {
          console.log('Failed to create visit or missing data:', response);
        }
        return response;
      }));
  }

  updateVisit(visitId: string, visit: VisitHistory): Observable<ApiResponse<VisitHistory>> {
    return this.http.put<ApiResponse<VisitHistory>>(`${this.apiBaseUrl}/api/visit-history/${visitId}`, visit)
      .pipe(map(response => {
        if (response.success && response.data && visit.patientId) {
          // Update subject with updated data
          const currentData = this.visitHistorySubject.value;
          const patientId = visit.patientId;
          if (currentData[patientId]) {
            const index = currentData[patientId].findIndex(v => v.id === visitId);
            if (index !== -1) {
              console.log('Updating visit at index', index, 'with:', response.data);
              currentData[patientId][index] = response.data;
              
              // Create a new array to ensure change detection triggers
              currentData[patientId] = [...currentData[patientId]];
              this.visitHistorySubject.next({...currentData});
            } else {
              console.log('Visit with ID not found in array:', visitId);
              // If can't find by ID, just add it to the array
              currentData[patientId] = [response.data, ...currentData[patientId]];
              this.visitHistorySubject.next({...currentData});
            }
          } else {
            console.log('No visit history array for patient:', patientId, 'creating new one');
            // If no array exists for this patient, create one
            currentData[patientId] = [response.data];
            this.visitHistorySubject.next({...currentData});
          }
          
          // Reload the full visit history to ensure synchronization
          this.getVisitHistoryByPatientId(patientId).subscribe();
        } else {
          console.log('Failed to update visit or missing data:', response);
        }
        return response;
      }));
  }

  // Helper methods to convert between frontend and backend models
  private convertToDto(patient: Patient): PatientDto {
    // Extract address components from patient model
    return {
      id: patient.id,
      name: `${patient.firstName} ${patient.middleName ? patient.middleName + ' ' : ''}${patient.lastName}`,
      phoneNumber: patient.mobileNumber,
      email: patient.email || undefined,
      address: `${patient.address}, ${patient.city}, ${patient.state} - ${patient.pinCode}`,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      emergencyContactName: patient.emergencyContactName || undefined,
      emergencyContactNumber: patient.emergencyContactNumber || undefined,
      isActive: true
    };
  }

  private convertToPatient(dto: PatientDto): Patient {
    // Parse name into components (simple implementation)
    const nameParts = dto.name ? dto.name.split(' ') : ['', ''];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    let middleName = '';
    
    // If there are more than 2 parts, everything in the middle is the middle name
    if (nameParts.length > 2) {
      middleName = nameParts.slice(1, -1).join(' ');
    }
    
    // Parse address components (simplified)
    const addressParts = dto.address ? dto.address.split(',') : [];
    let address = addressParts[0] || '';
    let city = '';
    let state = '';
    let pinCode = '';
    
    // Simple parsing of city, state, pincode
    if (addressParts.length > 1) {
      city = addressParts[1].trim();
    }
    
    if (addressParts.length > 2) {
      const stateAndPin = addressParts[2].split('-');
      state = stateAndPin[0].trim();
      pinCode = stateAndPin.length > 1 ? stateAndPin[1].trim() : '';
    }
    
    // Calculate age from dateOfBirth if available
    let age: number | undefined = undefined;
    if (dto.dateOfBirth) {
      const today = new Date();
      const birthDate = new Date(dto.dateOfBirth);
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }
    
    // Check if the ID already has the format PAT-YYYY-XXXX
    const patientIdFormat = /PAT-\d{4}-\d{4}/;
    const displayId = dto.id && patientIdFormat.test(dto.id) ? dto.id : dto.id || '';
    
    return {
      id: dto.id,
      patientId: displayId, // Use the formatted ID (PAT-YYYY-XXXX) for display
      firstName: firstName,
      middleName: middleName,
      lastName: lastName,
      dateOfBirth: dto.dateOfBirth,
      age: age, // Add calculated age
      gender: dto.gender,
      mobileNumber: dto.phoneNumber,
      email: dto.email || '',
      address: address,
      city: city,
      state: state,
      pinCode: pinCode,
      registrationDate: dto.registrationDate || new Date().toISOString().split('T')[0], // Use DTO registration date if available
      emergencyContactName: dto.emergencyContactName || '',
      emergencyContactNumber: dto.emergencyContactNumber || ''
    };
  }

  // Methods removed due to duplication with reactive methods above
  
  // Get all doctors
  getDoctors(): Observable<ApiResponse<Doctor[]>> {
    return this.http.get<ApiResponse<Doctor[]>>(`${this.apiBaseUrl}/api/doctors`);
  }

  // Billing History APIs
  getBillingHistoryByPatientId(patientId: string): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiBaseUrl}/api/billing/patient/${patientId}`);
  }
}
