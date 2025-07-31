import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-appointment-success-modal',
  templateUrl: './appointment-success-modal.html',
  styleUrls: ['./appointment-success-modal.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule]
})
export class AppointmentSuccessModalComponent implements OnInit, OnChanges {
  @Input() patientName: string = '';
  @Input() appointmentTime: string = '';
  @Input() appointmentDate: string = '';
  @Input() doctorName: string = '';
  @Input() doctorId: string = '';
  @Input() visible: boolean = false;
  @Output() close = new EventEmitter<string>();
  
  displayDoctorName: string = '';
  isLoading: boolean = false;
  error: string | null = null;
  
  constructor(private http: HttpClient) {}
  
  ngOnInit(): void {
    this.updateDoctorName();
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['doctorId'] || changes['doctorName']) {
      this.updateDoctorName();
    }
  }
  
  updateDoctorName(): void {
    // Check if we already have a doctor name that's not an ID
    if (this.doctorName && !this.doctorName.includes('-') && this.doctorName !== 'Doctor') {
      this.displayDoctorName = this.doctorName;
      return;
    }
    
    // If we have a doctor ID, fetch the doctor's name
    if (this.doctorId || (this.doctorName && this.doctorName.includes('-'))) {
      const id = this.doctorId || this.doctorName;
      this.fetchDoctorName(id);
    } else {
      this.displayDoctorName = 'Dr. Hanan';
    }
  }
  
  fetchDoctorName(id: string): void {
    this.isLoading = true;
    this.error = null;
    
    const apiUrl = `${environment.apiUrl}/api/doctors/${id}`;
    
    this.http.get<any>(apiUrl).subscribe({
      next: (response) => {
        if (response && response.name) {
          this.displayDoctorName = `Dr. ${response.name}`;
        } else if (response && response.firstName) {
          // Handle different API response formats
          const lastName = response.lastName || '';
          this.displayDoctorName = `Dr. ${response.firstName} ${lastName}`.trim();
        } else {
          this.displayDoctorName = 'Dr. Hanan';
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching doctor:', err);
        this.displayDoctorName = 'Dr. Hanan';
        this.error = 'Could not load doctor information';
        this.isLoading = false;
      }
    });
  }
  
  closeModal(action: string = ''): void {
    this.close.emit(action);
  }
}
