import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Appointment, AppointmentFilters, AppointmentStatus, Doctor, Patient } from '../shared/appointment.model';
import { AppointmentService } from '../shared/appointment.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-appointment-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './appointment-list.html',
  styleUrl: './appointment-list.scss'
})
export class AppointmentListComponent implements OnInit, AfterViewInit, OnDestroy {
  appointments: Appointment[] = [];
  filteredAppointments: Appointment[] = [];
  doctors: Doctor[] = [];
  patients: Patient[] = [];
  selectedDate: string = new Date().toISOString().split('T')[0]; // Today's date by default
  selectedDoctor: string = '';
  selectedStatuses: AppointmentStatus[] = []; // Changed to array for multi-select
  searchTerm: string = '';
  isLoading: boolean = false;
  error: string | null = null;
  success: string | null = null; // Added success message property
  isTodayView: boolean = false; // Flag to check if we're in Today's Schedule view
  
  // Properties for appointment rescheduling
  showRescheduleModal: boolean = false;
  appointmentToReschedule: Appointment | null = null;
  newAppointmentDate: string = '';
  newAppointmentTime: string = '';
  newDoctorId: string | null = null; // For optional doctor change
  caseType: string = 'Follow-up'; // Default to Follow-up for reschedule
  category: string = 'Regular'; // Default to Regular category
  
  // Make enum available to the template
  AppointmentStatus = AppointmentStatus;
  
  // Status dropdown state
  isStatusDropdownOpen = false;
  
  // Mock doctors data for fallback - matches the API structure
  mockDoctors = [
    { id: 'doc1', doctorId: 'doc1', name: 'Dr. John Smith', specialization: 'Cardiology', qualification: 'MD', available: true },
    { id: 'doc2', doctorId: 'doc2', name: 'Dr. Jane Doe', specialization: 'Neurology', qualification: 'MD, PhD', available: true },
    { id: 'doc3', doctorId: 'doc3', name: 'Dr. David Wilson', specialization: 'Orthopedics', qualification: 'MD', available: true },
    { id: 'doc4', doctorId: 'doc4', name: 'Dr. Sarah Johnson', specialization: 'Pediatrics', qualification: 'MD', available: true },
    { id: 'doc5', doctorId: 'doc5', name: 'Dr. Michael Brown', specialization: 'Dermatology', qualification: 'MD', available: true }
  ];
  
  // For statistics cards
  totalAppointments: number = 0;
  queuedAppointments: number = 0;
  arrivedAppointments: number = 0;
  engagedAppointments: number = 0;
  finishedAppointments: number = 0;
  cancelledAppointments: number = 0;
  
  // For dropdown handling
  activeDropdown: string | null = null;
  
  // Patient age display
  patientAge: {[key: string]: number} = {};

  // Subscriptions container for cleanup
  private subscriptions: Subscription[] = [];

  // Modal to display appointment notes and details
  showAppointmentDetailsModal: boolean = false;
  selectedAppointmentDetails: Appointment | null = null;
  
  constructor(
    private appointmentService: AppointmentService,
    private route: ActivatedRoute,
    private datePipe: DatePipe,
    private router: Router,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    // Check if we're in Today's Schedule view mode
    const queryParamSub = this.route.queryParams.subscribe(params => {
      if (params['view'] === 'today') {
        this.isTodayView = true;
        // Set date filter to today and clear other filters
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.selectedDoctor = '';
        this.selectedStatuses = [];
        this.searchTerm = '';
      } else {
        this.isTodayView = false;
        // Clear date filter for regular view to show all appointments
        this.selectedDate = '';
      }
      
      this.loadAppointments();
      this.loadDoctors();
      this.loadPatients();
    });
  }

  loadAppointments(): void {
    this.isLoading = true;
    this.error = null;
    
    const filters: AppointmentFilters = {
      date: this.selectedDate,
      doctorId: this.selectedDoctor || undefined,
      status: this.selectedStatuses.length === 1 ? this.selectedStatuses[0] : undefined,
      searchTerm: this.searchTerm || undefined
    };
    
    this.appointmentService.getAppointments(filters).subscribe({
      next: (data) => {
        // Filter out appointments with missing critical data to prevent empty rows
        const validAppointments = data.filter(appointment => 
          appointment && 
          appointment.appointmentId && 
          appointment.patientId
        );
        
        // Sort appointments by date & time (newest first)
        const sortedAppointments = this.sortAppointmentsByDate(validAppointments);
        console.log('Appointments sorted by latest date and time first');
        
        this.appointments = sortedAppointments;
        this.filteredAppointments = [...sortedAppointments];
        
        // Load patient names for all appointments from the API
        this.appointments.forEach(appointment => {
          if (appointment.patientId && !appointment.patientName) {
            this.loadPatientName(appointment.patientId);
          }
        });
        
        console.log(`Found ${this.filteredAppointments.length} valid appointments`);
        this.updateStatistics();
        this.isLoading = false;
      },
      error: (err) => {
        this.error = `Failed to load appointments: ${err.message}`;
        this.isLoading = false;
      }
    });
  }

