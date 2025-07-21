import { Component, OnInit, OnDestroy, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { InventoryService } from '../../services/inventory.service';
import { Patient, Doctor, CreateOtcSaleRequest, SaleItemDto } from '../../services/inventory.service';
import { Medicine, StockStatus, TaxProfile } from '../../models/inventory.models';
import { Observable, Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, map, switchMap, tap } from 'rxjs/operators';

interface SaleItemForm {
  medicineId: string;
  medicineName: string;
  quantity: number;
  mrp: number;
  discount: number;
  taxPercentage: number;
  total: number;
}

interface MedicineSearchEvent {
  term: string;
  itemIndex: number;
}

// Interface for medicine batch data
interface MedicineBatch {
  batchNo: string;
  expiryDate: Date | null;
  mrp: number;
  unitCost: number;
  purchaseId?: string;
  referenceId?: string;
  packQuantity?: number;
  itemsPerPack?: number;
}

@Component({
  selector: 'app-sales-otc-form',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './sales-otc-form.component.html',
  styleUrls: ['./sales-otc-form.component.scss']
})
export class SalesOtcFormComponent implements OnInit, OnDestroy {
  taxProfiles: TaxProfile[] = [];
  gstTypes = [
    { value: 'INCLUSIVE', label: 'GST Inclusive' },
    { value: 'EXCLUSIVE', label: 'GST Exclusive' },
    { value: 'NON_GST', label: 'Non-GST' }
  ];
  saleForm: FormGroup;
  medicines: Medicine[] = [];
  filteredMedicines: Medicine[] = [];
  searchMedicineTerm: string = '';
  medicineSearchResults: Medicine[] = [];
  showMedicineSearch = false;
  loadingMedicines = false;
  loadingMedicineSearch = false;
  submitting = false;
  
  // Patient search properties
  patients: Patient[] = [];
  patientSearchResults: Patient[] = [];
  showPatientSearch = false;
  loadingPatients = false;
  selectedPatient: Patient | null = null;
  private patientSearchTerms = new Subject<string>();
  private medicineSearchTerm = new Subject<MedicineSearchEvent>();
  
  // Doctor search properties
  doctors: Doctor[] = [];
  doctorSearchResults: Doctor[] = [];
  showDoctorSearch = false;
  loadingDoctors = false;
  selectedDoctor: Doctor | null = null;
  private doctorSearchTerms = new Subject<string>();
  
  // Flag for API vs local search
  useApiSearch = true;
  
  // Medicine search tracking
  activeSearchIndex = -1; // Tracks which row is currently being searched
  
  // Batch related properties
  loadingBatches = false;
  medicineBatches: { [medicineId: string]: MedicineBatch[] } = {};
  currentMedicineIndex = -1;
  
  private subscriptions: Subscription = new Subscription();
  
  // Payment methods and status options
  paymentMethods = ['CASH', 'CARD', 'UPI', 'CREDIT'];
  paymentStatusOptions = ['PAID', 'PENDING', 'CREDIT'];
  
  // Edit mode properties
  isEditMode = false;
  editSaleId: string | null = null;
  loadingSaleData = false;
  
  /**
   * Generate a unique transaction reference in format TRX-YYYYMMDD-HHMMSS-XXX
   */
  generateTransactionReference(): string {
    const now = new Date();
    const datePart = now.getFullYear().toString() +
                    (now.getMonth() + 1).toString().padStart(2, '0') +
                    now.getDate().toString().padStart(2, '0');
    const timePart = now.getHours().toString().padStart(2, '0') +
                    now.getMinutes().toString().padStart(2, '0') +
                    now.getSeconds().toString().padStart(2, '0');
    const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `TRX-${datePart}-${timePart}-${randomPart}`;
  }
  
  // Totals
  subtotal: number = 0;
  discount: number = 0;
  tax: number = 0;
  total: number = 0;

  constructor(
    private fb: FormBuilder,
    private inventoryService: InventoryService,
    private router: Router,
    private http: HttpClient,
    private route: ActivatedRoute
  ) {
    this.saleForm = this.fb.group({
      // Patient/Customer Information
      patientName: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      patientAddress: ['', Validators.required],
      dateOfBirth: [''],
      age: [''],
      gender: [''],
      
      // Invoice Information
      doctorName: [''],
      saleDate: [this.getCurrentDate(), Validators.required],
      gstType: ['INCLUSIVE'], // Default to inclusive GST
      printGst: [false],
      
      // Payment Information
      paymentMethod: ['CASH', Validators.required],
      paymentStatus: ['PAID', Validators.required],
      transactionReference: [this.generateTransactionReference(), Validators.required],
      
      // Sale Items and Totals
      items: this.fb.array([]),
      overallDiscount: [0],
      subtotal: [0],
      discount: [0],
      tax: [0],
      cgstTotal: [0], // For tax breakdown display
      sgstTotal: [0], // For tax breakdown display
      total: [0],
      notes: ['']
    });
  }

  ngOnInit(): void {
    // Check if we're in edit mode
    this.route.paramMap.subscribe(params => {
      const saleId = params.get('id');
      
      if (saleId) {
        this.isEditMode = true;
        this.editSaleId = saleId;
        this.loadSaleData(saleId);
      } else {
        // Add an empty item in create mode only
        this.addSaleItem();
      }
    });
    
    this.loadMedicines();
    this.loadPatients();
    this.loadDoctors();
    this.loadTaxProfiles();
    this.setupPatientSearch();
    this.setupMedicineSearch();
    this.setupDoctorSearch();
    this.setupFormValueChangeSubscriptions();

    // Initialize calculations
    this.calculateTotals();
  }
  
  /**
   * Load sale data for editing
   * @param saleId The ID of the sale to load
   */
  loadSaleData(saleId: string): void {
    this.loadingSaleData = true;
    
    this.inventoryService.getSaleById(saleId).subscribe({
      next: (sale) => {
        if (sale && sale.saleType === 'OTC') {
          // Clear existing items before populating form
          this.clearItems();
          
          // Populate the form with sale data
          this.populateFormWithSaleData(sale);
          
          console.log('Sale data loaded successfully for editing');
        } else {
          alert('Invalid sale type or data. Only OTC sales can be edited.');
          this.router.navigate(['/inventory/sales']);
        }
        this.loadingSaleData = false;
      },
      error: (error) => {
        console.error('Error loading sale data:', error);
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
    const itemsArray = this.saleForm.get('items') as FormArray;
    while (itemsArray.length) {
      itemsArray.removeAt(0);
    }
  }
  
  /**
   * Populate form with sale data for editing
   * @param sale The sale data to populate
   */
  populateFormWithSaleData(sale: any): void {
    console.log('Populating form with sale data:', sale);
    
    // Map API field names to form field names
    this.saleForm.patchValue({
      patientName: sale.walkInCustomerName || sale.patientName || '',
      phoneNumber: sale.walkInCustomerMobile || sale.phoneNumber || '',
      patientAddress: sale.patientAddress || sale.address || '',
      saleDate: this.formatDateForInput(this.parseSaleDate(sale.saleDate) || sale.date),
      gstType: sale.gstType || 'INCLUSIVE',
      printGst: !!sale.printGst,
      paymentMethod: sale.paymentMode || sale.paymentMethod || 'CASH',
      paymentStatus: sale.paymentStatus || 'PAID',
      transactionReference: sale.transactionReference || this.generateTransactionReference(),
      overallDiscount: sale.overallDiscount || 0,
      subtotal: sale.totalMrpAmount || sale.subtotal || 0,
      discount: sale.totalDiscountAmount || sale.discount || 0,
      tax: sale.totalTaxAmount || sale.tax || 0,
      cgstTotal: sale.cgstAmount || 0,
      sgstTotal: sale.sgstAmount || 0,
      total: sale.grandTotal || sale.totalAmount || sale.netAmount || 0,
      notes: sale.notes || ''
    });
    
    // Add sale items
    if (sale.items && Array.isArray(sale.items)) {
      console.log('Adding sale items:', sale.items);
      
      // We'll use setTimeout to ensure the form is fully initialized
      // before adding items
      setTimeout(() => {
        sale.items.forEach((item: any) => {
          this.addSaleItemWithData(item);
        });
        
        // Recalculate totals after adding items
        setTimeout(() => {
          this.calculateTotals();
        }, 500);
      }, 100);
    } else {
      console.error('No items found in sale data or items is not an array');
    }
  }
  
  /**
   * Parse sale date from API response
   * @param saleDate Date from API which may be in seconds format
   */
  parseSaleDate(saleDate: any): string {
    if (!saleDate) return '';
    
    try {
      // Handle the case where date comes as an object with seconds and nanos
      if (saleDate && typeof saleDate === 'object' && saleDate.seconds) {
        // Convert seconds to milliseconds and create a Date object
        const date = new Date(saleDate.seconds * 1000);
        return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
      }
      
      // Handle string date
      if (typeof saleDate === 'string') {
        const date = new Date(saleDate);
        return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
      }
      
      return '';
    } catch (e) {
      console.error('Error parsing sale date:', e);
      return '';
    }
  }
  
  /**
   * Format date string for input field (YYYY-MM-DD)
   */
  formatDateForInput(dateStr: string): string {
    if (!dateStr) return this.getCurrentDate();
    
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
    } catch (e) {
      return this.getCurrentDate();
    }
  }
  
  /**
   * Add a sale item with data for editing
   */
  addSaleItemWithData(itemData: any): void {
    console.log('Adding item with data:', itemData);
    
    // Create a complete item form immediately with default values
    const itemsArray = this.saleForm.get('items') as FormArray;
    
    // Create form group with all required fields first
    const newItem = this.fb.group({
      medicineId: [itemData.medicineId || '', Validators.required],
      medicineName: ['Loading...', Validators.required],
      manufacturer: [''],
      batchNo: [itemData.batchNo || 'N/A'],
      expiryDate: [''],
      quantity: [itemData.quantity || 0, [Validators.required, Validators.min(1)]],
      mrp: [itemData.mrpPerItem || 0, [Validators.required, Validators.min(0)]],
      unitCost: [itemData.salePrice || itemData.mrpPerItem || 0],
      discount: [itemData.discountPercentage || 0, Validators.min(0)],
      taxPercentage: [itemData.taxRateApplied || 0],
      taxableAmount: [itemData.lineItemTaxableAmount || 0],
      cgstPercentage: [0],
      sgstPercentage: [0],
      cgstAmount: [itemData.taxAmount ? itemData.taxAmount / 2 : 0],
      sgstAmount: [itemData.taxAmount ? itemData.taxAmount / 2 : 0],
      total: [itemData.lineItemTotalAmount || 0]
    });
    
    // Add to form array immediately to prevent "Cannot find control" errors
    itemsArray.push(newItem);
    
    // Then load medicine details asynchronously
    this.loadMedicineDetailsAndUpdate(itemData.medicineId, newItem);
  }
  
  /**
   * Load medicine details and update the form item
   */
  private loadMedicineDetailsAndUpdate(medicineId: string, formGroup: FormGroup): void {
    // First check the medicines list (which might be populated)
    const existingMedicine = this.medicines.find(m => m.id === medicineId);
    
    if (existingMedicine) {
      console.log('Found medicine in cache:', existingMedicine);
      this.updateMedicineItemFormGroup(formGroup, existingMedicine);
      return;
    }
    
    // If not found, try to fetch from API
    this.inventoryService.getMedicineById(medicineId).subscribe({
      next: (medicine) => {
        console.log('Loaded medicine details from API:', medicine);
        this.updateMedicineItemFormGroup(formGroup, medicine);
      },
      error: (err) => {
        console.error('Failed to load medicine details:', err);
      }
    });
  }
  
  /**
   * Update the form group with medicine details
   */
  private updateMedicineItemFormGroup(formGroup: FormGroup, medicine: any): void {
    if (!medicine) return;
    
    formGroup.patchValue({
      medicineName: medicine.name || 'Unknown Medicine',
      manufacturer: medicine.manufacturer || ''
    });
    
    // Re-calculate the item total to ensure consistency
    this.calculateItemTotal(formGroup);
  }
  
  /**
   * Load medicine details by ID
   * @param medicineId The ID of the medicine to load
   * @returns Promise with medicine details
   */
  private loadMedicineDetails(medicineId: string): Promise<any> {
    return new Promise((resolve) => {
      // Try to find medicine in the existing medicines list first
      const existingMedicine = this.medicines.find(m => m.id === medicineId);
      if (existingMedicine) {
        resolve(existingMedicine);
        return;
      }
      
      // If not found, fetch from API
      this.inventoryService.getMedicineById(medicineId).subscribe({
        next: (medicine) => {
          resolve(medicine);
        },
        error: () => {
          console.error('Failed to load medicine details for ID:', medicineId);
          resolve(null); // Resolve with null on error
        }
      });
    });
  }
  
  /**
   * Setup medicine search with debouncing
   */
  private setupMedicineSearch(): void {
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
  
  /**
   * Setup doctor search with debouncing
   */
  private setupDoctorSearch(): void {
    // Set up value changes subscription for doctor name
    const doctorNameControl = this.saleForm.get('doctorName');
    if (doctorNameControl) {
      this.subscriptions.add(
        doctorNameControl.valueChanges.pipe(
          debounceTime(300),
          distinctUntilChanged(),
          tap(term => {
            // Only show dropdown if actively typing and not from selection
            if (term && term.length > 1) {
              this.showDoctorSearch = true;
            }
          }),
          switchMap(term => {
            if (!term || term.length < 2) return of([]);
            this.loadingDoctors = true;
            return this.inventoryService.searchDoctors(term).pipe(
              catchError(() => of([])), // fallback to empty array on error
              finalize(() => this.loadingDoctors = false)
            );
          })
        ).subscribe(doctors => {
          this.doctorSearchResults = doctors;
        })
      );
    }
  }
  
  /**
   * Manually trigger doctor search
   */
  searchDoctorsManually(): void {
    const term = this.saleForm.get('doctorName')?.value;
    this.loadingDoctors = true;
    
    // Use the service to search doctors
    this.inventoryService.searchDoctors(term || '').subscribe(
      (doctors) => {
        this.doctorSearchResults = doctors;
        this.showDoctorSearch = true;
        this.loadingDoctors = false;
      },
      (err) => {
        console.error('Error searching doctors manually:', err);
        this.loadingDoctors = false;
        this.showDoctorSearch = true;
        this.doctorSearchResults = this.doctors.length > 0 ? 
          this.doctors : this.inventoryService.getSampleDoctors();
      }
    );
  }
  
  /**
   * Select a doctor from search results
   * @param doctor The doctor to select
   */
  selectDoctor(doctor: Doctor): void {
    // Set selected doctor name and hide search results
    if (doctor) {
      console.log('Selected doctor:', doctor);
      
      // Update the form controls
      this.saleForm.patchValue({
        doctorName: doctor.name,
        doctorId: doctor.id
      });
      
      // Update our local doctor reference
      this.selectedDoctor = doctor;
      
      // Hide the dropdown
      this.showDoctorSearch = false;
    }
  }
  
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Setup all form value change subscriptions for automatic calculations
   */
  private setupFormValueChangeSubscriptions(): void {
    // Subscribe to overall discount changes
    this.subscriptions.add(
      this.saleForm.get('overallDiscount')?.valueChanges.subscribe(() => {
        this.calculateTotals();
      })
    );
    
    // Subscribe to item array changes to recalculate when items are added/removed
    this.subscriptions.add(
      this.itemsFormArray.valueChanges.subscribe(() => {
        this.calculateTotals();
      })
    );
  }

  /**
   * Setup patient search functionality
   */
  private setupPatientSearch(): void {
    // Patient name search with debounce
    this.subscriptions.add(
      this.patientSearchTerms.pipe(
        debounceTime(300), // Wait for 300ms after each keystroke
        distinctUntilChanged(), // Only emit if search term changed
        switchMap((term: string) => {
          if (term.length < 2) return of([]);
          this.loadingPatients = true;
          
          // Check if search term is a phone number (contains only digits)
          const isPhoneSearch = /^\d+$/.test(term);
          
          console.log(`Searching patients by ${isPhoneSearch ? 'phone' : 'name'}: ${term}`);
          
          // If we have API integration use that, otherwise filter locally
          if (this.useApiSearch) {
            // Use appropriate search method based on term type
            return (isPhoneSearch ? 
              this.inventoryService.searchPatientsByPhone(term) : 
              this.inventoryService.searchPatients(term)
            ).pipe(catchError(() => {
              // Fall back to local search if API fails
              console.log('API search failed, falling back to local search');
              return of(this.filterPatientsLocally(term, isPhoneSearch));
            }));
          } else {
            // Use local filtering
            return of(this.filterPatientsLocally(term, isPhoneSearch));
          }
        })
      ).subscribe(patients => {
        this.patientSearchResults = patients;
        this.loadingPatients = false;
        this.showPatientSearch = this.patientSearchResults.length > 0;
        console.log('Patient search results:', this.patientSearchResults);
        
        // Auto-select patient if there's exactly one match
        if (this.patientSearchResults.length === 1) {
          this.selectPatient(this.patientSearchResults[0]);
        }
      })
    );
    
    // Setup search by name input field
    const patientNameControl = this.saleForm.get('patientName');
    if (patientNameControl) {
      this.subscriptions.add(
        patientNameControl.valueChanges.pipe(
          debounceTime(300),
          distinctUntilChanged()
        ).subscribe(term => {
          if (term && term.length >= 2) {
            this.patientSearchTerms.next(term);
          } else {
            this.showPatientSearch = false;
          }
        })
      );
    }
    
    // Setup search by phone number
    const phoneNumberControl = this.saleForm.get('phoneNumber');
    if (phoneNumberControl) {
      this.subscriptions.add(
        phoneNumberControl.valueChanges.pipe(
          debounceTime(300),
          distinctUntilChanged(),
          tap((phoneNumber: string) => {
            console.log('Phone number changed:', phoneNumber);
            if (phoneNumber && phoneNumber.length >= 5) {
              // Use the search terms subject for consistency
              this.patientSearchTerms.next(phoneNumber);
            } else {
              this.showPatientSearch = false;
            }
          })
        ).subscribe()
      );
    }
  }
  
  /**
   * Load patients for local search functionality
   */
  private loadPatients(): void {
    this.inventoryService.getAllPatients().subscribe({
      next: (patients: Patient[]) => {
        this.patients = patients;
        console.log('Loaded patients:', this.patients.length);
      },
      error: (error: any) => console.error('Error loading patients:', error)
    });
  }
  
  /**
   * Load doctors from API
   */
  loadDoctors(): void {
    this.inventoryService.getDoctors().subscribe({
      next: (doctors: Doctor[]) => {
        this.doctors = doctors;
        console.log('Loaded doctors:', this.doctors.length);
      },
      error: (error: any) => console.error('Error loading doctors:', error)
    });
  }
  
  /**
   * Filter patients locally by name or phone number
   * @param term The search term
   * @param isPhoneSearch Whether we're searching by phone number
   * @returns Filtered list of patients
   */
  private filterPatientsLocally(term: string, isPhoneSearch: boolean = false): Patient[] {
    const searchTerm = term.toLowerCase();
    return this.patients
      .filter(patient => {
        if (isPhoneSearch) {
          // Search by phone number
          return patient.phoneNumber && patient.phoneNumber.includes(searchTerm);
        } else {
          // Search by name
          return patient.name && patient.name.toLowerCase().includes(searchTerm);
        }
      })
      .slice(0, 5); // Limit to 5 results
  }
  
  /**
   * Load sample patients for testing
   */
  private loadSamplePatients(): void {
    this.patients = [
      { 
        id: 'PAT-2025-0001', 
        name: 'John Doe', 
        phoneNumber: '9876543210', 
        email: 'john@example.com',
        address: 'Sample Address, Chennai',
        gender: 'Male',
        active: true
      },
      { 
        id: 'PAT-2025-0002', 
        name: 'Murgan Siva', 
        phoneNumber: '2222222221', 
        address: 'Sample Street, Madurai, Tamilnadu - 222222',
        gender: 'Male',
        dateOfBirth: '1992-11-12',
        active: true
      },
      { 
        id: 'PAT-2025-0003', 
        name: 'Patient Three', 
        phoneNumber: '8888888888', 
        address: 'Sample Street, Chennai, gggg - 123456',
        gender: 'Female',
        dateOfBirth: '1996-02-16',
        active: true
      },
      { 
        id: 'PAT-2025-0004', 
        name: 'Siva S', 
        phoneNumber: '9673465234', 
        address: 'Chennai, Chennai, Tamilnadu - 601300',
        gender: 'Male',
        dateOfBirth: '1995-06-09',
        active: true
      },
      { 
        id: 'PAT-2025-0005', 
        name: 'Kalyani M', 
        phoneNumber: '9673123234', 
        address: 'Chennai, Chennai, Tamilnadu - 601300',
        gender: 'Female',
        dateOfBirth: '1998-11-12',
        active: true
      }
    ];
  }
  
  /**
   * Select a patient from search results
   */
  selectPatient(patient: Patient): void {
    if (patient) {
      console.log('Selected patient:', patient);
      
      // Update the form controls
      this.saleForm.patchValue({
        patientName: patient.name,
        phoneNumber: patient.phoneNumber || ''
      });
      
      // Fill in other patient details if available
      if (patient.address) {
        this.saleForm.get('patientAddress')?.setValue(patient.address);
      }
      if (patient.gender) {
        this.saleForm.get('patientGender')?.setValue(patient.gender);
      }
      
      // Update local state
      this.selectedPatient = patient;
      
      // Hide dropdown
      this.showPatientSearch = false;
    }
  }
  
  getCurrentDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  get itemsFormArray(): FormArray {
    return this.saleForm.get('items') as FormArray;
  }

  addSaleItem(): void {
    const itemGroup = this.fb.group({
      medicineId: ['', Validators.required],
      medicineName: ['', Validators.required],
      genericName: [''],
      manufacturer: [''],
      batchNo: [''], // Not disabled for better value handling
      expiryDate: [''],
      unitCost: [0],
      mrp: [0, Validators.required], // Not disabled for better value handling
      quantity: [1, [Validators.required, Validators.min(1)]],
      discount: [0],
      taxProfileId: [''], // For selecting the tax profile
      cgst: [0],
      sgst: [0],
      taxPercentage: [0], // Total tax percentage (CGST+SGST) for backward compatibility
      cgstAmount: [0], // CGST amount for the item
      sgstAmount: [0], // SGST amount for the item
      taxableAmount: [0],
      total: [0] // Not disabled for better value handling
    });
    
    // Auto-calculate on quantity change
    const quantitySub = itemGroup.get('quantity')?.valueChanges.subscribe(() => {
      console.log('Quantity changed, calculating...');
      this.calculateItemTotal(itemGroup);
    });
    
    const discountSub = itemGroup.get('discount')?.valueChanges.subscribe(() => {
      console.log('Discount changed, calculating...');
      this.calculateItemTotal(itemGroup);
    });
    
    if (quantitySub) this.subscriptions.add(quantitySub);
    if (discountSub) this.subscriptions.add(discountSub);
    
    this.itemsFormArray.push(itemGroup);
    
    // Calculate initial total
    this.calculateItemTotal(itemGroup);
  }

  removeSaleItem(index: number): void {
    this.itemsFormArray.removeAt(index);
    this.calculateTotals();
  }

  /**
   * Handles batch selection change
   * @param itemGroup The form group representing the item
   * @param medicineId The ID of the selected medicine
   */
  onBatchChange(itemGroup: AbstractControl): void {
    const formGroup = itemGroup as FormGroup;
    const medicineId = itemGroup.get('medicineId')?.value;
    const batchNo = itemGroup.get('batchNo')?.value;
    
    if (!medicineId || !batchNo || !this.medicineBatches[medicineId]) {
      console.warn('Cannot update batch details: missing medicine ID, batch number, or batch data');
      return;
    }
    
    console.log(`Batch changed to ${batchNo} for medicine ${medicineId}`);
    
    // Find the selected batch in the batches array
    const selectedBatch = this.medicineBatches[medicineId].find(batch => batch.batchNo === batchNo);
    
    if (selectedBatch) {
      console.log('Found batch data:', selectedBatch);
      
      // Update form with batch details
      const currentQty = formGroup.get('quantity')?.value || 1;
      
      formGroup.patchValue({
        expiryDate: selectedBatch.expiryDate ? this.formatDate(selectedBatch.expiryDate) : '',
        unitCost: selectedBatch.unitCost,
        mrp: selectedBatch.mrp * currentQty
      });
      
      // Trigger tax calculation
      this.onTaxProfileChange(formGroup);
      
      // Update total for this item
      this.calculateItemTotal(formGroup);
    } else {
      console.warn(`Batch ${batchNo} not found for medicine ${medicineId}`);
    }
  }
  
  /**
   * Gets available batches for a given medicine ID
   * @param medicineId The medicine ID to get batches for
   * @returns Array of available batches or empty array if none
   */
  getBatchesForMedicine(medicineId: string): MedicineBatch[] {
    if (!medicineId || !this.medicineBatches[medicineId]) {
      return [];
    }
    return this.medicineBatches[medicineId] || [];
  }
  
  /**
   * Handles quantity change for an item
   * @param itemGroup The form group for the item
   */
  onQuantityChange(itemGroup: FormGroup): void {
    console.log('Quantity changed');
    
    // Get the new quantity
    const quantity = Number(itemGroup.get('quantity')?.value || 0);
    const medicineId = itemGroup.get('medicineId')?.value;
    const batchNo = itemGroup.get('batchNo')?.value;
    
    if (medicineId && batchNo && this.medicineBatches[medicineId]) {
      // Find the selected batch
      const selectedBatch = this.medicineBatches[medicineId].find(batch => batch.batchNo === batchNo);
      
      if (selectedBatch) {
        // Update MRP based on quantity and batch unit price
        const newMrp = selectedBatch.mrp * quantity;
        
        // Update the MRP field
        itemGroup.patchValue({
          mrp: newMrp
        });
      }
    }
    
    // Calculate the item total
    this.calculateItemTotal(itemGroup);
  }

  /**
   * Calculate the total for an item based on quantity, price, discount, and tax rates
   * Handles inclusive, exclusive and non-GST calculations based on selected GST type
   */
  calculateItemTotal(itemGroup: AbstractControl): void {
    const formGroup = itemGroup as FormGroup;
    // Get values from form with fallbacks
    const quantity = Number(formGroup.get('quantity')?.value || 0);
    const mrp = Number(formGroup.get('mrp')?.value || 0);
    const discountPercent = Number(formGroup.get('discount')?.value || 0);
    
    // Get GST type
    const gstType = this.saleForm.get('gstType')?.value || 'INCLUSIVE';
    
    // Get tax profile and percentages
    const taxProfileId = formGroup.get('taxProfileId')?.value;
    const selectedTaxProfile = this.taxProfiles.find(profile => profile.id === taxProfileId);
    
    // Get actual tax percentages from form controls or default to zero
    const taxPercentage = Number(formGroup.get('taxPercentage')?.value || 0);
    const cgstPercent = Number(formGroup.get('cgst')?.value || 0);
    const sgstPercent = Number(formGroup.get('sgst')?.value || 0);
    
    console.log(`Calculating for quantity=${quantity}, mrp=${mrp}, discount=${discountPercent}%, tax=${taxPercentage}%`);
    
    // Calculate discount amount
    const discountAmount = (mrp * quantity) * (discountPercent / 100);
    const discountedPrice = (mrp * quantity) - discountAmount;
    
    // Initialize calculation variables
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let taxAmount = 0;
    let finalTotal = 0;
    
    // If tax profile is selected, calculate tax amounts
    if (selectedTaxProfile) {
      // Calculate based on GST type
      if (gstType === 'INCLUSIVE') {
        console.log('Processing INCLUSIVE GST calculation');
        // For inclusive GST: taxable amount = price / (1 + tax percentage/100)
        const divisor = 1 + (taxPercentage / 100);
        taxableAmount = discountedPrice / divisor;
        
        // Calculate tax from the taxable amount
        cgstAmount = (taxableAmount * cgstPercent) / 100;
        sgstAmount = (taxableAmount * sgstPercent) / 100;
        taxAmount = cgstAmount + sgstAmount;
        
        // For inclusive GST, total is already inclusive of tax
        finalTotal = discountedPrice;
      } 
      else if (gstType === 'EXCLUSIVE') {
        console.log('Processing EXCLUSIVE GST calculation');
        // For exclusive GST: taxable amount is discounted price
        taxableAmount = discountedPrice;
        
        // Calculate tax from the taxable amount
        cgstAmount = (taxableAmount * cgstPercent) / 100;
        sgstAmount = (taxableAmount * sgstPercent) / 100;
        taxAmount = cgstAmount + sgstAmount;
        
        // For exclusive GST, total is taxable amount + tax amount
        finalTotal = taxableAmount + taxAmount;
      }
      else { // NON_GST
        console.log('Processing NON_GST calculation');
        taxableAmount = discountedPrice;
        cgstAmount = 0;
        sgstAmount = 0;
        taxAmount = 0;
        finalTotal = taxableAmount;
      }
      
      console.log(`Calculation: taxableAmount=${taxableAmount}, cgstAmount=${cgstAmount}, sgstAmount=${sgstAmount}, total=${finalTotal}`);
    } else {
      console.log('No tax profile selected, using default values');
      // No tax profile selected, just use the discounted price
      taxableAmount = discountedPrice;
      cgstAmount = 0;
      sgstAmount = 0;
      taxAmount = 0;
      finalTotal = discountedPrice;
    }
    
    // Set all calculated values on the form
    formGroup.patchValue({
      taxableAmount: +taxableAmount.toFixed(2),
      cgstAmount: +cgstAmount.toFixed(2),
      sgstAmount: +sgstAmount.toFixed(2),
      total: +finalTotal.toFixed(2)
    }, { emitEvent: false });
    
    // Always recalculate overall totals after updating an item
    this.calculateTotals();
  }
  
  /**
   * Calculate the overall totals for the sale based on GST type
   */
  calculateTotals(): void {
    console.log('=== Running calculateTotals ===');
    
    // Reset totals
    this.subtotal = 0;
    this.discount = 0;
    this.tax = 0;
    this.total = 0;
    
    const gstType = this.saleForm.get('gstType')?.value || 'INCLUSIVE';
    console.log('Current GST Type:', gstType);
    
    // Initialize tax totals
    let totalCGST = 0;
    let totalSGST = 0;
    
    // Sum up all items
    console.log(`Processing ${this.itemsFormArray.controls.length} items in total calculation`);
    this.itemsFormArray.controls.forEach((itemControl: AbstractControl, index: number) => {
      const itemGroup = itemControl as FormGroup;
      
      // Get values from the item
      const quantity = Number(itemGroup.get('quantity')?.value || 0);
      const mrp = Number(itemGroup.get('mrp')?.value || 0);
      const discount = Number(itemGroup.get('discount')?.value || 0);
      const total = Number(itemGroup.get('total')?.value || 0);
      const taxableAmount = Number(itemGroup.get('taxableAmount')?.value || 0);
      const totalDiscountAmount = (mrp * quantity * discount) / 100;
      
      console.log(`Item ${index}: qty=${quantity}, mrp=${mrp}, discount=${discount}%, taxableAmount=${taxableAmount}, total=${total}`);
      
      // Add to running totals
      this.subtotal += taxableAmount;
      this.discount += totalDiscountAmount;
      
      // Add to tax totals
      const cgst = Number(itemGroup.get('cgst')?.value || 0);
      const sgst = Number(itemGroup.get('sgst')?.value || 0);
      
      const cgstAmount = (taxableAmount * cgst) / 100;
      const sgstAmount = (taxableAmount * sgst) / 100;
      const totalTaxAmount = cgstAmount + sgstAmount;
      
      this.tax += totalTaxAmount;
      totalCGST += cgstAmount;
      totalSGST += sgstAmount;
      
      // Update the total
      this.total += total;
    });
    
    // Apply overall discount
    const overallDiscountPercent = Number(this.saleForm.get('overallDiscount')?.value || 0);
    const overallDiscountValue = (this.subtotal * overallDiscountPercent) / 100;
    this.discount += overallDiscountValue;
    
    // Recalculate final total based on GST type
    if (gstType === 'INCLUSIVE') {
      // For inclusive GST, tax is already included in the item totals
      // We need to adjust the total by the overall discount
      this.total = this.total - overallDiscountValue;
    } else if (gstType === 'EXCLUSIVE') {
      // For exclusive GST, subtract overall discount and add tax
      this.total = this.subtotal - overallDiscountValue + this.tax;
    } else { // NON_GST
      // For NON_GST, no tax is applied
      this.tax = 0;
      this.total = this.subtotal - overallDiscountValue;
    }
    
    // Format to 2 decimal places
    this.subtotal = Number(this.subtotal.toFixed(2));
    this.discount = Number(this.discount.toFixed(2));
    this.tax = Number(this.tax.toFixed(2));
    this.total = Number(this.total.toFixed(2));
    
    // Update form controls including tax breakdown
    this.saleForm.patchValue({
      subtotal: this.subtotal,
      discount: this.discount,
      tax: this.tax,
      total: this.total,
      // Store CGST and SGST totals for reporting
      cgstTotal: Number(totalCGST.toFixed(2)),
      sgstTotal: Number(totalSGST.toFixed(2))
    }, { emitEvent: false });
  }

  loadMedicines(): void {
    this.loadingMedicines = true;
    this.inventoryService.getMedicines().subscribe({
      next: (data) => {
        // Ensure all medicines have an MRP value for proper calculations
        this.medicines = data.filter((med: Medicine) => med.stockQuantity > 0).map(medicine => {
          // Ensure medicine has an MRP value (add if missing)
          if (!medicine.mrp && medicine.mrp !== 0) {
            medicine.mrp = medicine.unitPrice || 100; // Default to unitPrice or 100
          }
          // Ensure medicine has a tax profile (add if missing)
          if (!medicine.taxProfile) {
            medicine.taxProfile = { totalRate: 12 } as TaxProfile;
          }
          return medicine;
        });
        
        console.log('Loaded medicines with MRP values:', this.medicines);
        this.filteredMedicines = [...this.medicines];
        this.loadingMedicines = false;
      },
      error: (err) => {
        console.error('Error loading medicines', err);
        this.loadingMedicines = false;
        
        // Create sample medicines for testing if API fails
        this.medicines = [
          { 
            id: 'med1', 
            name: 'Paracetamol', 
            mrp: 10, 
            stockQuantity: 100, 
            unitOfMeasurement: 'tablet', 
            stockStatus: StockStatus.NORMAL, 
            taxProfileId: 'tax1', 
            lowStockThreshold: 10,
            taxProfile: { 
              id: 'tax1', 
              profileName: 'GST 12%',
              totalRate: 12, 
              components: [{
                componentName: 'CGST',
                rate: 6
              }, {
                componentName: 'SGST',
                rate: 6
              }]
            } 
          },
          { 
            id: 'med2', 
            name: 'Aspirin', 
            mrp: 15, 
            stockQuantity: 50, 
            unitOfMeasurement: 'tablet', 
            stockStatus: StockStatus.NORMAL, 
            taxProfileId: 'tax1', 
            lowStockThreshold: 10,
            taxProfile: { 
              id: 'tax1', 
              profileName: 'GST 12%',
              totalRate: 12, 
              components: [{
                componentName: 'CGST',
                rate: 6
              }, {
                componentName: 'SGST',
                rate: 6
              }]
            } 
          },
          { 
            id: 'med3', 
            name: 'Crocin', 
            mrp: 20, 
            stockQuantity: 30, 
            unitOfMeasurement: 'tablet', 
            stockStatus: StockStatus.NORMAL,
            taxProfileId: 'tax1', 
            lowStockThreshold: 10,
            taxProfile: { 
              id: 'tax1', 
              profileName: 'GST 12%',
              totalRate: 12, 
              components: [{
                componentName: 'CGST',
                rate: 6
              }, {
                componentName: 'SGST',
                rate: 6
              }]
            } 
          }
        ];
        this.filteredMedicines = [...this.medicines];
      }
    });
  }

  /**
   * Search for medicines by name, using the inventory service
   * @param event Event object or index of the form array item being searched
   * @param itemIndex Optional index parameter when called from template
   */
  searchMedicine(event: Event | number, itemIndex?: number): void {
    let term: string;
    let index: number;
    
    // Handle both direct index calls and event-based calls
    if (typeof event === 'number') {
      // Called with just index from template
      index = event;
      const inputElement = document.querySelector(`input[formControlName="medicineName"][ng-reflect-form-control-name="${index}"]`) as HTMLInputElement;
      term = inputElement?.value || '';
    } else {
      // Called with event object
      term = (event.target as HTMLInputElement).value;
      index = itemIndex as number;
    }
    
    this.activeSearchIndex = index;
    if (!term || term.length < 2) {
      this.medicineSearchResults = [];
      this.showMedicineSearch = false;
      return;
    }
    
    console.log(`Searching for medicine: "${term}" at index ${index}`);
    this.showMedicineSearch = true;
    this.loadingMedicineSearch = true;
    
    // If debugging mode - immediately set a test medicine
    if (term.toLowerCase() === 'test') {
      // Set a test medicine with known values
      const testMedicine: Medicine = {
        id: 'test-med',
        name: 'Test Medicine',
        mrp: 100,
        stockQuantity: 100,
        unitOfMeasurement: 'tablet',
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'tax1',
        lowStockThreshold: 10,
        taxProfile: {
          id: 'tax1',
          profileName: 'GST 12%',
          totalRate: 12,
          components: [{
            componentName: 'CGST',
            rate: 6
          }, {
            componentName: 'SGST',
            rate: 6
          }]
        }
      };
      
      this.medicineSearchResults = [testMedicine];
      this.loadingMedicineSearch = false;
      return;
    }
    
    // Just trigger the search via subject - the subscription is setup in ngOnInit
    this.medicineSearchTerm.next({ term, itemIndex: index });
  }

  /**
   * Filter medicines locally by name
   * @param searchTerm The search term to filter by
   */
  filterMedicinesLocally(searchTerm: string): Medicine[] {
    const term = searchTerm.toLowerCase();
    return this.medicines
      .filter(med => med.name.toLowerCase().includes(term))
      .slice(0, 10); // Limit to 10 results
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
    
    // Update medicine fields in the form
    itemGroup.patchValue({
      medicineId: medicine.id,
      medicineName: medicine.name,
      genericName: medicine.genericName || '',
      manufacturer: medicine.manufacturer || ''
    });
    
    // Default price and quantity
    const currentQty = itemGroup.get('quantity')?.value || 1;
    
    // Store the current index for reference
    this.currentMedicineIndex = itemIndex;
    
    // Fetch batches for this medicine from purchase API
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
              
              // Check if this item is for the selected medicine
              if (item.medicineId === medicine.id || item.medicine?.id === medicine.id) {
                console.log(`Found matching item for medicine ID ${medicine.id}:`, item);
                
                // Convert timestamp to Date if needed
                let expiryDate: Date | null = null;
                if (item.expiryDate) {
                  if (typeof item.expiryDate === 'object' && item.expiryDate.seconds) {
                    // Convert timestamp to milliseconds
                    expiryDate = new Date(item.expiryDate.seconds * 1000);
                  } else if (typeof item.expiryDate === 'string') {
                    // Try direct date conversion from string
                    expiryDate = new Date(item.expiryDate);
                  } else if (typeof item.expiryDate === 'number') {
                    // Handle numeric timestamp
                    expiryDate = new Date(item.expiryDate);
                  }
                }
                
                // Get batch number - handle different API response structures
                const batchNo = item.batchNo || item.batch || '';
                
                // Get MRP - handle different API response structures
                const mrp = item.mrpPerItem || item.mrp || 0;
                
                // Get unit cost - handle different API response structures
                const unitCost = item.purchaseCostPerPack || item.unitCost || item.costPerUnit || 0;
                
                // Only process items with valid batch numbers
                if (batchNo) {
                  // Add to batches array - prevent duplicates by batch number
                  if (!batches.find(b => b.batchNo === batchNo)) {
                    const batchData: MedicineBatch = {
                      batchNo: batchNo,
                      expiryDate: expiryDate,
                      mrp: mrp,
                      unitCost: unitCost,
                      // Include additional batch details for debugging
                      packQuantity: item.packQuantity,
                      itemsPerPack: item.itemsPerPack,
                      purchaseId: purchase.purchaseId || purchase.id,
                      referenceId: purchase.referenceId || purchase.reference
                    };
                    
                    console.log('Adding batch data:', batchData);
                    batches.push(batchData);
                  }
                }
              }
            });
          }
        });
        
        console.log(`Found ${batches.length} batches for medicine ${medicine.name}:`, batches);
        
        // Store batches for this medicine
        this.medicineBatches[medicine.id] = batches;
        
        // Enable batch selection dropdown
        itemGroup.get('batchNo')?.enable();
        
        // If batches are available, select the first one
        if (this.medicineBatches[medicine.id] && this.medicineBatches[medicine.id].length > 0) {
          const firstBatch = this.medicineBatches[medicine.id][0];
          
          console.log('Selecting first batch:', firstBatch);
          
          // Update form with batch details
          itemGroup.patchValue({
            batchNo: firstBatch.batchNo,
            expiryDate: firstBatch.expiryDate ? this.formatDate(firstBatch.expiryDate) : '',
            unitCost: firstBatch.unitCost,
            mrp: firstBatch.mrp * currentQty
          });
          
          // Trigger tax calculation
          this.onTaxProfileChange(itemGroup);
          
          // Update total for this item
          this.calculateItemTotal(itemGroup);
        } else {
          console.warn('No batches available for medicine ID:', medicine.id);
          
          // Clear batch-related fields
          itemGroup.patchValue({
            batchNo: '',
            expiryDate: '',
            unitCost: 0,
            mrp: 0
          });
        }
        
        // Hide the medicine search dropdown
        this.showMedicineSearch = false;
        this.activeSearchIndex = -1;
        
        // Focus on quantity field after selection
        setTimeout(() => {
          const quantityInput = document.querySelector(`#quantity_${itemIndex}`) as HTMLInputElement;
          if (quantityInput) {
            quantityInput.focus();
          }
        }, 100);
      });
    
    // Update UI state
    this.showMedicineSearch = false;
    this.medicineSearchResults = [];
    this.activeSearchIndex = -1;
  }

  
  markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach(c => {
          if (c instanceof FormGroup) {
            this.markFormGroupTouched(c);
          } else {
            c?.markAsTouched();
          }
        });
      } else {
        control?.markAsTouched();
      }
    });
  }

  onSubmit(): void {
    if (this.saleForm.invalid) {
      this.markFormGroupTouched(this.saleForm);
      return;
    }

    if (this.itemsFormArray.controls.length === 0) {
      alert('Please add at least one item to the sale.');
      return;
    }
    
    this.submitting = true;
    const formValue = this.saleForm.getRawValue(); // Get values including disabled fields
    
    // Format items for API to match Java backend SaleItemDto with tax details
    const saleItems: SaleItemDto[] = this.itemsFormArray.controls.map((control: AbstractControl) => {
      const item = (control as FormGroup).value;
      return {
        medicineId: item.medicineId,
        quantity: item.quantity,
        discountPercentage: item.discount || 0,
        // Add required mrp field to fix TypeScript error
        mrp: item.mrp || 0,
        // Include tax details
        cgst: item.cgst || 0,
        sgst: item.sgst || 0,
        taxableAmount: item.taxableAmount || 0,
        total: item.total || 0
      };
    });
    
    // Get the date from form and format it properly for backend
    // If time isn't specified, use current time
    const formDate = formValue.saleDate;
    const now = new Date();
    const dateStr = formDate ? `${formDate}T${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00Z` : new Date().toISOString();
    
    // Create request object matching the Java backend DTO - exactly as expected
    const saleData: CreateOtcSaleRequest = {
      // Patient details
      patientName: formValue.patientName || 'Walk-in Customer',
      patientMobile: formValue.phoneNumber || '',
      patientAddress: formValue.patientAddress || '',
      patientDob: formValue.dateOfBirth || null,
      patientAge: formValue.age || null,
      patientGender: formValue.gender || null,
      
      // Invoice details
      date: dateStr, // ISO format date string as required
      doctorName: formValue.doctorName || '',
      
      // Payment details
      paymentMode: formValue.paymentMethod, // Payment mode (CASH, CARD, etc)
      paymentStatus: formValue.paymentStatus,
      transactionReference: formValue.transactionReference,
      
      // Tax details
      gstType: formValue.gstType, // 'INCLUSIVE' or 'EXCLUSIVE'
      printGst: formValue.printGst || false,
      cgstTotal: formValue.cgstTotal || 0,
      sgstTotal: formValue.sgstTotal || 0,
      
      // Sale items and amounts
      items: saleItems,
      subtotal: formValue.subtotal || 0,
      totalDiscount: formValue.discount || 0,  // Match backend field name
      totalTax: formValue.tax || 0,            // Match backend field name
      grandTotal: formValue.total || 0,        // Required field for backend
      notes: formValue.notes || ''
    };
    
    console.log('Submitting OTC sale data:', saleData);
    
    // Check if we're in edit mode or create mode
    if (this.isEditMode && this.editSaleId) {
      console.log(`Updating existing OTC sale with ID: ${this.editSaleId}`);
      
      // Call updateOtcSale method for edit mode
      this.inventoryService.updateOtcSale(this.editSaleId, saleData).subscribe({
        next: (response) => {
          console.log('Sale updated successfully', response);
          this.submitting = false;
          this.router.navigate(['/inventory/sales']);
        },
        error: (error) => {
          console.error('Error updating sale', error);
          this.submitting = false;
          alert('Error updating sale: ' + (error.error || error.message || 'Unknown error'));
        }
      });
    } else {
      // Call createOtcSale method for create mode
      this.inventoryService.createOtcSale(saleData).subscribe({
        next: (response) => {
          console.log('Sale created successfully', response);
          this.submitting = false;
          this.router.navigate(['/inventory/sales']);
        },
        error: (error) => {
          console.error('Error creating sale', error);
          this.submitting = false;
          alert('Error creating sale: ' + (error.error || error.message || 'Unknown error'));
        }
      });
    }
  }

  /**
   * Handles tax profile changes for a specific line item
   * @param itemGroup The form group for the item whose tax profile changed
   */
  onTaxProfileChange(itemGroup: AbstractControl): void {
    console.log('Tax profile changed for item');
    const formGroup = itemGroup as FormGroup;
    const taxProfileId = formGroup.get('taxProfileId')?.value;
    
    console.log('Selected tax profile ID:', taxProfileId);
    
    const selectedTaxProfile = this.taxProfiles.find(profile => profile.id === taxProfileId);
    
    if (selectedTaxProfile) {
      console.log('Selected Tax Profile:', selectedTaxProfile);
      
      // Extract tax components (CGST and SGST)
      const cgstComponent = selectedTaxProfile.components?.find(c => c.componentName === 'CGST');
      const sgstComponent = selectedTaxProfile.components?.find(c => c.componentName === 'SGST');
      
      console.log('CGST component:', cgstComponent);
      console.log('SGST component:', sgstComponent);
      
      // Get rates from components
      const cgstPercent = cgstComponent?.rate || 0;
      const sgstPercent = sgstComponent?.rate || 0;
      const taxPercent = cgstPercent + sgstPercent;
      
      console.log(`Tax rates: CGST=${cgstPercent}%, SGST=${sgstPercent}%, Total=${taxPercent}%`);
      
      // Update tax percentages in form
      formGroup.patchValue({
        taxPercentage: taxPercent,
        cgst: cgstPercent,
        sgst: sgstPercent
      }, { emitEvent: false });
    } else {
      console.log('No tax profile found for ID:', taxProfileId);
      // Clear tax values when no profile is selected
      formGroup.patchValue({
        taxPercentage: 0,
        cgst: 0,
        sgst: 0
      }, { emitEvent: false });
    }
    
    // Force recalculation with new tax profile
    this.calculateItemTotal(formGroup);
    
    // Make sure totals are updated
    console.log('Recalculating totals after tax profile change');
    this.calculateTotals();
  }

  /**
   * Handles changes to the GST type dropdown (inclusive, exclusive, non-GST)
   * Recalculates all item totals based on the new GST type
   */
  onGstTypeChange(): void {
    console.log('GST Type changed to:', this.saleForm.get('gstType')?.value);
    
    if (this.itemsFormArray && this.itemsFormArray.controls && this.itemsFormArray.controls.length > 0) {
      this.itemsFormArray.controls.forEach(itemControl => {
        this.calculateItemTotal(itemControl);
      });
    } else {
      console.log('No items to recalculate');
    }
    
    // Recalculate overall totals
    console.log('Recalculating totals');
    this.calculateTotals();
  }
  
  /**
   * Resets the form to its initial state while preserving sale date and transaction reference
   */
  /**
   * Format a date object to YYYY-MM-DD string format required by HTML date input
   * @param date The date to format
   * @returns The formatted date string
   */
  formatDate(date: Date): string {
    if (!date) return '';
    
    // Format to YYYY-MM-DD for HTML date input
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }
  
  resetForm(): void {
    // Store values we want to preserve
    const saleDate = this.saleForm.get('saleDate')?.value;
    const transactionRef = this.saleForm.get('transactionReference')?.value;
    const gstType = this.saleForm.get('gstType')?.value || 'inclusive';
    const printGst = this.saleForm.get('printGst')?.value || false;
    
    // Clear all patient fields
    this.saleForm.patchValue({
      patientName: '',
      phoneNumber: '',
      patientAddress: '',
      dateOfBirth: '',
      age: '',
      gender: '',
      doctorName: ''
    });
    
    // Clear all sale items
    while (this.itemsFormArray.length !== 0) {
      this.itemsFormArray.removeAt(0);
    }
    
    // Reset totals
    this.saleForm.patchValue({
      overallDiscount: 0,
      subtotal: 0,
      discount: 0,
      tax: 0,
      cgstTotal: 0,
      sgstTotal: 0,
      total: 0,
      notes: ''
    });
    
    // Restore preserved values
    this.saleForm.patchValue({
      saleDate: saleDate,
      transactionReference: transactionRef,
      gstType: gstType,
      printGst: printGst
    });
    
    // Update UI values
    this.subtotal = 0;
    this.discount = 0;
    this.tax = 0;
    this.total = 0;
    
    console.log('Form has been reset');
  }

  /**
   * Load tax profiles from API
   */
  loadTaxProfiles(): void {
    this.inventoryService.getTaxProfiles().subscribe({
      next: (profiles) => {
        this.taxProfiles = profiles;
        console.log('Loaded tax profiles:', this.taxProfiles);
      },
      error: (error) => {
        console.error('Error loading tax profiles:', error);
        // Set default profiles as fallback
        this.taxProfiles = [
          { 
            id: 'gst-12', 
            profileName: 'GST 12%', 
            totalRate: 12, 
            components: [
              { componentName: 'CGST', rate: 6 },
              { componentName: 'SGST', rate: 6 }
            ]
          },
          { 
            id: 'gst-18', 
            profileName: 'GST 18%', 
            totalRate: 18,
            components: [
              { componentName: 'CGST', rate: 9 },
              { componentName: 'SGST', rate: 9 }
            ] 
          },
        ];
      }
    });
  }
}
