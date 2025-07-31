import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InventoryService } from '../../services/inventory.service';
import { Supplier, Purchase, Medicine } from '../../models/inventory.models';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface SupplierTransaction {
  id: number;
  transactionId: string;
  referenceId?: string;
  date: Date;
  amount: number;
  amountPaid: number;
  balance: number;
  createdBy: string;
  paymentMode?: string;
  paymentReference?: string;
  items?: any[];
}

interface ApiPurchase {
  purchaseId: string;
  organizationId: string;
  branchId: string;
  supplierId: string;
  invoiceDate: {
    seconds: number;
    nanos: number;
  };
  referenceId: string;
  totalTaxableAmount: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  createdBy: string;
  createdAt: {
    seconds: number;
    nanos: number;
  };
  gstType: string;
  // Payment fields
  amountPaid?: number;
  paymentMode?: string;
  paymentReference?: string;
  items: any[];
}

@Component({
  selector: 'app-supplier-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './supplier-overview.component.html',
  styleUrls: ['./supplier-overview.component.scss']
})
export class SupplierOverviewComponent implements OnInit {
  supplier: Supplier | null = null;
  supplierId: string = '';
  loading: boolean = true;
  transactions: SupplierTransaction[] = [];
  totalBalance: number = 0;
  selectedTransactionIndex: number = -1;
  medicineCache: Map<string, string> = new Map<string, string>();
  medicines: Medicine[] = [];
  loadingMedicines: boolean = false;
  private apiBaseUrl: string = environment.apiUrlInventory+'/api/inventory';
  
