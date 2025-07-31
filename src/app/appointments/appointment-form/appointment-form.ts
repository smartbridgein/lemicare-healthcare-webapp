import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AppointmentService } from '../shared/appointment';
import { Appointment, AppointmentStatus, Doctor } from '../shared/appointment.model';
import { AppointmentSuccessModalComponent } from '../appointment-success-modal/appointment-success-modal';
import { AlreadyBookedModalComponent } from '../already-booked-modal/already-booked-modal';
import { finalize, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { PatientService } from '../../patients/shared/patient.service';
import { ErrorToastComponent } from '../../shared/toast/error-toast.component';

// Define interfaces to support both legacy and API data structures

// No longer need ExtendedDoctor since the base Doctor interface has been updated
// to be compatible with API structure
type ExtendedDoctor = Doctor;

// Extended Patient interface for flexibility
interface Patient {
  // Support both legacy and new API structure
  id?: string;
  patientId?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  dateOfBirth?: string;
  gender?: string;
  identifier?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  bloodGroup?: string | null;
  allergies?: string | null;
  medicalHistory?: string | null;
  active?: boolean;
}

@Component({
  selector: 'app-appointment-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    AppointmentSuccessModalComponent,
    AlreadyBookedModalComponent
  ],
  templateUrl: './appointment-form.html',
  styleUrl: './appointment-form.scss'
})
export class AppointmentFormComponent implements OnInit, AfterViewInit {
  appointmentForm: FormGroup;
  doctors: ExtendedDoctor[] = []; // Ensure this is always an array
  isEdit: boolean = false;
  appointmentId: string | null = null;
  isSubmitting: boolean = false;
  // Error and success messages
  error: string | null = null;
  success: string | null = null;
  
  // Section references for collapsible form sections
  @ViewChild('patientSection') patientSection!: ElementRef;
  @ViewChild('appointmentTypeSection') appointmentTypeSection!: ElementRef;
  @ViewChild('dateTimeSection') dateTimeSection!: ElementRef;
  @ViewChild('notesSection') notesSection!: ElementRef;
  
  // Toast error handling
  showErrorToast: boolean = false;
  toastErrorMessage: string = '';
  patientSearchResults: Patient[] = []; // Ensure this is always an array
  isSearchingPatient: boolean = false;
  minDate: string = this.getCurrentDate(); // Add minDate property for template

  // Reference to our modal components
  @ViewChild(AppointmentSuccessModalComponent) successModal!: AppointmentSuccessModalComponent;
  @ViewChild(AlreadyBookedModalComponent) alreadyBookedModal!: AlreadyBookedModalComponent;
  
  // Properties for success modal
  showSuccessModal: boolean = false;
  successModalData: {
    patientName: string;
    appointmentDate: string;
    appointmentTime: string;
    doctorName: string;
  } = {
    patientName: '',
    appointmentDate: '',
    appointmentTime: '',
    doctorName: ''
  };
  
  // Properties for already booked modal
  showAlreadyBookedModal: boolean = false;
  alreadyBookedData: {
    appointmentTime: string;
    doctorName: string;
  } = {
    appointmentTime: '',
    doctorName: ''
  };

  /**
   * Closes the time picker by blurring the input element
   * @param event The change event from the time input
   */
  closeTimePicker(event: Event): void {
    if (event.target) {
      (event.target as HTMLInputElement).blur();
    }
  }

