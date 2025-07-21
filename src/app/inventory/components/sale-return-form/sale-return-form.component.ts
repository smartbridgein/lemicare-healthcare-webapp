import { Component, OnInit } from '@angular/core';
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
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    
    // Initialize search controls
    this.searchControl = new FormControl('');
    this.saleIdControl = new FormControl('');
    
    // Setup the search with debounce
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query: string) => {
        if (!query || query.trim() === '') {
          this.filteredSales = [];
          return of([]);
        }
        this.isSearching = true;
        return this.returnsService.searchSales(query);
      }),
      finalize(() => this.isSearching = false)
    ).subscribe(results => {
      this.filteredSales = results;
    });
  }

  initForm(): void {
    this.returnForm = this.fb.group({
      originalSaleId: ['', Validators.required],
      returnDate: [new Date().toISOString().split('T')[0], Validators.required],
      reason: ['', Validators.required],
      refundAmount: [0, [Validators.required, Validators.min(0)]],
      overallDiscountPercentage: [0, [Validators.required, Validators.min(0)]],
      refundMode: ['CASH', Validators.required],
      refundReference: [''],
      customerName: [''],
      customerMobile: [''],
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
  
  // Format date for display
  formatDate(dateValue: any): string {
    if (!dateValue) return 'N/A';
    
    try {
      // If it's a string, parse it directly
      if (typeof dateValue === 'string') {
        return new Date(dateValue).toLocaleString();
      }
      
      // If it's an object with seconds and nanos (protobuf timestamp)
      if (dateValue && typeof dateValue === 'object' && 'seconds' in dateValue) {
        const milliseconds = Number(dateValue.seconds) * 1000 + Number(dateValue.nanos) / 1000000;
        return new Date(milliseconds).toLocaleString();
      }
      
      return new Date().toLocaleString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  }

  get itemsArray(): FormArray {
    return this.returnForm.get('items') as FormArray;
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
    
    // Format the saleId if needed (add 'sale_' prefix if missing)
    let formattedSaleId = saleId.trim();
    if (!formattedSaleId.startsWith('sale_') && !formattedSaleId.includes('-')) {
      formattedSaleId = `sale_${formattedSaleId}`;
    }
    
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
        this.itemsArray.push(this.createItemFormGroup(formattedItem as any));
      });
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
    // IMPORTANT: Make sure we have the correct medicine name
    // Priority: 1. item.medicineName (directly from our enrichment) 
    //           2. item.medicine?.name (from the medicine object)
    //           3. Fallback to medicine ID-based name
    const medicineName = item.medicineName || 
                      (item.medicine?.name) || 
                      `Medicine ${item.medicineId ? item.medicineId.split('_')[1]?.substring(0, 8) : ''}`;
                      
    console.log('Creating form group with medicine name:', medicineName, 'for item:', item);
    
    // Set default return quantity to 1 and calculate initial refund amount
    const defaultReturnQty = 1;
    const maxReturnQty = item.quantity || 1;
    const safeReturnQty = Math.min(defaultReturnQty, maxReturnQty);
    const unitPrice = item.unitPrice || 0;
    const initialRefundAmount = safeReturnQty * unitPrice;
    
    console.log('Setting default return quantity to:', safeReturnQty, 'for item:', medicineName);
    
    return this.fb.group({
      medicineId: [item.medicineId || item.medicine?.id, Validators.required],
      medicineName: [medicineName], // Use the prepared medicine name
      batchNo: [item.batchNo || '', Validators.required],
      quantity: [item.quantity || 0], // Changed from originalQuantity to quantity to match HTML references
      returnQuantity: [safeReturnQty, [Validators.required, Validators.min(0), Validators.max(maxReturnQty)]],
      unitPrice: [unitPrice],
      refundAmount: [initialRefundAmount]
    });
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
}
