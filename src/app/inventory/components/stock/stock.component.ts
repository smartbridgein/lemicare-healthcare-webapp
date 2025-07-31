import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { InventoryService } from '../../services/inventory.service';
import { ToastService } from '../../../shared/services/toast.service';
import { Medicine, Supplier, TaxProfile } from '../../models/inventory.models';

// Enhanced interfaces for comprehensive stock management
interface StockByCategoryItem {
  category: string;
  totalStock: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  medicines?: EnhancedMedicine[];
  expanded?: boolean;
}

interface EnhancedMedicine {
  id: string;
  medicineId: string;
  name: string;
  genericName: string;
  category: string;
  manufacturer: string;
  location: string;
  quantityInStock: number;
  stockStatus: string;
  unitPrice: number;
  lowStockThreshold: number;
  taxProfileId: string;
  taxProfileName?: string;
  unitOfMeasurement: string;
  hsnCode?: string;
  sku?: string;
  status: string;
  expanded?: boolean;
  activeTab?: 'details' | 'supplier' | 'batches' | 'transactions';
  stockValue?: number;
  stockStatusColor?: string;
  supplierInfo?: SupplierInfo;
  batchInfo?: BatchInfo[];
  recentTransactions?: TransactionInfo[];
}

interface SupplierInfo {
  supplierId?: string;
  supplierName?: string;
  contactNumber?: string;
  email?: string;
  lastPurchaseDate?: string;
  averagePurchasePrice?: number;
  totalPurchases?: number;
}

interface BatchInfo {
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  mrp: number;
  purchasePrice: number;
  daysToExpiry?: number;
  expiryStatus?: 'FRESH' | 'NEAR_EXPIRY' | 'EXPIRED';
}

interface TransactionInfo {
  date: string;
  type: 'PURCHASE' | 'SALE' | 'RETURN';
  quantity: number;
  amount: number;
  reference: string;
  customerOrSupplier?: string;
}

