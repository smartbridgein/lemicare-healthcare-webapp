import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { InventoryService } from '../../../services/inventory.service';

@Component({
  selector: 'app-purchase-return-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './purchase-return-form.component.html',
  styles: [`
    .purchase-return-container {
      padding: 20px;
    }
    
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .back-button a {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
      color: #007bff;
    }
    
    .back-button i {
      margin-right: 5px;
    }
    
    .form-container {
      background: #fff;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }
  `]
})
export class PurchaseReturnFormComponent implements OnInit {
  purchaseReturnForm!: FormGroup;
  purchases: any[] = [];
  selectedPurchaseItems: any[] = [];
  
  constructor(
    private fb: FormBuilder,
    private inventoryService: InventoryService,
    private router: Router
  ) { }
  
  ngOnInit(): void {
    this.initForm();
    this.loadPurchases();
    
    this.purchaseReturnForm.get('invoiceSearch')?.valueChanges.subscribe(invoiceId => {
      if (invoiceId && invoiceId.length > 3) {
        this.loadPurchaseDetails(invoiceId);
      } else if (!invoiceId) {
        this.resetItems();
      }
    });
  }
  
  initForm(): void {
    this.purchaseReturnForm = this.fb.group({
      invoiceSearch: [''],
      returnDate: [this.formatDate(new Date()), Validators.required],
      items: this.fb.array([]),
      overallDiscount: [0, [Validators.min(0), Validators.max(100)]]
    });
  }
  
  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  get itemsFormArray(): FormArray {
    return this.purchaseReturnForm.get('items') as FormArray;
  }
  
  loadPurchases(): void {
    // In a real app, this would call the service to get actual purchase data
    // For now, let's just use mock data
    this.purchases = [
      { 
        id: 'purchase_12345', 
        supplierName: 'ABC Pharmaceuticals', 
        date: new Date().toISOString(),
        total: 5200
      },
      { 
        id: 'purchase_67890', 
        supplierName: 'XYZ Medical Supplies', 
        date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        total: 3800
      }
    ];
  }
  
  loadPurchaseDetails(purchaseId: string): void {
    // In a real app, this would call the service to get the purchase items
    // For now, let's use mock data
    this.resetItems();
    
    if (purchaseId === 'purchase_12345') {
      this.selectedPurchaseItems = [
        {
          medicineId: 'med_001',
          name: 'Paracetamol 500mg',
          quantity: 200,
          purchasePrice: 15
        },
        {
          medicineId: 'med_002',
          name: 'Amoxicillin 250mg',
          quantity: 100,
          purchasePrice: 22
        }
      ];
    } else if (purchaseId === 'purchase_67890') {
      this.selectedPurchaseItems = [
        {
          medicineId: 'med_003',
          name: 'Cetirizine 10mg',
          quantity: 150,
          purchasePrice: 12
        },
        {
          medicineId: 'med_004',
          name: 'Ibuprofen 400mg',
          quantity: 120,
          purchasePrice: 18
        }
      ];
    }
    
    this.populateItemsForm();
  }
  
  populateItemsForm(): void {
    this.selectedPurchaseItems.forEach(item => {
      this.itemsFormArray.push(
        this.fb.group({
          medicineId: [item.medicineId],
          name: [item.name],
          genericAndMfg: [item.genericAndMfg || 'Generic'],
          hsn: [item.hsn || '30049099'],
          batch: [item.batch || 'B001'],
          expiryDate: [item.expiryDate || '2025-12-31'],
          pack: [item.pack || 10],
          freePack: [item.freePack || 0],
          itemsPerPack: [item.itemsPerPack || 10],
          originalQuantity: [item.quantity],
          mrp: [item.mrp || (item.purchasePrice * 1.2)],
          purchaseCost: [item.purchasePrice],
          discount: [item.discount || 0],
          gst: [item.gst || 12],
          returnQuantity: [0, [
            Validators.required, 
            Validators.min(0),
            Validators.max(item.quantity)
          ]]
        })
      );
    });
  }
  
