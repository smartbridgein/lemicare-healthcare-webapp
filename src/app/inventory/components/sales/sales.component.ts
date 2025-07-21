import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InventoryService, Patient } from '../../services/inventory.service';
import { Sale } from '../../models/inventory.models';
import { Observable } from 'rxjs';
import { SaleDetailDialogComponent } from './sale-detail-dialog/sale-detail-dialog.component';

@Component({
  selector: 'app-sales',
  templateUrl: './sales.component.html',
  styleUrls: ['./sales.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    SaleDetailDialogComponent
  ],
  standalone: true
})
export class SalesComponent implements OnInit {
  sales: Sale[] = [];
  filteredSales: Sale[] = [];
  searchTerm: string = ''; 
  loading = true;
  
  // Store patient details for prescription sales
  patientDetailsMap: Map<string, Patient> = new Map<string, Patient>();

  // Filter options
  filterDate: string = '';
  filterType: string = 'all'; // 'all', 'otc', or 'prescription'
  filterPayment: string = 'all';

  constructor(
    private inventoryService: InventoryService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadSales();
  }
  
  @ViewChild(SaleDetailDialogComponent) saleDetailDialog?: SaleDetailDialogComponent;
  
  viewSaleDetails(sale: Sale): void {
    if (this.saleDetailDialog) {
      this.saleDetailDialog.show(sale);
    } else {
      console.error('Sale detail dialog component not found');
    }
  }

  printSaleInvoice(sale: Sale): void {
    if (this.saleDetailDialog) {
      // Open dialog in print mode
      this.saleDetailDialog.show(sale);
      setTimeout(() => {
        this.saleDetailDialog?.print();
      }, 500);
    } else {
      console.error('Sale detail dialog component not found');
    }
  }

  deleteSale(sale: Sale): void {
    // Simple implementation with browser confirm
    const saleIdentifier = sale.saleId || sale.id || '';
    
    if (confirm(`Are you sure you want to delete sale with ID ${saleIdentifier}?`)) {
      this.loading = true;
      const saleId = sale.saleId || sale.id || '';
      
      this.inventoryService.deleteSale(saleId).subscribe({
        next: () => {
          // Remove the deleted sale from the list
          this.sales = this.sales.filter(s => (s.saleId || s.id) !== saleId);
          this.filterSales(); // Refresh filtered list
          
          // Simple alert instead of snackbar
          alert('Sale deleted successfully');
          this.loading = false;
        },
        error: (error) => {
          console.error('Error deleting sale:', error);
          alert('Failed to delete sale: ' + error.message);
          this.loading = false;
        }
      });
    }
  }
  
  /**
   * Navigate to edit form for an OTC sale
   * @param sale The sale to edit
   */
  editSale(sale: Sale): void {
    const saleId = sale.saleId || sale.id || '';
    if (!saleId) {
      alert('Cannot edit sale: Invalid sale ID');
      return;
    }
    
    // Navigate to the OTC form with the sale ID
    this.router.navigate(['/inventory/sales/otc/edit', saleId]);
  }

  // Get patient name for a sale
  getPatientName(sale: Sale): string {
    if (!sale) return 'N/A';
    
    // If walkInCustomerName is available, use it
    if (sale.walkInCustomerName) {
      return sale.walkInCustomerName;
    }
    
    // For prescription sales with patientId, try to get name from patientDetailsMap
    if (sale.saleType === 'PRESCRIPTION' && sale.patientId && this.patientDetailsMap.has(sale.patientId)) {
      return this.patientDetailsMap.get(sale.patientId)!.name;
    }
    
    // Fallback to patientName or ID if available
    return sale.patientName || sale.patientId || 'N/A';
  }
  
  // Get patient phone number for a sale
  getPatientPhone(sale: Sale): string {
    if (!sale) return 'N/A';
    
    // If walkInCustomerMobile is available, use it
    if (sale.walkInCustomerMobile) {
      return sale.walkInCustomerMobile;
    }
    
    // For prescription sales with patientId, try to get phone from patientDetailsMap
    if (sale.saleType === 'PRESCRIPTION' && sale.patientId && this.patientDetailsMap.has(sale.patientId)) {
      return this.patientDetailsMap.get(sale.patientId)!.phoneNumber;
    }
    
    // Fallback to phoneNumber or N/A
    return sale.phoneNumber || 'N/A';
  }

