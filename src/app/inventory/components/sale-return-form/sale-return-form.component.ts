import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, finalize } from 'rxjs/operators';

import { InventoryService } from '../../services/inventory.service';
import { ReturnsService } from '../../services/returns.service';
import { ToastService } from '../../../shared/services/toast.service';

/**
 * Define interfaces if not imported elsewhere
 */
// Firestore timestamp format
interface TimestampFormat {
  seconds: number;
  nanos: number;
}

// Enhanced Sale interface with additional properties used in the component
interface Sale {
  id?: string;
  saleId?: string;
  saleDate?: string | Date | TimestampFormat;
  date?: string | Date | TimestampFormat; // Alternative date field
  customerName?: string;
  phoneNumber?: string;
  patientName?: string;    // Patient name field
  patientId?: string;      // Patient ID field
  walkInCustomerName?: string;  // Alternative customer name
  walkInCustomerMobile?: string;  // Alternative phone number
  doctorName?: string;    // Doctor who prescribed
  paymentMode?: string;   // Payment mode
  paymentMethod?: string; // Alternative payment mode field
  grandTotal?: number;    // Total amount of sale
  totalTaxableAmount?: number; // Total amount subject to tax
  totalTaxAmount?: number;     // Total tax amount
  totalMrpAmount?: number;     // Total MRP amount
  totalDiscountAmount?: number; // Total discount amount
  transactionReference?: string; // Transaction reference ID
  gstType?: string;        // GST type (INCLUSIVE, EXCLUSIVE, NON_GST)
  isGstSale?: boolean;
  isGstInclusive?: boolean;
  items: SaleItem[];
  saleType?: string; // Added to match imported model
}

// Enhanced SaleItem interface with additional properties used in the component
interface SaleItem {
  medicineId: string;
  medicineName?: string;
  medicine?: { name: string };
  quantity: number;
  batchNo?: string;
  batchAllocations?: BatchAllocation[];
  mrpPerItem?: number;
  unitPrice?: number;
  salePrice?: number;
  discountPercentage?: number;
  taxProfileId?: string;
  taxRateApplied?: number;
  taxPercentage?: number;
  expiryDate?: string | Date | TimestampFormat;
}

interface BatchAllocation {
  batchNo: string;
  quantity: number;
  expiryDate?: string | Date | TimestampFormat;
  taxProfileId?: string;
}

/**
 * Sale return data transfer objects
 */
interface SaleReturnDto {
  originalSaleId: string;
  returnDate: string;
  reason: string;
  refundAmount: number;
  refundMode: string;
  refundReference?: string;
  overallDiscountPercentage: number;
  items: SaleReturnItemDto[];
}

interface SaleReturnItemDto {
  medicineId: string;
  batchNo: string;
  returnQuantity: number;
  taxProfileId?: string;
}

// Type alias for the return request
type SaleReturnRequest = SaleReturnDto;

@Component({
  selector: 'app-sale-return-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './sale-return-form.component.html',
  styleUrls: ['./sale-return-form.component.css']
})
export class SaleReturnFormComponent implements OnInit {
  returnForm!: FormGroup;
  searchControl!: FormControl;
  saleIdControl!: FormControl;
  isLoading = false;
  selectedSale: Sale | null = null;
  searchResults$: Observable<Sale[]> = of([]);
  saleSearchText = '';
  isSearching = false;
  filteredSales: Sale[] = [];
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private inventoryService: InventoryService, 
    public returnsService: ReturnsService, // Changed to public for template access
    private toastService: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.setupSearchObservables();
    
