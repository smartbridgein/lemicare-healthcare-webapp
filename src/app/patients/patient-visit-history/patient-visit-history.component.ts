import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, OnDestroy, NgZone, ChangeDetectionStrategy, ApplicationRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PatientService } from '../shared/patient.service';
import { Patient } from '../shared/patient.model';
import { VisitHistory, Prescription } from '../shared/visit-history.model';
import { Doctor } from '../../appointments/shared/appointment.model';

@Component({
  selector: 'app-patient-visit-history',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './patient-visit-history.component.html',
  styleUrls: ['./patient-visit-history.component.scss'],
  // Force aggressive change detection
  changeDetection: ChangeDetectionStrategy.Default
})
export class PatientVisitHistoryComponent implements OnInit, OnDestroy {
  patientId: string = '';
  patient: Patient | null = null;
  visitHistory: VisitHistory[] = [];
  visitForm!: FormGroup;
  selectedVisit: VisitHistory | null = null;
  isLoading: boolean = false;
  isSaving: boolean = false;
  isAddingNewVisit: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  doctors: Doctor[] = [];
  isLoadingDoctors: boolean = false;
  
  // Subscription to handle automatic updates
  private visitSubscription: Subscription | null = null;

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
    this.loadDoctors();
    
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.patientId = id;
        this.loadPatient(id);
        this.loadVisitHistory(id);
        