  // Fetch patient details for sales with patientId
  fetchPatientDetailsForSales(): void {
    // First, gather all unique patientIds that need to be looked up
    const patientIdsToFetch = new Set<string>();
    
    this.filteredSales.forEach(sale => {
      if (sale.saleType === 'PRESCRIPTION' && sale.patientId && 
          (!sale.walkInCustomerName || !sale.walkInCustomerMobile) && 
          !this.patientDetailsMap.has(sale.patientId)) {
        patientIdsToFetch.add(sale.patientId);
      }
    });
    
    if (patientIdsToFetch.size === 0) {
      return; // No patient details to fetch
    }
    
    // Fetch all patients and filter for the ones we need
    this.inventoryService.getAllPatients().subscribe({
      next: (patients) => {
        patients.forEach(patient => {
          if (patientIdsToFetch.has(patient.id)) {
            this.patientDetailsMap.set(patient.id, patient);
            console.log(`Found patient details for ID ${patient.id}: ${patient.name}`);
          }
        });
      },
      error: (err) => {
        console.error('Error fetching patient details:', err);
      }
    });
  }
  
  loadSales(): void {
    this.loading = true;
    this.inventoryService.getSales().subscribe({
      next: (data) => {
        console.log('Received sales data:', data);
        // Log raw data to debug exact format
        if (data.length > 0) {
          console.log('First sale details:', JSON.stringify(data[0]));
        }
        
        // Map the backend data format to our display format
        this.sales = data.map(sale => {
          // Handle the timestamp format from the backend
          let formattedDate: string;
          if (sale.saleDate) {
            if (typeof sale.saleDate === 'object' && 'seconds' in sale.saleDate) {
              // Convert Firestore timestamp to JS Date
              const timestamp = sale.saleDate as { seconds: number, nanos: number };
              formattedDate = new Date(timestamp.seconds * 1000).toISOString().split('T')[0];
            } else {
              // It's already a string date
              formattedDate = String(sale.saleDate);
            }
          } else {
            formattedDate = new Date().toISOString().split('T')[0];
          }
          
          // Don't transform the original properties to ensure we preserve all values
          const mappedSale = {
            ...sale,
            // Keep original values, just add formatted date for display
            date: formattedDate
          };
          
          // Log the mapped sale to verify data is preserved
          console.log('Mapped sale:', 
            'saleId:', mappedSale.saleId, 
            'walkInCustomerMobile:', mappedSale.walkInCustomerMobile,
            'grandTotal:', mappedSale.grandTotal
          );
          
          return mappedSale;
        });
        
        // Sort sales in descending order by createdAt timestamp
        this.sales.sort((a, b) => {
          // Extract timestamps for comparison
          const timestampA = this.getTimestampFromSale(a);
          const timestampB = this.getTimestampFromSale(b);
          
          // Sort in descending order (newest first)
          return timestampB - timestampA;
        });
        
        this.filteredSales = [...this.sales];
        this.filterSales();
        this.loading = false;
        
        // Once sales are loaded and filtered, fetch patient details
        this.fetchPatientDetailsForSales();
      },
      error: (err) => {
        console.error('Error loading sales:', err);
        this.loading = false;
        // For development, load some sample data if API fails
        this.loadSampleData();
      }
    });
  }

  filterSales(): void {
    this.filteredSales = [...this.sales]; // Create a copy
    
    // When filter changes, we may need to fetch patient details for newly visible items
    if (this.filteredSales.length > 0) {
      setTimeout(() => this.fetchPatientDetailsForSales(), 0);
    }
    
    // Filter by sale type
    if (this.filterType && this.filterType !== 'all') {
      this.filteredSales = this.filteredSales.filter(sale => sale.saleType?.toUpperCase() === this.filterType.toUpperCase());
    }
    
    // Filter by payment method
    if (this.filterPayment && this.filterPayment !== 'all') {
      this.filteredSales = this.filteredSales.filter(sale => sale.paymentMethod?.toUpperCase() === this.filterPayment.toUpperCase());
    }
    
    // Filter by date
    if (this.filterDate) {
      const filterDateObj = new Date(this.filterDate);
      this.filteredSales = this.filteredSales.filter(sale => {
        const saleDate = this.getSaleDateObject(sale.saleDate || sale.date);
        if (!saleDate) return false;
        
        return saleDate.toDateString() === filterDateObj.toDateString();
      });
    }
    
    // Apply search term if present
    if (this.searchTerm) {
      this.applySearchTerm(this.filteredSales);
      return;
    }
  }
  
