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
}