        // Subscribe to visit history changes
        this.subscribeToVisitHistoryChanges(id);
      } else {
        this.errorMessage = 'Patient ID is required.';
        setTimeout(() => {
          this.router.navigate(['/patients']);
        }, 2000);
      }
    });
  }

  private initForm(): void {
    this.visitForm = this.fb.group({
      visitDate: [new Date().toISOString().split('T')[0], Validators.required],
      doctorId: ['', Validators.required],
      doctorName: [''],
      symptoms: this.fb.array([this.createSymptomControl()]),
      diagnosis: ['', Validators.required],
      treatment: ['', Validators.required],
      prescriptions: this.fb.array([]),
      followUpDate: [''],
      notes: ['']
    });
  }

  get symptomsArray(): FormArray {
    return this.visitForm.get('symptoms') as FormArray;
  }

  get prescriptionsArray(): FormArray {
    return this.visitForm.get('prescriptions') as FormArray;
  }

  createSymptomControl(value: string = ''): FormGroup {
    return this.fb.group({
      value: [value, Validators.required]
    });
  }

  createPrescriptionControl(
    medicationName: string = '', 
    dosage: string = '', 
    frequency: string = '', 
    duration: string = '',
    notes: string = ''
  ): FormGroup {
    return this.fb.group({
      medicationName: [medicationName, Validators.required],
      dosage: [dosage, Validators.required],
      frequency: [frequency, Validators.required],
      duration: [duration, Validators.required],
      notes: [notes]
    });
  }

  addSymptom(): void {
    this.symptomsArray.push(this.createSymptomControl());
  }

  removeSymptom(index: number): void {
    if (this.symptomsArray.length > 1) {
      this.symptomsArray.removeAt(index);
    }
  }

  addPrescription(): void {
    this.prescriptionsArray.push(this.createPrescriptionControl());
  }

  removePrescription(index: number): void {
    this.prescriptionsArray.removeAt(index);
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

  private loadDoctors(): void {
    this.isLoadingDoctors = true;
    this.patientService.getDoctors().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.doctors = response.data;
        } else {
          this.doctors = [];
        }
        this.isLoadingDoctors = false;
      },
      error: (err) => {
        this.doctors = [];
        this.isLoadingDoctors = false;
        console.error('Error loading doctors:', err);
      }
    });
  }

  private subscribeToVisitHistoryChanges(patientId: string): void {
    // Clean up existing subscription if any
    if (this.visitSubscription) {
      this.visitSubscription.unsubscribe();
    }
    
    console.log('Subscribing to visit history changes for patient:', patientId);
    
    // Subscribe to changes from the service
    this.visitSubscription = this.patientService.visitHistoryChanged$.subscribe(historyMap => {
      console.log('Visit history changed event received:', historyMap);
      
      if (historyMap[patientId]) {
        console.log('New visit history data for current patient:', historyMap[patientId]);
        // Use zone to ensure change detection runs
        this.zone.run(() => {
          this.visitHistory = [...historyMap[patientId]];
          // Sort visits by date (most recent first)
          this.visitHistory.sort((a, b) => 
            new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
          );
          console.log('Visit history updated and sorted:', this.visitHistory);
          // Force multiple change detection cycles to ensure UI updates
          this.cdr.detectChanges();
          setTimeout(() => {
            this.cdr.detectChanges();
            this.appRef.tick();
            console.log('Change detection forced');
          }, 0);
        });
      }
    });
  }
  
  private loadVisitHistory(patientId: string): void {
    this.isLoading = true;
    this.patientService.getVisitHistoryByPatientId(patientId).subscribe({
      next: (response) => {
        // The service now updates the visitHistorySubject internally
        // and our subscription will handle updating the UI
        this.isLoading = false;
      },
      error: (err) => {
        this.visitHistory = [];
        this.isLoading = false;
        console.log('No visit history found or error fetching history:', err);
        this.cdr.detectChanges();
      }
    });
  }

  selectVisit(visit: VisitHistory): void {
    this.selectedVisit = { ...visit };
    this.isAddingNewVisit = false;
  }

  startNewVisit(): void {
    this.selectedVisit = null;
    this.isAddingNewVisit = true;
    this.resetForm();
  }

  cancelNewVisit(): void {
    this.isAddingNewVisit = false;
    this.resetForm();
  }

  resetForm(): void {
    // Reset form and clear arrays
    this.visitForm.reset({
      visitDate: new Date().toISOString().split('T')[0]
    });
    
    // Reset symptoms array
    while (this.symptomsArray.length) {
      this.symptomsArray.removeAt(0);
    }
    this.symptomsArray.push(this.createSymptomControl());
    
    // Reset prescriptions array
    while (this.prescriptionsArray.length) {
      this.prescriptionsArray.removeAt(0);
    }
  }

  populateVisitForm(visit: VisitHistory): void {
    this.resetForm();
    
    // Set basic fields
    this.visitForm.patchValue({
      visitDate: visit.visitDate,
      doctorId: visit.doctorId || '',
      doctorName: visit.doctorName,
      diagnosis: visit.diagnosis,
      treatment: visit.treatment,
      followUpDate: visit.followUpDate || '',
      notes: visit.notes || ''
    });
    
    // Populate symptoms
    while (this.symptomsArray.length) {
      this.symptomsArray.removeAt(0);
    }
    
    if (visit.symptoms && visit.symptoms.length) {
      visit.symptoms.forEach(symptom => {
        this.symptomsArray.push(this.createSymptomControl(symptom));
      });
    } else {
      this.symptomsArray.push(this.createSymptomControl());
    }
    
    // Populate prescriptions
    if (visit.prescriptions && visit.prescriptions.length) {
      visit.prescriptions.forEach(prescription => {
        this.prescriptionsArray.push(
          this.createPrescriptionControl(
            prescription.medicationName,
            prescription.dosage,
            prescription.frequency,
            prescription.duration,
            prescription.notes || ''
          )
        );
      });
    }
  }

  editVisit(visit: VisitHistory): void {
    this.selectedVisit = { ...visit };
    this.isAddingNewVisit = true;
    this.populateVisitForm(visit);
  }

  onSubmit(): void {
    console.log('Visit form submitted');
    if (this.visitForm.invalid) {
      // Mark all fields as touched to trigger validation errors
      Object.keys(this.visitForm.controls).forEach(key => {
        const control = this.visitForm.get(key);
        control?.markAsTouched();
      });
      console.log('Form validation failed');
      return;
    }
    
    // Get doctor name from selected doctor
    const selectedDoctorId = this.visitForm.get('doctorId')?.value;
    const selectedDoctor = this.doctors.find(doctor => doctor.doctorId === selectedDoctorId);
    if (selectedDoctor) {
      this.visitForm.patchValue({
        doctorName: selectedDoctor.name
      });
    }

    // Extract values from form arrays
    const symptoms = this.symptomsArray.controls
      .map(control => control.get('value')?.value)
      .filter(value => value && value.trim() !== '');

    const prescriptions = this.prescriptionsArray.controls
      .map(control => ({
        medicationName: control.get('medicationName')?.value,
        dosage: control.get('dosage')?.value,
        frequency: control.get('frequency')?.value,
        duration: control.get('duration')?.value,
        notes: control.get('notes')?.value
      }))
      .filter(prescription => prescription.medicationName && prescription.medicationName.trim() !== '');

    const visitData: VisitHistory = {
      id: this.selectedVisit?.id,
      patientId: this.patientId,
      visitDate: this.visitForm.value.visitDate,
      doctorId: this.visitForm.value.doctorId,
      doctorName: this.visitForm.value.doctorName,
      symptoms,
      diagnosis: this.visitForm.value.diagnosis,
      treatment: this.visitForm.value.treatment,
      prescriptions,
      followUpDate: this.visitForm.value.followUpDate,
      notes: this.visitForm.value.notes
    };

    this.isSaving = true;
    this.errorMessage = null;
    this.successMessage = null;

    if (this.selectedVisit?.id) {
      // Update existing visit
      this.patientService.updateVisit(this.selectedVisit.id, visitData).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'Visit updated successfully.';
            // Force UI update immediately
            this.forceUpdateUI(response.data);
            // Return to list view by clearing selection and form state
            this.isAddingNewVisit = false;
            this.selectedVisit = null;
            this.visitForm.reset();
            setTimeout(() => {
              this.successMessage = '';
            }, 3000);
          } else {
            this.errorMessage = 'Failed to update visit.';
          }
          this.isSaving = false;
        },
        error: (err) => {
          this.errorMessage = 'Error updating visit. Please try again.';
          this.isSaving = false;
          console.error('Error updating visit:', err);
        }
      });
    } else {
      // Create new visit
      this.patientService.createVisit(visitData).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'New visit recorded successfully.';
            // Force UI update immediately
            this.forceUpdateUI(response.data);
            // Return to list view by clearing selection and form state
            this.isAddingNewVisit = false;
            this.visitForm.reset();
            setTimeout(() => {
              this.successMessage = '';
            }, 3000);
          } else {
            this.errorMessage = 'Failed to record visit.';
          }
          this.isSaving = false;
        },
        error: (err) => {
          this.errorMessage = 'Error recording visit. Please try again.';
          this.isSaving = false;
          console.error('Error recording visit:', err);
        }
      });
    }
  }

  // Force immediate UI update without waiting for subject
  private forceUpdateUI(visitData: VisitHistory): void {
    console.log('Force updating UI with visit data:', visitData);
    
    // Update the local array directly
    if (visitData.id) {
      // For update: replace the item
      const index = this.visitHistory.findIndex(visit => visit.id === visitData.id);
      if (index !== -1) {
        this.visitHistory[index] = {...visitData};
      } else {
        // If not found, add it
        this.visitHistory.unshift({...visitData});
      }
    } else {
      // For create: add to beginning
      this.visitHistory.unshift({...visitData});
    }
    
    // Re-sort the array
    this.visitHistory.sort((a, b) => 
      new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
    );
    
    // Force multiple change detection cycles
    this.zone.run(() => {
      // Create new array reference to ensure change detection
      this.visitHistory = [...this.visitHistory];
      this.cdr.detectChanges();
      setTimeout(() => {
        this.cdr.detectChanges();
        this.appRef.tick();
      }, 0);
    });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions when component is destroyed
    if (this.visitSubscription) {
      this.visitSubscription.unsubscribe();
      this.visitSubscription = null;
    }
  }
}
