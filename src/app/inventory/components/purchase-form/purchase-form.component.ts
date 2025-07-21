import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { Supplier, Medicine, StockStatus, CreatePurchaseRequest, PurchaseItemDto, TaxProfile, TaxComponent, Purchase, TaxComponentItem } from '../../models/inventory.models';
import { Router, ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-purchase-form',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './purchase-form.component.html',
  styleUrls: ['./purchase-form.component.scss', './purchase-table.css', './view-mode.css', './print-styles.css']
})
export class PurchaseFormComponent implements OnInit {  
  // GST dropdown control
  showGstDropdown = false;
  purchaseForm!: FormGroup;
  // FormArray reference will be accessed through getter
  suppliers: Supplier[] = [];
  medicines: Medicine[] = [];
  filteredSuppliers: Supplier[] = [];
  filteredMedicines: Medicine[] = [];
  filteredMedicinesForRow: { [key: number]: Medicine[] } = {};
  activeMedicineRow: number | null = null;
  searchSupplierTerm: string = '';
  searching = false;
  selectedSupplier: Supplier | null = null;
  loadingSuppliers = false;
  loadingMedicines = false;
  loadingTaxProfiles = false;
  submitting = false;
  taxProfiles: TaxProfile[] = [];

  taxTypes = ['EXCLUSIVE', 'INCLUSIVE', 'NON_GST'];
  
  // Totals
  grossTotal: number = 0;
  discount: number = 0;
  netTaxableAmt: number = 0;
  cgstAmount: number = 0;
  sgstAmount: number = 0;
  netTotal: number = 0;
  totalItems: number = 0;
  overallDiscount: number = 0;
  overallDiscountType: string = '%';
  
  // Mode properties
  isEditMode: boolean = false;
  isViewMode: boolean = false;
  formSubmitted: boolean = false;
  defaultTaxProfileId: string | null = null;
  purchaseId: string | null = null;
  currentPurchase: Purchase | null = null;
  loading: boolean = false;
  
  /**
   * Disables all form controls when in view mode
   */
  disableFormForViewMode(): void {
    if (!this.isViewMode) return;
    
    // Disable main form controls
    this.purchaseForm.disable();
    
    // Make sure any dynamically added controls are also disabled
    this.itemsFormArray.controls.forEach((control: AbstractControl) => {
      if (control instanceof FormGroup) {
        Object.keys(control.controls).forEach(key => {
          control.get(key)?.disable();
        });
      }
    });
  }
  
