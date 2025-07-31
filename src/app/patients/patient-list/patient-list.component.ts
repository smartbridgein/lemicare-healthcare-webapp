import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, ApplicationRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PatientService } from '../shared/patient.service';
import { Patient } from '../shared/patient.model';
import { environment } from '../../../environments/environment';
import { ModalService } from '../../shared/modal.service';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './patient-list.component.html',
  styleUrls: ['./patient-list.component.scss']
})
export class PatientListComponent implements OnInit, OnDestroy {
  patients: Patient[] = [];
  filteredPatients: Patient[] = [];
  displayedPatients: Patient[] = [];
  searchTerm: string = '';
  isLoading: boolean = false;
  error: string | null = null;
  errorDetails: string | null = null;
  showTroubleshooting: boolean = false;
  
  // Sorting properties
  sortField: 'name' | 'registrationDate' = 'registrationDate';
  sortDirection: 'asc' | 'desc' = 'desc'; // Default to newest first
  
  // Make Math available in the template
  Math = Math;
  
  // Pagination properties
  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number = 1;
  
  // Pattern for standard patient ID format (PAT-YYYY-XXXX)
  private standardIdPattern = /^PAT-\d{4}-\d{4}$/;
  
  // Subscription for reactive updates
  private patientSubscription: Subscription | null = null;
  
  // Individual patient view properties
  selectedPatient: Patient | null = null;
  showPatientDetails: boolean = false;
  patientId: string | null = null;

  constructor(
    private patientService: PatientService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private appRef: ApplicationRef,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    // Check if we have a patient ID in the route
    this.route.params.subscribe(params => {
      this.patientId = params['id'];
      if (this.patientId) {
        this.showPatientDetails = true;
        this.loadPatientDetails(this.patientId);
      } else {
        this.showPatientDetails = false;
        this.loadPatients();
      }
    });
    
    // Subscribe to patient list changes
    this.subscribeToPatientChanges();
    
    // Check for query parameters to handle direct navigation from sidebar
    this.route.queryParams.subscribe(params => {
      const view = params['view'];
      if (view === 'medical-history' || view === 'visit-history') {
        // If we have patients and a specific view is requested, navigate to the first patient's detail
        if (this.patients.length > 0) {
          const firstPatient = this.patients[0];
          if (firstPatient.id) {
            this.router.navigate([`/patients/${view}`, firstPatient.id]);
          }
        }
      }
    });
  }

  // Reset errors and force refresh UI
  resetAndRefresh(): void {
    console.log('Resetting component state and refreshing UI');
    this.error = null;
    this.errorDetails = null;
    this.isLoading = false;
    
    // Force Angular to check for changes
    this.zone.run(() => {
      this.cdr.detectChanges();
      this.appRef.tick();
      console.log('Change detection forced');
    });
  }

  // Load individual patient details
  loadPatientDetails(patientId: string): void {
    this.error = null;
    this.errorDetails = null;
    this.isLoading = true;
    
    console.log('Loading patient details for ID:', patientId);
    
    // First try to get the patient by ID
    this.patientService.getPatientById(patientId).subscribe({
      next: (patient) => {
        console.log('Patient details loaded successfully:', patient);
        this.selectedPatient = patient;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading patient details:', error);
        this.error = 'Failed to load patient details';
        this.errorDetails = error.message || 'Unknown error occurred';
        this.isLoading = false;
      }
    });
  }
  
  // Go back to patient list
  goBackToList(): void {
    this.showPatientDetails = false;
    this.selectedPatient = null;
  }

