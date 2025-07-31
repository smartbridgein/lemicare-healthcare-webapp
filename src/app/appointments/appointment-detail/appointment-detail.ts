import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AppointmentService } from '../shared/appointment';
import { Appointment, AppointmentStatus } from '../shared/appointment.model';

@Component({
  selector: 'app-appointment-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './appointment-detail.html',
  styleUrl: './appointment-detail.scss'
})
export class AppointmentDetailComponent implements OnInit {
  // Expose enum to the template
  AppointmentStatus = AppointmentStatus;
  
  appointment: Appointment | null = null;
  isLoading: boolean = true;
  error: string | null = null;
  appointmentId: string = '';
  
  constructor(
    private appointmentService: AppointmentService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.appointmentId = params['id'].toString();
        this.loadAppointment();
      } else {
        this.navigateToList();
      }
    });
  }

  loadAppointment(): void {
    this.isLoading = true;
    this.error = null;
    
    this.appointmentService.getAppointment(this.appointmentId).subscribe({
      next: (data) => {
        this.appointment = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading appointment details:', err);
        this.error = 'Failed to load appointment details. Please try again.';
        this.isLoading = false;
      }
    });
  }

  updateStatus(newStatus: AppointmentStatus): void {
    if (!this.appointment) return;
    
    this.appointmentService.updateStatus(this.appointmentId, newStatus).subscribe({
      next: () => {
        if (this.appointment) {
          this.appointment.status = newStatus;
        }
      },
      error: (err) => {
        console.error('Error updating appointment status:', err);
        this.error = 'Failed to update appointment status. Please try again.';
      }
    });
  }

  deleteAppointment(): void {
    if (confirm('Are you sure you want to delete this appointment?')) {
      this.appointmentService.deleteAppointment(this.appointmentId).subscribe({
        next: () => {
          this.navigateToList();
        },
        error: (err) => {
          console.error('Error deleting appointment:', err);
          this.error = 'Failed to delete appointment. Please try again.';
        }
      });
    }
  }

  navigateToList(): void {
    this.router.navigate(['/appointments']);
  }

  navigateToEdit(): void {
    this.router.navigate(['/appointments', this.appointmentId, 'edit']);
  }
  
  getStatusClass(): string {
    if (!this.appointment) return 'badge bg-secondary';
    
    switch (this.appointment.status) {
      case AppointmentStatus.QUEUE:
        return 'badge bg-info text-white';
      case AppointmentStatus.ARRIVED:
        return 'badge bg-primary text-white';
      case AppointmentStatus.ENGAGED:
        return 'badge bg-warning text-dark';
      case AppointmentStatus.FINISHED:
        return 'badge bg-success text-white';
      case AppointmentStatus.CANCELLED:
        return 'badge bg-danger text-white';
      default:
        return 'badge bg-secondary';
    }
  }
}