    // Debug values during lifecycle events
    this.returnForm.valueChanges.subscribe(values => {
      console.log('Form values changed:', {
        originalGrandTotal: values.originalGrandTotal,
        totalTaxableAmount: values.totalTaxableAmount,
        grandTotal: values.grandTotal
      });
    });
  }
  
  /**
   * Submit the form - called from template
   */
  onSubmit(): void {
    // Call the existing submitReturn method
    this.submitReturn();
  }
  
  // Setup search observables for better performance
  setupSearchObservables(): void {
    // Initialize search controls
    this.searchControl = new FormControl('');
    this.saleIdControl = new FormControl('');
    
    // Setup the search with debounce
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      if (value && value.trim().length >= 3) {
        this.searchSales({ target: { value } } as any);
      } else {
        this.filteredSales = [];
      }
    });
    
    // Setup sale ID search
    this.saleIdControl.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(saleId => {
      if (saleId && saleId.trim().length >= 3) {
        this.searchSaleById();
      }
    });
  }

  initForm(): void {
    console.log('Initializing form with default values');
    const today = new Date().toISOString().split('T')[0];
    
    this.returnForm = this.fb.group({
      originalSaleId: ['placeholder-id', Validators.required], // Provide a placeholder that will be replaced when a sale is selected
      returnDate: [today, Validators.required],
      reason: ['Customer changed their mind.', Validators.required], // Default reason
      refundAmount: [0, [Validators.required, Validators.min(0)]],
      refundMode: ['CASH', Validators.required],
      refundReference: [''],
      overallDiscountPercentage: [0],
      totalReturnAmount: [0],
      totalTaxAmount: [0],
      totalDiscountAmount: [0],
      totalBeforeDiscount: [0],
      netRefundAmount: [0],
      cgstTotal: [0],
      sgstTotal: [0],
      gstType: ['NON_GST'],
      grandTotal: [0], // Added to match template binding
      // Sale details for reference
      patientName: [''],
      patientId: [''],
      doctorName: [''],
      saleType: [''],
      originalSaleDate: [''],
      originalGrandTotal: [0],
      totalTaxableAmount: [0],
      notes: [''],
      items: this.fb.array([])
    });
    
    // Log the initial form state
    console.log('Form initialized:', {
      valid: this.returnForm.valid,
      status: this.returnForm.status,
      value: this.returnForm.value
    });
  }

  // Format date for input - handles different date formats
  private formatDateForInput(date: any): string {
    if (!date) {
      return '';
    }
    
    let dateObject: Date;
    
    if (date instanceof Date) {
      dateObject = date;
    } else if (date && typeof date === 'object' && 'seconds' in date) {
      // Handle Firestore timestamp format
      dateObject = new Date(date.seconds * 1000);
    } else if (typeof date === 'string') {
      // Handle string format
      dateObject = new Date(date);
    } else {
      console.warn('Invalid date format:', date);
      return '';
    }
    
    // Check if date is valid
    if (isNaN(dateObject.getTime())) {
      console.warn('Invalid date value:', date);
      return '';
    }
    
    const year = dateObject.getFullYear();
    // Month is 0-indexed, so add 1 and ensure it's padded with leading zero if needed
    const month = (dateObject.getMonth() + 1).toString().padStart(2, '0');
    // Day needs to be padded with leading zero if needed
    const day = dateObject.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }
  


  get itemsArray(): FormArray {
    return this.returnForm.get('items') as FormArray;
  }

  // TrackBy function to help Angular track form array items
  trackByIndex(index: number, item: any): number {
    return index;
  }

  searchSales(event: any): void {
    // Update the search control value, which will trigger the valueChanges observable
    const inputValue = event.target.value;
    this.searchControl.setValue(inputValue);
    this.saleSearchText = inputValue;
  }

  selectSale(sale: Sale): void {
    console.log('Selecting sale:', sale);
    
    // Create a new object with all the properties we need, ensuring proper types
    const processedSale: any = {
      // Base properties
      id: sale.id,
      saleId: sale.saleId,
      customerName: sale.customerName,
      phoneNumber: sale.phoneNumber,
      isGstSale: sale.isGstSale,
      isGstInclusive: sale.isGstInclusive,
      items: [...sale.items],  // Make a copy of items array
      
      // Required properties with defaults if missing
      saleType: sale.saleType || 'OTC',
      
      // Initialize saleDate as undefined
      saleDate: undefined,
      
      // Preserve all monetary fields from the API response
      grandTotal: sale.grandTotal || 0,
      totalTaxableAmount: sale.totalTaxableAmount || 0,
      totalTaxAmount: sale.totalTaxAmount || 0,
      totalMrpAmount: sale.totalMrpAmount || 0,
      totalDiscountAmount: sale.totalDiscountAmount || 0,
      
      // Preserve other important fields
      gstType: sale.gstType || 'NON_GST',
      patientId: sale.patientId || null,
      doctorName: sale.doctorName || 'No Doctor',
      walkInCustomerName: sale.walkInCustomerName || 'Walk-in',
      paymentMode: sale.paymentMode || sale.paymentMethod || 'Not specified',
      transactionReference: sale.transactionReference || 'N/A'
    };
    
    // Special handling for saleDate to ensure it's string or TimestampFormat
    if (sale.saleDate) {
      if (sale.saleDate instanceof Date) {
        // Convert Date to ISO string
        processedSale.saleDate = sale.saleDate.toISOString();
      } else if (typeof sale.saleDate === 'object' && 'seconds' in sale.saleDate) {
        // It's already a TimestampFormat, keep as is
        processedSale.saleDate = sale.saleDate;
      } else if (typeof sale.saleDate === 'string') {
        // It's already a string, keep as is
        processedSale.saleDate = sale.saleDate;
      }
    }
    
    // Use explicit type assertion to satisfy TypeScript
    this.returnsService.enrichSaleWithMedicineNames(processedSale as any).subscribe({
      next: (enrichedSale) => {
        console.log('Sale enriched with medicine names:', enrichedSale);
        this.selectedSale = enrichedSale;
        this.searchControl.setValue('', { emitEvent: false });
        this.saleIdControl.setValue('', { emitEvent: false });
        this.saleSearchText = this.returnsService.formatSaleId(sale.saleId || sale.id || '');
        this.filteredSales = [];
        
        // Call populateSaleData here to ensure form gets updated
        this.populateSaleData(enrichedSale);
        this.isLoading = false;
        // Trigger change detection to ensure UI updates immediately
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error enriching sale with medicine names:', error);
        // Fall back to original behavior
        this.selectedSale = sale;
        this.searchControl.setValue('', { emitEvent: false });
        this.saleIdControl.setValue('', { emitEvent: false });
        this.saleSearchText = this.returnsService.formatSaleId(sale.saleId || sale.id || '');
        this.filteredSales = [];
        // Ensure we handle the sale properly even in error case
        this.populateSaleData(sale);
        this.isLoading = false;
        // Trigger change detection to ensure UI updates immediately
        this.cdr.detectChanges();
      }
    });
  }
  
  /**
   * Search for a sale by its ID directly
   */
  searchSaleById(): void {
    if (!this.saleIdControl.value) {
      return;
    }
    
    this.isSearching = true;
    console.log('Searching for sale by ID:', this.saleIdControl.value);
    let saleId = this.saleIdControl.value.trim();

    // Use the sale ID as-is without adding any prefix
    this.inventoryService.getSaleById(saleId).subscribe({
      next: (sale) => {
        console.log('Sale found:', sale);
        if (sale) {
          // Success - populate the form with type casting to our local Sale interface
          this.selectSale(sale as any as Sale);
        } else {
          // No direct match - try searching all sales
          console.log('No sale found with exact ID, trying broader search...');
          this.searchAllSales(saleId);
        }
      },
      error: (error) => {
        console.error('Error searching for sale by ID:', error);
        this.toastService.showError('Error searching for sale: ' + error.message);
        this.isSearching = false;
      }
    });
  }
  
  /**
   * Fallback search in all sales when direct ID lookup fails
   */
  searchAllSales(saleIdQuery: string): void {
    console.log('Performing general search for:', saleIdQuery);
    this.isSearching = true;
    
    this.returnsService.searchSales(saleIdQuery).subscribe({
      next: (sales) => {
        this.isSearching = false;
        console.log('Sales search returned:', sales);
        
        if (sales && sales.length > 0) {
          // Debug: Print details of the first sale's items
          if (sales[0].items && sales[0].items.length > 0) {
            console.log('First sale items:', sales[0].items);
            console.log('First sale item details:', {
              medicineId: sales[0].items[0].medicineId,
              medicineName: sales[0].items[0].medicineName,
              medicine: sales[0].items[0].medicine,
              batchNo: sales[0].items[0].batchNo,
              quantity: sales[0].items[0].quantity
            });
          }
          
          // Found the sale via general search
          console.log('Selecting first matching sale:', sales[0]);
          this.selectSale(sales[0]);
          this.toastService.showSuccess(`Sale found: ${this.returnsService.formatSaleId(sales[0].saleId || sales[0].id || '')}`);
        } else {
          this.toastService.showError(`No sale found with ID: ${saleIdQuery}`);
        }
      },
      error: (error) => {
        this.isSearching = false;
        console.error('Error searching for sales:', error);
        this.toastService.showError('Error searching for sale');
      }
    });
  }

  /**
   * Populate form with sale data
   */
  populateSaleData(sale: Sale): void {
    // Log the raw sale object to see exactly what's coming from the API
    console.log('DEBUGGING - RAW SALE OBJECT:', sale);
    console.log('DEBUGGING - STRINGIFIED SALE:', JSON.stringify(sale, null, 2));
    console.log('DEBUGGING - DOCTOR NAME:', sale.doctorName);
    console.log('DEBUGGING - MONETARY VALUES:', {
      grandTotal: sale.grandTotal,
      totalTaxableAmount: sale.totalTaxableAmount,
      totalTaxAmount: sale.totalTaxAmount,
      totalMrpAmount: sale.totalMrpAmount,
      totalDiscountAmount: sale.totalDiscountAmount
    });
    
    this.selectedSale = sale;
    
    // Clear existing items
    while (this.itemsArray.length !== 0) {
      this.itemsArray.removeAt(0);
    }
    
    // Direct access to the API response fields based on the provided structure
    console.log('Accessing API response fields directly from root level');
    
    // Extract fields directly from the root level as shown in the API response
    const gstType = (sale as any).gstType || 'NON_GST';
    const totalTaxableAmount = (sale as any).totalTaxableAmount || 0;
    const totalDiscountAmount = (sale as any).totalDiscountAmount || 0;
    const grandTotal = (sale as any).grandTotal || 0;
    
    console.log('Direct field extraction from API:', {
      gstType,
      totalTaxableAmount,
      totalDiscountAmount,
      grandTotal
    });
    
    // Ensure the values are available to the template even if interface doesn't define them
    // These are cast to any to avoid TypeScript errors since they're not in the Sale interface
    (this.selectedSale as any).totalTaxableAmount = totalTaxableAmount;
    (this.selectedSale as any).totalDiscountAmount = totalDiscountAmount;
    (this.selectedSale as any).grandTotal = grandTotal;
    
    console.log('Final extracted values from sale:', {
      gstType, 
      totalDiscountAmount, 
      totalTaxableAmount, 
      grandTotal
    });
    
    // Update sale details in the form
    this.returnForm.patchValue({
      originalSaleId: sale.id || sale.saleId || '',
      saleDate: sale.saleDate ? this.formatDateForInput(sale.saleDate) : '',
      returnDate: this.formatDateForInput(new Date()),
      customerName: sale.customerName || '',
      phoneNumber: sale.phoneNumber || '',
      isGstSale: sale.isGstSale || false,
      gstType: gstType,
      totalDiscountAmount: totalDiscountAmount,
      totalTaxableAmount: totalTaxableAmount,
      originalGrandTotal: grandTotal,
      grandTotal: grandTotal // Added to match template binding
    });
    
    // Verify form values after patching
    console.log('Form values after patching:', {
      originalGrandTotal: this.returnForm.get('originalGrandTotal')?.value,
      totalTaxableAmount: this.returnForm.get('totalTaxableAmount')?.value,
      gstType: this.returnForm.get('gstType')?.value
    });
    
    // Ensure the sale has items
    if (sale.items && Array.isArray(sale.items) && sale.items.length > 0) {
      console.log(`Processing ${sale.items.length} items from sale`);
      
      // Add each item to the form array
      sale.items.forEach(item => {
        const formGroup = this.createItemFormGroup(item);
        this.itemsArray.push(formGroup);
      });
      
      // Double-check values in the form before calculations
      console.log('API-extracted values to be preserved:', {
        totalTaxableAmount,
        grandTotal
      });
      
      // Force the values in the form again to ensure they're set
      this.returnForm.patchValue({
        totalTaxableAmount: totalTaxableAmount,
        originalGrandTotal: grandTotal,
        grandTotal: grandTotal
      }, { emitEvent: false }); // Don't trigger valueChanges
      
      // Save the values to ensure they're preserved through calculations
      const originalGrandTotal = grandTotal;
      
      console.log('Form values before calculation:', {
        originalGrandTotal: this.returnForm.get('originalGrandTotal')?.value,
        totalTaxableAmount: this.returnForm.get('totalTaxableAmount')?.value,
        grandTotal: this.returnForm.get('grandTotal')?.value
      });
      
      // Update return totals
      this.calculateReturnTotals();
      
      // Force restore the API values to ensure they're displayed correctly
      this.returnForm.patchValue({
        originalGrandTotal: originalGrandTotal,
        totalTaxableAmount: totalTaxableAmount,
        grandTotal: originalGrandTotal
      }, { emitEvent: false }); // Don't trigger valueChanges
      
      console.log('Final form values after restoration:', {
        originalGrandTotal: this.returnForm.get('originalGrandTotal')?.value,
        totalTaxableAmount: this.returnForm.get('totalTaxableAmount')?.value,
        grandTotal: this.returnForm.get('grandTotal')?.value
      });
      
      // Try explicitly marking controls as touched and dirty to trigger change detection
      this.returnForm.get('grandTotal')?.markAsTouched();
      this.returnForm.get('totalTaxableAmount')?.markAsTouched();
      this.returnForm.get('originalGrandTotal')?.markAsTouched();
      
      // Force change detection
      this.cdr.detectChanges();
      
      // Second round of debugging to ensure values persist
      setTimeout(() => {
        console.log('Values after timeout:', {
          grandTotal: this.returnForm.get('grandTotal')?.value,
          totalTaxableAmount: this.returnForm.get('totalTaxableAmount')?.value,
          originalGrandTotal: this.returnForm.get('originalGrandTotal')?.value
        });
      }, 100);
    } else {
      console.warn('Sale has no items');
    }
  }
  
  /**
   * Create a form group for a sale item
   */
  createItemFormGroup(item: any): FormGroup {
    console.log('Creating form group for item:', JSON.stringify(item, null, 2));
    
    // Get medicine details
    const medicineId = item.medicineId || '';
    const medicineName = item.medicineName || item.medicine?.name || 'Unknown Medicine';
    
    // Extract batch details
    let batchNo = '';
    let expiryDate = '';
    let taxProfileId = '';
    
    // Try to get batch details from batchAllocations first
    if (item.batchAllocations && Array.isArray(item.batchAllocations) && item.batchAllocations.length > 0) {
      console.log(`Item has ${item.batchAllocations.length} batch allocations`);
      const firstBatch = item.batchAllocations[0];
      console.log('First batch allocation:', JSON.stringify(firstBatch, null, 2));
      
      // Extract batch number
      batchNo = firstBatch.batchNo || '';
      console.log('Extracted batchNo:', batchNo);
      
      // Extract tax profile id either from batch or item
      taxProfileId = firstBatch.taxProfileId || item.taxProfileId || 'N/A';
      console.log('Extracted taxProfileId:', taxProfileId);
      
      // Extract expiry date handling different formats
      if (firstBatch.expiryDate) {
        // Handle Firestore timestamp format
        if (firstBatch.expiryDate.seconds) {
          const date = new Date(firstBatch.expiryDate.seconds * 1000);
          expiryDate = date.toISOString().split('T')[0];
          console.log(`Extracted expiryDate from timestamp: ${expiryDate}`);
        }
        // Handle string format
        else if (typeof firstBatch.expiryDate === 'string') {
          expiryDate = firstBatch.expiryDate;
          console.log(`Using string expiryDate: ${expiryDate}`);
        }
        // Handle Date object
        else if (firstBatch.expiryDate instanceof Date) {
          expiryDate = firstBatch.expiryDate.toISOString().split('T')[0];
          console.log(`Converted Date expiryDate to string: ${expiryDate}`);
        }
      }
    } else {
      // Fallbacks if no batch allocations found
      console.log('No batchAllocations found, using direct properties');
      batchNo = item.batchNo || '';
      taxProfileId = item.taxProfileId || 'N/A';
      
      // Try to extract expiry date from item
      if (item.expiryDate) {
        if (typeof item.expiryDate === 'string') {
          expiryDate = new Date(item.expiryDate).toISOString().split('T')[0];
        } else if (item.expiryDate.seconds) {
          const date = new Date(item.expiryDate.seconds * 1000);
          expiryDate = date.toISOString().split('T')[0];
        } else if (item.expiryDate instanceof Date) {
          expiryDate = item.expiryDate.toISOString().split('T')[0];
        }
      }
      
      console.log(`Using fallbacks: batchNo=${batchNo}, expiryDate=${expiryDate}, taxProfileId=${taxProfileId}`);
    }
    
    // Ensure we have reasonable defaults for all fields
    const quantity = item.quantity || 0;
    const unitPrice = item.mrpPerItem || item.unitPrice || item.salePrice || 0;
    const discountPercentage = item.discountPercentage || 0;
    const taxRate = item.taxRateApplied || item.taxPercentage || 0;
    
    // Get line item amounts or calculate if not available
    const lineItemDiscountAmount = item.lineItemDiscountAmount || (unitPrice * quantity * discountPercentage / 100) || 0;
    const lineItemTotalAmount = item.lineItemTotalAmount || ((quantity * unitPrice) - lineItemDiscountAmount) || 0;
    const lineItemTaxAmount = item.taxAmount || item.lineItemTaxAmount || 0;
    
    // Calculate CGST and SGST - Split the tax amount equally for GST
    const cgstAmount = taxRate > 0 ? lineItemTaxAmount / 2 : 0;
    const sgstAmount = taxRate > 0 ? lineItemTaxAmount / 2 : 0;
    
    // Create form group with all fields
    const formGroup = this.fb.group({
      medicineId: [medicineId, Validators.required],
      medicineName: [medicineName],
      batchNo: [batchNo, Validators.required],
      expiryDate: [expiryDate],
      quantity: [quantity],
      unitPrice: [unitPrice],
      returnQuantity: [0, [Validators.required, Validators.min(0), Validators.max(quantity)]],
      returnValue: [0],
      taxProfileId: [taxProfileId],
      discountPercentage: [discountPercentage],
      taxRate: [taxRate],
      cgstAmount: [cgstAmount],
      sgstAmount: [sgstAmount],
      lineItemTotalAmount: [lineItemTotalAmount],
      lineItemTaxAmount: [lineItemTaxAmount],
      originalQuantity: [quantity],
      originalUnitPrice: [unitPrice],
      originalLineTotal: [lineItemTotalAmount],
      batchAllocations: [item.batchAllocations || []]
    });
  
  // Log the created form group values for debugging
  console.log('Form group created with values:', {
    medicineId: formGroup.get('medicineId')?.value,
    medicineName: formGroup.get('medicineName')?.value,
    batchNo: formGroup.get('batchNo')?.value,
    expiryDate: formGroup.get('expiryDate')?.value,
    taxProfileId: formGroup.get('taxProfileId')?.value
  });
  
  // Subscribe to return quantity changes to update return value
  formGroup.get('returnQuantity')?.valueChanges.subscribe(quantity => {
    if (quantity && quantity > 0) {
      const returnValue = this.calculateReturnValue(formGroup);
      formGroup.get('returnValue')?.setValue(returnValue, { emitEvent: false });
      this.calculateReturnTotals();
    } else {
      formGroup.get('returnValue')?.setValue(0, { emitEvent: false });
      this.calculateReturnTotals();
    }
  });
  
  return formGroup;
}
  
  // Helper method to mark all controls as touched to trigger validation
  markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
      
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
  
  /**
   * Reset the form to its initial state
   */
  resetForm(): void {
    // Clear the selected sale
    this.selectedSale = null;
    
    // Reset the search controls
    this.searchControl.reset('');
    this.saleIdControl.reset('');
    this.filteredSales = [];
    
    // Clear form
    this.initForm();
    
    this.toastService.showInfo('Form has been reset');
  }
  
  // Submit the sale return form
  submitReturn(): void {
    this.isSubmitting = true;
    console.log('Starting sale return submission...');
    
    // Validate form first
    if (this.returnForm.invalid) {
      this.markFormGroupTouched(this.returnForm);
      this.toastService.showError('Please fix the errors in the form before submitting.');
      this.isSubmitting = false;
      return;
    }
    
    const formData = this.returnForm.value;
    console.log('Form data for submission:', formData);
    
    // Filter out items with zero return quantity and ensure batchNo is properly mapped
    const returnItems: SaleReturnItemDto[] = formData.items
      .filter((item: any) => item.returnQuantity > 0)
      .map((item: any) => {
        console.log('Processing item for return:', item);
        
        // Make sure we have a valid batchNo
        if (!item.batchNo) {
          console.log('Missing batchNo for item:', item);
          // Generate default batch number if missing
          item.batchNo = `AUTO-${item.medicineId}-${Date.now()}`;
        }
        
        // Return the mapped item with required properties
        return {
          medicineId: item.medicineId,
          batchNo: item.batchNo,
          returnQuantity: item.returnQuantity,
          taxProfileId: item.taxProfileId
        };
      });
      
    if (returnItems.length === 0) {
      this.toastService.showError('Please select at least one item to return');
      this.isSubmitting = false;
      return;
    }
    
    // Calculate final refund amount
    const refundAmount = this.calculateRefundAmount(returnItems);
    
    // Create the sale return request
    const saleReturn: SaleReturnDto = {
      originalSaleId: formData.originalSaleId,
      returnDate: formData.returnDate,
      reason: formData.reason || 'Customer return',
      refundAmount: refundAmount,
      refundMode: formData.refundMode || 'Cash',
      refundReference: formData.refundReference,
      overallDiscountPercentage: formData.overallDiscountPercentage || 0,
      items: returnItems
    };
    
    console.log('Submitting sale return:', saleReturn);
    
    // Call the service to process the return
    this.returnsService.createSaleReturn(saleReturn).subscribe({
      next: () => {
        this.toastService.showSuccess('Sale return processed successfully');
        this.isSubmitting = false;
        this.router.navigate(['/inventory/returns']);
      },
      error: (error: any) => {
        console.error('Error submitting return:', error);
        this.toastService.showError('Failed to process sale return: ' + (error.error?.message || error.message || 'Unknown error'));
        this.isSubmitting = false;
      }
    });
  }
  
  /**
   * Calculate the total return amount based on item quantities and prices
   * Called from template when return quantities change
   */
  calculateTotalReturnAmount(): void {
    this.calculateReturnTotals();
  }
  
  /**
   * Get the count of items being returned (where quantity > 0)
   * Used in the template for display
   */
  getItemsToReturnCount(): number {
    if (!this.itemsArray || this.itemsArray.length === 0) {
      return 0;
    }
    
    return this.itemsArray.controls
      .filter(control => (control as FormGroup).get('returnQuantity')?.value > 0)
      .length;
  }
  
  /**
   * Calculate return value for a single item form group
   */
  calculateReturnValue(formGroup: FormGroup): number {
    const returnQuantity = formGroup.get('returnQuantity')?.value || 0;
    const unitPrice = formGroup.get('unitPrice')?.value || 0;
    const discountPercentage = formGroup.get('discountPercentage')?.value || 0;
    const taxRate = formGroup.get('taxRate')?.value || 0;
    const gstType = this.returnForm.get('gstType')?.value || 'NON_GST';
    
    if (returnQuantity <= 0 || unitPrice <= 0) {
      return 0;
    }
    
    // Calculate basic return value based on quantity and price
    let returnValue = returnQuantity * unitPrice;
    
    // Calculate discount amount
    const discountAmount = (discountPercentage > 0) ? (returnValue * discountPercentage / 100) : 0;
    
    // Apply discount
    returnValue = returnValue - discountAmount;
    
    // Apply tax based on GST type
    if (gstType === 'EXCLUSIVE' && taxRate > 0) {
      // For EXCLUSIVE GST, add tax to the amount after discount
      returnValue = returnValue * (1 + taxRate / 100);
    } else if (gstType === 'INCLUSIVE') {
      // For INCLUSIVE GST, tax is already included in the price
      // No additional calculation needed for return value
    }
    
    // Round to 2 decimal places
    return Math.round(returnValue * 100) / 100;
  }

  /**
   * Calculate totals across all return items
   */
  calculateReturnTotals(): void {
    // Initialize totals
    let totalRefundAmount = 0;
    let totalBeforeDiscount = 0;
    let totalTaxAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalDiscountAmount = 0;
    let totalQuantity = 0;
    
    // Get GST type from form
    const gstType = this.returnForm.get('gstType')?.value || 'NON_GST';
    
    if (!this.itemsArray || this.itemsArray.length === 0) {
      // Set zeros for all totals
      this.returnForm.patchValue({
        refundAmount: 0,
        totalReturnAmount: 0,
        totalTaxAmount: 0,
        cgstTotal: 0,
        sgstTotal: 0,
        totalDiscountAmount: 0,
        netRefundAmount: 0,
        totalBeforeDiscount: 0
      });
      return;
    }
    
    // Calculate totals from each item
    for (let i = 0; i < this.itemsArray.length; i++) {
      const itemGroup = this.itemsArray.at(i) as FormGroup;
      const returnQuantity = itemGroup.get('returnQuantity')?.value || 0;
      
      if (returnQuantity > 0) {
        const unitPrice = itemGroup.get('unitPrice')?.value || 0;
        const discountPercentage = itemGroup.get('discountPercentage')?.value || 0;
        const taxRate = itemGroup.get('taxRate')?.value || 0;
        
        // Calculate basic amount before any discounts
        const basicAmount = returnQuantity * unitPrice;
        totalBeforeDiscount += basicAmount;
        
        // Calculate discount amount
        const discountAmount = basicAmount * (discountPercentage / 100);
        totalDiscountAmount += discountAmount;
        
        // Calculate amount after discount
        const afterDiscountAmount = basicAmount - discountAmount;
        
        // Get tax profile ID for this line item
        const taxProfileId = itemGroup.get('taxProfileId')?.value || '';
        console.log(`Processing tax for item with taxProfileId: ${taxProfileId}, taxRate: ${taxRate}`);
        
        // Calculate tax amounts based on GST type
        let taxAmount = 0;
        if (gstType === 'INCLUSIVE' && taxRate > 0) {
          // For inclusive GST, tax is already in the price
          // Extract tax from the after-discount amount
          taxAmount = afterDiscountAmount - (afterDiscountAmount / (1 + taxRate / 100));
        } else if (gstType === 'EXCLUSIVE' && taxRate > 0) {
          // For exclusive GST, calculate tax on top
          taxAmount = afterDiscountAmount * (taxRate / 100);
        }
        
        totalTaxAmount += taxAmount;
        
        // Calculate final value - should be the taxable amount (without tax)
        let finalAmount = afterDiscountAmount; // Just the amount after discount, without tax
        
        // Add to total refund amount
        totalRefundAmount += finalAmount;
        totalQuantity += returnQuantity;
        
        // Update return value for the item
        itemGroup.patchValue({
          returnValue: Math.round(finalAmount * 100) / 100
        }, { emitEvent: false });
        
        // Calculate tax distribution based on tax profile
        if (taxAmount > 0) {
          // Check if the tax profile indicates inter-state (IGST) or intra-state (CGST+SGST)
          // This should ideally come from the tax profile in a real app
          const isInterState = taxProfileId.includes('IGST') || taxProfileId.includes('INTER_STATE');
          
          let cgst = 0;
          let sgst = 0;
          let igst = 0;
          
          if (isInterState) {
            // Inter-state supply: Apply full tax as IGST
            igst = taxAmount;
            console.log(`Inter-state supply: IGST = ${igst}`);
          } else {
            // Intra-state supply: Split tax equally between CGST and SGST
            cgst = taxAmount / 2;
            sgst = taxAmount / 2;
            console.log(`Intra-state supply: CGST = ${cgst}, SGST = ${sgst}`);
          }
          
          totalCgst += cgst;
          totalSgst += sgst;
          totalIgst += igst;
          
          // Update individual item tax values
          itemGroup.patchValue({
            cgstAmount: Math.round(cgst * 100) / 100,
            sgstAmount: Math.round(sgst * 100) / 100,
            igstAmount: Math.round(igst * 100) / 100
          }, { emitEvent: false });
        }
      }
    }
    
    // Round values to 2 decimal places
    totalRefundAmount = Math.round(totalRefundAmount * 100) / 100;
    totalBeforeDiscount = Math.round(totalBeforeDiscount * 100) / 100;
    totalTaxAmount = Math.round(totalTaxAmount * 100) / 100;
    totalCgst = Math.round(totalCgst * 100) / 100;
    totalSgst = Math.round(totalSgst * 100) / 100;
    totalDiscountAmount = Math.round(totalDiscountAmount * 100) / 100;
    
    // Get original sale values to preserve them
    const originalGrandTotal = this.returnForm.get('originalGrandTotal')?.value;
    const totalTaxableAmount = this.returnForm.get('totalTaxableAmount')?.value;
    const grandTotal = this.returnForm.get('grandTotal')?.value;
    
    console.log('Preserving original sale values:', { originalGrandTotal, totalTaxableAmount, grandTotal });
    
    // Update form totals while preserving original sale values
    this.returnForm.patchValue({
      refundAmount: totalRefundAmount,
      totalReturnAmount: totalRefundAmount,
      totalBeforeDiscount: totalBeforeDiscount,
      totalTaxAmount: totalTaxAmount,
      cgstTotal: totalCgst,
      sgstTotal: totalSgst,
      igstTotal: totalIgst,
      totalDiscountAmount: totalDiscountAmount,
      netRefundAmount: totalRefundAmount - totalTaxAmount,
      
      // Preserve the original sale values
      originalGrandTotal: originalGrandTotal,
      totalTaxableAmount: totalTaxableAmount,
      grandTotal: grandTotal
    });
    
    // Log after patching to verify values are preserved
    console.log('Form values after recalculation:', {
      originalGrandTotal: this.returnForm.get('originalGrandTotal')?.value,
      totalTaxableAmount: this.returnForm.get('totalTaxableAmount')?.value,
      grandTotal: this.returnForm.get('grandTotal')?.value
    });
  }

  /**
   * Calculate refund amount based on returned items
   */
  private calculateRefundAmount(items: SaleReturnItemDto[]): number {
    if (!items || items.length === 0 || !this.selectedSale?.items) {
      return 0;
    }
    
    let totalRefund = 0;
    
    // Calculate refund based on returned items
    items.forEach(returnItem => {
      // Find original sale item
      const originalItem = this.selectedSale!.items.find(item => {
        // Basic match on medicineId
        const medicineIdMatch = item.medicineId === returnItem.medicineId;
        
        // Check batch match if applicable
        let batchMatch = true;
        if (returnItem.batchNo) {
          // First check direct batch match
          batchMatch = item.batchNo === returnItem.batchNo;
          
          // Then check in batch allocations if available and no direct match
          if (!batchMatch && (item as any).batchAllocations && Array.isArray((item as any).batchAllocations)) {
            batchMatch = (item as any).batchAllocations.some((batch: any) => batch.batchNo === returnItem.batchNo);
          }
        }
        
        return medicineIdMatch && batchMatch;
      });
      
      if (originalItem) {
        // Get the unit price
        const unitPrice = originalItem.mrpPerItem || originalItem.unitPrice || originalItem.salePrice || 0;
        
        // Calculate basic refund
        let itemRefund = returnItem.returnQuantity * unitPrice;
        
        // Apply discount if any
        if (originalItem.discountPercentage) {
          itemRefund = itemRefund * (1 - originalItem.discountPercentage / 100);
        }
        
        totalRefund += itemRefund;
      }
    });
    
    // Round to 2 decimal places
    return Math.round(totalRefund * 100) / 100;
  }
  
  // Helper method to get FormGroup from AbstractControl
  getFormGroup(control: AbstractControl): FormGroup {
    return control as FormGroup;
  }
  
  // Helper method to format date for display
  formatDate(dateValue: string | Date | TimestampFormat | undefined): string {
    if (!dateValue) return '';
    
    if (typeof dateValue === 'string') {
      return new Date(dateValue).toLocaleDateString('en-GB');
    } else if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString('en-GB');
    } else if (dateValue && 'seconds' in dateValue) {
      return new Date(dateValue.seconds * 1000).toLocaleDateString('en-GB');
    }
    
    return '';
  }
  
  // Helper method to get safe date for Angular date pipe
  getSafeDate(dateValue: string | Date | TimestampFormat | undefined): Date | null {
    if (!dateValue) return null;
    
    if (typeof dateValue === 'string') {
      return new Date(dateValue);
    } else if (dateValue instanceof Date) {
      return dateValue;
    }
    
    // Format timestamp
    if (dateValue && typeof dateValue === 'object' && 'seconds' in dateValue) {
      return new Date(dateValue.seconds * 1000);
    }
    
    return null;
  }
  
  // Safe method for formatting dates in template to prevent errors
  formatSaleDate(dateValue: any): string {
    if (!dateValue) {
      return 'N/A';
    }
    
    let dateObject: Date | null = null;
    
    if (dateValue instanceof Date) {
      dateObject = dateValue;
    } else if (typeof dateValue === 'string') {
      dateObject = new Date(dateValue);
    } else if (dateValue && typeof dateValue === 'object' && 'seconds' in dateValue) {
      // Handle Firestore timestamp format
      dateObject = new Date(dateValue.seconds * 1000);
    }
    
    if (!dateObject || isNaN(dateObject.getTime())) {
      console.warn('Invalid date value:', dateValue);
      return 'Invalid Date';
    }
    
    // Format as DD/MM/YYYY
    return dateObject.toLocaleDateString('en-GB');
  }
}
