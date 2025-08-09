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
import { AuthService, UserProfile } from '../../../../../app/auth/shared/auth.service';

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
  
  // Permission controls
  isSuperAdmin = false;
  private user: UserProfile | null = null;
  
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
    private fb: FormBuilder,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadUserPermissions();
    this.loadServices();
    this.initServiceForm();
  }
    
  /**
   * Check if current user has super admin permissions
   * Only super admin can delete services
   */
  private loadUserPermissions(): void {
    this.user = this.authService.getCurrentUser();
    
    if (this.user) {
      // Check if user is super admin (by email or role)
      const email = this.user.email || '';
      const role = this.user.role || '';
      
      const isSuperAdminEmail = email.toLowerCase() === 'hanan-clinic@lemicare.com';
      const isSuperAdminRole = role.toUpperCase() === 'ROLE_SUPER_ADMIN' || 
                             role.toUpperCase() === 'SUPER_ADMIN';
      
      this.isSuperAdmin = isSuperAdminEmail || isSuperAdminRole;
      
      console.log('Service Master Permissions:', {
        email,
        role,
        isSuperAdmin: this.isSuperAdmin
      });
    }
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
          // Sort services by name in ascending order
          const sortedServices = response.data.sort((a: Service, b: Service) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });
          
          this.services = sortedServices;
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
    let filtered: Service[];
    if (this.selectedGroup === 'ALL') {
      filtered = this.services;
    } else {
      filtered = this.services.filter(s => s.group === this.selectedGroup);
    }
    
    // Sort filtered results by name in ascending order
    this.filteredServices = filtered.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
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
          next: (response: any) => {
            if (response.success) {
              this.loadServices();
              this.modalRef?.close();
            } else {
              console.error('Error updating service:', response);
              alert('Error updating service: ' + (response.message || 'Unknown error'));
            }
          },
          error: (error: any) => {
            console.error('Error updating service:', error);
            alert('Error updating service: ' + (error.message || 'Unknown error'));
          }
        });
    } else {
      // Create new service
      this.http.post<any>(`${environment.apiUrl}/api/services`, serviceData)
        .pipe(finalize(() => this.formSubmitting = false))
        .subscribe({
          next: (response: any) => {
            if (response.success) {
              this.loadServices();
              this.modalRef?.close();
            } else {
              console.error('Error creating service:', response);
              alert('Error creating service: ' + (response.message || 'Unknown error'));
            }
          },
          error: (error: any) => {
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
        next: (response: any) => {
          if (response.success) {
            this.loadServices();
          } else {
            console.error('Error updating service status:', response);
            alert('Error updating service status: ' + (response.message || 'Unknown error'));
          }
        },
        error: (error: any) => {
          console.error('Error updating service status:', error);
          alert('Error updating service status: ' + (error.message || 'Unknown error'));
        }
      });
  }

  // Bulk insert OPD services
  bulkInsertOpdServices(): void {
    const opdServices = [
      { name: 'advance exo', rate: 75000 },
      { name: 'ADVANCE EXO EXOSOMES', rate: 15000 },
      { name: 'AQ', rate: 10000 },
      { name: 'BLACK PEEL', rate: 3000 },
      { name: 'BOTOX', rate: 30000 },
      { name: 'CARBON LASER PEEL', rate: 7000 },
      { name: 'CO2 LASER', rate: 3000 },
      { name: 'CONSULTATION', rate: 700 },
      { name: 'DRESSING', rate: 300 },
      { name: 'DRS', rate: 10000 },
      { name: 'EAR LOBE REPAIR (PER EAR)', rate: 3000 },
      { name: 'EXCIMER', rate: 700 },
      { name: 'EXCISION', rate: 3000 },
      { name: 'EXCISION BIOPSY', rate: 5000 },
      { name: 'EYE LID SURGERY', rate: 9000 },
      { name: 'EZACNE', rate: 45 },
      { name: 'FACE WASH', rate: 320 },
      { name: 'FERRULAC PEEL', rate: 4000 },
      { name: 'FERULAC BOOSTER PEEL', rate: 5000 },
      { name: 'FILLERS', rate: 25000 },
      { name: 'fractinal co2 laser', rate: 8000 },
      { name: 'GFC', rate: 7000 },
      { name: 'GLUTA WHITENING PEEL', rate: 4000 },
      { name: 'GLYCOLIC', rate: 3000 },
      { name: 'HIFU FACE', rate: 10000 },
      { name: 'HIFU DOUBLE CHIN', rate: 7000 },
      { name: 'HYDRA FACIAL', rate: 12000 },
      { name: 'HYDRA FACIEAL', rate: 5000 },
      { name: 'HYDRA FACIEAL (Premium)', rate: 7000 },
      { name: 'ILS', rate: 1000 },
      { name: 'ils injection', rate: 2000 },
      { name: 'INJECTION LIPOLYSIS', rate: 15000 },
      { name: 'IV GLUATHIONE', rate: 6000 },
      { name: 'IV GLUTA', rate: 40000 },
      { name: 'LHR', rate: 7000 },
      { name: 'LHR CHIN', rate: 3000 },
      { name: 'LHR UPPERLIP', rate: 3000 },
      { name: 'LIDOCAINE', rate: 112 },
      { name: 'LIP FLIP', rate: 9000 },
      { name: 'MANDELIC T PEEL', rate: 4000 },
      { name: 'Medi Facial', rate: 15000 },
      { name: 'MEDIFACIAL', rate: 8000 },
      { name: 'melanostop peel', rate: 5000 },
      { name: 'MICRONEEDLING', rate: 5000 },
      { name: 'MNRF', rate: 7000 },
      { name: 'NAIL SURGERY (PER NAIL)', rate: 7000 },
      { name: 'NMF PEEL', rate: 4000 },
      { name: 'PROCEDURE', rate: 6000 },
      { name: 'PRP', rate: 5000 },
      { name: 'PUMPKIN PEEL', rate: 4000 },
      { name: 'PUNCH BIOPSY', rate: 6000 },
      { name: 'RAPLITE FACE WASH', rate: 450 },
      { name: 'RF', rate: 3000 },
      { name: 'SESGLYCOPEEL', rate: 4000 },
      { name: 'SKIN HYDRATION BOOSTER', rate: 20000 },
      { name: 'TATTO REMOVAL', rate: 8000 },
      { name: 'THREAD LIFTING', rate: 45000 },
      { name: 'TRIPLE COMBO', rate: 2000 },
      { name: 'TRUFACE FACE WASH', rate: 320 },
      { name: 'YELLOW PEEL', rate: 5000 }
    ];

    if (!confirm(`This will insert ${opdServices.length} OPD services. Are you sure?`)) {
      return;
    }

    this.loading = true;
    console.log(`Starting bulk insertion of ${opdServices.length} OPD services...`);
    
    this.insertServicesSequentially(opdServices, 0, 0, 0, []);
  }

  private insertServicesSequentially(
    services: Array<{name: string, rate: number}>, 
    index: number, 
    successCount: number, 
    failureCount: number, 
    failures: Array<{service: any, error: any}>
  ): void {
    if (index >= services.length) {
      // All services processed
      this.loading = false;
      console.log('\n=== BULK INSERTION SUMMARY ===');
      console.log(`Total services: ${services.length}`);
      console.log(`✅ Successfully inserted: ${successCount}`);
      console.log(`❌ Failed insertions: ${failureCount}`);
      
      if (failures.length > 0) {
        console.log('\n=== FAILED INSERTIONS ===');
        failures.forEach((failure, i) => {
          console.log(`${i + 1}. ${failure.service.name} (₹${failure.service.rate})`);
          console.log(`   Error:`, failure.error);
        });
      }
      
      alert(`Bulk insertion completed!\n\nSuccessfully inserted: ${successCount}\nFailed: ${failureCount}`);
      this.loadServices(); // Refresh the list
      return;
    }

    const service = services[index];
    const serviceData = {
      name: service.name,
      description: `OPD Service - ${service.name}`,
      group: 'OPD',
      rate: service.rate,
      active: true
    };

    console.log(`Inserting service ${index + 1}/${services.length}: ${service.name} (₹${service.rate})`);

    this.http.post<any>(`${environment.apiUrl}/api/services`, serviceData)
      .subscribe({
        next: (response) => {
          if (response && response.success) {
            console.log(`✅ Successfully inserted: ${service.name}`);
            // Continue with next service
            setTimeout(() => {
              this.insertServicesSequentially(services, index + 1, successCount + 1, failureCount, failures);
            }, 200); // Small delay between requests
          } else {
            console.error(`❌ Failed to insert: ${service.name}`, response);
            failures.push({ service, error: response });
            setTimeout(() => {
              this.insertServicesSequentially(services, index + 1, successCount, failureCount + 1, failures);
            }, 200);
          }
        },
        error: (error) => {
          console.error(`❌ Error inserting: ${service.name}`, error);
          failures.push({ service, error });
          setTimeout(() => {
            this.insertServicesSequentially(services, index + 1, successCount, failureCount + 1, failures);
          }, 200);
        }
      });
  }

  // Delete service
  deleteService(serviceId: string): void {
    if (confirm('Are you sure you want to delete this service? This action cannot be undone.')) {
      this.http.delete<any>(`${environment.apiUrl}/api/services/${serviceId}`)
        .subscribe({
          next: (response: any) => {
            if (response.success) {
              this.loadServices();
            } else {
              console.error('Error deleting service:', response);
              alert('Error deleting service: ' + (response.message || 'Unknown error'));
            }
          },
          error: (error: any) => {
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
      maximumFractionDigits: 0 
    }).format(amount);
  }
}
