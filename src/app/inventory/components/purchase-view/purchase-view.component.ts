import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { InventoryService } from '../../services/inventory.service';
import { Purchase, Supplier, Medicine, PurchaseItemDto, TaxComponentItem } from '../../models/inventory.models';

@Component({
  selector: 'app-purchase-view',
  standalone: true,
  imports: [CommonModule, RouterModule],
  providers: [DatePipe],
  templateUrl: './purchase-view.component.html',
  styleUrls: ['./purchase-view.component.scss']
})
export class PurchaseViewComponent implements OnInit {
  // Make window object available to template
  window = window;
  purchase: Purchase | null = null;
  purchaseId: string | null = null;
  loading: boolean = true;
  suppliers: Map<string, Supplier> = new Map();
  medicines: Map<string, Medicine> = new Map();
  error: string | null = null;

  constructor(
    private inventoryService: InventoryService,
    private route: ActivatedRoute,
    private router: Router,
    private datePipe: DatePipe
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.purchaseId = params.get('id');
      if (this.purchaseId) {
        this.loadPurchase();
      } else {
        this.error = 'Invalid purchase ID';
        this.loading = false;
      }
    });

    this.loadSuppliers();
    this.loadMedicines();
  }

  loadPurchase(): void {
    if (!this.purchaseId) return;

    this.loading = true;
    this.inventoryService.getPurchaseById(this.purchaseId).subscribe({
      next: (data) => {
        console.log('Loaded purchase:', data);
        
        // Check if we need to load tax profiles
        const hasTaxProfiles = data.items?.some(item => item.taxProfileId);
        
        if (hasTaxProfiles) {
          // Load tax profiles first for better tax calculation
          this.inventoryService.getTaxProfiles().subscribe({
            next: (taxProfiles) => {
              console.log('Loaded tax profiles for better processing:', taxProfiles);
              // Process purchase with available tax profiles
              this.purchase = this.processPurchaseData(data);
              this.loading = false;
            },
            error: (err) => {
              console.warn('Could not load tax profiles, continuing with purchase processing:', err);
              this.purchase = this.processPurchaseData(data);
              this.loading = false;
            }
          });
        } else {
          // Process purchase directly
          this.purchase = this.processPurchaseData(data);
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Error loading purchase:', err);
        this.error = 'Failed to load purchase details';
        this.loading = false;
      }
    });
  }

  processPurchaseData(purchase: Purchase): Purchase {
    // Debug: Log raw purchase data received
    console.log('Raw purchase data received:', purchase);
    console.log('Raw items data:', purchase?.items);
    
    // Process numeric values to ensure proper display
    const processedPurchase = {...purchase};
    
    // Ensure all purchase totals are numbers
    processedPurchase.totalTaxableAmount = Number(processedPurchase.totalTaxableAmount || 0);
    processedPurchase.totalDiscountAmount = Number(processedPurchase.totalDiscountAmount || 0);
    processedPurchase.totalTaxAmount = Number(processedPurchase.totalTaxAmount || 0);
    processedPurchase.totalAmount = Number(processedPurchase.totalAmount || 0);
    
    // Process all items to ensure numeric values
    if (processedPurchase.items && processedPurchase.items.length) {
      console.log('Processing ' + processedPurchase.items.length + ' purchase items');
      
      processedPurchase.items = processedPurchase.items.map((item, index) => {
        // Use proper type safe property access
        const packQty = item.packQuantity ?? 0;
        const freePackQty = item.freePackQuantity ?? 0;
        const itemsPerPk = item.itemsPerPack ?? 1;
        const cost = item.purchaseCostPerPack ?? 0;
        const discPct = item.discountPercentage ?? 0;
        const mrp = item.mrpPerItem ?? 0;
        
        // Calculate derived values if they're missing
        // For total quantity
        let totalQty = item.totalReceivedQuantity;
        if (!totalQty || totalQty === 0) {
          totalQty = (Number(packQty) + Number(freePackQty)) * Number(itemsPerPk);
        }
        
        // For line item gross amount (before discount)
        let grossAmount = Number(packQty) * Number(cost);
        
        // For discount amount
        let discAmount = item.lineItemDiscountAmount;
        if (!discAmount || discAmount === 0) {
          discAmount = grossAmount * (Number(discPct) / 100);
        }
        
        // For taxable amount
        let taxableAmount = item.lineItemTaxableAmount;
        if (!taxableAmount || taxableAmount === 0) {
          taxableAmount = grossAmount - discAmount;
        }
        
        // For tax amount based on applied rate
        const taxRate = item.taxRateApplied || 0;
        let taxAmount = item.lineItemTaxAmount;
        if (!taxAmount || taxAmount === 0) {
          // Handle tax calculation based on GST type (from purchase.gstType)
          if (purchase.gstType === 'INCLUSIVE') {
            // For inclusive: tax amount = taxable amount - (taxable amount / (1 + tax rate))
            taxAmount = taxableAmount - (taxableAmount / (1 + (taxRate / 100)));
          } else {
            // For exclusive or default: tax amount = taxable amount * tax rate %
            taxAmount = taxableAmount * (taxRate / 100);
          }
        }
        
        // For total line amount
        let totalAmount = item.lineItemTotalAmount;
        if (!totalAmount || totalAmount === 0) {
          if (purchase.gstType === 'INCLUSIVE') {
            totalAmount = taxableAmount; // Tax already included in taxable amount
          } else {
            totalAmount = taxableAmount + taxAmount; // Add tax on top
          }
        }
        
        const processedItem = {
          ...item,
          packQuantity: Number(packQty),
          freePackQuantity: Number(freePackQty),
          itemsPerPack: Number(itemsPerPk),
          totalReceivedQuantity: Number(totalQty),
          purchaseCostPerPack: Number(cost),
          discountPercentage: Number(discPct),
          lineItemDiscountAmount: Number(discAmount),
          lineItemTaxableAmount: Number(taxableAmount),
          lineItemTaxAmount: Number(taxAmount),
          lineItemTotalAmount: Number(totalAmount),
          mrpPerItem: Number(mrp),
          taxRateApplied: Number(taxRate)
        };
        
        // Debug log for the processed item
        console.log(`Item ${index + 1}:`, {
          medicine: item.medicineId,
          batch: item.batchNo,
          packQty: processedItem.packQuantity,
          freeQty: processedItem.freePackQuantity,
          itemsPerPack: processedItem.itemsPerPack,
          totalQty: processedItem.totalReceivedQuantity,
          cost: processedItem.purchaseCostPerPack,
          discount: processedItem.discountPercentage,
          taxable: processedItem.lineItemTaxableAmount,
          taxAmount: processedItem.lineItemTaxAmount,
          total: processedItem.lineItemTotalAmount
        });
        
        return processedItem;
      });
    }

    return processedPurchase;
  }

  loadSuppliers(): void {
    this.inventoryService.getSuppliers().subscribe({
      next: (data: Supplier[]) => {
        console.log('All suppliers loaded:', data);
        
        // Reset suppliers map to avoid stale data
        this.suppliers.clear();
        
        // Add active suppliers to the map
        data.filter(supplier => supplier.status !== 'INACTIVE')
          .forEach(supplier => {
            const id = supplier.id || supplier.supplierId;
            if (id) {
              this.suppliers.set(id, supplier);
            }
          });
      },
      error: (err: any) => {
        console.error('Error loading suppliers:', err);
      }
    });
  }

  loadMedicines(): void {
    this.inventoryService.getMedicines().subscribe({
      next: (data: Medicine[]) => {
        console.log('All medicines loaded:', data);
        
        // Reset medicines map to avoid stale data
        this.medicines.clear();
        
        // Add active medicines to the map
        data.filter(medicine => medicine.status !== 'INACTIVE')
          .forEach(medicine => {
            const id = medicine.id || medicine.medicineId;
            if (id) {
              this.medicines.set(id, medicine);
            }
          });
      },
      error: (err: any) => {
        console.error('Error loading medicines:', err);
      }
    });
  }

  /**
   * Calculate tax amount for a specific component
   */
  calculateComponentTaxAmount(component: TaxComponentItem, item: PurchaseItemDto): number {
    if (!component || !item) return 0;
    
    const taxableAmount = Number(item.lineItemTaxableAmount || 0);
    const rate = Number(component.rate || 0);
    
    return (taxableAmount * rate) / 100;
  }

  /**
   * Get total amount for a specific tax component across all items
   */
  getComponentTaxAmount(componentName: string): number {
    if (!this.purchase || !this.purchase.items) return 0;
    
    let total = 0;
    
    this.purchase.items.forEach(item => {
      if (item.taxComponents) {
        const component = item.taxComponents.find(tc => tc.name === componentName);
        if (component) {
          total += this.calculateComponentTaxAmount(component, item);
        }
      }
    });
    
    return total;
  }

  /**
   * Check if purchase has a specific tax component
   */
  hasTaxComponent(componentName: string): boolean {
    if (!this.purchase || !this.purchase.items) return false;
    
    return this.purchase.items.some(item => 
      item.taxComponents && item.taxComponents.some(tc => tc.name === componentName)
    );
  }

  /**
   * Format purchase ID to make it shorter and more readable
   */
  formatPurchaseId(id: string | undefined): string {
    if (!id) return 'N/A';
    
    // If it's a long UUID-style ID
    if (id.includes('_')) {
      // Split by underscore and get the second part (the UUID)
      const parts = id.split('_');
      if (parts.length > 1) {
        // Take just the first 4 characters of the UUID
        return `P-${parts[1].substring(0, 4)}`;
      }
    }
    
    // For numeric IDs or other formats, just return as is or with prefix
    return id.length > 8 ? `P-${id.substring(0, 4)}` : id;
  }

  /**
   * Format supplier ID to make it standardized similar to invoice IDs
   * Format: 'SUP-XXXX-YYYY'
   */
  formatSupplierId(id: string | undefined): string {
    if (!id) return 'N/A';
    
    // Extract code parts from the ID
    let code = '';
    let suffix = '';
    
    // If it's an existing supplier ID starting with 'S-'
    if (id.startsWith('S-')) {
      code = id.substring(2); // Remove 'S-' prefix
    } 
    // If it's a long UUID-style ID
    else if (id.includes('_')) {
      const parts = id.split('_');
      if (parts.length > 1) {
        code = parts[1].substring(0, 4);
        suffix = parts[1].substring(4, 8);
      }
    }
    // For IDs like 'a117'
    else if (id.length <= 8) {
      code = id;
    }
    // For longer IDs
    else {
      code = id.substring(0, 4);
      suffix = id.substring(4, 8);
    }
    
    // Pad and format code part
    code = code.padStart(4, '0').toUpperCase();
    
    // Generate or format suffix if empty
    if (!suffix || suffix.trim() === '') {
      // Use current date to create a consistent suffix
      const now = new Date();
      suffix = now.getFullYear().toString().substring(2) + 
              (now.getMonth() + 1).toString().padStart(2, '0');
    } else {
      suffix = suffix.toUpperCase();
    }
    
    // Simply return the two-part ID format without the problematic third part
    return `SUP-${code}-${suffix}`;
  }

  /**
   * Format medicine ID to make it shorter and more readable
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
   * Format timestamp date to a readable format
   */
  formatTimestampDate(timestamp: any): string {
    if (!timestamp) return 'N/A';
    
    // Handle Firestore timestamp format with seconds and nanos
    if (timestamp && timestamp.seconds) {
      const date = new Date(timestamp.seconds * 1000);
      return this.datePipe.transform(date, 'MMM dd, yyyy') || 'N/A';
    }
    
    // Handle regular date
    try {
      return this.datePipe.transform(new Date(timestamp), 'MMM dd, yyyy') || 'N/A';
    } catch {
      return 'N/A';
    }
  }

  /**
   * Calculates the total quantity for a purchase item
   * Total quantity = (Pack Quantity + Free Pack Quantity) * Items per Pack
   */
  calculateTotalQuantity(item: PurchaseItemDto): number {
    if (item.totalReceivedQuantity && item.totalReceivedQuantity > 0) {
      return Number(item.totalReceivedQuantity);
    }
    // Ensure we're working with proper numbers, not string values
    const packQty = typeof item.packQuantity === 'string' ? parseFloat(item.packQuantity) : Number(item.packQuantity || 0);
    const freePackQty = typeof item.freePackQuantity === 'string' ? parseFloat(item.freePackQuantity) : Number(item.freePackQuantity || 0);
    const itemsPerPack = typeof item.itemsPerPack === 'string' ? parseFloat(item.itemsPerPack) : Number(item.itemsPerPack || 1);
    
    // Calculate and return the total quantity
    return (packQty + freePackQty) * itemsPerPack;
  }

  /**
   * Get supplier name by ID
   */
  getSupplierName(supplierId: string): string {
    return this.suppliers.get(supplierId)?.name || 'Unknown Supplier';
  }

  /**
   * Get supplier contact by ID
   */
  getSupplierContact(supplierId: string): string {
    return this.suppliers.get(supplierId)?.contactNumber || 'N/A';
  }

  /**
   * Get medicine name by ID
   */
  getMedicineName(medicineId: string): string {
    return this.medicines.get(medicineId)?.name || 'Unknown Medicine';
  }
}