  applySearchTerm(filtered: Sale[]): void {
    const term = this.searchTerm.toLowerCase();
    this.filteredSales = filtered.filter(sale => {
      // Check various fields for the search term
      return (sale.saleId?.toLowerCase().includes(term) ||
             sale.walkInCustomerName?.toLowerCase().includes(term) ||
             sale.walkInCustomerMobile?.toLowerCase().includes(term) ||
             sale.patientName?.toLowerCase().includes(term) ||
             (typeof sale.grandTotal === 'number' && sale.grandTotal.toString().includes(term)));
    });
  }

  search(): void {
    if (!this.searchTerm) {
      this.filterSales();
      return;
    }
    if (!this.searchTerm.trim() && !this.filterDate && this.filterType === 'all') {
      this.filteredSales = [...this.sales];
      return;
    }
    
    // Apply filters
    const term = this.searchTerm.toLowerCase();
    this.filteredSales = this.sales.filter(sale => {
      // Search term filter
      const matchesSearch = !term || 
        (sale.saleId?.toLowerCase().includes(term) || sale.id?.toLowerCase().includes(term)) || 
        (sale.walkInCustomerName?.toLowerCase().includes(term) || sale.patientName?.toLowerCase().includes(term)) ||
        (sale.walkInCustomerMobile?.toLowerCase().includes(term) || sale.phoneNumber?.toLowerCase().includes(term));
      
      // Date filter
      let matchesDate = !this.filterDate;
      if (this.filterDate) {
        // Check all possible date fields
        if (sale.date && typeof sale.date === 'string') {
          matchesDate = sale.date.includes(this.filterDate);
        } else if (sale.saleDate) {
          if (typeof sale.saleDate === 'string') {
            matchesDate = sale.saleDate.includes(this.filterDate);
          } else if (typeof sale.saleDate === 'object' && 'seconds' in sale.saleDate) {
            // Convert timestamp to string and check
            const dateStr = new Date(sale.saleDate.seconds * 1000).toISOString().split('T')[0];
            matchesDate = dateStr.includes(this.filterDate);
          }
        }
      }
      
      // Sale type filter
      const matchesType = this.filterType === 'all' || 
        (this.filterType === 'otc' && sale.saleType === 'OTC') || 
        (this.filterType === 'prescription' && sale.saleType === 'PRESCRIPTION');
      
      return matchesSearch && matchesDate && matchesType;
    });
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.filterDate = '';
    this.filterType = 'all';
    this.filteredSales = [...this.sales];
  }

  formatDate(dateValue: any): string {
    if (!dateValue) return 'N/A';
    
    try {
      let date: Date;
      
      // Handle different date formats from backend
      if (typeof dateValue === 'object' && 'seconds' in dateValue) {
        // It's a Firestore timestamp
        const timestamp = dateValue as { seconds: number, nanos: number };
        date = new Date(timestamp.seconds * 1000);
      } else if (typeof dateValue === 'string') {
        // It's a date string
        date = new Date(dateValue);
      } else if (dateValue instanceof Date) {
        date = dateValue;
      } else {
        return 'Invalid Date';
      }
      
      return date.toLocaleDateString('en-GB');
    } catch (e) {
      console.error('Invalid date format:', dateValue);
      return 'Invalid Date';
    }
  }
  
  /**
   * Format sale ID to be more compact and readable
   * Converts format like 'sale_95ea0c8c-3552-460f-921e-5ceccc625c2f'
   * to something like 'SALE-95EA' or extracts a numeric part if available
   */
  formatSaleId(saleId: string | undefined): string {
    if (!saleId) return 'N/A';
    
    // If it's in the format sale_XXXX-XXXX-...
    if (saleId.startsWith('sale_')) {
      // Extract just the first segment of the UUID after 'sale_'
      const firstSegment = saleId.substring(5, 9).toUpperCase();
      return `SALE-${firstSegment}`;
    } 
    
    // If it has a numeric component, extract it
    const numericMatch = saleId.match(/\d+/);
    if (numericMatch) {
      return `SALE-${numericMatch[0]}`;
    }
    
    // Fallback - just take the first 8 chars
    return saleId.substring(0, 8).toUpperCase();
  }
  
