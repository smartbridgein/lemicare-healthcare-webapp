import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, finalize } from 'rxjs/operators';

import { InventoryService } from '../../services/inventory.service';
import { ReturnsService, SaleReturnRequest, SaleReturnItemDto } from '../../services/returns.service';
import { Sale } from '../../models/inventory.models';
import { ToastService } from '../../../shared/services/toast.service';

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
    this.returnForm = this.fb.group({
      originalSaleId: ['', Validators.required],
      returnDate: [new Date().toISOString().split('T')[0], Validators.required],
      reason: ['', Validators.required],
      refundAmount: [0, [Validators.required, Validators.min(0)]],
      refundMode: ['CASH', Validators.required],
      refundReference: [''],
      overallDiscountPercentage: [0],
      totalReturnAmount: [0],
      totalTaxAmount: [0],
      totalDiscountAmount: [0],
      netRefundAmount: [0],
      // Sale details for reference
      patientName: [''],
      patientId: [''],
      doctorName: [''],
      saleType: [''],
      originalSaleDate: [''],
      originalGrandTotal: [0],
      notes: [''],
      items: this.fb.array([])
    });
  }

  // Format date for input
  formatDateForInput(date: Date): string {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
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
    console.log('Selected sale:', sale);
    
    // Show loading indicator
    this.isLoading = true;
    
    // Use the returns service to enrich the sale with medicine names
    this.returnsService.enrichSaleWithMedicineNames(sale).subscribe({
      next: (enrichedSale) => {
        console.log('Sale enriched with medicine names:', enrichedSale);
        this.selectedSale = enrichedSale;
        this.searchControl.setValue('', { emitEvent: false });
        this.saleIdControl.setValue('', { emitEvent: false });
        this.saleSearchText = this.returnsService.formatSaleId(sale.saleId || sale.id || '');
        this.filteredSales = [];
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
    const saleId = this.saleIdControl.value;
    if (!saleId || saleId.trim() === '') {
      this.toastService.showError('Please enter a sale ID to search');
      return;
    }
    
    this.isSearching = true;
    
    // Use the sale ID as-is without adding any prefix
    let formattedSaleId = saleId.trim();
    
    console.log('Searching for sale with ID:', formattedSaleId);
    
    // Use the improved getSaleById method that does local filtering
    this.returnsService.getSaleById(formattedSaleId).subscribe({
      next: (sale) => {
        this.isSearching = false;
        if (sale) {
          console.log('Sale found by ID, populating form:', sale);
          this.selectSale(sale);
          this.toastService.showSuccess(`Sale found: ${this.returnsService.formatSaleId(sale.saleId || sale.id || '')}`);
        } else {
          console.log('No sale found by direct ID match, trying general search');
          // Try fallback search method if direct lookup fails
          this.searchAllSales(formattedSaleId);
        }
      },
      error: (error) => {
        console.error('Error searching for sale by ID:', error);
        // Try fallback search method if direct lookup fails with error
        this.searchAllSales(formattedSaleId);
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
  private populateSaleData(sale: Sale): void {
    // Set the sale ID in the form
    this.returnForm.patchValue({
      originalSaleId: sale.saleId || sale.id // Handle both API response formats
    });

    // Clear any existing item form groups
    while (this.itemsArray.length !== 0) {
      this.itemsArray.removeAt(0);
    }

    // Create form groups for each item in the sale
    if (sale.items && sale.items.length > 0) {
      // Debug sale items
      console.log('Sale items to populate:', sale.items);
      
      sale.items.forEach(item => {
        // Get the medicine name with proper fallbacks
        const medicineName = item.medicineName || 
                            (item as any).medicine?.name || 
                            `Medicine ${item.medicineId ? item.medicineId.split('_')[1]?.substring(0, 8) : ''}`;
        
        // Handle both the original format and the new API format
        const formattedItem = {
          medicineId: item.medicineId,
          medicineName: medicineName,
          batchNo: item.batchNo || '',
          quantity: item.quantity, // Match the expected property name
          unitPrice: (item as any).mrpPerItem || item.unitPrice || 0,
          returnQuantity: 0
        };
        
        console.log('Adding item to form array:', formattedItem);
        const formGroup = this.createItemFormGroup(formattedItem as any);
        console.log('Form group created with values:', {
          quantity: formGroup.get('quantity')?.value,
          unitPrice: formGroup.get('unitPrice')?.value,
          medicineName: formGroup.get('medicineName')?.value
        });
        
        // Force form controls to recognize their values
        formGroup.get('quantity')?.markAsDirty();
        formGroup.get('quantity')?.updateValueAndValidity();
        formGroup.get('unitPrice')?.markAsDirty();
        formGroup.get('unitPrice')?.updateValueAndValidity();
        formGroup.get('medicineName')?.markAsDirty();
        formGroup.get('medicineName')?.updateValueAndValidity();
        
        this.itemsArray.push(formGroup);
      });
      
      // Trigger change detection to ensure items are displayed immediately
      this.cdr.detectChanges();
      
      // Force the form array to update by marking it as dirty and updating validity
      this.itemsArray.markAsDirty();
      this.itemsArray.updateValueAndValidity();
      
      // Additional change detection after a short delay to ensure all values are rendered
      setTimeout(() => {
        this.cdr.detectChanges();
        // Force update of all form controls in the array
        this.itemsArray.controls.forEach((control, index) => {
          control.markAsDirty();
          control.updateValueAndValidity();
          console.log(`Item ${index} values:`, {
            quantity: control.get('quantity')?.value,
            unitPrice: control.get('unitPrice')?.value,
            medicineName: control.get('medicineName')?.value
          });
        });
        console.log('Secondary change detection triggered for form values');
      }, 0);
      
      console.log('Form array populated with', this.itemsArray.length, 'items');
    }
    
    // Update customer info if available
    if (sale && typeof sale === 'object') {
      if ('walkInCustomerName' in sale) {
        this.returnForm.patchValue({
          customerName: (sale as any).walkInCustomerName || 'Walk-in Customer',
          customerMobile: (sale as any).walkInCustomerMobile || ''
        });
      } else if ('patientName' in sale) {
        this.returnForm.patchValue({
          customerName: (sale as any).patientName,
          customerMobile: (sale as any).phoneNumber || ''
        });
      }
    }
    // No need to recreate the main form here, just update specific fields
    this.returnForm.patchValue({
      originalSaleId: sale.saleId || sale.id,
      returnDate: new Date().toISOString().split('T')[0],
      overallDiscountPercentage: 0
    });
  }

  // Create a form group for an individual sale item
  createItemFormGroup(item: any): FormGroup {
    console.log('Creating item form group with data:', item);
    
    // Extract comprehensive item data
    const medicineId = item.medicineId || '';
    const medicineName = item.medicineName || item.medicine?.name || `Medicine ${medicineId.substring(0, 8)}`;
    const batchNo = item.batchNo || '';
    const quantity = item.quantity || 0;
    const unitPrice = item.mrpPerItem || item.unitPrice || item.salePrice || 0;
    const discountPercentage = item.discountPercentage || 0;
    const taxRate = item.taxRateApplied || item.taxPercentage || 0;
    const lineItemTotalAmount = item.lineItemTotalAmount || 0;
    const lineItemTaxAmount = item.lineItemTaxAmount || 0;
    const lineItemDiscountAmount = item.lineItemDiscountAmount || item.discountAmount || 0;
    
    const formGroup = this.fb.group({
      medicineId: [medicineId, Validators.required],
      medicineName: [medicineName],
      batchNo: [batchNo],
      quantity: [quantity],
      unitPrice: [unitPrice],
      returnQuantity: [0, [Validators.required, Validators.min(0), Validators.max(quantity)]],
      returnValue: [0],
      // Additional fields for proper calculations
      discountPercentage: [discountPercentage],
      taxRate: [taxRate],
      lineItemTotalAmount: [lineItemTotalAmount],
      lineItemTaxAmount: [lineItemTaxAmount],
      lineItemDiscountAmount: [lineItemDiscountAmount],
      expiryDate: [item.expiryDate || ''],
      // Original sale data for reference
      originalQuantity: [quantity],
      originalUnitPrice: [unitPrice],
      originalLineTotal: [lineItemTotalAmount]
    });
    
    // Set up value change listeners for automatic calculations
    formGroup.get('returnQuantity')?.valueChanges.subscribe((returnQty: number | null) => {
      if (returnQty !== null && returnQty !== undefined && returnQty >= 0) {
        this.calculateReturnValue(formGroup, returnQty);
        this.calculateTotalReturnAmount();
      }
    });
    
    return formGroup;
  }
  
  // Calculate return value for a specific item
  calculateReturnValue(formGroup: FormGroup, returnQuantity: number): void {
    const unitPrice = formGroup.get('unitPrice')?.value || 0;
    const discountPercentage = formGroup.get('discountPercentage')?.value || 0;
    const taxRate = formGroup.get('taxRate')?.value || 0;
    
    // Calculate base return value (unit price * return quantity)
    let returnValue = unitPrice * returnQuantity;
    
    // Apply discount if any
    if (discountPercentage > 0) {
      returnValue = returnValue * (1 - discountPercentage / 100);
    }
    
    // Add tax if applicable (for sales, tax is usually included in MRP)
    // For returns, we typically return the amount customer paid
    if (taxRate > 0) {
      // Tax calculation depends on whether it was inclusive or exclusive in original sale
      // For simplicity, we'll use the line item total amount if available
      const originalLineTotal = formGroup.get('lineItemTotalAmount')?.value;
      if (originalLineTotal > 0) {
        const originalQuantity = formGroup.get('originalQuantity')?.value || 1;
        returnValue = (originalLineTotal / originalQuantity) * returnQuantity;
      }
    }
    
    // Update the return value in the form
    formGroup.patchValue({ returnValue: Math.round(returnValue * 100) / 100 });
  }
  
  // Calculate total return amount for all items
  calculateTotalReturnAmount(): void {
    let totalReturnAmount = 0;
    let totalTaxAmount = 0;
    let totalDiscountAmount = 0;
    
    this.itemsArray.controls.forEach(control => {
      const returnValue = control.get('returnValue')?.value || 0;
      const returnQuantity = control.get('returnQuantity')?.value || 0;
      const taxRate = control.get('taxRate')?.value || 0;
      const discountPercentage = control.get('discountPercentage')?.value || 0;
      const unitPrice = control.get('unitPrice')?.value || 0;
      
      totalReturnAmount += returnValue;
      
      // Calculate tax amount for this item
      if (taxRate > 0 && returnQuantity > 0) {
        const taxAmount = (unitPrice * returnQuantity * taxRate) / 100;
        totalTaxAmount += taxAmount;
      }
      
      // Calculate discount amount for this item
      if (discountPercentage > 0 && returnQuantity > 0) {
        const discountAmount = (unitPrice * returnQuantity * discountPercentage) / 100;
        totalDiscountAmount += discountAmount;
      }
    });
    
    // Apply overall discount if any
    const overallDiscountPercentage = this.returnForm.get('overallDiscountPercentage')?.value || 0;
    let netRefundAmount = totalReturnAmount;
    
    if (overallDiscountPercentage > 0) {
      const overallDiscountAmount = (totalReturnAmount * overallDiscountPercentage) / 100;
      netRefundAmount = totalReturnAmount - overallDiscountAmount;
      totalDiscountAmount += overallDiscountAmount;
    }
    
    // Update the form with calculated totals
    this.returnForm.patchValue({ 
      totalReturnAmount: Math.round(totalReturnAmount * 100) / 100,
      totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
      totalDiscountAmount: Math.round(totalDiscountAmount * 100) / 100,
      netRefundAmount: Math.round(netRefundAmount * 100) / 100,
      refundAmount: Math.round(netRefundAmount * 100) / 100
    });
  }
  
  // Check if there are items to return
  hasItemsToReturn(): boolean {
    return this.itemsArray.controls.some(
      control => (control.get('returnQuantity')?.value || 0) > 0
    );
  }
  
  // Get count of items to return
  getItemsToReturnCount(): number {
    return this.itemsArray.controls.filter(
      control => (control.get('returnQuantity')?.value || 0) > 0
    ).length;
  }

  // Method called when the form is submitted via template
  onSubmit(): void {
    if (this.returnForm.invalid) {
      this.markFormGroupTouched(this.returnForm);
      this.toastService.showError('Please fill in all required fields correctly.');
      return;
    }
    
    this.submitReturn();
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
    
    const formData = this.returnForm.value;
    
    // Filter out items with zero return quantity
    const returnItems: SaleReturnItemDto[] = formData.items
      .filter((item: any) => item.returnQuantity > 0)
      .map((item: any) => ({
        medicineId: item.medicineId,
        batchNo: item.batchNo,
        returnQuantity: item.returnQuantity
      }));
      
    if (returnItems.length === 0) {
      this.isSubmitting = false;
      this.toastService.showError('Please specify at least one item to return.');
      return;
    }
    
    const returnRequest: SaleReturnRequest = {
      originalSaleId: formData.originalSaleId,
      returnDate: formData.returnDate,
      reason: formData.reason,
      refundAmount: formData.refundAmount || this.calculateRefundAmount(returnItems),
      overallDiscountPercentage: formData.overallDiscountPercentage || 0,
      refundMode: formData.refundMode || 'CASH',
      refundReference: formData.refundReference || '',
      items: returnItems
    };
    
    this.returnsService.createSaleReturn(returnRequest).subscribe({
      next: (response) => {
        this.toastService.showSuccess('Sale return processed successfully!');
        this.router.navigate(['/inventory/returns']);
      },
      error: (error) => {
        console.error('Error processing sale return:', error);
        this.toastService.showError('Failed to process sale return. Please try again.');
      }
    });
  }

  /**
   * Calculate the total refund amount based on returned items and their unit prices
   */
  private calculateRefundAmount(items: SaleReturnItemDto[]): number {
    if (!items || items.length === 0 || !this.selectedSale?.items) {
      return 0;
    }

    // Calculate total refund by multiplying return quantity by unit price for each item
    return items.reduce((total, returnItem) => {
      // Find the matching sale item to get its unit price
      const originalItem = this.selectedSale?.items?.find(item => 
        item.medicineId === returnItem.medicineId && item.batchNo === returnItem.batchNo);
      
      if (!originalItem) {
        return total;
      }
      
      // Calculate refund amount for this item
      const itemRefund = returnItem.returnQuantity * (originalItem.unitPrice || 0);
      return total + itemRefund;
    }, 0);
  }
  
  // Helper method to get FormGroup from AbstractControl
  getFormGroup(control: AbstractControl): FormGroup {
    return control as FormGroup;
  }
  
  // Helper method to format date for display
  formatDate(dateValue: string | { seconds: number; nanos: number } | undefined): string {
    if (!dateValue) return '';
    
    if (typeof dateValue === 'string') {
      return new Date(dateValue).toLocaleDateString('en-GB');
    } else if (dateValue && 'seconds' in dateValue) {
      return new Date(dateValue.seconds * 1000).toLocaleDateString('en-GB');
    }
    
    return '';
  }
  
  // Helper method to get safe date for Angular date pipe
  getSafeDate(dateValue: string | { seconds: number; nanos: number } | undefined): Date | null {
    if (!dateValue) return null;
    
    if (typeof dateValue === 'string') {
      return new Date(dateValue);
    } else if (dateValue && 'seconds' in dateValue) {
      return new Date(dateValue.seconds * 1000);
    }
    
    return null;
  }
}
