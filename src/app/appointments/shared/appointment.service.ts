import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Appointment, AppointmentFilters } from './appointment.model';
import { ApiResponse } from '../../shared/models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private apiBaseUrl = environment.opdApiUrl;
  
  constructor(private http: HttpClient) { }

  // Get all appointments
  getAllAppointments(filters?: AppointmentFilters, page = 0, size = 10): Observable<Appointment[]> {
    // Start with base URL and required parameters
    let url = `${this.apiBaseUrl}/api/appointments?page=${page}&size=${size}`;
    
    // Log what we're doing for debugging
    console.log('Getting appointments with filters:', filters);
    
    if (filters) {
      if (filters.date) {
        url += `&date=${filters.date}`;
        console.log(`Added date filter: ${filters.date}`);
      }
      if (filters.doctorId) {
        url += `&doctorId=${filters.doctorId}`;
        console.log(`Added doctor filter: ${filters.doctorId}`);
      }
      if (filters.status) {
        url += `&status=${filters.status}`;
        console.log(`Added status filter: ${filters.status}`);
      }
      if (filters.searchTerm) {
        url += `&search=${encodeURIComponent(filters.searchTerm)}`;
        console.log(`Added search filter: ${filters.searchTerm}`);
      }
    }
    
    console.log('Final API URL:', url);
    
    // Get appointments directly as an array, not wrapped in ApiResponse
    return this.http.get<Appointment[]>(url);
  }

  // Get today's appointments with strict date filtering
  getTodaysAppointments(page = 0, size = 10): Observable<Appointment[]> {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]; // e.g., "2025-07-15"
    console.log('Fetching appointments for date:', today);
    
    // Make a direct API call to ensure proper date filtering
    return this.http.get<Appointment[]>(`${this.apiBaseUrl}/api/appointments?date=${today}&page=${page}&size=${size}`)
      .pipe(
        map(appointments => {
          // Apply additional client-side filtering to ensure only today's appointments
          const filteredAppointments = appointments.filter(appointment => {
            if (!appointment.appointmentDateTime) return false;
            const appointmentDate = appointment.appointmentDateTime.split('T')[0];
            return appointmentDate === today;
          });
          
          console.log(`API returned ${appointments.length} appointments, filtered to ${filteredAppointments.length} for today (${today})`);
          return filteredAppointments;
        })
      );
  }

  // Get upcoming appointments - including future dates
  getUpcomingAppointments(limit = 5): Observable<Appointment[]> {
    // No date filter so we get all scheduled future appointments
    return this.http.get<Appointment[]>(
      `${this.apiBaseUrl}/api/appointments?page=0&size=${limit}&status=SCHEDULED`
    );
  }

  // Get patients in queue
  getPatientsInQueue(page = 0, size = 10): Observable<Appointment[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.http.get<Appointment[]>(
      `${this.apiBaseUrl}/api/appointments?date=${today}&page=${page}&size=${size}&status=WAITING,IN_PROGRESS`
    );
  }

  // Get appointment by ID
  getAppointmentById(id: string): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.apiBaseUrl}/api/appointments/${id}`);
  }

  // Create a new appointment
  createAppointment(appointment: Appointment): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.apiBaseUrl}/api/appointments`, appointment);
  }

  // Update an existing appointment
  updateAppointment(id: string, appointment: Appointment): Observable<Appointment> {
    return this.http.put<Appointment>(`${this.apiBaseUrl}/api/appointments/${id}`, appointment);
  }

  // Cancel an appointment
  cancelAppointment(id: string): Observable<void> {
    return this.http.put<void>(`${this.apiBaseUrl}/api/appointments/${id}/cancel`, {});
  }
  
  // Delete an appointment
  deleteAppointment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBaseUrl}/api/appointments/${id}`);
  }
  
  // Update appointment type (In Clinic or Video Consultation)
  updateAppointmentType(id: string, appointmentType: string): Observable<Appointment> {
    return this.http.put<Appointment>(`${this.apiBaseUrl}/api/appointments/${id}/type`, { appointmentType });
  }
  
  // Reschedule an appointment (change date and time and optionally doctor)
  rescheduleAppointment(id: string, params: { appointmentDateTime: string, doctorId?: string }): Observable<Appointment> {
    console.log(`Rescheduling appointment with ID: ${id}`);
    console.log('Request parameters:', params);
    
    if (params.doctorId) {
      console.log(`Changing doctor to ID: ${params.doctorId}`);
    }
    
    return this.http.put<Appointment>(`${this.apiBaseUrl}/api/appointments/${id}/reschedule`, params).pipe(
      tap(response => {
        console.log('Reschedule appointment response:', response);
      }),
      catchError(error => {
        console.error('Error rescheduling appointment:', error);
        throw error;
      })
    );
  }

  // Method commented out because endpoint doesn't exist on backend
  // updateAppointmentStatus(id: string, status: string): Observable<void> {
  //   return this.http.put<void>(
  //     `${this.apiBaseUrl}/api/appointments/${id}/status`,
  //     { status: status }
  //   );
  // }

  // Generate test appointments for demo purposes
  private generateTestAppointments(): Appointment[] {
    const testAppointments: Appointment[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Names for test data
    const patientNames = [
      'John Smith', 'Sarah Johnson', 'Robert Williams', 'Emily Davis', 
      'Michael Brown', 'Jennifer Wilson', 'David Thompson', 'Jessica Martinez',
      'James Taylor', 'Lisa Anderson', 'Christopher Lee', 'Amanda White',
      'Matthew Garcia', 'Elizabeth Rodriguez', 'Daniel Martinez', 'Stephanie Clark',
      'Andrew Lewis', 'Nicole Hall', 'Kevin Young', 'Rachel Allen',
      'Thomas Scott', 'Rebecca King'
    ];
    
    const doctors = ['Dr. Johnson', 'Dr. Patel', 'Dr. Smith', 'Dr. Wilson'];
    const doctorIds = ['doctor-1', 'doctor-2', 'doctor-3', 'doctor-4'];
    
    const appointmentTypes = ['InClinic', 'Video'];
    const statuses = ['Queue', 'Arrived', 'Engaged', 'Finished', 'Cancelled'];
    const categories = ['General', 'Follow-up', 'Surgery Follow-up', 'Orthopedics', 'Dermatology'];
    
    // Create exactly 22 appointments (as shown in the UI)
    for (let i = 0; i < 22; i++) {
      // Distribute appointments across past, present and future
      let appointmentDate = new Date(today);
      
      // 6 appointments for today
      if (i < 6) {
        // Today's appointments - evenly distributed across morning and afternoon
        appointmentDate.setHours(9 + Math.floor(i/2), (i % 2) * 30, 0, 0);
      } 
      // 8 appointments for past dates
      else if (i < 14) {
        // Past appointments - between 1 and 8 days ago
        appointmentDate.setDate(today.getDate() - (i - 5));
        appointmentDate.setHours(10 + (i % 4), (i % 2) * 30, 0, 0);
      }
      // 8 appointments for future dates 
      else {
        // Future appointments - between 1 and 8 days in the future
        appointmentDate.setDate(today.getDate() + (i - 13));
        appointmentDate.setHours(9 + (i % 4), (i % 2) * 30, 0, 0);
      }
      
      // Create status distribution - more Queued for future, more Finished for past
      let status;
      if (i < 6) { // Today
        status = statuses[i % 4]; // No cancelled for today
      } else if (i < 14) { // Past
        status = Math.random() > 0.2 ? 'Finished' : 'Cancelled';
      } else { // Future
        status = 'Queue';
      }
      
      // Create realistic patient IDs but use proper patient names
      const patientId = (i < patientNames.length) ? 
        `patient-${i+1}` : // Use sequential patient IDs
        crypto.randomUUID(); // Fallback to UUID if needed
        
      // Create the appointment
      testAppointments.push({
        appointmentId: 'app-' + (i + 1),
        patientId: patientId,
        patientName: patientNames[i % patientNames.length], // Ensure we don't exceed array bounds
        doctorId: doctorIds[i % 4],
        appointmentDateTime: appointmentDate.toISOString(),
        appointmentType: appointmentTypes[i % 2],
        status: status,
        category: categories[i % 5],
        subCategory: 'Consultation',
        notes: 'Appointment notes for ' + patientNames[i],
        patientLatitude: null,
        patientLongitude: null,
        doctorLatitude: null,
        doctorLongitude: null
      });
    }
    
    return testAppointments;
  }

  // Get appointments with filters
  getAppointments(filters?: AppointmentFilters): Observable<Appointment[]> {
    // Call the API with the filters
    console.log('Getting appointments with filters:', filters);
    return this.getAllAppointments(filters);
  }
  
  // This method was removed to maintain original data handling

  // Get appointments with filters
  getAppointmentsWithFilters(filters?: AppointmentFilters): Observable<Appointment[]> {
    return this.getAllAppointments(filters).pipe(
      map((appointments: Appointment[]) => {
        console.log('Appointments from API:', appointments);
        
        // Check if we have valid data
        if (!appointments || !Array.isArray(appointments)) {
          console.error('Invalid appointments response format', appointments);
          throw new Error('Failed to fetch appointments');
        }
        
        // Sort by date (newest first)
        return appointments.sort((a, b) => {
          return new Date(b.appointmentDateTime || '').getTime() - new Date(a.appointmentDateTime || '').getTime();
        });
      }),
      catchError(error => {
        console.error('Error fetching appointments:', error);
        // Return empty array on error
        return of([]);
      })
    );
  }
  
  // Get doctors for dropdown
  getDoctors(): Observable<any[]> {
    console.log('Fetching doctors from:', `${this.apiBaseUrl}/api/doctors`);
    
    // Explicitly define the API response structure based on the actual backend format
    interface ApiResponseWrapper<T> {
      success: boolean;
      message: string;
      data: T;
      error: any;
    }
    
    return this.http.get<ApiResponseWrapper<any[]>>(`${this.apiBaseUrl}/api/doctors`).pipe(
      map(response => {
        console.log('Raw doctors API response:', response);
        
        // Validate the response
        if (!response || !response.success || !Array.isArray(response.data)) {
          console.warn('Invalid or unexpected API response format:', response);
          throw new Error('Invalid API response format');
        }
        
        // Properly process each doctor to ensure they have the correct structure
        const doctors = response.data.map(doctor => {
          // Create a properly structured doctor object
          return {
            id: doctor.id,
            doctorId: doctor.id, // For compatibility
            name: doctor.name || 'Unknown Doctor',
            specialization: doctor.specialization || 'General',
            qualification: doctor.qualification || '',
            available: doctor.available
          };
        });
        
        console.log(`Successfully processed ${doctors.length} doctors from API`);
        return doctors;
      }),
      catchError(error => {
        console.error('Error fetching doctors, using mock data:', error);
        // Return mock doctors on error
        return of(this.getMockDoctors());
      })
    );
  }
  
  // Get mock doctor data
  private getMockDoctors(): any[] {
    return [
      { 
        id: 'doc1', 
        doctorId: 'doc1', 
        name: 'Dr. John Smith', 
        specialization: 'Cardiology', 
        qualification: 'MD', 
        available: true 
      },
      { 
        id: 'doc2', 
        doctorId: 'doc2', 
        name: 'Dr. Jane Doe', 
        specialization: 'Neurology', 
        qualification: 'MD, PhD', 
        available: true 
      },
      { 
        id: 'doc3', 
        doctorId: 'doc3', 
        name: 'Dr. David Wilson', 
        specialization: 'Orthopedics', 
        qualification: 'MD', 
        available: true 
      },
      { 
        id: 'doc4', 
        doctorId: 'doc4', 
        name: 'Dr. Sarah Johnson', 
        specialization: 'Pediatrics', 
        qualification: 'MD', 
        available: true 
      },
      { 
        id: 'doc5', 
        doctorId: 'doc5', 
        name: 'Dr. Michael Brown', 
        specialization: 'Dermatology', 
        qualification: 'MD', 
        available: true 
      }
    ];
  }
  
  // Get mock patient data
  private getMockPatients(): any[] {
    return [
      {
        id: 'patient-1',
        patientId: 'patient-1',
        name: 'John Smith',
        email: 'john.smith@example.com',
        phoneNumber: '555-123-4567',
        gender: 'Male',
        active: true
      },
      {
        id: 'patient-2',
        patientId: 'patient-2',
        name: 'Sarah Johnson',
        email: 'sarah.johnson@example.com',
        phoneNumber: '555-234-5678',
        gender: 'Female',
        active: true
      },
      {
        id: 'patient-3',
        patientId: 'patient-3',
        name: 'Robert Williams',
        email: 'robert.williams@example.com',
        phoneNumber: '555-345-6789',
        gender: 'Male',
        active: true
      },
      // Add 20+ more mock patients with real names matching the appointments
      {
        id: 'eec49bdc-b2e9-4afc-a1c6-64e18be7f961',
        patientId: 'eec49bdc-b2e9-4afc-a1c6-64e18be7f961',
        name: 'Venkatesh Prabhu Balasubraminan',
        email: 'venkatesprabhu@gmail.com',
        phoneNumber: '9003361110',
        address: 'subbiah thevar street, Madurai, Tamilnadu - 625016',
        dateOfBirth: '1984-07-06',
        gender: 'Male',
        active: true
      }
    ];
  }

  // Get patients for dropdown
  getPatients(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/api/patients`).pipe(
      map((response: any[]) => {
        // Handle direct array response (not wrapped in ApiResponse)
        return response;
      }),
      catchError(error => {
        console.warn('API error fetching patients, using mock data:', error);
        return of(this.getMockPatients());
      })
    );
  }
  
  // Get patient details by ID
  getPatientById(patientId: string): Observable<any> {
    // Handle test patient IDs specially
    if (patientId.startsWith('test-')) {
      // Extract a readable name from test patient IDs
      let namePart = patientId.split('-').slice(0, 3).join(' ');
      // Make it look like a proper name
      namePart = namePart.replace('test user', 'Test Patient');
      namePart = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      
      const testPatient = {
        id: patientId,
        patientId: patientId,
        name: namePart,
        email: `${patientId.substring(0, 10)}@example.com`,
        phoneNumber: '555-TEST-000',
        gender: 'Not Specified',
        active: true
      };
      console.log(`Generated test patient name for ${patientId}:`, testPatient.name);
      return of(testPatient);
    }
    
    // Regular API call for non-test patients
    return this.http.get<any>(`${this.apiBaseUrl}/api/patients/${patientId}`).pipe(
      map((response: any) => {
        // Direct patient object response
        return response;
      }),
      catchError(error => {
        console.warn(`API error fetching patient ${patientId}, using mock data:`, error);
        // Find matching mock patient
        const mockPatient = this.getMockPatients().find(p => p.patientId === patientId);
        if (mockPatient) {
          return of(mockPatient);
        }
        // Generate a mock patient if no match found
        const newMockPatient = {
          id: patientId,
          patientId: patientId,
          name: `Patient ${patientId.substring(0, 6)}`,
          email: `patient-${patientId.substring(0, 6)}@example.com`,
          phoneNumber: '555-000-0000',
          gender: 'Not Specified',
          active: true
        };
        return of(newMockPatient);
      })
    );
  }
  
  // Get appointments summary count
  getAppointmentsSummary(): Observable<ApiResponse<any>> {
    const today = new Date().toISOString().split('T')[0];
    // Using the main endpoint with date filter to get today's appointments
    // Then mapping the response to create a summary object
    return this.http.get<ApiResponse<any>>(`${this.apiBaseUrl}/api/appointments?date=${today}`)
      .pipe(
        map((response: ApiResponse<any>) => {
          // Extract data we need for the dashboard summary
          const appointments = response.data || [];
          const summary = {
            success: response.success,
            message: response.message,
            data: {
              todayCount: appointments.length,
              pendingBillsCount: appointments.filter((a: any) => a.paymentStatus === 'PENDING').length,
              revenueToday: appointments.reduce((total: number, app: any) => total + (app.payment?.amount || 0), 0)
            }
          };
          return summary;
        })
      );
  }
}
