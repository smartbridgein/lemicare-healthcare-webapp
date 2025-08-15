import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../shared/billing.service';
import { CashMemo } from '../shared/billing.model';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService, UserProfile } from '../../auth/shared/auth.service';

// Define service interface
interface Service {
  id: string;
  name: string;
  price: number;
  description?: string;
  group: string;
  rate?: number;
  active?: boolean;
}

@Component({
  selector: 'app-cash-memo-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './cash-memo-list.component.html',
  styleUrls: ['./cash-memo-list.component.scss']
})
export class CashMemoListComponent implements OnInit {
  cashMemos: CashMemo[] = [];
  filteredCashMemos: CashMemo[] = [];
  loading = true;
  searchTerm = '';
  selectedCashMemo: any = null;
  detailedCashMemo: any = null;
  loadingDetails = false;

  // Permission properties
  isSuperAdmin = false;
  private user: UserProfile | null = null;
  
  // Services data for mapping service IDs to names
  services: Service[] = [];
  servicesLoaded = false;
  
  // Date filter properties
  dateFilterOptions = ['All', 'Today', 'This Week', 'This Month', 'This Year', 'Custom'];
  selectedDateFilter = 'All';
  customDateRange = {
    startDate: '',
    endDate: ''
  };
  showCustomDateRange = false;

  constructor(
    private billingService: BillingService,
    private modalService: NgbModal,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadUserPermissions();
    this.loadServices();
    this.loadCashMemos();
  }

  /**
   * Check if current user has super admin permissions
   * Only super admin can delete cash memos
   */
  private loadUserPermissions(): void {
    this.user = this.authService.getCurrentUser();
    
    if (this.user) {
      // Check if user is super admin (by email or role)
      const email = this.user.email || '';
      const role = this.user.role || '';
      
      const isSuperAdminEmail = email.toLowerCase() === 'hanan-clinic@lemicare.com';
      const isSuperAdminRole = role.toUpperCase() === 'ROLE_SUPER_ADMIN' || 
                             role.toUpperCase() === 'SUPER_ADMIN';
      
      this.isSuperAdmin = isSuperAdminEmail || isSuperAdminRole;
      
      console.log('Cash Memo List Permissions:', {
        email,
        role,
        isSuperAdmin: this.isSuperAdmin
      });
    }
  }

  // Load services from API
  loadServices(): void {
    this.http.get<any>(`${environment.apiUrl}/api/services`).subscribe({
      next: (response: any) => {
        console.log('Services API response:', response);
        // Check if response has the expected structure
        if (response && response.data && Array.isArray(response.data)) {
          // Map API response to Service interface
          this.services = response.data.map((item: any) => ({
            id: item.id,
            name: item.name,
            price: item.rate || 0,
            description: item.description || '',
            group: item.group || 'GENERAL',
            rate: item.rate || 0,
            active: item.active !== undefined ? item.active : true
          }));
          
          console.log('Services loaded:', this.services.length);
          this.servicesLoaded = true;
        } else {
          console.warn('Unexpected API response format for services');
          this.loadFallbackServices();
        }
      },
      error: (error: any) => {
        console.error('Error loading services', error);
        this.loadFallbackServices();
      }
    });
  }
  
  // Load fallback services when API fails
  private loadFallbackServices(): void {
    console.log('Loading fallback service data');
    this.services = [
      { id: 'SVC001', name: 'General Consultation', price: 500, description: 'General doctor consultation', group: 'CONSULTATION', rate: 500, active: true },
      { id: 'SVC002', name: 'Specialist Consultation', price: 1000, description: 'Specialist doctor consultation', group: 'CONSULTATION', rate: 1000, active: true },
      { id: 'SVC003', name: 'Blood Test - Basic', price: 800, description: 'Basic blood test panel', group: 'OPD', rate: 800, active: true },
      { id: 'SVC004', name: 'X-Ray', price: 1200, description: 'X-Ray imaging', group: 'OPD', rate: 1200, active: true }
    ];
    this.servicesLoaded = true;
  }
  
  // Get service name by ID
  getServiceNameById(serviceId: string): string {
    const service = this.services.find(s => s.id === serviceId);
    return service ? service.name : serviceId; // Fallback to ID if service not found
  }

