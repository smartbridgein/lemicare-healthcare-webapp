import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AppointmentService } from '../shared/appointment';
import { Appointment, AppointmentTransfer, Doctor, Hospital } from '../shared/appointment.model';

@Component({
  selector: 'app-appointment-transfer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './appointment-transfer.html',
  styleUrls: ['./appointment-transfer.scss']
})
export class AppointmentTransferComponent implements OnInit {
  appointment: Appointment | null = null;
  appointmentId!: string;
  isLoading: boolean = true;
  isSubmitting: boolean = false;
  error: string | null = null;
  success: string | null = null;
  
  transferForm: FormGroup;
  doctors: Doctor[] = [];
  hospitals: Hospital[] = [];
  
  transferType: 'doctor' | 'hospital' = 'doctor';
  
  constructor(
    private fb: FormBuilder,
    private appointmentService: AppointmentService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.transferForm = this.fb.group({
      appointmentId: ['', Validators.required],
      newDoctorId: ['', Validators.required],
      newHospitalId: [''],
      transferReason: ['', Validators.required],
      notifyPatient: [true]
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.appointmentId = id;
        this.transferForm.patchValue({
          appointmentId: this.appointmentId
        });
        this.loadAppointment();
        this.loadDoctors();
        this.loadHospitals();
      } else {
        this.navigateToList();
      }
    });
  }

  loadAppointment(): void {
    this.isLoading = true;
    this.appointmentService.getAppointment(this.appointmentId).subscribe({
      next: (data) => {
        this.appointment = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading appointment:', err);
        this.error = 'Failed to load appointment details. Please try again.';
        this.isLoading = false;
      }
    });
  }

  loadDoctors(): void {
    this.appointmentService.getDoctors().subscribe({
      next: (data) => {
        this.doctors = data;
      },
      error: (err) => {
        console.error('Error loading doctors:', err);
        this.error = 'Failed to load doctors. Please try again.';
      }
    });
  }

  loadHospitals(): void {
    this.appointmentService.getHospitals().subscribe({
      next: (data) => {
        this.hospitals = data;
      },
      error: (err) => {
        console.error('Error loading hospitals:', err);
        this.error = 'Failed to load hospitals. Please try again.';
      }
    });
  }

  setTransferType(type: 'doctor' | 'hospital'): void {
    this.transferType = type;
    
    if (type === 'doctor') {
      this.transferForm.get('newDoctorId')?.setValidators([Validators.required]);
      this.transferForm.get('newHospitalId')?.clearValidators();
      this.transferForm.get('newHospitalId')?.setValue('');
    } else {
      this.transferForm.get('newHospitalId')?.setValidators([Validators.required]);
      this.transferForm.get('newDoctorId')?.clearValidators();
      this.transferForm.get('newDoctorId')?.setValue('');
    }
    
    this.transferForm.get('newDoctorId')?.updateValueAndValidity();
    this.transferForm.get('newHospitalId')?.updateValueAndValidity();
  }

  onSubmit(): void {
    if (this.transferForm.invalid) {
      Object.keys(this.transferForm.controls).forEach(key => {
        const control = this.transferForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    this.isSubmitting = true;
    this.error = null;
    this.success = null;

    const transferData: AppointmentTransfer = {
      appointmentId: this.appointmentId,
      transferReason: this.transferForm.value.transferReason,
      notifyPatient: this.transferForm.value.notifyPatient
    };

    if (this.transferType === 'doctor') {
      transferData.doctorId = this.transferForm.value.newDoctorId;
    } else {
      transferData.hospitalId = this.transferForm.value.newHospitalId;
    }

    this.appointmentService.transferAppointments(transferData).subscribe({
      next: (response: any) => {
        this.isSubmitting = false;
        this.success = `Appointment successfully transferred to ${this.transferType === 'doctor' ? 'doctor' : 'hospital'}`;
        setTimeout(() => {
          this.router.navigate(['/appointments', this.appointmentId]);
        }, 1500);
      },
      error: (err: any) => {
        console.error('Error transferring appointment:', err);
        this.error = 'Failed to transfer appointment. Please try again.';
        this.isSubmitting = false;
      }
    });
  }

  navigateToList(): void {
    this.router.navigate(['/appointments']);
  }

  cancel(): void {
    this.router.navigate(['/appointments', this.appointmentId]);
  }
}
