import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReturnsService, SaleReturn, PurchaseReturn } from '../../services/returns.service';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-returns-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './returns-list.component.html',
  styleUrls: ['./returns-list.component.css']
})
export class ReturnsListComponent implements OnInit {
  // Make Math available in the template
  Math = Math;
  salesReturns: SaleReturn[] = [];
  purchaseReturns: PurchaseReturn[] = [];
  isLoading = false;
  searchText = '';
  activeTab = 'sales'; // 'sales' or 'purchases'
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  
  // Filtering and Sorting
  sortBy = 'returnDate';
  sortOrder: 'asc' | 'desc' = 'desc';
  statusFilter = 'all'; // 'all', 'pending', 'completed', 'cancelled'
  dateFrom = '';
  dateTo = '';
  
  // Statistics
  totalSalesReturnAmount = 0;
  totalPurchaseReturnAmount = 0;
  totalReturnsCount = 0;
  
  constructor(
    public returnsService: ReturnsService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.initializeDateFilters();
    this.loadSalesReturns();
    this.loadPurchaseReturns();
  }
  
  private initializeDateFilters(): void {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    this.dateFrom = lastMonth.toISOString().split('T')[0];
    this.dateTo = today.toISOString().split('T')[0];
  }

  loadSalesReturns(): void {
    this.isLoading = true;
    this.returnsService.getSalesReturns()
      .subscribe({
        next: (returns) => {
          this.salesReturns = returns;
          this.calculateSalesReturnStatistics();
          if (this.activeTab === 'sales') {
            this.totalItems = returns.length;
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading sales returns', error);
          this.toastService.showError('Failed to load sales returns');
          this.isLoading = false;
        }
      });
  }
  
  loadPurchaseReturns(): void {
    this.isLoading = true;
    this.returnsService.getPurchaseReturns()
      .subscribe({
        next: (returns) => {
          this.purchaseReturns = returns;
          this.calculatePurchaseReturnStatistics();
          if (this.activeTab === 'purchases') {
            this.totalItems = returns.length;
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading purchase returns', error);
          this.toastService.showError('Failed to load purchase returns');
          this.isLoading = false;
        }
      });
  }

  // Change the active tab
  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.currentPage = 1;
    this.totalItems = tab === 'sales' ? this.salesReturns.length : this.purchaseReturns.length;
  }

  // Calculate statistics
  private calculateSalesReturnStatistics(): void {
    this.totalSalesReturnAmount = this.salesReturns.reduce((sum, ret) => sum + (ret.netRefundAmount || 0), 0);
  }
  
  private calculatePurchaseReturnStatistics(): void {
    this.totalPurchaseReturnAmount = this.purchaseReturns.reduce((sum, ret) => sum + (ret.totalReturnedAmount || 0), 0);
  }
  
  // Enhanced filtering with multiple criteria
  get filteredSalesReturns(): SaleReturn[] {
    let filtered = this.salesReturns;
    
    // Search text filter
    if (this.searchText) {
      const searchLower = this.searchText.toLowerCase();
      filtered = filtered.filter(ret => 
        (ret.salesReturnId && ret.salesReturnId.toLowerCase().includes(searchLower)) ||
        (ret.originalSaleId && ret.originalSaleId.toLowerCase().includes(searchLower)) ||
        (ret.patientId && ret.patientId.toLowerCase().includes(searchLower)) ||
        (ret.reason && ret.reason.toLowerCase().includes(searchLower)) ||
        (this.returnsService.formatReturnId(ret.salesReturnId).toLowerCase().includes(searchLower)) ||
        (this.returnsService.formatSaleId(ret.originalSaleId).toLowerCase().includes(searchLower))
      );
    }
    
    // Date range filter
    if (this.dateFrom) {
      filtered = filtered.filter(ret => {
        const returnDate = this.parseReturnDate(ret.returnDate);
        return returnDate >= new Date(this.dateFrom);
      });
    }
    
    if (this.dateTo) {
      filtered = filtered.filter(ret => {
        const returnDate = this.parseReturnDate(ret.returnDate);
        return returnDate <= new Date(this.dateTo + 'T23:59:59');
      });
    }
    
    // Status filter
    if (this.statusFilter !== 'all') {
      // Status filtering disabled - status field doesn't exist in current models
      // filtered = filtered.filter(ret => ret.status === this.statusFilter);
    }
    
    // Sort the filtered results
    return this.sortReturns(filtered, 'sales');
  }

  get filteredPurchaseReturns(): PurchaseReturn[] {
    let filtered = this.purchaseReturns;
    
    // Search text filter
    if (this.searchText) {
      const searchLower = this.searchText.toLowerCase();
      filtered = filtered.filter(ret => 
        (ret.purchaseReturnId && ret.purchaseReturnId.toLowerCase().includes(searchLower)) ||
        (ret.originalPurchaseId && ret.originalPurchaseId.toLowerCase().includes(searchLower)) ||
        (ret.supplierId && ret.supplierId.toLowerCase().includes(searchLower)) ||
        (ret.reason && ret.reason.toLowerCase().includes(searchLower)) ||
        (this.returnsService.formatReturnId(ret.purchaseReturnId).toLowerCase().includes(searchLower)) ||
        (this.returnsService.formatPurchaseId(ret.originalPurchaseId).toLowerCase().includes(searchLower))
      );
    }
    
    // Date range filter
    if (this.dateFrom) {
      filtered = filtered.filter(ret => {
        const returnDate = this.parseReturnDate(ret.returnDate);
        return returnDate >= new Date(this.dateFrom);
      });
    }
    
    if (this.dateTo) {
      filtered = filtered.filter(ret => {
        const returnDate = this.parseReturnDate(ret.returnDate);
        return returnDate <= new Date(this.dateTo + 'T23:59:59');
      });
    }
    
    // Status filter
    if (this.statusFilter !== 'all') {
      // Status filtering disabled - status field doesn't exist in current models
      // filtered = filtered.filter(ret => ret.status === this.statusFilter);
    }
    
    // Sort the filtered results
    return this.sortReturns(filtered, 'purchases');
  }

  // Get active filtered returns based on current tab
  get filteredReturns(): SaleReturn[] | PurchaseReturn[] {
    return this.activeTab === 'sales' ? this.filteredSalesReturns : this.filteredPurchaseReturns;
  }

  // Get paginated returns for the current tab
  get paginatedReturns(): SaleReturn[] | PurchaseReturn[] {
    const startIdx = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredReturns.slice(startIdx, startIdx + this.itemsPerPage);
  }
  
  // Get paginated sales returns only
  get paginatedSalesReturns(): SaleReturn[] {
    if (this.activeTab !== 'sales') return [];
    const startIdx = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredSalesReturns.slice(startIdx, startIdx + this.itemsPerPage);
  }
  
  // Get paginated purchase returns only
  get paginatedPurchaseReturns(): PurchaseReturn[] {
    if (this.activeTab !== 'purchases') return [];
    const startIdx = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredPurchaseReturns.slice(startIdx, startIdx + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredReturns.length / this.itemsPerPage);
  }

  setPage(pageNumber: number): void {
    this.currentPage = Math.max(1, Math.min(pageNumber, this.totalPages));
  }
  
  // Sorting functionality
  setSortBy(field: string): void {
    if (this.sortBy === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortOrder = 'desc';
    }
    this.currentPage = 1; // Reset to first page when sorting
  }
  
  private sortReturns(returns: any[], type: 'sales' | 'purchases'): any[] {
    return returns.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (this.sortBy) {
        case 'returnDate':
          aValue = this.parseReturnDate(a.returnDate);
          bValue = this.parseReturnDate(b.returnDate);
          break;
        case 'totalReturnAmount':
          aValue = type === 'sales' ? (a.netRefundAmount || 0) : (a.totalReturnedAmount || 0);
          bValue = type === 'sales' ? (b.netRefundAmount || 0) : (b.totalReturnedAmount || 0);
          break;
        case 'status':
          // Status field doesn't exist in current models, use a default
          aValue = 'completed';
          bValue = 'completed';
          break;
        case 'customerName':
          aValue = type === 'sales' ? (a.patientId || '') : (a.supplierId || '');
          bValue = type === 'sales' ? (b.patientId || '') : (b.supplierId || '');
          break;
        default:
          aValue = a[this.sortBy] || '';
          bValue = b[this.sortBy] || '';
      }
      
      if (aValue < bValue) return this.sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return this.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  // Filter management
  clearFilters(): void {
    this.searchText = '';
    this.statusFilter = 'all';
    this.initializeDateFilters();
    this.currentPage = 1;
  }
  
  applyDateFilter(): void {
    this.currentPage = 1;
  }

  // Format date
  formatDate(dateStr: string | { seconds: number; nanos: number }): string {
    if (!dateStr) return '';
    
    let date: Date;
    if (typeof dateStr === 'string') {
      date = new Date(dateStr);
    } else if (dateStr && 'seconds' in dateStr) {
      date = new Date(dateStr.seconds * 1000);
    } else {
      return '';
    }
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Check if a return is a sale return
  isSaleReturn(returnItem: any): returnItem is SaleReturn {
    return 'salesReturnId' in returnItem;
  }
  
  // Check if a return is a purchase return
  isPurchaseReturn(returnItem: any): returnItem is PurchaseReturn {
    return 'purchaseReturnId' in returnItem;
  }
  
  // Get return status badge class
  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-success';
      case 'pending': return 'bg-warning';
      case 'cancelled': return 'bg-danger';
      case 'processing': return 'bg-info';
      default: return 'bg-secondary';
    }
  }
  
  // Get return type badge class
  getReturnTypeBadgeClass(type: string): string {
    return type === 'sales' ? 'bg-primary' : 'bg-info';
  }
  
  // Calculate total statistics
  get totalReturnAmount(): number {
    return this.totalSalesReturnAmount + this.totalPurchaseReturnAmount;
  }
  
  get totalReturnsCountCalculated(): number {
    return this.salesReturns.length + this.purchaseReturns.length;
  }
  
  // Export functionality
  exportToCSV(): void {
    const data = this.activeTab === 'sales' ? this.filteredSalesReturns : this.filteredPurchaseReturns;
    if (data.length === 0) {
      this.toastService.showWarning('No data to export');
      return;
    }
    
    // Implementation would depend on CSV export library
    this.toastService.showInfo('Export functionality to be implemented');
  }
  
  // Refresh data
  refreshData(): void {
    this.loadSalesReturns();
    this.loadPurchaseReturns();
    this.toastService.showSuccess('Data refreshed successfully');
  }
  
  // Helper method to parse return date from various formats
  private parseReturnDate(dateValue: string | { seconds: number; nanos: number }): Date {
    if (!dateValue) return new Date();
    
    if (typeof dateValue === 'string') {
      return new Date(dateValue);
    } else if (dateValue && 'seconds' in dateValue) {
      return new Date(dateValue.seconds * 1000);
    }
    
    return new Date();
  }
}
