import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../shared/billing.service';
import { CashMemo } from '../shared/billing.model';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

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
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    this.loadCashMemos();
  }

  loadCashMemos(): void {
    this.loading = true;
    this.billingService.getAllCashMemos().subscribe({
      next: (data) => {
        // Sort cash memos by date and time in descending order (newest first)
        this.cashMemos = this.sortCashMemosByDateDesc(data);
        this.filterCashMemos();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading cash memos', error);
        this.loading = false;
      }
    });
  }

  filterCashMemos(): void {
    // First, filter by search term
    let filteredBySearch = this.cashMemos.filter(cashMemo => {
      return this.searchTerm === '' || 
        cashMemo.patientName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        cashMemo.billId?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        cashMemo.modeOfPayment.toLowerCase().includes(this.searchTerm.toLowerCase());
    });
    
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
        startDate: firstDayOfMonth.toISOString().split('T')[0], // Format as YYYY-MM-DD
        endDate: today.toISOString().split('T')[0] // Format as YYYY-MM-DD
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
   * Sorts cash memos by date and time in descending order (newest first)
   * @param cashMemos The array of cash memos to sort
   * @returns Sorted array of cash memos
   */
  sortCashMemosByDateDesc(cashMemos: CashMemo[]): CashMemo[] {
    return [...cashMemos].sort((a, b) => {
      // Use createdDate if available, otherwise fall back to date
      const dateA = a.createdDate || a.date;
      const dateB = b.createdDate || b.date;
      
      // Parse dates for comparison (newer dates should come first)
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }

  onSearchChange(): void {
    this.filterCashMemos();
  }

  calculateTotalAmount(): number {
    return this.filteredCashMemos.reduce((total, cashMemo) => total + cashMemo.amount, 0);
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
        error: (error) => {
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
    this.modalService.open(modal, { size: 'lg', centered: true });
    
    // Then load the detailed data
    if (cashMemo.id) {
      this.billingService.getCashMemoById(cashMemo.id).subscribe({
        next: (data) => {
          console.log('Cash memo details from API:', data);
          
          // Ensure line items have service names
          if (data.lineItems && data.lineItems.length > 0) {
            data.lineItems = data.lineItems.map(item => {
              // If serviceName is missing but serviceId exists, use description as fallback
              if (!item.serviceName && item.serviceId) {
                item.serviceName = item.description || 'Service ' + item.serviceId;
              }
              return item;
            });
          }
          
          this.detailedCashMemo = data;
          console.log('Processed detailed cash memo:', this.detailedCashMemo);
          this.loadingDetails = false;
        },
        error: (error) => {
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
  
  printCashMemo(): void {
    // Small timeout to ensure modal content is fully rendered before printing
    setTimeout(() => {
      window.print();
    }, 300);
  }
}
