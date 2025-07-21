import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, finalize } from 'rxjs/operators';

import { InventoryService } from '../../services/inventory.service';
import { Purchase, PurchaseItemDto, Medicine } from '../../models/inventory.models';
import { ReturnsService, PurchaseReturnRequest, PurchaseReturnItemDto } from '../../services/returns.service';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-purchase-return-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './purchase-return-form.component.html',
  styleUrls: ['./purchase-return-form.component.css']
})
export class PurchaseReturnFormComponent implements OnInit {
  returnForm!: FormGroup;
  isSearching = false;
  filteredPurchases: Purchase[] = [];
  selectedPurchase: Purchase | null = null;
  purchaseSearchText = '';
  isLoading = false;
  isSubmitting = false; // Add back the isSubmitting property
  searchControl = new FormControl('');
  searchResults$!: Observable<Purchase[]>;
  medicines: Medicine[] = [];

  constructor(
    public fb: FormBuilder, 
    private inventoryService: InventoryService,
    public returnsService: ReturnsService, // Changed to public for template access
    private toastService: ToastService,
    private router: Router
  ) {}
  
  /**
   * Search for purchases based on user input
   */
  searchPurchases(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.purchaseSearchText = target.value;
    
    if (!this.purchaseSearchText || this.purchaseSearchText.trim().length < 3) {
      this.filteredPurchases = [];
      return;
    }
    
    this.isSearching = true;
    this.returnsService.searchPurchases(this.purchaseSearchText, this.inventoryService)
      .pipe(finalize(() => this.isSearching = false))
      .subscribe(purchases => {
        console.log('Found purchases:', purchases);
        this.filteredPurchases = purchases;
      });
  }
  
  // onSubmit() implementation moved to the bottom of the file

  ngOnInit(): void {
    this.initForm();
    
    // Initialize search control here after fb is initialized
    this.searchControl = this.fb.control('');
    
    // Setup auto search with debounce
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(value => {
        this.purchaseSearchText = value || ''; // Add empty string fallback
        if (value && value.trim().length >= 3) {
          this.searchPurchases({ target: { value } } as unknown as Event);
        } else {
          this.filteredPurchases = [];
        }
      });
    
    // Load medicines for reference
    this.loadMedicines();
  }

  initForm(): void {
    this.returnForm = this.fb.group({
      originalPurchaseId: ['', Validators.required],
      supplierId: ['', Validators.required],
      supplierName: [''],
      returnDate: [this.formatDateForInput(new Date()), Validators.required],
      reason: ['', Validators.required],
      items: this.fb.array([])
    });
  }

  // Format date to YYYY-MM-DDThh:mm
  formatDateForInput(date: Date): string {
    return date.toISOString().substring(0, 16);
  }
  
  // Helper method to format date for submission
  formatDateForSubmission(date: string | null): string {
    if (!date) return new Date().toISOString().split('T')[0];
    return new Date(date).toISOString().split('T')[0];
  }

  get itemsArray(): FormArray {
    return this.returnForm.get('items') as FormArray;
  }
  
  // Helper method to cast AbstractControl to FormGroup for template binding
  getFormGroup(item: any): FormGroup {
    return item as FormGroup;
  }

  // Search functionality now handled by searchResults$ observable

  selectPurchase(purchase: Purchase): void {
    console.log('Selected purchase:', purchase);
    this.selectedPurchase = purchase;
    
    // Use the ReturnsService formatter
    const formattedId = this.returnsService.formatPurchaseId(purchase.id || purchase.purchaseId || '');
    this.searchControl.setValue(formattedId);
    this.purchaseSearchText = formattedId;
    
    // Hide search results
    this.filteredPurchases = [];
    
    // Map purchase data to form
    this.returnForm.patchValue({
      originalPurchaseId: purchase.id || purchase.purchaseId || '', // Add empty string fallback
      supplierId: purchase.supplierId,
      supplierName: purchase.supplier ? purchase.supplier.name : `Supplier ID: ${purchase.supplierId}`
    });
    
    // Create form controls for each purchase item
    this.clearItemsArray();
    if (purchase.items && purchase.items.length > 0) {
      purchase.items.forEach((item: PurchaseItemDto) => {
        this.itemsArray.push(this.createItemFormGroup(item));
      });
    }
    
    // Log for debugging
    console.log('Updated form values:', this.returnForm.value);
    console.log('Item array length:', this.itemsArray.length);
  }

