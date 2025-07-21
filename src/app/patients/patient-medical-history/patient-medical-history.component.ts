import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, OnDestroy, NgZone, ChangeDetectionStrategy, ApplicationRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PatientService } from '../shared/patient.service';
import { Patient } from '../shared/patient.model';
import { MedicalHistory } from '../shared/medical-history.model';
import { ApiResponse } from '../../shared/models/api-response.model';

@Component({
  selector: 'app-patient-medical-history',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './patient-medical-history.component.html',
  styleUrls: ['./patient-medical-history.component.scss'],
  // Force aggressive change detection
  changeDetection: ChangeDetectionStrategy.Default
})
export class PatientMedicalHistoryComponent implements OnInit, OnDestroy {
  historyForm!: FormGroup;
  patientId: string = '';
  patient: Patient | null = null;
  existingHistory: MedicalHistory | null = null;
  isLoading: boolean = false;
  isSaving: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  
  // Subscription to handle automatic updates
  private medicalHistorySubscription: Subscription | null = null;

  constructor(
    private fb: FormBuilder,
    private patientService: PatientService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private appRef: ApplicationRef
  ) {}

  ngOnInit(): void {
    this.initForm();
    
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.patientId = id;
        this.loadPatient(id);
        this.loadMedicalHistory(id);
        
        // Subscribe to medical history changes
        this.subscribeToMedicalHistoryChanges(id);
      } else {
        this.errorMessage = 'Patient ID is required.';
        setTimeout(() => {
          this.router.navigate(['/patients']);
        }, 2000);
      }
    });
  }

  private initForm(): void {
    this.historyForm = this.fb.group({
      bloodGroup: [''],
      allergies: this.fb.array([]),
      chronicDiseases: this.fb.array([]),
      currentMedications: this.fb.array([]),
      pastSurgeries: this.fb.array([]),
      familyHistory: ['']
    });
    
    // Initialize with empty fields to ensure forms are ready for data entry
    this.addAllergy();
    this.addChronicDisease();
    this.addMedication();
    this.addSurgery();
  }

  get allergiesArray(): FormArray {
    return this.historyForm.get('allergies') as FormArray;
  }

  get chronicDiseasesArray(): FormArray {
    return this.historyForm.get('chronicDiseases') as FormArray;
  }

  get currentMedicationsArray(): FormArray {
    return this.historyForm.get('currentMedications') as FormArray;
  }

  get pastSurgeriesArray(): FormArray {
    return this.historyForm.get('pastSurgeries') as FormArray;
  }

  createAllergyControl(value: string = ''): FormGroup {
    return this.fb.group({
      value: [value, Validators.required]
    });
  }

  createChronicDiseaseControl(value: string = ''): FormGroup {
    return this.fb.group({
      value: [value, Validators.required]
    });
  }

  createMedicationControl(value: string = ''): FormGroup {
    return this.fb.group({
      value: [value, Validators.required]
    });
  }

  // Get current date in YYYY-MM-DD format for date input max attribute
  getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  createSurgeryControl(name: string = '', date: string = '', hospital: string = '', notes: string = ''): FormGroup {
    // Create custom validator for date to not allow future dates
    const noFutureDateValidator = (control: any) => {
      if (!control.value) return null; // Skip validation if empty
      const selectedDate = new Date(control.value);
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0); // Reset time part for date-only comparison
      
      return selectedDate > currentDate ? { futureDate: true } : null;
    };
    
    return this.fb.group({
      surgeryName: [name], // Made optional by removing Validators.required
      date: [date, [noFutureDateValidator]], // Made optional by removing Validators.required
      hospital: [hospital],
      notes: [notes]
    });
  }

  addAllergy(): void {
    this.allergiesArray.push(this.createAllergyControl());
  }

  addChronicDisease(): void {
    this.chronicDiseasesArray.push(this.createChronicDiseaseControl());
  }

  addMedication(): void {
    this.currentMedicationsArray.push(this.createMedicationControl());
  }

  addSurgery(): void {
    this.pastSurgeriesArray.push(this.createSurgeryControl());
  }

  removeAllergy(index: number): void {
    this.allergiesArray.removeAt(index);
  }

  removeChronicDisease(index: number): void {
    this.chronicDiseasesArray.removeAt(index);
  }

  removeMedication(index: number): void {
    this.currentMedicationsArray.removeAt(index);
  }

  removeSurgery(index: number): void {
    this.pastSurgeriesArray.removeAt(index);
  }

  private loadPatient(id: string): void {
    this.isLoading = true;
    this.patientService.getPatientById(id).subscribe({
      next: (patient) => {
        this.patient = patient;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'Error loading patient data.';
        this.isLoading = false;
        console.error('Error loading patient:', err);
      }
    });
  }

  private subscribeToMedicalHistoryChanges(patientId: string): void {
    // Clean up existing subscription if any
    if (this.medicalHistorySubscription) {
      this.medicalHistorySubscription.unsubscribe();
    }
    
    console.log('Subscribing to medical history changes for patient:', patientId);
    
    // Subscribe to changes from the service
    this.medicalHistorySubscription = this.patientService.medicalHistoryChanged$.subscribe(historyMap => {
      console.log('Medical history changed event received:', historyMap);
      
      if (historyMap[patientId]) {
        console.log('New medical history data for current patient:', historyMap[patientId]);
        
        // Use zone to ensure change detection runs
        this.zone.run(() => {
          this.existingHistory = { ...historyMap[patientId] };
          // Only populate if we have actual history data
          if (this.existingHistory) {
            console.log('Populating medical history form with:', this.existingHistory);
            this.populateMedicalHistoryForm(this.existingHistory);
            
            // Force multiple change detection cycles to ensure UI updates
            this.cdr.detectChanges();
            setTimeout(() => {
              this.cdr.detectChanges();
              this.appRef.tick();
              console.log('Change detection forced');
            }, 0);
          }
        });
      }
    });
  }
  
  private loadMedicalHistory(patientId: string): void {
    this.isLoading = true;
    this.patientService.getMedicalHistoryByPatientId(patientId).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          // Clear any existing form arrays first
          this.clearFormArrays();
          
          // Re-add empty controls for new entry
          this.addAllergy();
          this.addChronicDisease();
          this.addMedication();
          this.addSurgery();
        }
        this.isLoading = false;
      },
      error: (err) => {
        // It's okay if no medical history exists yet
        this.isLoading = false;
        console.log('No existing medical history found or error fetching medical history');
        
        // Clear any existing form arrays first
        this.clearFormArrays();
          
        // Force change detection to update the UI immediately
        this.cdr.detectChanges();
          
        // Re-add empty controls for new entry
        this.addAllergy();
        this.addChronicDisease();
        this.addMedication();
        this.addSurgery();
      }
    });
  }

  private clearFormArrays(): void {
    // Helper method to clear all form arrays
    while (this.allergiesArray.length) {
      this.allergiesArray.removeAt(0);
    }
    while (this.chronicDiseasesArray.length) {
      this.chronicDiseasesArray.removeAt(0);
    }
    while (this.currentMedicationsArray.length) {
      this.currentMedicationsArray.removeAt(0);
    }
    while (this.pastSurgeriesArray.length) {
      this.pastSurgeriesArray.removeAt(0);
    }
  }

  private populateMedicalHistoryForm(history: MedicalHistory): void {
    // Reset form arrays
    this.clearFormArrays();

    // Set simple fields
    this.historyForm.patchValue({
      bloodGroup: history.bloodGroup || '',
      familyHistory: history.familyHistory || ''
    });

    // Populate allergies
    if (history.allergies && history.allergies.length) {
      history.allergies.forEach(allergy => {
        this.allergiesArray.push(this.createAllergyControl(allergy));
      });
    } else {
      this.addAllergy(); // Add at least one empty control
    }

    // Populate chronic diseases
    if (history.chronicDiseases && history.chronicDiseases.length) {
      history.chronicDiseases.forEach(disease => {
        this.chronicDiseasesArray.push(this.createChronicDiseaseControl(disease));
      });
    } else {
      this.addChronicDisease(); // Add at least one empty control
    }

    // Populate current medications
    if (history.currentMedications && history.currentMedications.length) {
      history.currentMedications.forEach(medication => {
        this.currentMedicationsArray.push(this.createMedicationControl(medication));
      });
    } else {
      this.addMedication(); // Add at least one empty control
    }

    // Populate past surgeries
    if (history.pastSurgeries && history.pastSurgeries.length) {
      history.pastSurgeries.forEach(surgery => {
        this.pastSurgeriesArray.push(
          this.createSurgeryControl(
            surgery.surgeryName,
            surgery.date,
            surgery.hospital || '',
            surgery.notes || ''
          )
        );
      });
    } else {
      this.addSurgery(); // Add at least one empty control
    }
  }

  // Force immediate UI update without waiting for subject
  private forceUpdateUI(medicalHistoryData: MedicalHistory): void {
    console.log('Force updating UI with medical history data:', medicalHistoryData);
    
    // Update the local object directly
    this.existingHistory = {...medicalHistoryData};
    
    // Force form repopulation
    this.populateMedicalHistoryForm(this.existingHistory);
    
    // Force multiple change detection cycles
    this.zone.run(() => {
      this.cdr.detectChanges();
      setTimeout(() => {
        this.cdr.detectChanges();
        this.appRef.tick();
        console.log('Medical history UI force updated');
      }, 0);
    });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions when component is destroyed
    if (this.medicalHistorySubscription) {
      this.medicalHistorySubscription.unsubscribe();
      this.medicalHistorySubscription = null;
    }
  }
  
  onSubmit(): void {
    console.log('Medical history form submitted');
    if (this.historyForm.invalid) {
      // Mark all fields as touched to trigger validation errors
      Object.keys(this.historyForm.controls).forEach(key => {
        const control = this.historyForm.get(key);
        control?.markAsTouched();
      });
      console.log('Form validation failed');
      return;
    }

    // Extract values from form arrays
    const allergies = this.allergiesArray.controls
      .map(control => control.get('value')?.value)
      .filter(value => value && value.trim() !== '');

    const chronicDiseases = this.chronicDiseasesArray.controls
      .map(control => control.get('value')?.value)
      .filter(value => value && value.trim() !== '');

    const currentMedications = this.currentMedicationsArray.controls
      .map(control => control.get('value')?.value)
      .filter(value => value && value.trim() !== '');

    const pastSurgeries = this.pastSurgeriesArray.controls
      .map(control => ({
        surgeryName: control.get('surgeryName')?.value || '',
        date: control.get('date')?.value || '',
        hospital: control.get('hospital')?.value || '',
        notes: control.get('notes')?.value || ''
      }))
      // Include surgeries that have at least one field filled
      .filter(surgery => {
        return surgery.surgeryName.trim() !== '' || 
               surgery.date.trim() !== '' || 
               surgery.hospital.trim() !== '' || 
               surgery.notes.trim() !== '';
      });

    // Ensure we always have arrays, even if empty
    const medicalHistoryData: MedicalHistory = {
      id: this.existingHistory?.id,
      patientId: this.patientId,
      bloodGroup: this.historyForm.value.bloodGroup,
      allergies: allergies || [],
      chronicDiseases: chronicDiseases || [],
      currentMedications: currentMedications || [],
      pastSurgeries: pastSurgeries || [],
      familyHistory: this.historyForm.value.familyHistory || '',
      lastUpdated: new Date().toISOString()
    };

    this.isSaving = true;
    this.errorMessage = null;
    this.successMessage = null;

    if (this.existingHistory?.id) {
      // Update existing medical history
      this.patientService.updateMedicalHistory(this.existingHistory.id, medicalHistoryData).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'Medical history updated successfully.';
            // Force UI update immediately
            this.forceUpdateUI(response.data);
            // Navigate to patient list after a short delay
            setTimeout(() => {
              this.router.navigate(['/patients']);
            }, 1500);
          } else {
            this.errorMessage = 'Failed to update medical history.';
          }
          this.isSaving = false;
        },
        error: (err: any) => {
          this.errorMessage = 'Error updating medical history. Please try again.';
          this.isSaving = false;
          console.error('Error updating medical history:', err);
        }
      });
    } else {
      // Create new medical history
      this.patientService.createMedicalHistory(medicalHistoryData).subscribe({
        next: (response: ApiResponse<MedicalHistory>) => {
          if (response.success) {
            this.successMessage = 'Medical history recorded successfully.';
            // Force UI update immediately
            this.forceUpdateUI(response.data);
            // Navigate to patient list after a short delay
            setTimeout(() => {
              this.router.navigate(['/patients']);
            }, 1500);
          } else {
            this.errorMessage = 'Failed to save medical history.';
          }
          this.isSaving = false;
        },
        error: (err: any) => {
          this.errorMessage = 'Error saving medical history. Please try again.';
          this.isSaving = false;
          console.error('Error saving medical history:', err);
        }
      });
    }
  }
}