  loadPatients(): void {
    // Clear any previous errors first
    this.error = null;
    this.errorDetails = null;
    
    this.isLoading = true;
    console.log('Loading patients from patient list component');

    // Make API call to get all patients
    this.patientService.getAllPatients().subscribe({
      next: (patients) => {
        console.log('Patients loaded successfully in component:', patients.length);
        this.patients = patients;
        this.filteredPatients = [...this.patients];
        this.sortPatients();
        this.updatePagination();
        this.isLoading = false;
        
        // Ensure error is cleared if this is after a failed operation
        this.resetAndRefresh();
      },
      error: (err) => {
        this.error = 'Error loading patients. Please try again later.';
        this.isLoading = false;
        
        // Extract more detailed error information
        if (err.status === 0) {
          this.errorDetails = 'Cannot connect to backend server. This could be due to CORS issues or the server is not running.';
        } else if (err.status === 404) {
          this.errorDetails = `API endpoint not found. Make sure the API URL is correct: ${environment.apiUrl}/api/patients`;
        } else if (err.error && err.error.message) {
          this.errorDetails = err.error.message;
        } else {
          this.errorDetails = `Status code: ${err.status}, Message: ${err.statusText || 'Unknown error'}`;
        }
        
        console.error('Error loading patients:', err);
      }
    });
  }

  applyFilter(): void {
    if (!this.searchTerm) {
      this.filteredPatients = [...this.patients];
    } else {
      const searchTermLower = this.searchTerm.toLowerCase();
      this.filteredPatients = this.patients.filter(patient => 
        patient.patientId?.toLowerCase().includes(searchTermLower) ||
        patient.firstName.toLowerCase().includes(searchTermLower) ||
        patient.lastName.toLowerCase().includes(searchTermLower) ||
        patient.mobileNumber.includes(this.searchTerm)
      );
    }
    
    // Apply sorting after filtering
    this.sortPatients();
    
    // Reset to first page and update pagination
    this.currentPage = 1;
    this.updatePagination();
  }

