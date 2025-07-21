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
      next: (data: Return[]) => {
        this.returns = data;
        this.filteredReturns = [...data];
        this.applyFilters();
        this.loading = false;
      },
      error: (err: Error) => {
        console.error('Error loading returns', err);
        this.loading = false;
        this.loadSampleReturns();
      }
    });
  }

  changeTab(tab: 'ALL' | 'SALES' | 'PURCHASE'): void {
    this.activeTab = tab;
    this.loading = true;
    
    // Make specific API call based on the active tab
    if (tab === 'SALES') {
      this.inventoryService.getSalesReturns().subscribe({
        next: (data) => {
          this.returns = data;
          this.applyFilters();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading sales returns', err);
          this.loading = false;
        }
      });
    } else if (tab === 'PURCHASE') {
      this.inventoryService.getPurchaseReturns().subscribe({
        next: (data) => {
          this.returns = data;
          this.applyFilters();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading purchase returns', err);
          this.loading = false;
        }
      });
    } else {
      // ALL tab - load all returns
      this.inventoryService.getReturns().subscribe({
        next: (data) => {
          this.returns = data;
          this.applyFilters();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading all returns', err);
          this.loading = false;
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

  // Sample data for development
  private loadSampleReturns(): void {
    const currentDate = new Date().toISOString().split('T')[0];
    
    this.returns = [
      {
        id: 'RTN-2023-001',
        type: 'SALES',
        referenceId: 'SL-2023-105',
        date: currentDate,
        customerOrSupplier: 'Rahul Sharma',
        amount: 1250.50,
        status: 'COMPLETED',
        reason: 'Medicine expired'
      },
      {
        id: 'RTN-2023-002',
        type: 'PURCHASE',
        referenceId: 'PO-2023-057',
        date: currentDate,
        customerOrSupplier: 'AJAX PHARMACEUTICALS',
        amount: 3540.25,
        status: 'PENDING',
        reason: 'Wrong delivery'
      },
      {
        id: 'RTN-2023-003',
        type: 'SALES',
        referenceId: 'SL-2023-112',
        date: '2023-06-25',
        customerOrSupplier: 'Preeti Verma',
        amount: 460.00,
        status: 'PROCESSING',
        reason: 'Customer changed mind'
      },
      {
        id: 'RTN-2023-004',
        type: 'PURCHASE',
        referenceId: 'PO-2023-062',
        date: '2023-06-22',
        customerOrSupplier: 'UBK DISTRIBUTORS',
        amount: 2800.75,
        status: 'COMPLETED',
        reason: 'Damaged packaging'
      },
      {
        id: 'RTN-2023-005',
        type: 'SALES',
        referenceId: 'SL-2023-118',
        date: '2023-06-20',
        customerOrSupplier: 'Vikram Singh',
        amount: 720.30,
        status: 'COMPLETED',
        reason: 'Wrong medicine'
      }
    ];
    
    this.filteredReturns = [...this.returns];
  }
}