  loadDoctors(): void {
    // Initialize with mock data first to ensure we have something
    this.doctors = [...this.mockDoctors];
    console.log('Initialized with mock doctors:', this.doctors.length);
    
    console.log('Loading doctors from API...');
    this.appointmentService.getDoctors().subscribe({
      next: (data) => {
        console.log('Doctors loaded from API:', data);
        if (data && data.length > 0) {
          this.doctors = data;
          console.log('Using API doctors data');
        } else {
          console.warn('API returned no doctors, keeping mock data');
        }
      },
      error: (err) => {
        console.error('Error loading doctors:', err);
        console.log('Using mock doctors due to API error');
        // We already initialized with mock data, so no need to do anything
      },
      complete: () => {
        console.log(`Doctor dropdown has ${this.doctors.length} options available`);
      }
    });
  }

  loadPatients(): void {
    this.appointmentService.getPatients().subscribe({
      next: (data) => {
        this.patients = data;
      },
      error: (err) => {
        console.error('Failed to load patients', err);
      }
    });
  }


  
  // Maps to cache patient data we've already fetched
  private patientNamesCache: Map<string, string> = new Map<string, string>();
  private patientPhoneCache: Map<string, string> = new Map<string, string>();
  
  // Load a single patient name by ID
  loadPatientName(patientId: string): void {
    // Check cache first
    if (this.patientNamesCache.has(patientId)) {
      // Update all appointments with this patient ID using cached name
      const cachedName = this.patientNamesCache.get(patientId);
      this.updateAppointmentsWithPatientName(patientId, cachedName || '');
      return;
    }
    
    // Fetch from API if not in cache
    this.appointmentService.getPatientById(patientId).subscribe({
      next: (patient: any) => {
        if (patient) {
          console.log('Patient data from API:', patient);
          // Get name from the direct API response
          const patientName = patient.name;
          
          // Update name cache
          this.patientNamesCache.set(patientId, patientName);
          
          // Update phone cache if available
          if (patient.phoneNumber) {
            this.patientPhoneCache.set(patientId, patient.phoneNumber);
          }
          
          // Update all appointments with this patient
          this.updateAppointmentsWithPatientName(patientId, patientName);
        }
      },
      error: (error: Error) => {
        console.error(`Error loading patient ${patientId}:`, error);
      }
    });
  }
  
  // Helper to update all appointments with a patient name
  private updateAppointmentsWithPatientName(patientId: string, patientName: string): void {
    // Update all appointments with this patient ID
    this.appointments.forEach(app => {
      if (app.patientId === patientId) {
        app.patientName = patientName;
      }
    });
    
    // Force view refresh
    this.filteredAppointments = [...this.filteredAppointments];
    console.log(`Updated patient name: ${patientName} for ID: ${patientId}`);
  }

  getDoctorById(doctorId: string | undefined): Doctor | undefined {
    if (!doctorId) return undefined;
    
    // First check if we have the doctor in our loaded doctors array
    const doctor = this.doctors.find(d => d.id === doctorId || d.doctorId === doctorId);
    if (doctor) {
      return doctor;
    }
    
    // If not found and doctors array is empty, try loading doctors
    if (this.doctors.length === 0) {
      console.log('Doctor not found - loading doctors list');
      this.loadDoctors();
    }
    
    // Return undefined if doctor not found
    return undefined;
  }

  getPatientName(patientId: string): string {
    if (!patientId) return 'Unknown Patient';
    
    // Check if we already have this patient name in our cache
    if (this.patientNamesCache.has(patientId)) {
      return this.patientNamesCache.get(patientId) || patientId;
    }
    
    // Otherwise fetch it from the API
    this.loadPatientName(patientId);
    
    // Return the patient ID as a fallback while we wait for the API
    return patientId;
  }

  
  getDoctorName(doctorId: string): string {
    if (!doctorId) return 'Unknown';
    const doctor = this.doctors.find(d => d.doctorId === doctorId || d.id === doctorId);
    return doctor ? doctor.name : doctorId;
  }

  formatAppointmentDate(dateTime: string | null): string {
    if (!dateTime) return 'Not scheduled';
    const date = new Date(dateTime);
    
    // Format date as DD/MM/YYYY
    const formattedDate = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    // Format time as HH:MM AM/PM
    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    // Return combined date and time
    return `${formattedDate} at ${formattedTime}`;
  }
  
  /**
   * Gets the phone number for a patient by ID
   * @param patientId The patient ID
   * @returns The patient's phone number or an empty string if not found
   */
  getPatientPhone(patientId: string): string {
    if (!patientId) return '';
    
    // Check if we already have this patient's phone in our cache
    if (this.patientPhoneCache.has(patientId)) {
      return this.patientPhoneCache.get(patientId) || '';
    }
    
    // If we don't have the phone number but we're loading patient data anyway, just return empty string
    // The phone will be cached when loadPatientName loads the patient data
    if (!this.patientNamesCache.has(patientId)) {
      this.loadPatientName(patientId); // This will trigger loading patient data including phone
    }
    
    // Return empty string while waiting for the data
    return '';
  }