  async deletePatient(id: string): Promise<void> {
    try {
      // Get patient name for confirmation message
      const patient = this.patients.find(p => p.id === id);
      const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'this patient';
      
      // Show confirmation modal
      const confirmed = await this.modalService.confirm({
        title: 'Delete Patient',
        message: `Are you sure you want to delete ${patientName}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmButtonClass: 'btn-danger',
        headerClass: 'bg-danger text-white'
      });
      
      if (!confirmed) return;
      
      // Clear any previous errors
      this.error = null;
      this.errorDetails = null;
      
      // Show loading state
      this.isLoading = true;
      
      console.log('Deleting patient with ID:', id);
      this.patientService.deletePatient(id).subscribe({
        next: (response) => {
          console.log('Delete response received:', response);
          
          if (response && response.success) {
            console.log('Patient deleted successfully');
            // UI will update automatically through the patientsChanged$ subscription
            // Just clear the loading state
            this.isLoading = false;
          } else {
            // Handle unsuccessful deletion (API returned success:false)
            this.isLoading = false;
            this.error = 'Error deleting patient. Please try again later.';
            this.errorDetails = response?.message || 'The server reported an error during deletion.';
            console.error('Delete operation unsuccessful:', response);
          }
        },
        error: (err) => {
          // Handle HTTP error during deletion
          this.isLoading = false;
          this.error = 'Error deleting patient. Please try again later.';
          
          if (err.status === 0) {
            this.errorDetails = 'Cannot connect to server. Please check your internet connection.';
          } else if (err.error && err.error.message) {
            this.errorDetails = err.error.message;
          } else {
            this.errorDetails = `Status: ${err.status}, Message: ${err.statusText || 'Unknown error'}`;
          }
          
          console.error('Error deleting patient:', err);
          
          // Force UI update to show the error
          this.cdr.detectChanges();
        }
      });
    } catch (error) {
      console.error('Error in delete operation:', error);
    }
  }

  sortPatients(): void {
    this.filteredPatients.sort((a, b) => {
      let comparison = 0;
      
      if (this.sortField === 'name') {
        // Sort by full name (first + last)
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } 
      else if (this.sortField === 'registrationDate') {
        // Sort by registration date
        const dateA = a.registrationDate ? new Date(a.registrationDate) : new Date(0);
        const dateB = b.registrationDate ? new Date(b.registrationDate) : new Date(0);
        comparison = dateA.getTime() - dateB.getTime();
      }
      // 'id' sorting case removed
      
      // Apply sort direction
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }
  
  setSortField(field: 'name' | 'registrationDate'): void {
    // If clicking on the same field, toggle direction
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      // Default to ascending for name, descending for dates
      this.sortDirection = field === 'registrationDate' ? 'desc' : 'asc';
    }
    
    this.sortPatients();
    this.updatePagination();
  }
  
  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredPatients.length / this.pageSize);
    this.goToPage(1);
  }
  
  goToPage(page: number): void {
    if (page < 1) {
      page = 1;
    } else if (page > this.totalPages) {
      page = this.totalPages || 1;
    }
    
    this.currentPage = page;
    const startIndex = (page - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.displayedPatients = this.filteredPatients.slice(startIndex, endIndex);
  }
  
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }
  
  prevPage(): void {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  private subscribeToPatientChanges(): void {
    // Clean up existing subscription if any
    if (this.patientSubscription) {
      this.patientSubscription.unsubscribe();
    }
    
    console.log('Subscribing to patient list changes');
    
    // Subscribe to changes from the service
    this.patientSubscription = this.patientService.patientsChanged$.subscribe(patients => {
      console.log('Patient list changed:', patients);
      if (patients && patients.length > 0) {
        this.error = null; // Clear any previous errors
        this.patients = patients;
        this.applyFilter(); // This will update filteredPatients and trigger pagination update
        this.cdr.detectChanges();
      }
    });
  }
  
  /**
   * Checks if a patient ID follows the standard format (PAT-YYYY-XXXX)
   */
  isStandardIdFormat(id?: string): boolean {
    if (!id) return false;
    return this.standardIdPattern.test(id);
  }
  
  /**
   * Formats patient IDs for display - keeps standard format and shortens UUIDs
   */
  formatPatientId(id?: string): string {
    if (!id) return 'N/A';
    
    // If already in PAT-YYYY-XXXX format, return as is
    if (this.isStandardIdFormat(id)) {
      return id;
    }
    
    // If it's a UUID, truncate it to the first 8 chars and last 4 chars
    if (id.length > 12) {
      return `${id.substring(0, 8)}...${id.substring(id.length - 4)}`;
    }
    
    // For any other format, return as is
    return id;
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions when component is destroyed
    if (this.patientSubscription) {
      this.patientSubscription.unsubscribe();
      this.patientSubscription = null;
    }
  }
  
  getPagesArray(): number[] {
    // Return array of page numbers for pagination controls with limited visible pages
    const maxVisiblePages = 5;
    const pages: number[] = [];
    
    if (this.totalPages <= maxVisiblePages) {
      // Show all pages if total pages is less than or equal to max visible
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Calculate start and end page for limited view
      let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
      
      // Adjust start page if we're near the end
      if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
      
      // Add pages to array
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  }

  /**
   * Clear search input and reset filter
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilter();
  }

  /**
   * Toggle sort direction between ascending and descending
   */
  toggleSortDirection(): void {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.applySorting();
  }

  /**
   * Apply sorting to the filtered patients list
   */
  applySorting(): void {
    this.filteredPatients.sort((a, b) => {
      let comparison = 0;
      
      if (this.sortField === 'name') {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (this.sortField === 'registrationDate') {
        const dateA = new Date(a.registrationDate || 0).getTime();
        const dateB = new Date(b.registrationDate || 0).getTime();
        comparison = dateA - dateB;
      }
      
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Reset to first page after sorting
    this.currentPage = 1;
    this.updatePagination();
  }

  /**
   * Refresh patients list by reloading data from the server
   */
  refreshPatients(): void {
    this.loadPatients();
  }

  /**
   * View patient details by setting the selected patient and showing details view
   * Opens inline within the current page context
   */
  viewPatientDetails(patient: Patient): void {
    this.selectedPatient = patient;
    this.showPatientDetails = true;
    
    // Smooth scroll to keep the user in context instead of jumping to top
    setTimeout(() => {
      const element = document.querySelector('.patient-details-view');
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
      }
    }, 100);
  }
}
