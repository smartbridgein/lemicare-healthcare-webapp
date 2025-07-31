import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { InventoryService } from '../../../services/inventory.service';

@Component({
  selector: 'app-sales-return-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './sales-return-form.component.html',
  styles: [`
    .sales-return-container {
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
export class SalesReturnFormComponent implements OnInit {
  salesReturnForm!: FormGroup;
  sales: any[] = [];
  selectedSaleItems: any[] = [];

  constructor(private fb: FormBuilder, private inventoryService: InventoryService, private router: Router) { }
  
  ngOnInit(): void {
    this.initForm();
    this.loadSales();
    
    this.salesReturnForm.get('invoiceSearch')?.valueChanges.subscribe(invoiceId => {
      if (invoiceId && invoiceId.length > 3) {
        this.loadSaleDetails(invoiceId);
      } else if (!invoiceId) {
        this.resetItems();
      }
    });
  }
  
  initForm(): void {
    this.salesReturnForm = this.fb.group({
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
    return this.salesReturnForm.get('items') as FormArray;
  }
  
  loadSales(): void {
    // In a real app, this would call the service to get actual sales data
    // For now, let's just use mock data
    this.sales = [
      { 
        id: 'sale_12345', 
        customerName: 'John Doe', 
        date: new Date().toISOString(),
        total: 1200
      },
      { 
        id: 'sale_67890', 
        customerName: 'Jane Smith', 
        date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        total: 950
      }
    ];
  }
  
  loadSaleDetails(saleId: string): void {
    // In a real app, this would call the service to get the sale items
    // For now, let's use mock data
    this.resetItems();
    
    if (saleId === 'sale_12345') {
      this.selectedSaleItems = [
        {
          medicineId: 'med_001',
          name: 'Paracetamol 500mg',
          quantity: 10,
          unitPrice: 20
        },
        {
          medicineId: 'med_002',
          name: 'Amoxicillin 250mg',
          quantity: 5,
          unitPrice: 30
        }
      ];
    } else if (saleId === 'sale_67890') {
      this.selectedSaleItems = [
        {
          medicineId: 'med_003',
          name: 'Cetirizine 10mg',
          quantity: 3,
          unitPrice: 15
        },
        {
          medicineId: 'med_004',
          name: 'Ibuprofen 400mg',
          quantity: 8,
          unitPrice: 25
        }
      ];
    }
    
    this.populateItemsForm();
  }
  
  populateItemsForm(): void {
    this.selectedSaleItems.forEach(item => {
      this.itemsFormArray.push(
        this.fb.group({
          medicineId: [item.medicineId],
          name: [item.name],
          originalQuantity: [item.quantity],
          batch: [item.batch || 'B001'],
          expiryDate: [item.expiryDate || '2025-12-31'],
          manufacturer: [item.manufacturer || 'Generic'],
          generic: [item.generic || 'Generic'],
          mrp: [item.mrp || item.unitPrice],
          unitPrice: [item.unitPrice],
          discount: [item.discount || 0],
          cgst: [item.cgst || 6],
          sgst: [item.sgst || 6],
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
    this.selectedSaleItems = [];
  }
  
  getItemName(medicineId: string): string {
    const item = this.selectedSaleItems.find(i => i.medicineId === medicineId);
    return item ? item.name : 'Unknown Item';
  }
  
  calculateTaxableAmount(item: any): number {
    const returnQuantity = item.get('returnQuantity')?.value || 0;
    const unitPrice = item.get('unitPrice')?.value || 0;
    const discount = item.get('discount')?.value || 0;
    const subtotal = returnQuantity * unitPrice;
    return subtotal - (subtotal * discount / 100);
  }

  calculateSubtotal(item: any): number {
    const taxableAmount = this.calculateTaxableAmount(item);
    const cgst = item.get('cgst')?.value || 0;
    const sgst = item.get('sgst')?.value || 0;
    const tax = taxableAmount * (cgst + sgst) / 100;
    return taxableAmount + tax;
  }
  
  calculateGrossTotal(): number {
    let total = 0;
    this.itemsFormArray.controls.forEach(item => {
      const returnQuantity = item.get('returnQuantity')?.value || 0;
      const unitPrice = item.get('unitPrice')?.value || 0;
      total += returnQuantity * unitPrice;
    });
    return total;
  }

  calculateTotalDiscount(): number {
    let total = 0;
    this.itemsFormArray.controls.forEach(item => {
      const returnQuantity = item.get('returnQuantity')?.value || 0;
      const unitPrice = item.get('unitPrice')?.value || 0;
      const discount = item.get('discount')?.value || 0;
      total += (returnQuantity * unitPrice) * discount / 100;
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
      const cgst = item.get('cgst')?.value || 0;
      total += taxableAmount * cgst / 100;
    });
    return total;
  }

  calculateTotalSGST(): number {
    let total = 0;
    this.itemsFormArray.controls.forEach(item => {
      const taxableAmount = this.calculateTaxableAmount(item);
      const sgst = item.get('sgst')?.value || 0;
      total += taxableAmount * sgst / 100;
    });
    return total;
  }

  calculateNetTotal(): number {
    return this.calculateNetTaxableAmount() + this.calculateTotalCGST() + this.calculateTotalSGST();
  }

  calculateFinalTotal(): number {
    const overallDiscount = this.salesReturnForm.get('overallDiscount')?.value || 0;
    const netTotal = this.calculateNetTotal();
    return netTotal - (netTotal * overallDiscount / 100);
  }

  hasItemsToReturn(): boolean {
    return this.itemsFormArray.controls.some(item => 
      (item.get('returnQuantity')?.value || 0) > 0
    );
  }
  
  onSubmit(): void {
    if (this.salesReturnForm.invalid || !this.hasItemsToReturn()) {
      return;
    }
    
    const formData = this.salesReturnForm.value;
    const returnItems = formData.items
      .filter((item: any) => item.returnQuantity > 0)
      .map((item: any) => ({
        medicineId: item.medicineId,
        quantity: item.returnQuantity,
        unitPrice: item.unitPrice
      }));
    
    const returnRequest = {
      saleId: formData.saleId,
      returnDate: formData.returnDate,
      reason: formData.reason === 'OTHER' ? formData.otherReason : formData.reason,
      returnItems
    };
    
    // In a real app, this would call the service to create the return
    console.log('Submitting sales return:', returnRequest);
    
    alert('Sales return submitted successfully!');
    this.router.navigate(['/inventory/returns']);
  }
  
  onCancel(): void {
    this.router.navigate(['/inventory/returns']);
  }

  clearInvoiceSearch(): void {
    this.salesReturnForm.get('invoiceSearch')?.setValue('');
    this.resetItems();
  }
}