  /**
   * Print the current purchase details
   */
  printPurchase(): void {
    if (!this.currentPurchase) {
      console.error('No purchase data available for printing');
      return;
    }
    
    // Store the current body content
    const originalContent = document.body.innerHTML;
    
    try {
      // Get supplier information
      const supplier = this.currentPurchase.supplier || { name: 'Not specified', contactNumber: '', address: '' };
      
      // Format the date properly
      const invoiceDate = this.purchaseForm.get('invoiceDate')?.value ? 
        new Date(this.purchaseForm.get('invoiceDate')?.value).toLocaleDateString() : 
        new Date().toLocaleDateString();
      
      // Create the header for the print version
      const headerHtml = `
        <div class="print-header">
          <h2>Purchase Invoice</h2>
          <div class="invoice-details">
            <div class="row">
              <div class="col-6">
                <p><strong>Invoice #:</strong> ${this.purchaseForm.get('referenceId')?.value || this.purchaseId}</p>
                <p><strong>Date:</strong> ${invoiceDate}</p>
                <p><strong>GST Type:</strong> ${this.purchaseForm.get('gst')?.value || 'Not specified'}</p>
              </div>
              <div class="col-6">
                <p><strong>Supplier:</strong> ${supplier.name}</p>
                <p><strong>Contact:</strong> ${supplier.contactNumber || 'Not available'}</p>
                <p><strong>Address:</strong> ${supplier.address || 'Not available'}</p>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Get the current form content
      const printContent = document.querySelector('.purchase-form-wrapper');
      if (printContent) {
        // Add a class for print styling
        document.body.className = 'printing';
        
        // Set only the form content for printing
        document.body.innerHTML = `
          ${headerHtml}
          ${printContent.innerHTML}
          <div class="print-footer">
            <p><strong>Payment Mode:</strong> ${this.purchaseForm.get('paymentMode')?.value || 'Not specified'}</p>
            <p><strong>Amount Paid:</strong> ₹${this.purchaseForm.get('amountPaid')?.value || '0.00'}</p>
            <p class="signature">Authorized Signature: _______________________</p>
          </div>
        `;
        
        // Apply additional print-specific styling
        const style = document.createElement('style');
        style.textContent = `
          @media print {
            body { font-family: Arial, sans-serif; }
            .print-header { text-align: center; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 4px; font-size: 12px; }
            .print-footer { margin-top: 30px; }
            .signature { margin-top: 50px; }
          }
        `;
        document.head.appendChild(style);
        
        // Print the document
        setTimeout(() => {
          window.print();
          
          // Restore original content
          document.body.innerHTML = originalContent;
          document.body.className = '';
          
          // Reinitialize the component to restore Angular bindings
          this.ngOnInit();
        }, 300); // Short delay to ensure styles are applied
      } else {
        console.error('Could not find printable content');
      }
    } catch (error) {
      console.error('Error during print preparation:', error);
      // Restore original content in case of error
      document.body.innerHTML = originalContent;
    }
  }
  
  /**
   * Scroll handler to close medicine dropdown when scrolling
   */
  private handleScroll = (): void => {
    // Close dropdown when scrolling
    if (this.activeMedicineRow !== -1) {
      this.clearActiveMedicineRow();
    }
  }

  constructor(
    private fb: FormBuilder,
    private inventoryService: InventoryService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Generate default reference ID with format INV-ABC-101
    const defaultReferenceId = this.generateDefaultReferenceId();
    
    this.initForm(defaultReferenceId);
  }

  ngOnInit(): void {
    // Determine mode (view/edit) from route
    this.isViewMode = this.route.snapshot.url.some(segment => segment.path === 'view');
    this.isEditMode = !this.isViewMode && this.route.snapshot.paramMap.has('id');
    
    console.log('Form mode:', this.isViewMode ? 'VIEW' : this.isEditMode ? 'EDIT' : 'CREATE');
    
    this.loadSuppliers();
    this.loadMedicines();
    this.loadTaxProfiles();
    
    // Set up form control value change logging for debugging
    this.itemsFormArray.valueChanges.subscribe(items => {
      console.log('Items form values updated:', items);
    });
    
    // Log suppliers once loaded to help debug
    setTimeout(() => {
      console.log('Suppliers loaded:', this.suppliers?.length || 0);
      console.log('Medicines loaded:', this.medicines?.length || 0);
      console.log('Tax profiles loaded:', this.taxProfiles?.length || 0);
    }, 2000);
    
    // Check if we're in view or edit mode by examining the route
    this.route.url.pipe(
      map(segments => {
        // Extract mode from URL segments
        const mode = segments.find(segment => 
          segment.path === 'view' || segment.path === 'edit'
        )?.path || 'new';
        return { mode, id: this.route.snapshot.paramMap.get('id') };
      }),
      switchMap(routeInfo => {
        if (routeInfo.id) {
          this.purchaseId = routeInfo.id;
          
          // Set the appropriate mode
          this.isViewMode = routeInfo.mode === 'view';
          this.isEditMode = routeInfo.mode === 'edit';
          
          console.log(`Loading purchase ${routeInfo.id} in ${this.isViewMode ? 'view' : 'edit'} mode`);
          
          this.loading = true;
          return this.inventoryService.getPurchaseById(routeInfo.id);
        }
        return of(null);
      })
    ).subscribe({
      next: (purchase: Purchase | null) => {
        if (purchase) {
          this.currentPurchase = purchase;
          this.populateFormWithPurchase(purchase);
          
          // If in view mode, disable all form controls
          if (this.isViewMode) {
            setTimeout(() => this.disableFormForViewMode(), 100);
          }
        } else if (!this.itemsFormArray.length) {
          // Add at least one empty row for new purchases
          this.addPurchaseItem();
        }
        
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Error loading purchase for editing/viewing', err);
        this.loading = false;
        
        // Add at least one empty row if none exist
        if (!this.itemsFormArray.length) {
          this.addPurchaseItem();
        }
      }
    });
    
    // Add scroll event listener to close dropdown when scrolling
    window.addEventListener('scroll', this.handleScroll, true);
  }

  ngOnDestroy(): void {
    // Remove scroll event listener
    window.removeEventListener('scroll', this.handleScroll, true);
  }
  
  /**
   * Populates the form with data from an existing purchase for editing
   */
  /**
   * Populates the form with data from an existing purchase for editing or viewing
   * @param purchase The purchase object from the API
   */
  populateFormWithPurchase(purchase: Purchase): void {
    if (!purchase) return;

    console.log('Populating form with purchase:', purchase);
    console.log('Raw purchase data:', JSON.stringify(purchase, null, 2));
    
    // Make sure tax profiles are loaded before populating the form
    if (!this.taxProfiles || this.taxProfiles.length === 0) {
      console.log('Loading tax profiles before populating form...');
      this.loadTaxProfiles();
    }
    

    // Find and set the selected supplier
    this.selectedSupplier = this.suppliers?.find(s => s.id === purchase.supplierId) || null;
    if (this.selectedSupplier) {
      console.log('Selected supplier:', this.selectedSupplier);
    } else {
      console.warn('Supplier not found for ID:', purchase.supplierId);
    }
    
    // Reset the form
    while (this.itemsFormArray.length > 0) {
      this.itemsFormArray.removeAt(0);
    }
    
    // Add purchase items
    const items = purchase.items || purchase.purchaseItems || [];
    if (items.length === 0) {
      // Add at least one empty item if there are none
      this.addPurchaseItem();
      return;
    }
    
    // Add each item to the form
    items.forEach((item: any) => {
      // Find matching tax profile based on rate
      let taxProfileId = null;
      if (item.taxRateApplied || item.taxProfileId) {
        // Try to find by ID first, then by rate
        if (item.taxProfileId) {
          const profileById = this.taxProfiles.find(p => p.id === item.taxProfileId);
          if (profileById) {
            taxProfileId = profileById.id;
          }
        }
        
        // If not found by ID, try by rate
        if (!taxProfileId && item.taxRateApplied) {
          const matchingProfile = this.taxProfiles.find(
            p => Math.abs(p.totalRate - item.taxRateApplied) < 0.01
          );
          taxProfileId = matchingProfile?.id || null;
        }
      }
      
      // Find the medicine details for display name, generic, etc.
      const medicineDetails = this.medicines.find(m => m.id === item.medicineId);
      
      // Extract and map values exactly as they come from the API
      // These field names match what's in the API response JSON
      
      // Log the full item to debug
      console.log('Item from API:', JSON.stringify(item));
      
      // Pack quantities directly from API
      const packQuantity = Number(item.packQuantity || 0);
      const freePackQuantity = Number(item.freePackQuantity || 0);
      const itemsPerPack = Number(item.itemsPerPack || 1);
      
      // Total quantity from API - use totalReceivedQuantity field
      const totalQuantity = Number(item.totalReceivedQuantity || item.quantity || 0);
      
      // Cost values directly from API
      const purchaseCostPerPack = Number(item.purchaseCostPerPack || 0);
      
      // Discount values from API
      const discountPercentage = Number(item.discountPercentage || 0);
      const discountAmount = Number(item.lineItemDiscountAmount || 0);
      
      // Tax values from API
      const taxableAmount = Number(item.lineItemTaxableAmount || 0);
      const taxAmount = Number(item.lineItemTaxAmount || 0);
      const totalAmount = Number(item.lineItemTotalAmount || 0);
      
      // MRP directly from API
      const mrpPerItem = Number(item.mrpPerItem || 0);
      
      // For legacy field mappings
      const pack = packQuantity;
      const freepack = freePackQuantity;
      
      console.log(`Item ${item.medicineId} - Pack: ${packQuantity}, FreePack: ${freePackQuantity}, ItemsPerPack: ${itemsPerPack}, Total: ${totalQuantity}, Cost: ${purchaseCostPerPack}, Tax: ${taxAmount}`);
      
      
      // Get tax components (CGST, SGST) from the API
      const taxComponents = item.taxComponents || [];
      const cgstComponent = taxComponents.find((c: any) => c.componentName?.toUpperCase().includes('CGST'));
      const sgstComponent = taxComponents.find((c: any) => c.componentName?.toUpperCase().includes('SGST'));
      
      // Extract tax component amounts
      const cgstAmount = Number(cgstComponent?.amount || item.cgstAmount || 0);
      const sgstAmount = Number(sgstComponent?.amount || item.sgstAmount || 0);
      
      // Print detailed logs for debugging the mapping
      console.log(`===== ITEM ${item.medicineId} (${medicineDetails?.name || 'Unknown'}) MAPPING DETAILS =====`);
      console.log(`Pack Quantity: API=${item.packQuantity}, Using=${packQuantity}`);
      console.log(`Free Pack Quantity: API=${item.freePackQuantity}, Using=${freePackQuantity}`);
      console.log(`Items Per Pack: API=${item.itemsPerPack}, Using=${itemsPerPack}`);
      console.log(`Total Quantity: API=${item.totalReceivedQuantity}, Calculated=${packQuantity * itemsPerPack + freePackQuantity * itemsPerPack}, Using=${totalQuantity}`);
      console.log(`Purchase Cost: API=${item.purchaseCostPerPack}, Using=${purchaseCostPerPack}`);
      console.log(`MRP: API=${item.mrpPerItem}, Using=${mrpPerItem}`);
      console.log(`Discount %: API=${item.discountPercentage}, Using=${discountPercentage}`);
      console.log(`Discount Amount: API=${item.lineItemDiscountAmount}, Using=${discountAmount}`);
      console.log(`Tax Profile: ID=${item.taxProfileId}, Rate=${item.taxRateApplied}, Using Profile ID=${taxProfileId}`);
      console.log(`Taxable Amount: API=${item.lineItemTaxableAmount}, Using=${taxableAmount}`);
      console.log(`Tax Amount: API=${item.lineItemTaxAmount}, Using=${taxAmount}`);
      console.log(`CGST: API Component=${cgstComponent?.amount}, Direct=${item.cgstAmount}, Using=${cgstAmount}`);
      console.log(`SGST: API Component=${sgstComponent?.amount}, Direct=${item.sgstAmount}, Using=${sgstAmount}`);
      console.log(`Total Amount: API=${item.lineItemTotalAmount}, Using=${totalAmount}`);
      console.log(`========================================================`);
      
      // Create form group for this item with both API and legacy field mappings
      const itemGroup = this.fb.group({
        // API fields
        medicineId: [item.medicineId || '', Validators.required],
        medicine: [medicineDetails],
        batchNo: [item.batchNo || '', Validators.required],
        expiryDate: [this.formatDate(item.expiryDate) || '', Validators.required],
        
        // Pack quantities and cost - use exact API field names
        packQuantity: [packQuantity, [Validators.required, Validators.min(0)]],
        freePackQuantity: [freePackQuantity, Validators.min(0)],
        itemsPerPack: [itemsPerPack, [Validators.required, Validators.min(1)]],
        quantity: [totalQuantity, [Validators.required, Validators.min(1)]],
        purchaseCostPerPack: [purchaseCostPerPack, [Validators.required, Validators.min(0)]],
        
        // MRP - use exact API field name
        mrpPerItem: [mrpPerItem, [Validators.required, Validators.min(0.01)]],
        
        // Discount fields - use exact API field names
        discountPercentage: [discountPercentage, Validators.min(0)],
        lineItemDiscountAmount: [discountAmount, Validators.min(0)],
        
        // Legacy field mapping for backward compatibility
        pack: [packQuantity, [Validators.required, Validators.min(0)]],
        freepack: [freePackQuantity, Validators.min(0)],
        cost: [purchaseCostPerPack, [Validators.required, Validators.min(0)]],
        purchaseCost: [purchaseCostPerPack, [Validators.required, Validators.min(0)]],
        mrp: [mrpPerItem, [Validators.required, Validators.min(0.01)]],
        discountAmount: [discountAmount, Validators.min(0)],
        
        // Tax and total fields from API - use exact API field names
        taxProfileId: [taxProfileId || this.defaultTaxProfileId],
        taxRateApplied: [item.taxRateApplied || 0],
        lineItemTaxAmount: [taxAmount, Validators.min(0)],
        lineItemTaxableAmount: [taxableAmount, Validators.min(0)],
        lineItemTotalAmount: [totalAmount, Validators.min(0)],
        
        // Tax component amounts
        cgstAmount: [cgstAmount, Validators.min(0)],
        sgstAmount: [sgstAmount, Validators.min(0)],
        
        // Also map to the old field names for compatibility
        taxAmount: [taxAmount, Validators.min(0)],
        taxableAmount: [taxableAmount, Validators.min(0)],
        totalAmount: [totalAmount, Validators.min(0)],
        igstAmount: [item.igstAmount || 0]
      });
      
      // Add the item group to the form array
      this.itemsFormArray.push(itemGroup);
      const index = this.itemsFormArray.length - 1;
      
      // Add event listeners to the form controls for this item
      this.addFormControlListeners(index);
      
      // Initialize the filtered medicines array for this item
      this.filteredMedicinesForRow[index] = this.medicines.slice();
      
      // Calculate totals for this item based on the values
      this.calculateItemTotal(index);
    });
    
    // Calculate totals
    setTimeout(() => this.calculateTotals(), 100);
  }
  
  /**
   * Format date string or timestamp to YYYY-MM-DD format for form inputs
   */
  private formatDate(date: any): string {
    if (!date) return '';
    
    try {
      // Handle Firestore timestamps with seconds and nanoseconds
      if (typeof date === 'object' && date.seconds) {
        const timestamp = new Date(date.seconds * 1000);
        return timestamp.toISOString().split('T')[0];
      }
      
      // Handle string date formats
      if (typeof date === 'string') {
        // Check if the date is already in yyyy-MM-dd format
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return date;
        }
        
        // Otherwise parse it
        return new Date(date).toISOString().split('T')[0];
      }
      
      // Handle Date objects
      if (date instanceof Date) {
        return date.toISOString().split('T')[0];
      }
    } catch (err) {
      console.error('Error formatting date:', err);
    }
    
    return '';
  }
  
  /**
   * Calculate tax amount for a specific component based on item cost and tax rate
   */
  private calculateTaxComponentAmount(item: any, rate: number): number {
    const cost = parseFloat(item.cost || '0');
    const paidQuantity = parseFloat(item.paidQuantity || '0');
    const discountPercentage = parseFloat(item.discountPercentage || '0');
    
    const totalCost = cost * paidQuantity;
    const discountAmount = (totalCost * discountPercentage) / 100;
    const netAmount = totalCost - discountAmount;
    
    // Calculate tax based on GST type (exclusive vs inclusive)
    const gstType = this.purchaseForm.get('gst')?.value;
    
    if (gstType === 'INCLUSIVE') {
      // For inclusive, tax is already included in the price
      const taxRate = rate / 100;
      return this.roundToTwo(netAmount - (netAmount / (1 + taxRate)));
    } else {
      // For exclusive, tax is calculated on top of the price
      return this.roundToTwo((netAmount * rate) / 100);
    }
  }
  
  /**
   * Synchronizes legacy field names with API field names to ensure proper data binding
   * @param itemGroup The form group to sync fields for
   */
  private syncLegacyFields(itemGroup: FormGroup): void {
    // Map legacy field names to new API field names
    const fieldMappings = [
      // Removed pack->itemsPerPack mapping to keep itemsPerPack manual
      { legacy: 'quantity', api: 'packQuantity' },
      { legacy: 'freepack', api: 'freePackQuantity' },
      { legacy: 'purchaseCost', api: 'purchaseCostPerPack' },
      { legacy: 'discount', api: 'discountPercentage' },
      { legacy: 'mrp', api: 'mrpPerItem' }
    ];
    
    // Add bidirectional listeners for each field mapping
    fieldMappings.forEach(mapping => {
      // Skip if the control doesn't exist
      const legacyControl = itemGroup.get(mapping.legacy);
      const apiControl = itemGroup.get(mapping.api);
      
      if (!legacyControl || !apiControl) {
        return;
      }
      
      // Set initial values to ensure they're in sync
      const legacyValue = legacyControl.value;
      if (legacyValue !== null && legacyValue !== undefined) {
        apiControl.setValue(legacyValue, { emitEvent: false });
      }
      
      // Add one-time sync from legacy to API field
      if (!(legacyControl as any).__syncedToApi) {
        legacyControl.valueChanges.subscribe(value => {
          apiControl.setValue(value, { emitEvent: false });
        });
        (legacyControl as any).__syncedToApi = true;
      }
    });
  }

  formatCurrentDate(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }
  
  /**
   * Toggle GST dropdown visibility
   */
  toggleGstDropdown(): void {
    console.log('Toggling GST dropdown, current state:', this.showGstDropdown);
    
    // Toggle dropdown state
    this.showGstDropdown = !this.showGstDropdown;
    console.log('GST dropdown new state:', this.showGstDropdown);
    
    // Close dropdown when clicking outside
    if (this.showGstDropdown) {
      // Delay to ensure Angular has updated the DOM
      setTimeout(() => {
        // Force GST dropdown to be shown with all options
        const customDropdownMenu = document.querySelector('.custom-dropdown-menu');
        if (customDropdownMenu) {
          console.log('✓ GST custom dropdown menu found');
          
          // Ensure the dropdown is visible in the DOM
          (customDropdownMenu as HTMLElement).style.display = 'block';
          console.log('Forced dropdown display: block');
        } else {
          console.warn('❌ GST custom dropdown menu element not found');
        }
        
        // Add outside click listener with a small delay to avoid immediate closing
        setTimeout(() => {
          const closeDropdownListener = (event: MouseEvent) => {
            const dropdown = document.getElementById('gstDropdown');
            const menu = document.querySelector('.custom-dropdown-menu');
            
            // Close only if clicking outside both the dropdown toggle and menu
            if ((dropdown && !dropdown.contains(event.target as Node)) && 
                (menu && !menu.contains(event.target as Node))) {
              console.log('Closing GST dropdown from outside click');
              this.showGstDropdown = false;
              document.removeEventListener('click', closeDropdownListener);
            }
          };
          document.addEventListener('click', closeDropdownListener);
        }, 50);
      }, 50);
    }
  }
  
  /**
   * Select GST type and update form
   */
  selectGstType(type: string): void {
    this.purchaseForm.get('gst')?.setValue(type);
    this.showGstDropdown = false;
    
    // Update tax profile validation based on GST type
    this.updateTaxProfileValidation(type);
    
    // Recalculate all items when GST type changes
    if (this.itemsFormArray.length > 0) {
      for (let i = 0; i <this.itemsFormArray.length; i++) {
        this.calculateItemTotal(i);
      }
      this.calculateTotals();
    } else {
      this.calculateTotals();
    }
  }
  
  // Initialize the reactive form
  private initForm(defaultReferenceId: string): void {
    console.log('Initializing form');
    
    this.purchaseForm = this.fb.group({
      supplierId: ['', Validators.required],
      invoiceDate: [this.formatCurrentDate(), Validators.required],
      referenceId: [defaultReferenceId || '', Validators.required],
      gst: ['EXCLUSIVE'],
      overallDiscount: [0, Validators.min(0)],
      amountPaid: [0, Validators.min(0)],
      paymentMode: ['CASH'],
      paymentReference: [''],
      items: this.fb.array([])
    });
    
    // No need to store form array reference as we have a getter
    
    // Add listener for GST type changes
    this.purchaseForm.get('gst')?.valueChanges.subscribe(gstType => {
      console.log('GST type changed to:', gstType);
      this.updateTaxProfileValidation(gstType);
    });
    
    // No longer adding default items - user will add them manually
  }
  
  // Update tax profile validation requirements based on GST type
  private updateTaxProfileValidation(gstType: string): void {
    if (this.itemsFormArray.length > 0) {
      for (let i = 0; i < this.itemsFormArray.length; i++) {
        const itemGroup = this.itemsFormArray.at(i) as FormGroup;
        const taxProfileControl = itemGroup.get('taxProfileId');
        
        if (taxProfileControl) {
          if (gstType === 'NON_GST') {
            // For NON_GST, tax profile is not required
            taxProfileControl.clearValidators();
          } else {
            // For EXCLUSIVE and INCLUSIVE GST types, tax profile is required
            taxProfileControl.setValidators(Validators.required);
          }
          // Update validators
          taxProfileControl.updateValueAndValidity();
        }
      }
    }
  }
  
  // Check if tax profile is required based on GST type
  isTaxProfileRequired(rowIndex: number): boolean {
    const gstType = this.purchaseForm.get('gst')?.value;
    return gstType === 'EXCLUSIVE' || gstType === 'INCLUSIVE';
  }

  get itemsFormArray(): FormArray {
    return this.purchaseForm.get('items') as FormArray;
  }

  get formIsValid(): boolean {
    // Allow save if we have at least one item and the main form fields are valid
    const supplierValid = this.purchaseForm.get('supplierId')?.valid ?? false;
    const dateValid = this.purchaseForm.get('invoiceDate')?.valid ?? false;
    
    const mainFormValid = supplierValid && dateValid;
    const hasItems = this.itemsFormArray.length > 0;
    
    // Debug logs for form validation
    console.log('Supplier valid:', supplierValid, 
                'Invoice date valid:', dateValid,
                'Form has items:', hasItems);
    
    // At least one item must have required fields filled
    let hasValidItem = false;
    
    if (hasItems) {
      for (let i = 0; i < this.itemsFormArray.controls.length; i++) {
        const item = this.itemsFormArray.controls[i];
        const medicineId = item.get('medicineId')?.value;
        const batchNo = item.get('batchNo')?.value;
        const expiryDate = item.get('expiryDate')?.value;
        const quantity = item.get('quantity')?.value;
        const purchaseCost = item.get('purchaseCost')?.value;
        
        // Get current GST type to determine if tax profile is required
        const currentGstType = this.purchaseForm.get('gst')?.value || 'EXCLUSIVE';
        
        // Only require tax profile if GST type is not NON_GST
        const taxProfileId = item.get('taxProfileId')?.value;
        const isTaxProfileRequired = currentGstType !== 'NON_GST';
        const isTaxProfileValid = !isTaxProfileRequired || (isTaxProfileRequired && !!taxProfileId);
        
        const isItemValid = medicineId && batchNo && expiryDate && 
                          quantity > 0 && purchaseCost > 0 && isTaxProfileValid;
        
        // Log each item's validation state
        console.log(`Item ${i} validation:`, 
                    'Medicine:', !!medicineId,
                    'Batch:', !!batchNo,
                    'Expiry:', !!expiryDate,
                    'Quantity:', quantity > 0,
                    'Cost:', purchaseCost > 0,
                    'Tax Required:', isTaxProfileRequired,
                    'Tax Valid:', isTaxProfileValid,
                    'Overall Valid:', isItemValid);
        
        if (isItemValid) {
          hasValidItem = true;
          break; // At least one valid item is enough
        }
      }
    }
    
    const isFormValid = mainFormValid && hasItems && hasValidItem;
    console.log('Final form validation result:', isFormValid);
    
    return isFormValid;
  }

  // We'll disable MRP validation for now to allow data entry
  validateMrpGreaterThanCost(group: FormGroup): { [key: string]: any } | null { 
    return null; // Disable validation temporarily
    
    // Keep the code for reference but don't execute it
    /*
    const mrpControl = group.get('mrp');
    const costControl = group.get('purchaseCost');
    const packSizeControl = group.get('packSize');
    
    if (!mrpControl || !costControl || !packSizeControl) return null;
    
    const mrpPerUnit = +mrpControl.value;
    const costPerPack = +costControl.value;
    const packSize = +packSizeControl.value || 1;
    
    // Calculate cost per unit for fair comparison
    const costPerUnit = packSize > 0 ? costPerPack / packSize : 0;
    
    // Debug values
    console.log(`Validation check: MRP per unit: ${mrpPerUnit}, Cost per unit: ${costPerUnit} (Cost ${costPerPack} / Pack size ${packSize})`);
    
    // Only validate when we have meaningful values and add tolerance for floating point
    if (mrpPerUnit > 0 && costPerUnit > 0) {
      // Add a small tolerance (0.001) for floating point comparison
      if (mrpPerUnit <= (costPerUnit - 0.001)) {
        console.log('Validation failed: MRP <= Cost per unit');
        mrpControl.setErrors({mrpNotGreater: true});
        return { mrpNotGreaterThanCost: true };
      } else {
        console.log('Validation passed: MRP > Cost per unit');
        // Only clear this specific error, not all errors
        const currentErrors = mrpControl.errors;
        if (currentErrors) {
          delete currentErrors['mrpNotGreater'];
          mrpControl.setErrors(Object.keys(currentErrors).length ? currentErrors : null);
        }
      }
    }
    return null;
    */
  }

  addPurchaseItem(): void {
    console.log('Adding new purchase item');
    
    // Get current GST type to determine if tax profile is required
    const currentGstType = this.purchaseForm.get('gst')?.value || 'EXCLUSIVE';
    
    // Create a new form group for this item with default values to match the Java API requirements
    const newItemGroup = this.fb.group({
      medicineId: ['', Validators.required],
      medicineName: [''], // UI display only
      genericName: [''], // UI display only
      hsn: [''], // UI display only
      
      // Fields required by the API
      batchNo: ['', Validators.required],
      expiryDate: ['', Validators.required],
      packQuantity: [0, [Validators.required, Validators.min(0)]], // API: packQuantity 
      freePackQuantity: [0, [Validators.min(0)]], // API: freePackQuantity
      itemsPerPack: [0, [Validators.required, Validators.min(0)]], // API: itemsPerPack
      purchaseCostPerPack: [0, [Validators.required, Validators.min(0.01)]], // API: purchaseCostPerPack
      discountPercentage: [0, [Validators.min(0), Validators.max(100)]], // API: discountPercentage
      mrpPerItem: [0, [Validators.required, Validators.min(0.01)]], // API: mrpPerItem
      taxProfileId: ['', currentGstType !== 'NON_GST' ? Validators.required : null], // API: taxProfileId
      
      // Legacy field names for backward compatibility in UI
      quantity: [0, [Validators.required, Validators.min(0)]], // Legacy UI field (maps to packQuantity)
      freepack: [0, [Validators.min(0)]], // Legacy UI field (maps to freePackQuantity)
      pack: [0, [Validators.required, Validators.min(0)]], // Legacy UI field (maps to itemsPerPack)
      purchaseCost: [0, [Validators.required, Validators.min(0.01)]], // Legacy UI field (maps to purchaseCostPerPack)
      discount: [0, [Validators.min(0), Validators.max(100)]], // Legacy UI field (maps to discountPercentage)
      mrp: [0, [Validators.required, Validators.min(0.01)]], // Legacy UI field (maps to mrpPerItem)
      
      // UI-only calculation fields
      paidQuantity: [0], // UI-only: Number of packs charged
      discountAmount: [0], // UI-only: Calculated discount amount
      cgstAmount: [0], // UI-only: Calculated CGST
      sgstAmount: [0], // UI-only: Calculated SGST
      taxableAmount: [0], // UI-only: Calculated taxable amount
      totalAmount: [0], // UI-only: Calculated total amount
      totalQuantity: [0], // UI-only: Calculated total quantity
    });
    
    console.log('Created new form group:', newItemGroup.value);
    
    this.itemsFormArray.push(newItemGroup);
    
    // Add valueChanges listeners for dynamic calculations
    const index = this.itemsFormArray.length - 1;
    this.addFormControlListeners(index);
    
    // Synchronize legacy field names with API field names
    this.syncLegacyFields(this.itemsFormArray.at(index) as FormGroup);
    
    // Initialize the filtered medicines array for this row
    this.filteredMedicinesForRow[index] = this.medicines.slice();
    
    // Calculate totals after adding a new item
    this.calculateTotals();
  }

  removePurchaseItem(index: number): void {
    this.itemsFormArray.removeAt(index);
    delete this.filteredMedicinesForRow[index];
    this.calculateTotals();
  }

  loadSuppliers(): void {
    this.loadingSuppliers = true;
    this.inventoryService.getSuppliers().subscribe({
      next: (suppliers) => {
        console.log('All suppliers loaded:', suppliers.length);
        
        // Filter out inactive suppliers
        const activeSuppliers = suppliers.filter(supplier => {
          // Make sure supplier has an ID (convert to string to be safe)
          if (!supplier.id) supplier.id = '';
          supplier.id = supplier.id.toString();
          return supplier.status !== 'INACTIVE';
        });
        
        this.suppliers = activeSuppliers;
        // Don't show all suppliers initially
        this.filteredSuppliers = [];
        
        console.log('Active suppliers after filtering:', activeSuppliers.length);
        this.loadingSuppliers = false;
      },
      error: (err) => {
        console.error('Error loading suppliers', err);
        this.loadingSuppliers = false;
        // Fallback to sample data
        this.createSampleSuppliers();
      }
    });
  }

  loadMedicines(): void {
    this.loadingMedicines = true;
    this.inventoryService.getMedicines().subscribe({
      next: (data: Medicine[]) => {
        console.log('All medicines loaded:', data.length);
        
        // Filter out inactive medicines
        const activeMedicines = data.filter(medicine => {
          console.log(`Medicine ${medicine.name}, status: ${medicine.status}`);
          return medicine.status !== 'INACTIVE';
        });
        
        this.medicines = activeMedicines;
        this.filteredMedicines = [...activeMedicines];
        this.loadingMedicines = false;
        
        console.log('Active medicines after filtering:', activeMedicines.length);
      },
      error: (err) => {
        console.error('Error loading medicines', err);
        this.loadingMedicines = false;
        // Fallback to sample data
        this.createSampleMedicines();
      },
      complete: () => {
        // Initialize filtered medicines for the first row
        this.filteredMedicinesForRow[0] = [...this.medicines];
      }
    });
  }

  loadTaxProfiles(): void {
    this.loadingTaxProfiles = true;
    this.inventoryService.getTaxProfiles().subscribe({
      next: (data: TaxProfile[]) => {
        this.taxProfiles = data || [];
        this.loadingTaxProfiles = false;
        
        // Set default tax profile (no tax or first available)
        const noTaxProfile = this.taxProfiles.find(p => p.id === 'tax_no_tax' || p.totalRate === 0);
        this.defaultTaxProfileId = noTaxProfile ? noTaxProfile.id : 
                                (this.taxProfiles.length > 0 ? this.taxProfiles[0].id : null);
        
        console.log('Default tax profile set to:', this.defaultTaxProfileId);
        
        // Show tax profile details for debugging
        if (data && data.length > 0) {
          data.forEach(profile => {
            console.log(`Tax Profile: ${profile.profileName}, ID: ${profile.id}, Total Rate: ${profile.totalRate}%`);
          });
        } else {
          console.warn('No tax profiles received from API, adding a default one for testing');
          // If no profiles were loaded, add a test one for debugging
          this.taxProfiles = [{
            id: 'test-profile-1',
            profileName: 'GST 5%',
            totalRate: 5,
            components: [
              { componentName: 'CGST', rate: 2.5 },
              { componentName: 'SGST', rate: 2.5 }
            ]
          }];
        }
      },
      error: (err: any) => {
        console.error('Error loading tax profiles', err);
        this.loadingTaxProfiles = false;
        
        // Add a default tax profile for testing if there was an error
        console.warn('Adding a default tax profile for testing due to API error');
        this.taxProfiles = [{
          id: 'test-profile-1',
          profileName: 'GST 5%',
          totalRate: 5,
          components: [
            { componentName: 'CGST', rate: 2.5 },
            { componentName: 'SGST', rate: 2.5 }
          ]
        }];
      }
    });
  }

  searchSupplier(showAll: boolean = false): void {
    console.log('Searching suppliers, showAll:', showAll);
    
    // If no suppliers are loaded yet, don't do anything
    if (!this.suppliers || this.suppliers.length === 0) {
      console.log('No suppliers loaded yet');
      return;
    }
    
    // Show all suppliers when input is clicked or focused
    if (showAll) {
      console.log('Showing all suppliers');
      this.filteredSuppliers = [...this.suppliers]
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 10);
      return;
    }
    
    // If search term is empty, show no results
    if (!this.searchSupplierTerm || this.searchSupplierTerm.trim() === '') {
      this.filteredSuppliers = [];
      return;
    }
    
    this.filterSuppliers(this.searchSupplierTerm);
  }

  filterSuppliers(term: string): void {
    term = term.toLowerCase();
    this.filteredSuppliers = this.suppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(term) ||
      supplier.contactNumber?.toLowerCase().includes(term) ||
      supplier.mobileNumber?.toLowerCase().includes(term) ||
      supplier.email?.toLowerCase().includes(term)
    );
    console.log(`Found ${this.filteredSuppliers.length} suppliers matching "${term}"`);
  }

  /**
   * Select supplier and update form values
   * @param supplier Selected supplier object
   */
  /**
   * Select supplier and update form values without showing GST dropdown
   * @param supplier Selected supplier object
   */
  selectSupplier(supplier: Supplier): void {
    console.log('Supplier selected:', supplier);
    this.selectedSupplier = supplier;
    this.purchaseForm.get('supplierId')?.setValue(supplier.id);
    this.purchaseForm.get('supplierAddress')?.setValue(supplier.address || '');
    
    // Clear search and filtered list after selection
    this.searchSupplierTerm = '';
    this.filteredSuppliers = [];
    
    // Ensure GST dropdown stays closed
    this.showGstDropdown = false;
    
    // Prevent any event bubbling that might trigger the GST dropdown
    setTimeout(() => {
      // Force GST dropdown to be closed in case it was triggered
      this.showGstDropdown = false;
    }, 0);
  }
  
  clearSelectedSupplier(): void {
    this.selectedSupplier = null;
    this.purchaseForm.get('supplierId')?.setValue(null);
    this.purchaseForm.get('supplierAddress')?.setValue('');
    this.searchSupplierTerm = '';
    this.filteredSuppliers = [];
  }

  searchMedicineForRow(event: any, rowIndex: number): void {
    // Get the input value
    const searchText = event.target.value;
    const term = searchText.toLowerCase();
    
    // Update the form controls
    const row = this.itemsFormArray.at(rowIndex) as FormGroup;
    
    // Update medicineName field with what the user is typing
    row.patchValue({
      medicineName: searchText // Keep the search text visible
    }, {emitEvent: false});
    
    // Only clear medicineId if we're searching for something new (not when deleting)
    if (searchText !== '' && row.get('medicineId')?.value && 
        !row.get('medicine')?.value?.name?.toLowerCase().includes(term)) {
      row.patchValue({
        medicineId: '' // Clear the ID since we're searching for something new
      }, {emitEvent: false});
    }
    
    // Ensure the filtered medicines array exists for this row
    if (!this.filteredMedicinesForRow[rowIndex]) {
      this.filteredMedicinesForRow[rowIndex] = [...this.medicines];
    }
    
    // If empty term, show all medicines
    if (!term) {
      this.filteredMedicinesForRow[rowIndex] = [...this.medicines];
      this.setActiveMedicineRow(rowIndex); // Keep dropdown open
      return;
    }
    
    // Filter medicines based on search term with better matching
    this.filteredMedicinesForRow[rowIndex] = this.medicines.filter(medicine => {
      const nameMatch = medicine.name.toLowerCase().includes(term);
      const genericMatch = medicine.genericName ? medicine.genericName.toLowerCase().includes(term) : false;
      const idMatch = medicine.id.toLowerCase().includes(term);
      
      return nameMatch || genericMatch || idMatch;
    });
    
    // DO NOT auto-select - let user choose from dropdown instead
    // This allows backspace to work and prevents automatic selection
    
    // Always keep dropdown open during search
    this.setActiveMedicineRow(rowIndex);
  }

  // Set which row has active medicine dropdown
  setActiveMedicineRow(rowIndex: number): void {
    this.activeMedicineRow = rowIndex;
  }

  clearActiveMedicineRow(): void {
    this.activeMedicineRow = -1;
  }
  
  /**
   * Calculates the top position for the medicine dropdown based on row index
   * This positions the dropdown outside the component at an appropriate vertical position
   */
  getDropdownTopPosition(rowIndex: number): number {
    // Get the input element for the current row
    const inputElements = document.querySelectorAll('.medicine-select input');
    if (inputElements && inputElements.length > rowIndex) {
      const inputEl = inputElements[rowIndex] as HTMLElement;
      if (inputEl) {
        // Get the position of the input element relative to the viewport
        const rect = inputEl.getBoundingClientRect();
        // Position the dropdown below the input but with some offset
        // to ensure it doesn't cover the input itself
        return rect.bottom + window.scrollY + 5; // 5px offset for spacing
      }
    }
    // Default position if element not found
    return window.scrollY + 100;
  }

  selectMedicineForRow(medicine: Medicine, rowIndex: number): void {
    // Get the form group for this row
    const row = this.itemsFormArray.at(rowIndex) as FormGroup;
    
    console.log('Selected medicine with tax profile:', medicine.taxProfileId);
    console.log('Medicine details:', JSON.stringify(medicine)); // Log full medicine details
    
    // Update all form fields with medicine data
    row.patchValue({
      medicineId: medicine.id,
      medicineName: medicine.name,
      category: medicine.category && typeof medicine.category === 'object' ? (medicine.category as any).name || '' : medicine.category || '',
      genericName: medicine.genericName || '',
      manufacturer: medicine.manufacturer || '', // Ensure manufacturer is explicitly patched
      hsn: medicine.hsnCode || '', // Add HSN code patching
      mrp: medicine.mrp || medicine.unitPrice || 0, // Changed sellingRate to mrp, fallback to unitPrice
      // Don't reset itemsPerPack if it already has a value
      itemsPerPack: row.get('itemsPerPack')?.value || 1, // Maintain existing value
      taxProfileId: medicine.taxProfileId || '',  // Important: set the tax profile ID
      taxProfileName: medicine.taxProfile?.profileName || '', // Changed name to profileName
      // Don't reset these fields if they already have values
      purchaseCost: row.get('purchaseCost')?.value || 0,
      discountPercentage: row.get('discountPercentage')?.value || 0,
      pack: row.get('pack')?.value || 0,
      freepack: row.get('freepack')?.value || 0
    }, {emitEvent: false});
    
    // Also set form control values manually in case patching doesn't work
    if (row.get('manufacturer')) {
      row.get('manufacturer')?.setValue(medicine.manufacturer || '');
    }
    
    if (row.get('hsn')) {
      row.get('hsn')?.setValue(medicine.hsnCode || '');
    }
    
    console.log(`Selected medicine for row ${rowIndex}:`, medicine);
    
    // Force a manual DOM update to ensure the display is correct
    // We need this because we're using [value] binding instead of formControlName
    const inputElements = document.querySelectorAll('.medicine-select input');
    if (inputElements && inputElements.length > rowIndex) {
      const inputEl = inputElements[rowIndex] as HTMLInputElement;
      inputEl.value = medicine.name;
    }
    
    // Clear the filtered medicines for this row
    if (this.filteredMedicinesForRow && this.filteredMedicinesForRow[rowIndex]) {
      this.filteredMedicinesForRow[rowIndex] = [];
    }
    this.activeMedicineRow = null;
    
    // Trigger calculation for this row
    this.calculateItemTotal(rowIndex);
  }

// Method implementation moved to line ~1101

// Calculate totals for a single item row based on backend logic
calculateItemTotal(index: number): void {
  if (index < 0 || index >= this.itemsFormArray.length) {
    return;
  }

  const itemGroup = this.itemsFormArray.at(index) as FormGroup;
  const itemName = itemGroup.get('medicineName')?.value || 'Unknown Item';

  console.log(`----- Calculating totals for ${itemName} (row ${index+1}) -----`);

  // Number of packs being purchased (paid packs)
  const packQuantity = itemGroup.get('pack')?.value || 0;
  if (packQuantity <= 0) {
    console.log('Pack quantity is zero or negative - skipping calculation');
    return;
  }
  
  // Store current GST type in the item for consistency checks
  const formGstType = this.purchaseForm.get('gst')?.value || 'EXCLUSIVE';
  if (!itemGroup.get('gstType')) {
    itemGroup.addControl('gstType', this.fb.control(formGstType));
  } else {
    itemGroup.get('gstType')?.setValue(formGstType, { emitEvent: false });
  }

// ... rest of the code remains the same ...
    // Number of individual units in one pack
    const itemsPerPack = itemGroup.get('itemsPerPack')?.value || 1;
    console.log(`Items per pack: ${itemsPerPack}`);
    
    // Get free pack quantity to use in the calculation
    const freeQuantity = itemGroup.get('freepack')?.value || 0;
    
    // Ensure all values are numeric
    const numPackQty = Number(packQuantity) || 0;
    const numFreeQty = Number(freeQuantity) || 0;
    const numItemsPerPack = Number(itemsPerPack) || 1;
    
    // Calculate total quantity = (paid packs + free packs) * items per pack
    // This follows the formula: Quantity = (Pack + Free Pack) * Item per Pack
    const totalInventoryQuantity = Math.round((numPackQty + numFreeQty) * numItemsPerPack);
    console.log(`Total inventory quantity: (${numPackQty} paid packs + ${numFreeQty} free packs) * ${numItemsPerPack} items per pack = ${totalInventoryQuantity} total items`);
    
    // purchaseCostPerPack: Cost of one pack (base for calculations)
    const purchaseCostPerPack = itemGroup.get('purchaseCost')?.value || 0;
    
    // discountPercentage: Discount % on purchase cost
    const discountPercentage = itemGroup.get('discount')?.value || 0;
    
    // Get GST type from form
    const currentItemGstType = this.purchaseForm.get('gst')?.value || 'EXCLUSIVE';
    console.log(`GST Type: ${currentItemGstType}`);
    
    // Initialize tax rates
    let cgstRate = 0;
    let sgstRate = 0;
    
    // Process tax calculations based on GST type
    if (currentItemGstType !== 'NON_GST') { // Process for both EXCLUSIVE and INCLUSIVE
      // Get tax profile ID
      const taxProfileId = itemGroup.get('taxProfileId')?.value;
      
      // Check if tax profile is required but not selected
      if (!taxProfileId || taxProfileId === '') {
        console.warn('Tax profile is required for EXCLUSIVE GST but none selected');
        // Mark the field as touched to trigger validation error display
        itemGroup.get('taxProfileId')?.markAsTouched();
        
        // For calculation purposes, we'll still need to continue, but with zero rates
        cgstRate = 0;
        sgstRate = 0;
      } else if (this.taxProfiles && this.taxProfiles.length > 0) {
        console.log('Looking for tax profile with ID:', taxProfileId, 'in', this.taxProfiles.length, 'available profiles');
        
        // Find the profile with matching ID
        const selectedProfile = this.taxProfiles.find(profile => profile.id === taxProfileId);
        
        if (selectedProfile) {
          console.log('Found tax profile:', selectedProfile);
          
          // Extract CGST and SGST rates from components
          if (selectedProfile.components && selectedProfile.components.length > 0) {
            // Try to find CGST and SGST components
            const cgstComponent = selectedProfile.components.find(c => c.componentName?.toUpperCase().includes('CGST'));
            const sgstComponent = selectedProfile.components.find(c => c.componentName?.toUpperCase().includes('SGST'));
            
            cgstRate = cgstComponent?.rate || 0;
            sgstRate = sgstComponent?.rate || 0;
            
            console.log('Found tax components:', cgstComponent, sgstComponent);
          } else {
            // If no components or cannot find specific ones, use half of total rate for each
            cgstRate = selectedProfile.totalRate ? selectedProfile.totalRate / 2 : 0;
            sgstRate = selectedProfile.totalRate ? selectedProfile.totalRate / 2 : 0;
            console.log('No components found, using half of total rate:', cgstRate, sgstRate);
          }
          
          console.log(`Using tax profile: ${selectedProfile.profileName} with CGST: ${cgstRate}%, SGST: ${sgstRate}%`);
        } else {
          console.warn('Tax profile not found for ID:', taxProfileId);
          cgstRate = 0;
          sgstRate = 0;
        }
      } else {
        console.warn('No tax profiles available');
        cgstRate = 0;
        sgstRate = 0;
      }
    } else {
      // For INCLUSIVE GST, we don't calculate taxes separately
      console.log('GST is INCLUSIVE - skipping tax calculation');
      cgstRate = 0;
      sgstRate = 0;
    }
    
    // Explicitly convert all values to numbers to ensure proper calculation
    // Note: numPackQty and numFreeQty are already defined above - reusing them
    const itemsPerPackNum = Number(itemsPerPack) || 1;
    const purchaseCostNum = Number(purchaseCostPerPack) || 0;
    const discountPercentageNum = Number(discountPercentage) || 0;
    
    // Step 1: Calculate Gross Amount = Cost per Pack * Number of Packs (only paid packs)
    // This follows the formula: Total Amt = Pack * cost
    const grossAmount = numPackQty * purchaseCostNum;
    console.log(`Gross amount calculation: ${numPackQty} packs × ${purchaseCostNum} cost per pack = ${grossAmount}`); 
    
    // Step 2: Calculate Discount Amount = Gross Amount * (discountPercentage / 100)
    const discountAmount = grossAmount * (discountPercentageNum / 100);
    console.log(`Discount amount: ${grossAmount} × (${discountPercentageNum}%) = ${discountAmount}`);
    
    // Step 3: Calculate Net Amount After Discount
    const netAmountAfterDiscount = grossAmount - discountAmount;
    
    // Step 4: Get the combined tax rate
    const totalTaxRate = cgstRate + sgstRate;
    const taxRate = totalTaxRate / 100;
    
    // Step 4: Calculate Taxable Amount and Tax based on GST type
    let taxableAmount;
    let taxAmount;
    let cgstAmount = 0;
    let sgstAmount = 0;
    
    if (currentItemGstType === 'NON_GST') {
      // For NON_GST, no tax is applied
      taxableAmount = netAmountAfterDiscount;
      taxAmount = 0;
      cgstAmount = 0;
      sgstAmount = 0;
    } else if (currentItemGstType === 'INCLUSIVE') {
      // For INCLUSIVE GST (Tax is already included in the price)
      // Formula: Taxable Amount = Net Amount / (1 + Tax Rate %)
      taxableAmount = totalTaxRate > 0 ? 
                     this.roundToTwo(netAmountAfterDiscount / (1 + taxRate)) : 
                     netAmountAfterDiscount;
      
      // Tax Amount = Net Amount - Taxable Amount
      taxAmount = this.roundToTwo(netAmountAfterDiscount - taxableAmount);
      
      // Split tax amount into CGST and SGST proportionally
      if (totalTaxRate > 0) {
        cgstAmount = this.roundToTwo(taxAmount * (cgstRate / totalTaxRate));
        sgstAmount = this.roundToTwo(taxAmount * (sgstRate / totalTaxRate));
        
        // Ensure sum of components equals the total tax (handle rounding issues)
        const calculatedSum = cgstAmount + sgstAmount;
        if (calculatedSum !== taxAmount) {
          const diff = this.roundToTwo(taxAmount - calculatedSum);
          cgstAmount += diff; // Add any difference to CGST for simplicity
        }
      }
    } else { // EXCLUSIVE
      // For EXCLUSIVE GST (Tax is added on top)
      // Taxable Amount is simply the Net Amount
      taxableAmount = netAmountAfterDiscount;
      
      // Calculate individual tax components directly
      cgstAmount = this.roundToTwo(taxableAmount * (cgstRate / 100));
      sgstAmount = this.roundToTwo(taxableAmount * (sgstRate / 100));
      taxAmount = cgstAmount + sgstAmount;
    }
    
    // Calculate final amount - for both EXCLUSIVE and INCLUSIVE, the final amount is the same
    const totalAmount = currentItemGstType === 'EXCLUSIVE' ? 
                       taxableAmount + taxAmount : 
                       netAmountAfterDiscount;
    
    // Log the calculation details for debugging
    console.log(`Item calculation for row ${index+1} with medicine: ${itemName}`);
    console.log(`- Pack Qty: ${numPackQty}, Items/Pack: ${numItemsPerPack}, Free Packs: ${numFreeQty}`);
    console.log(`- Cost per Pack: ${purchaseCostNum}, Discount %: ${discountPercentageNum}`);
    console.log(`- Gross Amount: ${grossAmount} (${numPackQty} packs × ${purchaseCostNum} cost)`);
    console.log(`- Discount Amount: ${discountAmount} (${discountPercentageNum}% of ${grossAmount})`);
    console.log(`- Net Amount after discount: ${netAmountAfterDiscount}`);
    console.log(`- Inventory Qty: ${totalInventoryQuantity} ((${numPackQty} + ${numFreeQty}) × ${numItemsPerPack})`);
    console.log(`- Taxable Amount: ${taxableAmount}`);
    console.log(`- Tax Profile ID: ${itemGroup.get('taxProfileId')?.value || 'None'}`);
    console.log(`- GST Type: ${currentItemGstType}, Tax Rates: CGST ${cgstRate}%, SGST ${sgstRate}%`);
    console.log(`- CGST ${cgstRate}%: ${cgstAmount}, SGST ${sgstRate}%: ${sgstAmount}`);
    console.log(`- Total Amount: ${totalAmount}`);
    
    // Ensure values are actual numbers with proper precision
    const roundedTaxableAmount = this.roundToTwo(taxableAmount);
    const roundedCgstAmount = this.roundToTwo(cgstAmount);
    const roundedSgstAmount = this.roundToTwo(sgstAmount);
    const roundedTotalAmount = this.roundToTwo(totalAmount);
    const roundedDiscountAmount = this.roundToTwo(discountAmount);
    
    console.log('Setting form values for GST type:', currentItemGstType);
    console.log('- Taxable Amount:', roundedTaxableAmount);
    console.log('- CGST Amount:', roundedCgstAmount);
    console.log('- SGST Amount:', roundedSgstAmount);
    console.log('- Total Amount:', roundedTotalAmount);
    
    // Update the item form group with the calculated values
    // Update both legacy and API field names for quantity
    itemGroup.get('quantity')?.setValue(totalInventoryQuantity, { emitEvent: false });
    itemGroup.get('packQuantity')?.setValue(packQuantity, { emitEvent: false });
    itemGroup.get('totalQuantity')?.setValue(totalInventoryQuantity);
    
    // If NON_GST type, ensure tax profile is cleared
    if (currentItemGstType === 'NON_GST') {
      itemGroup.get('taxProfileId')?.setValue('', { emitEvent: false });
    }
    
    // Update the form with calculated values
    // Update the form with all calculated values
    itemGroup.patchValue({
      taxableAmount: roundedTaxableAmount,
      cgstAmount: roundedCgstAmount,
      sgstAmount: roundedSgstAmount,
      totalAmount: roundedTotalAmount,
      totalQuantity: totalInventoryQuantity,
      discountAmount: roundedDiscountAmount
    });
    
    // Force Angular to detect the changes and update the UI
    setTimeout(() => {
      this.purchaseForm.updateValueAndValidity({onlySelf: false, emitEvent: true});
    }, 0);
    
    // Recalculate invoice totals
    this.calculateTotals();
  }
  
  /**
   * Calculate profit percentage based on MRP and purchase cost
   * Profit % = ((MRP - Purchase Cost) / MRP) * 100
   */
  calculateProfitPercentage(item: AbstractControl): number | null {
    if (!item) return null;
    
    const mrp = Number(item.get('mrp')?.value || item.get('mrpPerItem')?.value || 0);
    const purchaseCost = Number(item.get('purchaseCost')?.value || item.get('purchaseCostPerPack')?.value || 0);
    
    if (purchaseCost <= 0 || mrp <= 0) {
      return null;
    }
    
    // Calculate the per-item values to get accurate profit
    const itemsPerPack = Number(item.get('itemsPerPack')?.value || item.get('pack')?.value || 1);
    const costPerItem = purchaseCost / itemsPerPack;
    
    // Calculate profit using MRP as the base (not cost)
    // Formula: ((MRP - Cost) / MRP) * 100
    // This matches image 2's calculation which shows -157.14% for MRP=100, Cost=300/40=7.5
    // (100 - 300/40) / 100 * 100 = (100 - 7.5) / 100 * 100 = 92.5%
    // Or using the total: (100*40 - 300) / (100*40) * 100 = (4000 - 300) / 4000 * 100 = 92.5%
    
    const profitPercentage = ((mrp - costPerItem) / mrp) * 100;
    
    return this.roundToTwo(profitPercentage);
  }

  // Get the full tax profile name with rate for display in tooltip
  getSelectedTaxProfileLabel(item: AbstractControl): string {
    if (!item) return '';
    
    const profileId = item.get('taxProfileId')?.value;
    if (!profileId || !this.taxProfiles || this.taxProfiles.length === 0) {
      return 'Select GST %';
    }
    
    const selectedProfile = this.taxProfiles.find(profile => profile.id === profileId);
    if (!selectedProfile) {
      return 'Select GST %';
    }
    
    return `${selectedProfile.profileName} (${selectedProfile.totalRate}%)`;
  }

  // Calculate overall invoice totals using backend logic
  calculateTotals(): void {
    if (!this.itemsFormArray || this.itemsFormArray.length === 0) {
      this.resetTotals();
      return;
    }
    
    // Reset all totals first
    this.grossTotal = 0;
    this.discount = 0;
    this.netTaxableAmt = 0;
    this.cgstAmount = 0;
    this.sgstAmount = 0;
    this.netTotal = 0;
    this.totalItems = 0;
    
    // Get GST type from form
    const currentGstType = this.purchaseForm.get('gst')?.value || 'EXCLUSIVE';
    console.log(`Calculating invoice totals with GST type: ${currentGstType}`);
    
    // Loop through all items in the form array
    for (let i = 0; i < this.itemsFormArray.length; i++) {
      const item = this.itemsFormArray.at(i) as FormGroup;
      
      // Skip empty or invalid items
      const packQuantity = Number(item.get('pack')?.value || 0);
      if (packQuantity <= 0) {
        continue;
      }
      
      // Get all values from the form item
      const medicineName = item.get('medicineName')?.value || 'Unknown';
      const purchaseCostPerPack = Number(item.get('purchaseCost')?.value || 0);
      const packQuantityNum = Number(packQuantity);
      
      // Ensure item GST type matches current form GST type
      const itemGstType = item.get('gstType')?.value;
      if (itemGstType !== currentGstType) {
        console.log(`GST type mismatch detected for item ${medicineName}. Form GST: ${currentGstType}, Item GST: ${itemGstType}`);
        // Update the item's GST type to match the form GST type
        item.get('gstType')?.setValue(currentGstType, { emitEvent: false });
      }
      
      // Get calculated values (these are already rounded by calculateItemTotal)
      const discountAmount = Number(item.get('discountAmount')?.value || 0);
      const taxableAmount = Number(item.get('taxableAmount')?.value || 0);
      const cgstAmount = Number(item.get('cgstAmount')?.value || 0);
      const sgstAmount = Number(item.get('sgstAmount')?.value || 0);
      const totalAmount = Number(item.get('totalAmount')?.value || 0);
      const totalQuantity = Number(item.get('totalQuantity')?.value || 0);
      
      // Gross amount is Pack * Cost (not subtracting free packs) as per new formula
      const itemGrossAmount = packQuantityNum * purchaseCostPerPack;
      
      // Log the values for debugging
      console.log(`Row ${i+1} - ${medicineName}: grossAmt=${itemGrossAmount}, discount=${discountAmount}, taxable=${taxableAmount}`);
      console.log(`Row ${i+1} - ${medicineName}: CGST=${cgstAmount}, SGST=${sgstAmount}, total=${totalAmount}`);
      
      // Add to invoice totals
      this.grossTotal += this.roundToTwo(itemGrossAmount);
      this.discount += discountAmount;
      this.netTaxableAmt += taxableAmount;
      this.cgstAmount += cgstAmount;
      this.sgstAmount += sgstAmount;
      this.netTotal += totalAmount;
      this.totalItems += totalQuantity;
    }
    // Handle overall invoice discount if applicable
    const overallDiscountValue = Number(this.purchaseForm.get('overallDiscount')?.value || 0);
    
    if (overallDiscountValue > 0) {
      let additionalDiscount = 0;
      
      if (this.overallDiscountType === '%') {
        // Percentage-based overall discount
        additionalDiscount = this.roundToTwo(this.netTaxableAmt * (overallDiscountValue / 100));
      } else {
        // Fixed amount overall discount
        additionalDiscount = Math.min(overallDiscountValue, this.netTaxableAmt);
      }
      
      // Apply additional discount to taxable amount
      this.discount += additionalDiscount;
      this.netTaxableAmt -= additionalDiscount;
      
      // Recalculate taxes after applying overall discount based on GST type
      if (currentGstType === 'NON_GST') {
        // No tax adjustment needed
        this.netTotal = this.netTaxableAmt;
      } else if (currentGstType === 'EXCLUSIVE') {
        // For EXCLUSIVE, recalculate taxes and total
        const totalTaxRate = this.getTotalTaxRate();
        const newTotalTax = this.roundToTwo(this.netTaxableAmt * (totalTaxRate / 100));
        
        // Split between CGST and SGST proportionally
        if (this.cgstAmount + this.sgstAmount > 0) {
          const oldRatio = this.cgstAmount / (this.cgstAmount + this.sgstAmount);
          this.cgstAmount = this.roundToTwo(newTotalTax * oldRatio);
          this.sgstAmount = this.roundToTwo(newTotalTax * (1 - oldRatio));
        } else {
          // If no previous tax, split 50/50
          this.cgstAmount = this.roundToTwo(newTotalTax / 2);
          this.sgstAmount = this.roundToTwo(newTotalTax / 2);
        }
        
        // Update net total
        this.netTotal = this.netTaxableAmt + this.cgstAmount + this.sgstAmount;
      } else {
        // For INCLUSIVE, the netTotal remains the same as grossTotal - discount
        // but we need to recalculate taxes
        const totalTaxRate = this.getTotalTaxRate();
        
        if (totalTaxRate > 0) {
          // Calculate tax using formula: taxAmount = netAmount - (netAmount / (1 + taxRate))
          const taxRate = totalTaxRate / 100;
          const taxableAmount = this.roundToTwo(this.netTaxableAmt / (1 + taxRate));
          const totalTaxAmount = this.roundToTwo(this.netTaxableAmt - taxableAmount);
          
          // Split tax proportionally
          if (this.cgstAmount + this.sgstAmount > 0) {
            const oldRatio = this.cgstAmount / (this.cgstAmount + this.sgstAmount);
            this.cgstAmount = this.roundToTwo(totalTaxAmount * oldRatio);
            this.sgstAmount = this.roundToTwo(totalTaxAmount * (1 - oldRatio));
          } else {
            // If no previous tax, split 50/50
            this.cgstAmount = this.roundToTwo(totalTaxAmount / 2);
            this.sgstAmount = this.roundToTwo(totalTaxAmount / 2);
          }
          
          // For INCLUSIVE GST, the netTotal is already correct (includes tax)
          this.netTotal = this.netTaxableAmt;
        } else {
          // If no tax rate, netTotal is simply the taxable amount
          this.netTotal = this.netTaxableAmt;
        }
      }
    }
    
    // Final rounding of all values
    this.grossTotal = this.roundToTwo(this.grossTotal);
    this.discount = this.roundToTwo(this.discount);
    this.netTaxableAmt = this.roundToTwo(this.netTaxableAmt);
    this.cgstAmount = this.roundToTwo(this.cgstAmount);
    this.sgstAmount = this.roundToTwo(this.sgstAmount);
    this.netTotal = this.roundToTwo(this.netTotal);
    
    console.log('Final invoice calculation:');
    console.log(`1. Sum of (Pack × Cost) for all items = ₹${this.grossTotal}`);
    console.log(`2. Total Discount (items + overall) = ₹${this.discount}`);
    console.log(`3. Net Taxable (Gross - Discount) = ₹${this.netTaxableAmt}`);
    console.log(`4. Tax amounts: CGST: ₹${this.cgstAmount}, SGST: ₹${this.sgstAmount}`);
    console.log(`5. Final Total (Taxable + Taxes) = ₹${this.netTotal}`);
    
    // We don't need to force change detection here as Angular will handle it
    
    console.log('Final Invoice Summary:');
    console.log(`- Gross Total: ₹${this.grossTotal}`);
    console.log(`- Total Discount: ₹${this.discount}`);
    console.log(`- Net Taxable: ₹${this.netTaxableAmt}`);
    console.log(`- CGST Amount: ₹${this.cgstAmount}`);
    console.log(`- SGST Amount: ₹${this.sgstAmount}`);
    console.log(`- Net Total: ₹${this.netTotal}`);
  }

  toggleDiscountType(): void {
    this.overallDiscountType = this.overallDiscountType === '%' ? '₹' : '%';
    this.calculateTotals();
  }

  resetTotals(): void {
    this.grossTotal = 0;
    this.discount = 0;
    this.netTaxableAmt = 0;
    this.cgstAmount = 0;
    this.sgstAmount = 0;
    this.netTotal = 0;
    this.totalItems = 0;
  }

  // Helper method for consistent decimal precision without rounding
  roundToTwo(num: number): number {
    // Use Math.round to avoid floating point errors but maintain exact values
    // Multiply by 100, round to avoid floating point errors, then divide by 100
    return Math.round(num * 100) / 100;
  }
  
  // Get effective total tax rate for the purchase
  getTotalTaxRate(): number {
    // Get the effective tax rate based on active tax profiles
    const gstType = this.purchaseForm.get('gst')?.value || 'EXCLUSIVE';
    
    if (gstType === 'NON_GST') {
      return 0;
    }
    
    // If we have tax items, calculate average rate
    let totalTaxAmount = this.cgstAmount + this.sgstAmount;
    let totalTaxableAmount = this.netTaxableAmt;
    
    if (totalTaxableAmount <= 0) {
      return 0;
    }
    
    // Calculate effective rate
    if (gstType === 'EXCLUSIVE') {
      return this.roundToTwo((totalTaxAmount / totalTaxableAmount) * 100);
    } else { // INCLUSIVE
      return this.roundToTwo((totalTaxAmount / (totalTaxableAmount - totalTaxAmount)) * 100);
    }
  }

  // Validation methods
  markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach(ctrl => {
          if (ctrl instanceof FormGroup) {
            this.markFormGroupTouched(ctrl);
          } else {
            ctrl.markAsTouched();
          }
        });
      }
    });
  }
  
  // Debug method to log form validation issues
  logValidationErrors(): void {
    console.log('Form valid?', this.purchaseForm.valid);
    console.log('Form errors:', this.purchaseForm.errors);
    
    // Check main form controls
    Object.keys(this.purchaseForm.controls).forEach(key => {
      const control = this.purchaseForm.get(key);
      console.log(`Control ${key} valid?`, control?.valid);
      console.log(`Control ${key} errors:`, control?.errors);
    });
    
    // Check items array
    if (this.itemsFormArray) {
      this.itemsFormArray.controls.forEach((control, index) => {
        console.log(`Item ${index} valid?`, control.valid);
        console.log(`Item ${index} errors:`, control.errors);
        
        if (control instanceof FormGroup) {
          Object.keys(control.controls).forEach(key => {
            const childControl = control.get(key);
            console.log(`Item ${index} control ${key} valid?`, childControl?.valid);
            console.log(`Item ${index} control ${key} errors:`, childControl?.errors);
          });
        }
      });
    }
  }

  validatePurchaseItems(): string[] {
    return []; // Simplified implementation - no validation for now
  }

  setItemValue(index: number, controlName: string, value: any): void {
    if (index < 0 || index >= this.itemsFormArray.length) return;
    
    const control = this.itemsFormArray.at(index)?.get(controlName);
    if (control) {
      control.setValue(value, { emitEvent: true });
    }
  }

  parseDate(dateStr: string): Date {
    // Handle both DD-MM-YYYY and YYYY-MM-DD formats
    const parts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/');
    
    if (parts.length !== 3) {
      throw new Error('Invalid date format');
    }
    
    // If first part is 4 digits, assume it's already in YYYY-MM-DD format
    if (parts[0].length === 4) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    
    // Convert from DD-MM-YYYY to Date object
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }

  /**
   * Format date from ISO format to DD-MM-YYYY display format
   */
  formatDateForDisplay(date: string | null): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /**
   * Format medicine ID to make it shorter and more readable
   * Example: 'med_a1b2c3d4-e5f6-7890-abcd-ef1234567890' -> 'M-a1b2'
   */
  formatMedicineId(id: string | undefined): string {
    if (!id) return 'N/A';
    
    // If it's a long UUID-style ID
    if (id.includes('_')) {
      // Split by underscore and get the second part (the UUID)
      const parts = id.split('_');
      if (parts.length > 1) {
        // Take just the first 4 characters of the UUID
        return `M-${parts[1].substring(0, 4)}`;
      }
    }
    
    // For numeric IDs or other formats, just return as is or with prefix
    return id.length > 8 ? `M-${id.substring(0, 4)}` : id;
  }

  /**
   * Format supplier ID to make it shorter and more readable
   * Example: 'sup_1564cf0f-1440-4bf4-8acf-0751aad9372b' -> 'S-1564'
   */
  formatSupplierId(id: string | undefined): string {
    if (!id) return 'N/A';
    
    // If it's a long UUID-style ID
    if (id.includes('_')) {
      // Split by underscore and get the second part (the UUID)
      const parts = id.split('_');
      if (parts.length > 1) {
        // Take just the first 4 characters of the UUID
        return `S-${parts[1].substring(0, 4)}`;
      }
    }
    
    // For numeric IDs or other formats, just return as is or with prefix
    return id.length > 8 ? `S-${id.substring(0, 4)}` : id;
  }
  
  /**
   * Generates a default reference ID in the format INV-ABC-101
   * Uses a combination of prefix + 3-letter code + sequential number
   */
  generateDefaultReferenceId(): string {
    const prefix = 'INV';
    
    // Generate a 3-letter code (could be based on organization or random)
    const orgCode = 'LMEI';
    
    // Generate a sequential number (in real app would come from DB)
    // Here we'll use current date/time for uniqueness
    const now = new Date();
    const year = now.getFullYear().toString().substr(-2); // Last 2 digits of year
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const randomDigits = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    // Format: INV-ABC-YYMMDD-RRR (RRR is random number for uniqueness)
    return `${prefix}-${orgCode}-${year}${month}${day}-${randomDigits}`;
  }

  getItemValue(index: number, controlName: string): any {
    const control = this.itemsFormArray.at(index)?.get(controlName);
    return control ? control.value : null;
  }

  addFormControlListeners(rowIndex: number): void {
    if (rowIndex < 0 || rowIndex >= this.itemsFormArray.length) {
      console.error(`Invalid row index: ${rowIndex}`);
      return;
    }
    
    const itemGroup = this.itemsFormArray.at(rowIndex) as FormGroup;
    
    // Sync legacy field names with API field names
    this.syncLegacyFields(itemGroup);
    
    // Calculate quantity based on pack and itemsPerPack, including free packs
    const calculateQuantity = () => {
      // Explicitly convert values to numbers to prevent string concatenation
      const packValue = Number(itemGroup.get('pack')?.value) || 0;
      const freePackValue = Number(itemGroup.get('freepack')?.value) || 0;
      const itemsPerPackValue = Number(itemGroup.get('itemsPerPack')?.value) || 1;
      
      if (packValue > 0 && itemsPerPackValue > 0) {
        // Calculate total quantity = (pack + freepack) * itemsPerPack
        const totalPacks = packValue + freePackValue;
        const calculatedQty = Math.round(totalPacks * itemsPerPackValue);
        console.log(`Calculating quantity: ${packValue} packs + ${freePackValue} free packs = ${totalPacks} total packs * ${itemsPerPackValue} items per pack = ${calculatedQty} total items`);
        itemGroup.get('quantity')?.setValue(calculatedQty, { emitEvent: false });
        itemGroup.get('packQuantity')?.setValue(packValue, { emitEvent: false });
      }
    };
    
    // Listen for changes in pack, freepack, and itemsPerPack to automatically update quantity
    itemGroup.get('pack')?.valueChanges.subscribe((packValue) => {
      if (packValue !== undefined) {
        calculateQuantity();
        this.calculateItemTotal(rowIndex);
      }
    });
    
    // Add listener for freepack to update quantity when free packs change
    itemGroup.get('freepack')?.valueChanges.subscribe((freeValue) => {
      if (freeValue !== undefined) {
        calculateQuantity();
        this.calculateItemTotal(rowIndex);
      }
    });
    itemGroup.get('discountPercentage')?.valueChanges.subscribe(() => {
      this.calculateItemTotal(rowIndex);
    });
    
    itemGroup.get('mrp')?.valueChanges.subscribe(() => {
      this.calculateItemTotal(rowIndex);
    });
    
    itemGroup.get('mrpPerItem')?.valueChanges.subscribe(() => {
      this.calculateItemTotal(rowIndex);
    });
    
    itemGroup.get('taxProfileId')?.valueChanges.subscribe(() => {
      this.calculateItemTotal(rowIndex);
    });
    
    itemGroup.get('freepack')?.valueChanges.subscribe((freePack) => {
      calculateQuantity();
      this.calculateItemTotal(rowIndex);
    });
    
    // Listen for MRP changes
    itemGroup.get('mrp')?.valueChanges.subscribe(() => {
      this.calculateItemTotal(rowIndex);
    });
    
    // Listen for purchase cost changes
    itemGroup.get('purchaseCost')?.valueChanges.subscribe(() => {
      console.log('Purchase cost changed, recalculating totals');
      this.calculateItemTotal(rowIndex);
    });

    // Listen for changes in itemsPerPack to automatically update quantity
    itemGroup.get('itemsPerPack')?.valueChanges.subscribe((itemsPerPack) => {
      if (itemsPerPack && itemsPerPack > 0) {
        calculateQuantity();
      }
      // Always update item total and invoice summary when items per pack changes
      this.calculateItemTotal(rowIndex);
    });
  }

  filterMedicinesByRow(index: number, event: Event): void {
    const term = (event.target as HTMLInputElement).value.toLowerCase();
    if (!term) {
      this.filteredMedicinesForRow[index] = this.medicines.slice();
      return;
    }
    
    this.filteredMedicinesForRow[index] = this.medicines.filter(medicine => 
      medicine.name.toLowerCase().includes(term) || 
      (medicine.genericName && medicine.genericName.toLowerCase().includes(term))
    );
  }

  getTaxComponentRate(taxProfile: TaxProfile | undefined, componentName: string): number {
    if (!taxProfile) return 0;
    
    const component = taxProfile.components.find(
      c => c.componentName.toLowerCase() === componentName.toLowerCase()
    );
    
    return component ? component.rate : 0;
  }

  preparePurchaseData(): CreatePurchaseRequest {
    const formValue = this.purchaseForm.value;
    
    // Log raw form values for debugging
    console.log('Raw form values:', JSON.stringify(formValue, null, 2));
    
    const items: PurchaseItemDto[] = formValue.items.map((item: any, index: number) => {
      // Find the selected tax profile to include tax details
      const taxProfile = this.taxProfiles.find(p => p.id === item.taxProfileId);
      
      // Log each item's values to debug what's actually there
      console.log(`Item ${index} values:`, {
        medicineId: item.medicineId || 'missing',
        quantity: item.quantity || 0,
        batchNo: item.batchNo || 'missing',
        purchaseCost: item.purchaseCost || 0,
        mrp: item.mrp || 0
      });
      
      return {
        medicineId: item.medicineId,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate,
        packQuantity: Number(item.quantity) || 0,
        freePackQuantity: Number(item.freepack) || 0,
        itemsPerPack: Number(item.pack) || 1, // Using correct field name 'pack' instead of 'packSize'
        purchaseCostPerPack: Number(item.purchaseCost) || 0,
        discountPercentage: Number(item.discount) || 0,
        mrpPerItem: Number(item.mrp) || 0,
        taxProfileId: item.taxProfileId
      };
    });

    // Store calculated amounts for analytics but don't include in API request
    console.log('Purchase summary:', {
      grossAmount: this.grossTotal,
      discountAmount: this.discount,
      taxableAmount: this.netTaxableAmt,
      cgstAmount: this.cgstAmount,
      sgstAmount: this.sgstAmount,
      totalAmount: this.netTotal
    });

    // Make sure referenceId is always provided and properly formatted
    let referenceId = formValue.referenceId;
    
    // If for some reason referenceId is missing, generate a new one
    if (!referenceId) {
      referenceId = this.generateDefaultReferenceId();
      console.warn('Reference ID was missing, generated new one:', referenceId);
    }
    
    console.log('Using reference ID:', referenceId);

    // Return the formatted request according to API specifications
    const request = {
      supplierId: formValue.supplierId,
      invoiceDate: formValue.invoiceDate,
      referenceId: referenceId,
      gstType: formValue.gst, // Use form value instead of hardcoded "EXCLUSIVE"
      // Include payment fields required by backend API
      amountPaid: Number(formValue.amountPaid || 0),
      paymentMode: formValue.paymentMode || 'CASH',
      paymentReference: formValue.paymentReference || '',
      items: items
    };
    
    // Log the final request object
    console.log('Final purchase request:', JSON.stringify(request, null, 2));
    
    return request;
  }

  // Debug method to use sample suppliers if API fails
  createSampleSuppliers(): void {
    this.suppliers = [
      { id: 'SP-2025057', name: 'ALPHA AGENCIES', mobileNumber: '7550020555', address: '123 Main St', gstin: 'GSTIN1234567890' },
      { id: 'SP-2025055', name: 'AJAX PHARMACEUTICALS', mobileNumber: '4282592522', address: '456 Oak Ave', gstin: 'GSTIN0987654321' },
      { id: 'SP-2025056', name: 'UBK', mobileNumber: '7358412905', address: '789 Hospital Street', gstin: 'GSTIN5678901234' }
    ];
    this.filteredSuppliers = [...this.suppliers];
    console.log('Using sample suppliers:', this.suppliers.length);
  }

  createSampleMedicines(): void {
    this.medicines = [
      { 
        id: 'M001', 
        name: 'Paracetamol 500mg', 
        genericName: 'Paracetamol', 
        hsn: 'HSN001', 
        mrp: 15, 
        cgstPercentage: 9, 
        sgstPercentage: 9,
        unitOfMeasurement: 'TAB',
        lowStockThreshold: 10,
        stockQuantity: 100,
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'TP001',
        purchasePrice: 10,
        sellingPrice: 12
      },
      { 
        id: 'M002', 
        name: 'Amoxicillin 250mg', 
        genericName: 'Amoxicillin', 
        hsn: 'HSN002', 
        mrp: 25, 
        cgstPercentage: 9, 
        sgstPercentage: 9,
        unitOfMeasurement: 'TAB',
        lowStockThreshold: 10,
        stockQuantity: 50,
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'TP001',
        purchasePrice: 15,
        sellingPrice: 20
      },
      { 
        id: 'M003', 
        name: 'Cetirizine 10mg', 
        genericName: 'Cetirizine', 
        hsn: 'HSN003', 
        mrp: 18, 
        cgstPercentage: 9, 
        sgstPercentage: 9,
        unitOfMeasurement: 'TAB',
        lowStockThreshold: 5,
        stockQuantity: 20,
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'TP001',
        purchasePrice: 12,
        sellingPrice: 15
      }
    ];
    this.filteredMedicines = [...this.medicines];
    
    // Initialize filtered medicines for rows
    if (this.itemsFormArray.length > 0) {
      this.filteredMedicinesForRow[0] = [...this.medicines];

    }
  }
  
  /**
   * Submit the form - handles both create and update operations
   */
  onSubmit(): void {
    // Set the form as submitted to show validation errors
    this.formSubmitted = true;
    
    if (this.purchaseForm.invalid) {
      console.error('Form is invalid', this.purchaseForm.errors);
      return;
    }
    
    this.submitting = true;
    const formData = this.purchaseForm.value;
    
    // Debug - log the entire form data
    console.log('FORM DATA (RAW):', JSON.stringify(formData, null, 2));
    console.log('FORM CONTROLS:', Object.keys(this.purchaseForm.controls));
    
    // For each item, log the actual form control values to identify issues
    if (formData.items && formData.items.length > 0) {
      formData.items.forEach((item: any, index: number) => {
        console.log(`ITEM ${index} RAW FORM VALUES:`, {
          medicineId: item.medicineId,
          pack: item.pack,
          quantity: item.quantity,
          freepack: item.freepack,
          purchaseCost: item.purchaseCost,
          discount: item.discount,
          mrp: item.mrp,
          formGroup: this.itemsFormArray.at(index)?.value
        });
      });
    }
    
    // Get selected supplier
    const selectedSupplier = this.suppliers.find(s => s.id === formData.supplierId);
    console.log('Selected supplier:', selectedSupplier);
    
    // Prepare request payload with DIRECT ACCESS to form array controls
    const request: CreatePurchaseRequest = {
      supplierId: formData.supplierId,
      invoiceDate: formData.invoiceDate,
      referenceId: formData.referenceId,
      gstType: formData.gst,
      // Add payment fields required by API
      amountPaid: Number(formData.amountPaid || 0),
      paymentMode: formData.paymentMode || 'CASH',
      paymentReference: formData.paymentReference || '',
      items: []
    };
    
    console.log('Including payment details in request:', {
      amountPaid: request.amountPaid,
      paymentMode: request.paymentMode,
      paymentReference: request.paymentReference
    });
    
    // Process each item by directly accessing the form controls
    for (let i = 0; i < this.itemsFormArray.length; i++) {
      const itemGroup = this.itemsFormArray.at(i);
      if (!itemGroup) continue;
      
      const item = itemGroup.value;
      const taxProfile = this.taxProfiles.find(p => p.id === item.taxProfileId);
      
      console.log(`Processing item ${i} with direct form access:`, {
        medicineId: itemGroup.get('medicineId')?.value,
        quantity: itemGroup.get('quantity')?.value,
        purchaseCost: itemGroup.get('purchaseCost')?.value
      });
      
      // Map form controls to DTO fields - exactly matching Java CreatePurchaseRequest.PurchaseItemDto
      const dto: PurchaseItemDto = {
        medicineId: itemGroup.get('medicineId')?.value,
        batchNo: itemGroup.get('batchNo')?.value,
        expiryDate: itemGroup.get('expiryDate')?.value,
        packQuantity: Number(itemGroup.get('packQuantity')?.value || itemGroup.get('quantity')?.value) || 0,
        freePackQuantity: Number(itemGroup.get('freePackQuantity')?.value || itemGroup.get('freepack')?.value) || 0,
        itemsPerPack: Number(itemGroup.get('itemsPerPack')?.value || itemGroup.get('pack')?.value) || 1,
        purchaseCostPerPack: Number(itemGroup.get('purchaseCostPerPack')?.value || itemGroup.get('purchaseCost')?.value) || 0,
        discountPercentage: Number(itemGroup.get('discountPercentage')?.value || itemGroup.get('discount')?.value) || 0,
        mrpPerItem: Number(itemGroup.get('mrpPerItem')?.value || itemGroup.get('mrp')?.value) || 0,
        taxProfileId: formData.gst === 'NON_GST' ? null : itemGroup.get('taxProfileId')?.value
      };
      
      // Only include tax information when the GST type isn't NON_GST
      if (taxProfile && formData.gst !== 'NON_GST') {
        dto.taxRateApplied = taxProfile.totalRate;
        dto.taxComponents = taxProfile.components.map(comp => ({
          name: comp.componentName,
          rate: comp.rate,
          taxAmount: this.calculateTaxComponentAmount(item, comp.rate)
        }));
      } else if (formData.gst === 'NON_GST') {
        dto.taxRateApplied = 0;
        dto.taxComponents = [];
      }
      
      request.items.push(dto);
    }
    
    console.log('Purchase request payload:', request);
    
    // Use either create or update method based on mode
    // Cast the request to any to bypass the type mismatch between interfaces
    // The backend API expects the structure we're providing
    const saveObservable = this.isEditMode && this.purchaseId ? 
      this.inventoryService.updatePurchase(this.purchaseId, request as any) :
      this.inventoryService.createPurchase(request as any);
      
    saveObservable.subscribe({
      next: (response: any) => {
        console.log(`Purchase ${this.isEditMode ? 'updated' : 'created'} successfully`, response);
        this.submitting = false;
        this.router.navigate(['/inventory/purchases']);
      },
      error: (err: any) => {
        console.error(`Error ${this.isEditMode ? 'updating' : 'creating'} purchase`, err);
        this.submitting = false;
      }
    });
  }
  
  /**
   * Delete the current purchase
   */
  deletePurchase(): void {
    if (!this.isEditMode || !this.purchaseId) {
      console.error('Cannot delete: No purchase ID available');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this purchase? This action cannot be undone.')) {
      return;
    }
    
    this.submitting = true;
    
    this.inventoryService.deletePurchase(this.purchaseId).subscribe({
      next: () => {
        console.log('Purchase deleted successfully');
        this.submitting = false;
        this.router.navigate(['/inventory/purchases']);
      },
      error: (err: any) => {
        console.error('Error deleting purchase', err);
        this.submitting = false;
      }
    });
  }


}
