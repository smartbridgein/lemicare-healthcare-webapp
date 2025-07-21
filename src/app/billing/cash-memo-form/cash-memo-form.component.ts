import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule, FormArray } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BillingService } from '../shared/billing.service';
import { CashMemo } from '../shared/billing.model';
import { PatientService } from '../../patients/shared/patient.service';
import { Patient } from '../../patients/shared/patient.model';
import { finalize, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { Subject, Subscription } from 'rxjs';
import { AuthService, UserProfile } from '../../auth/shared/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { LineItem, TaxProfile } from '../shared/billing.model';
import { ServiceFormModalComponent } from '../service-form-modal/service-form-modal.component';

// Define service interface
interface Service {
  id: string;
  name: string;
  price: number;
  description?: string;
  group: string;
  rate?: number;
  active?: boolean;
}

// Define package interface
interface Package {
  id: string;
  name: string;
  price: number;
  description?: string;
}

// Using Patient model imported from patients/shared/patient.model

@Component({
  selector: 'app-cash-memo-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, ServiceFormModalComponent],
  templateUrl: './cash-memo-form.component.html',
  styleUrls: ['./cash-memo-form.component.scss']
})
export class CashMemoFormComponent implements OnInit, OnDestroy {
  @ViewChild(ServiceFormModalComponent) serviceFormModal!: ServiceFormModalComponent;
  
  cashMemoForm!: FormGroup;
  isEditMode = false;
  cashMemoId: string | null = null;
  loading = false;
  submitted = false;
  patientSearchTerm = '';
  patientResults: any[] = [];
  showPatientSearch = false;
  currentUser = '';
  
  // New properties for cash memo form
  packages: Package[] = [];
  services: Service[] = [];
  taxProfiles: TaxProfile[] = [];
  serviceGroups: string[] = [];
  // Store filtered services for each line item
  lineItemFilteredServices: {[key: number]: Service[]} = {};
  subtotal = 0;
  grandTotal = 0;
  isSubmitting = false;
  
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
    private router: Router,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Get the current logged-in user
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUser = user.name || user.email || 'System';
      console.log('Current user for cash memo form:', this.currentUser);
    } else {
      this.currentUser = 'System';
      console.log('No user found, using default name');
    }
    
    // First load tax profiles so they're available when creating the form
    this.loadTaxProfiles().then(() => {
      this.createForm();
      this.loadServices();
      this.loadPackages();
      
      // Check for cash memo ID for edit mode
      this.cashMemoId = this.route.snapshot.paramMap.get('id');
      if (this.cashMemoId) {
        this.isEditMode = true;
        this.loadCashMemo(this.cashMemoId);
      }
    });
    
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
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions
    this.destroy$.next(undefined);
    this.destroy$.complete();
    
    if (this.hidePatientSearchTimeout) {
      clearTimeout(this.hidePatientSearchTimeout);
    }
  }
  
  // Get line items form array
  get lineItems(): FormArray {
    return this.cashMemoForm.get('lineItems') as FormArray;
  }

  createForm(): void {
    // Generate unique cash memo ID with date and random component
    const date = new Date();
    const dateStr = this.formatDate(date);
    const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const cashMemoId = `CM-${dateStr}-${randomPart}`;
    
    this.cashMemoForm = this.fb.group({
      billId: [cashMemoId],
      patientId: ['', Validators.required],
      patientName: ['', Validators.required],
      date: [dateStr, Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
      createdBy: [this.currentUser],
      modeOfPayment: ['Cash'],
      taxation: ['Non-Gst'],
      category: ['SERVICES'],
      package: [''],
      account: [this.currentUser], // Using logged-in user's name as default
      
      // Payment details
      referenceNo: [''],
      notes: [''],
      
      // Discount fields
      overallDiscount: [0],
      discountType: ['AMT'],
      
      // Tax fields
      totalTax: [0],
      taxBreakdown: [[]],
      
      // Line items
      lineItems: this.fb.array([this.createLineItem()])
    });
    
    // Listen for taxation type changes to recalculate totals
    this.cashMemoForm.get('taxation')?.valueChanges.subscribe(value => {
      this.updateAllLineItemTotals();
      this.calculateTotal();
    });
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }
  
  // Create an empty line item
  createLineItem(): FormGroup {
    return this.fb.group({
      date: [this.formatDate(new Date())],
      serviceId: ['', Validators.required],
      serviceName: [''],
      serviceGroup: [''],
      description: [''],
      incentive: ['None'],
      quantity: [1],
      rate: [0],
      discount: [0],
      taxProfileId: [''],
      taxDetails: [[]],
      totalAmount: [0]
    });
  }
  
  // Add a new line item
  addLineItem(): void {
    const today = new Date();
    const formattedDate = this.formatDate(today);
    
    const lineItem = this.fb.group({
      date: [formattedDate],
      serviceId: ['', Validators.required],
      serviceName: [''],
      serviceGroup: [''],
      description: [''],
      incentive: ['None'],
      quantity: [1],
      rate: [0],
      discount: [0],
      taxProfileId: [''],
      taxDetails: [[]],
      totalAmount: [0]
    });
    
    // Initialize filtered services for this new line item
    const newIndex = this.lineItems.length;
    this.lineItemFilteredServices[newIndex] = [];
    
    this.lineItems.push(lineItem);
  }
  
  // Remove a line item
  removeLineItem(index: number): void {
    if (this.lineItems.length > 1) {
      this.lineItems.removeAt(index);
      this.calculateTotal();
    } else {
      // Reset values instead of removing if it's the last row
      const lineItem = this.lineItems.at(0) as FormGroup;
      lineItem.patchValue({
        serviceId: '',
        serviceName: '',
        description: '',
        incentive: 'None',
        quantity: 1,
        rate: 0,
        discount: 0,
        totalAmount: 0
      });
      this.calculateTotal();
    }
  }
  
  // Calculate line item total based on quantity, rate and tax
  updateLineItemTotal(index: number): void {
    const lineItem = this.lineItems.at(index) as FormGroup;
    const quantity = +lineItem.get('quantity')?.value || 0;
    const rate = +lineItem.get('rate')?.value || 0;
    const discount = +lineItem.get('discount')?.value || 0;
    const taxProfileId = lineItem.get('taxProfileId')?.value;
    
    const baseAmount = quantity * rate - discount;
    let totalAmount = baseAmount;
    let taxDetails: { name: string; rate: number; amount: number; }[] = [];
    
    // Get taxation type (Non-Gst, Exclusive, Inclusive)
    const taxationType = this.cashMemoForm.get('taxation')?.value || 'Non-Gst';
    
    // For Non-Gst, no tax calculation is needed
    if (taxationType === 'Non-Gst') {
      // Total is just the base amount, no taxes
      totalAmount = baseAmount;
      taxDetails = [];
      
      // Ensure taxProfileId is cleared when Non-Gst is selected
      if (lineItem.get('taxProfileId')?.value) {
        lineItem.get('taxProfileId')?.setValue('', { emitEvent: false });
      }
    } 
    // For Exclusive and Inclusive, calculate taxes if a tax profile is selected
    else if (taxProfileId) {
      const taxProfile = this.taxProfiles.find(p => p.taxProfileId === taxProfileId);
      
      if (taxProfile && taxProfile.components && taxProfile.components.length > 0) {
        if (taxationType === 'Exclusive') {
          // For exclusive tax, calculate each component's amount and add to base
          taxDetails = taxProfile.components.map(component => {
            const componentAmount = baseAmount * (component.rate / 100);
            return {
              name: component.name,
              rate: component.rate,
              amount: +componentAmount.toFixed(2)
            };
          });
          
          // Sum all tax component amounts to get total tax
          const totalTaxAmount = taxDetails.reduce((sum, tax) => sum + tax.amount, 0);
          
          // For exclusive, add tax to the base amount
          totalAmount = baseAmount + totalTaxAmount;
        } 
        else if (taxationType === 'Inclusive') {
          // For inclusive, total already includes tax, extract components
          const totalTaxRate = taxProfile.totalRate / 100;
          
          // Calculate the net amount (amount without tax)
          const netAmount = baseAmount / (1 + totalTaxRate);
          
          // Calculate the total tax amount that was included in baseAmount
          const totalTaxAmount = baseAmount - netAmount;
          
          // Distribute the total tax amount proportionally among components
          if (totalTaxAmount > 0 && taxProfile.totalRate > 0) {
            taxDetails = taxProfile.components.map(component => {
              const componentAmount = totalTaxAmount * (component.rate / taxProfile.totalRate);
              return {
                name: component.name,
                rate: component.rate,
                amount: +componentAmount.toFixed(2)
              };
            });
          }
          
          // For inclusive, total remains the base amount as tax is already included
          totalAmount = baseAmount;
        }
      }
    }
    
    // Update the line item with calculated values
    lineItem.patchValue({
      totalAmount: +totalAmount.toFixed(2),
      taxDetails: taxDetails
    }, { emitEvent: false });
    
    // Recalculate the grand total
    this.calculateTotal();
  }
  
  // Handle service selection change
  onServiceChange(index: number): void {
    const lineItem = this.lineItems.at(index) as FormGroup;
    const serviceId = lineItem.get('serviceId')?.value;
    
    if (!serviceId) return;
    
    // Get default tax profile ID if available
    let defaultTaxProfileId = '';
    if (this.taxProfiles && this.taxProfiles.length > 0) {
      // Use No Tax profile if available, otherwise fallback to first tax profile
      const noTaxProfile = this.taxProfiles.find(p => 
        p.profileName.toLowerCase().includes('no tax') || 
        p.totalRate === 0 || 
        p.profileName.toLowerCase().includes('0%'));
      defaultTaxProfileId = noTaxProfile ? noTaxProfile.taxProfileId : this.taxProfiles[0].taxProfileId;
    }
    
    let isUnderArmPackage = false;
    
    // Set default values based on selected service
    if (serviceId === 'Hydra Package') {
      lineItem.patchValue({
        serviceName: 'Hydra Package',
        description: 'Complete Hydra Package',
        quantity: 3,
        rate: 4000,
        taxProfileId: defaultTaxProfileId
      });
    } else if (serviceId === 'Whole Body LHR Package') {
      lineItem.patchValue({
        serviceName: 'Whole Body LHR Package',
        description: 'Whole Body LHR',
        quantity: 6,
        rate: 10000,
        taxProfileId: defaultTaxProfileId
      });
    } else if (serviceId === 'UnderArm LHR Package') {
      // Set values for the first line item
      lineItem.patchValue({
        serviceName: 'UnderArm LHR Package',
        description: 'UnderArm LHR',
        quantity: 6,
        rate: 3333.33333,
        taxProfileId: defaultTaxProfileId
      });
      
      // Mark that we need to add additional items
      isUnderArmPackage = true;
    } else if (serviceId === 'OPD') {
      lineItem.patchValue({
        serviceName: 'OPD',
        description: 'OPD Consultation',
        quantity: 1,
        rate: 3000,
        taxProfileId: defaultTaxProfileId
      });
    } else if (serviceId === 'CONSULTATION') {
      lineItem.patchValue({
        serviceName: 'CONSULTATION',
        description: 'Doctor Consultation',
        quantity: 1,
        rate: 1000,
        taxProfileId: defaultTaxProfileId
      });
    } else if (serviceId === 'MNRF') {
      lineItem.patchValue({
        serviceName: 'MNRF',
        description: 'MNRF',
        quantity: 1,
        rate: 1500,
        taxProfileId: defaultTaxProfileId
      });
    } else {
      // For other services, look up in our services array
      const selectedService = this.services.find(s => s.id === serviceId);
      if (selectedService) {
        lineItem.patchValue({
          serviceName: selectedService.name, // Set serviceName for dynamic services
          description: selectedService.name,
          quantity: 1,
          rate: selectedService.price || 0,
          taxProfileId: defaultTaxProfileId
        });
      }
    }
    
    // If it's the UnderArm LHR Package, add the additional items
    if (isUnderArmPackage) {
      this.addSpecialUnderArmItems();
    }
    
    // Update the total for this line item
    this.updateLineItemTotal(index);
  }
  
  // Helper method to add special items for UnderArm LHR Package
  addSpecialUnderArmItems(): void {
    // Add consultation fee (700)
    const consultationItem = this.createLineItem();
    consultationItem.patchValue({
      description: 'Consultation Fee',
      quantity: 1,
      rate: 700,
      taxProfileId: this.taxProfiles.length > 0 ? this.taxProfiles[0].taxProfileId : ''
    });
    this.lineItems.push(consultationItem);
    
    // Add MNRF (7000)
    const mnrfItem = this.createLineItem();
    mnrfItem.patchValue({
      description: 'MNRF',
      quantity: 1,
      rate: 7000,
      taxProfileId: this.taxProfiles.length > 0 ? this.taxProfiles[0].taxProfileId : ''
    });
    this.lineItems.push(mnrfItem);
    
    // Add GFC (7000)
    const gfcItem = this.createLineItem();
    gfcItem.patchValue({
      description: 'GFC',
      quantity: 1,
      rate: 7000,
      taxProfileId: this.taxProfiles.length > 0 ? this.taxProfiles[0].taxProfileId : ''
    });
    this.lineItems.push(gfcItem);
    
    // Update all totals
    this.updateAllLineItemTotals();
  }
  
  // Calculate subtotal and grand total
  // Update all line items when taxation type changes
  updateAllLineItemTotals(): void {
    for (let i = 0; i < this.lineItems.length; i++) {
      this.updateLineItemTotal(i);
    }
  }

  calculateTotal(): void {
    this.subtotal = 0;
    let totalTaxAmount = 0;
    let taxBreakdown: { [key: string]: number } = {};
    
    // Loop through each line item and add up the totals
    for (let i = 0; i < this.lineItems.length; i++) {
      const lineItem = this.lineItems.at(i) as FormGroup;
      const totalAmount = +lineItem.get('totalAmount')?.value || 0;
      
      this.subtotal += totalAmount;
      
      // Accumulate tax details for the breakdown
      const taxDetails = lineItem.get('taxDetails')?.value || [];
      if (taxDetails && taxDetails.length > 0) {
        taxDetails.forEach((detail: any) => {
          if (detail.name && detail.amount) {
            // Update total tax amount
            totalTaxAmount += detail.amount;
            
            // Update tax breakdown
            if (!taxBreakdown[detail.name]) {
              taxBreakdown[detail.name] = 0;
            }
            taxBreakdown[detail.name] += detail.amount;
          }
        });
      }
    }
    
    // Apply overall discount
    const overallDiscount = +this.cashMemoForm.get('overallDiscount')?.value || 0;
    const discountType = this.cashMemoForm.get('discountType')?.value;
    
    let discountAmount = 0;
    if (discountType === 'AMT') {
      discountAmount = overallDiscount;
    } else {
      discountAmount = this.subtotal * (overallDiscount / 100);
    }
    
    this.grandTotal = this.subtotal - discountAmount;
    
    // Ensure we don't have negative totals
    if (this.grandTotal < 0) this.grandTotal = 0;
    
    // Update the amount field in the form
    this.cashMemoForm.get('amount')?.setValue(this.grandTotal);
    
    // Store tax breakdown in a way that's accessible to the template
    this.cashMemoForm.get('taxBreakdown')?.setValue(Object.entries(taxBreakdown).map(([name, amount]) => ({
      name,
      amount: parseFloat(amount.toFixed(2))
    })));
    
    // Update total tax in the form
    this.cashMemoForm.get('totalTax')?.setValue(totalTaxAmount);
    
    console.log(`Calculated subtotal: ${this.subtotal}, Taxes: ${totalTaxAmount}, Grand total: ${this.grandTotal}`);
    console.log('Tax breakdown:', taxBreakdown);
  }

  loadCashMemo(id: string): void {
    this.loading = true;
    this.billingService.getCashMemoById(id).subscribe({
      next: (cashMemo) => {
        // Wait for tax profiles to be loaded before patching form
        this.loadTaxProfiles().then(() => {
          // Patch basic fields
          this.cashMemoForm.patchValue({
            patientId: cashMemo.patientId,
            patientName: cashMemo.patientName,
            date: this.formatDate(new Date(cashMemo.date)),
            amount: cashMemo.amount,
            createdBy: cashMemo.createdBy,
            modeOfPayment: cashMemo.modeOfPayment,
            billId: cashMemo.billId,
            taxation: cashMemo.taxation || 'Non-Gst',
            category: cashMemo.category || 'SERVICES',
            package: cashMemo.package || '',
            account: cashMemo.account || 'Cash',
            referenceNo: cashMemo.referenceNo || '',
            notes: cashMemo.notes || '',
            overallDiscount: cashMemo.overallDiscount || 0,
            discountType: cashMemo.discountType || 'AMT',
            totalTax: cashMemo.totalTax || 0,
            taxBreakdown: cashMemo.taxBreakdown || []
          });
          
          // If the cash memo has line items, replace the form array
          if (cashMemo.lineItems && cashMemo.lineItems.length > 0) {
            this.lineItems.clear();
            
            // Initialize lineItemFilteredServices array if not already done
            if (!this.lineItemFilteredServices) {
              this.lineItemFilteredServices = [];
            }
            
            // Process each line item
            cashMemo.lineItems.forEach((item, index) => {
              const lineItemGroup = this.createLineItem();
              
              // Create a spot for this line item in the filtered services array
              this.lineItemFilteredServices[index] = [];
              
              // First check if we have a serviceGroup in the saved data
              if (item.serviceGroup) {
                // If we have a saved serviceGroup, use it to filter services
                this.lineItemFilteredServices[index] = this.services
                  .filter(s => s.group === item.serviceGroup);
                
                console.log(`Using saved serviceGroup ${item.serviceGroup} for line ${index}, found ${this.lineItemFilteredServices[index].length} matching services`);
              } 
              // Fallback: try to find service group from the serviceId
              else if (item.serviceId) {
                const service = this.services.find(s => s.id === item.serviceId);
                if (service) {
                  // Extract the service group from the found service
                  const serviceGroup = service.group || 'OPD';
                  
                  // Update the item's serviceGroup for consistency
                  item.serviceGroup = serviceGroup;
                  
                  // Filter services for this group
                  this.lineItemFilteredServices[index] = this.services
                    .filter(s => s.group === serviceGroup);
                    
                  console.log(`Extracted serviceGroup ${serviceGroup} from service for line ${index}, found ${this.lineItemFilteredServices[index].length} matching services`);
                } else {
                  // If service not found, load all services as fallback
                  console.log(`Service with ID ${item.serviceId} not found in services list`);
                  this.lineItemFilteredServices[index] = this.services;
                }
              } else {
                // If no service ID or serviceGroup, initialize with empty array
                this.lineItemFilteredServices[index] = [];
              }
              
              // Patch the form group values
              lineItemGroup.patchValue(item);
              this.lineItems.push(lineItemGroup);
              
              // Make sure we update the service group dropdown with the saved value
              // We need to do this after the form is updated with a setTimeout
              setTimeout(() => {
                const serviceGroupSelect = document.getElementById('serviceGroup_' + index) as HTMLSelectElement;
                if (serviceGroupSelect && item.serviceGroup) {
                  serviceGroupSelect.value = item.serviceGroup;
                }
              }, 0);
            });
          }
          
          this.calculateTotal();
          this.loading = false;
        });
      },
      error: (error) => {
        console.error('Error loading cash memo', error);
        this.loading = false;
      }
    });
  }

  // Note: formatDate function is already defined below

  onSubmit(): void {
    this.submitted = true;
    this.isSubmitting = true;

    // Mark all form controls as touched to trigger validation messages
    Object.keys(this.cashMemoForm.controls).forEach(key => {
      const control = this.cashMemoForm.get(key);
      control?.markAsTouched();
      
      // Debug which specific fields are invalid
      if (control?.invalid) {
        console.log(`Field ${key} is invalid:`, control.errors);
      }
    });

    if (this.cashMemoForm.invalid) {
      console.log('Form is invalid. Checking specific field validation issues...');
      this.isSubmitting = false;
      return;
    }
    
    this.loading = true;
    const formValue = this.cashMemoForm.value;
    
    // Ensure date is properly formatted
    const formattedDate = formValue.date ? this.formatDate(new Date(formValue.date)) : this.formatDate(new Date());
    
    // Calculate final amount from line items
    this.calculateTotal();
    
    // Map form values to cash memo model with proper formatting
    // Include fields that exist in the backend model and new fields
    const cashMemo: any = {
      patientId: formValue.patientId,
      patientName: formValue.patientName,
      date: formattedDate,
      amount: this.grandTotal, // Use calculated grand total
      createdBy: formValue.createdBy || 'System',
      modeOfPayment: formValue.modeOfPayment || 'CASH',
      billId: formValue.billId,
      
      // Add new fields
      category: formValue.category,
      taxation: formValue.taxation,
      account: formValue.account,
      package: formValue.package,
      referenceNo: formValue.referenceNo,
      notes: formValue.notes,
      overallDiscount: formValue.overallDiscount,
      discountType: formValue.discountType,
      
      // Tax information
      totalTax: formValue.totalTax || 0,
      taxBreakdown: formValue.taxBreakdown || [],
      
      // Process line items to include tax profile information
      lineItems: formValue.lineItems.map((item: any) => {
        // Find the selected tax profile to include details
        let taxInfo = null;
        if (item.taxProfileId && formValue.taxation !== 'Non-Gst') {
          const taxProfile = this.taxProfiles.find(p => p.taxProfileId === item.taxProfileId);
          if (taxProfile) {
            taxInfo = {
              taxProfileName: taxProfile.profileName,
              taxRate: taxProfile.totalRate
            };
          }
        }
        
        return {
          ...item,
          taxInfo
        };
      })
    };
    
    // Add logging to see what's being sent to the API
    console.log('Submitting cash memo data to API:', cashMemo);
    
    // Save or update based on mode
    if (this.isEditMode && this.cashMemoId) {
      this.billingService.updateCashMemo(this.cashMemoId, cashMemo)
        .pipe(finalize(() => { this.loading = false; this.isSubmitting = false; }))
        .subscribe({
          next: (response) => {
            console.log('Cash memo update successful:', response);
            alert('Cash memo updated successfully');
            this.router.navigate(['/billing/cash-memos']);
          },
          error: (error) => {
            console.error('Error updating cash memo:', error);
            let errorMsg = 'Failed to update cash memo';
            if (error.error && error.error.message) {
              errorMsg += ': ' + error.error.message;
            } else if (error.message) {
              errorMsg += ': ' + error.message;
            }
            alert(errorMsg);
          }
        });
    } else {
      this.billingService.createCashMemo(cashMemo)
        .pipe(finalize(() => { this.loading = false; this.isSubmitting = false; }))
        .subscribe({
          next: (response) => {
            console.log('Cash memo creation successful:', response);
            alert('Cash memo created successfully');
            this.router.navigate(['/billing/cash-memos']);
          },
          error: (error) => {
            console.error('Error creating cash memo:', error);
            let errorMsg = 'Failed to create cash memo';
            if (error.error && error.error.message) {
              errorMsg += ': ' + error.error.message;
            } else if (error.message) {
              errorMsg += ': ' + error.message;
            }
            alert(errorMsg);
          }
        });
    }
  }

  onPatientSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.patientSearchTerm = target.value;
    
    // Show the search dropdown as soon as user starts typing
    if (this.patientSearchTerm.length > 0) {
      this.showPatientSearch = true;
    }
    
    // Feed the search term to the subject when it's long enough
    if (this.patientSearchTerm.length > 2) {
      this.searchTerms.next(this.patientSearchTerm);
    } else {
      this.patientResults = [];
      // Keep dropdown visible with a message if less than 3 characters
    }
  }
  
  searchPatients(term: string): void {
    if (term.length > 2) {
      // Show loading indicator in search area
      const loadingResult = [{
        id: 'loading',
        name: 'Searching...',
        isLoading: true
      }];
      this.patientResults = loadingResult;
      
      this.patientService.searchPatients(term)
        .subscribe({
          next: (patients) => {
            if (patients && patients.length > 0) {
              this.patientResults = patients.slice(0, 10).map(patient => ({
                id: patient.id || patient.patientId || '',
                name: `${patient.firstName} ${patient.lastName || ''}`,
                contactNumber: patient.mobileNumber || '',  // Using mobileNumber from Patient model
                patientIdDisplay: patient.patientId || ''
              }));
            } else {
              // No results found
              this.patientResults = [{
                id: 'no-results',
                name: 'No patients found',
                noResults: true
              }];
            }
          },
          error: (error) => {
            console.error('Error searching patients:', error);
            this.patientResults = [{
              id: 'error',
              name: 'Error searching patients',
              isError: true
            }];
          }
        });
    } else if (term.length > 0) {
      // Show prompt to type more
      this.patientResults = [{
        id: 'prompt',
        name: 'Type at least 3 characters to search',
        isPrompt: true
      }];
    } else {
      this.patientResults = [];
    }
  }
  
  hidePatientSearch(): void {
    // Use a timeout to allow click events to complete first
    // This ensures the selectPatient method can execute before hiding the dropdown
    this.hidePatientSearchTimeout = setTimeout(() => {
      this.showPatientSearch = false;
      
      // If search is active but no results are selected, clear the search term
      if (!this.cashMemoForm.get('patientId')?.value && this.patientSearchTerm) {
        // Leave the search term visible if it's a valid search in progress
        if (!(this.patientResults.length === 1 && 
              (this.patientResults[0].isLoading || 
               this.patientResults[0].isPrompt))) {
          // Keep the search term if user is actively searching
        }
      }
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
    this.cashMemoForm.patchValue({
      patientId: '',
      patientName: ''
    });
    this.patientSearchTerm = '';
    this.patientResults = [];
  }

  selectPatient(patient: any): void {
    // Clear any existing timeout to prevent the dropdown from hiding
    if (this.hidePatientSearchTimeout) {
      clearTimeout(this.hidePatientSearchTimeout);
      this.hidePatientSearchTimeout = null;
    }
    
    // Skip if this is a special result (loading, error, etc.)
    if (patient.isLoading || patient.noResults || patient.isError || patient.isPrompt) {
      return;
    }
    
    // Update the form with patient details
    this.cashMemoForm.patchValue({
      patientId: patient.id,
      patientName: patient.name
    });
    
    // Display a formatted version in the search input that includes more context
    const displayText = patient.patientIdDisplay 
      ? `${patient.name} (${patient.patientIdDisplay})` 
      : patient.name;
    
    this.patientSearchTerm = displayText;
    console.log(`Selected patient: ${displayText}, ID: ${patient.id}`);
    
    // Hide the dropdown after selection
    this.showPatientSearch = false;
    this.patientResults = [];
  }
  
  cancelForm(): void {
    this.router.navigate(['/billing/cash-memos']);
  }
  
  // Apply package when selected from dropdown
  applyPackage(event: any): void {
    const packageName = event.target.value;
    
    if (!packageName) {
      return;
    }
    
    // Define services to add based on package type
    let packageServices: { serviceId: string, description: string, rate: number, quantity: number }[] = [];
    
    if (packageName === 'Hydra Package') {
      packageServices = [
        { serviceId: 'Hydra Package', description: 'Hydra Facial Service', rate: 1500, quantity: 1 },
        { serviceId: 'CONSULTATION', description: 'Doctor Consultation', rate: 500, quantity: 1 }
      ];
    } else if (packageName === 'Whole Body LHR Package') {
      packageServices = [
        { serviceId: 'Whole Body LHR Package', description: 'Laser Hair Removal - Full Body', rate: 15000, quantity: 1 },
        { serviceId: 'CONSULTATION', description: 'Dermatologist Consultation', rate: 1000, quantity: 1 }
      ];
    } else if (packageName === 'UnderArm LHR Package') {
      packageServices = [
        { serviceId: 'UnderArm LHR Package', description: 'Laser Hair Removal - Underarms', rate: 5000, quantity: 1 }
      ];
    }
    
    // Clear existing line items and add package items
    if (packageServices.length > 0) {
      // Keep the first line item and update it with the first service
      if (this.lineItems.length > 0) {
        const firstItem = this.lineItems.at(0) as FormGroup;
        const firstService = packageServices[0];
        
        firstItem.patchValue({
          serviceId: firstService.serviceId,
          description: firstService.description,
          rate: firstService.rate,
          quantity: firstService.quantity,
          discount: 0,
          taxProfileId: this.taxProfiles.length > 0 ? this.taxProfiles[0].taxProfileId : ''
        });
        
        // Remove any extra items except the first one
        while (this.lineItems.length > 1) {
          this.lineItems.removeAt(1);
        }
        
        // Add remaining services as new line items
        for (let i = 1; i < packageServices.length; i++) {
          const service = packageServices[i];
          const newItem = this.createLineItem();
          newItem.patchValue({
            serviceId: service.serviceId,
            description: service.description,
            rate: service.rate,
            quantity: service.quantity,
            discount: 0,
            taxProfileId: this.taxProfiles.length > 0 ? this.taxProfiles[0].taxProfileId : ''
          });
          this.lineItems.push(newItem);
        }
        
        // Update totals
        this.updateAllLineItemTotals();
      }
    }
  }
  
  // This method has been moved to line ~439
  
  // Create a new service using the modal component
  createNewService(): void {
    // Open the service creation modal
    if (this.serviceFormModal) {
      this.serviceFormModal.open();
    } else {
      console.error('Service form modal not initialized');
      alert('Cannot open service creation form. Please try again.');
    }
  }
  
  // Handle the newly created service
  onServiceCreated(service: any): void {
    console.log('New service created:', service);
    
    // Add the new service to the services list
    if (service && service.id) {
      this.services.push({
        id: service.id,
        name: service.name,
        price: service.rate || 0,
        description: service.description || '',
        group: service.group || 'GENERAL',
        rate: service.rate || 0,
        active: service.active !== undefined ? service.active : true
      });
      
      // Sort services by name for better UX
      this.services.sort((a, b) => a.name.localeCompare(b.name));
      
      // Show success message
      alert(`Service '${service.name}' created successfully!`);
    }
  }
  
  // Load services from API
  loadServices(): void {
    // Make API call to get actual services
    this.http.get<any>(`${environment.apiUrl}/api/services`).subscribe({
      next: (response: any) => {
        console.log('Services API response:', response);
        // Check if response has the expected structure
        if (response && response.data && Array.isArray(response.data)) {
          // Map API response to Service interface
          this.services = response.data.map((item: any) => ({
            id: item.id,
            name: item.name,
            price: item.rate || 0,
            description: item.description || '',
            group: item.group || 'GENERAL',
            rate: item.rate || 0,
            active: item.active !== undefined ? item.active : true
          }));
          
          // Extract unique groups
          this.extractServiceGroups();
          console.log('Services loaded:', this.services.length);
          console.log('Service groups:', this.serviceGroups);
        } else {
          console.warn('Unexpected API response format for services');
          this.loadFallbackServices();
        }
      },
      error: (error: any) => {
        console.error('Error loading services', error);
        this.loadFallbackServices();
      }
    });
  }
  
  // Load fallback services when API fails
  private loadFallbackServices(): void {
    console.log('Loading fallback service data');
    this.services = [
      { id: 'SVC001', name: 'General Consultation', price: 500, description: 'General doctor consultation', group: 'CONSULTATION', rate: 500, active: true },
      { id: 'SVC002', name: 'Specialist Consultation', price: 1000, description: 'Specialist doctor consultation', group: 'CONSULTATION', rate: 1000, active: true },
      { id: 'SVC003', name: 'Blood Test - Basic', price: 800, description: 'Basic blood test panel', group: 'OPD', rate: 800, active: true },
      { id: 'SVC004', name: 'X-Ray', price: 1200, description: 'X-Ray imaging', group: 'OPD', rate: 1200, active: true },
      { id: 'SVC005', name: 'Health Checkup Basic', price: 2500, description: 'Basic health checkup', group: 'PACKAGE', rate: 2500, active: true },
      { id: 'SVC006', name: 'Health Checkup Premium', price: 5000, description: 'Premium health checkup', group: 'PACKAGE', rate: 5000, active: true }
    ];
    
    // Extract unique groups from fallback data
    this.extractServiceGroups();
  }
  
  
  // Extract unique service groups from the services array
  extractServiceGroups(): void {
    // Extract unique group values and sort them
    this.serviceGroups = [...new Set(this.services.map(service => service.group))]
      .filter(group => group) // Remove any undefined/empty groups
      .sort();
  }
  
  // Handle group selection change with line item index
  onGroupChange(event: any, lineItemIndex: number): void {
    const selectedGroup = event.target.value;
    const lineItem = this.lineItems.at(lineItemIndex) as FormGroup;
    
    // Set the serviceGroup in the form control
    lineItem.get('serviceGroup')?.setValue(selectedGroup);
    
    // Filter services based on selected group
    if (selectedGroup) {
      this.lineItemFilteredServices[lineItemIndex] = this.services.filter(
        service => service.group === selectedGroup
      );
    } else {
      // If no group selected, show all services
      this.lineItemFilteredServices[lineItemIndex] = this.services;
    }
    
    // Reset service selection when group changes
    lineItem.get('serviceId')?.setValue('');
    lineItem.get('serviceName')?.setValue('');
    lineItem.get('description')?.setValue('');
    lineItem.get('rate')?.setValue(0);
    lineItem.get('discount')?.setValue(0);
    lineItem.get('totalAmount')?.setValue(0);
  }
  
  // Get service group for a given service ID
  getServiceGroupById(serviceId: string): string {
    const service = this.services.find(s => s.id === serviceId);
    return service?.group || '';
  }
  
  // Load packages from API
  loadPackages(): void {
    // For testing, use dummy data
    this.packages = [
      { id: 'PKG001', name: 'Health Checkup Basic', price: 2500, description: 'Basic health checkup package' },
      { id: 'PKG002', name: 'Health Checkup Premium', price: 5000, description: 'Premium health checkup with additional tests' }
    ];
    
    // Uncomment and use when API is available
    /*
    this.http.get<Package[]>(`${environment.apiUrl}/packages`).subscribe({
      next: (data) => {
        this.packages = data;
      },
      error: (error) => {
        console.error('Error loading packages', error);
      }
    });
    */
  }
  private apiUrl = `${environment.apiUrlInventory}`;
  // Load tax profiles from API
  loadTaxProfiles(): Promise<void> {
    return new Promise<void>((resolve) => {
      // If tax profiles are already loaded, resolve immediately
      if (this.taxProfiles && this.taxProfiles.length > 0) {
        resolve();
        return;
      }
      // Use the exact API URL as specified
      const apiUrl = `${this.apiUrl}/api/inventory/masters/tax-profiles`;
      
      this.http.get<any[]>(apiUrl).subscribe({
        next: (data) => {
          // Map the response data to our TaxProfile interface based on the provided format
          this.taxProfiles = data.map(profile => ({
            taxProfileId: profile.taxProfileId,
            profileName: profile.profileName,
            totalRate: profile.totalRate,
            components: profile.components || []
          }));
          
          console.log('Loaded tax profiles:', this.taxProfiles);
          resolve();
        },
        error: (error) => {
          console.error('Failed to load tax profiles:', error);
          
          // Provide fallback dummy data similar to the expected format
          this.taxProfiles = [
            {
              taxProfileId: 'tax_gst_6%',
              profileName: 'GST 6%',
              totalRate: 12.0,
              components: [
                { name: 'CGST', rate: 6.0 },
                { name: 'SGST', rate: 6.0 }
              ]
            },
            {
              taxProfileId: 'tax_gst_9%',
              profileName: 'GST 9%',
              totalRate: 18.0,
              components: [
                { name: 'CGST', rate: 9.0 },
                { name: 'SGST', rate: 9.0 }
              ]
            },
            {
              taxProfileId: 'tax_gst_2.5%',
              profileName: 'GST 2.5%',
              totalRate: 5.0,
              components: [
                { name: 'CGST', rate: 2.5 },
                { name: 'SGST', rate: 2.5 }
              ]
            }
          ];
          
          console.log('Using fallback tax profiles:', this.taxProfiles);
          resolve();
        }
      });
    });
  }
}
