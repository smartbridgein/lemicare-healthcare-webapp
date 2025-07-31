import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, Subject, Subscription, of, EMPTY, throwError } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap, catchError, filter, finalize, map } from 'rxjs/operators';
import { InventoryService } from '../../services/inventory.service';
import { Patient, Doctor } from '../../services/inventory.service';
import { Medicine, StockStatus } from '../../models/inventory.models';
import { environment } from '../../../../environments/environment';

// Enum for GST types
enum GstType {
  INCLUSIVE = 'INCLUSIVE',
  EXCLUSIVE = 'EXCLUSIVE',
  NON_GST = 'NON_GST'
}

// Type definitions for API responses
interface SaleItemDto {
  medicineId: string;
  quantity: number;
  discountPercentage: number;
  mrp: number;
  taxProfileId: string; // Required by backend validation
  cgst?: number;
  sgst?: number;
  taxableAmount?: number;
  total?: number;
}

// Type definitions for API responses
interface MedicineBatch {
  batchNo: string;
  expiryDate: Date | null;
  mrp: number;
  unitCost: number;
  purchaseId?: string;
  referenceId?: string;
  packQuantity?: number;
  itemsPerPack?: number;
  taxProfileId?: string;  // Tax profile from purchase data
}

interface TaxComponent {
  name: string; // e.g., 'CGST', 'SGST'
  rate: number;
}

interface TaxProfile {
  taxProfileId: string;
  profileName: string;
  totalRate: number;
  components: TaxComponent[];
}

interface Sale {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  items: SaleItemDto[];
  totalAmount: number;
}

interface MedicineSearchEvent {
  term: string;
  itemIndex: number;
}

// Extended Medicine interface to handle additional fields from API
interface ExtendedMedicine extends Omit<Medicine, 'status'> {
  genericName?: string;
  manufacturer?: string;
  status?: 'ACTIVE' | 'INACTIVE' | string;
}

// Using Doctor interface from InventoryService

// Interface to match the exact backend API structure
interface CreatePrescriptionSaleRequest {
  patientId: string;
  doctorId: string;
  prescriptionDate: Date;
  saleDate: Date;
  items: SaleItemDto[];
  paymentMode: string; // Must be one of the valid PaymentMode enum values
  transactionReference?: string; // Optional
  grandTotal: number; // Required by API validation
  gstType: string; // Must be 'INCLUSIVE' or 'EXCLUSIVE'
  // Optional fields that are helpful but not strictly required
  printGst?: boolean;
  subtotal?: number;
  discount?: number;
  cgstTotal?: number;
  sgstTotal?: number;
}

@Component({
  selector: 'app-sales-prescription-form',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './sales-prescription-form.component.html',
  styleUrls: ['./sales-prescription-form.component.scss']
})
export class SalesPrescriptionFormComponent implements OnInit, OnDestroy, AfterViewInit {
  // Tax calculation related properties
  gstTypes = Object.values(GstType);

  // Feature flags
  useApiSearch = true; // Whether to use API for searching or local filtering

  // Search related properties
  patientSearchTerms = new Subject<string>();
  doctorSearchTerms = new Subject<string>();
  medicineSearchTerms = new Subject<string>();
  private medicineSearchTerm = new Subject<MedicineSearchEvent>();
  patientSearchResults: any[] = [];
  doctorSearchResults: any[] = [];
  medicineSearchResults: Medicine[] = [];
  showPatientSearch = false;
  showDoctorSearch = false;
  showMedicineSearch = false;
  loadingPatients = false;
  loadingDoctors = false;
  loadingMedicines = false;
  loadingMedicineSearch = false;
  activeSearchIndex = -1;
  
  // Selected entities
  selectedPatient: any = null;
  selectedDoctor: any = null;
  
  // Selection flags to prevent blur event interference
  isSelectingPatient = false;
  isSelectingDoctor = false;
  
  // Medicine related
  medicines: Medicine[] = [];
  filteredMedicines: Medicine[] = [];
  patients: any[] = [];
  filteredPatients: any[] = [];
  doctors: any[] = [];
  filteredDoctors: any[] = [];
  
  // Batch related
  loadingBatches = false;
  medicineBatches: { [medicineId: string]: MedicineBatch[] } = {};
  currentMedicineIndex = -1;
  
  // Form data
  prescriptionForm!: FormGroup; // Will be initialized in constructor
  formInitialized = false; // Flag to track form initialization
  submitting = false;
  
  // Edit mode properties
  isEditMode = false;
  editSaleId: string | null = null;
  loadingSaleData = false;
  userHasModifiedForm = false; // Track if user has made changes after initial population
  
  // Payment methods
  paymentMethods = ['CASH', 'CARD', 'UPI', 'CREDIT'];
  
  // Tax related
  loadingTaxProfiles = false;
  taxProfiles: TaxProfile[] = [];
  defaultTaxProfileId = '';
  
  // Totals
  subtotal = 0;
  totalBeforeDiscount = 0; // Net amount including tax before discount
  discount = 0;
  tax = 0;
  cgstTotal = 0;
  sgstTotal = 0;
  grandTotal = 0;
  total = 0;
  
  // GST related
  cgst = 0;
  sgst = 0;
  taxableAmount = 0;
  printGST = false;
  
  // Subscriptions
  private subscriptions = new Subscription();

  // Generate a unique transaction reference with format TRX-YYYYMMDD-HHMMSS-XXX
  // where XXX is a random 3-digit number
  generateTransactionReference(): string {
    const now = new Date();
    const datePart = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const timePart = String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
    const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `TRX-${datePart}-${timePart}-${randomPart}`;
  }

  // API URL from environment
  private apiUrl = environment.apiUrlInventory;

  constructor(
    private fb: FormBuilder,
    private inventoryService: InventoryService,
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    this.createForm();
  }
  


  createForm(): void {
    this.prescriptionForm = this.fb.group({
      patientName: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      address: ['', Validators.required],
      gender: [''],
      patientId: ['', Validators.required],
      doctorName: ['', Validators.required],
      doctorId: ['', Validators.required],
      prescriptionDate: [this.getCurrentDate(), Validators.required],
      saleDate: [this.getCurrentDate(), Validators.required],
      items: this.fb.array([]),
      notes: [''],
      paymentMode: ['CASH', Validators.required],
      paymentStatus: ['PAID', Validators.required],
      transactionReference: [this.generateTransactionReference()],
      gstType: ['EXCLUSIVE', Validators.required],
      printGST: [false],

    });
    
    // Form initialized - items will be added in ngOnInit based on mode
    this.formInitialized = true;
  }
  
