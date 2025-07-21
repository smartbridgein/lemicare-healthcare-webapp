import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
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
  patientSearchResults: any[] = [];
  doctorSearchResults: any[] = [];
  medicineSearchResults: any[] = [];
  showPatientSearch = false;
  showDoctorSearch = false;
  showMedicineSearch = false;
  loadingPatients = false;
  loadingDoctors = false;
  loadingMedicines = false;
  activeSearchIndex = -1;
  
  // Selected entities
  selectedPatient: any = null;
  selectedDoctor: any = null;
  
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
  
  // Payment methods
  paymentMethods = ['CASH', 'CARD', 'UPI', 'CREDIT'];
  
  // Tax related
  loadingTaxProfiles = false;
  taxProfiles: TaxProfile[] = [];
  defaultTaxProfileId = '';
  
  // Totals
  subtotal = 0;
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
    private http: HttpClient
  ) {
    this.createForm();
  }
  


  createForm(): void {
    this.prescriptionForm = this.fb.group({
      patientName: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
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
      overallDiscount: [0],
    });
    
    // Initialize the form with one item and set up all subscriptions
    this.addSaleItem();
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
        if (this.patientSearchResults.length === 1) {
          this.selectPatient(this.patientSearchResults[0]);
        }
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
    // Set up the subscription for medicine search terms
    this.subscriptions.add(
      this.medicineSearchTerms.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term: string) => {
          if (!term || term.length < 2) {
            return of([]);
          }
          
          this.loadingMedicines = true;
          
          // Use direct API endpoint for medicines
          return this.http.get<any[]>(`${this.apiUrl}/api/inventory/masters/medicines`).pipe(
            map(response => {
              console.log('Medicine API response:', response);
              // Filter active medicines and those matching search term
              const searchTerm = term.toLowerCase();
              return response
                .filter(med => 
                  med.status === 'ACTIVE' && 
                  (med.name.toLowerCase().includes(searchTerm) || 
                  (med.genericName && med.genericName.toLowerCase().includes(searchTerm)) ||
                  (med.manufacturer && med.manufacturer.toLowerCase().includes(searchTerm)))
                )
                .map(med => ({
                  // Map API fields to expected structure
                  id: med.medicineId,
                  name: med.name,
                  genericName: med.genericName,
                  manufacturer: med.manufacturer,
                  stockQuantity: med.quantityInStock,
                  stockStatus: med.stockStatus,
                  mrp: med.unitPrice || 0,
                  taxProfileId: med.taxProfileId,
                  unitOfMeasurement: med.unitOfMeasurement,
                  lowStockThreshold: med.lowStockThreshold,
                  status: med.status
                }));
            }),
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
  }

  ngOnInit(): void {
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
      
      // Always use the debounced subject for consistent search behavior
      if (term && term.length > 1) {
        this.medicineSearchTerms.next(term);
      } else {
        this.showMedicineSearch = false;
      }
    }
  }

  /**
   * Filter medicines locally by name
   * @param searchTerm The search term to filter by
   */
  filterMedicinesLocally(searchTerm: string): void {
    const term = searchTerm.toLowerCase();
    // More flexible search: check name, generic name, and manufacturer
    this.filteredMedicines = this.medicines
      .filter(med => {
        // Check if medicine name, generic name or manufacturer contains the search term
        return (
          (med.name && med.name.toLowerCase().includes(term)) || 
          (med.genericName && med.genericName.toLowerCase().includes(term)) ||
          (med.manufacturer && med.manufacturer.toLowerCase().includes(term))
        );
      })
      .slice(0, 10); // Limit to 10 results
    
    this.showMedicineSearch = this.filteredMedicines.length > 0;
    this.loadingMedicines = false;
    console.log('Filtered medicines:', this.filteredMedicines);
  }

  /**
   * Select a patient from search results
   * @param patient The patient to select
   */
  selectPatient(patient: any): void {
    if (patient) {
      this.prescriptionForm.patchValue({
        patientId: patient.id,
        patientName: patient.name,
        phoneNumber: patient.phoneNumber || ''
      });
      
      this.showPatientSearch = false;
    }
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
    if (this.prescriptionForm.invalid) {
      console.log('Form is invalid:', this.prescriptionForm.errors);
      return;
    }

    // Calculate totals before submission
    this.calculateTotals();

    const formValue = this.prescriptionForm.getRawValue();
    console.log('Submitting form:', formValue);
    
    // Set loading state

    // Format the form data as needed for API according to required structure
    const apiData = {
      patientId: formValue.patientId,
      doctorId: formValue.doctorId,
      prescriptionDate: new Date(formValue.prescriptionDate).toISOString(), // Convert to ISO string format
      saleDate: new Date().toISOString(),
      paymentMode: formValue.paymentMode || 'CASH',
      transactionReference: formValue.transactionReference,
      gstType: formValue.gstType,
      grandTotal: this.grandTotal,
      items: formValue.items.map((item: any) => ({
        medicineId: item.medicineId,
        quantity: +item.quantity,
        discountPercentage: +item.discount,
        mrp: +item.mrp
      }))
    };

    // Save the prescription data to the API
    console.log('Sending to API:', apiData);
    
    this.http.post(`${this.apiUrl}/api/inventory/sales/prescription`, apiData)
      .pipe(
        catchError(error => {
          console.error('Error saving prescription sale:', error);
          alert('Failed to save prescription sale. Please try again.');
          return throwError(() => error);
        })
      )
      .subscribe(response => {
        console.log('Prescription sale saved successfully:', response);
        
        alert('Prescription sale saved successfully!');
        
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
   * Select a medicine from search results and fetch its batch details
   * @param medicine The medicine to select
   * @param index The index of the item in the form array
   */
  selectMedicine(medicine: any, index: number): void {
    if (!medicine) return;
    
    // Get medicine ID from API response format
    const medicineId = medicine.id || medicine.medicineId;
    
    this.currentMedicineIndex = index;
    this.loadingBatches = true;
    
    console.log(`[DEBUG] Selecting medicine at index ${index}:`, medicine);
    console.log(`[DEBUG] Medicine ID: ${medicineId}, Name: ${medicine.name}`);
    
    // Update form with medicine details
    const formGroup = this.itemsFormArray.at(index) as FormGroup;
    formGroup.patchValue({
      medicineId: medicineId,
      medicineName: medicine.name,
      generic: medicine.genericName || '',
      mfg: medicine.manufacturer || '',
      taxProfileId: medicine.taxProfileId || ''
    }, { emitEvent: false });
    
    console.log(`[DEBUG] Form updated with medicine: ${medicine.name} (${medicineId})`);
    console.log(`[DEBUG] Current medicine index: ${this.currentMedicineIndex}`);
    console.log(`[DEBUG] Current medicine batches state:`, this.medicineBatches);
    
    // Then fetch batch details from purchases API
    this.loadingBatches = true;
    
    // Reset previous batches
    var purchasesUrl = environment.apiUrlInventory+"/api/inventory/purchases/";
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
                } else {
                  console.warn('Found item without batch number:', item);
                }
              }
            });
          } else {
            console.warn('Purchase has no items array or items is not an array:', purchase);
          }
        });
        
        console.log(`Extracted ${batches.length} batches for medicine:`, medicine.id, medicine.name);
        console.log('Batch details:', batches);
        
        // Store batch details for this medicine
        this.medicineBatches[medicine.id] = batches;
        
        // Enable batch selection dropdown
        formGroup.get('batchNo')?.enable();
        
        // If batches are available, select the first one
        if (this.medicineBatches[medicine.id] && this.medicineBatches[medicine.id].length > 0) {
          const firstBatch = this.medicineBatches[medicine.id][0];
          
          console.log('Selecting first batch:', firstBatch);
          
          // Update form with batch details
          formGroup.patchValue({
            batchNo: firstBatch.batchNo,
            expDate: firstBatch.expiryDate ? this.formatDate(firstBatch.expiryDate) : '',
            unitMrp: firstBatch.mrp,
            unitCost: firstBatch.unitCost,
            mrp: firstBatch.mrp * (formGroup.get('quantity')?.value || 1)
          }, { emitEvent: false });
          
          // Trigger tax calculation
          this.onTaxProfileChange(formGroup);
          
          // Update total for this item
          this.calculateItemTotal(formGroup);
        } else {
          console.warn('No batches available for medicine ID:', medicine.id);
          
          // Clear batch-related fields
          formGroup.patchValue({
            batchNo: '',
            expDate: '',
            unitMrp: 0,
            unitCost: 0,
            mrp: 0
          }, { emitEvent: false });
        }
        
        this.showMedicineSearch = false;
        this.activeSearchIndex = -1;
      });
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
      batchNo: [{value: '', disabled: true}],
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
   */
  calculateItemTotal(itemGroup: AbstractControl | FormGroup): void {
    // Ensure we're working with a FormGroup
    const formGroup = itemGroup as FormGroup;
    
    const quantity = +formGroup.get('quantity')?.value || 0;
    const unitCost = +formGroup.get('unitCost')?.value || 0;
    const unitMrp = +formGroup.get('unitMrp')?.value || 0;
    const discount = +formGroup.get('discount')?.value || 0;
    
    // Calculate base values
    const grossPrice = unitMrp * quantity; // Use unitCost instead of unitMrp for taxable calculation
    const discountAmount = (grossPrice * discount) / 100;
    const discountedPrice = grossPrice - discountAmount;
    
    // Get GST type from form
    const gstType = this.prescriptionForm.get('gstType')?.value || 'INCLUSIVE';
    
    // Get tax percentages from form controls (set by onTaxProfileChange)
    const taxPercent = +formGroup.get('taxPercentage')?.value || 0;
    const cgstPercent = +formGroup.get('cgstPercentage')?.value || 0;
    const sgstPercent = +formGroup.get('sgstPercentage')?.value || 0;
    
    // Initialize variables for tax calculations
    let taxableAmount = discountedPrice;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let finalTotal = discountedPrice;
    
    // For NON_GST type, no tax calculation is needed
    if (gstType === GstType.NON_GST) {
      // Reset all tax values
      formGroup.patchValue({
        taxAmount: 0,
        cgst: 0,
        sgst: 0,
        taxableAmount: +discountedPrice.toFixed(2),
        total: +discountedPrice.toFixed(2),
        mrp: +grossPrice.toFixed(2)
      }, { emitEvent: false });
    } else if (gstType === GstType.INCLUSIVE) {
      // For inclusive GST: taxable amount = price / (1 + tax percentage/100)
      taxableAmount = taxPercent > 0 ? discountedPrice / (1 + (taxPercent / 100)) : discountedPrice;
      
      // Calculate tax from the taxable amount
      cgstAmount = (taxableAmount * cgstPercent) / 100;
      sgstAmount = (taxableAmount * sgstPercent) / 100;
      
      // For inclusive GST, total already includes tax
      finalTotal = discountedPrice;
      
      formGroup.patchValue({
        taxableAmount: +taxableAmount.toFixed(2),
        cgst: +cgstAmount.toFixed(2),
        sgst: +sgstAmount.toFixed(2),
        taxAmount: +(cgstAmount + sgstAmount).toFixed(2),
        total: +finalTotal.toFixed(2),
        mrp: +grossPrice.toFixed(2)
      }, { emitEvent: false });
    } else { // EXCLUSIVE
      // For exclusive GST: taxable amount is discounted price
      taxableAmount = discountedPrice;
      
      // Calculate tax from the taxable amount
      cgstAmount = (taxableAmount * cgstPercent) / 100;
      sgstAmount = (taxableAmount * sgstPercent) / 100;
      
      // For exclusive GST, total is taxable amount + tax amount
      finalTotal = taxableAmount + cgstAmount + sgstAmount;
      
      formGroup.patchValue({
        taxableAmount: +taxableAmount.toFixed(2),
        cgst: +cgstAmount.toFixed(2),
        sgst: +sgstAmount.toFixed(2),
        taxAmount: +(cgstAmount + sgstAmount).toFixed(2),
        total: +finalTotal.toFixed(2),
        mrp: +grossPrice.toFixed(2)
      }, { emitEvent: false });
    }
    
    // Mark form as dirty to ensure UI updates
    formGroup.markAsDirty();
    
    // Always recalculate overall totals
    this.calculateTotals();
  }

  /**
   * Calculate the overall totals for the sale based on GST type
   */
  calculateTotals(): void {
    // Reset totals before calculation
    this.subtotal = 0;
    this.discount = 0;
    this.tax = 0;
    this.cgstTotal = 0;
    this.sgstTotal = 0;
    this.grandTotal = 0;
    
    // Get current GST type
    const gstType = this.prescriptionForm.get('gstType')?.value || GstType.INCLUSIVE;
    
    // Sum up all items
    const itemsArray = this.itemsFormArray;
    
    itemsArray.controls.forEach((itemControl: AbstractControl) => {
      const itemGroup = itemControl as FormGroup;
      
      // Get values from the item
      const quantity = +itemGroup.get('quantity')?.value || 0;
      const mrp = +itemGroup.get('mrp')?.value || 0;
      const discount = +itemGroup.get('discount')?.value || 0;
      const total = +itemGroup.get('total')?.value || 0;
      const taxableAmount = +itemGroup.get('taxableAmount')?.value || 0;
      const discountAmount = (mrp * discount) / 100;
      
      // Add to running totals
      this.subtotal += taxableAmount;
      this.discount += discountAmount * quantity;
      
      // Add to tax totals
      const cgst = +itemGroup.get('cgst')?.value || 0;
      const sgst = +itemGroup.get('sgst')?.value || 0;
      
      this.cgstTotal += cgst;
      this.sgstTotal += sgst;
      this.tax += cgst + sgst;
      
      // Add to total
      this.grandTotal += total;
    });
    
    // Apply overall discount
    const overallDiscount = +this.prescriptionForm.get('overallDiscount')?.value || 0;
    const overallDiscountAmount = (this.subtotal * overallDiscount) / 100;
    this.discount += overallDiscountAmount;
    
    // Adjust final total based on GST type and overall discount
    if (gstType === GstType.INCLUSIVE) {
      // For inclusive GST, total is already inclusive of tax
      this.grandTotal -= overallDiscountAmount;
    } else if (gstType === GstType.EXCLUSIVE) {
      // For exclusive GST, recalculate to ensure accuracy
      this.grandTotal = this.subtotal - overallDiscountAmount + this.tax;
    } else { // NON_GST
      // For NON_GST, no tax applies
      this.tax = 0;
      this.cgstTotal = 0;
      this.sgstTotal = 0;
      this.grandTotal = this.subtotal - overallDiscountAmount;
    }
    
    // Format to 2 decimal places
    this.subtotal = +this.subtotal.toFixed(2);
    this.discount = +this.discount.toFixed(2);
    this.tax = +this.tax.toFixed(2);
    this.cgstTotal = +this.cgstTotal.toFixed(2);
    this.sgstTotal = +this.sgstTotal.toFixed(2);
    this.grandTotal = +this.grandTotal.toFixed(2);
    
    // Update form controls with calculated totals
    this.prescriptionForm.patchValue({
      subtotal: this.subtotal,
      discount: this.discount,
      tax: this.tax,
      cgstTotal: this.cgstTotal,
      sgstTotal: this.sgstTotal,
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
   * Handle batch selection change
   * @param event Change event from batch dropdown
   * @param index Index of the item in the form array
   */
  onBatchChange(event: any, index: number): void {
    const formGroup = this.itemsFormArray.at(index) as FormGroup;
    const medicineId = formGroup.get('medicineId')?.value;
    const selectedBatchNo = event.target.value;
    const quantity = formGroup.get('quantity')?.value || 1;
    
    console.log(`Batch changed at index ${index} for medicine ID ${medicineId} to: ${selectedBatchNo}`);
    
    if (!medicineId || !this.medicineBatches[medicineId]) {
      console.warn('Cannot find medicine or batches for ID:', medicineId);
      return;
    }
    
    // Find the selected batch in the medicine's batches
    const selectedBatch = this.medicineBatches[medicineId].find(batch => batch.batchNo === selectedBatchNo);
    
    if (selectedBatch) {
      console.log('Selected batch details:', selectedBatch);
      
      // Update form with selected batch details
      formGroup.patchValue({
        expDate: selectedBatch.expiryDate ? this.formatDate(selectedBatch.expiryDate) : '',
        unitMrp: selectedBatch.mrp,
        unitCost: selectedBatch.unitCost,
        mrp: selectedBatch.mrp * quantity
      }, { emitEvent: false });
      
      console.log('Updated form values:', {
        expDate: formGroup.get('expDate')?.value,
        unitMrp: formGroup.get('unitMrp')?.value,
        unitCost: formGroup.get('unitCost')?.value,
        mrp: formGroup.get('mrp')?.value
      });
      
      // Apply tax profile if one is selected
      this.onTaxProfileChange(formGroup);
      
      // Recalculate item total
      this.calculateItemTotal(formGroup);
      
      // Update overall totals
      this.calculateTotals();
    } else {
      console.error(`No batch found with batchNo: ${selectedBatchNo} for medicine ID: ${medicineId}`);
    }
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
