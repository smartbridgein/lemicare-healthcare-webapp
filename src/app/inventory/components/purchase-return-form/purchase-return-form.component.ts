import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, finalize } from 'rxjs/operators';

import { InventoryService } from '../../services/inventory.service';
import { Purchase, PurchaseItemDto } from '../../models/inventory.models';
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
  purchaseSearchText = '';
  isSearching = false;
  isSubmitting = false;
  filteredPurchases: Purchase[] = [];
  
  // Form control for search input
  searchControl!: FormControl;
  isLoading = false;
  selectedPurchase: Purchase | null = null;
  searchResults$: Observable<Purchase[]> = of([]);

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
        this.filteredPurchases = purchases;
      });
  }
  
  // onSubmit() implementation moved to the bottom of the file

  ngOnInit(): void {
    this.initForm();
    
    // Initialize search control here after fb is initialized
    this.searchControl = this.fb.control('');
    
    // Set up search with debounce
    this.searchResults$ = this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => {
        if (!term || term.length < 3) {
          return of([]);
        }
        this.isLoading = true;
        return this.returnsService.searchPurchases(term, this.inventoryService).pipe(
          finalize(() => this.isLoading = false)
        );
      })
    );
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
    this.selectedPurchase = purchase;
    // Use the ReturnsService formatter
    this.searchControl.setValue(this.returnsService.formatPurchaseId(purchase.id || ''));
    
    this.returnForm.patchValue({
      originalPurchaseId: purchase.id,
      supplierId: purchase.supplierId,
      supplierName: purchase.supplier ? purchase.supplier.name : 'Unknown Supplier'
    });
    
    // Create form controls for each purchase item
    this.clearItemsArray();
    if (purchase.items && purchase.items.length > 0) {
      purchase.items.forEach((item: PurchaseItemDto) => {
        this.itemsArray.push(this.createItemFormGroup(item));
      });
    }
  }

  createItemFormGroup(item: any): FormGroup {
    return this.fb.group({
      medicineId: [item.medicineId || item.medicine?.id || '', Validators.required],
      medicineName: [item.medicineName || item.medicine?.name || ''],
      batchNo: [item.batchNo || '', Validators.required], // Made batch number required
      originalQuantity: [item.quantity || 0],
      purchasePrice: [item.purchasePrice || 0],
      returnQuantity: [0, [
        Validators.required, 
        Validators.min(1), 
        Validators.max(item.quantity || 0)
      ]],
      returnValue: [0]
    });
  }

  clearItemsArray(): void {
    while (this.itemsArray.length) {
      this.itemsArray.removeAt(0);
    }
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
