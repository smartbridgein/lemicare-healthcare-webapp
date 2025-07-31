import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { Purchase, Supplier, Medicine, TaxComponentItem, PurchaseItemDto } from '../../models/inventory.models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-purchases',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './purchases.component.html',
  styleUrls: ['./purchases.component.scss']
})
export class PurchasesComponent implements OnInit, OnDestroy {
  purchases: Purchase[] = [];
  filteredPurchases: Purchase[] = [];
  searchTerm: string = '';
  loading: boolean = true;
  suppliers: Map<string, Supplier> = new Map();
  medicines: Map<string, Medicine> = new Map();
  
  // Date filter properties
  dateFilterOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' }
  ];
  selectedDateFilter: string = 'all';
  
  // Sorting properties
  sortColumn: string = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  
  private routeSubscription: Subscription | null = null;
  
  // Modal state properties
  showPurchaseModal: boolean = false;
  selectedPurchase: Purchase | null = null;

  /**
   * Calculates the total quantity for a purchase item
   * Total quantity = (Pack Quantity + Free Pack Quantity) * Items per Pack
   * 
   * @param item The purchase item to calculate quantity for
   * @returns The total quantity
   */
  calculateTotalQuantity(item: PurchaseItemDto): number {
    const packQty = item.packQuantity || 0;
    const freePackQty = item.freePackQuantity || 0;
    const itemsPerPack = item.itemsPerPack || 1;
    
    return (packQty + freePackQty) * itemsPerPack;
  }
  
  constructor(
    private inventoryService: InventoryService,
    private route: ActivatedRoute,
    private router: Router,
    private datePipe: DatePipe
  ) { }

  ngOnInit(): void {
    // Listen for query params changes - particularly for refresh signal
    this.routeSubscription = this.route.queryParams.subscribe(params => {
      const refresh = params['refresh'];
      if (refresh) {
        console.log('Received refresh signal, forcing data reload');
        this.loadPurchases(true); // Force refresh
      } else {
        this.loadPurchases(false);
      }
    });
    
    this.loadSuppliers();
    this.loadMedicines();
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
      this.routeSubscription = null;
    }
  }

  loadPurchases(forceRefresh: boolean = false): void {
    console.log('Loading purchases, force refresh:', forceRefresh);
    this.loading = true;
    this.inventoryService.getPurchases(true, forceRefresh).subscribe({
      next: (data) => {
        // Process numeric values immediately upon loading
        const processedData = data.map(purchase => {
          // Ensure all purchase totals are numbers
          const processedPurchase = {...purchase};
          processedPurchase.totalTaxableAmount = Number(processedPurchase.totalTaxableAmount || 0);
          processedPurchase.totalDiscountAmount = Number(processedPurchase.totalDiscountAmount || 0);
          processedPurchase.totalTaxAmount = Number(processedPurchase.totalTaxAmount || 0);
          processedPurchase.totalAmount = Number(processedPurchase.totalAmount || 0);
          
          // Process all items to ensure numeric values
          if (processedPurchase.items && processedPurchase.items.length) {
            processedPurchase.items = processedPurchase.items.map(item => ({
              ...item,
              packQuantity: Number(item.packQuantity || 0),
              freePackQuantity: Number(item.freePackQuantity || 0),
              itemsPerPack: Number(item.itemsPerPack || 1),
              totalReceivedQuantity: Number(item.totalReceivedQuantity || 0),
              purchaseCostPerPack: Number(item.purchaseCostPerPack || 0),
              discountPercentage: Number(item.discountPercentage || 0),
              lineItemDiscountAmount: Number(item.lineItemDiscountAmount || 0),
              lineItemTaxableAmount: Number(item.lineItemTaxableAmount || 0),
              lineItemTaxAmount: Number(item.lineItemTaxAmount || 0),
              lineItemTotalAmount: Number(item.lineItemTotalAmount || 0),
              mrpPerItem: Number(item.mrpPerItem || 0),
              taxRateApplied: Number(item.taxRateApplied || 0)
            }));
          }
          return processedPurchase;
        });
        
        // Save the processed data
        this.purchases = processedData;
        
        // Apply date filter (if any) to the loaded purchases
        this.applyDateFilter();
        
        // Apply text search filter (if any)
        if (this.searchTerm.trim()) {
          this.search();
        }
        
        // Apply sorting after filters
        this.sortPurchases();
        
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading purchases', err);
        this.loading = false;
        // For development, load some sample data if API fails
        this.loadSampleData();
      }
    });
  }

  loadSuppliers(): void {
    this.inventoryService.getSuppliers().subscribe({
      next: (data: Supplier[]) => {
        console.log('All suppliers loaded:', data);
        
        // Reset suppliers map to avoid stale data
        this.suppliers.clear();
        
        // Only add active suppliers
        const activeSuppliers = data.filter(supplier => {
          // Debug log to see what's being checked
          console.log(`Supplier ${supplier.name}, status: ${supplier.status}`);
          
          // Properly filter inactive suppliers - check if status exists and is not 'INACTIVE'
          // Both undefined status and any status other than 'INACTIVE' are considered active
          return supplier.status !== 'INACTIVE';
        });
        
        console.log('Active suppliers after filtering:', activeSuppliers);
        
        // Add active suppliers to the map
        activeSuppliers.forEach(supplier => {
          const id = supplier.id || supplier.supplierId;
          if (id) {
            this.suppliers.set(id, supplier);
          }
        });
      },
      error: (err: any) => {
        console.error('Error loading suppliers:', err);
      },
      complete: () => {}
    });
  }

  getSupplierName(supplierId: string): string {
    return this.suppliers.get(supplierId)?.name || 'Unknown Supplier';
  }

  getSupplierContact(supplierId: string): string {
    return this.suppliers.get(supplierId)?.contactNumber || 'N/A';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  }
  
  formatTimestampDate(timestamp: any): string {
    if (!timestamp) return 'N/A';
    
    // Handle Firestore timestamp format with seconds and nanos
    if (timestamp && timestamp.seconds) {
      const date = new Date(timestamp.seconds * 1000);
      return this.datePipe.transform(date, 'MMM dd, yyyy') || 'N/A';
    }
    
    return this.formatDate(timestamp);
  }

  formatTimestampDateWithTime(timestamp: any): string {
    if (!timestamp) return 'N/A';
    
    // Handle Firestore timestamp format with seconds and nanos
    if (timestamp && timestamp.seconds) {
      const date = new Date(timestamp.seconds * 1000);
      return this.datePipe.transform(date, 'MMM dd, yyyy h:mm a') || 'N/A';
    }
    
    // Handle regular date string or Date object
    if (timestamp) {
      const date = new Date(timestamp);
      return this.datePipe.transform(date, 'MMM dd, yyyy h:mm a') || 'N/A';
    }
    
    return 'N/A';
  }

  /**
   * Format purchase ID to make it shorter and more readable
   * Example: 'purchase_03fcc8c1-e1d1-42b1-a140-8ffcbdc34668' -> 'P-03fc'
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
   * Function to parse different date formats
   * Reuses the date parsing logic from sort function
   */
  parseDate(dateValue: any): number {
    if (!dateValue) return 0;
    
    try {
      // Check if it's a timestamp object with seconds/nanos (from Firestore)
      if (dateValue.seconds) {
        return dateValue.seconds * 1000;
      }
      
      // If it's a string with specific format (e.g., "Jul 14, 2025")
      if (typeof dateValue === 'string') {
        // Try standard date parsing first
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          return date.getTime();
        }
        
        // If that fails, try to parse the specific format
        const parts = dateValue.split(' ');
        if (parts.length === 3) {
          const month = parts[0]; // 'Jul'
          const day = parseInt(parts[1].replace(',', '')); // '14'
          const year = parseInt(parts[2]); // '2025'
          
          const monthMap: {[key: string]: number} = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          };
          
          if (monthMap[month] !== undefined) {
            const parsedDate = new Date(year, monthMap[month], day);
            return parsedDate.getTime();
          }
        }
      }
      
      // Last resort, try to convert to date
      return new Date(dateValue).getTime();
    } catch (e) {
      console.error('Error parsing date:', e, dateValue);
      return 0;
    }
  }
  
  /**
   * Apply date filter to the purchases list
   */
  applyDateFilter(): void {
    // If no date filter selected or 'all' is selected, show all purchases
    if (!this.selectedDateFilter || this.selectedDateFilter === 'all') {
      this.filteredPurchases = [...this.purchases];
      return;
    }
    
    const now = new Date();
    let startDate: Date;
    
    // Calculate the start date based on the selected filter
    switch (this.selectedDateFilter) {
      case 'today':
        // Start of today
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
        
      case 'week':
        // Start of this week (Sunday)
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        break;
        
      case 'month':
        // Start of this month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
        
      case 'year':
        // Start of this year
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
        
      default:
        this.filteredPurchases = [...this.purchases];
        return;
    }
    
    // Convert to timestamp for comparison
    const startTimestamp = startDate.getTime();
    
    console.log(`Filtering purchases from ${startDate.toLocaleDateString()}`);
    
    // Filter purchases based on date
    this.filteredPurchases = this.purchases.filter(purchase => {
      // Get timestamp from invoice date or created date
      const purchaseTimestamp = this.parseDate(purchase.invoiceDate) || this.parseDate(purchase.createdAt);
      
      // Include purchase if its date is after or equal to the start date
      return purchaseTimestamp >= startTimestamp;
    });
    
    console.log(`Filtered to ${this.filteredPurchases.length} purchases`);
    
    // Re-apply sorting after filtering
    this.sortPurchases();
  }
  
  /**
   * Called when the date filter dropdown selection changes
   */
  onDateFilterChange(): void {
    this.applyDateFilter();
    // Re-apply search filter if needed
    if (this.searchTerm.trim()) {
      this.search();
    }
    // Apply sorting after filtering
    this.sortPurchases();
  }
  
  /**
   * Sort purchases based on the current sort column and direction
   */
  sortPurchases(): void {
    if (!this.filteredPurchases || this.filteredPurchases.length === 0) {
      return;
    }
    
    console.log(`Sorting purchases by ${this.sortColumn} in ${this.sortDirection} order`);
    
    this.filteredPurchases.sort((a, b) => {
      let valA: any;
      let valB: any;
      
      // Extract values based on sort column
      switch (this.sortColumn) {
        case 'invoiceId':
          valA = a.referenceId || this.formatPurchaseId(a.id || a.purchaseId);
          valB = b.referenceId || this.formatPurchaseId(b.id || b.purchaseId);
          break;
          
        case 'supplierId':
          valA = this.formatSupplierId(a.supplierId);
          valB = this.formatSupplierId(b.supplierId);
          break;
          
        case 'supplierName':
          valA = this.getSupplierName(a.supplierId);
          valB = this.getSupplierName(b.supplierId);
          break;
          
        case 'contactNumber':
          valA = this.getSupplierContact(a.supplierId);
          valB = this.getSupplierContact(b.supplierId);
          break;
          
        case 'invoiceDate':
          valA = this.parseDate(a.invoiceDate) || this.parseDate(a.createdAt);
          valB = this.parseDate(b.invoiceDate) || this.parseDate(b.createdAt);
          break;
          
        case 'createdAt':
          valA = this.parseDate(a.createdAt);
          valB = this.parseDate(b.createdAt);
          break;
          
        case 'totalAmount':
          valA = Number(a.totalAmount || 0);
          valB = Number(b.totalAmount || 0);
          break;
          
        default:
          valA = this.parseDate(a.createdAt) || this.parseDate(a.invoiceDate);
          valB = this.parseDate(b.createdAt) || this.parseDate(b.invoiceDate);
      }
      
      // Compare values based on type
      let comparison = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else {
        // Convert to string for comparison if not number
        const strA = String(valA || '').toLowerCase();
        const strB = String(valB || '').toLowerCase();
        comparison = strA.localeCompare(strB);
      }
      
      // Apply sort direction
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }
  
  /**
   * Set sort column and direction
   * If the same column is clicked again, toggle sort direction
   */
  setSortColumn(column: string): void {
    if (this.sortColumn === column) {
      // Toggle direction if same column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Set new column and default to ascending
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    
    // Re-sort the data
    this.sortPurchases();
  }
  
  /**
   * Get the sort icon based on current sort state
   */
  getSortIcon(column: string): string {
    if (this.sortColumn !== column) {
      return 'fa-sort'; // Neutral sort icon
    }
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }
  
  /**
   * Search function - searches the date-filtered results
   * Note: Always call applyDateFilter() before this in case date filter has changed
   */
  search(): void {
    const searchLower = this.searchTerm.toLowerCase().trim();
    
    if (!searchLower) {
      // If search is cleared, reset to date-filtered list
      this.applyDateFilter();
      return;
    }
    
    // Search in date-filtered purchases
    const dateFiltered = [...this.purchases];
    this.applyDateFilter();
    
    this.filteredPurchases = this.filteredPurchases.filter(purchase => {
      // Search in supplier name
      const supplierName = this.getSupplierName(purchase.supplierId).toLowerCase();
      if (supplierName.includes(searchLower)) return true;
      
      // Search in supplier contact
      const contact = this.getSupplierContact(purchase.supplierId).toLowerCase();
      if (contact.includes(searchLower)) return true;
      
      // Search in invoice ID
      const invoiceId = (purchase.referenceId || this.formatPurchaseId(purchase.id || purchase.purchaseId)).toLowerCase();
      if (invoiceId.includes(searchLower)) return true;
      
      return false;
    });
    
    // Re-apply sorting after search filtering
    this.sortPurchases();
  }

  loadMedicines(): void {
    this.inventoryService.getMedicines().subscribe({
      next: (data: Medicine[]) => {
        console.log('All medicines loaded:', data);
        
        // Reset medicines map to avoid stale data
        this.medicines.clear();
        
        // Only add active medicines
        const activeMedicines = data.filter(medicine => {
          // Debug log to see what's being checked
          console.log(`Medicine ${medicine.name}, status: ${medicine.status}`);
          
          // Properly filter inactive medicines - check if status exists and is not 'INACTIVE'
          // Both undefined status and any status other than 'INACTIVE' are considered active
          return medicine.status !== 'INACTIVE';
        });
        
        console.log('Active medicines after filtering:', activeMedicines);
        
        // Add active medicines to the map
        activeMedicines.forEach(medicine => {
          const id = medicine.id || medicine.medicineId;
          if (id) {
            this.medicines.set(id, medicine);
          }
        });
      },
      error: (err: any) => {
        console.error('Error loading medicines:', err);
      },
      complete: () => {}
    });
  }
  
  getMedicineName(medicineId: string): string {
    return this.medicines.get(medicineId)?.name || 'Unknown Medicine';
  }
  
  viewPurchaseDetails(purchase: Purchase): void {
    console.log('Viewing purchase details for:', purchase);
    
    // Navigate to purchase view page instead of showing modal
    const purchaseId = purchase.id || purchase.purchaseId;
    if (purchaseId) {
      this.router.navigate(['/inventory/purchases/view', purchaseId]);
    } else {
      console.error('Cannot view purchase details: No purchase ID found', purchase);
      alert('Cannot view purchase details: No ID found');
    }
  }

  /**
   * Navigate to edit purchase page
   */
  editPurchase(purchase: Purchase): void {
    console.log('Editing purchase:', purchase);
    
    const purchaseId = purchase.id || purchase.purchaseId;
    if (purchaseId) {
      this.router.navigate(['/inventory/purchases/edit', purchaseId]);
    } else {
      console.error('Cannot edit purchase: No purchase ID found', purchase);
      alert('Cannot edit purchase: No ID found');
    }
  }

  /**
   * Close the purchase details modal and reset selected purchase
   */
  closePurchaseModal(): void {
    this.showPurchaseModal = false;
    this.selectedPurchase = null;
  }
  
  /**
    if (item.taxComponents && item.taxComponents.length > 0) {
      // If no taxRateApplied is provided, calculate it from components
      if (!totalTaxRate) {
        totalTaxRate = item.taxComponents.reduce((sum: number, tc: TaxComponentItem) => sum + (tc.rate || 0), 0);
      }
    }
    
    // If we still don't have a total tax rate but have a component rate, use that
    if (!totalTaxRate && componentRate) {
      totalTaxRate = componentRate;
    }
    
    // If we have no tax rate, we can't calculate
    if (!totalTaxRate) return 0;
    
    // Calculate the component's proportion of the total tax
    const componentProportion = componentRate / totalTaxRate;
    
    // Calculate the tax amount based on the taxable amount and the component's proportion
    const totalTaxAmount = taxableAmount * totalTaxRate / 100;
    const componentTaxAmount = totalTaxAmount * componentProportion;
    
    return componentTaxAmount;
  }
  
  /**
   * Calculate the total amount for a specific tax component across all purchase items
   * @param componentName The name of the tax component (e.g., 'CGST', 'SGST')
   * @returns The total amount for the specified tax component
   */
  calculateTotalForTaxComponent(componentName: string): number {
    if (!this.selectedPurchase || !this.selectedPurchase.items) return 0;
    
    let total = 0;
    
    // Go through each purchase item
    this.selectedPurchase.items.forEach(item => {
      if (item.taxComponents && item.taxComponents.length > 0) {
        // Find the matching tax component by name
        const matchingComponent = item.taxComponents.find(tc => tc.name === componentName);
        if (matchingComponent) {
          // Use the pre-calculated tax amount or calculate it now
          const taxAmount = matchingComponent.taxAmount || 
                          this.calculateComponentTaxAmount(matchingComponent, item);
          total += taxAmount;
        }
      }
    });
    
    return total;
  }

  /**
   * Get component tax amount for the tax breakdown section
   * @param componentName Name of the tax component (CGST, SGST, etc)
   * @returns The calculated tax amount
   */
  getComponentTaxAmount(componentName: string): number {
    if (!this.selectedPurchase || !this.selectedPurchase.items || 
        !this.selectedPurchase.items.length) {
      return 0;
    }

    // Sum up all individual tax component amounts across all items
    let totalComponentAmount = 0;
    
    for (const item of this.selectedPurchase.items) {
      if (item.taxComponents && item.taxComponents.length > 0) {
        // Find the matching tax component for this item
        const matchingComponent = item.taxComponents.find(tc => tc.name === componentName);
        if (matchingComponent) {
          // If the tax component has a pre-calculated amount, use it
          if (matchingComponent.taxAmount !== undefined && matchingComponent.taxAmount !== null) {
            totalComponentAmount += Number(matchingComponent.taxAmount);
          } else {
            // Otherwise calculate it based on proportional rate
            const itemTaxAmount = Number(item.lineItemTaxAmount || 0);
            const componentRate = Number(matchingComponent.rate || 0);
            const totalRate = Number(item.taxRateApplied || 0) || 
              (item.taxComponents?.reduce((sum, tc) => sum + Number(tc.rate || 0), 0) || 0);
            
            if (totalRate > 0) {
              const componentProportion = componentRate / totalRate;
              totalComponentAmount += itemTaxAmount * componentProportion;
            }
          }
        }
      }
    }
    
    // For tax components, use a proportional calculation from the total tax
    const totalTaxAmount = Number(this.selectedPurchase?.totalTaxAmount || 0);
    
    if (totalComponentAmount === 0 && totalTaxAmount > 0) {
      // If no components found but we have a total tax amount, use a fallback calculation
      
      // Assume standard GST breakdown if missing specific component data
      if (componentName === 'CGST' || componentName === 'SGST') {
        // Split total tax 50/50 between CGST and SGST for standard GST
        totalComponentAmount = totalTaxAmount / 2;
      } else if (componentName === 'IGST' && !this.hasTaxComponent('CGST') && !this.hasTaxComponent('SGST')) {
        // Use full tax amount for IGST if no CGST/SGST components
        totalComponentAmount = totalTaxAmount;
      }
    }
    
    // Log for debugging
    console.log(`Tax component ${componentName}: ${totalComponentAmount}`);
    
    // Round to 2 decimal places for display
    return Math.round(totalComponentAmount * 100) / 100;
  }

  /**
   * Calculate tax amount for a specific tax component on a purchase item
   * @param component The tax component
   * @param item The purchase item
   * @returns The calculated tax amount
   */
  calculateComponentTaxAmount(component: TaxComponentItem, item: PurchaseItemDto): number {
    if (!component || !item) return 0;
    
    const taxableAmount = Number(item.lineItemTaxableAmount) || 0;
    const rate = Number(component.rate) || 0;
    
    // Calculate and round to 2 decimal places
    return Math.round((taxableAmount * rate / 100) * 100) / 100;
  }

  /**
   * Check if a specific tax component exists in the purchase
   * @param componentName Name of the tax component to check
   * @returns True if the component exists
   */
  hasTaxComponent(componentName: string): boolean {
    if (!this.selectedPurchase || !this.selectedPurchase.items || 
        !this.selectedPurchase.items.length) {
      return false;
    }
    
    // Check all items for the specified tax component
    return this.selectedPurchase.items.some(item => 
      item.taxComponents?.some(tc => tc.name === componentName)
    );
  }



  // Sample data for development/testing
  private loadSampleData(): void {
    const currentDate = new Date().toISOString().split('T')[0];
    const previousDay = new Date();
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDayString = previousDay.toISOString().split('T')[0];
    
    this.purchases = [
      {
        id: '20250628003',
        supplierId: 'SP-2025057',
        invoiceDate: currentDate,
        referenceId: 'REF001',
        totalAmount: 24370,
        items: [], // Required field for Purchase interface
        purchaseItems: [],
        createdAt: currentDate
      },
      {
        id: '20250628002',
        supplierId: 'SP-2025055',
        invoiceDate: currentDate,
        referenceId: 'REF002',
        totalAmount: 26000,
        items: [], // Required field for Purchase interface
        purchaseItems: [],
        createdAt: currentDate
      },
      {
        id: '20250628001',
        supplierId: 'SP-2025057',
        invoiceDate: currentDate,
        referenceId: 'REF003',
        totalAmount: 12500,
        items: [], // Required field for Purchase interface
        purchaseItems: [],
        createdAt: currentDate
      },
      {
        id: '20250627004',
        supplierId: 'SP-2025057',
        invoiceDate: previousDayString,
        referenceId: 'REF004',
        totalAmount: 15000,
        items: [], // Required field for Purchase interface
        purchaseItems: [],
        createdAt: previousDayString
      },
      {
        id: '20250627003',
        supplierId: 'SP-2025055',
        invoiceDate: previousDayString,
        referenceId: 'REF005',
        totalAmount: 35370,
        items: [], // Required field for Purchase interface
        purchaseItems: [],
        createdAt: previousDayString
      }
    ];
    
    this.filteredPurchases = [...this.purchases];
    
    // Sample suppliers
    this.suppliers.set('SP-2025057', {
      id: 'SP-2025057',
      name: 'ALPHA AGENCIES',
      contactNumber: '7550020555'
    });
    
    this.suppliers.set('SP-2025055', {
      id: 'SP-2025055',
      name: 'AJAX PHARMACEUTICALS',
      contactNumber: '4282592522'
    });
  }
}
