import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BillingService } from '../shared/billing.service';
import { Invoice, InvoiceItem, TaxProfile } from '../shared/billing.model';
import { PatientService } from '../../patients/shared/patient.service';
import { Patient } from '../../patients/shared/patient.model';
import { finalize, debounceTime, switchMap, catchError, takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { of, Subject, Subscription } from 'rxjs';
import { AuthService } from '../../auth/shared/auth.service';
import { ServiceModalComponent } from '../service-modal/service-modal.component';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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

@Component({
  selector: 'app-invoice-form',
  templateUrl: './invoice-form.component.html',
  styleUrls: ['./invoice-form.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    ServiceModalComponent
  ]
})
export class InvoiceFormComponent implements OnInit, OnDestroy {
  invoiceForm!: FormGroup;
  isEditMode = false;
  invoiceId: string | null = null;
  loading = false;
  submitted = false;
  patientSearchTerm = '';
  patientResults: any[] = [];
  showPatientSearch = false;
  selectedPatient: any = null;
  searchField = new FormControl('');
  
  // Modal visibility
  showServiceModal = false;
  
  // Package options
  packageOptions = [
    { name: 'Hydra Package', quantity: 3, rate: 4000 },
    { name: 'Whole Body LHR Package', quantity: 6, rate: 10000 },
    { name: 'UnderArm LHR Package', quantity: 6, rate: 3333.33333 }
  ];
  
  // Service and tax profile data from API
  services: Service[] = [];
  taxProfiles: TaxProfile[] = [];
  selectedTaxProfile: TaxProfile | null = null;
  serviceGroups: string[] = [];
  
  // For improved search and cleanup
  private searchTerms = new Subject<string>();
  private destroy$ = new Subject<void>();
  private searchSubscription?: Subscription;
  private hidePatientSearchTimeout?: any;
  private apiUrl = environment.apiUrl;
  
  currentUser = '';
  
  constructor(
    private fb: FormBuilder,
    private billingService: BillingService,
    private patientService: PatientService,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private http: HttpClient
  ) {
    // Get current user
    const user = this.authService.getCurrentUser();
    this.currentUser = user?.name || user?.email || 'System';
  }

  ngOnInit(): void {
    // First load tax profiles so they're available when creating the form
    this.loadTaxProfiles().then(() => {
      this.createForm();
      this.loadServices();
      
      // Check for invoice ID for edit mode
      this.invoiceId = this.route.snapshot.paramMap.get('id');
      if (this.invoiceId) {
        this.isEditMode = true;
        this.loadInvoice(this.invoiceId);
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
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions
    this.destroy$.next(undefined);
    this.destroy$.complete();
    
    if (this.hidePatientSearchTimeout) {
      clearTimeout(this.hidePatientSearchTimeout);
    }
  }
  
  /**
   * Load tax profiles from the API
   */
  loadTaxProfiles(): Promise<void> {
    return new Promise<void>((resolve) => {
      // If tax profiles are already loaded, resolve immediately
      if (this.taxProfiles && this.taxProfiles.length > 0) {
        resolve();
        return;
      }
      // Use the exact API URL as specified
      const apiUrl = `${environment.apiUrlInventory}/api/inventory/masters/tax-profiles`;
      
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
        error: (error: any) => {
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
  
  /**
   * Load services from the API
   */
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
  
  /**
   * Load fallback services when API fails
   */
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
  
  /**
   * Extract unique service groups from the services array
   */
  extractServiceGroups(): void {
    this.serviceGroups = [...new Set(this.services.map(service => service.group))];
  }

  createForm(): void {
    this.invoiceForm = this.fb.group({
      patientId: ['', [Validators.required]],
      patientName: ['', [Validators.required]],
      date: [this.formatDate(new Date()), [Validators.required]],
      amount: [0, [Validators.required, Validators.min(0)]],
      createdBy: [this.currentUser, [Validators.required]],
      modeOfPayment: ['CASH', [Validators.required]],
      status: ['UNPAID', [Validators.required]],
      paidAmount: [0],
      balanceAmount: [0],
      totalPaid: [0], // Added missing totalPaid control

      package: ['', []],
      category: ['SERVICES', [Validators.required]],
      // Common tax type for all line items
      commonTaxationType: ['Non-Gst', [Validators.required]],
      subtotal: [0, []],
      overallDiscount: [0, []],
      overallDiscountType: ['PERCENT', []],
      notes: ['', []],
      // Tax breakdown and total tax for display
      taxBreakdown: [[]],
      totalTax: [0],
      items: this.fb.array([this.createItem()]),
      payments: this.fb.array([])
    });
    

  }

  createItem(): FormGroup {
    return this.fb.group({
      serviceDate: [this.formatDate(new Date()), [Validators.required]],
      serviceId: ['', [Validators.required]],
      serviceName: [''],
      serviceGroup: [''],
      serviceType: ['', [Validators.required]],
      serviceDescription: ['', [Validators.required]],
      incentive: ['NO', []],
      quantity: [1, [Validators.required, Validators.min(1)]],
      rate: [0, [Validators.required, Validators.min(0)]],
      amount: [0, [Validators.required]],
      discount: [0, [Validators.min(0)]],
      // Removed taxationType from line items - now using common tax type
      taxProfileId: [''],
      tax: [0, [Validators.min(0)]],
      totalAmount: [0, [Validators.required]],
      // Tax details for CGST/SGST breakdown
      taxDetails: [[]]
    });
  }

  get items(): FormArray {
    return this.invoiceForm.get('items') as FormArray;
  }
  
  get payments(): FormArray {
    return this.invoiceForm.get('payments') as FormArray;
  }
  
  createPayment(): FormGroup {
    return this.fb.group({
      date: [this.formatDate(new Date()), [Validators.required]],
      amount: [0, [Validators.required, Validators.min(0)]],
      modeOfPayment: ['CASH', [Validators.required]],
      reference: [''],
      notes: ['']
    });
  }

  addItem(): void {
    this.items.push(this.createItem());
    this.calculateTotals();
  }
  
  /**
   * Handle service selection for a line item
   */
  onServiceChange(index: number, event: Event): void {
    const serviceId = (event.target as HTMLSelectElement).value;
    const item = this.items.at(index) as FormGroup;
    
    if (serviceId) {
      const selectedService = this.services.find(s => s.id === serviceId);
      if (selectedService) {
        item.patchValue({
          serviceId: selectedService.id,
          serviceName: selectedService.name,
          serviceGroup: selectedService.group,
          serviceType: selectedService.group,
          serviceDescription: selectedService.description || selectedService.name,
          rate: selectedService.rate || selectedService.price
        });
        
        // Recalculate totals after service selection
        this.updateItemTotal(index);
        this.calculateTotals();
      }
    } else {
      // Clear service-related fields if no service selected
      item.patchValue({
        serviceId: '',
        serviceName: '',
        serviceGroup: '',
        serviceType: '',
        serviceDescription: '',
        rate: 0
      });
      
      this.updateItemTotal(index);
      this.calculateTotals();
    }
  }
  
  /**
   * Handle quantity change for a line item
   */
  onQuantityChange(index: number): void {
    this.updateItemTotal(index);
    this.calculateTotals();
  }
  
  /**
   * Handle rate change for a line item
   */
  onRateChange(index: number): void {
    this.updateItemTotal(index);
    this.calculateTotals();
  }
  
  /**
   * Handle discount change for a line item
   */
  onDiscountChange(index: number): void {
    this.updateItemTotal(index);
    this.calculateTotals();
  }
  
  /**
   * Handle common taxation type change - affects all line items
   */
  onCommonTaxationTypeChange(): void {
    const commonTaxationType = this.invoiceForm.get('commonTaxationType')?.value;
    
    // Update all line items based on common tax type
    this.items.controls.forEach((item, index) => {
      if (commonTaxationType === 'Non-Gst') {
        item.patchValue({
          taxProfileId: '',
          tax: 0
        });
      }
      item.get('taxProfileId')?.updateValueAndValidity();
      this.updateItemTotal(index);
    });
    
    this.calculateTotals();
  }
 

  removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index);
      this.calculateTotals();
    }
  }

  calculateItemTotal(index: number): void {
    const item = this.items.at(index) as FormGroup;
    const quantity = +item.get('quantity')?.value;
    const rate = +item.get('rate')?.value;
    const discount = +item.get('discount')?.value;
    const taxRate = +item.get('tax')?.value;
    
    const amount = quantity * rate;
    const discountAmount = amount * (discount / 100);
    const taxAmount = (amount - discountAmount) * (taxRate / 100);
    const totalAmount = amount - discountAmount + taxAmount;
    
    item.patchValue({
      amount: amount.toFixed(2),
      totalAmount: totalAmount.toFixed(2)
    }, { emitEvent: false });
    
    this.calculateTotals();
  }
  
  /**
   * Calculate invoice totals using the new taxation types
   */
  calculateTotals(): void {
    // First, update all line item totals
    for (let i = 0; i < this.items.length; i++) {
      this.updateItemTotal(i);
    }
    
    let subtotal = 0;
    let totalTaxAmount = 0;
    let taxBreakdown: { [key: string]: number } = {};
    
    // Loop through each line item and add up the totals
    for (let i = 0; i < this.items.length; i++) {
      const lineItem = this.items.at(i) as FormGroup;
      const totalAmount = +lineItem.get('totalAmount')?.value || 0;
      
      subtotal += totalAmount;
      
      // Accumulate tax details for the breakdown
      const taxDetails = lineItem.get('taxDetails')?.value || [];
      if (taxDetails && taxDetails.length > 0) {
        taxDetails.forEach((detail: any) => {
          taxBreakdown[detail.name] = (taxBreakdown[detail.name] || 0) + detail.amount;
          totalTaxAmount += detail.amount;
        });
      }
    }
    
    // Get overall discount amount
    const overallDiscount = +this.invoiceForm.get('overallDiscount')?.value || 0;
    const overallDiscountType = this.invoiceForm.get('overallDiscountType')?.value || 'PERCENT';
    
    let discountAmount = 0;
    if (overallDiscountType === 'PERCENT') {
      discountAmount = subtotal * (overallDiscount / 100);
    } else {
      discountAmount = overallDiscount;
    }
    
    // Calculate final total
    const grandTotal = subtotal - discountAmount;
    
    // Update form values
    this.invoiceForm.patchValue({
      subtotal: +subtotal.toFixed(2),
      amount: +grandTotal.toFixed(2),
      balanceAmount: +grandTotal.toFixed(2),
      // Store tax breakdown in a way that's accessible to the template
      taxBreakdown: Object.entries(taxBreakdown).map(([name, amount]) => ({
        name,
        amount: parseFloat(amount.toFixed(2))
      })),
      // Update total tax in the form
      totalTax: totalTaxAmount
    }, { emitEvent: false });
    
    // Update payment-related fields if we have payments
    if (this.payments && this.payments.length > 0) {
      this.updatePaymentTotals();
    }
    
    console.log(`Calculated subtotal: ${subtotal}, Taxes: ${totalTaxAmount}, Grand total: ${grandTotal}`);
    console.log('Tax breakdown:', taxBreakdown);
  }
  
  /**
   * Update individual item total based on quantity, rate, discount and tax
   */
  updateItemTotal(index: number): void {
    const item = this.items.at(index) as FormGroup;
    const quantity = +item.get('quantity')?.value || 0;
    const rate = +item.get('rate')?.value || 0;
    const discount = +item.get('discount')?.value || 0;
    const taxProfileId = item.get('taxProfileId')?.value;
    
    const baseAmount = quantity * rate - discount;
    let totalAmount = baseAmount;
    let taxDetails: { name: string; rate: number; amount: number; }[] = [];
    
    // Get taxation type from common form field
    const taxationType = this.invoiceForm.get('commonTaxationType')?.value || 'Non-Gst';
    
    // For Non-Gst, no tax calculation is needed
    if (taxationType === 'Non-Gst') {
      totalAmount = baseAmount;
      taxDetails = [];
    } 
    // For Exclusive and Inclusive, calculate taxes if a tax profile is selected
    else if (taxProfileId) {
      const taxProfile = this.taxProfiles.find(p => p.taxProfileId === taxProfileId);
      
      if (taxProfile && taxProfile.components && taxProfile.components.length > 0) {
        if (taxationType === 'Exclusive') {
          // For exclusive tax, calculate tax amount and add to base
          const totalTaxAmount = baseAmount * (taxProfile.totalRate / 100);
          totalAmount = baseAmount + totalTaxAmount;
          
          // Calculate individual tax components
          taxProfile.components.forEach(component => {
            const componentAmount = baseAmount * (component.rate / 100);
            taxDetails.push({
              name: component.name,
              rate: component.rate,
              amount: +componentAmount.toFixed(2)
            });
          });
        } else if (taxationType === 'Inclusive') {
          // For inclusive tax, extract tax from total amount
          const taxableAmount = baseAmount / (1 + taxProfile.totalRate / 100);
          const totalTaxAmount = baseAmount - taxableAmount;
          totalAmount = baseAmount; // Total remains the same for inclusive
          
          // Calculate individual tax components
          taxProfile.components.forEach(component => {
            const componentAmount = taxableAmount * (component.rate / 100);
            taxDetails.push({
              name: component.name,
              rate: component.rate,
              amount: +componentAmount.toFixed(2)
            });
          });
        }
      }
    }
    
    // Update the line item with calculated values
    item.patchValue({
      totalAmount: +totalAmount.toFixed(2),
      taxDetails: taxDetails
    }, { emitEvent: false });
  }
  
  /**
   * Apply package selection to the form
   * If the same package already exists, update its quantity and totals
   * Otherwise, add it as a new row
   */
  applyPackage(event: Event): void {
    const packageName = (event.target as HTMLSelectElement).value;
    if (!packageName) return;
    
    const selectedPackage = this.packageOptions.find(p => p.name === packageName);
    if (!selectedPackage) return;
    
    // Check if this package already exists in the items
    let existingPackageIndex = -1;
    
    for (let i = 0; i < this.items.length; i++) {
      const itemGroup = this.items.at(i) as FormGroup;
      if (itemGroup.get('serviceDescription')?.value === selectedPackage.name) {
        existingPackageIndex = i;
        break;
      }
    }
    
    if (existingPackageIndex >= 0) {
      // Package already exists, update its quantity and recalculate totals
      const existingItem = this.items.at(existingPackageIndex) as FormGroup;
      const currentQuantity = +existingItem.get('quantity')?.value || 0;
      const newQuantity = currentQuantity + selectedPackage.quantity;
      
      // Update the existing item with the new quantity
      existingItem.patchValue({
        quantity: newQuantity,
        amount: newQuantity * selectedPackage.rate,
        totalAmount: newQuantity * selectedPackage.rate
      });
      
      // Recalculate the item total with the new quantity
      this.calculateItemTotal(existingPackageIndex);
    } else {
      // Add the package as a new item
      const newItem = this.fb.group({
        serviceDate: [this.formatDate(new Date()), [Validators.required]],
        serviceType: ['', [Validators.required]],
        serviceDescription: [selectedPackage.name, [Validators.required]],
        incentive: ['NO', []],
        quantity: [selectedPackage.quantity, [Validators.required, Validators.min(1)]],
        rate: [selectedPackage.rate, [Validators.required, Validators.min(0)]],
        amount: [selectedPackage.quantity * selectedPackage.rate, [Validators.required]],
        discount: [0, [Validators.min(0)]],
        tax: [0, [Validators.min(0)]],
        totalAmount: [selectedPackage.quantity * selectedPackage.rate, [Validators.required]]
      });
      
      this.items.push(newItem);
      
      // Set specific service type for Hydra Package
      if (packageName === 'Hydra Package') {
        newItem.patchValue({ serviceType: 'OPD' });
      }
    }
    
    this.calculateTotals();
  }
  
  /**
   * Handle service type selection
   */
  onServiceTypeChange(index: number): void {
    const item = this.items.at(index) as FormGroup;
    const serviceType = item.get('serviceType')?.value;
    
    // Apply default values based on selected service
    switch(serviceType) {
      case 'OPD':
        if (item.get('serviceDescription')?.value === '') {
          item.patchValue({
            serviceDescription: 'Regular OPD Visit',
            rate: 500
          });
        }
        break;
        
      case 'CONSULTATION':
        if (item.get('serviceDescription')?.value === '') {
          item.patchValue({
            serviceDescription: 'Specialist Consultation',
            rate: 800
          });
        }
        break;
        
      case 'MNRF':
        if (item.get('serviceDescription')?.value === '') {
          item.patchValue({
            serviceDescription: 'MNRF Treatment',
            rate: 1200
          });
        }
        break;

      case 'Hydra Package':
        item.patchValue({
          serviceDescription: 'Hydra Package',
          quantity: 3,
          rate: 4000
        });
        break;

      case 'Whole Body LHR Package':
        item.patchValue({
          serviceDescription: 'Whole Body LHR Package',
          quantity: 6,
          rate: 10000
        });
        break;

      case 'UnderArm LHR Package':
        item.patchValue({
          serviceDescription: 'UnderArm LHR Package',
          quantity: 6,
          rate: 3333.33
        });
        break;
    }
    
    this.calculateItemTotal(index);
  }
  

  
  /**
   * Opens the service creation modal
   */
  openServiceModal(): void {
    this.showServiceModal = true;
  }
  
  /**
   * Closes the service creation modal
   */
  closeServiceModal(): void {
    this.showServiceModal = false;
  }
  
  /**
   * Handle new service creation
   */
  saveNewService(service: any): void {
    // Add the new service to available services
    console.log('New service created:', service);
    
    // Add it as a new invoice item
    const newItem = this.createItem();
    newItem.patchValue({
      serviceType: service.group,
      serviceDescription: service.serviceName,
      rate: service.rate,
      quantity: 1
    });
    this.items.push(newItem);
    this.calculateItemTotal(this.items.length - 1);
    
    // Close the modal
    this.closeServiceModal();
  }
  

  
  /**
   * Clears the selected patient
   */
  clearSelectedPatient(): void {
    this.selectedPatient = null;
    this.searchField.setValue('');
    this.invoiceForm.patchValue({
      patientId: '',
      patientName: '',
      contactNumber: ''
    });
    console.log('Patient selection cleared');
  }
  
  /**
   * Calculate the balance due
   */
  getBalanceDue(): number {
    const grandTotal = this.invoiceForm.get('grandTotal')?.value || 0;
    const totalPaid = this.invoiceForm.get('totalPaid')?.value || 0;
    return grandTotal - totalPaid;
  }

  /**
   * Calculate tax based on taxation type and selected tax profile
   */
  calculateTax(): number {
    // Get the subtotal (after discount)
    const subtotal = this.items.controls
      .reduce((sum, item) => sum + (+item.get('amount')?.value || 0), 0);
    const discountAmount = this.getDiscountAmount();
    const afterDiscount = subtotal - discountAmount;
    
    // Get tax type
    const taxationType = this.invoiceForm.get('taxationType')?.value;
    
    // If Non-GST, return 0
    if (taxationType === 'Non-Gst') {
      return 0;
    }
    
    // Get the selected tax profile
    const taxProfileId = this.invoiceForm.get('taxProfileId')?.value;
    const taxProfile = this.taxProfiles.find(profile => profile.taxProfileId === taxProfileId);
    
    // If no tax profile is selected, return 0
    if (!taxProfile) {
      return 0;
    }
    
    // Calculate tax based on taxation type and tax profile
    let taxAmount = 0;
    const taxRate = taxProfile.totalRate / 100; // Convert percentage to decimal
    
    if (taxationType === 'Exclusive') {
      // Tax is applied on top of the amount (exclusive)
      taxAmount = afterDiscount * taxRate;
    } else if (taxationType === 'Inclusive') {
      // Tax is already included in the amount
      // Formula: Amount - (Amount / (1 + tax rate))
      taxAmount = afterDiscount - (afterDiscount / (1 + taxRate));
    }
    
    return Math.round(taxAmount * 100) / 100; // Round to 2 decimal places
  }
  
  /**
   * Calculate the total tax amount from all line items
   * Used in summary display
   */
  getConsolidatedTaxTotal(): number {
    return this.items.controls
      .reduce((sum, item) => {
        const itemAmount = +item.get('amount')?.value || 0;
        const itemDiscount = +item.get('discount')?.value || 0;
        const itemTaxRate = +item.get('tax')?.value || 0;
        
        const afterItemDiscount = itemAmount - (itemAmount * itemDiscount / 100);
        const itemTaxAmount = afterItemDiscount * (itemTaxRate / 100);
        
        return sum + itemTaxAmount;
      }, 0);
  }
  
  /**
   * Handle tax profile change for a line item
   */
  onTaxProfileChange(index: number): void {
    this.updateItemTotal(index);
    this.calculateTotals();
  }

  /**
   * Get tax breakdown for display in UI
   */
  getTaxBreakdown(): { name: string, amount: number }[] {
    // Get tax breakdown from the form (calculated in calculateTotals)
    const taxBreakdown = this.invoiceForm.get('taxBreakdown')?.value || [];
    return taxBreakdown;
  }
  
  /**
   * Calculate discount amount based on type (percent or fixed)
   */
  getDiscountAmount(): number {
    const subtotal = this.items.controls
      .reduce((sum, item) => sum + (+item.get('amount')?.value || 0), 0);
    const discountValue = +this.invoiceForm.get('overallDiscount')?.value || 0;
    const discountType = this.invoiceForm.get('overallDiscountType')?.value;
    
    if (discountType === 'PERCENT') {
      return (subtotal * discountValue / 100);
    } else {
      // FIXED discount
      return discountValue;
    }
  }

  // calculateTotals method is defined above

  formatDate(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  loadInvoice(id: string): void {
    this.loading = true;
    this.billingService.getInvoiceById(id).subscribe({
      next: (invoice: Invoice) => {
        console.log('Loaded invoice data:', JSON.stringify(invoice, null, 2));
        
        // Important - handle invoice data first before clearing items
        // This ensures we have the data we need for proper patching
        
        // Clear existing items
        while (this.items.length) {
          this.items.removeAt(0);
        }
        
        // Clear existing payments
        while (this.payments.length) {
          this.payments.removeAt(0);
        }
        
        // Add items from the invoice - this is critical for showing line items
        if (invoice.items && invoice.items.length > 0) {
          console.log('Processing invoice items:', invoice.items.length);
          invoice.items.forEach((item: InvoiceItem, index: number) => {
            console.log(`Processing item ${index}:`, item);
            // Determine service type from description if not available
            let serviceType = item.serviceType || '';
            if (!serviceType) {
              // Try to infer service type from description
              if (item.serviceDescription?.includes('OPD')) serviceType = 'OPD';
              else if (item.serviceDescription?.includes('Consult')) serviceType = 'CONSULTATION';
              else if (item.serviceDescription?.includes('MNRF')) serviceType = 'MNRF';
              else if (item.serviceDescription?.includes('Hydra')) serviceType = 'Hydra Package';
              else if (item.serviceDescription?.includes('Whole Body LHR')) serviceType = 'Whole Body LHR Package';
              else if (item.serviceDescription?.includes('UnderArm LHR')) serviceType = 'UnderArm LHR Package';
            }
            
            // Format date properly - handle both string and Date objects
            let serviceDate;
            try {
              // Try to parse as date if it's a string
              if (typeof item.serviceDate === 'string') {
                serviceDate = this.formatDate(new Date(item.serviceDate));
              } else if (item.serviceDate && Object.prototype.toString.call(item.serviceDate) === '[object Date]') {
                serviceDate = this.formatDate(item.serviceDate as Date);
              } else {
                serviceDate = this.formatDate(new Date());
              }
            } catch (e) {
              console.error('Error formatting service date:', e);
              serviceDate = this.formatDate(new Date());
            }
            
            // Ensure numeric values are properly handled
            const quantity = Number(item.quantity) || 1;
            const rate = Number(item.rate) || 0;
            const amount = Number(item.amount) || (quantity * rate);
            const discount = Number(item.discount) || 0;
            const tax = Number(item.tax) || 0;
            const totalAmount = Number(item.totalAmount) || amount;
            
            console.log(`Adding item ${index} with values:`, {
              serviceDate,
              serviceType,
              serviceDescription: item.serviceDescription,
              quantity,
              rate,
              amount,
              totalAmount
            });
            
            // Create form group for the item
            this.items.push(this.fb.group({
              serviceDate: [serviceDate, [Validators.required]],
              serviceType: [serviceType, [Validators.required]],
              serviceDescription: [item.serviceDescription, [Validators.required]],
              incentive: [item.incentive || 'NO', []],
              quantity: [quantity, [Validators.required, Validators.min(1)]],
              rate: [rate, [Validators.required, Validators.min(0)]],
              amount: [amount, [Validators.required]],
              discount: [discount, [Validators.min(0)]],
              tax: [tax, [Validators.min(0)]],
              totalAmount: [totalAmount, [Validators.required]]
            }));
          });
          
          // Log form array after adding items
          console.log('Items form array after population:', this.items.value);
        } else {
          console.warn('No invoice items found, adding empty item');
          // Add at least one empty item if none exist
          this.items.push(this.createItem());
        }
        
        // Store payment information internally but don't show in UI
        // This ensures the data is preserved even though we don't show the payment section
        if (invoice.payments && invoice.payments.length > 0) {
          // Calculate total paid amount directly
          const totalPaid = invoice.payments.reduce((sum: number, payment: any) => sum + (+payment.amount || 0), 0);
          
          // Update the totalPaid form control
          this.invoiceForm.patchValue({
            totalPaid: totalPaid.toFixed(2),
            paidAmount: totalPaid.toFixed(2)
          });
          
          // Store payments data in the form array for backend submission
          invoice.payments.forEach((payment: any) => {
            this.payments.push(this.fb.group({
              paymentDate: [this.formatDate(new Date(payment.date || payment.paymentDate)), [Validators.required]],
              amount: [payment.amount, [Validators.required, Validators.min(0)]],
              paymentMethod: [payment.paymentMethod || payment.modeOfPayment, [Validators.required]],
              referenceNumber: [payment.referenceNumber || payment.reference || ''],
              notes: [payment.notes || '']
            }));
          });
        }
        
        // Fetch full patient data for display
        this.patientService.getPatientById(invoice.patientId).subscribe({
          next: (patient) => {
            this.selectedPatient = patient;
            console.log('Patient data loaded:', patient);
          },
          error: (error: any) => {
            console.error('Error fetching patient details:', error);
            // Fallback to basic patient info if detailed fetch fails
            this.selectedPatient = {
              id: invoice.patientId,
              name: invoice.patientName
            };
          }
        });
        
        // Format the invoice date properly
        let invoiceDate: string;
        try {
          invoiceDate = this.formatDate(new Date(invoice.date));
          console.log('Formatted invoice date:', invoiceDate);
        } catch (e) {
          console.error('Error formatting invoice date:', e);
          invoiceDate = this.formatDate(new Date());
        }

        console.log('Updating invoice form with details', {
          date: invoiceDate,
          amount: invoice.amount,
          taxationType: invoice.taxationType,
          subtotal: invoice.subtotal,
          category: invoice.category
        });
        
        // Delay the form update slightly to ensure Angular has time to process form arrays
        setTimeout(() => {
          // Update the form with all invoice details
          this.invoiceForm.patchValue({
            patientId: invoice.patientId,
            patientName: invoice.patientName,
            date: invoiceDate,
            amount: Number(invoice.amount) || 0,
            createdBy: invoice.createdBy || this.currentUser,
            modeOfPayment: invoice.modeOfPayment || 'CASH',
            status: invoice.status || 'UNPAID',
            paidAmount: Number(invoice.paidAmount) || 0,
            balanceAmount: Number(invoice.balanceAmount) || Number(invoice.amount) || 0,
            totalPaid: Number(invoice.paidAmount) || 0, // Set totalPaid based on paidAmount
            taxationType: invoice.taxationType || 'Non-Gst',
            category: invoice.category || 'SERVICES',
            subtotal: Number(invoice.subtotal) || Number(invoice.amount) || 0,
            overallDiscount: Number(invoice.overallDiscount) || 0,
            overallDiscountType: invoice.overallDiscountType || 'PERCENT',
            notes: invoice.notes || '',
            package: ''
          });
          
          // Force recalculation of all totals
          this.calculateTotals();
          
          console.log('Form updated with values:', this.invoiceForm.value);
        }, 100);
        
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading invoice', error);
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    console.log('Form submission started');
    this.submitted = true;
    
    // Force form validation
    Object.keys(this.invoiceForm.controls).forEach(key => {
      const control = this.invoiceForm.get(key);
      control?.markAsDirty();
      control?.markAsTouched();
      control?.updateValueAndValidity();
    });
    
    if (this.invoiceForm.invalid) {
      console.error('Form is invalid:', this.getFormValidationErrors());
      
      // Try to fix the patientId field if that's the only issue
      if (this.invoiceForm.get('patientId')?.errors && this.patientSearchTerm && !this.patientResults.length) {
        // Use a test patient ID if the form is invalid only because of patientId
        this.invoiceForm.patchValue({
          patientId: 'TEST001',
          patientName: this.patientSearchTerm
        });
        console.log('Applied fallback patient ID for testing');
        
        if (this.invoiceForm.valid) {
          console.log('Form is now valid, proceeding with submission');
        } else {
          console.error('Form still invalid after patientId fix attempt');
          alert('Please complete all required fields before submitting');
          return;
        }
      } else {
        alert('Please complete all required fields before submitting');
        return;
      }
    }
    
    console.log('Form is valid, proceeding with submission');
    const formValue = this.invoiceForm.value;
    console.log('Form values:', formValue);

    this.loading = true;
    
    // For new invoice, generate id
    if (!this.isEditMode) {
      const now = new Date();
      const year = now.getFullYear().toString().substr(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const randomId = Math.floor(Math.random() * 9000 + 1000); // 4-digit random number
      const invoiceId = `INV-${year}${month}${day}${randomId}`;
      console.log('Generated invoice ID:', invoiceId);
      
      // Map form value to Invoice object with ALL fields
      const invoice: any = {
        id: invoiceId,
        invoiceId: invoiceId,
        patientId: formValue.patientId,
        patientName: formValue.patientName,
        date: this.formatDate(new Date(formValue.date)),
        issueDate: this.formatDate(new Date(formValue.date)),
        dueDate: this.formatDate(new Date(formValue.date)),
        createdBy: formValue.createdBy || this.currentUser,
        status: formValue.status || 'UNPAID',
        modeOfPayment: formValue.modeOfPayment || 'CASH',
        amount: Number(formValue.amount) || 0,
        subtotal: Number(formValue.subtotal) || 0,
        tax: Number(formValue.tax) || 0,
        // Use commonTaxationType instead of taxationType for backend compatibility
        commonTaxationType: formValue.commonTaxationType || 'Non-Gst',
        category: formValue.category || 'SERVICES',
        discount: Number(formValue.overallDiscount) || 0,
        overallDiscount: Number(formValue.overallDiscount) || 0,
        overallDiscountType: formValue.overallDiscountType || 'PERCENT',
        paidAmount: Number(formValue.paidAmount) || 0,
        balanceAmount: Number(formValue.balanceAmount) || Number(formValue.amount) || 0,
        grandTotal: Number(formValue.grandTotal) || Number(formValue.amount) || 0,
        totalAmount: Number(formValue.amount) || 0,
        notes: formValue.notes || '',
        // Include the calculated tax breakdown and total tax
        taxBreakdown: formValue.taxBreakdown || [],
        totalTax: Number(formValue.totalTax) || 0,
        // Include line items in the main invoice object
        items: formValue.items || []
      };
      
      // Call API to create invoice
      console.log('Calling createInvoice API with data:', invoice);
      this.billingService.createInvoice(invoice)
        .pipe(finalize(() => {
          console.log('API call finalized');
          this.loading = false;
        }))
        .subscribe({
          next: (response: any) => {
            console.log('Invoice created successfully:', response);
            alert('Invoice created successfully');
            this.router.navigate(['/billing/invoices']);
          },
          error: (error: any) => {
            console.error('Error creating invoice', error);
            // Check for specific error types to give better feedback
            if (error.status === 404) {
              alert('API endpoint not found. Please check server configuration.');
            } else if (error.status === 400) {
              alert('Invalid invoice data: ' + (error.error?.message || error.message || 'Data validation error'));
            } else {
              alert('Failed to create invoice: ' + (error.message || 'Unknown error'));
            }
          }
        });
    } else {
      // Update existing invoice with ALL details
      const invoice: any = {
        id: this.invoiceId,
        invoiceId: this.invoiceId,
        patientId: formValue.patientId,
        patientName: formValue.patientName,
        date: this.formatDate(new Date(formValue.date)),
        issueDate: this.formatDate(new Date(formValue.date)),
        dueDate: this.formatDate(new Date(formValue.date)),
        createdBy: formValue.createdBy || this.currentUser,
        status: formValue.status || 'UNPAID',
        modeOfPayment: formValue.modeOfPayment || 'CASH',
        amount: Number(formValue.amount) || 0,
        subtotal: Number(formValue.subtotal) || 0,
        tax: Number(formValue.tax) || 0,
        taxationType: formValue.taxationType || 'Non-Gst',
        category: formValue.category || 'SERVICES',
        discount: Number(formValue.overallDiscount) || 0,
        overallDiscount: Number(formValue.overallDiscount) || 0,
        overallDiscountType: formValue.overallDiscountType || 'PERCENT',
        paidAmount: Number(formValue.paidAmount) || 0,
        balanceAmount: Number(formValue.balanceAmount) || Number(formValue.amount) || 0,
        grandTotal: Number(formValue.grandTotal) || Number(formValue.amount) || 0,
        totalAmount: Number(formValue.amount) || 0,
        notes: formValue.notes || ''
      };
      
      this.billingService.updateInvoice(this.invoiceId!, { ...invoice, items: formValue.items })
        .pipe(finalize(() => this.loading = false))
        .subscribe({
          next: (response: any) => {
            console.log('Invoice updated successfully:', response);
            alert('Invoice updated successfully');
            this.router.navigate(['/billing/invoices']);
          },
          error: (error: any) => {
            console.error('Error updating invoice', error);
            alert('Failed to update invoice: ' + (error.message || 'Unknown error'));
          }
        });
    }
  }

  searchPatients(term: string): void {
    // Use the provided search term and convert to lowercase for case-insensitive matching
    this.patientSearchTerm = term.trim().toLowerCase();
    
    // Allow search by ID (numbers only) even if shorter than 3 characters
    // or by name if length is greater than 2 characters
    const isIdSearch = /^\d+$/.test(this.patientSearchTerm);
    
    if (isIdSearch || this.patientSearchTerm.length > 2) {
      this.loading = true;
      this.showPatientSearch = true;
      
      console.log(`Searching for patients with ${isIdSearch ? 'ID' : 'term'}:`, this.patientSearchTerm);
      
      // First get all patients to perform client-side filtering
      this.patientService.getAllPatients()
        .pipe(
          finalize(() => {
            this.loading = false;
          })
        )
        .subscribe({
          next: (patients: Patient[]) => {
            console.log(`Got ${patients?.length || 0} total patients, filtering for term: "${this.patientSearchTerm}"`);
            
            if (patients && patients.length > 0) {
              // Client-side filtering logic
              const filteredPatients = patients.filter(patient => {
                if (!this.patientSearchTerm) return false;
                
                // Search in patientId, firstName, lastName, and mobileNumber
                const patientIdMatch = patient.patientId?.toLowerCase().includes(this.patientSearchTerm) || false;
                const firstNameMatch = patient.firstName?.toLowerCase().includes(this.patientSearchTerm) || false;
                const lastNameMatch = patient.lastName?.toLowerCase().includes(this.patientSearchTerm) || false;
                const mobileMatch = patient.mobileNumber?.toLowerCase().includes(this.patientSearchTerm) || false;
                const fullNameMatch = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase().includes(this.patientSearchTerm) || false;
                
                const isMatch = patientIdMatch || firstNameMatch || lastNameMatch || mobileMatch || fullNameMatch;
                if (isMatch) {
                  console.log(`Match found: ${patient.firstName} ${patient.lastName} - matches term "${this.patientSearchTerm}"`);
                }
                return isMatch;
              });
              
              console.log(`Filtered down to ${filteredPatients.length} patients matching "${this.patientSearchTerm}"`);
              
              // Map filtered patients to the expected format
              this.patientResults = filteredPatients.map(patient => ({
                id: patient.id || '', // Ensure ID is never undefined
                name: `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
                contactNumber: patient.mobileNumber || ''
              }));
            } else {
              this.patientResults = [];
            }
            console.log('Final patient results:', this.patientResults);
          },
          error: (error: any) => {
            console.error('Error searching patients:', error);
            this.patientResults = [];
            
            // Add fallback mock data for testing if API fails
            if (error.status === 404) {
              console.log('Using fallback mock patient data for testing');
              this.patientResults = [
                { id: 'TEST001', name: 'Test Patient', contactNumber: '+123456789' },
                { id: 'TEST002', name: 'Another Test', contactNumber: '+987654321' }
              ];
            }
          }
        });
    } else {
      this.showPatientSearch = false;
      this.patientResults = [];
    }
  }
  
  /**
   * Select a patient from search results and populate form fields
   */
  selectPatient(patient: any): void {
    console.log('Selected patient:', patient);
    this.selectedPatient = patient;
    this.showPatientSearch = false;
    this.searchField.setValue(patient.name);
    
    // Update the invoice form with patient details
    this.invoiceForm.patchValue({
      patientId: patient.id,
      patientName: patient.name,
      contactNumber: patient.contactNumber || ''
    });
    
    // Clear search field and results after selection
    setTimeout(() => {
      // Keep the search field showing the patient name
      // But clear the dropdown results
      this.patientResults = [];
    }, 300);
    
    console.log('Form updated with patient data');
  }
  
  /**
   * Hide patient search dropdown after a small delay
   * Used for the blur event on the search input
   */
  hidePatientSearch(): void {
    setTimeout(() => {
      this.showPatientSearch = false;
    }, 200);
  }
  
  // clearSelectedPatient method is already defined above

  cancelForm(): void {
    this.router.navigate(['/billing/invoices']);
  }
  
  // Helper method to identify form validation errors
  getFormValidationErrors(): any {
    const errors: any = {};
    Object.keys(this.invoiceForm.controls).forEach(key => {
      const control = this.invoiceForm.get(key);
      if (control && control.errors) {
        errors[key] = control.errors;
      }
    });
    
    // Check items array for errors
    const itemsArray = this.invoiceForm.get('items') as FormArray;
    if (itemsArray) {
      const itemErrors: any[] = [];
      for (let i = 0; i < itemsArray.controls.length; i++) {
        const itemGroup = itemsArray.at(i) as FormGroup;
        const itemError: any = {};
        Object.keys(itemGroup.controls).forEach(key => {
          const control = itemGroup.get(key);
          if (control && control.errors) {
            itemError[key] = control.errors;
          }
        });
        if (Object.keys(itemError).length > 0) {
          itemErrors.push({ index: i, errors: itemError });
        }
      }
      if (itemErrors.length > 0) {
        errors['items'] = itemErrors;
      }
    }
    
    return errors;
  }
  
  addPayment(): void {
    // Get current invoice amount and paid amount
    const currentAmount = parseFloat(this.invoiceForm.get('amount')?.value || '0');
    const currentPaidAmount = parseFloat(this.invoiceForm.get('paidAmount')?.value || '0');
    const currentBalance = parseFloat(this.invoiceForm.get('balanceAmount')?.value || '0');
    
    // Default new payment to the remaining balance
    const paymentAmount = currentBalance > 0 ? currentBalance : 0;
    
    // Create a new payment form group
    const newPayment = this.createPayment();
    
    // Pre-populate with remaining balance
    newPayment.patchValue({
      amount: paymentAmount.toFixed(2)
    });
    
    // Add to payments array
    this.payments.push(newPayment);
    
    // Update the total paid amount and balance
    this.updatePaymentTotals();
  }
  
  removePayment(index: number): void {
    this.payments.removeAt(index);
    this.updatePaymentTotals();
  }
  
  updatePaymentTotals(): void {
    const totalAmount = parseFloat(this.invoiceForm.get('amount')?.value || '0');
    
    // Calculate total payment amount
    const paidAmount = this.payments.controls
      .reduce((sum, payment) => sum + parseFloat(payment.get('amount')?.value || '0'), 0);
    
    // Calculate balance
    const balanceAmount = Math.max(0, totalAmount - paidAmount).toFixed(2);
    
    // Determine status
    let status = 'UNPAID';
    if (paidAmount > 0) {
      status = parseFloat(balanceAmount) === 0 ? 'PAID' : 'PARTIAL';
    }
    
    // Update form
    this.invoiceForm.patchValue({
      paidAmount: paidAmount.toFixed(2),
      totalPaid: paidAmount.toFixed(2), // Update the totalPaid control
      balanceAmount: balanceAmount,
      status: status
    });
  }
}