  loadCashMemos(): void {
    this.loading = true;
    this.billingService.getAllCashMemos().subscribe({
      next: (data: CashMemo[]) => {
        // Sort cash memos by date and time in descending order (newest first)
        this.cashMemos = this.sortCashMemosByDateDesc(data);
        this.filterCashMemos();
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading cash memos', error);
        this.loading = false;
      }
    });
  }

  filterCashMemos(): void {
    // First, filter by search term
    if (this.searchTerm === '') {
      // If search term is empty, use all cash memos
      let filteredBySearch = [...this.cashMemos];
      // Then apply date filtering
      this.filteredCashMemos = this.applyDateFilter(filteredBySearch);
      return;
    }
    
    // For non-empty search, ensure case-insensitive comparison
    const searchTermLower = this.searchTerm.toLowerCase().trim();
    
    console.log('Filtering cash memos with search term:', searchTermLower);
    
    let filteredBySearch = this.cashMemos.filter(cashMemo => {
      // Check patient name
      const nameMatch = cashMemo.patientName?.toLowerCase().includes(searchTermLower);
      
      // Check bill ID
      const billMatch = cashMemo.billId?.toLowerCase().includes(searchTermLower);
      
      // Check payment mode
      const paymentMatch = cashMemo.modeOfPayment?.toLowerCase().includes(searchTermLower);
      
      // Debug info for first few items
      if (this.cashMemos.indexOf(cashMemo) < 3) {
        console.log('Filter check for item:', {
          patientName: cashMemo.patientName,
          billId: cashMemo.billId,
          modeOfPayment: cashMemo.modeOfPayment,
          nameMatch,
          billMatch,
          paymentMatch
        });
      }
      
      return nameMatch || billMatch || paymentMatch;
    });
    
    console.log(`Filtering result: ${filteredBySearch.length} of ${this.cashMemos.length} matched`);
    
    // Then apply date filtering
    this.filteredCashMemos = this.applyDateFilter(filteredBySearch);
    
    // No need to sort again as the source array is already sorted
  }
  
  /**
   * Apply selected date filter to cash memos
   * @param cashMemos Array of cash memos to filter
   * @returns Filtered array based on selected date range
   */
  applyDateFilter(cashMemos: CashMemo[]): CashMemo[] {
    if (this.selectedDateFilter === 'All') {
      return cashMemos;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999); // End of today
    
    let startDate: Date;
    let endDate: Date = endOfDay;
    
    switch (this.selectedDateFilter) {
      case 'Today':
        startDate = today;
        break;
      
      case 'This Week':
        // Start of the current week (Sunday)
        startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay()); // Go to the first day of the week (Sunday)
        break;
      
      case 'This Month':
        // Start of the current month
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      
      case 'This Year':
        // Start of the current year
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      
      case 'Custom':
        if (this.customDateRange.startDate && this.customDateRange.endDate) {
          startDate = new Date(this.customDateRange.startDate);
          startDate.setHours(0, 0, 0, 0); // Start of the start date
          
          endDate = new Date(this.customDateRange.endDate);
          endDate.setHours(23, 59, 59, 999); // End of the end date
        } else {
          return cashMemos; // Return all if custom range is not complete
        }
        break;
      
      default:
        return cashMemos; // Default case, return all
    }
    
