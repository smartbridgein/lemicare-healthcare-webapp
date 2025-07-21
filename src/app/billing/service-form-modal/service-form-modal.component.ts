import { Component, ElementRef, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface ServiceGroup {
  id: string;
  name: string;
}

export interface ServicePayload {
  name: string;
  group: string;
  description?: string;
  rate: number;
}

@Component({
  selector: 'app-service-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './service-form-modal.component.html',
  styleUrls: ['./service-form-modal.component.scss']
})
export class ServiceFormModalComponent implements OnInit {
  @ViewChild('modal') modalElement!: ElementRef;
  @Output() serviceCreated = new EventEmitter<any>();
  
  serviceForm!: FormGroup;
  isSubmitting = false;
  errorMessage = '';
  
  groups: ServiceGroup[] = [
    { id: 'OPD', name: 'OPD' },
    { id: 'LAB', name: 'Laboratory' },
    { id: 'TREATMENT', name: 'Treatment' },
    { id: 'CONSULTATION', name: 'Consultation' }
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.initForm();
  }

  initForm(): void {
    this.serviceForm = this.fb.group({
      group: ['OPD', Validators.required],
      name: ['', Validators.required],
      description: [''],
      rate: [0, [Validators.required, Validators.min(0)]]
    });
  }

  open(): void {
    // Reset form before opening
    this.serviceForm.reset({
      group: 'OPD',
      rate: 0
    });
    this.errorMessage = '';
    
    // Open modal using Bootstrap's modal API
    if (this.modalElement) {
      const modal = new (window as any).bootstrap.Modal(this.modalElement.nativeElement);
      modal.show();
    }
  }

  close(): void {
    // Close modal using Bootstrap's modal API
    if (this.modalElement) {
      const modal = (window as any).bootstrap.Modal.getInstance(this.modalElement.nativeElement);
      if (modal) {
        modal.hide();
      }
    }
  }

  onSubmit(): void {
    if (this.serviceForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.serviceForm.controls).forEach(key => {
        this.serviceForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const payload: ServicePayload = {
      name: this.serviceForm.get('name')?.value,
      group: this.serviceForm.get('group')?.value,
      description: this.serviceForm.get('description')?.value || '',
      rate: +this.serviceForm.get('rate')?.value
    };

    // Call API to create the service
    this.http.post(`${environment.apiUrl}/services`, payload)
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          this.serviceCreated.emit(response);
          this.close();
        },
        error: (error) => {
          this.isSubmitting = false;
          this.errorMessage = error.error?.message || 'Failed to create service. Please try again.';
          console.error('Error creating service:', error);
        }
      });
  }
}