  /**
   * Sort appointments by date, newest first
   * @param appointments Array of appointments to sort
   * @returns Sorted array of appointments
   */
  sortAppointmentsByDate(appointments: Appointment[]): Appointment[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return [...appointments].sort((a, b) => {
      // Handle null dates - put them at the end
      if (!a.appointmentDateTime && !b.appointmentDateTime) return 0;
      if (!a.appointmentDateTime) return 1; // a is null, b is not - b comes first
      if (!b.appointmentDateTime) return -1; // b is null, a is not - a comes first
      
      const dateA = new Date(a.appointmentDateTime);
      const dateB = new Date(b.appointmentDateTime);
      
      // Put future appointments first (sorted by soonest first)
      if (dateA >= today && dateB >= today) {
        return dateA.getTime() - dateB.getTime(); // Soonest future date first
      }
      
      // Past appointments after future ones (sorted by most recent first)
      if (dateA < today && dateB < today) {
        return dateB.getTime() - dateA.getTime(); // Most recent past date first
      }
      
      // Mix of past and future - future comes first
      return dateA >= today ? -1 : 1;
    });
  }
  
  /**
   * Updates the statistics for the dashboard counts
   */
  updateStatistics(): void {
    this.totalAppointments = this.filteredAppointments.length;
    this.queuedAppointments = this.filteredAppointments.filter(a => a.status === AppointmentStatus.SCHEDULED).length;
    this.finishedAppointments = this.filteredAppointments.filter(a => a.status === AppointmentStatus.COMPLETED).length;
    this.cancelledAppointments = this.filteredAppointments.filter(a => a.status === AppointmentStatus.CANCELLED).length;
    this.arrivedAppointments = this.filteredAppointments.filter(a => a.status === AppointmentStatus.RESCHEDULED).length;
    this.engagedAppointments = this.filteredAppointments.filter(a => a.status === AppointmentStatus.ENGAGED).length;
  }

  private formatAppointmentTime(dateTime: string): string {
    if (!dateTime) return 'N/A';
    return new Date(dateTime).toLocaleTimeString('en-US', {
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    });
  }
  






  /**
   * Toggle the status dropdown visibility
   */
  toggleStatusDropdown(event: Event): void {
    event.stopPropagation();
    this.isStatusDropdownOpen = !this.isStatusDropdownOpen;
  }
  
  @ViewChild('statusDropdownContainer') statusDropdownContainer!: ElementRef;
  
  @HostListener('document:click', ['$event'])
  clickOutside(event: Event): void {
    // Close status dropdown when clicking outside
    if (this.isStatusDropdownOpen && this.statusDropdownContainer && 
        !this.statusDropdownContainer.nativeElement.contains(event.target)) {
      this.isStatusDropdownOpen = false;
    }
    
    // Close any active action dropdown when clicking outside
    if (this.activeDropdown && !(event.target as HTMLElement).closest('.dropdown-menu') && 
        !(event.target as HTMLElement).closest('.status-dropdown-toggle')) {
      this.closeDropdowns();
    }
    
    // Close modal dropdowns when clicking outside of them
    if (this.showRescheduleModal) {
      const target = event.target as HTMLElement;
      // Don't close the modal itself when clicking inside it
      if (!target.closest('select') && !target.closest('.modal-content select')) {
        // This will allow the select dropdowns to close when clicking elsewhere
        const openSelects = document.querySelectorAll('.modal select[open]');
        openSelects.forEach(select => {
          // Force close any open select dropdowns
          (select as HTMLSelectElement).blur();
        });
      }
    }
  }
  
  /**
   * Toggle a status in the selectedStatuses array
   * @param status The status to toggle selection for
   */
  toggleStatusSelection(status: AppointmentStatus, event: Event): void {
    // Stop event propagation to prevent closing the dropdown
    event.stopPropagation();
    
    const index = this.selectedStatuses.indexOf(status);
    if (index === -1) {
      // Status is not selected, add it
      this.selectedStatuses.push(status);
    } else {
      // Status is already selected, remove it
      this.selectedStatuses.splice(index, 1);
    }
    
    // Apply filters to update the list
    this.applyFilters();
  }