  /**
   * Converts a date value from any supported format to a Date object
   */
  getSaleDateObject(dateValue: any): Date | null {
    if (!dateValue) return null;
    
    try {
      // Handle Firestore timestamp format
      if (typeof dateValue === 'object' && 'seconds' in dateValue) {
        const timestamp = dateValue as { seconds: number, nanos: number };
        return new Date(timestamp.seconds * 1000);
      } 
      // Handle ISO string format
      else if (typeof dateValue === 'string') {
        return new Date(dateValue);
      }
      // Already a Date object
      else if (dateValue instanceof Date) {
        return dateValue;
      }
    } catch (e) {
      console.error('Error converting date:', e);
    }
    return null;
  }
  
  /**
   * Extract timestamp in milliseconds from a sale object for sorting
   * Uses createdAt if available, otherwise falls back to saleDate
   */
  getTimestampFromSale(sale: any): number {
    try {
      // First try to get createdAt timestamp
      if (sale.createdAt) {
        if (typeof sale.createdAt === 'object' && 'seconds' in sale.createdAt) {
          return sale.createdAt.seconds * 1000;
        } else if (typeof sale.createdAt === 'string') {
          return new Date(sale.createdAt).getTime();
        } else if (sale.createdAt instanceof Date) {
          return sale.createdAt.getTime();
        }
      }
      
      // Fall back to saleDate if createdAt is not available
      if (sale.saleDate) {
        if (typeof sale.saleDate === 'object' && 'seconds' in sale.saleDate) {
          return sale.saleDate.seconds * 1000;
        } else if (typeof sale.saleDate === 'string') {
          return new Date(sale.saleDate).getTime();
        } else if (sale.saleDate instanceof Date) {
          return sale.saleDate.getTime();
        }
      }
      
      // Last resort, try date field
      if (sale.date) {
        if (typeof sale.date === 'string') {
          return new Date(sale.date).getTime();
        } else if (sale.date instanceof Date) {
          return sale.date.getTime();
        }
      }
    } catch (e) {
      console.error('Error extracting timestamp from sale:', e);
    }
    
    // Default to 0 (will appear at end of sorted list)
    return 0;
  }

  formatPaymentMethod(method: string | undefined): string {
    if (!method) return 'Unknown';
    
    const methods: {[key: string]: string} = {
      'CASH': 'Cash',
      'CARD': 'Card',
      'UPI': 'UPI',
      'CREDIT': 'Credit'
    };
    
    return methods[method] || method;
  }

  // Sample data for development/testing
  private loadSampleData(): void {
    const currentDate = new Date().toISOString().split('T')[0];
    const previousDay = new Date();
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDayString = previousDay.toISOString().split('T')[0];
    
    this.sales = [
      {
        id: 'SALE-20250628001',
        patientName: 'Mahesh Kumar',
        phoneNumber: '9876543210',
        date: currentDate,
        saleType: 'OTC',
        totalAmount: 450,
        netAmount: 450,
        paymentMethod: 'CASH',
        items: [],
        status: 'COMPLETED',
        createdAt: currentDate
      },
      {
        id: 'SALE-20250628002',
        patientName: 'Rama Devi',
        phoneNumber: '8765432109',
        date: currentDate,
        saleType: 'PRESCRIPTION',
        totalAmount: 1250.50,
        netAmount: 1250.50,
        paymentMethod: 'UPI',
        items: [],
        status: 'COMPLETED',
        createdAt: currentDate
      },
      {
        id: 'SALE-20250628003',
        patientName: 'Anand Reddy',
        phoneNumber: '7654321098',
        date: currentDate,
        saleType: 'OTC',
        totalAmount: 320,
        netAmount: 320,
        paymentMethod: 'CARD',
        items: [],
        status: 'COMPLETED',
        createdAt: currentDate
      },
      {
        id: 'SALE-20250627001',
        patientName: 'Lakshmi Prasad',
        phoneNumber: '6543210987',
        date: previousDayString,
        saleType: 'PRESCRIPTION',
        totalAmount: 2340,
        netAmount: 2340,
        paymentMethod: 'CASH',
        items: [],
        status: 'COMPLETED',
        createdAt: previousDayString
      },
      {
        id: 'SALE-20250627002',
        patientName: 'Venkatesh',
        phoneNumber: '5432109876',
        date: previousDayString,
        saleType: 'OTC',
        totalAmount: 480,
        netAmount: 480,
        paymentMethod: 'CREDIT',
        items: [],
        status: 'COMPLETED',
        createdAt: previousDayString
      }
    ];
    
    this.filteredSales = [...this.sales];
  }
}