  resetItems(): void {
    while (this.itemsFormArray.length) {
      this.itemsFormArray.removeAt(0);
    }
    this.selectedPurchaseItems = [];
  }
  
  getItemName(medicineId: string): string {
    const item = this.selectedPurchaseItems.find(i => i.medicineId === medicineId);
    return item ? item.name : 'Unknown Item';
  }
  
  calculateTaxableAmount(item: any): number {
    const returnQuantity = item.get('returnQuantity')?.value || 0;
    const purchaseCost = item.get('purchaseCost')?.value || 0;
    const discount = item.get('discount')?.value || 0;
    const subtotal = returnQuantity * purchaseCost;
    return subtotal - (subtotal * discount / 100);
  }

  calculateSubtotal(item: any): number {
    const taxableAmount = this.calculateTaxableAmount(item);
    const gst = item.get('gst')?.value || 0;
    const tax = taxableAmount * gst / 100;
    return taxableAmount + tax;
  }
  
  calculateGrossTotal(): number {
    let total = 0;
    this.itemsFormArray.controls.forEach(item => {
      const returnQuantity = item.get('returnQuantity')?.value || 0;
      const purchaseCost = item.get('purchaseCost')?.value || 0;
      total += returnQuantity * purchaseCost;
    });
    return total;
  }

  calculateTotalDiscount(): number {
    let total = 0;
    this.itemsFormArray.controls.forEach(item => {
      const returnQuantity = item.get('returnQuantity')?.value || 0;
      const purchaseCost = item.get('purchaseCost')?.value || 0;
      const discount = item.get('discount')?.value || 0;
      total += (returnQuantity * purchaseCost) * discount / 100;
    });
    return total;
  }

  calculateNetTaxableAmount(): number {
    return this.calculateGrossTotal() - this.calculateTotalDiscount();
  }

  calculateTotalCGST(): number {
    let total = 0;
    this.itemsFormArray.controls.forEach(item => {
      const taxableAmount = this.calculateTaxableAmount(item);
      const gst = item.get('gst')?.value || 0;
      // Half of GST is CGST
      total += taxableAmount * (gst/2) / 100;
    });
    return total;
  }

  calculateTotalSGST(): number {
    let total = 0;
    this.itemsFormArray.controls.forEach(item => {
      const taxableAmount = this.calculateTaxableAmount(item);
      const gst = item.get('gst')?.value || 0;
      // Half of GST is SGST
      total += taxableAmount * (gst/2) / 100;
    });
    return total;
  }

  calculateNetTotal(): number {
    return this.calculateNetTaxableAmount() + this.calculateTotalCGST() + this.calculateTotalSGST();
  }

  calculateFinalTotal(): number {
    const overallDiscount = this.purchaseReturnForm.get('overallDiscount')?.value || 0;
    const netTotal = this.calculateNetTotal();
    return netTotal - overallDiscount; // This is an amount, not a percentage
  }
  
  hasItemsToReturn(): boolean {
    return this.itemsFormArray.controls.some(item => 
      (item.get('returnQuantity')?.value || 0) > 0
    );
  }
  
  onSubmit(): void {
    if (this.purchaseReturnForm.invalid || !this.hasItemsToReturn()) {
      return;
    }
    
    const formData = this.purchaseReturnForm.value;
    const returnItems = formData.items
      .filter((item: any) => item.returnQuantity > 0)
      .map((item: any) => ({
        medicineId: item.medicineId,
        quantity: item.returnQuantity,
        purchasePrice: item.purchasePrice
      }));
    
    const returnRequest = {
      purchaseId: formData.purchaseId,
      returnDate: formData.returnDate,
      reason: formData.reason === 'OTHER' ? formData.otherReason : formData.reason,
      returnItems
    };
    
    // In a real app, this would call the service to create the return
    console.log('Submitting purchase return:', returnRequest);
    
    alert('Purchase return submitted successfully!');
    this.router.navigate(['/inventory/returns']);
  }
  
  onCancel(): void {
    this.router.navigate(['/inventory/returns']);
  }

  clearInvoiceSearch(): void {
    this.purchaseReturnForm.get('invoiceSearch')?.setValue('');
    this.resetItems();
  }
}
