import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbModalRef, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPencilAlt, faPlus, faTimes, faTrash, faFilter } from '@fortawesome/free-solid-svg-icons';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { Service } from '../../../models/inventory.models';
import { catchError, finalize, of } from 'rxjs';

@Component({
  selector: 'app-service-master',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule, FontAwesomeModule],
  templateUrl: './service-master.html',
  styleUrl: './service-master.scss'
})
export class ServiceMasterComponent implements OnInit {
  // Icons
  faEdit = faPencilAlt;
  faAdd = faPlus;
  faRemove = faTimes;
  faDelete = faTrash;
  faFilter = faFilter;
  
  // Data
  services: Service[] = [];
  filteredServices: Service[] = [];
  loading = false;
  
  // Filter options
  serviceGroups = ['ALL', 'CONSULTATION', 'OPD', 'PACKAGE'];
  selectedGroup = 'ALL';
  
  // Modal
  modalRef?: NgbModalRef;
  serviceForm!: FormGroup;
  isEditing = false;
  currentServiceId?: string;
  formSubmitting = false;

  constructor(
    private http: HttpClient,
    private modalService: NgbModal,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.loadServices();
    this.initServiceForm();
  }

  // Initialize form for creating/editing services
  initServiceForm(): void {
    this.serviceForm = this.fb.group({
      name: ['', [Validators.required]],
      description: [''],
      group: ['CONSULTATION', [Validators.required]],
      rate: [0, [Validators.required, Validators.min(0)]],
      active: [true]
    });
  }

  // Load all services
  loadServices(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/api/services`)
      .pipe(
        catchError(error => {
          console.error('Error loading services:', error);
          return of({ success: false, data: [], message: 'Failed to load services' });
        }),
        finalize(() => this.loading = false)
      )
      .subscribe(response => {
        if (response.success && response.data) {
          this.services = response.data;
          this.applyFilter();
          console.log('Services loaded:', this.services);
        } else {
          console.error('Error in service response:', response);
          this.services = [];
          this.filteredServices = [];
        }
      });
  }

  // Apply group filter
  applyFilter(): void {
    if (this.selectedGroup === 'ALL') {
      this.filteredServices = this.services;
    } else {
      this.filteredServices = this.services.filter(s => s.group === this.selectedGroup);
    }
  }

  // Change filter
  changeFilter(group: string): void {
    this.selectedGroup = group;
    this.applyFilter();
  }

  // Open create/edit modal
  openServiceModal(modal: any, service?: Service): void {
    // Reset form and state
    this.initServiceForm();
    
    if (service) {
      // Edit mode
      this.isEditing = true;
      this.currentServiceId = service.id;
      
      this.serviceForm.patchValue({
        name: service.name,
        description: service.description || '',
        group: service.group,
        rate: service.rate,
        active: service.active
      });
    } else {
      // Create mode
      this.isEditing = false;
      this.currentServiceId = undefined;
    }
    
    this.modalRef = this.modalService.open(modal, { backdrop: 'static' });
  }

  // Save service (create or update)
  saveService(): void {
    if (this.serviceForm.invalid || this.formSubmitting) {
      return;
    }

    this.formSubmitting = true;
    const serviceData = this.serviceForm.value;
    
    if (this.isEditing && this.currentServiceId) {
      // Update existing service
      this.http.put<any>(`${environment.apiUrl}/api/services/${this.currentServiceId}`, serviceData)
        .pipe(finalize(() => this.formSubmitting = false))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.loadServices();
              this.modalRef?.close();
            } else {
              console.error('Error updating service:', response);
              alert('Error updating service: ' + (response.message || 'Unknown error'));
            }
          },
          error: (error) => {
            console.error('Error updating service:', error);
            alert('Error updating service: ' + (error.message || 'Unknown error'));
          }
        });
    } else {
      // Create new service
      this.http.post<any>(`${environment.apiUrl}/api/services`, serviceData)
        .pipe(finalize(() => this.formSubmitting = false))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.loadServices();
              this.modalRef?.close();
            } else {
              console.error('Error creating service:', response);
              alert('Error creating service: ' + (response.message || 'Unknown error'));
            }
          },
          error: (error) => {
            console.error('Error creating service:', error);
            alert('Error creating service: ' + (error.message || 'Unknown error'));
          }
        });
    }
  }

  // Update service status (active/inactive)
  updateServiceStatus(serviceId: string, active: boolean): void {
    this.http.patch<any>(`${environment.apiUrl}/api/services/${serviceId}/status`, { active })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.loadServices();
          } else {
            console.error('Error updating service status:', response);
            alert('Error updating service status: ' + (response.message || 'Unknown error'));
          }
        },
        error: (error) => {
          console.error('Error updating service status:', error);
          alert('Error updating service status: ' + (error.message || 'Unknown error'));
        }
      });
  }

  // Delete service
  deleteService(serviceId: string): void {
    if (confirm('Are you sure you want to delete this service? This action cannot be undone.')) {
      this.http.delete<any>(`${environment.apiUrl}/api/services/${serviceId}`)
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.loadServices();
            } else {
              console.error('Error deleting service:', response);
              alert('Error deleting service: ' + (response.message || 'Unknown error'));
            }
          },
          error: (error) => {
            console.error('Error deleting service:', error);
            alert('Error deleting service: ' + (error.message || 'Unknown error'));
          }
        });
    }
  }

  // Format currency
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  }
}