    // Filter cash memos within the date range
    return cashMemos.filter(cashMemo => {
      // Use createdDate if available, otherwise use date
      const memoDate = new Date(cashMemo.createdDate || cashMemo.date);
      return memoDate >= startDate && memoDate <= endDate;
    });
  }
  
  /**
   * Handle change of the date filter selection
   */
  onDateFilterChange(): void {
    this.showCustomDateRange = this.selectedDateFilter === 'Custom';
    
    // If changing away from custom filter, reset the custom date range
    if (!this.showCustomDateRange) {
      this.customDateRange = {
        startDate: '',
        endDate: ''
      };
    } else {
      // If selecting custom filter, set default date range to current month
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      this.customDateRange = {
        startDate: this.formatDateToLocal(firstDayOfMonth), // Format as YYYY-MM-DD using local timezone
        endDate: this.formatDateToLocal(today) // Format as YYYY-MM-DD using local timezone
      };
    }
    
    // Apply the filter
    this.filterCashMemos();
  }
  
  /**
   * Handle changes to the custom date range
   */
  onCustomDateRangeChange(): void {
    if (this.selectedDateFilter === 'Custom') {
      this.filterCashMemos();
    }
  }

  /**
   * Format date to local timezone YYYY-MM-DD format
   * @param date The date to format
   * @returns Formatted date string in YYYY-MM-DD format
   */
  formatDateToLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Sorts cash memos by date and time in descending order (newest first)
   * @param cashMemos The array of cash memos to sort
   * @returns Sorted array of cash memos
   */
  sortCashMemosByDateDesc(cashMemos: CashMemo[]): CashMemo[] {
    return [...cashMemos].sort((a, b) => {
      // Use timestamp first, then createdTimestamp, then createdDate, then date as fallback
      const timestampA = (a as any).timestamp || (a as any).createdTimestamp || a.createdDate || a.date;
      const timestampB = (b as any).timestamp || (b as any).createdTimestamp || b.createdDate || b.date;
      
      // Sort in descending order (newest first)
      return new Date(timestampB).getTime() - new Date(timestampA).getTime();
    });
  }

  /**
   * Format cash memo date and time for display
   * Uses timestamp field first, then falls back to other date fields
   */
  formatCashMemoDateTime(cashMemo: CashMemo): string {
    // Priority: timestamp > createdTimestamp > createdDate > date
    const timestamp = (cashMemo as any).timestamp || (cashMemo as any).createdTimestamp;
    const dateOnly = cashMemo.createdDate || cashMemo.date;
    
    if (timestamp) {
      // Format timestamp with both date and time
      const date = new Date(timestamp);
      return this.formatDateTimeString(date);
    } else if (dateOnly) {
      // Format date only (fallback for older records)
      const date = new Date(dateOnly);
      return this.formatDateString(date);
    }
    
    return 'N/A';
  }

  /**
   * Format date and time as 'dd/MM/yyyy HH:mm'
   */
  private formatDateTimeString(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  /**
   * Format date only as 'dd/MM/yyyy'
   */
  private formatDateString(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  }

  onSearchChange(): void {
    console.log('Search term changed:', this.searchTerm);
    // Make sure to trim the search term to remove any leading/trailing whitespace
    this.searchTerm = this.searchTerm.trim();
    this.filterCashMemos();
  }

  calculateTotalAmount(): number {
    return this.filteredCashMemos.reduce((total, cashMemo) => total + cashMemo.amount, 0);
  }

  calculateSubtotal(cashMemo: any): number {
    if (!cashMemo || !cashMemo.lineItems || cashMemo.lineItems.length === 0) {
      return 0;
    }
    
    // Calculate subtotal from line items (before discount and tax)
    return cashMemo.lineItems.reduce((subtotal: number, item: any) => {
      const itemTotal = (item.quantity || 0) * (item.rate || 0);
      return subtotal + itemTotal;
    }, 0);
  }

  getTotalQuantity(lineItems: any[]): number {
    if (!lineItems || lineItems.length === 0) {
      return 0;
    }
    
    return lineItems.reduce((total: number, item: any) => {
      return total + (item.quantity || 0);
    }, 0);
  }

  getDiscountedItemsCount(lineItems: any[]): number {
    if (!lineItems || lineItems.length === 0) {
      return 0;
    }
    
    return lineItems.filter((item: any) => item.discount && item.discount > 0).length;
  }

  calculateDiscountAmount(cashMemo: any): number {
    let totalDiscount = 0;
    
    // Calculate line-item level discounts
    if (cashMemo && cashMemo.lineItems && cashMemo.lineItems.length > 0) {
      cashMemo.lineItems.forEach((item: any) => {
        if (item.discount && item.discount > 0) {
          totalDiscount += parseFloat(item.discount) || 0;
        }
      });
    }
    
    // Add overall discount
    if (cashMemo && cashMemo.overallDiscount && cashMemo.overallDiscount > 0) {
      const subtotal = this.calculateSubtotal(cashMemo);
      const discountType = cashMemo.discountType || 'AMT';
      
      if (discountType === 'AMT') {
        totalDiscount += cashMemo.overallDiscount;
      } else {
        totalDiscount += subtotal * (cashMemo.overallDiscount / 100);
      }
    }
    
    return totalDiscount;
  }

  deleteCashMemo(id: string | undefined): void {
    if (!id) return;
    
    if (confirm('Are you sure you want to delete this cash memo?')) {
      this.billingService.deleteCashMemo(id).subscribe({
        next: () => {
          this.cashMemos = this.cashMemos.filter(cashMemo => cashMemo.id !== id);
          this.filterCashMemos();
          alert('Cash memo deleted successfully');
        },
        error: (error: any) => {
          console.error('Error deleting cash memo', error);
          alert('Failed to delete cash memo');
        }
      });
    }
  }

  viewCashMemo(cashMemo: CashMemo, modal: any): void {
    this.selectedCashMemo = cashMemo;
    this.loadingDetails = true;
    
    // Open the modal first so user sees something is happening
    this.modalService.open(modal, { size: 'xl', centered: true });
    
    // Then load the detailed data
    if (cashMemo.id) {
      this.billingService.getCashMemoById(cashMemo.id).subscribe({
        next: (data: CashMemo) => {
          console.log('Cash memo details from API:', data);
          
          // Ensure line items have service names mapped from service IDs
          if (data.lineItems && data.lineItems.length > 0) {
            data.lineItems = data.lineItems.map((item: any) => {
              // If serviceName is missing but serviceId exists, get the actual service name from API
              if (!item.serviceName && item.serviceId) {
                const actualServiceName = this.getServiceNameById(item.serviceId);
                // Only use the actual service name if it's different from the ID (meaning we found it)
                if (actualServiceName !== item.serviceId) {
                  item.serviceName = actualServiceName;
                } else {
                  // Fallback to description or a formatted service identifier
                  item.serviceName = item.description || `Service: ${item.serviceId.substring(0, 8)}...`;
                }
              }
              return item;
            });
          }
          
          this.detailedCashMemo = data;
          console.log('Processed detailed cash memo:', this.detailedCashMemo);
          this.loadingDetails = false;
        },
        error: (error: any) => {
          console.error('Error loading cash memo details', error);
          this.loadingDetails = false;
          this.detailedCashMemo = this.selectedCashMemo; // Fall back to basic info
        }
      });
    } else {
      this.loadingDetails = false;
      this.detailedCashMemo = this.selectedCashMemo;
    }
  }
  
  /**
   * Handles printing of cash memo with proper styling and color formatting
   * Provides both direct printing and PDF options
   * @param asPdf Whether to generate PDF instead of using browser print
   */
  printCashMemo(asPdf: boolean = false): void {
    if (!this.detailedCashMemo) {
      console.error('No cash memo details available for printing');
      return;
    }
    
    console.log('Preparing to print cash memo:', this.detailedCashMemo.billId);
    
    // Get print content from the modal
    const printSection = document.querySelector('.cash-memo-details');
    if (!printSection) {
      console.error('Could not find print section in modal');
      return;
    }
    
    // Create a new window for printing with proper styles
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow pop-ups to print/save the cash memo');
      return;
    }
    
    // Add all the necessary styles from the main document
    const stylesheets = Array.from(document.styleSheets)
      .map(stylesheet => {
        try {
          if (stylesheet.href) {
            return `<link rel="stylesheet" href="${stylesheet.href}">`;
          }
          return '';
        } catch (e) {
          return '';
        }
      })
      .join('');
    
    // Add custom print styles to ensure colors and formatting are preserved
    const customPrintStyles = `
      <style>
        @media print {
          /* General print settings */
          @page { size: A4; margin: 10mm; }
          body { padding: 0; margin: 0; font-size: 11px; line-height: 1.3; }
          .container { max-width: 100%; padding: 0 10px; }
          
          /* Make everything fit on one page */
          .cash-memo-print, .row { margin-bottom: 8px !important; }
          h5 { font-size: 14px !important; margin-top: 8px !important; margin-bottom: 6px !important; }
          p { margin-bottom: 3px !important; }
          .table { border-collapse: collapse; width: 100%; font-size: 10px !important; }
          .table td, .table th { padding: 4px !important; }
          .table-bordered td, .table-bordered th { border: 1px solid #dee2e6 !important; }
          .table-sm td, .table-sm th { padding: 2px !important; }
          .card { border: 1px solid #dee2e6 !important; page-break-inside: avoid; margin-bottom: 8px !important; }
          .card-body { padding: 8px !important; }
          
          /* Element spacing */
          .pb-3 { padding-bottom: 6px !important; }
          .mt-4 { margin-top: 8px !important; }
          .mb-4 { margin-bottom: 8px !important; }
          .py-3 { padding-top: 6px !important; padding-bottom: 6px !important; }
          
          /* Colors */
          .table-light { background-color: #f8f9fa !important; color: #212529 !important; }
          .text-success { color: #198754 !important; }
          .text-danger { color: #dc3545 !important; }
          .text-warning { color: #ffc107 !important; }
          .text-info { color: #0dcaf0 !important; }
          .bg-light { background-color: #f8f9fa !important; }
          .text-muted { color: #6c757d !important; }
          
          /* Make sure dark text prints dark */
          * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          
          /* Ensure good page breaks */
          .row, .col-md-4, .col-md-6 { page-break-inside: avoid; }
          
          /* Footer and summary */
          .modal-footer { display: none !important; } /* Hide footer buttons in print */
          .border-top { border-top: 1px solid #dee2e6 !important; }
          .pt-3 { padding-top: 6px !important; }
          .small { font-size: 9px !important; }

          /* Scale content to fit single page */
          html, body { height: 100%; width: 100%; }
          .cash-memo-print { transform-origin: top left; }
          .cash-memo-details-container { overflow: visible !important; }
        }
        
        /* Specific styles for PDF export */
        .pdf-header {
          text-align: center;
          margin-bottom: 15px;
        }
        .pdf-header h2 {
          margin-bottom: 5px;
          color: #6b1d14;
          font-size: 18px;
        }
        .pdf-header p {
          margin: 2px 0;
          color: #555;
          font-size: 10px;
        }
        .pdf-header h4 {
          font-size: 14px;
          margin: 8px 0;
        }
        .cash-memo-details {
          font-family: 'Arial', sans-serif;
        }
        
        /* Fix for overlapping bill header */
        .bill-header-item {
          margin-bottom: 6px;
          display: flex;
        }
        .bill-header-item strong {
          display: inline-block;
          width: 100px;
          text-align: right;
          margin-right: 8px;
          flex-shrink: 0;
          font-size: 10px;
        }
        .bill-header-item span {
          border: 1px solid #dee2e6;
          padding: 1px 5px;
          display: inline-block;
          min-width: 110px;
          background-color: #fff;
          font-size: 10px;
        }
      </style>
    `;
    
    // Get clinic info for the header
    const clinicName = 'Hanan Clinic';
    const clinicAddress = '123 Healthcare Street, Medical District';
    const clinicContact = 'Phone: (123) 456-7890 | Email: hanan-clinic@lemicare.com';
    
    // Create the print window content with all necessary elements
    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cash Memo #${this.detailedCashMemo.billId || 'Unknown'}</title>
        ${stylesheets}
        ${customPrintStyles}
      </head>
      <body>
        <div class="container">
          <!-- Print Header -->
          <div class="pdf-header">
            <h2>${clinicName}</h2>
            <p>${clinicAddress}</p>
            <p>${clinicContact}</p>
            <h4 class="mt-3">Cash Memo Receipt</h4>
          </div>
          
          <!-- Main Content -->
          <div class="cash-memo-print">
            ${printSection.innerHTML}
          </div>
          
          <!-- Footer -->
          <div class="text-center mt-4 pt-3 border-top">
            <p class="small text-muted">Thank you for your visit to Hanan Clinic</p>
            <p class="small text-muted">This is a computer-generated document. No signature is required.</p>
          </div>
        </div>
        
        <!-- Script for automatic printing -->
        <script>
          window.onload = function() {
            ${asPdf ? 'window.print();' : 'setTimeout(() => window.print(), 500);'}
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    
    // For PDF, we let the user save via the browser's print-to-PDF functionality
    console.log(`Cash memo prepared for ${asPdf ? 'PDF export' : 'printing'}`);
  }
  
  /**
   * Export cash memo as PDF using browser's print-to-PDF functionality
   */
  exportAsPDF(): void {
    this.printCashMemo(true);
  }
}