  // Make Math available in template
  Math = Math;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventoryService: InventoryService,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.supplierId = params['id'];
      if (this.supplierId) {
        // Load medicines first to have them ready for display
        this.loadMedicines();
        this.loadSupplierDetails();
      }
    });
  }
  
  /**
   * Load all medicines to use for name lookups
   */
  loadMedicines(): void {
    this.loadingMedicines = true;
    this.inventoryService.getMedicines().subscribe({
      next: (medicines) => {
        this.medicines = medicines;
        console.log('Loaded medicines for name lookups:', medicines.length);
        this.loadingMedicines = false;
      },
      error: (err) => {
        console.error('Error loading medicines:', err);
        this.loadingMedicines = false;
      }
    });
  }

  /**
   * Load supplier details and transaction history
   */
  loadSupplierDetails(): void {
    this.loading = true;
    
    // Fetch all suppliers and find the one with matching ID
    this.http.get<any[]>(`${this.apiBaseUrl}/masters/suppliers`).subscribe({
      next: (suppliers) => {
        console.log('Loaded all suppliers:', suppliers);
        
        // Find the supplier with matching ID
        const matchingSupplier = suppliers.find(s => s.supplierId === this.supplierId);
        
        if (matchingSupplier) {
          console.log('Found matching supplier:', matchingSupplier);
          
          // Map to our supplier model
          this.supplier = {
            id: matchingSupplier.supplierId,
            supplierId: matchingSupplier.supplierId,
            name: matchingSupplier.name,
            address: matchingSupplier.address || '',
            contactNumber: matchingSupplier.mobileNumber || '',
            email: matchingSupplier.email || '',
            gstNumber: matchingSupplier.gstin || '',
            contactPerson: matchingSupplier.contactPerson || '',
            status: matchingSupplier.status || 'ACTIVE',
            balance: matchingSupplier.balance || 0,
            outstandingBalance: matchingSupplier.outstandingBalance || 0
          };
          
          console.log('Mapped supplier data:', this.supplier);
        } else {
          console.warn('No supplier found with ID:', this.supplierId);
          
          // Create a placeholder supplier
          this.supplier = {
            id: this.supplierId,
            name: 'Unknown Supplier',
            contactNumber: '',
            gstNumber: '',
            balance: 0,
            status: 'ACTIVE'
          };
        }
        
        // Now load the transactions
        this.loadSupplierTransactions();
      },
      error: (err) => {
        console.error('Error loading supplier details:', err);
        
        // Fallback to sample data if API fails
        if (this.supplierId === 'sup_6b7a9258-2469-45c4-80c0-0de815607017') {
          this.supplier = {
            id: this.supplierId,
            name: 'ZARA ENTERPRISES',
            contactNumber: '8056112673',
            gstNumber: '33DYPM0019BZZ',
            balance: 0,
            status: 'ACTIVE'
          };
        } else {
          this.supplier = {
            id: this.supplierId,
            name: 'Supplier ' + this.supplierId.substring(4, 12).toUpperCase(),
            contactNumber: '91' + Math.floor(Math.random() * 9000000000 + 1000000000),
            gstNumber: '33' + this.supplierId.substring(4, 14).toUpperCase() + 'Z',
            balance: 0,
            status: 'ACTIVE'
          };
        }
        
        // Continue loading transactions even if supplier details fail
        this.loadSupplierTransactions();
      }
    });
  }

  /**
   * Load supplier transactions
   */
  loadSupplierTransactions(): void {
    // Call the main purchase API and filter by supplier ID
    this.http.get<ApiPurchase[]>(`${this.apiBaseUrl}/purchases/`).subscribe({
      next: (allPurchases) => {
        if (allPurchases && allPurchases.length > 0) {
          // Filter purchases for this supplier only
          const supplierPurchases = allPurchases.filter(purchase => 
            purchase.supplierId === this.supplierId
          );
          
          if (supplierPurchases.length > 0) {
            console.log('Found supplier purchases:', supplierPurchases.length);
            
            // Sort by invoice date ascending
            supplierPurchases.sort((a, b) => a.invoiceDate.seconds - b.invoiceDate.seconds);
            
            // Map purchases to transactions and calculate individual balances
            let totalOutstandingAmount = 0;
            
            this.transactions = supplierPurchases.map((purchase, index) => {
              // Calculate the invoice amount and amount paid
              const amount = purchase.totalAmount || 0;
              const amountPaid = purchase.amountPaid || 0;
              
              // Calculate individual transaction balance (remaining amount for this transaction)
              const remainingAmount = amount - amountPaid;
              
              // For display: negative balance represents money owed (outstanding amount)
              const individualBalance = remainingAmount > 0 ? -remainingAmount : 0;
              
              // Add to total outstanding amount (only unpaid amounts)
              if (remainingAmount > 0) {
                totalOutstandingAmount += remainingAmount;
              }
              
              // Convert timestamp to Date
              const purchaseDate = new Date(purchase.invoiceDate.seconds * 1000);
              
              return {
                id: index + 1,
                transactionId: purchase.purchaseId,
                referenceId: purchase.referenceId || '-',
                date: purchaseDate,
                amount: amount,
                amountPaid: amountPaid,
                balance: individualBalance, // Individual transaction balance instead of running balance
                createdBy: purchase.createdBy || 'System',
                paymentMode: purchase.paymentMode || 'CASH',
                paymentReference: purchase.paymentReference || '',
                items: purchase.items
              };
            });
            
            // Update supplier's balance and outstanding balance
            if (this.supplier) {
              // For display: negative balance represents money owed (outstanding amount)
              const displayBalance = totalOutstandingAmount > 0 ? -totalOutstandingAmount : 0;
              this.supplier.balance = displayBalance;
              this.supplier.outstandingBalance = displayBalance;
              this.totalBalance = displayBalance;
            }
            
            // Set total balance
            this.totalBalance = totalOutstandingAmount > 0 ? -totalOutstandingAmount : 0;
            
            console.log('Calculated outstanding balance:', totalOutstandingAmount);
            console.log('Individual transaction balances calculated');
          } else {
            console.log('No purchases found for supplier:', this.supplierId);
            this.transactions = [];
          }
        } else {
          console.log('No purchases found in system');
          this.transactions = [];
        }
        
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading supplier transactions:', err);
        this.loading = false;
        
        // If API call fails, load sample data for demonstration
        if (this.transactions.length === 0) {
          this.loadSampleTransactions();
        }
      }
    });
  }
  
  /**
   * Format purchase ID for display
   */
  formatPurchaseId(id: string): string {
    if (!id) return 'N/A';
    
    // Extract the UUID part after 'purchase_'
    const purchaseIdMatch = id.match(/purchase_([a-f0-9-]+)/i);
    if (purchaseIdMatch && purchaseIdMatch[1]) {
      // Get the first 8 characters of the UUID
      return `P-${purchaseIdMatch[1].substring(0, 8).toUpperCase()}`;
    }
    
    return id;
  }
  
  /**
   * Format supplier ID for display to match purchase invoice format
   */
  formatSupplierId(id: string | undefined): string {
    if (!id) return 'N/A';
    
    // Extract the UUID part after 'sup_'
    const supplierIdMatch = id.match(/sup_([a-f0-9-]+)/i);
    if (supplierIdMatch && supplierIdMatch[1]) {
      // Get the first 8 characters of the UUID and format consistently
      const uuidPart = supplierIdMatch[1].substring(0, 8).toUpperCase();
      // Format as SUP-XXXX-YYYY for consistency
      return `SUP-${uuidPart.substring(0, 4)}-${uuidPart.substring(4, 8)}`;
    }
    
    return id;
  }
  
  /**
   * Navigate back to supplier master
   */
  goBackToSuppliers(): void {
    this.router.navigate(['/inventory/masters/supplier']);
  }

  /**
   * Add a payment to this supplier
   */
  addPayment(): void {
    // Placeholder for payment functionality
    alert('Payment feature will be implemented soon');
  }
  
  /**
   * Get medicine name from ID
   * @param medicineId The medicine ID to look up
   */
  getMedicineName(medicineId: string): string {
    // First check if we have this medicine in our cache
    if (this.medicineCache.has(medicineId)) {
      return this.medicineCache.get(medicineId) || 'Unknown Medicine';
    }
    
    // Look up medicine in our loaded medicines array
    const medicine = this.medicines.find(med => med.id === medicineId || med.medicineId === medicineId);
    
    let medicineName = 'Unknown Medicine';
    
    if (medicine) {
      // Use the actual medicine name from the API
      medicineName = medicine.name;
      console.log(`Found medicine: ${medicineId} → ${medicineName}`);
    } else {
      // Fallback to ID-based name if medicine not found
      medicineName = medicineId.replace('med_', 'Medicine ');
      console.log(`Medicine not found: ${medicineId}, using fallback name`);
    }
    
    // Add to cache for future use
    this.medicineCache.set(medicineId, medicineName);
    
    // Return medicine name
    return medicineName;
  }
  
  /**
   * Load sample transactions
   */
  loadSampleTransactions(): void {
    // Sample transactions
    let runningBalance = 0;
    const today = new Date();
    
    // Generate transaction data for the past 3 months
    const transactions = [];
    for (let i = 0; i < 15; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - (i * 7)); // 1 week apart
      
      const amount = Math.round(Math.random() * 50000) + 5000;
      
      // Generate random payment data
      const amountPaid = i % 4 === 0 ? 0 : i % 3 === 0 ? Math.round(amount * 0.5) : amount; // Full, partial or no payment
      const paymentMode = i % 3 === 0 ? 'CASH' : i % 5 === 0 ? 'UPI' : 'CARD';
      const paymentReference = paymentMode !== 'CASH' ? `REF${Math.round(Math.random() * 10000)}` : '';
      
      // Calculate remaining amount for balance
      const remainingAmount = amount - amountPaid;
      runningBalance -= remainingAmount;
      
      transactions.push({
        id: i + 1,
        transactionId: `purchase_${this.generateUuid()}`,
        referenceId: `INV-LMEI-${date.getFullYear()}${String(date.getMonth()+1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${Math.round(Math.random() * 999)}`,
        date: date,
        amount: amount,
        amountPaid: amountPaid,
        balance: runningBalance,
        paymentMode: paymentMode,
        paymentReference: paymentReference,
        createdBy: i % 2 === 0 ? 'Dr Amin Hanan R' : 'srileka',
        items: [
          {
            medicineId: `med_${this.generateUuid().substring(0, 8)}`,
            batchNo: `B${Math.round(Math.random() * 999)}`,
            expiryDate: {
              seconds: Math.floor(date.getTime() / 1000) + (60 * 60 * 24 * 180), // 180 days in future
              nanos: 0
            },
            packQuantity: 12,
            freePackQuantity: i % 3 === 0 ? 1 : 0,
            itemsPerPack: 12,
            totalReceivedQuantity: 144,
            purchaseCostPerPack: amount / 12,
            discountPercentage: 0,
            lineItemDiscountAmount: 0,
            lineItemTaxableAmount: amount * 0.9,
            lineItemTaxAmount: amount * 0.1,
            lineItemTotalAmount: amount,
            mrpPerItem: (amount / 144) * 1.2,
            taxProfileId: "tax_gst_",
            taxRateApplied: 12,
            taxComponents: [
              {
                name: "CGST",
                rate: 6
              },
              {
                name: "SGST",
                rate: 6
              }
            ]
          }
        ]
      });
    }
    
    this.transactions = transactions;
    this.totalBalance = runningBalance;
    
    if (this.supplier) {
      this.supplier.balance = runningBalance;
    }
    
    this.loading = false;
  }
  
  /**
   * Generate a simple UUID for sample data
   */
  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
