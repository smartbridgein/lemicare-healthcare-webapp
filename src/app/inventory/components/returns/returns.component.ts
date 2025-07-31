import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';

interface Return {
  id: string;
  type: 'SALES' | 'PURCHASE';
  referenceId: string;
  date: string;
  customerOrSupplier: string;
  amount: number;
  status: 'COMPLETED' | 'PENDING' | 'PROCESSING';
  reason?: string;
}

@Component({
  selector: 'app-returns',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './returns.component.html',
  styleUrls: ['./returns.component.scss']
})
export class ReturnsComponent implements OnInit {
  returns: Return[] = [];
  filteredReturns: Return[] = [];
  activeTab: 'ALL' | 'SALES' | 'PURCHASE' = 'ALL';
  searchTerm: string = '';
  filterDate: string = '';
  filterStatus: string = 'all';
  loading: boolean = true;
  
  constructor(private inventoryService: InventoryService) {}

  ngOnInit(): void {
    this.loadReturns();
  }

  loadReturns(): void {
    this.loading = true;
    this.inventoryService.getReturns().subscribe({
      next: (data: any[]) => {
        console.log('Raw API response:', data);
        this.returns = this.mapApiResponseToReturns(data);
        this.filteredReturns = [...this.returns];
        this.applyFilters();
        this.loading = false;
      },
      error: (err: Error) => {
        console.error('Error loading returns', err);
        this.loading = false;
        // Don't fall back to sample data - show empty state instead
        this.returns = [];
        this.filteredReturns = [];
      }
    });
  }

  changeTab(tab: 'ALL' | 'SALES' | 'PURCHASE'): void {
    this.activeTab = tab;
    this.loading = true;
    
    // Make specific API call based on the active tab
    if (tab === 'SALES') {
      this.inventoryService.getSalesReturns().subscribe({
        next: (data: any[]) => {
          console.log('Sales returns API response:', data);
          this.returns = this.mapSalesReturnsToReturns(data);
          this.applyFilters();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading sales returns', err);
          this.loading = false;
          this.returns = [];
          this.filteredReturns = [];
        }
      });
    } else if (tab === 'PURCHASE') {
      this.inventoryService.getPurchaseReturns().subscribe({
        next: (data: any[]) => {
          console.log('Purchase returns API response:', data);
          this.returns = this.mapPurchaseReturnsToReturns(data);
          this.applyFilters();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading purchase returns', err);
          this.loading = false;
          this.returns = [];
          this.filteredReturns = [];
        }
      });
    } else {
      // ALL tab - load all returns
      this.inventoryService.getReturns().subscribe({
        next: (data: any[]) => {
          console.log('All returns API response:', data);
          this.returns = this.mapApiResponseToReturns(data);
          this.applyFilters();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading all returns', err);
          this.loading = false;
          this.returns = [];
          this.filteredReturns = [];
        }
      });
    }
  }