  /**
   * Gets today's date as a string in YYYY-MM-DD format for min attribute
   * Uses local timezone to avoid timezone-related date calculation issues
   */
  public getCurrentDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  /**
   * Gets the current time in HH:MM format for min attribute
   */
  private getCurrentTime(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  /**
   * Validates if the selected date and time are in the future
   * @returns boolean indicating if the date/time is valid
   */
  private isDateTimeValid(): boolean {
    const appointmentDate = this.appointmentForm.get('appointmentDate')?.value;
    const appointmentTime = this.appointmentForm.get('appointmentTime')?.value;
    
    if (!appointmentDate || !appointmentTime) {
      return false;
    }
    
    const now = new Date();
    const selectedDateTime = new Date(`${appointmentDate}T${appointmentTime}:00`);
    
    return selectedDateTime > now;
  }
  
  /**
   * Calculates age from date of birth
   * @param dateOfBirth Date of birth as string in format YYYY-MM-DD
   * @returns Calculated age in years
   */
  calculateAge(dateOfBirth: string): number {
    if (!dateOfBirth) return 0;
    
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // If birthday hasn't occurred this year yet, subtract 1
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  constructor(
    private fb: FormBuilder,
    private appointmentService: AppointmentService,
    private route: ActivatedRoute,
    private router: Router,
    private patientService: PatientService
  ) {
    // Initialize form with fields that match our data model
    this.appointmentForm = this.fb.group({
      patientId: ['', Validators.required],
      firstName: [''],
      lastName: [''],
      patientIdentifier: [''],
      dateOfBirth: [''],
      patientAge: [''],
      gender: [''],
      appointmentType: ['IN_CLINIC'], // Default appointment type set to In Clinic
      appointmentDate: [this.getCurrentDate(), Validators.required],
      appointmentTime: [this.getCurrentTime(), Validators.required],
      doctorId: ['', Validators.required],
      status: ['Queue'], // Changed default status to Queue
      notes: [''],
      subCategory: ['New'],
      category: ['Regular']
    });
  }

  ngOnInit(): void {
    this.loadDoctors();

    // Check if we're in edit mode
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.appointmentId = id;
      // Only load if we have a non-null ID
      this.loadAppointment(id);
    }
    
    // Add listener for date changes to update time validation
    this.appointmentForm.get('appointmentDate')?.valueChanges.subscribe(date => {
      this.validateTimeBasedOnDate(date);
    });
    
    // Add form control change listeners to update section states
    this.setupFormControlListeners();
  }
  
  /**
   * Implement AfterViewInit to handle section visibility and validation after view is initialized
   */
  ngAfterViewInit(): void {
    // Initial section states setup
    setTimeout(() => {
      this.updateSectionStates();
    });
  }
  
  /**
   * Sets up listeners for form control changes to update section states
   */
  private setupFormControlListeners(): void {
    // Patient section controls
    const patientControls = ['patientId', 'firstName', 'lastName'];
    patientControls.forEach(controlName => {
      this.appointmentForm.get(controlName)?.valueChanges.subscribe(() => {
        this.updateSectionStates();
      });
    });
    
    // Appointment type section controls
    const typeControls = ['appointmentType', 'doctorId'];
    typeControls.forEach(controlName => {
      this.appointmentForm.get(controlName)?.valueChanges.subscribe(() => {
        this.updateSectionStates();
      });
    });
    
    // Date/time section controls
    const dateTimeControls = ['appointmentDate', 'appointmentTime'];
    dateTimeControls.forEach(controlName => {
      this.appointmentForm.get(controlName)?.valueChanges.subscribe(() => {
        this.updateSectionStates();
      });
    });
  }
  
  /**
   * Updates the enabled/disabled and expanded/collapsed states of all form sections
   */
  updateSectionStates(): void {
    // Patient section is always enabled and expanded by default
    this.setPatientSectionState();
    
    // Type section depends on patient section validity
    this.setAppointmentTypeSectionState();
    
    // Date/time section depends on type section validity
    this.setDateTimeSectionState();
    
    // Notes section depends on date/time section validity
    this.setNotesSectionState();
  }
  
  /**
   * Checks if the patient section form controls are valid
   */
  isPatientSectionValid(): boolean {
    return this.appointmentForm.get('patientId')?.valid ?? false;
  }
  
  /**
   * Checks if the appointment type section form controls are valid
   */
  isAppointmentTypeSectionValid(): boolean {
    const appointmentType = this.appointmentForm.get('appointmentType');
    const doctorId = this.appointmentForm.get('doctorId');
    return (appointmentType?.valid && doctorId?.valid) ?? false;
  }
  
  /**
   * Checks if the date/time section form controls are valid
   */
  isDateTimeSectionValid(): boolean {
    const date = this.appointmentForm.get('appointmentDate');
    const time = this.appointmentForm.get('appointmentTime');
    return (date?.valid && time?.valid && this.isDateTimeValid()) ?? false;
  }
  
  /**
   * Sets the patient section state (always enabled)
   */
  setPatientSectionState(): void {
    const element = this.patientSection?.nativeElement;
    if (element) {
      // Patient section is always enabled and expanded by default
      element.classList.remove('disabled-section');
      element.classList.add('expanded');
    }
  }
  
  /**
   * Sets the appointment type section state based on patient section validity
   */
  setAppointmentTypeSectionState(): void {
    const element = this.appointmentTypeSection?.nativeElement;
    if (element) {
      if (this.isPatientSectionValid()) {
        // Enable this section if patient section is valid
        element.classList.remove('disabled-section');
      } else {
        // Disable and collapse this section if patient section is invalid
        element.classList.add('disabled-section');
        element.classList.remove('expanded');
      }
    }
  }
  
  /**
   * Sets the date/time section state based on appointment type section validity
   */
  setDateTimeSectionState(): void {
    const element = this.dateTimeSection?.nativeElement;
    if (element) {
      if (this.isPatientSectionValid() && this.isAppointmentTypeSectionValid()) {
        // Enable this section if previous sections are valid
        element.classList.remove('disabled-section');
      } else {
        // Disable and collapse this section if previous sections are invalid
        element.classList.add('disabled-section');
        element.classList.remove('expanded');
      }
    }
  }
  
  /**
   * Sets the notes section state based on date/time section validity
   */
  setNotesSectionState(): void {
    const element = this.notesSection?.nativeElement;
    if (element) {
      if (this.isPatientSectionValid() && this.isAppointmentTypeSectionValid() && this.isDateTimeSectionValid()) {
        // Enable this section if previous sections are valid
        element.classList.remove('disabled-section');
      } else {
        // Disable and collapse this section if previous sections are invalid
        element.classList.add('disabled-section');
        element.classList.remove('expanded');
      }
    }
  }
  
  /**
   * Toggles a form section's expanded state if it's not disabled
   * @param sectionElement The section element to toggle
   */
  toggleSection(sectionElement: HTMLElement): void {
    // Don't toggle disabled sections
    if (sectionElement.classList.contains('disabled-section')) {
      return;
    }
    
    // Toggle expanded class
    sectionElement.classList.toggle('expanded');
  }
  
  /**
   * Validates and updates time input based on selected date
   * If selected date is today, time must be greater than current time
   */
  validateTimeBasedOnDate(selectedDate: string): void {
    const today = this.getCurrentDate();
    const currentTimeControl = this.appointmentForm.get('appointmentTime');
    const currentTimeValue = currentTimeControl?.value;
    
    if (selectedDate === today) {
      // If date is today, validate that time is later than current time
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;
      
      // If time is earlier than current time, reset to current time
      if (currentTimeValue < currentTimeStr) {
        currentTimeControl?.setValue(this.getCurrentTime());
      }
    }
  }

  loadDoctors(): void {
    this.appointmentService.getDoctors().subscribe({
      next: (data: any) => {
        // Ensure doctors is always an array
        if (data && Array.isArray(data)) {
          this.doctors = data;
        } else if (data && typeof data === 'object' && !Array.isArray(data)) {
          console.warn('Received non-array doctors data:', data);
          // If we received an object with data property that is an array
          if (data.data && Array.isArray(data.data)) {
            this.doctors = data.data;
          } else {
            // Default to empty array if data structure is unexpected
            this.doctors = [];
          }
        } else {
          this.doctors = [];
        }
        console.log('Doctors loaded:', this.doctors);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error loading doctors:', err);
        this.error = 'Failed to load doctors. Please try again.';
      }
    });
  }

  loadAppointment(id: string): void {
    // Make sure id is not null before making API call
    if (id) {
      this.appointmentService.getAppointment(id).subscribe({
        next: (appointment: Appointment) => {
          this.appointmentForm.patchValue(appointment);
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error saving appointment:', err);
          
          // Handle specific error types
          if (err.error && typeof err.error === 'object') {
            // Check for doctor availability error
            if (err.error.message === 'Doctor is not available at the requested time') {
              this.error = 'The selected doctor is not available at this time. Please choose another time slot or doctor.';
            } 
            // Check for patient not found error
            else if (err.error.message && err.error.message.includes('Patient not found')) {
              this.error = 'Patient not found with the provided ID. Please select a valid patient.';
            }
            // Check for other specific error messages
            else if (err.error.message) {
              this.error = err.error.message;
            } 
            else {
              this.error = 'Failed to save appointment. Please try again.';
            }
          } else {
            this.error = 'Failed to save appointment. Please try again.';
          }
        }
      });
    }
  }

  searchPatient(event: Event): void {
    // Guard against null event object
    if (!event || !event.target) {
      return;
    }
    
    const inputElement = event.target as HTMLInputElement;
    const searchTerm = inputElement.value.toLowerCase().trim();
    
    if (searchTerm.length < 3) {
      this.patientSearchResults = [];
      return;
    }

    this.isSearchingPatient = true;
    console.log('Searching for patient with term:', searchTerm);

    // Ensure patientSearchResults is initialized as an empty array
    this.patientSearchResults = [];
    
    // Use the PatientService to search for patients
    this.patientService.searchPatients(searchTerm).subscribe({
      next: (patients) => {
        // Filter patients based on the search term since backend may not filter correctly
        const filteredPatients = Array.isArray(patients) ? patients.filter(patient => {
          const firstName = (patient.firstName || '').toLowerCase();
          const lastName = (patient.lastName || '').toLowerCase();
          const fullName = `${firstName} ${lastName}`.toLowerCase();
          const patientId = (patient.id || patient.patientId || '').toLowerCase();
          
          return fullName.includes(searchTerm) || 
                 firstName.includes(searchTerm) || 
                 lastName.includes(searchTerm) || 
                 patientId.includes(searchTerm);
        }) : [];
        
        this.patientSearchResults = filteredPatients;
        console.log('Filtered patient search results:', this.patientSearchResults);
        this.isSearchingPatient = false;
      },
      error: (err) => {
        console.error('Error searching for patients:', err);
        this.error = 'Failed to search for patients. Please try again.';
        this.isSearchingPatient = false;
        this.patientSearchResults = [];
      }
    });
  }

  /**
   * Select a patient from search results and populate form fields
   * @param patient The selected patient object
   */
  selectPatient(patient: Patient): void {
    console.log('Patient selected:', patient);
    
    // Determine the patient ID - now primarily using id from API
    const patId = patient.id || patient.patientId || '';
    
    // Determine first name and last name
    let fName = '';
    let lName = '';
    
    // With the new API structure, we primarily have a combined name field
    if (patient.name) {
      const nameParts = patient.name.split(' ');
      fName = nameParts[0] || '';
      lName = nameParts.slice(1).join(' ') || '';
    } else {
      // Fall back to firstName/lastName fields if available
      fName = patient.firstName || '';
      lName = patient.lastName || '';
    }
    
    // Calculate patient's age if date of birth is available
    const age = patient.dateOfBirth ? this.calculateAge(patient.dateOfBirth) : '';
    
    // Update the form with patient details
    this.appointmentForm.patchValue({
      patientId: patId,
      firstName: fName,
      lastName: lName,
      patientIdentifier: patient.identifier || patient.patientId || patId,
      dateOfBirth: patient.dateOfBirth || '',
      patientAge: age ? `${age} years` : '',
      gender: patient.gender || ''
    });
    
    // Log the form values after updating
    console.log('Updated form values:', this.appointmentForm.value);
    
    // Clear search results after selection
    this.patientSearchResults = [];
  }

  selectDoctor(event: Event): void {
    const inputElement = event.target as HTMLSelectElement;
    const doctorIdValue = inputElement.value;
    
    if (!doctorIdValue) {
      return; // No selection made
    }
    
    // Find doctor by either id or doctorId property
    const selectedDoctor = this.doctors.find(doc => 
      (doc.id && doc.id === doctorIdValue) || (doc.doctorId && doc.doctorId === doctorIdValue)
    );

    console.log('Selected doctor:', selectedDoctor);
    console.log('Doctor ID value:', doctorIdValue);
    
    // Always update the form with the selected value from the dropdown
    // This ensures the form gets updated regardless of the doctor object structure
    this.appointmentForm.patchValue({
      doctorId: doctorIdValue
    });
    
    console.log('Form updated with doctorId:', this.appointmentForm.get('doctorId')?.value);
  }

  onSubmit(): void {
    if (this.appointmentForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.appointmentForm.controls).forEach(key => {
        const control = this.appointmentForm.get(key);
        control?.markAsTouched();
      });
      return;
    }
    
    // Validate that the selected date and time are in the future
    if (!this.isDateTimeValid()) {
      this.error = 'Appointment time must be in the future. Please select a future date and time.';
      // Mark the date and time fields as touched to highlight the error
      this.appointmentForm.get('appointmentDate')?.markAsTouched();
      this.appointmentForm.get('appointmentTime')?.markAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.error = null;
    this.success = null;

    const formData = this.appointmentForm.value;

    // Log form data to debug date/time issues
    console.log('Form data before submission:', formData);
    console.log('Selected date:', formData.appointmentDate);
    console.log('Selected time:', formData.appointmentTime);
  
    // Create appointment object from form data
    const appointmentData: Appointment = {
      appointmentId: this.isEdit && this.appointmentId ? this.appointmentId : '', // Will be set by backend for new appointments
      patientId: formData.patientId,
      doctorId: formData.doctorId,
      appointmentDateTime: `${formData.appointmentDate}T${formData.appointmentTime}:00`,
      appointmentType: formData.appointmentType || 'In Clinic', // Include appointment type from the radio buttons
      status: formData.status || 'Queue', // Default to Queue if not set
      category: formData.category || 'Regular',
      subCategory: formData.subCategory || 'New',
      notes: formData.notes || '',
      patientLatitude: null,
      patientLongitude: null,
      doctorLatitude: null,
      doctorLongitude: null
    };

    // First check for one-appointment-per-day restriction
    this.checkPatientAppointmentOnDate(appointmentData).then((hasAppointmentOnDate: boolean) => {
      if (hasAppointmentOnDate) {
        this.isSubmitting = false;
        this.error = 'You already have an appointment scheduled for this date. Only one appointment per day is allowed. Please select a different date.';
        return;
      }
      
      // Then check for duplicate appointments (same time slot)
      this.checkDuplicateAppointment(appointmentData).then(isDuplicate => {
        if (isDuplicate) {
          this.isSubmitting = false;
          
          // Show already booked modal instead of error message
          // Extract time from appointmentDateTime for display (e.g., "07:34 PM")
          const appointmentDateTime = appointmentData.appointmentDateTime || '';
          const timeObj = new Date(appointmentDateTime);
          const formattedTime = timeObj.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
          
          // In a real app, we'd fetch patient and doctor details from backend
          // For now, use placeholders or fetch from our lists
          let patientName = 'Patient';
          let doctorName = 'Doctor';
          
          // Try to get doctor name from our doctors list
          const doctor = this.doctors.find(doc => doc.doctorId === appointmentData.doctorId);
          if (doctor) {
            doctorName = doctor.name;
          }
          
          this.alreadyBookedData = {
            appointmentTime: formattedTime,
            doctorName
          };
          
          this.showAlreadyBookedModal = true;
          return;
        }

      // Continue with saving if no duplicate
      const saveOperation = this.isEdit ?
        this.appointmentService.updateAppointment(appointmentData) :
        this.appointmentService.createAppointment(appointmentData);

      saveOperation.pipe(
        finalize(() => this.isSubmitting = false)
      ).subscribe({
        next: (response: Appointment) => {
          if (this.isEdit) {
            this.success = 'Appointment updated successfully';
            setTimeout(() => {
              // Navigate to appointment list after successful update
              this.router.navigate(['/appointments']);
            }, 1000);
          } else {
            // Show success modal for new appointments
            this.displaySuccessModal(response);
          }
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error saving appointment:', err);
          
          // Check for specific error types from backend
          if (err.status === 409 && err.error && err.error.error === 'APPOINTMENT_ALREADY_EXISTS') {
            this.error = err.error.message || 'You already have an appointment scheduled for this date. Only one appointment per day is allowed.';
          } else if (err.error && typeof err.error === 'object' && err.error.message === 'Doctor is not available at the requested time') {
            this.error = 'The selected doctor is not available at this time. Please choose another time slot or doctor.';
          } else if (err.status === 500 && err.error && typeof err.error === 'string' && err.error.includes('Doctor is not available')) {
            this.error = 'The selected doctor is not available at this time. Please choose another time slot or doctor.';
          } else if (err.status === 400 && err.error && typeof err.error === 'object' && err.error.message?.includes('Appointment date')) {
            this.error = 'Please select a future date for the appointment.';
          } else {
            this.error = 'Failed to save appointment. Please try again.';
          }
        }
      });
      });
    });
  }
  
  /**
   * Check if patient already has an appointment on the selected date
   */
  private async checkPatientAppointmentOnDate(appointment: Appointment): Promise<boolean> {
    // Skip check for editing existing appointments
    if (this.isEdit) return false;

    return new Promise<boolean>(resolve => {
      // Extract date from appointmentDateTime for filtering
      const appointmentDate = appointment.appointmentDateTime ? appointment.appointmentDateTime.split('T')[0] : '';
      
      // Get all appointments and filter by patient ID
      this.appointmentService.getAppointments({}).pipe(
        catchError(() => of([]))
      ).subscribe((appointments: Appointment[]) => {
        // Filter appointments for this specific patient
        const patientAppointments = appointments.filter(app => app.patientId === appointment.patientId);
        
        // Check if patient has any appointment on the same date
        const hasAppointmentOnDate = patientAppointments.some((app: Appointment) => {
          if (!app.appointmentDateTime) return false;
          
          const existingAppointmentDate = app.appointmentDateTime.split('T')[0];
          return existingAppointmentDate === appointmentDate;
        });

        resolve(hasAppointmentOnDate);
      });
    });
  }
  
  private async checkDuplicateAppointment(appointment: Appointment): Promise<boolean> {
    // Skip check for editing existing appointments
    if (this.isEdit) return false;

    return new Promise<boolean>(resolve => {
      // Basic filter by date - backend would do more specific checking
      // Extract date from appointmentDateTime for filtering
      const appointmentDate = appointment.appointmentDateTime ? appointment.appointmentDateTime.split('T')[0] : '';
      this.appointmentService.getAppointments({
        date: appointmentDate,
        doctorId: appointment.doctorId
      }).pipe(
        catchError(() => of([]))
      ).subscribe((appointments: Appointment[]) => {
        // Check for duplicate (same patient, doctor, date and time)
        // For duplicate check, extract date and time from appointmentDateTime
        const duplicate = appointments.some((app: Appointment) => {
          const appDateTime = app.appointmentDateTime || '';
          const newAppDateTime = appointment.appointmentDateTime || '';
          return app.patientId === appointment.patientId &&
                app.doctorId === appointment.doctorId &&
                appDateTime === newAppDateTime;
        });

        resolve(duplicate);
      });
    });
  }

  /**
   * Display the appointment success modal
   */
  private displaySuccessModal(appointment: Appointment | undefined): void {
    // Safety check - if appointment is undefined, use default values
    if (!appointment) {
      console.warn('Appointment data is undefined in displaySuccessModal');
      // Set default confirmation details
      this.successModalData = {
        patientName: 'Patient',
        appointmentDate: new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        appointmentTime: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        doctorName: 'Doctor'
      };
      
      // Show the confirmation modal
      this.showSuccessModal = true;
      return;
    }
    
    // If appointment is defined, proceed normally
    // Parse the appointmentDateTime string
    const dateTime = appointment.appointmentDateTime ? new Date(appointment.appointmentDateTime) : new Date();
    
    // Format time for display (e.g., "07:34 PM")
    const formattedTime = dateTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Format date for display (e.g., "Thursday, July 15, 2025")
    const formattedDate = dateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Get patient and doctor details
    let patientName = '';
    let doctorName = 'Doctor';
    
    // Get patient name from the form values - ensure we get actual values including disabled fields
    const formValues = this.appointmentForm.getRawValue(); 
    
    // Check if we have first/last name in the form
    if (formValues.firstName || formValues.lastName) {
      patientName = `${formValues.firstName || ''} ${formValues.lastName || ''}`.trim();
      console.log('Using form values for patient name:', patientName);
    } 
    // Try to use any patient name info from the appointment response
    else if (appointment.patientName) {
      patientName = appointment.patientName;
      console.log('Using appointment.patientName:', patientName);
    } 
    // Last resort - use patient ID or identifier
    else {
      // Get any identifier we can find to make the display more useful than just 'Patient'
      const identifier = formValues.patientIdentifier || formValues.patientId || appointment.patientId || '';
      patientName = identifier ? `Patient ${identifier}` : 'Patient';
      console.log('Using patient identifier for name:', patientName);
    }
    
    // Try to get doctor name from our doctors list
    const doctor = this.doctors.find((doc: Doctor) => doc.doctorId === appointment.doctorId);
    if (doctor && doctor.name) {
      doctorName = doctor.name;
    }
    
    this.successModalData = {
      patientName,
      appointmentDate: formattedDate,
      appointmentTime: formattedTime,
      doctorName
    };
    
    // Show the modal
    this.showSuccessModal = true;
  }
  
  /**
   * Handle closing the success modal
   */
  onSuccessModalClose(action: string): void {
    this.showSuccessModal = false;
    if (action === 'view') {
      this.router.navigate(['/appointments']);
    }
  }
  
  /**
   * Handle closing the already booked modal
   */
  onAlreadyBookedModalClose(action: string): void {
    this.showAlreadyBookedModal = false;
    
    if (action === 'viewSlots') {
      // Navigate to available slots view (could be implemented in future)
      // For now, just stay on the current form
    }
    // For 'cancel', just close the modal and let user try again
  }

  cancel(): void {
    this.router.navigate(['/appointments']);
  }
}