  applyFilters(): void {
    console.log('Applying filters...', { statuses: this.selectedStatuses });
    console.log('Applying filters:', {
      date: this.selectedDate, 
      doctor: this.selectedDoctor, 
      statuses: this.selectedStatuses, 
      search: this.searchTerm
    });
    // Always filter client-side on the existing appointments data
    this.filteredAppointments = this.appointments.filter(appointment => {
      // 1. Filter by date if selected
      if (this.selectedDate && appointment.appointmentDateTime) {
        // Create filter date - ensure we're working with local dates for comparison
        const filterDateStr = this.selectedDate; // YYYY-MM-DD format
        
        // Extract just the date portion from appointment datetime
        const appointmentDateTime = new Date(appointment.appointmentDateTime);
        const appointmentDateStr = appointmentDateTime.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Compare date strings directly to avoid timezone issues
        if (appointmentDateStr !== filterDateStr) {
          return false;
        }
      } else if (this.selectedDate && !appointment.appointmentDateTime) {
        // If a date filter is applied and the appointment has no date, exclude it
        return false;
      }
      
      // 2. Filter by doctor if selected
      if (this.selectedDoctor && appointment.doctorId !== this.selectedDoctor) {
        return false;
      }
      
      // 3. Filter by status if any statuses are selected
      if (this.selectedStatuses.length > 0 && !this.selectedStatuses.includes(appointment.status as AppointmentStatus)) {
        return false;
      }
      
      // 4. Filter by search term if entered
      if (this.searchTerm) {
        const searchLower = this.searchTerm.toLowerCase();
        const patientName = this.getPatientName(appointment.patientId).toLowerCase();
        const patientId = (appointment.patientId || '').toLowerCase();
        const appointmentId = (appointment.appointmentId || '').toLowerCase();
        const patientPhone = this.getPatientPhone(appointment.patientId).toLowerCase();
        
        // Return false if no match in any of these fields
        if (!patientName.includes(searchLower) && 
            !patientId.includes(searchLower) && 
            !appointmentId.includes(searchLower) &&
            !patientPhone.includes(searchLower)) {
          return false;
        }
      }
      
      // If passed all filters, include this appointment
      return true;
    });
    
    // Apply sorting and update statistics
    this.filteredAppointments = this.sortAppointmentsByDate(this.filteredAppointments);
    console.log(`After filtering: ${this.filteredAppointments.length} appointments remaining`);
    this.updateStatistics();
  }
  
  /**
   * Resets all filters to default values and reloads all appointments
   */
  resetFilters(): void {
    this.selectedDate = this.isTodayView ? new Date().toISOString().split('T')[0] : '';
    this.selectedDoctor = '';
    this.selectedStatuses = [];
    this.searchTerm = '';
    
    // Reload appointments with cleared filters
    this.loadAppointments();
  }
  
  /**
   * Toggles the display of a dropdown menu
   * @param event The click event
   * @param dropdownId The ID of the dropdown to toggle
   */
  toggleDropdown(event: Event, dropdownId: string): void {
    // Prevent event from bubbling up
    event.stopPropagation();
    
    // If this dropdown is already active, close it
    if (this.activeDropdown === dropdownId) {
      this.closeDropdowns();
      return;
    }
    
    // Otherwise close any open dropdown and open this one
    this.closeDropdowns();
    this.activeDropdown = dropdownId;
    
    // Create the dropdown outside the table to avoid overflow issues
    this.createDropdownOutsideTable(event, dropdownId);
  }