interface StockSummary {
  totalMedicines: number;
  totalCategories: number;
  totalStockValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  nearExpiryItems: number;
}

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock.component.html',
  styleUrls: ['./stock.component.scss']
})
export class StockComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Main data properties
  stockByCategory: StockByCategoryItem[] = [];
  filteredStock: StockByCategoryItem[] = [];
  allMedicines: EnhancedMedicine[] = [];
  suppliers: Supplier[] = [];
  taxProfiles: TaxProfile[] = [];
  
  // UI state properties
  isLoading = false;
  error: string | null = null;
  searchTerm = '';
  selectedCategory = 'all';
  selectedStockStatus = 'all';
  sortBy = 'name';
  sortOrder: 'asc' | 'desc' = 'asc';
  
  // Summary data
  stockSummary: StockSummary = {
    totalMedicines: 0,
    totalCategories: 0,
    totalStockValue: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    nearExpiryItems: 0
  };
  
  // Available filter options
  availableCategories: string[] = [];
  stockStatusOptions = [
    { value: 'all', label: 'All Stock Status' },
    { value: 'In Stock', label: 'In Stock' },
    { value: 'Low Stock', label: 'Low Stock' },
    { value: 'Out of Stock', label: 'Out of Stock' }
  ];
  
  sortOptions = [
    { value: 'name', label: 'Medicine Name' },
    { value: 'category', label: 'Category' },
    { value: 'quantityInStock', label: 'Stock Quantity' },
    { value: 'stockValue', label: 'Stock Value' }
  ];



  constructor(
    private inventoryService: InventoryService,
    private toastService: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAllData();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAllData(): void {
    this.isLoading = true;
    this.error = null;
    
    // Load medicines, suppliers, and tax profiles in parallel
    forkJoin({
      medicines: this.inventoryService.getMedicines(true),
      suppliers: this.inventoryService.getSuppliers().pipe(
        catchError(err => {
          console.warn('Failed to load suppliers:', err);
          return [];
        })
      ),
      taxProfiles: this.inventoryService.getTaxProfiles().pipe(
        catchError(err => {
          console.warn('Failed to load tax profiles:', err);
          return [];
        })
      )
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: ({ medicines, suppliers, taxProfiles }) => {
        console.log('Loaded data:', { medicines: medicines.length, suppliers: suppliers.length, taxProfiles: taxProfiles.length });
        
        this.suppliers = suppliers;
        this.taxProfiles = taxProfiles;
        this.processMedicinesData(medicines);
        this.buildStockByCategory();
        this.calculateSummary();
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading stock data:', err);
        this.error = 'Failed to load stock data. Please try again.';
        this.toastService.showError(this.error);
        this.isLoading = false;
      }
    });
  }
  
  processMedicinesData(medicines: Medicine[]): void {
    this.allMedicines = medicines.map(medicine => {
      const enhancedMedicine: EnhancedMedicine = {
        id: medicine.id,
        medicineId: medicine.medicineId || medicine.id,
        name: medicine.name,
        genericName: medicine.genericName || '',
        category: medicine.category || 'Uncategorized',
        manufacturer: medicine.manufacturer || '',
        location: medicine.location || '',
        quantityInStock: medicine.stockQuantity || 0,
        stockStatus: medicine.stockStatus || this.calculateStockStatus(medicine.stockQuantity || 0, medicine.lowStockThreshold || 10),
        unitPrice: medicine.unitPrice || 0,
        lowStockThreshold: medicine.lowStockThreshold || 10,
        taxProfileId: medicine.taxProfileId || '',
        unitOfMeasurement: medicine.unitOfMeasurement || 'piece',
        hsnCode: medicine.hsnCode || '',
        sku: medicine.sku || '',
        status: medicine.status || 'ACTIVE',
        expanded: false,
        activeTab: 'details'
      };
      
      // Calculate additional fields
      enhancedMedicine.stockValue = enhancedMedicine.quantityInStock * enhancedMedicine.unitPrice;
      enhancedMedicine.stockStatusColor = this.getStockStatusColor(enhancedMedicine.stockStatus);
      enhancedMedicine.taxProfileName = this.getTaxProfileName(enhancedMedicine.taxProfileId);
      enhancedMedicine.supplierInfo = this.getSupplierInfo(enhancedMedicine.medicineId);
      enhancedMedicine.batchInfo = this.generateMockBatchInfo(enhancedMedicine);
      enhancedMedicine.recentTransactions = this.generateMockTransactions(enhancedMedicine);
      
      return enhancedMedicine;
    });
    
    // Extract unique categories
    this.availableCategories = ['all', ...new Set(this.allMedicines.map(m => m.category).filter(c => c))];
  }
  
  calculateStockStatus(quantity: number, threshold: number): string {
    if (quantity <= 0) return 'Out of Stock';
    if (quantity <= threshold) return 'Low Stock';
    return 'In Stock';
  }
  
  getStockStatusColor(status: string): string {
    switch (status) {
      case 'In Stock': return 'success';
      case 'Low Stock': return 'warning';
      case 'Out of Stock': return 'danger';
      default: return 'secondary';
    }
  }
  
  getTaxProfileName(taxProfileId: string): string {
    const taxProfile = this.taxProfiles.find(tp => tp.id === taxProfileId);
    return taxProfile ? `${taxProfile.profileName} (${taxProfile.totalRate}%)` : 'No Tax';
  }
  
  getSupplierInfo(medicineId: string): SupplierInfo {
    // Mock supplier info - in real implementation, this would come from purchase history
    const mockSuppliers = [
      { id: 'SUP001', name: 'AJAY PHARMACEUTICALS', contact: '+91-9876543210', email: 'ajay@pharma.com' },
      { id: 'SUP002', name: 'ALPHA AGENCIES', contact: '+91-9876543211', email: 'alpha@agencies.com' },
      { id: 'SUP003', name: 'ZARA ENTERPRISES', contact: '+91-9876543212', email: 'zara@enterprises.com' }
    ];
    
    const randomSupplier = mockSuppliers[Math.floor(Math.random() * mockSuppliers.length)];
    return {
      supplierId: randomSupplier.id,
      supplierName: randomSupplier.name,
      contactNumber: randomSupplier.contact,
      email: randomSupplier.email,
      lastPurchaseDate: this.getRandomDate(),
      averagePurchasePrice: Math.floor(Math.random() * 500) + 50,
      totalPurchases: Math.floor(Math.random() * 20) + 1
    };
  }
  
  generateMockBatchInfo(medicine: EnhancedMedicine): BatchInfo[] {
    const batchCount = Math.floor(Math.random() * 3) + 1;
    const batches: BatchInfo[] = [];
    
    for (let i = 0; i < batchCount; i++) {
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + Math.floor(Math.random() * 24) + 6);
      
      const daysToExpiry = Math.floor((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      batches.push({
        batchNumber: `B${String(i + 1).padStart(3, '0')}-${medicine.medicineId.slice(-4)}`,
        expiryDate: expiryDate.toISOString().split('T')[0],
        quantity: Math.floor(medicine.quantityInStock / batchCount) + (i === 0 ? medicine.quantityInStock % batchCount : 0),
        mrp: medicine.unitPrice * 1.2,
        purchasePrice: medicine.unitPrice * 0.8,
        daysToExpiry,
        expiryStatus: daysToExpiry < 30 ? 'NEAR_EXPIRY' : daysToExpiry < 0 ? 'EXPIRED' : 'FRESH'
      });
    }
    
    return batches;
  }
  
  generateMockTransactions(medicine: EnhancedMedicine): TransactionInfo[] {
    const transactions: TransactionInfo[] = [];
    const transactionCount = Math.floor(Math.random() * 5) + 1;
    
    for (let i = 0; i < transactionCount; i++) {
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 30));
      
      const types: ('PURCHASE' | 'SALE' | 'RETURN')[] = ['PURCHASE', 'SALE', 'RETURN'];
      const type = types[Math.floor(Math.random() * types.length)];
      const quantity = Math.floor(Math.random() * 10) + 1;
      
      transactions.push({
        date: date.toISOString().split('T')[0],
        type,
        quantity,
        amount: quantity * medicine.unitPrice,
        reference: `${type.charAt(0)}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        customerOrSupplier: type === 'PURCHASE' ? 'AJAY PHARMACEUTICALS' : 'Walk-in Customer'
      });
    }
    
    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  
  getRandomDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 90));
    return date.toISOString().split('T')[0];
  }
  
  buildStockByCategory(): void {
    const categoryMap = new Map<string, StockByCategoryItem>();
    
    this.allMedicines.forEach(medicine => {
      const category = medicine.category || 'Uncategorized';
      
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          totalStock: 0,
          totalValue: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          medicines: [],
          expanded: false
        });
      }
      
      const categoryItem = categoryMap.get(category)!;
      categoryItem.totalStock += medicine.quantityInStock;
      categoryItem.totalValue += medicine.stockValue || 0;
      
      if (medicine.stockStatus === 'Low Stock') categoryItem.lowStockCount++;
      if (medicine.stockStatus === 'Out of Stock') categoryItem.outOfStockCount++;
      
      categoryItem.medicines!.push(medicine);
    });
    
    this.stockByCategory = Array.from(categoryMap.values())
      .sort((a, b) => a.category.localeCompare(b.category));
  }
  
  calculateSummary(): void {
    this.stockSummary = {
      totalMedicines: this.allMedicines.length,
      totalCategories: this.stockByCategory.length,
      totalStockValue: this.allMedicines.reduce((sum, med) => sum + (med.stockValue || 0), 0),
      lowStockItems: this.allMedicines.filter(med => med.stockStatus === 'Low Stock').length,
      outOfStockItems: this.allMedicines.filter(med => med.stockStatus === 'Out of Stock').length,
      nearExpiryItems: this.allMedicines.filter(med => 
        med.batchInfo?.some(batch => batch.expiryStatus === 'NEAR_EXPIRY')
      ).length
    };
  }
  
  applyFilters(): void {
    let filtered = [...this.stockByCategory];
    
    // Apply category filter
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === this.selectedCategory);
    }
    
    // Apply search filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.category.toLowerCase().includes(term) ||
        item.medicines?.some(medicine =>
          medicine.name.toLowerCase().includes(term) ||
          medicine.genericName.toLowerCase().includes(term) ||
          medicine.manufacturer.toLowerCase().includes(term)
        )
      );
    }
    
    // Apply stock status filter to medicines within categories
    if (this.selectedStockStatus !== 'all') {
      filtered.forEach(category => {
        if (category.medicines) {
          category.medicines = category.medicines.filter(med => 
            med.stockStatus === this.selectedStockStatus
          );
        }
      });
      
      // Remove categories with no medicines after filtering
      filtered = filtered.filter(category => 
        category.medicines && category.medicines.length > 0
      );
    }
    
    this.filteredStock = filtered;
  }
  
  onSearchChange(): void {
    this.applyFilters();
  }
  
  onCategoryChange(): void {
    this.applyFilters();
  }
  
  onStockStatusChange(): void {
    this.applyFilters();
  }
  
  toggleCategory(category: StockByCategoryItem): void {
    category.expanded = !category.expanded;
  }
  
  toggleMedicine(medicine: EnhancedMedicine): void {
    medicine.expanded = !medicine.expanded;
  }
  
  setActiveTab(medicine: EnhancedMedicine, tab: 'details' | 'supplier' | 'batches' | 'transactions'): void {
    medicine.activeTab = tab;
  }
  
  onRefresh(): void {
    this.loadAllData();
  }
  
  goBack(): void {
    this.router.navigate(['/inventory']);
  }
  
  exportStock(): void {
    const csvData = this.generateCSVData();
    this.downloadCSV(csvData, 'stock-report.csv');
    this.toastService.showSuccess('Stock data exported successfully');
  }
  
  generateCSVData(): string {
    const headers = [
      'Medicine Name', 'Generic Name', 'Category', 'Manufacturer', 
      'Stock Quantity', 'Stock Status', 'Unit Price', 'Stock Value',
      'Location', 'HSN Code', 'Tax Profile'
    ];
    
    const rows = this.allMedicines.map(medicine => [
      medicine.name,
      medicine.genericName,
      medicine.category,
      medicine.manufacturer,
      medicine.quantityInStock.toString(),
      medicine.stockStatus,
      medicine.unitPrice.toString(),
      (medicine.stockValue || 0).toString(),
      medicine.location,
      medicine.hsnCode || '',
      medicine.taxProfileName || ''
    ]);
    
    return [headers, ...rows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
  }
  
  downloadCSV(csvData: string, filename: string): void {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
  
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  }
  
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-IN');
  }
  
  getStockPercentage(category: StockByCategoryItem, type: 'in-stock' | 'low-stock' | 'out-of-stock'): number {
    const totalMedicines = category.medicines?.length || 0;
    if (totalMedicines === 0) return 0;
    
    switch (type) {
      case 'in-stock':
        const inStockCount = totalMedicines - (category.lowStockCount || 0) - (category.outOfStockCount || 0);
        return (inStockCount / totalMedicines) * 100;
      case 'low-stock':
        return ((category.lowStockCount || 0) / totalMedicines) * 100;
      case 'out-of-stock':
        return ((category.outOfStockCount || 0) / totalMedicines) * 100;
      default:
        return 0;
    }
  }
}
