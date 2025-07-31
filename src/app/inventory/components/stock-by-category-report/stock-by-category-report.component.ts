import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../../services/inventory.service';
import { StockByCategoryItem } from '../../models/inventory.models';
import { ToastService } from '../../../shared/services/toast.service';
import { SumPipe } from '../../../shared/pipes/sum.pipe';

@Component({
  selector: 'app-stock-by-category-report',
  standalone: true,
  imports: [CommonModule, SumPipe],
  templateUrl: './stock-by-category-report.component.html',
  styleUrls: ['./stock-by-category-report.component.scss']
})
export class StockByCategoryReportComponent implements OnInit {
  stockByCategory: StockByCategoryItem[] = [];
  chartData: any[] = [];
  isLoading = false;
  error: string | null = null;
  
  // View mode toggle
  viewMode: 'chart' | 'table' = 'table';
  
  // Pagination properties
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  paginatedData: StockByCategoryItem[] = [];
  
  // Sorting properties
  sortColumn: 'category' | 'totalStock' = 'category';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Search functionality
  searchTerm = '';
  filteredData: StockByCategoryItem[] = [];
  
  // Color palette for bars
  colorPalette = ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA', '#2980b9', '#8e44ad', '#d35400'];

  constructor(
    private inventoryService: InventoryService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadStockByCategoryData();
  }

  loadStockByCategoryData(): void {
    this.isLoading = true;
    this.error = null;
    
    this.inventoryService.getStockByCategory().subscribe({
      next: (data) => {
        this.stockByCategory = data;
        this.filteredData = [...data];
        this.totalItems = data.length;
        this.calculatePagination();
        this.updatePaginatedData();
        
        this.chartData = data.map(item => ({
          name: item.category,
          value: item.totalStock
        }));
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching stock by category data:', err);
        this.error = 'Failed to load stock by category data. Please try again.';
        this.toastService.showError(this.error);
        this.isLoading = false;
      }
    });
  }

  getMaxStock(): number {
    if (this.stockByCategory.length === 0) return 0;
    return Math.max(...this.stockByCategory.map(item => item.totalStock));
  }

  getRandomColor(category: string): string {
    // Generate a consistent color based on the category string
    const index = Math.abs(category.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0) % this.colorPalette.length);
    return this.colorPalette[index];
  }

  prepareChartData(): void {
    this.chartData = this.stockByCategory.map(item => ({
      name: item.category || 'Uncategorized',
      value: item.totalStock
    })).sort((a, b) => b.value - a.value); // Sort by stock count descending
  }

  onRefresh(): void {
    this.loadStockByCategoryData();
  }
  
  // View mode methods
  setViewMode(mode: 'chart' | 'table'): void {
    this.viewMode = mode;
  }
  
  // Pagination methods
  calculatePagination(): void {
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }
  
  updatePaginatedData(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedData = this.filteredData.slice(startIndex, endIndex);
  }
  
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedData();
    }
  }
  
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedData();
    }
  }
  
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedData();
    }
  }
  
  changeItemsPerPage(newSize: number): void {
    this.itemsPerPage = newSize;
    this.currentPage = 1;
    this.calculatePagination();
    this.updatePaginatedData();
  }
  
  // Sorting methods
  sortData(column: 'category' | 'totalStock'): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    
    this.filteredData.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      if (column === 'category') {
        aValue = (a.category || 'Uncategorized').toLowerCase();
        bValue = (b.category || 'Uncategorized').toLowerCase();
      } else {
        aValue = a.totalStock;
        bValue = b.totalStock;
      }
      
      if (aValue < bValue) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
    
    this.currentPage = 1;
    this.updatePaginatedData();
  }
  
  // Search methods
  onSearchChange(searchTerm: string): void {
    this.searchTerm = searchTerm.toLowerCase();
    this.filterData();
  }
  
  filterData(): void {
    if (!this.searchTerm) {
      this.filteredData = [...this.stockByCategory];
    } else {
      this.filteredData = this.stockByCategory.filter(item => 
        (item.category || 'Uncategorized').toLowerCase().includes(this.searchTerm)
      );
    }
    
    this.totalItems = this.filteredData.length;
    this.currentPage = 1;
    this.calculatePagination();
    this.updatePaginatedData();
  }
  
  // Helper methods
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }
  
  getStartIndex(): number {
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }
  
  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
  }
}