  /**
   * Set up patient search with debounced input
   */
  setupPatientSearch(): void {
    // Subscribe to the patientName control value changes
    const patientNameControl = this.prescriptionForm.get('patientName');
    if (patientNameControl) {
      this.subscriptions.add(
        patientNameControl.valueChanges.pipe(
          debounceTime(300),
          distinctUntilChanged(),
          tap(term => { 
            // Don't trigger search if we're currently selecting a patient (programmatic update)
            if (this.isSelectingPatient) {
              console.log('Ignoring patient name change during selection');
              return;
            }
            
            if (term && term.length > 1) {
              this.showPatientSearch = true;
              this.patientSearchTerms.next(term);
            } else {
              this.showPatientSearch = false;
            }
          })
        ).subscribe()
      );
    }

    // Subscribe to the patient search terms subject
    this.subscriptions.add(
      this.patientSearchTerms.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term: string) => {
          if (term.length < 2) return of([]);
          this.loadingPatients = true;
          const isPhoneSearch = /^\d+$/.test(term);
          if (this.useApiSearch) {
            return (isPhoneSearch ? 
              this.inventoryService.searchPatientsByPhone(term) : 
              this.inventoryService.searchPatients(term)
            ).pipe(
              catchError(() => {
                // Fallback to local search if API fails
                return of(this.filterPatientsLocally(term, isPhoneSearch));
              }),
              finalize(() => this.loadingPatients = false)
            );
          } else {
            return of(this.filterPatientsLocally(term, isPhoneSearch)).pipe(
              finalize(() => this.loadingPatients = false)
            );
          }
        })
      ).subscribe((patients: Patient[]) => {
        this.patientSearchResults = patients;
        this.showPatientSearch = this.patientSearchResults.length > 0;
        // Removed automatic selection - user must explicitly choose from dropdown
      })
    );

    // Phone number search functionality
    const phoneNumberControl = this.prescriptionForm.get('phoneNumber');
    if (phoneNumberControl) {
      this.subscriptions.add(
        phoneNumberControl.valueChanges.pipe(
          debounceTime(300),
          distinctUntilChanged(),
          filter((phoneNum: string) => !!phoneNum && phoneNum.length >= 10),
          tap((phoneNum: string) => {
            // Don't trigger search if we're currently selecting a patient (programmatic update)
            if (this.isSelectingPatient) {
              console.log('Ignoring phone number change during selection');
              return;
            }
            
            this.loadingPatients = true;
            this.patientSearchTerms.next(phoneNum);
          })
        ).subscribe()
      );
    }
  }

  // Filter patients locally by name or phone
  filterPatientsLocally(searchTerm: string, isPhoneSearch: boolean = false): Patient[] {
    if (!searchTerm || searchTerm.length < 2) return [];
    searchTerm = searchTerm.toLowerCase();
    
    return this.patients.filter(patient => {
      if (isPhoneSearch) {
        return patient.phoneNumber && patient.phoneNumber.includes(searchTerm);
      } else {
        return patient.name && patient.name.toLowerCase().includes(searchTerm);
      }
    });
  }

  // Set up doctor search with debounced input
  setupDoctorSearch(): void {
    const doctorNameControl = this.prescriptionForm.get('doctorName');
    if (doctorNameControl) {
      this.subscriptions.add(
        doctorNameControl.valueChanges.pipe(
          debounceTime(300),
          distinctUntilChanged(),
          tap(term => { 
            // Don't trigger search if we're currently selecting a doctor (programmatic update)
            if (this.isSelectingDoctor) {
              console.log('Ignoring doctor name change during selection');
              return;
            }
            
            if (term && term.length > 1) {
              this.doctorSearchTerms.next(term);
            }
          }),
          switchMap(term => {
            if (!term || term.length < 2) return of([]);
            this.loadingDoctors = true;
            this.showDoctorSearch = true;
            return this.inventoryService.searchDoctors(term).pipe(
              catchError(() => of(this.filterDoctorsLocally(term))),
              finalize(() => this.loadingDoctors = false)
            );
          })
        ).subscribe((doctors: Doctor[]) => {
          this.doctorSearchResults = doctors;
          this.showDoctorSearch = this.doctorSearchResults.length > 0;
        })
      );
    }
  }

  // Filter doctors locally by name
  filterDoctorsLocally(searchTerm: string): Doctor[] {
    if (!searchTerm || searchTerm.length < 2) return [];
    searchTerm = searchTerm.toLowerCase();
    
    return this.doctors.filter(doctor => 
      doctor.name && doctor.name.toLowerCase().includes(searchTerm)
    );
  }

  // Set up medicine search with debounce and auto-complete
  setupMedicineSearch(): void {
    // Initialize medicine search with debouncing
    this.subscriptions.add(
      this.medicineSearchTerm.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(({ term, itemIndex }) => {
          if (term.length < 2) return of([]);
          this.loadingMedicineSearch = true;
          // First try local filtering (faster response)
          const localResults = this.filterMedicinesLocally(term);
          if (localResults.length > 0) {
            this.loadingMedicineSearch = false;
            return of(localResults);
          }
          // If no local results, try API
          return this.inventoryService.searchMedicines(term).pipe(
            catchError(() => of([])),
            finalize(() => this.loadingMedicineSearch = false)
          );
        })
      ).subscribe(results => {
        this.medicineSearchResults = results;
        this.showMedicineSearch = this.medicineSearchResults.length > 0;
      })
    );
  }



  ngOnInit(): void {
    // Check if we're in edit mode
    this.route.paramMap.subscribe(params => {
      const saleId = params.get('id');
      console.log('=== PRESCRIPTION FORM ROUTE DETECTION ===');
      console.log('Route params:', params.keys.map(key => ({ key, value: params.get(key) })));
      console.log('Sale ID from route:', saleId);
      
      if (saleId) {
        console.log('PRESCRIPTION EDIT MODE DETECTED - Sale ID:', saleId);
        this.isEditMode = true;
        this.editSaleId = saleId;
        this.loadSaleData(saleId);
      } else {
        console.log('PRESCRIPTION CREATE MODE - No sale ID found');
        // Add an empty item in create mode only
        this.addSaleItem();
      }
    });
    
    this.preloadMedicines();
    this.setupPatientSearch();
    this.setupDoctorSearch();
    this.setupMedicineSearch();
    this.loadTaxProfiles();
    this.setupTaxProfileChangeSubscriptions();
    
    // Setup form value changes subscription for total calculations
    this.subscriptions.add(
      this.prescriptionForm.valueChanges.subscribe(() => {
        this.calculateTotals();
      })
    );
  }

  ngAfterViewInit(): void {
    this.loadTaxProfiles();
  }
  
  /**
   * Load sale data for editing
   * @param saleId The ID of the sale to load
   */
  loadSaleData(saleId: string): void {
    console.log('=== PRESCRIPTION LOAD SALE DATA ===');
    console.log('Loading prescription sale data for ID:', saleId);
    this.loadingSaleData = true;
    
    this.inventoryService.getSaleById(saleId).subscribe({
      next: (sale) => {
        console.log('=== PRESCRIPTION SALE DATA RECEIVED ===');
        console.log('Full sale data:', JSON.stringify(sale, null, 2));
        console.log('Sale type:', sale?.saleType);
        console.log('Is prescription sale?', sale && sale.saleType === 'PRESCRIPTION');
        
        if (sale && sale.saleType === 'PRESCRIPTION') {
          console.log('✅ Valid prescription sale - proceeding with form population');
          // Clear existing items before populating form
          this.clearItems();
          
          // Populate the form with sale data
          this.populateFormWithSaleData(sale);
          
          console.log('Prescription sale data loaded successfully for editing');
        } else {
          console.error('❌ Invalid sale type or data for prescription edit:', {
            saleExists: !!sale,
            saleType: sale?.saleType,
            expectedType: 'PRESCRIPTION'
          });
          alert('Invalid sale type or data. Only prescription sales can be edited.');
          this.router.navigate(['/inventory/sales']);
        }
        this.loadingSaleData = false;
      },
      error: (error) => {
        console.error('=== PRESCRIPTION SALE DATA LOAD ERROR ===');
        console.error('Error loading prescription sale data:', error);
        console.error('Sale ID that failed:', saleId);
        alert('Failed to load sale data: ' + (error.message || 'Unknown error'));
        this.loadingSaleData = false;
        this.router.navigate(['/inventory/sales']);
      }
    });
  }
  
  /**
   * Clear all items in the items form array
   */
  clearItems(): void {
    const itemsArray = this.itemsFormArray;
    while (itemsArray.length !== 0) {
      itemsArray.removeAt(0);
    }
  }
  
  /**
   * Populate form with prescription sale data for editing
   * @param sale The sale data from API
   */
  populateFormWithSaleData(sale: any): void {
    console.log('=== DEBUGGING PRESCRIPTION SALE DATA POPULATION ===');
    console.log('Full prescription sale data received:', JSON.stringify(sale, null, 2));
    console.log('Doctor ID from API:', sale.doctorId);
    console.log('Patient ID from API:', sale.patientId);
    console.log('Sale Date from API:', sale.saleDate);
    
    // Reset user modification flag for fresh edit session
    this.userHasModifiedForm = false;
    
    // Find and set the selected patient
    if (sale.patientId) {
      this.inventoryService.getAllPatients().subscribe(patients => {
        this.selectedPatient = patients.find(p => p.id === sale.patientId) || null;
        if (this.selectedPatient) {
          console.log('Selected patient found for edit mode:', this.selectedPatient.name);
          // Update patient info in form with direct setValue to avoid triggering search
          const patientNameControl = this.prescriptionForm.get('patientName');
          const phoneNumberControl = this.prescriptionForm.get('phoneNumber');
          const patientIdControl = this.prescriptionForm.get('patientId');
          const addressControl = this.prescriptionForm.get('address');
          const genderControl = this.prescriptionForm.get('gender');
          
          // Set values directly without triggering valueChanges (same as selectPatientSimple)
          if (patientNameControl) patientNameControl.setValue(this.selectedPatient.name || '', { emitEvent: false });
          if (phoneNumberControl) phoneNumberControl.setValue(this.selectedPatient.phoneNumber || this.selectedPatient.mobile || '', { emitEvent: false });
          if (patientIdControl) patientIdControl.setValue(sale.patientId, { emitEvent: false });
          if (addressControl) addressControl.setValue(this.selectedPatient.address || '', { emitEvent: false });
          if (genderControl) genderControl.setValue(this.selectedPatient.gender || '', { emitEvent: false });
          
          console.log('Patient auto-populated in edit mode:', {
            patientName: patientNameControl?.value,
            phoneNumber: phoneNumberControl?.value,
            patientId: patientIdControl?.value,
            address: addressControl?.value,
            gender: genderControl?.value
          });
        }
      });
    }
    
    // Find and set the selected doctor
    if (sale.doctorId) {
      this.inventoryService.getDoctors().subscribe(doctors => {
        this.selectedDoctor = doctors.find(d => d.id === sale.doctorId) || null;
        if (this.selectedDoctor) {
          console.log('Selected doctor found for edit mode:', this.selectedDoctor.name);
          // Update doctor name in form with direct setValue to avoid triggering search
          const doctorNameControl = this.prescriptionForm.get('doctorName');
          const doctorIdControl = this.prescriptionForm.get('doctorId');
          
          // Set values directly without triggering valueChanges (same as selectDoctorSimple)
          if (doctorNameControl) doctorNameControl.setValue(this.selectedDoctor.name || '', { emitEvent: false });
          if (doctorIdControl) doctorIdControl.setValue(sale.doctorId, { emitEvent: false });
          
          console.log('Doctor auto-populated in edit mode:', {
            doctorName: doctorNameControl?.value,
            doctorId: doctorIdControl?.value
          });
        }
      });
    }
    
    // Format sale date from Firestore timestamp
    let formattedSaleDate = '';
    if (sale.saleDate) {
      if (typeof sale.saleDate === 'object' && sale.saleDate.seconds) {
        // Firestore timestamp format
        const date = new Date(sale.saleDate.seconds * 1000);
        formattedSaleDate = date.toISOString().split('T')[0];
      } else if (typeof sale.saleDate === 'string') {
        formattedSaleDate = this.formatDateForInput(sale.saleDate);
      }
    }
    
    // Format prescription date from Firestore timestamp
    let formattedPrescriptionDate = '';
    if (sale.prescriptionDate) {
      if (typeof sale.prescriptionDate === 'object' && sale.prescriptionDate.seconds) {
        // Firestore timestamp format
        const date = new Date(sale.prescriptionDate.seconds * 1000);
        formattedPrescriptionDate = date.toISOString().split('T')[0];
      } else if (typeof sale.prescriptionDate === 'string') {
        formattedPrescriptionDate = this.formatDateForInput(sale.prescriptionDate);
      }
    }
    
    // Calculate CGST and SGST (typically half of total tax each for intra-state)
    const totalTax = sale.totalTaxAmount || 0;
    const cgstAmount = totalTax / 2;
    const sgstAmount = totalTax / 2;
    
    console.log('Prescription form totals from API:', {
      totalTaxableAmount: sale.totalTaxableAmount,
      totalTaxAmount: sale.totalTaxAmount,
      grandTotal: sale.grandTotal,
      totalDiscountAmount: sale.totalDiscountAmount,
      calculatedCGST: cgstAmount,
      calculatedSGST: sgstAmount
    });
    
    // Set component properties for summary display (used by HTML template)
    this.subtotal = sale.totalTaxableAmount || 0;
    this.totalBeforeDiscount = sale.totalTaxableAmount || 0;
    this.discount = sale.totalDiscountAmount || 0;
    this.tax = sale.totalTaxAmount || 0;
    this.cgstTotal = cgstAmount;
    this.sgstTotal = sgstAmount;
    this.grandTotal = sale.grandTotal || 0;
    
    console.log('Set prescription component properties for display:', {
      subtotal: this.subtotal,
      totalBeforeDiscount: this.totalBeforeDiscount,
      discount: this.discount,
      tax: this.tax,
      cgstTotal: this.cgstTotal,
      sgstTotal: this.sgstTotal,
      grandTotal: this.grandTotal
    });
    
    // Calculate discount percentage from discount amount and total
    let discountPercentage = 0;
    const totalAmount = sale.totalTaxableAmount || 0;
    const discountAmount = sale.totalDiscountAmount || 0;
    
    if (totalAmount > 0 && discountAmount > 0) {
      discountPercentage = (discountAmount / totalAmount) * 100;
      // Cap at 100% to prevent invalid percentages
      discountPercentage = Math.min(discountPercentage, 100);
    }
    
    console.log('Calculated discount percentage for edit mode:', {
      totalAmount,
      discountAmount,
      calculatedPercentage: discountPercentage.toFixed(2)
    });
    
    // Map API field names to form field names using actual API response structure
    this.prescriptionForm.patchValue({
      // Patient info will be set after patient lookup above
      prescriptionDate: formattedSaleDate, // Use sale date as prescription date in edit mode
      saleDate: formattedSaleDate,
      gstType: sale.gstType || 'EXCLUSIVE',
      printGst: !!sale.printGst,
      paymentMode: sale.paymentMode || 'CASH', // Fixed: was paymentMethod, now paymentMode
      paymentStatus: sale.paymentStatus || 'PAID', // Added missing paymentStatus mapping
      transactionReference: sale.transactionReference || '',

      subtotal: sale.totalTaxableAmount || 0,
      discount: sale.totalDiscountAmount || 0,
      tax: sale.totalTaxAmount || 0,
      cgstTotal: cgstAmount,
      sgstTotal: sgstAmount,
      grandTotal: sale.grandTotal || 0,
      notes: sale.notes || ''
    });
    
    // Add sale items
    if (sale.items && Array.isArray(sale.items)) {
      console.log('Adding prescription sale items:', sale.items);
      
      // Use setTimeout to ensure the form is fully initialized
      setTimeout(() => {
        sale.items.forEach((item: any) => {
          this.addSaleItemWithData(item);
        });
        
        // Skip recalculation in edit mode since we already have correct totals from API
        if (!this.isEditMode) {
          // Recalculate totals after adding items (only for new sales)
          setTimeout(() => {
            this.calculateTotals();
          }, 500);
        } else {
          console.log('Skipping calculateTotals() in edit mode - using API totals');
        }
      }, 100);
    }
  }
  
  /**
   * Format date for input field (YYYY-MM-DD)
   */
  formatDateForInput(date: any): string {
    if (!date) return '';
    
    let dateObj: Date;
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date.toDate && typeof date.toDate === 'function') {
      // Firestore timestamp
      dateObj = date.toDate();
    } else {
      dateObj = new Date(date);
    }
    
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    return dateObj.toISOString().split('T')[0];
  }
  
  /**
   * Add sale item with existing data for edit mode
   */
  addSaleItemWithData(itemData: any): void {
    console.log('=== DEBUGGING PRESCRIPTION BATCH ALLOCATION ===');
    console.log('Full prescription item data received:', JSON.stringify(itemData, null, 2));
    
    // Extract batch information from batchAllocations array
    let batchNo = 'N/A';
    let expiryDate = '';
    
    console.log('Checking prescription batchAllocations:', {
      exists: !!itemData.batchAllocations,
      isArray: Array.isArray(itemData.batchAllocations),
      length: itemData.batchAllocations?.length,
      data: itemData.batchAllocations
    });
    
    if (itemData.batchAllocations && Array.isArray(itemData.batchAllocations) && itemData.batchAllocations.length > 0) {
      const firstBatch = itemData.batchAllocations[0];
      console.log('First prescription batch allocation:', firstBatch);
      
      // Extract batch number - API uses 'batchNo' field
      batchNo = firstBatch.batchNo || 'N/A';
      console.log('Extracted prescription batchNo:', batchNo);
      
      // Extract expiry date - API uses Firestore timestamp format
      if (firstBatch.expiryDate && firstBatch.expiryDate.seconds) {
        const date = new Date(firstBatch.expiryDate.seconds * 1000);
        expiryDate = date.toISOString().split('T')[0];
        console.log('Converted prescription expiry date from timestamp:', firstBatch.expiryDate.seconds, 'to:', expiryDate);
      } else if (firstBatch.expiryDate) {
        // Handle other date formats as fallback
        if (typeof firstBatch.expiryDate === 'string') {
          expiryDate = this.formatDateForInput(firstBatch.expiryDate);
        } else if (firstBatch.expiryDate instanceof Date) {
          expiryDate = this.formatDate(firstBatch.expiryDate);
        }
        console.log('Used fallback prescription date conversion:', expiryDate);
      }
      console.log('Final extracted prescription batch info from batchAllocations:', { batchNo, expiryDate });
    } else {
      // Fallback to direct fields if batchAllocations not available
      console.log('Checking direct prescription batch fields:', {
        batchNo: itemData.batchNo,
        batchNumber: itemData.batchNumber,
        expiryDate: itemData.expiryDate
      });
      batchNo = itemData.batchNo || itemData.batchNumber || 'N/A';
      if (itemData.expiryDate) {
        expiryDate = this.formatDateForInput(itemData.expiryDate);
      }
      console.log('Using fallback batch info for prescription:', { batchNo, expiryDate });
    }
    
    // Look up medicine details from the medicines list
    let medicineDetails: any = null;
    if (this.medicines && this.medicines.length > 0) {
      medicineDetails = this.medicines.find(m => m.id === itemData.medicineId);
      console.log('Found medicine details for prescription item:', medicineDetails);
    }
    
    // Calculate taxable amount for line item display
    // Taxable amount column should show the base amount (without tax)
    const baseAmount = itemData.lineItemTaxableAmount || itemData.mrpPerItem || 0;
    const taxAmount = itemData.taxAmount || 0;
    const taxableAmountForDisplay = baseAmount; // Show base amount only (₹1,200)
    
    // Calculate initial CGST and SGST amounts from API response
    // For EXCLUSIVE GST, split the tax amount equally between CGST and SGST
    const initialCgstAmount = taxAmount / 2;
    const initialSgstAmount = taxAmount / 2;
    
    console.log('Prescription item taxable amount calculation:', {
      baseAmount,
      taxAmount,
      taxableAmountForDisplay,
      apiLineItemTaxableAmount: itemData.lineItemTaxableAmount,
      apiLineItemTotalAmount: itemData.lineItemTotalAmount
    });
    
    const itemsArray = this.itemsFormArray;
    const newItem = this.fb.group({
      medicineId: [itemData.medicineId || '', Validators.required],
      medicineName: [medicineDetails?.name || itemData.medicineName || ''],
      generic: [medicineDetails?.genericName || ''],
      mfg: [medicineDetails?.manufacturer || ''],
      batchNo: [batchNo],
      expDate: [expiryDate],
      quantity: [itemData.quantity || 1, [Validators.required, Validators.min(1)]],
      unitCost: [itemData.mrpPerItem || 0, [Validators.required, Validators.min(0)]],
      unitMrp: [itemData.mrpPerItem || 0, [Validators.required, Validators.min(0)]],
      discount: [itemData.discountPercentage || 0, [Validators.min(0), Validators.max(100)]],
      taxProfileId: [itemData.taxProfileId || ''],
      taxPercentage: [itemData.taxRateApplied || 0],
      cgstPercentage: [0], // CGST percentage field for tax profile changes
      sgstPercentage: [0], // SGST percentage field for tax profile changes
      cgst: [initialCgstAmount], // CGST amount field for calculated tax amounts
      sgst: [initialSgstAmount], // SGST amount field for calculated tax amounts
      taxAmount: [itemData.taxAmount || 0],
      taxableAmount: [taxableAmountForDisplay], // This should show ₹1,200
      total: [itemData.lineItemTotalAmount || 0]
    });
    
    itemsArray.push(newItem);
    
    // CRITICAL: Populate the medicineBatches array so the dropdown has options (if it exists)
    if (itemData.medicineId && batchNo !== 'N/A' && (this as any).medicineBatches) {
      if (!(this as any).medicineBatches[itemData.medicineId]) {
        (this as any).medicineBatches[itemData.medicineId] = [];
      }
      
      // Create batch data object for dropdown
      const batchData = {
        batchNo: batchNo,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        mrp: itemData.mrpPerItem || 0,
        unitCost: itemData.salePrice || itemData.mrpPerItem || 0
      };
      
      // Add batch to the dropdown options if not already present
      const existingBatch = (this as any).medicineBatches[itemData.medicineId].find((b: any) => b.batchNo === batchNo);
      if (!existingBatch) {
        (this as any).medicineBatches[itemData.medicineId].push(batchData);
        console.log('Added prescription batch to dropdown options:', batchData);
      }
    }
    
    // Apply tax profile data if available
    if (itemData.taxProfileId && this.taxProfiles && this.taxProfiles.length > 0) {
      const taxProfile = this.taxProfiles.find((tp: any) => tp.taxProfileId === itemData.taxProfileId);
      if (taxProfile && taxProfile.components) {
        console.log('Applying tax profile in prescription edit mode:', taxProfile);
        
        // Extract CGST and SGST from tax profile components (correct field names)
        const cgstComponent = taxProfile.components.find((c: any) => c.name === 'CGST');
        const sgstComponent = taxProfile.components.find((c: any) => c.name === 'SGST');
        
        const cgstRate = cgstComponent ? cgstComponent.rate : 0;
        const sgstRate = sgstComponent ? sgstComponent.rate : 0;
        
        // Set CGST and SGST percentages in the form
        newItem.patchValue({
          cgstPercentage: cgstRate,
          sgstPercentage: sgstRate
        });
        
        console.log('Applied prescription tax percentages:', { cgst: cgstRate, sgst: sgstRate });
      }
    }
    
    // Ensure batch information is properly set after form initialization
    setTimeout(() => {
      newItem.patchValue({
        batchNo: batchNo,
        expDate: expiryDate
      });
      console.log('Final batch info set in prescription form:', { batchNo, expDate: expiryDate });
    }, 200);
    
    console.log('Added prescription sale item with data:', itemData);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  getCurrentDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  get itemsFormArray(): FormArray {
    return this.prescriptionForm.get('items') as FormArray;
  }

  /**
   * Preload medicines to ensure search works with both API and local fallback
   */
  preloadMedicines(): void {
    this.inventoryService.getMedicines().subscribe(
      (medicines: Medicine[]) => {
        this.medicines = medicines;
      },
      (error: any) => {
        console.error('Error loading medicines:', error);
      }
    );
  }
  
  /**
   * Search for a medicine based on the input at a given index
   * @param index The index of the item in the form array
   */
  searchMedicine(index: number): void {
    if (index >= 0 && index < this.itemsFormArray.length) {
      const control = this.itemsFormArray.at(index);
      const term = control.get('medicineName')?.value;
      
      // Set active search index and trigger search using the new subject
      if (term && term.length > 1) {
        this.activeSearchIndex = index;
        this.medicineSearchTerm.next({ term, itemIndex: index });
      } else {
        this.showMedicineSearch = false;
        this.medicineSearchResults = [];
      }
    }
  }

  /**
   * Select a medicine from search results
   * @param medicine The selected medicine
   * @param itemIndex The index of the item in form array
   */
  selectMedicine(medicine: Medicine, itemIndex: number): void {
    if (!medicine) return;
    
    console.log(`Selected medicine ${medicine.name} for item at index ${itemIndex}`);
    
    // Get the form group for this item
    const items = this.itemsFormArray;
    if (itemIndex < 0 || itemIndex >= items.length) {
      console.error(`Invalid item index: ${itemIndex}`);
      return;
    }
    
    const itemGroup = items.at(itemIndex) as FormGroup;
    
    // Cast medicine to ExtendedMedicine to access additional fields
    const extendedMedicine = medicine as ExtendedMedicine;
    
    // Update medicine fields in the form - using correct field names for prescription form
    itemGroup.patchValue({
      medicineId: medicine.id,
      medicineName: medicine.name,
      generic: extendedMedicine.genericName || '', // Use 'generic' field name for prescription form
      mfg: extendedMedicine.manufacturer || ''      // Use 'mfg' field name for prescription form
    });
    
    // Ensure a tax profile is assigned - use the first available tax profile as default
    const currentTaxProfileId = itemGroup.get('taxProfileId')?.value;
    if (!currentTaxProfileId && this.taxProfiles.length > 0) {
      const defaultTaxProfile = this.taxProfiles[0];
      console.log('Assigning default tax profile:', defaultTaxProfile.taxProfileId);
      itemGroup.patchValue({
        taxProfileId: defaultTaxProfile.taxProfileId
      });
    }
    
    // Store the current index for reference
    this.currentMedicineIndex = itemIndex;
    
    // Fetch batches for this medicine from purchase API (same as OTC form)
    this.loadingBatches = true;
    
    // Construct API URL to fetch purchases containing this medicine
    const purchasesUrl = `${environment.apiUrlInventory}/api/inventory/purchases/`;
    console.log(`[DEBUG] Fetching batches from API: ${purchasesUrl}`);
    
    this.http.get<any[]>(purchasesUrl)
      .pipe(
        catchError(error => {
          console.error('[ERROR] Failed to fetch purchases:', error);
          this.loadingBatches = false;
          return of([]);
        })
      )
      .subscribe((response: any) => {
        this.loadingBatches = false;
        console.log('Purchases API response:', response);
        
        // Extract purchases array - handle both array and {data: []} response formats
        let purchases: any[] = [];
        if (Array.isArray(response)) {
          purchases = response;
        } else if (response && response.data && Array.isArray(response.data)) {
          purchases = response.data;
        }
        
        console.log(`Processing ${purchases.length} purchases for medicine:`, medicine.id, medicine.name);
        
        // Extract all batches for this medicine from the purchases response
        const batches: MedicineBatch[] = [];
        
        // Iterate through all purchases
        purchases.forEach((purchase: any, pIndex: number) => {
          console.log(`Examining purchase ${pIndex}:`, purchase);
          
          // Iterate through items in each purchase
          if (purchase.items && Array.isArray(purchase.items)) {
            purchase.items.forEach((item: any, iIndex: number) => {
              console.log(`Checking item ${iIndex} in purchase ${pIndex}:`, item);
              
              // Check if this item matches our selected medicine
              if (item.medicineId === medicine.id) {
                console.log(`Found matching medicine in purchase ${pIndex}, item ${iIndex}:`, item);
                
                // Extract batch information - using correct field names from actual API response
                let expiryDate = null;
                if (item.expiryDate) {
                  // Handle Firestore timestamp format {seconds: number, nanos: number}
                  if (item.expiryDate.seconds) {
                    expiryDate = new Date(item.expiryDate.seconds * 1000);
                  } else {
                    expiryDate = new Date(item.expiryDate);
                  }
                }
                
                // Calculate unit cost from pack cost
                const itemsPerPack = item.itemsPerPack || 1;
                const purchaseCostPerPack = item.purchaseCostPerPack || 0;
                const unitCost = purchaseCostPerPack / itemsPerPack;
                
                const batchInfo: MedicineBatch = {
                  batchNo: item.batchNo || 'N/A',
                  expiryDate: expiryDate,
                  mrp: item.mrpPerItem || 0,  // Use mrpPerItem from API response
                  unitCost: unitCost,         // Calculated unit cost
                  purchaseId: purchase.purchaseId || purchase.id,
                  referenceId: purchase.referenceId || purchase.invoiceId,
                  packQuantity: item.packQuantity || 1,
                  itemsPerPack: itemsPerPack,
                  taxProfileId: item.taxProfileId || ''  // Map tax profile from purchase data
                };
                
                console.log(`Extracted batch info for ${item.batchNo}:`, {
                  batchNo: batchInfo.batchNo,
                  expiryDate: batchInfo.expiryDate,
                  mrpPerItem: item.mrpPerItem,
                  purchaseCostPerPack: purchaseCostPerPack,
                  itemsPerPack: itemsPerPack,
                  calculatedUnitCost: unitCost
                });
                
                // Check if this batch already exists (avoid duplicates)
                const existingBatch = batches.find(b => 
                  b.batchNo === batchInfo.batchNo && 
                  b.mrp === batchInfo.mrp
                );
                
                if (!existingBatch) {
                  batches.push(batchInfo);
                  console.log(`Added batch:`, batchInfo);
                } else {
                  console.log(`Batch ${batchInfo.batchNo} already exists, skipping`);
                }
              }
            });
          }
        });
        
        console.log(`Found ${batches.length} unique batches for medicine ${medicine.name}:`, batches);
        
        // Store batches for this medicine
        this.medicineBatches[medicine.id] = batches;
        
        // If we found batches, auto-select the first one and populate MRP/cost
        if (batches.length > 0) {
          const firstBatch = batches[0];
          console.log('Auto-selecting first batch:', firstBatch);
          
          // Update form with batch information - handle disabled fields properly
          // For disabled fields, we need to use setValue() instead of patchValue()
          itemGroup.get('batchNo')?.setValue(firstBatch.batchNo);
          itemGroup.get('expDate')?.setValue(firstBatch.expiryDate ? this.formatDateForInput(firstBatch.expiryDate) : '');
          itemGroup.get('unitCost')?.setValue(firstBatch.unitCost);
          itemGroup.get('unitMrp')?.setValue(firstBatch.mrp);
          itemGroup.get('mrp')?.setValue(firstBatch.mrp);
          
          // Set tax profile from batch data if available
          if (firstBatch.taxProfileId) {
            itemGroup.get('taxProfileId')?.setValue(firstBatch.taxProfileId);
            console.log('Set tax profile from batch data:', firstBatch.taxProfileId);
          }
          
          console.log('Updated form fields:', {
            batchNo: firstBatch.batchNo,
            expDate: firstBatch.expiryDate ? this.formatDateForInput(firstBatch.expiryDate) : '',
            unitCost: firstBatch.unitCost,
            unitMrp: firstBatch.mrp,
            mrp: firstBatch.mrp,
            taxProfileId: firstBatch.taxProfileId
          });
          
          // Recalculate totals after updating prices
          this.calculateItemTotal(itemGroup);
        } else {
          console.log('No batches found for this medicine');
          // Set default values if no batches found - handle disabled fields properly
          itemGroup.get('batchNo')?.setValue('');
          itemGroup.get('expDate')?.setValue('');
          itemGroup.get('unitCost')?.setValue(0);
          itemGroup.get('unitMrp')?.setValue(0);
          itemGroup.get('mrp')?.setValue(0);
        }
        
        // Trigger change detection
        this.cdr.detectChanges();
      });
    
    // Hide search results
    this.showMedicineSearch = false;
    this.medicineSearchResults = [];
    this.activeSearchIndex = -1;
    
    // Calculate totals after selection
    this.calculateTotals();
  }

  /**
   * Handle batch selection change - update related fields based on selected batch
   * @param itemGroup The form group for the item
   * @param selectedBatchNo The selected batch number
   */
  onBatchChange(itemGroup: FormGroup, selectedBatchNo: string): void {
    console.log('Batch changed to:', selectedBatchNo);
    
    // Get the medicine ID to find the correct batches
    const medicineId = itemGroup.get('medicineId')?.value;
    if (!medicineId) {
      console.log('No medicine ID found, cannot update batch info');
      return;
    }
    
    // Get batches for this medicine
    const batches = this.medicineBatches[medicineId] || [];
    console.log('Available batches for medicine:', batches);
    
    // Find the selected batch
    const selectedBatch = batches.find(batch => batch.batchNo === selectedBatchNo);
    if (!selectedBatch) {
      console.log('Selected batch not found:', selectedBatchNo);
      return;
    }
    
    console.log('Updating fields for selected batch:', selectedBatch);
    
    // Update all related fields based on the selected batch
    itemGroup.get('expDate')?.setValue(selectedBatch.expiryDate ? this.formatDateForInput(selectedBatch.expiryDate) : '');
    itemGroup.get('unitCost')?.setValue(selectedBatch.unitCost);
    itemGroup.get('unitMrp')?.setValue(selectedBatch.mrp);
    itemGroup.get('mrp')?.setValue(selectedBatch.mrp);
    
    // Update tax profile if available in batch data
    if (selectedBatch.taxProfileId) {
      itemGroup.get('taxProfileId')?.setValue(selectedBatch.taxProfileId);
      console.log('Updated tax profile to:', selectedBatch.taxProfileId);
    }
    
    console.log('Updated fields for batch change:', {
      batchNo: selectedBatchNo,
      expDate: selectedBatch.expiryDate ? this.formatDateForInput(selectedBatch.expiryDate) : '',
      unitCost: selectedBatch.unitCost,
      unitMrp: selectedBatch.mrp,
      mrp: selectedBatch.mrp,
      taxProfileId: selectedBatch.taxProfileId
    });
    
    // Recalculate totals after updating prices
    this.calculateItemTotal(itemGroup);
    
    // Trigger change detection
    this.cdr.detectChanges();
  }

  /**
   * Filter medicines locally by name
   * @param searchTerm The search term to filter by
   */
  filterMedicinesLocally(searchTerm: string): Medicine[] {
    const term = searchTerm.toLowerCase();
    // More flexible search: check name, generic name, and manufacturer
    const results = this.medicines
      .filter(med => {
        // Check if medicine name, generic name or manufacturer contains the search term
        return (
          (med.name && med.name.toLowerCase().includes(term)) || 
          (med.genericName && med.genericName.toLowerCase().includes(term)) ||
          (med.manufacturer && med.manufacturer.toLowerCase().includes(term))
        );
      })
      .slice(0, 10); // Limit to 10 results
    
    // Update component properties for backward compatibility
    this.filteredMedicines = results;
    this.showMedicineSearch = results.length > 0;
    this.loadingMedicines = false;
    console.log('Filtered medicines:', results);
    
    return results;
  }

  /**
   * Select a patient from search results - DEPRECATED: Use selectPatientUnified instead
   * @param patient The patient to select
   */
  selectPatient(patient: any): void {
    console.warn('selectPatient is deprecated, using selectPatientSimple instead');
    this.selectPatientSimple(patient);
  }

  /**
   * Handle patient selection with proper event management - DEPRECATED: Use selectPatientUnified instead
   * @param patient The patient to select
   * @param event The mouse event
   */
  onPatientSelect(patient: any, event: MouseEvent): void {
    console.warn('onPatientSelect is deprecated, using selectPatientSimple instead');
    this.selectPatientSimple(patient, undefined, event);
  }

  /**
   * Handle doctor selection with proper event management
   * @param doctor The doctor to select
   * @param event The mouse event
   */
  onDoctorSelect(doctor: any, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Use setTimeout to ensure proper timing and avoid conflicts with blur events
    setTimeout(() => {
      this.selectDoctor(doctor);
    }, 0);
  }

  /**
   * Direct patient selection without complex event handling
   * @param patient The patient to select
   */
  selectPatientDirectly(patient: any): void {
    if (patient) {
      // Prevent any blur events from interfering
      this.isSelectingPatient = true;
      
      // Immediately update form values
      this.prescriptionForm.patchValue({
        patientId: patient.id,
        patientName: patient.name,
        phoneNumber: patient.phoneNumber || ''
      });
      
      // Hide search dropdown and clear results
      this.showPatientSearch = false;
      this.patientSearchResults = [];
      
      // Reset selection flag after a brief delay
      setTimeout(() => {
        this.isSelectingPatient = false;
      }, 100);
      
      // Trigger change detection
      this.cdr.detectChanges();
    }
  }

  /**
   * Direct doctor selection without complex event handling
   * @param doctor The doctor to select
   */
  selectDoctorDirectly(doctor: any): void {
    if (doctor) {
      // Prevent any blur events from interfering
      this.isSelectingDoctor = true;
      
      // Immediately update form values
      this.prescriptionForm.patchValue({
        doctorId: doctor.id,
        doctorName: doctor.name
      });
      
      // Hide search dropdown and clear results
      this.showDoctorSearch = false;
      this.doctorSearchResults = [];
      
      // Reset selection flag after a brief delay
      setTimeout(() => {
        this.isSelectingDoctor = false;
      }, 100);
      
      // Trigger change detection
      this.cdr.detectChanges();
    }
  }

  /**
   * Highlight patient on hover (optional for better UX)
   * @param patient The patient to highlight
   */
  highlightPatient(patient: any): void {
    // Optional: Add visual feedback on hover
  }

  /**
   * Highlight doctor on hover (optional for better UX)
   * @param doctor The doctor to highlight
   */
  highlightDoctor(doctor: any): void {
    // Optional: Add visual feedback on hover
  }

  /**
   * Handle patient input focus to show dropdown if there are results
   */
  onPatientInputFocus(): void {
    if (this.patientSearchResults.length > 0) {
      this.showPatientSearch = true;
    }
  }

  /**
   * Handle patient input blur to hide dropdown unless selecting
   * @param event The blur event
   */
  onPatientInputBlur(event: FocusEvent): void {
    // Only hide dropdown if not currently selecting a patient
    if (!this.isSelectingPatient) {
      setTimeout(() => {
        if (!this.isSelectingPatient) {
          this.showPatientSearch = false;
        }
      }, 150); // Small delay to allow click events to process
    }
  }

  /**
   * Handle doctor input focus to show dropdown if there are results
   */
  onDoctorInputFocus(): void {
    if (this.doctorSearchResults.length > 0) {
      this.showDoctorSearch = true;
    }
  }

  /**
   * Handle doctor input blur to hide dropdown unless selecting
   * @param event The blur event
   */
  onDoctorInputBlur(event: FocusEvent): void {
    // Only hide dropdown if not currently selecting a doctor
    if (!this.isSelectingDoctor) {
      setTimeout(() => {
        if (!this.isSelectingDoctor) {
          this.showDoctorSearch = false;
        }
      }, 150); // Small delay to allow click events to process
    }
  }

  /**
   * Immediate patient selection with DOM-level event handling
   * @param patient The patient to select
   * @param event The mousedown event
   */
  selectPatientImmediate(patient: any, event: MouseEvent): void {
    // Immediately prevent all default behaviors and stop propagation
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    // Set selection flag immediately
    this.isSelectingPatient = true;
    
    // Update form immediately without any delays
    this.prescriptionForm.patchValue({
      patientId: patient.id,
      patientName: patient.name,
      phoneNumber: patient.phoneNumber || ''
    });
    
    // Hide dropdown and clear results immediately
    this.showPatientSearch = false;
    this.patientSearchResults = [];
    
    // Force immediate change detection
    this.cdr.detectChanges();
    
    // Reset flag after ensuring all events are processed
    setTimeout(() => {
      this.isSelectingPatient = false;
    }, 50);
  }

  /**
   * Immediate doctor selection with DOM-level event handling
   * @param doctor The doctor to select
   * @param event The mousedown event
   */
  selectDoctorImmediate(doctor: any, event: MouseEvent): void {
    // Immediately prevent all default behaviors and stop propagation
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    // Set selection flag immediately
    this.isSelectingDoctor = true;
    
    // Update form immediately without any delays
    this.prescriptionForm.patchValue({
      doctorId: doctor.id,
      doctorName: doctor.name
    });
    
    // Hide dropdown and clear results immediately
    this.showDoctorSearch = false;
    this.doctorSearchResults = [];
    
    // Force immediate change detection
    this.cdr.detectChanges();
    
    // Reset flag after ensuring all events are processed
    setTimeout(() => {
      this.isSelectingDoctor = false;
    }, 50);
  }

  /**
   * Simple direct patient selection - bypasses all complex logic
   * @param patient The patient to select
   * @param index The index of the patient in the list (optional)
   * @param event The event that triggered selection (optional)
   */
  selectPatientSimple(patient: any, index?: number, event?: Event): void {
    console.log('=== SIMPLE PATIENT SELECTION START ===');
    console.log('Patient data:', patient);
    
    // Prevent all event propagation
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    
    // Immediately hide dropdown and clear results FIRST
    this.showPatientSearch = false;
    this.patientSearchResults = [];
    
    // Update form with minimal approach - no patchValue to avoid triggering subscriptions
    const patientNameControl = this.prescriptionForm.get('patientName');
    const phoneNumberControl = this.prescriptionForm.get('phoneNumber');
    const addressControl = this.prescriptionForm.get('address');
    const patientIdControl = this.prescriptionForm.get('patientId');
    
    // Set values directly without triggering valueChanges
    if (patientNameControl) patientNameControl.setValue(patient.name, { emitEvent: false });
    if (phoneNumberControl) phoneNumberControl.setValue(patient.phoneNumber || '', { emitEvent: false });
    if (addressControl) addressControl.setValue(patient.address || '', { emitEvent: false });
    if (patientIdControl) patientIdControl.setValue(patient.id, { emitEvent: false });
    
    // Force change detection
    this.cdr.detectChanges();
    
    console.log('=== SIMPLE PATIENT SELECTION COMPLETE ===');
    console.log('Form values after selection:', {
      patientName: patientNameControl?.value,
      phoneNumber: phoneNumberControl?.value,
      address: addressControl?.value,
      patientId: patientIdControl?.value
    });
  }

  /**
   * Simple direct doctor selection - bypasses all complex logic
   * @param doctor The doctor to select
   * @param index The index of the doctor in the list (optional)
   * @param event The event that triggered selection (optional)
   */
  selectDoctorSimple(doctor: any, index?: number, event?: Event): void {
    console.log('=== SIMPLE DOCTOR SELECTION START ===');
    console.log('Doctor data:', doctor);
    
    // Prevent all event propagation
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    
    // Set flag to prevent search loops during selection
    this.isSelectingDoctor = true;
    
    // Immediately hide dropdown and clear results FIRST
    this.showDoctorSearch = false;
    this.doctorSearchResults = [];
    
    // Update form with minimal approach - no patchValue to avoid triggering subscriptions
    const doctorNameControl = this.prescriptionForm.get('doctorName');
    const doctorIdControl = this.prescriptionForm.get('doctorId');
    
    // Set values directly without triggering valueChanges
    if (doctorNameControl) doctorNameControl.setValue(doctor.name, { emitEvent: false });
    if (doctorIdControl) doctorIdControl.setValue(doctor.id, { emitEvent: false });
    
    // Force change detection
    this.cdr.detectChanges();
    
    console.log('=== SIMPLE DOCTOR SELECTION COMPLETE ===');
    console.log('Form values after selection:', {
      doctorName: doctorNameControl?.value,
      doctorId: doctorIdControl?.value
    });
    
    // Reset flag after processing
    setTimeout(() => {
      this.isSelectingDoctor = false;
      console.log('Doctor selection flag reset');
    }, 200);
  }

  /**
          catchError(error => {
            console.error('Error searching medicines:', error);
            this.filterMedicinesLocally(term);
            return of(this.filteredMedicines);
          }),
          tap(() => this.loadingMedicines = false)
        );
      })
    ).subscribe(medicines => {
      console.log('Medicine search results:', medicines);
      this.medicineSearchResults = medicines;
      this.showMedicineSearch = this.medicineSearchResults.length > 0;
    })
  );
  
  // Set up subscriptions for individual medicine name controls
  this.itemsFormArray.controls.forEach((control: AbstractControl, index: number) => {
    const medicineNameControl = control.get('medicineName');
    if (medicineNameControl) {
      this.subscriptions.add(
        medicineNameControl.valueChanges.pipe(
          debounceTime(300),
          distinctUntilChanged()
        ).subscribe((term: string) => {
          if (term && term.length > 1) {
            this.activeSearchIndex = index;
            this.searchMedicine(index);
          }
        })
      );
    }
  });
  
  /**
   * Submit the form
   */
  onSubmit(): void {
    // Check if form exists and is valid
    if (!this.prescriptionForm) {
      console.error('Form is not initialized');
      alert('Form is not properly initialized. Please refresh the page.');
      return;
    }
    
    if (this.prescriptionForm.invalid) {
      console.log('Form is invalid:', this.prescriptionForm.errors);
      console.log('Form status:', this.prescriptionForm.status);
      console.log('Form value:', this.prescriptionForm.value);
      
      // Check for specific validation errors
      const errors = [];
      if (this.prescriptionForm.get('patientId')?.invalid) errors.push('Patient selection is required');
      if (this.prescriptionForm.get('doctorId')?.invalid) errors.push('Doctor selection is required');
      if (this.prescriptionForm.get('prescriptionDate')?.invalid) errors.push('Prescription date is required');

      if (this.itemsFormArray.length === 0) errors.push('At least one medicine item is required');
      
      if (errors.length > 0) {
        alert('Please fix the following errors:\n' + errors.join('\n'));
      } else {
        alert('Please check all required fields are filled correctly.');
      }
      return;
    }

    // Calculate totals before submission
    this.calculateTotals();

    const formValue = this.prescriptionForm.getRawValue();
    console.log('Submitting form:', formValue);
    
    // Validate that all items have required fields including taxProfileId
    const invalidItems = formValue.items.filter((item: any, index: number) => {
      const missingFields = [];
      if (!item.medicineId) missingFields.push('medicineId');
      if (!item.taxProfileId && this.taxProfiles.length > 0) missingFields.push('taxProfileId'); // Fixed condition
      if (!item.quantity || item.quantity <= 0) missingFields.push('quantity');
      if (!item.unitMrp || item.unitMrp <= 0) missingFields.push('unitMrp'); // Fixed field name
      
      if (missingFields.length > 0) {
        console.error(`Item ${index + 1} missing required fields:`, missingFields);
        return true;
      }
      return false;
    });
    
    if (invalidItems.length > 0) {
      alert(`Please ensure all items have required fields: medicine, tax profile, quantity, and MRP.`);
      return;
    }
    
    // Set loading state

    // Format the form data as needed for API according to required structure
    const apiData = {
      patientId: formValue.patientId,
      doctorId: formValue.doctorId,
      prescriptionDate: formValue.prescriptionDate ? new Date(formValue.prescriptionDate).toISOString() : null, // Handle empty prescription date
      saleDate: new Date().toISOString(),
      paymentMode: formValue.paymentMode || 'CASH',
      transactionReference: formValue.transactionReference,
      gstType: formValue.gstType,
      grandTotal: this.grandTotal,
      items: formValue.items.map((item: any, index: number) => {
        // Use form value or fallback to first available tax profile
        const taxProfileId = item.taxProfileId || (this.taxProfiles.length > 0 ? this.taxProfiles[0].taxProfileId : 'gst-12');
        
        console.log(`Item ${index + 1} - Original taxProfileId: ${item.taxProfileId}, Final taxProfileId: ${taxProfileId}`);
        
        return {
          medicineId: item.medicineId,
          quantity: +item.quantity,
          discountPercentage: +item.discount,
          mrp: +item.unitMrp, // Send unit MRP, not calculated total
          taxProfileId: taxProfileId
        };
      })
    };

    // Differentiate between create and edit mode for API calls
    let apiCall$: Observable<any>;
    let successMessage: string;
    
    if (this.isEditMode && this.editSaleId) {
      // Edit mode: Use PUT API to update existing prescription sale
      const updateUrl = `${this.apiUrl}/api/inventory/sales/prescription/${this.editSaleId}`;
      console.log('Updating prescription sale via PUT:', updateUrl, apiData);
      
      apiCall$ = this.http.put(updateUrl, apiData);
      successMessage = 'Prescription sale updated successfully!';
    } else {
      // Create mode: Use POST API to create new prescription sale
      const createUrl = `${this.apiUrl}/api/inventory/sales/prescription`;
      console.log('Creating new prescription sale via POST:', createUrl, apiData);
      
      apiCall$ = this.http.post(createUrl, apiData);
      successMessage = 'Prescription sale created successfully!';
    }
    
    // Execute the API call
    apiCall$
      .pipe(
        catchError(error => {
          console.error(`Error ${this.isEditMode ? 'updating' : 'creating'} prescription sale:`, error);
          
          // Enhanced error handling
          let errorMessage = `Failed to ${this.isEditMode ? 'update' : 'create'} prescription sale. Please try again.`;
          if (error.error && typeof error.error === 'string') {
            errorMessage = error.error;
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          alert(errorMessage);
          return throwError(() => error);
        })
      )
      .subscribe(response => {
        console.log(`Prescription sale ${this.isEditMode ? 'updated' : 'created'} successfully:`, response);
        
        alert(successMessage);
        
        // Redirect to sales list page
        this.router.navigate(['/inventory/sales']);
      });
  }

  /**
   * Search for doctors manually (triggered by search button)
   */
  searchDoctorsManually(): void {
    const term = this.prescriptionForm.get('doctorName')?.value;
    if (term && term.length > 1) {
      this.doctorSearchTerms.next(term);
    }
  }

  /**
   * Handle GST type change
   */
  onGstTypeChange(): void {
    // Mark that user has modified the form (allows recalculation in edit mode)
    this.userHasModifiedForm = true;
    
    // Recalculate all item totals when GST type changes
    for (let i = 0; i < this.itemsFormArray.length; i++) {
      const formGroup = this.itemsFormArray.at(i) as FormGroup;
      this.calculateItemTotal(formGroup);
    }
    // Update overall totals
    this.calculateTotals();
  }

  /**
   * Select a doctor from search results
   * @param doctor The doctor to select
   */
  selectDoctor(doctor: any): void {
    if (doctor) {
      this.prescriptionForm.patchValue({
        doctorId: doctor.id,
        doctorName: doctor.name
      });
      this.selectedDoctor = doctor;
      this.showDoctorSearch = false;
    }
  }
  
  

  /**
   * Add a new sale item to the form
   */

  /**
   * Add a new sale item to the form
   */
  addSaleItem(): void {
    const itemGroup = this.fb.group({
      medicineId: ['', Validators.required],
      medicineName: ['', Validators.required],
      generic: [''],
      mfg: [''], // Manufacturer
      batchNo: [''], // Make batch field editable for dropdown selection
      expDate: [''], // Expiry Date
      dosage: ['1-0-1'],
      duration: ['5 Days'],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitCost: [{value: 0, disabled: true}],
      unitMrp: [{value: 0, disabled: true}],
      mrp: [{value: 0, disabled: true}, Validators.required],
      discount: [0],
      discountPct: [0],
      taxProfileId: [''],
      taxPercentage: [{value: 0, disabled: true}],
      cgstPercentage: [{value: 0, disabled: true}],
      sgstPercentage: [{value: 0, disabled: true}],
      // Add actual tax amount fields that will be used in the API
      cgst: [{value: 0, disabled: true}],
      sgst: [{value: 0, disabled: true}],
      taxableAmount: [{value: 0, disabled: true}],
      total: [{value: 0, disabled: true}]
    });
    
    // Auto-calculate on quantity change
    itemGroup.get('quantity')?.valueChanges.subscribe(() => this.calculateItemTotal(itemGroup));
    itemGroup.get('discount')?.valueChanges.subscribe(() => this.calculateItemTotal(itemGroup));
    
    // Subscribe to batch changes to update related fields
    itemGroup.get('batchNo')?.valueChanges.subscribe((selectedBatchNo) => {
      if (selectedBatchNo) {
        this.onBatchChange(itemGroup, String(selectedBatchNo));
      }
    });
    
    // Subscribe to tax profile changes for immediate recalculation
    itemGroup.get('taxProfileId')?.valueChanges.subscribe((taxProfileId) => {
      console.log('New item tax profile changed:', taxProfileId, 'Form group value:', itemGroup.value);
      // Always call onTaxProfileChange - it has its own null/undefined handling
      this.onTaxProfileChange(itemGroup);
    });
    
    this.itemsFormArray.push(itemGroup);
  }

  /**
   * Remove a sale item from the form
   * @param index The index of the item to remove
   */
  removeSaleItem(index: number): void {
    this.itemsFormArray.removeAt(index);
    this.calculateTotals();
  }
  
  /**
   * Calculate the item total based on quantity, price, discount and tax
   * NEW LOGIC: Calculate tax first, then apply discount from total amount (including tax)
   */
  calculateItemTotal(itemGroup: AbstractControl | FormGroup): void {
    // Ensure we're working with a FormGroup
    const formGroup = itemGroup as FormGroup;
    
    const quantity = Math.abs(+formGroup.get('quantity')?.value || 0);
    const unitCost = Math.abs(+formGroup.get('unitCost')?.value || 0);
    const unitMrp = Math.abs(+formGroup.get('unitMrp')?.value || 0);
    const discount = Math.abs(+formGroup.get('discount')?.value || 0);
    
    // Validate inputs
    if (quantity <= 0 || unitMrp <= 0) {
      console.warn('Invalid quantity or unit MRP:', { quantity, unitMrp });
      // Set default values to prevent negative calculations
      formGroup.patchValue({
        taxableAmount: 0,
        cgst: 0,
        sgst: 0,
        taxAmount: 0,
        total: 0,
        mrp: 0
      }, { emitEvent: false });
      return;
    }
    
    // Calculate base values WITHOUT discount first
    const grossPrice = Math.abs(unitMrp * quantity);
    
    // Get GST type from form
    const gstType = this.prescriptionForm.get('gstType')?.value || 'INCLUSIVE';
    
    // Get tax percentages from form controls (set by onTaxProfileChange)
    const taxPercent = +formGroup.get('taxPercentage')?.value || 0;
    const cgstPercent = +formGroup.get('cgstPercentage')?.value || 0;
    const sgstPercent = +formGroup.get('sgstPercentage')?.value || 0;
    
    // Initialize variables for tax calculations
    let taxableAmount = grossPrice;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let totalWithTax = grossPrice;
    
    // STEP 1: Calculate tax on gross price (before discount)
    if (gstType === GstType.NON_GST) {
      // No tax calculation needed
      taxableAmount = grossPrice;
      cgstAmount = 0;
      sgstAmount = 0;
      totalWithTax = grossPrice;
    } else if (gstType === GstType.INCLUSIVE) {
      // For inclusive GST: taxable amount = price / (1 + tax percentage/100)
      taxableAmount = taxPercent > 0 ? grossPrice / (1 + (taxPercent / 100)) : grossPrice;
      
      // Calculate tax from the taxable amount
      cgstAmount = (taxableAmount * cgstPercent) / 100;
      sgstAmount = (taxableAmount * sgstPercent) / 100;
      
      // For inclusive GST, total already includes tax
      totalWithTax = grossPrice;
    } else { // EXCLUSIVE
      // For exclusive GST: taxable amount is gross price
      taxableAmount = grossPrice;
      
      // Calculate tax from the taxable amount
      cgstAmount = (taxableAmount * cgstPercent) / 100;
      sgstAmount = (taxableAmount * sgstPercent) / 100;
      
      // For exclusive GST, total is taxable amount + tax amount
      totalWithTax = taxableAmount + cgstAmount + sgstAmount;
    }
    
    // STEP 2: Apply discount to the total amount (including tax)
    const discountAmount = (totalWithTax * discount) / 100;
    const finalTotal = totalWithTax - discountAmount;
    
    // STEP 3: Recalculate taxable amount and tax after discount for accurate reporting
    let finalTaxableAmount = taxableAmount;
    let finalCgstAmount = cgstAmount;
    let finalSgstAmount = sgstAmount;
    
    if (discount > 0) {
      // Apply discount proportionally to taxable amount and tax
      const discountRatio = (100 - discount) / 100;
      finalTaxableAmount = taxableAmount * discountRatio;
      finalCgstAmount = cgstAmount * discountRatio;
      finalSgstAmount = sgstAmount * discountRatio;
    }
    
    // Ensure all calculated values are positive
    const safeFinalTaxableAmount = Math.abs(finalTaxableAmount);
    const safeFinalCgstAmount = Math.abs(finalCgstAmount);
    const safeFinalSgstAmount = Math.abs(finalSgstAmount);
    const safeFinalTotal = Math.abs(finalTotal);
    const safeGrossPrice = Math.abs(grossPrice);
    
    // Update form with calculated values
    formGroup.patchValue({
      taxableAmount: +safeFinalTaxableAmount.toFixed(2),
      cgst: +safeFinalCgstAmount.toFixed(2),
      sgst: +safeFinalSgstAmount.toFixed(2),
      taxAmount: +(safeFinalCgstAmount + safeFinalSgstAmount).toFixed(2),
      total: +safeFinalTotal.toFixed(2),
      mrp: +safeGrossPrice.toFixed(2)
    }, { emitEvent: false });
    
    console.log(`Item calculation for discount ${discount}%:`, {
      grossPrice: grossPrice.toFixed(2),
      totalWithTax: totalWithTax.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      finalTotal: finalTotal.toFixed(2),
      gstType,
      taxPercent
    });
    
    // Mark form as dirty to ensure UI updates
    formGroup.markAsDirty();
    
    // Always recalculate overall totals
    this.calculateTotals();
  }

  /**
   * Handle discount change - allow recalculation after user modifications
   */
  onDiscountChange(): void {
    // Mark that user has modified the form (allows recalculation in edit mode)
    this.userHasModifiedForm = true;
    
    // Always recalculate when user changes discount
    this.calculateTotals();
  }

  /**
   * Calculate the overall totals for the sale based on GST type
   * NEW LOGIC: Apply overall discount from total amount (including tax) for all GST types
   */
  calculateTotals(): void {
    // Skip calculation only during initial form population in edit mode
    // Allow recalculation once user starts making changes
    if (this.isEditMode && !this.userHasModifiedForm) {
      console.log('Skipping calculateTotals() during initial edit mode population - preserving API values');
      return;
    }
    
    // Reset totals before calculation
    this.subtotal = 0;
    this.discount = 0;
    this.tax = 0;
    this.cgstTotal = 0;
    this.sgstTotal = 0;
    this.grandTotal = 0;
    
    // Get current GST type
    const gstType = this.prescriptionForm.get('gstType')?.value || GstType.INCLUSIVE;
    
    // Sum up all items (these already have individual discounts applied)
    const itemsArray = this.itemsFormArray;

    let totalBeforeAnyDiscount = 0; // This will be the true "Total Before Discount"
    let finalGrandTotal = 0; // This will be the final amount after all discounts and taxes
    
    itemsArray.controls.forEach((itemControl: AbstractControl) => {
      const itemGroup = itemControl as FormGroup;
      
      // Get values from the item (already calculated with individual discounts)
      const total = Math.abs(+itemGroup.get('total')?.value || 0); // Ensure positive
      const taxableAmount = Math.abs(+itemGroup.get('taxableAmount')?.value || 0); // Ensure positive
      const cgst = Math.abs(+itemGroup.get('cgst')?.value || 0); // Ensure positive
      const sgst = Math.abs(+itemGroup.get('sgst')?.value || 0); // Ensure positive
      const unitMrp = Math.abs(+itemGroup.get('unitMrp')?.value || 0); // Ensure positive
      const quantity = Math.abs(+itemGroup.get('quantity')?.value || 0); // Ensure positive
      const discount = Math.abs(+itemGroup.get('discount')?.value || 0); // Ensure positive
      
      // Debug logging for negative values
      if (+itemGroup.get('total')?.value < 0 || +itemGroup.get('taxableAmount')?.value < 0) {
        console.warn('Found negative values in item:', {
          originalTotal: +itemGroup.get('total')?.value,
          originalTaxableAmount: +itemGroup.get('taxableAmount')?.value,
          medicineId: itemGroup.get('medicineId')?.value,
          medicineName: itemGroup.get('medicineName')?.value
        });
      }
      
      // Calculate gross amount before any discount (Unit MRP * quantity)
      const grossAmount = unitMrp * quantity;
      
      // For "Total Before Discount", we need the total amount before any discounts
      // This should be the gross amount with tax applied (depending on GST type)
      let grossTotalWithTax = grossAmount;
      
      if (gstType === GstType.EXCLUSIVE) {
        // For exclusive GST, tax is added on top of the gross amount
        const taxProfile = this.taxProfiles.find(tp => tp.taxProfileId === itemGroup.get('taxProfileId')?.value);
        if (taxProfile) {
          const taxRate = Math.abs(taxProfile.totalRate || 0);
          const grossTaxAmount = (grossAmount * taxRate) / 100;
          grossTotalWithTax = grossAmount + grossTaxAmount;
        }
      }
      // For inclusive GST and non-GST, the gross amount already represents the total before discount
      
      totalBeforeAnyDiscount += grossTotalWithTax;
      
      // Calculate individual item discount amount for display
      const itemDiscountAmount = (grossAmount * discount) / 100;
      
      // Add to running totals
      this.subtotal += taxableAmount;
      this.discount += itemDiscountAmount;
      this.cgstTotal += cgst;
      this.sgstTotal += sgst;
      this.tax += cgst + sgst;
      
      // Add the final item total (after discount and tax) to grand total
      finalGrandTotal += total;

    });
    
    // Set total before discount to show the true amount before ANY discounts
    this.totalBeforeDiscount = Math.abs(totalBeforeAnyDiscount);
    
    // Set grand total to the final amount after all discounts and taxes
    this.grandTotal = Math.abs(finalGrandTotal);
    
    // Format to 2 decimal places
    this.subtotal = +this.subtotal.toFixed(2);
    this.totalBeforeDiscount = +this.totalBeforeDiscount.toFixed(2);
    this.discount = +this.discount.toFixed(2);
    this.tax = +this.tax.toFixed(2);
    this.cgstTotal = +this.cgstTotal.toFixed(2);
    this.sgstTotal = +this.sgstTotal.toFixed(2);
    this.grandTotal = +this.grandTotal.toFixed(2);
    
    // Update form controls with calculated totals
    this.prescriptionForm.patchValue({
      subtotal: this.subtotal,
      discount: this.discount, // This now shows the overall discount amount
      tax: this.tax,
      cgstTotal: this.cgstTotal,
      sgstTotal: this.sgstTotal,
      grandTotal: this.grandTotal,
      total: this.grandTotal
    }, { emitEvent: false });
  }

  /**
   * Set up subscriptions for tax profile changes
   */
  setupTaxProfileChangeSubscriptions(): void {
    // Subscribe to existing items
    if(this.itemsFormArray && this.itemsFormArray.controls) {
      this.itemsFormArray.controls.forEach((control: AbstractControl) => {
        const itemGroup = control as FormGroup;
        const taxProfileControl = itemGroup.get('taxProfileId');
        
        if(taxProfileControl) {
          this.subscriptions.add(
            taxProfileControl.valueChanges.subscribe((taxProfileId: string) => {
              if (taxProfileId !== undefined) {
                this.onTaxProfileChange(itemGroup);
              }
            })
          );
        }
      });
    }
  }

  /**
   * Load tax profiles from API
   */
  loadTaxProfiles(): void {
    this.loadingTaxProfiles = true;
    this.http.get<TaxProfile[]>(`${this.apiUrl}/api/inventory/masters/tax-profiles`)
      .pipe(
        catchError(error => {
          console.error('Error loading tax profiles:', error);
          this.loadingTaxProfiles = false;
          
          // Load sample tax profiles if API fails
          return of([] as TaxProfile[]);
        })
      )
      .subscribe(profiles => {
        this.taxProfiles = profiles;
        console.log('Tax profiles loaded:', this.taxProfiles);
        this.loadingTaxProfiles = false;
      });
  }

  /**
   * Handle tax profile change for a specific item
   */
  onTaxProfileChange(itemGroup: AbstractControl | FormGroup): void {
    // Ensure we're working with a FormGroup
    const formGroup = itemGroup as FormGroup;
    
    // Get the tax profile ID directly from the form control
    const taxProfileId = formGroup.get('taxProfileId')?.value;
    console.log('onTaxProfileChange - Tax Profile ID:', taxProfileId);
    console.log('onTaxProfileChange - Available tax profiles:', this.taxProfiles);
    
    if (!taxProfileId || taxProfileId === '') {
      console.log('No tax profile selected, resetting tax values');
      // Reset tax values if no profile is selected
      formGroup.patchValue({
        taxPercentage: 0,
        cgstPercentage: 0,
        sgstPercentage: 0
      });
      this.calculateItemTotal(formGroup);
      return;
    }
    
    // Find the selected tax profile
    const taxProfile = this.taxProfiles.find(profile => profile.taxProfileId === taxProfileId);
    console.log('Found tax profile:', taxProfile);
    
    if (taxProfile) {
      console.log('Tax profile found:', taxProfile);
      
      // Extract CGST and SGST components
      const cgstComponent = taxProfile.components.find(comp => comp.name === 'CGST');
      const sgstComponent = taxProfile.components.find(comp => comp.name === 'SGST');
      
      // Set tax rates in the form
      formGroup.patchValue({
        taxPercentage: taxProfile.totalRate,
        cgstPercentage: cgstComponent?.rate || 0,
        sgstPercentage: sgstComponent?.rate || 0
      });
      
      // Log before/after values for debugging
      console.log('Before recalculation:', {
        taxProfileId: taxProfileId,
        taxRate: taxProfile.totalRate,
        cgst: cgstComponent?.rate || 0,
        sgst: sgstComponent?.rate || 0
      });
      
      // Recalculate with new tax rates
      this.calculateItemTotal(formGroup);
      
      // Recalculate the entire form totals
      this.calculateTotals();
      
      // Log after values
      console.log('After recalculation:', {
        taxableAmount: formGroup.get('taxableAmount')?.value,
        cgst: formGroup.get('cgst')?.value,
        sgst: formGroup.get('sgst')?.value,
        total: formGroup.get('total')?.value
      });
    }
  }
  
  /**
   * Format a date object to MM/YYYY string format
   * @param date The date to format
   * @returns The formatted date string
   */
  formatDate(date: Date): string {
    if (!date) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${year}`;
  }

  /**
   * Get available batches for a medicine at a specific form index
   * @param index The index of the item in the form array
   * @returns Array of available batches for the selected medicine
   */
  getBatchesForMedicine(index: number): MedicineBatch[] {
    const formGroup = this.itemsFormArray.at(index) as FormGroup;
    const medicineId = formGroup.get('medicineId')?.value;
    const medicineName = formGroup.get('medicineName')?.value;
    
    console.log(`Getting batches for medicine at index ${index}, ID: ${medicineId}, Name: ${medicineName}`);
    
    if (!medicineId) {
      console.log('No medicine ID available');
      return [];
    }
    
    if (!this.medicineBatches[medicineId]) {
      console.log(`No batches stored for medicine ID: ${medicineId}`);
      return [];
    }
    
    console.log(`Found ${this.medicineBatches[medicineId].length} batches for medicine ID: ${medicineId}`, this.medicineBatches[medicineId]);
    return this.medicineBatches[medicineId];
  }
  
  
  
  /**
   * Handle quantity change for a medicine
   * @param event Change event from quantity input
   * @param index Index of the item in the form array
   */
  onQuantityChange(event: any, index: number): void {
    const formGroup = this.itemsFormArray.at(index) as FormGroup;
    const newQuantity = parseInt(event.target.value, 10) || 0;
    const unitMrp = formGroup.get('unitMrp')?.value || 0;
    
    console.log(`Quantity changed at index ${index} to: ${newQuantity}, unit MRP: ${unitMrp}`);
    
    // Mark that user has modified the form (allows recalculation in edit mode)
    this.userHasModifiedForm = true;
    
    // Update the MRP based on quantity * unitMrp
    formGroup.patchValue({
      mrp: unitMrp * newQuantity
    }, { emitEvent: false });
    
    // Apply tax profile if one is selected
    this.onTaxProfileChange(formGroup);
    
    // Recalculate item total
    this.calculateItemTotal(formGroup);
    
    // Update overall totals
    this.calculateTotals();
    
    // Force change detection to update UI immediately
    this.cdr.detectChanges();
    
    console.log('Updated totals after quantity change:', {
      subtotal: this.subtotal,
      discount: this.discount,
      tax: this.tax,
      grandTotal: this.grandTotal
    });
  }
  
  /**
   * Handle line item discount change
   * @param index Index of the item in the form array
   */
  onLineItemDiscountChange(index: number): void {
    const formGroup = this.itemsFormArray.at(index) as FormGroup;
    
    console.log(`Line item discount changed at index ${index}`);
    
    // Mark that user has modified the form (allows recalculation in edit mode)
    this.userHasModifiedForm = true;
    
    // Recalculate item total
    this.calculateItemTotal(formGroup);
    
    // Update overall totals
    this.calculateTotals();
  }
  
  /**
   * Handle tax profile selection change
   * @param index Index of the item in the form array
   */
  onTaxProfileSelectionChange(index: number): void {
    const formGroup = this.itemsFormArray.at(index) as FormGroup;
    const selectedTaxProfileId = formGroup.get('taxProfileId')?.value;
    
    console.log(`Tax profile selection changed at index ${index} to:`, selectedTaxProfileId);
    console.log('Current form group values before change:', {
      cgstPercentage: formGroup.get('cgstPercentage')?.value,
      sgstPercentage: formGroup.get('sgstPercentage')?.value,
      taxPercentage: formGroup.get('taxPercentage')?.value
    });
    
    // Mark that user has modified the form (allows recalculation in edit mode)
    this.userHasModifiedForm = true;
    
    // Apply the new tax profile
    this.onTaxProfileChange(formGroup);
    
    console.log('Form group values after tax profile change:', {
      cgstPercentage: formGroup.get('cgstPercentage')?.value,
      sgstPercentage: formGroup.get('sgstPercentage')?.value,
      taxPercentage: formGroup.get('taxPercentage')?.value
    });
    
    // Recalculate item total
    this.calculateItemTotal(formGroup);
    
    // Update overall totals
    this.calculateTotals();
    
    console.log('Summary totals after tax profile change:', {
      cgstTotal: this.cgstTotal,
      sgstTotal: this.sgstTotal,
      tax: this.tax,
      grandTotal: this.grandTotal
    });
  }
  
  /**
   * Debug tax calculations for the given item
   * Shows detailed calculation steps for debugging
   */
  debugTaxCalculation(index: number = 0): void {
    if (!this.itemsFormArray || this.itemsFormArray.length === 0) {
      console.error('No items to debug');
      return;
    }
    
    const itemGroup = this.itemsFormArray.at(index) as FormGroup;
    if (!itemGroup) {
      console.error(`No item found at index ${index}`);
      return;
    }
    
    // Get all the relevant values
    const quantity = +itemGroup.get('quantity')?.value || 0;
    const unitMrp = +itemGroup.get('unitMrp')?.value || 0;
    const discount = +itemGroup.get('discount')?.value || 0;
    const taxProfileId = itemGroup.get('taxProfileId')?.value;
    const taxPercent = +itemGroup.get('taxPercentage')?.value || 0;
    const cgstPercent = +itemGroup.get('cgstPercentage')?.value || 0;
    const sgstPercent = +itemGroup.get('sgstPercentage')?.value || 0;
    
    // Calculate intermediate values
    const grossPrice = unitMrp * quantity;
    const discountAmount = (grossPrice * discount) / 100;
    const discountedPrice = grossPrice - discountAmount;
    
    // Get GST type
    const gstType = this.prescriptionForm.get('gstType')?.value || 'INCLUSIVE';
    
    // Log debug info
    console.log('===== TAX CALCULATION DEBUG =====');
    console.log('Item:', itemGroup.get('medicineName')?.value);
    console.log('Basic Values:', {
      quantity,
      unitMrp,
      discount: `${discount}%`,
      grossPrice,
      discountAmount,
      discountedPrice
    });
    
    console.log('Tax Profile:', {
      id: taxProfileId,
      taxPercent: `${taxPercent}%`,
      cgstPercent: `${cgstPercent}%`,
      sgstPercent: `${sgstPercent}%`,
      gstType
    });
    
    // Calculate expected values based on GST type
    let expectedTaxableAmount = 0;
    let expectedCgst = 0;
    let expectedSgst = 0;
    let expectedTotal = 0;
    
    if (gstType === 'NON_GST') {
      expectedTaxableAmount = discountedPrice;
      expectedTotal = discountedPrice;
      console.log('NON_GST calculation:', {
        taxableAmount: expectedTaxableAmount,
        total: expectedTotal
      });
    } else if (gstType === 'INCLUSIVE') {
      expectedTaxableAmount = taxPercent > 0 ? discountedPrice / (1 + (taxPercent / 100)) : discountedPrice;
      expectedCgst = (expectedTaxableAmount * cgstPercent) / 100;
      expectedSgst = (expectedTaxableAmount * sgstPercent) / 100;
      expectedTotal = discountedPrice;
      
      console.log('INCLUSIVE GST calculation:', {
        taxableAmount: expectedTaxableAmount.toFixed(2),
        cgst: expectedCgst.toFixed(2),
        sgst: expectedSgst.toFixed(2),
        total: expectedTotal.toFixed(2)
      });
    } else { // EXCLUSIVE
      expectedTaxableAmount = discountedPrice;
      expectedCgst = (expectedTaxableAmount * cgstPercent) / 100;
      expectedSgst = (expectedTaxableAmount * sgstPercent) / 100;
      expectedTotal = expectedTaxableAmount + expectedCgst + expectedSgst;
      
      console.log('EXCLUSIVE GST calculation:', {
        taxableAmount: expectedTaxableAmount.toFixed(2),
        cgst: expectedCgst.toFixed(2),
        sgst: expectedSgst.toFixed(2),
        total: expectedTotal.toFixed(2)
      });
    }
    
    // Compare with actual values in form
    console.log('Form Values:', {
      taxableAmount: itemGroup.get('taxableAmount')?.value,
      cgst: itemGroup.get('cgst')?.value,
      sgst: itemGroup.get('sgst')?.value,
      total: itemGroup.get('total')?.value
    });
    
    console.log('===== END TAX CALCULATION DEBUG =====');
  }
  
} 