  createItemFormGroup(item: any): FormGroup {
    // Extract the correct quantity field from the API response
    const quantity = item.totalReceivedQuantity || item.quantity || 0;
    const purchasePrice = item.purchaseCostPerPack || item.purchasePrice || 0;
    const medicineId = item.medicineId || item.medicine?.id || '';
    
    // Find medicine name from our loaded medicines if available
    const medicineName = this.getMedicineName(medicineId);
    
    console.log('Creating item form group:', { 
      medicineId,
      medicineName,
      batchNo: item.batchNo,
      quantity,
      price: purchasePrice
    });
    
    return this.fb.group({
      medicineId: [medicineId, Validators.required],
      medicineName: [medicineName],
      batchNo: [item.batchNo || '', Validators.required], // Made batch number required
      originalQuantity: [quantity],
      purchasePrice: [purchasePrice],
      returnQuantity: [0, [
        Validators.required, 
        Validators.min(1), 
        Validators.max(quantity)
      ]],
      returnValue: [0],
      mrpPerItem: [item.mrpPerItem || item.mrp || 0],
      expiryDate: [item.expiryDate || ''],
      taxProfileId: [item.taxProfileId || ''],
      taxRate: [item.taxRateApplied || 0]
    });
  }
  
  // Helper method to get medicine name from ID
  getMedicineName(medicineId: string): string {
    if (!medicineId) return 'Unknown Medicine';
    
    const medicine = this.medicines.find(m => m.id === medicineId);
    return medicine ? medicine.name : `Medicine ID: ${medicineId.substring(0, 8)}`;
  }

  clearItemsArray(): void {
    while (this.itemsArray.length !== 0) {
      this.itemsArray.removeAt(0);
    }
  }

  // Load medicines for reference
  loadMedicines(): void {
    this.inventoryService.getMedicines()
      .subscribe({
        next: (medicines) => {
          this.medicines = medicines;
          console.log('Medicines loaded:', medicines.length);
        },
        error: (error) => {
          console.error('Error loading medicines:', error);
        }
      });
  }

  onSubmit(): void {
    if (this.returnForm.invalid) {
      this.markFormGroupTouched(this.returnForm);
      return;
    }

    if (this.itemsArray.length === 0) {
      this.toastService.showError('Please select at least one item to return');
      return;
    }

    // Check if any items have return quantity > 0
    const hasItemsToReturn = this.itemsArray.controls.some(
      control => control.get('returnQuantity')?.value > 0
    );

    if (!hasItemsToReturn) {
      this.toastService.showError('Please enter a return quantity for at least one item');
      return;
    }

    this.isLoading = true;
    const formValue = this.returnForm.value;
    
    // Create the return request
    const returnData: PurchaseReturnRequest = {
      originalPurchaseId: formValue.originalPurchaseId,
      supplierId: formValue.supplierId,
      returnDate: formValue.returnDate, // Send as is, API expects ISO string
      reason: formValue.reason,
      items: this.itemsArray.controls
        .filter(control => control.get('returnQuantity')?.value > 0)
        .map(control => ({
          medicineId: control.get('medicineId')?.value,
          batchNo: control.get('batchNo')?.value,
          returnQuantity: control.get('returnQuantity')?.value
        }))
    };

    this.returnsService.createPurchaseReturn(returnData)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          this.toastService.showSuccess('Purchase return created successfully');
          this.router.navigate(['/inventory/returns']);
        },
        error: (error) => {
          console.error('Error creating purchase return', error);
          this.toastService.showError('Failed to create purchase return');
        }
      });
  }

  // Helper method to mark all form controls as touched
  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
  
  /**
   * Reset the form to its initial state
   */
  resetForm(): void {
    // Clear the selected purchase
    this.selectedPurchase = null;
    
    // Reset the search control
    this.searchControl.reset('');
    this.purchaseSearchText = '';
    this.filteredPurchases = [];
    
    // Reset the form
    this.initForm();
    
    this.toastService.showInfo('Form has been reset');
  }
  
  // Cancel and go back to list
  cancel(): void {
    this.router.navigate(['/inventory/returns']);
  }
}
