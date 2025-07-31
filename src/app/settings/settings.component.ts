import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { DoctorService } from '../shared/services/doctor.service';
import { Doctor } from '../shared/models/doctor.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  
  activeTab = 'general';
  doctors: Doctor[] = [];
  selectedDoctor: Doctor | null = null;
  isLoading = false;
  isEditMode = false;
  formError = '';
  formSuccess = '';
  
  // New doctor object for the form
  newDoctor: Doctor = {
    name: '',
    email: '',
    phoneNumber: '',
    specialization: '',
    qualification: '',
    licenseNumber: '',
    available: true
  };
  
  constructor(private doctorService: DoctorService) {}
  
  ngOnInit(): void {
    // Initialize settings component
    this.loadDoctors();
  }
  
  setActiveTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'users') {
      this.loadDoctors();
    }
  }
  
  // Load all doctors
  loadDoctors(): void {
    this.isLoading = true;
    this.doctorService.getAllDoctors().subscribe({
      next: (response) => {
        // Process doctors to ensure available property is treated as boolean
        if (response.data) {
          this.doctors = response.data.map(doctor => {
            // Explicitly convert available to boolean if needed
            return {
              ...doctor,
              available: Boolean(doctor.available)
            };
          });
        } else {
          this.doctors = [];
        }
        
        console.log('Loaded doctors with availability status:', this.doctors.map(doc => ({ id: doc.id, name: doc.name, available: doc.available, availableType: typeof doc.available })));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading doctors:', error);
        this.isLoading = false;
        this.formError = 'Failed to load doctors. Please try again.';
      }
    });
  }
  
  // Create or update doctor
  saveDoctor(): void {
    this.isLoading = true;
    this.formError = '';
    this.formSuccess = '';
    
    // Create a clean copy of doctor data without extra properties
    const doctorData: Doctor = {
      name: this.newDoctor.name,
      email: this.newDoctor.email,
      phoneNumber: this.newDoctor.phoneNumber,
      specialization: this.newDoctor.specialization,
      qualification: this.newDoctor.qualification,
      licenseNumber: this.newDoctor.licenseNumber,
      hospital: this.newDoctor.hospital || '',
      address: this.newDoctor.address || '',
      city: this.newDoctor.city || '',
      state: this.newDoctor.state || '',
      country: this.newDoctor.country || '',
      zipCode: this.newDoctor.zipCode || '',
      available: this.newDoctor.available
    };
    
    console.log('Doctor data to save:', doctorData);
    
    if (this.isEditMode && this.selectedDoctor?.id) {
      // Update existing doctor
      console.log(`Updating doctor with ID: ${this.selectedDoctor.id}`);
      this.doctorService.updateDoctor(this.selectedDoctor.id, doctorData)
        .subscribe({
          next: (response) => {
            console.log('Doctor update response:', response);
            this.formSuccess = 'Doctor updated successfully';
            this.loadDoctors();
            this.resetForm();
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Error updating doctor:', error);
            this.formError = `Failed to update doctor: ${error.message || 'Unknown error'}`;
            this.isLoading = false;
          }
        });
    } else {
      // Create new doctor
      console.log('Creating new doctor');
      this.doctorService.createDoctor(doctorData)
        .subscribe({
          next: (response) => {
            console.log('Doctor creation response:', response);
            this.formSuccess = 'Doctor added successfully';
            this.loadDoctors();
            this.resetForm();
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Error adding doctor:', error);
            this.formError = `Failed to add doctor: ${error.message || 'Unknown error'}`;
            this.isLoading = false;
          }
        });
    }
  }
  
  // Edit doctor
  editDoctor(doctor: Doctor): void {
    this.selectedDoctor = doctor;
    this.newDoctor = {...doctor};
    this.isEditMode = true;
    this.formError = '';
    this.formSuccess = '';
  }
  
  // Delete doctor
  deleteDoctor(id: string): void {
    if (confirm('Are you sure you want to delete this doctor?')) {
      this.isLoading = true;
      this.formError = '';
      this.formSuccess = '';
      
      this.doctorService.deleteDoctor(id).subscribe({
        next: (response) => {
          this.formSuccess = 'Doctor deleted successfully';
          this.loadDoctors();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error deleting doctor:', error);
          this.formError = 'Failed to delete doctor. Please try again.';
          this.isLoading = false;
        }
      });
    }
  }
  
  // Toggle doctor availability
  toggleAvailability(doctor: Doctor): void {
    if (doctor.id) {
      this.isLoading = true;
      // Ensure we're working with a boolean value
      const currentAvailability = Boolean(doctor.available);
      const newAvailability = !currentAvailability;
      console.log(`Toggling doctor ${doctor.id} availability from ${currentAvailability} to ${newAvailability}`);
      this.doctorService.updateAvailability(doctor.id, newAvailability).subscribe({
        next: (response) => {
          this.loadDoctors();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error updating availability:', error);
          this.isLoading = false;
        }
      });
    }
  }

  // View doctor details
  viewDoctor(doctor: Doctor): void {
    this.selectedDoctor = doctor;
    this.newDoctor = {...doctor};
    this.isEditMode = false;
    this.formError = '';
    this.formSuccess = '';
    
    // Set a small timeout to ensure the template has updated before attempting to disable fields
    setTimeout(() => {
      // Disable all form fields when in view mode
      const formInputs = document.querySelectorAll('#doctorFormSection input, #doctorFormSection select, #doctorFormSection textarea');
      formInputs.forEach((input: Element) => {
        if (input instanceof HTMLElement) {
          input.setAttribute('disabled', 'disabled');
        }
      });
    }, 100);
    
    // Scroll to the doctor form section
    const formElement = document.getElementById('doctorFormSection');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  }
  
  // Cancel editing or viewing
  cancelEdit(): void {
    // Re-enable all form fields that might have been disabled in view mode
    const formInputs = document.querySelectorAll('#doctorFormSection input, #doctorFormSection select, #doctorFormSection textarea');
    formInputs.forEach((input: Element) => {
      if (input instanceof HTMLElement) {
        input.removeAttribute('disabled');
      }
    });
    
    this.resetForm();
  }
  
  // Reset form
  resetForm(): void {
    this.selectedDoctor = null;
    this.isEditMode = false;
    this.newDoctor = {
      name: '',
      email: '',
      phoneNumber: '',
      specialization: '',
      qualification: '',
      licenseNumber: '',
      available: true
    };
    this.formError = '';
    this.formSuccess = '';
  }
}
