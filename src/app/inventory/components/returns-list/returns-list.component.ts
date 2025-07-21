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
  
  constructor(
    public returnsService: ReturnsService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadSalesReturns();
    this.loadPurchaseReturns();
  }

  loadSalesReturns(): void {
    this.isLoading = true;
    this.returnsService.getSalesReturns()
      .subscribe({
        next: (returns) => {
          this.salesReturns = returns;
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

  // Filter returns based on search text
  get filteredSalesReturns(): SaleReturn[] {
    if (!this.searchText) {
      return this.salesReturns;
    }
    
    const searchLower = this.searchText.toLowerCase();
    return this.salesReturns.filter(ret => 
      (ret.salesReturnId && ret.salesReturnId.toLowerCase().includes(searchLower)) ||
      (ret.originalSaleId && ret.originalSaleId.toLowerCase().includes(searchLower)) ||
      (this.returnsService.formatReturnId(ret.salesReturnId).toLowerCase().includes(searchLower)) ||
      (this.returnsService.formatSaleId(ret.originalSaleId).toLowerCase().includes(searchLower))
    );
  }

  get filteredPurchaseReturns(): PurchaseReturn[] {
    if (!this.searchText) {
      return this.purchaseReturns;
    }
    
    const searchLower = this.searchText.toLowerCase();
    return this.purchaseReturns.filter(ret => 
      (ret.purchaseReturnId && ret.purchaseReturnId.toLowerCase().includes(searchLower)) ||
      (ret.originalPurchaseId && ret.originalPurchaseId.toLowerCase().includes(searchLower)) ||
      (this.returnsService.formatReturnId(ret.purchaseReturnId).toLowerCase().includes(searchLower)) ||
      (this.returnsService.formatPurchaseId(ret.originalPurchaseId).toLowerCase().includes(searchLower))
    );
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
}