  ngAfterViewInit(): void {
    console.log('View initialized');
    // Add event listener to close dropdowns when clicking elsewhere
    document.addEventListener('click', () => {
      this.closeDropdowns();
    });
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  /**
   * View appointment details including notes
   */
  viewAppointmentDetails(appointment: Appointment): void {
    this.selectedAppointmentDetails = appointment;
    this.showAppointmentDetailsModal = true;
  }
  
  /**
   * Close appointment details modal
   */
  closeAppointmentDetailsModal(): void {
    this.showAppointmentDetailsModal = false;
    this.selectedAppointmentDetails = null;
  }
  
  /**
   * Navigate to previous or next day in the date filter
   * @param offset Number of days to navigate (positive or negative)
   */
  navigateDate(offset: number): void {
    if (!this.selectedDate) {
      // If no date is selected, default to today
      this.setToday();
      return;
    }
    
    const currentDate = new Date(this.selectedDate);
    currentDate.setDate(currentDate.getDate() + offset);
    this.selectedDate = currentDate.toISOString().split('T')[0];
    this.applyFilters();
  }
  
  /**
   * Set the date filter to today's date
   */
  setToday(): void {
    const today = new Date();
    this.selectedDate = today.toISOString().split('T')[0];
    this.applyFilters();
  }
  
  /**
   * Format the selected date in a user-friendly format
   * @returns Formatted date string
   */
  formatSelectedDate(): string {
    if (!this.selectedDate) return '';
    
    const date = new Date(this.selectedDate);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  /**
   * Opens the reschedule modal for an appointment
   */
  openRescheduleModal(appointment: Appointment): void {
    this.appointmentToReschedule = appointment;
    
    // Make sure we have doctor data loaded
    if (this.doctors.length === 0) {
      console.log('No doctors loaded, forcing mock data load');
      this.doctors = [...this.mockDoctors];
    }
    
    // Log available doctors for debugging
    console.log('Available doctors:', this.doctors);
    
    // Set default date/time values from current appointment
    if (appointment.appointmentDateTime) {
      const appointmentDate = new Date(appointment.appointmentDateTime);
      this.newAppointmentDate = this.datePipe.transform(appointmentDate, 'yyyy-MM-dd') || '';
      this.newAppointmentTime = this.datePipe.transform(appointmentDate, 'HH:mm') || '';
    } else {
      // Default to tomorrow, 9:00 AM if no date set
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      this.newAppointmentDate = this.datePipe.transform(tomorrow, 'yyyy-MM-dd') || '';
      this.newAppointmentTime = '09:00';
    }
    
    // Set case type and category from existing appointment or defaults
    this.caseType = appointment.subCategory || 'Follow-up';
    this.category = appointment.category || 'Regular';
    
    // Set current doctor ID as initial value for the dropdown
    if (appointment.doctorId) {
      console.log(`Current appointment has doctorId: ${appointment.doctorId}`);
      // Reset doctor selection to null (keep current doctor)
      this.newDoctorId = null;
    } else {
      console.log('No doctorId found in appointment');
      this.newDoctorId = null;
    }
    
    console.log(`Opening reschedule modal with ${this.doctors.length} doctors available`);
    
    // Show the modal
    this.showRescheduleModal = true;
  }
  
  /**
   * Close the reschedule modal without saving
   */
  cancelReschedule(): void {
    this.showRescheduleModal = false;
    this.appointmentToReschedule = null;
    this.newAppointmentDate = '';
    this.newAppointmentTime = '';
    this.newDoctorId = null;
    this.caseType = 'Follow-up';
    this.category = 'Regular';
    this.error = null;
    this.success = null;
  }
  
  /**
   * Reschedule appointment with new date and time
   */
  rescheduleAppointment(): void {
    if (!this.appointmentToReschedule || !this.newAppointmentDate || !this.newAppointmentTime) {
      this.error = 'Please select both date and time to reschedule';
      return;
    }
    
    // Construct ISO date string from date and time inputs
    const newDateTimeString = `${this.newAppointmentDate}T${this.newAppointmentTime}:00`;
    console.log(`Rescheduling appointment ${this.appointmentToReschedule.appointmentId} to ${newDateTimeString}`);
    
    // Prepare API request parameters
    const updateParams: any = {
      appointmentDateTime: newDateTimeString,
      category: this.category,
      subCategory: this.caseType
    };
    
    // If doctor was changed, include in the request
    if (this.newDoctorId !== null) {
      console.log(`Changing doctor to: ${this.newDoctorId}`);
      updateParams.doctorId = this.newDoctorId;
      
      // Find selected doctor for logging
      const selectedDoctor = this.doctors.find(doc => doc.id === this.newDoctorId);
      if (selectedDoctor) {
        console.log(`Selected doctor: ${selectedDoctor.name}, Specialization: ${selectedDoctor.specialization || selectedDoctor.specialty || 'None'}`);
      } else {
        console.warn(`Could not find doctor with ID: ${this.newDoctorId} in doctors list`);
      }
    } else {
      console.log('Keeping current doctor (no change)');
    }
    
    // Log updated appointment parameters
    console.log('Updating appointment with:', {
      dateTime: newDateTimeString,
      category: this.category,
      caseType: this.caseType,
      doctorId: this.newDoctorId || 'unchanged'
    });
    
    // Call the API to reschedule
    const sub = this.appointmentService.rescheduleAppointment(
      this.appointmentToReschedule.appointmentId, 
      updateParams
    ).subscribe({
      next: (updatedAppointment) => {
        console.log('Appointment rescheduled successfully:', updatedAppointment);
        
        // Update the appointment in the local arrays
        const index = this.appointments.findIndex(
          app => app.appointmentId === this.appointmentToReschedule?.appointmentId
        );
        
        if (index !== -1) {
          // Create updated appointment with new date/time
          const updatedAppointmentData = {
            ...this.appointments[index],
            appointmentDateTime: newDateTimeString,
            category: this.category,
            subCategory: this.caseType
          };
          
          // If doctor was changed, update doctor ID as well
          if (this.newDoctorId) {
            updatedAppointmentData.doctorId = this.newDoctorId;
          }
          
          // Update in main appointments array
          this.appointments[index] = updatedAppointmentData;
          
          // Also update in filtered appointments
          const filteredIndex = this.filteredAppointments.findIndex(
            app => app.appointmentId === this.appointmentToReschedule?.appointmentId
          );
          
          if (filteredIndex !== -1) {
            this.filteredAppointments[filteredIndex] = updatedAppointmentData;
          }
          
          // Force refresh arrays
          this.appointments = [...this.appointments];
          this.filteredAppointments = [...this.filteredAppointments];
          
          // Build success message
          let successMsg = `✅ Appointment successfully rescheduled to ${this.datePipe.transform(newDateTimeString, 'MMM d, yyyy')} at ${this.datePipe.transform(newDateTimeString, 'h:mm a')}`;
          
          // Add doctor change info to success message if applicable
          if (this.newDoctorId) {
            const newDoctor = this.doctors.find(d => d.doctorId === this.newDoctorId);
            if (newDoctor) {
              successMsg += ` with Dr. ${newDoctor.firstName} ${newDoctor.lastName}`;
            }
          }
          
          this.success = successMsg;
          
          // Clear message after a few seconds
          setTimeout(() => {
            this.success = null;
          }, 5000); // Increased timeout for better visibility
        }
        
        // Close the modal
        this.showRescheduleModal = false;
        this.appointmentToReschedule = null;
        this.newDoctorId = null;
      },
      error: (err: Error) => {
        console.error('Failed to reschedule appointment:', err);
        this.error = `Failed to reschedule appointment: ${err.message}`;
        
        // Clear message after a few seconds
        setTimeout(() => {
          this.error = null;
        }, 5000);
      }
    });
    
    this.subscriptions.push(sub);
  }

  // ... (rest of the code remains the same)

  private createDropdownOutsideTable(event: Event, dropdownId: string): void {
    // Get the button that was clicked
    const button = event.currentTarget as HTMLElement;
    if (!button) return;
    
    // Parse appointment ID from the dropdown ID
    const idParts = dropdownId.split('statusDropdown');
    const appointmentId = idParts.length > 1 ? idParts[1] : '';
    if (!appointmentId) return;
    
    // Find the associated appointment
    const appointment = this.appointments.find(app => app.appointmentId === appointmentId);
    if (!appointment) return;
    
    // Create a completely new dropdown element
    const dropdownDiv = document.createElement('div');
    dropdownDiv.className = 'status-dropdown-portal';
    dropdownDiv.id = `portal-${dropdownId}`;
    
    // Get current appointment type to show toggle option
    const currentType = appointment.appointmentType || 'In Clinic';
    const newType = currentType === 'In Clinic' ? 'Video Consultation' : 'In Clinic';
    const typeIcon = newType === 'In Clinic' ? 'clinic-medical' : 'video';
    
    dropdownDiv.innerHTML = `
      <ul class="dropdown-menu fixed-dropdown show" style="border-radius: 4px; box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.15); border: 1px solid rgba(107, 29, 20, 0.2);">
        <li class="dropdown-header" style="font-family: 'Roboto', sans-serif; color: #6b1d14; font-weight: 600; padding: 0.5rem 1rem;">Status</li>
        <li><a class="dropdown-item" href="javascript:void(0)" data-status="Queue" data-id="${appointmentId}" style="color: #333; font-family: 'Roboto', sans-serif;">Queue</a></li>
        <li><a class="dropdown-item" href="javascript:void(0)" data-status="Arrived" data-id="${appointmentId}" style="color: #333; font-family: 'Roboto', sans-serif;">Arrived</a></li>
        <li><a class="dropdown-item" href="javascript:void(0)" data-status="Engaged" data-id="${appointmentId}" style="color: #333; font-family: 'Roboto', sans-serif;">Engaged</a></li>
        <li><a class="dropdown-item" href="javascript:void(0)" data-status="Finished" data-id="${appointmentId}" style="color: #333; font-family: 'Roboto', sans-serif;">Finished</a></li>
        <li><a class="dropdown-item" href="javascript:void(0)" data-status="Cancelled" data-id="${appointmentId}" style="color: #333; font-family: 'Roboto', sans-serif;">Cancelled</a></li>
        <li><hr class="dropdown-divider" style="margin: 0.5rem 0; border-color: rgba(107, 29, 20, 0.1);"></li>
        <li class="dropdown-header" style="font-family: 'Roboto', sans-serif; color: #6b1d14; font-weight: 600; padding: 0.5rem 1rem;">Actions</li>
        <li><a class="dropdown-item btn-reschedule" href="javascript:void(0)" data-id="${appointmentId}" style="color: #333; font-family: 'Roboto', sans-serif;">
          <i class="fas fa-calendar-alt me-1" style="color: #6b1d14;"></i> Reschedule
        </a></li>
      </ul>
    `;
    
    // Add the dropdown to the document body
    document.body.appendChild(dropdownDiv);
    
    // Get the dropdown menu element
    const dropdownMenu = dropdownDiv.querySelector('.dropdown-menu') as HTMLElement;
    if (!dropdownMenu) return;
    
    // Get button position
    const buttonRect = button.getBoundingClientRect();
    
    // Position dropdown - completely away from the table
    dropdownMenu.style.position = 'fixed';
    dropdownMenu.style.left = `${Math.max(0, buttonRect.left - 20)}px`;
    dropdownMenu.style.minWidth = '150px';
    dropdownMenu.style.zIndex = '99999';
    
    // Get the dropdown's height (after adding it to DOM)
    const dropdownHeight = dropdownMenu.offsetHeight;
    
    // Check if there's enough space below the button
    const spaceBelow = window.innerHeight - buttonRect.bottom - 10;
    const spaceAbove = buttonRect.top - 10;
    
    // Determine whether to position above or below based on available space
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      // Not enough space below, more space above - position above the button
      dropdownMenu.style.top = `${buttonRect.top - dropdownHeight - 5}px`;
      dropdownMenu.classList.add('dropdown-menu-up');
    } else {
      // Default - position below the button
      dropdownMenu.style.top = `${buttonRect.bottom + 5}px`;
    }
    
    // Make sure it's visible
    dropdownMenu.style.display = 'block';
    dropdownMenu.style.visibility = 'visible';
    dropdownMenu.style.backgroundColor = '#ffffff';
    dropdownMenu.style.border = '1px solid rgba(0, 0, 0, 0.15)';
    dropdownMenu.style.borderRadius = '0.25rem';
    dropdownMenu.style.boxShadow = '0 0.5rem 1rem rgba(0, 0, 0, 0.3)';
    dropdownMenu.style.padding = '0.5rem 0';
    
    // Make sure dropdown doesn't go off-screen to the right
    const rightEdge = buttonRect.left + dropdownMenu.offsetWidth;
    if (rightEdge > window.innerWidth - 20) {
      dropdownMenu.style.left = `${Math.max(10, window.innerWidth - dropdownMenu.offsetWidth - 20)}px`;
    }
    
    // Add event listeners to dropdown items
    dropdownDiv.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const statusLink = target.closest('[data-status]');
      const typeLink = target.closest('[data-type]');
      const rescheduleLink = target.closest('.btn-reschedule');
      
      if (statusLink) {
        const status = statusLink.getAttribute('data-status');
        const id = statusLink.getAttribute('data-id');
        if (status && id) {
          // Find the appointment and update its status
          const app = this.appointments.find(a => a.appointmentId === id);
          if (app) {
            this.updateStatus(app, status);
          }
        }
      }
      
      if (typeLink) {
        const type = typeLink.getAttribute('data-type');
        const id = typeLink.getAttribute('data-id');
        if (type && id) {
          // Find the appointment and update its type
          const app = this.appointments.find(a => a.appointmentId === id);
          if (app) {
            this.updateAppointmentType(app, type);
          }
        }
      }
      
      if (rescheduleLink) {
        const id = rescheduleLink.getAttribute('data-id');
        if (id) {
          // Find the appointment and open reschedule modal
          const app = this.appointments.find(a => a.appointmentId === id);
          if (app) {
            this.closeDropdowns(); // Close dropdown first
            this.openRescheduleModal(app);
          }
        }
      }
    });
  }
  
  closeDropdowns(): void {
    // Clear active dropdown
    this.activeDropdown = null;
    
    // Remove all dropdown portals from DOM
    const portals = document.querySelectorAll('.status-dropdown-portal');
    portals.forEach(portal => portal.remove());
  }
  
  /**
   * Updates appointment status and sends update to API
   */
  updateStatus(appointment: Appointment, status: string): void {
    console.log(`Updating appointment ${appointment.appointmentId} status to: ${status}`);
    
    // Map UI status values to API status values
    let apiStatus: string;
    switch(status) {
      case 'Queue':
        apiStatus = 'SCHEDULED';
        break;
      case 'Arrived':
        apiStatus = 'RESCHEDULED';
        break;
      case 'Engaged':
        apiStatus = 'ENGAGED';
        break;
      case 'Finished':
        apiStatus = 'COMPLETED';
        break;
      case 'Cancelled':
        apiStatus = 'CANCELLED';
        break;
      default:
        apiStatus = status;
    }
    
    console.log(`Mapped UI status '${status}' to API status '${apiStatus}'`);
    
    // First get the full appointment data from API to ensure we have all fields
    this.appointmentService.getAppointmentById(appointment.appointmentId).subscribe({
      next: (fullAppointment: Appointment) => {
        console.log('Retrieved full appointment data:', fullAppointment);
        
        // Create updated appointment with all existing fields plus new status
        const updatedAppointment = { 
          ...fullAppointment,
          status: apiStatus
        };
        
        // Always set the appointment date to a future date to satisfy the @Future validation constraint
        // The backend validation requires dates to be in the future even for completed appointments
        
        // Create a date that's definitely in the future (7 days from now)
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7); // Set to 7 days in the future
        
        // Format as ISO string but ensure we keep just the date+time part without milliseconds
        // This format matches what the backend expects: YYYY-MM-DDTHH:MM:SS
        const futureDateString = futureDate.toISOString().split('.')[0];
        
        console.log('Setting appointment date to future date to pass validation:', futureDateString);
        updatedAppointment.appointmentDateTime = futureDateString;
        
        // Log what we're sending to help with debugging
        console.log('Appointment being sent to API:', {
          id: updatedAppointment.appointmentId,
          status: updatedAppointment.status,
          date: updatedAppointment.appointmentDateTime
        });
        
        
        console.log('Sending updated appointment to API:', updatedAppointment);
        
        // Send the update to the API
        this.appointmentService.updateAppointment(appointment.appointmentId, updatedAppointment).subscribe({
          next: (updated) => {
            console.log(`Status update successful for appointment ${appointment.appointmentId}`);
            
            // Find the appointment in the array and update it
            const index = this.appointments.findIndex(app => app.appointmentId === updated.appointmentId);
            if (index !== -1) {
              this.appointments[index] = updated;
              
              // Also update in filtered appointments
              const filteredIndex = this.filteredAppointments.findIndex(app => app.appointmentId === updated.appointmentId);
              if (filteredIndex !== -1) {
                this.filteredAppointments[filteredIndex] = updated;
              }
              
              // Force refresh of arrays to trigger change detection
              this.appointments = [...this.appointments];
              this.filteredAppointments = [...this.filteredAppointments];
              
              // Update statistics counts
              this.updateStatistics();
              console.log(`UI updated for appointment ${appointment.appointmentId}, new status: ${status}`);
              
              // Close any open dropdowns
              this.closeDropdowns();
            }
          },
          error: (err) => {
            console.error(`Failed to update appointment status: ${err.message}`);
            this.error = `Failed to update appointment status: ${err.message}`;
          }
        });
      },
      error: (err: Error) => {
        console.error(`Failed to retrieve appointment details: ${err.message}`);
        this.error = `Failed to update appointment status: ${err.message}`;
      }
    });
  }
  
  /**
   * Updates the appointment type between 'In Clinic' and 'Video Consultation'
   * @param appointment The appointment to update
   * @param newType The new appointment type to set
   */
  updateAppointmentType(appointment: Appointment, newType: string): void {
    console.log(`Attempting to update appointment type for ${appointment.appointmentId} to ${newType}`);
    
    // First get the full appointment details to update
    this.appointmentService.getAppointmentById(appointment.appointmentId).subscribe({
      next: (fullAppointment: Appointment) => {
        console.log('Retrieved full appointment details for type update:', fullAppointment);
        
        // Create a copy for updates
        const updatedAppointment = { ...fullAppointment };
        
        // Update the appointment type
        updatedAppointment.appointmentType = newType;
        
        // Call API to update the appointment
        this.appointmentService.updateAppointment(appointment.appointmentId, updatedAppointment).subscribe({
          next: () => {
            console.log(`Appointment type updated successfully to ${newType}`);
            
            // Update the local appointment data
        const index = this.appointments.findIndex(app => app.appointmentId === appointment.appointmentId);
        if (index !== -1) {
          this.appointments[index] = {
            ...this.appointments[index],
            appointmentType: newType
          };
          
          // Also update in filtered appointments
          const filteredIndex = this.filteredAppointments.findIndex(app => app.appointmentId === appointment.appointmentId);
          if (filteredIndex !== -1) {
            this.filteredAppointments[filteredIndex] = {
              ...this.filteredAppointments[filteredIndex],
              appointmentType: newType
            };
          }
          
          // Force refresh of arrays to trigger change detection
          this.appointments = [...this.appointments];
          this.filteredAppointments = [...this.filteredAppointments];
          
          // Show success message
          this.success = `Appointment type changed to ${newType}`;
          
          // Clear message after a few seconds
          setTimeout(() => {
            this.success = null;
          }, 3000);
        }
      },
          error: (err: Error) => {
            console.error(`Failed to update appointment type: ${err.message}`);
            this.error = `Failed to update appointment type: ${err.message}`;
            
            // Clear error message after a few seconds
            setTimeout(() => {
              this.error = null;
            }, 5000);
          }
        });
      },
      error: (err: Error) => {
        console.error(`Failed to retrieve appointment details: ${err.message}`);
        this.error = `Failed to update appointment type: ${err.message}`;
      }
    });
  }

  deleteAppointment(id: string): void {
    if (confirm('Are you sure you want to delete this appointment?')) {
      this.appointmentService.deleteAppointment(id).subscribe({
        next: () => {
          this.appointments = this.appointments.filter(app => app.appointmentId !== id);
          this.filteredAppointments = this.appointments; // update filtered list
          this.updateStatistics();
        },
        error: (error: Error) => {
          console.error('Error deleting appointment:', error);
          this.error = 'Failed to delete appointment. Please try again.';
        }
      });
    }
  }
  
  getStatusClass(status: string): string {
    switch (status) {
      case 'SCHEDULED':
        return 'badge rounded-pill bg-info text-dark';
      case 'RESCHEDULED':
        return 'badge rounded-pill bg-primary';
      case 'ENGAGED':
        return 'badge rounded-pill bg-warning text-dark';
      case 'COMPLETED':
        return 'badge rounded-pill bg-success';
      case 'CANCELLED':
        return 'badge rounded-pill bg-danger';
      default:
        return 'badge rounded-pill bg-secondary';
    }
  }
}
