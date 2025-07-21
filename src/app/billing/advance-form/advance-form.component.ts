import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BillingService } from '../shared/billing.service';
import { Advance } from '../shared/billing.model';
import { PatientService } from '../../patients/shared/patient.service';
import { Patient } from '../../patients/shared/patient.model';
import { finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-advance-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './advance-form.component.html',
  styleUrls: ['./advance-form.component.scss']
})
export class AdvanceFormComponent implements OnInit, OnDestroy {
  advanceForm!: FormGroup;
  isEditMode = false;
  advanceId: string | null = null;
  loading = false;
  submitted = false;
  patientSearchTerm = '';
  patientResults: any[] = [];
  showPatientSearch = false;
  
  // For improved search
  private searchTerms = new Subject<string>();
  private destroy$ = new Subject<void>();
  private searchSubscription?: Subscription;
  private hidePatientSearchTimeout?: any;
  
  constructor(
    private fb: FormBuilder,
    private billingService: BillingService,
    private patientService: PatientService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.createForm();
    
    // Set up patient search with debouncing
    this.searchSubscription = this.searchTerms.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchPatients(term);
    });
    
    // Check for patient ID in query params (for prepopulation)
    const patientId = this.route.snapshot.queryParamMap.get('patientId');
    if (patientId) {
      this.loadAndSelectPatientById(patientId);
    }
    
    // Check for advance ID for edit mode
    this.advanceId = this.route.snapshot.paramMap.get('id');
    if (this.advanceId) {
      this.isEditMode = true;
      this.loadAdvance(this.advanceId);
    }
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions
    this.destroy$.next(undefined);
    this.destroy$.complete();
    
    if (this.hidePatientSearchTimeout) {
      clearTimeout(this.hidePatientSearchTimeout);
    }
  }

  createForm(): void {
    // Generate unique advance ID with date and random component
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const randomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const advanceId = `ADV-${year}${month}${day}-${randomId}`;
    
    this.advanceForm = this.fb.group({
      patientId: ['', [Validators.required]],
      patientName: ['', [Validators.required]],
      date: [this.formatDate(today), [Validators.required]],
      amount: [0, [Validators.required, Validators.min(0)]],
      createdBy: ['System', [Validators.required]],
      modeOfPayment: ['CASH', [Validators.required]],
      advanceId: [advanceId, [Validators.required]],
      purpose: ['', [Validators.required]],
      referenceId: [''],
      notes: [''],
      createdDate: [this.formatDate(today)]
    });
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  loadAdvance(id: string): void {
    this.loading = true;
    this.billingService.getAdvanceById(id).subscribe({
      next: (advance) => {
        this.advanceForm.patchValue({
          patientId: advance.patientId,
          patientName: advance.patientName,
          date: this.formatDate(new Date(advance.date)),
          amount: advance.amount,
          createdBy: advance.createdBy,
          modeOfPayment: advance.modeOfPayment,
          advanceId: advance.advanceId,
          purpose: advance.purpose,
          referenceId: advance.referenceId || '',
          notes: advance.notes || ''
        });
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading advance payment', error);
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.advanceForm.invalid) {
      return;
    }
    
    this.loading = true;
    const formValue = this.advanceForm.value;
    
    // Map form values to advance model
    const advance: Advance = {
      patientId: formValue.patientId,
      patientName: formValue.patientName,
      date: formValue.date,
      amount: +formValue.amount,
      createdBy: formValue.createdBy,
      modeOfPayment: formValue.modeOfPayment,
      advanceId: formValue.advanceId,
      purpose: formValue.purpose,
      referenceId: formValue.referenceId || undefined,
      notes: formValue.notes || undefined
    };
    
    // Save or update based on mode
    if (this.isEditMode && this.advanceId) {
      this.billingService.updateAdvance(this.advanceId, advance)
        .pipe(finalize(() => this.loading = false))
        .subscribe({
          next: () => {
            alert('Advance payment updated successfully');
            this.router.navigate(['/billing/advances']);
          },
          error: (error: any) => {
            console.error('Error updating advance payment', error);
            alert('Failed to update advance payment: ' + (error.message || 'Unknown error'));
          }
        });
    } else {
      this.billingService.createAdvance(advance)
        .pipe(finalize(() => this.loading = false))
        .subscribe({
          next: () => {
            alert('Advance payment created successfully');
            this.router.navigate(['/billing/advances']);
          },
          error: (error: any) => {
            console.error('Error creating advance payment', error);
            alert('Failed to create advance payment: ' + (error.message || 'Unknown error'));
          }
        });
    }
  }

  onPatientSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.patientSearchTerm = target.value;
    
    // Feed the search term to the subject
    if (this.patientSearchTerm.length > 2) {
      this.searchTerms.next(this.patientSearchTerm);
      this.showPatientSearch = true;
    } else {
      this.patientResults = [];
      this.showPatientSearch = false;
    }
  }
  
  searchPatients(term: string): void {
    if (term.length > 2) {
      this.loading = true;
      this.showPatientSearch = true;
      
      this.patientService.searchPatients(term)
        .pipe(finalize(() => this.loading = false))
        .subscribe({
          next: (patients: Patient[]) => {
            this.patientResults = patients.slice(0, 10).map(patient => ({
              id: patient.id,
              name: `${patient.firstName} ${patient.lastName}`
            }));
          },
          error: (error: any) => {
            console.error('Error searching patients:', error);
            this.patientResults = [];
          }
        });
    } else {
      this.showPatientSearch = false;
      this.patientResults = [];
    }
  }
  
  hidePatientSearch(): void {
    // Use a timeout to allow click events to complete first
    this.hidePatientSearchTimeout = setTimeout(() => {
      this.showPatientSearch = false;
    }, 200);
  }
  
  loadAndSelectPatientById(patientId: string): void {
    this.patientService.getPatientById(patientId).subscribe({
      next: (patient: Patient) => {
        if (patient) {
          this.selectPatient({
            id: patient.id,
            name: `${patient.firstName} ${patient.lastName}`
          });
          console.log(`Patient prepopulated: ${patient.firstName} ${patient.lastName}`);
        }
      },
      error: (error) => {
        console.error('Error loading patient by ID:', error);
      }
    });
  }
  
  clearSelectedPatient(): void {
    this.advanceForm.patchValue({
      patientId: '',
      patientName: ''
    });
    this.patientSearchTerm = '';
    this.patientResults = [];
  }

  selectPatient(patient: any): void {
    this.advanceForm.patchValue({
      patientId: patient.id,
      patientName: patient.name
    });
    this.showPatientSearch = false;
    this.patientSearchTerm = '';
  }

  cancelForm(): void {
    this.router.navigate(['/billing/advances']);
  }
}