  applyFilters(): void {
    let filtered = [...this.returns];
    
    // Apply tab filter
    if (this.activeTab !== 'ALL') {
      filtered = filtered.filter(r => r.type === this.activeTab);
    }
    
    // Apply search term
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        r.id.toLowerCase().includes(term) || 
        r.referenceId.toLowerCase().includes(term) || 
        r.customerOrSupplier.toLowerCase().includes(term)
      );
    }
    
    // Apply date filter
    if (this.filterDate) {
      filtered = filtered.filter(r => r.date === this.filterDate);
    }
    
    // Apply status filter
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === this.filterStatus);
    }
    
    this.filteredReturns = filtered;
  }

  search(): void {
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.filterDate = '';
    this.filterStatus = 'all';
    this.applyFilters();
  }

  formatDate(dateString: string): string {
    // In a real application, you'd format the date properly
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'status-completed';
      case 'PENDING': return 'status-pending';
      case 'PROCESSING': return 'status-processing';
      default: return '';
    }
  }

  deleteReturn(id: string): void {
    if (confirm('Are you sure you want to delete this return?')) {
      this.inventoryService.deleteReturn(id).subscribe({
        next: () => {
          this.returns = this.returns.filter(r => r.id !== id);
          this.applyFilters();
        },
        error: (err: Error) => console.error('Error deleting return', err)
      });
    }
  }

  /**
   * Map API response data to frontend Return interface
   * Handles mixed sales and purchase returns from /api/inventory/returns endpoint
   */
  private mapApiResponseToReturns(data: any[]): Return[] {
    return data.map((item: any) => {
      // Determine if this is a sales return or purchase return based on available fields
      const isSalesReturn = item.salesReturnId || item.originalSaleId;
      const isPurchaseReturn = item.purchaseReturnId || item.originalPurchaseId;
      
      if (isSalesReturn) {
        return this.mapSalesReturnToReturn(item);
      } else if (isPurchaseReturn) {
        return this.mapPurchaseReturnToReturn(item);
      } else {
        // Fallback mapping
        return {
          id: item.id || 'UNKNOWN',
          type: 'SALES' as 'SALES' | 'PURCHASE',
          referenceId: item.referenceId || 'N/A',
          date: this.formatApiDate(item.date || item.returnDate),
          customerOrSupplier: 'Unknown',
          amount: item.amount || 0,
          status: 'COMPLETED' as 'COMPLETED' | 'PENDING' | 'PROCESSING',
          reason: item.reason
        };
      }
    });
  }

  /**
   * Map sales returns API response to frontend Return interface
   */
  private mapSalesReturnsToReturns(data: any[]): Return[] {
    return data.map((item: any) => this.mapSalesReturnToReturn(item));
  }

  /**
   * Map purchase returns API response to frontend Return interface
   */
  private mapPurchaseReturnsToReturns(data: any[]): Return[] {
    return data.map((item: any) => this.mapPurchaseReturnToReturn(item));
  }

  /**
   * Map individual sales return to Return interface
   */
  private mapSalesReturnToReturn(item: any): Return {
    return {
      id: this.formatReturnId(item.salesReturnId || item.id),
      type: 'SALES',
      referenceId: this.formatSaleId(item.originalSaleId),
      date: this.formatApiDate(item.returnDate),
      customerOrSupplier: item.patientId ? `Patient: ${item.patientId}` : 'Walk-in Customer',
      amount: item.netRefundAmount || item.refundAmount || 0,
      status: 'COMPLETED' as 'COMPLETED' | 'PENDING' | 'PROCESSING',
      reason: item.reason
    };
  }

  /**
   * Map individual purchase return to Return interface
   */
  private mapPurchaseReturnToReturn(item: any): Return {
    console.log('Mapping purchase return:', item);
    return {
      id: this.formatReturnId(item.purchaseReturnId || item.id),
      type: 'PURCHASE',
      referenceId: this.formatPurchaseId(item.originalPurchaseId),
      date: this.formatApiDate(item.returnDate),
      customerOrSupplier: this.formatSupplierId(item.supplierId),
      amount: item.totalReturnedAmount || item.amount || 0, // This is the key fix!
      status: 'COMPLETED' as 'COMPLETED' | 'PENDING' | 'PROCESSING',
      reason: item.reason
    };
  }

  /**
   * Format API date response (handles both string and timestamp objects)
   */
  private formatApiDate(date: any): string {
    if (!date) return new Date().toISOString().split('T')[0];
    
    if (typeof date === 'string') {
      return new Date(date).toISOString().split('T')[0];
    }
    
    if (date.seconds) {
      return new Date(date.seconds * 1000).toISOString().split('T')[0];
    }
    
    return new Date(date).toISOString().split('T')[0];
  }

  /**
   * Format return ID for display
   */
  private formatReturnId(id: string): string {
    if (!id) return 'UNKNOWN';
    if (id.startsWith('PRET') || id.startsWith('SRET')) {
      return id.replace('PRET', 'RTN-P').replace('SRET', 'RTN-S');
    }
    return id;
  }

  /**
   * Format sale ID for display
   */
  private formatSaleId(id: string): string {
    if (!id) return 'N/A';
    return id.startsWith('SALE') ? id.replace('SALE', 'SL') : id;
  }

  /**
   * Format purchase ID for display
   */
  private formatPurchaseId(id: string): string {
    if (!id) return 'N/A';
    return id.startsWith('PUR') ? id.replace('PUR', 'PO') : id;
  }

  /**
   * Format supplier ID for display
   */
  private formatSupplierId(id: string): string {
    if (!id) return 'Unknown Supplier';
    if (id.startsWith('sup_')) {
      const uuid = id.substring(4);
      const shortId = uuid.substring(0, 8).toUpperCase();
      return `SUP-${shortId.substring(0, 4)}-${shortId.substring(4, 8)}`;
    }
    return id;
  }
}
