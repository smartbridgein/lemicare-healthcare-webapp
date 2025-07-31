import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PatientService } from '../shared/patient.service';
import { Patient } from '../shared/patient.model';

@Component({
  selector: 'app-patient-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './patient-registration.component.html',
  styleUrls: ['./patient-registration.component.scss']
})
export class PatientRegistrationComponent implements OnInit {
  patientForm!: FormGroup;
  patientId: string | null = null;
  isEditing: boolean = false;
  isLoading: boolean = false;
  isSaving: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  currentDate: Date = new Date();

  constructor(
    private fb: FormBuilder,
    private patientService: PatientService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.patientId = id;
        this.isEditing = true;
        this.loadPatient(id);
      }
    });
  }

  private initForm(): void {
    // Pattern for names - allows letters, spaces, and common name characters like apostrophes and hyphens
    const namePattern = /^[A-Za-z\s\-'.]+$/;
    // Pattern for address - more permissive but still prevents HTML special characters
    const addressPattern = /^[A-Za-z0-9\s\-'.,#/()&]+$/;
    
    this.patientForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.pattern(namePattern)]],
      middleName: ['', [Validators.pattern(namePattern)]],
      lastName: ['', [Validators.required, Validators.pattern(namePattern)]],
      dateOfBirth: ['', [Validators.required]],
      gender: ['', [Validators.required]],
      mobileNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      email: ['', [Validators.email]],
      address: ['', [Validators.required, Validators.pattern(addressPattern)]],
      city: ['', [Validators.required, Validators.pattern(namePattern)]],
      state: ['', [Validators.required, Validators.pattern(namePattern)]],
      pinCode: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]],
      emergencyContactName: ['', [Validators.pattern(namePattern)]],
      emergencyContactNumber: ['', [Validators.pattern(/^[0-9]{10}$/)]]
    });
  }

  private loadPatient(id: string): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.patientService.getPatientById(id).subscribe({
      next: (patient) => {
        // Format date for HTML date input (YYYY-MM-DD)
        if (patient && patient.dateOfBirth) {
          const date = new Date(patient.dateOfBirth);
          patient.dateOfBirth = date.toISOString().split('T')[0];
        }
        
        // Update form with patient data
        this.patientForm.patchValue(patient);
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'Error loading patient data. Please try again.';
        this.isLoading = false;
        console.error('Error loading patient:', err);
      }
    });
  }

  // Calculate age from date of birth
  calculateAge(dateOfBirth: string): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  onSubmit(): void {
    if (this.patientForm.invalid) {
      // Mark all fields as touched to trigger validation errors
      Object.keys(this.patientForm.controls).forEach(key => {
        const control = this.patientForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    const patientData = this.patientForm.value;
    // Add calculated fields
    patientData.age = this.calculateAge(patientData.dateOfBirth);
    patientData.registrationDate = new Date().toISOString().split('T')[0];

    this.isSaving = true;
    this.errorMessage = null;
    this.successMessage = null;

    if (this.isEditing && this.patientId) {
      // Update existing patient
      this.patientService.updatePatient(this.patientId, patientData).subscribe({
        next: (updatedPatient) => {
          this.successMessage = 'Patient updated successfully.';
          // Get the patient ID to navigate back to appropriate context
          // Use the current patientId since we're updating an existing patient
          const patientId = this.patientId;
          setTimeout(() => {
            // Check if we came from visit history or medical history based on referrer
            const referrer = document.referrer.toLowerCase();
            if (referrer.includes('visit-history')) {
              this.router.navigate(['/patients/visit-history', patientId]);
            } else if (referrer.includes('medical-history')) {
              this.router.navigate(['/patients/medical-history', patientId]);
            } else {
              // Default fallback to patient list
              this.router.navigate(['/patients']);
            }
          }, 2000);
          this.isSaving = false;
        },
        error: (err) => {
          this.isSaving = false;
          
          // Handle specific error messages
          if (err.error && err.error.message) {
            this.errorMessage = err.error.message;
          } else if (err.status === 400) {
            this.errorMessage = 'Invalid patient data. Please check all fields and try again.';
          } else if (err.status === 404) {
            this.errorMessage = 'Patient not found. The record may have been deleted.';
          } else if (err.status === 0) {
            this.errorMessage = 'Network error. Please check your connection and try again.';
          } else {
            this.errorMessage = 'Error updating patient. Please try again.';
          }
          
          console.error('Error updating patient:', err);
        }
      });
    } else {
      // Create new patient
      this.patientService.createPatient(patientData).subscribe({
        next: (createdPatient) => {
          this.successMessage = 'Patient registered successfully.';
          this.patientForm.reset();
          setTimeout(() => {
            this.router.navigate(['/patients']);
          }, 2000);
          this.isSaving = false;
        },
        error: (err) => {
          this.isSaving = false;
          
          // Handle specific error messages
          if (err.error && err.error.message) {
            this.errorMessage = err.error.message;
          } else if (err.status === 400) {
            this.errorMessage = 'Invalid patient data. Please check all fields and try again.';
          } else if (err.status === 409) {
            this.errorMessage = 'Patient with this phone number already exists.';
          } else if (err.status === 0) {
            this.errorMessage = 'Network error. Please check your connection and try again.';
          } else {
            this.errorMessage = 'Error registering patient. Please try again.';
          }
          
          console.error('Error registering patient:', err);
        }
      });
    }
  }
}
