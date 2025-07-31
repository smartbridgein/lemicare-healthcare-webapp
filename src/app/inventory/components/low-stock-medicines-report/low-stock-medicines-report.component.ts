import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ReportExportService } from '../../services/report-export.service';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

@Component({
  selector: 'app-low-stock-medicines-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './low-stock-medicines-report.component.html',
  styleUrls: ['./low-stock-medicines-report.component.scss']
})
export class LowStockMedicinesReportComponent implements OnInit, AfterViewInit, OnDestroy {
  medicines: any[] = [];
  isLoading = false;
  error: string | null = null;
  
  // Pagination properties
  currentPage = 1;
  itemsPerPage = 6;
  totalItems = 0;
  paginatedMedicines: any[] = [];
  
  // Chart properties
  @ViewChild('stockChart', { static: false }) stockChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryChart', { static: false }) categoryChartRef!: ElementRef<HTMLCanvasElement>;
  private stockChart: Chart | null = null;
  private categoryChart: Chart | null = null;
  
  // Chart data
  chartData = {
    stockDistribution: [] as any[],
    categoryDistribution: [] as any[]
  };
  
  // Make Math available for the template
  Math = Math;

  constructor(
    private inventoryService: InventoryService,
    private toastService: ToastService,
    private exportService: ReportExportService
  ) {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.loadLowStockMedicines();
  }

  ngAfterViewInit(): void {
    // Charts will be initialized after data is loaded
  }

  ngOnDestroy(): void {
    if (this.stockChart) {
      this.stockChart.destroy();
    }
    if (this.categoryChart) {
      this.categoryChart.destroy();
    }
  }

  // Getter methods for template statistics
  get outOfStockCount(): number {
    return this.medicines.filter(m => (m.currentStock || 0) === 0).length;
  }

  get criticalStockCount(): number {
    return this.medicines.filter(m => {
      const current = m.currentStock || 0;
      const min = m.minStockLevel || 0;
      const percentage = min > 0 ? (current / min) * 100 : 0;
      return current > 0 && percentage < 25;
    }).length;
  }

  get lowStockCount(): number {
    return this.medicines.filter(m => {
      const current = m.currentStock || 0;
      const min = m.minStockLevel || 0;
      const percentage = min > 0 ? (current / min) * 100 : 0;
      return percentage >= 25 && percentage < 50;
    }).length;
  }

  get warningStockCount(): number {
    return this.medicines.filter(m => {
      const current = m.currentStock || 0;
      const min = m.minStockLevel || 0;
      const percentage = min > 0 ? (current / min) * 100 : 0;
      return percentage >= 50 && percentage < 75;
    }).length;
  }

  loadLowStockMedicines(): void {
    this.isLoading = true;
    this.error = null;

    this.inventoryService.getLowStockMedicines().subscribe({
      next: (data) => {
        this.medicines = data;
        this.totalItems = data.length;
        this.updatePaginatedMedicines();
        this.prepareChartData();
        this.isLoading = false;
        // Initialize charts after data is loaded and view is initialized
        setTimeout(() => {
          this.initializeCharts();
        }, 100);
      },
      error: (err) => {
        this.error = 'Failed to load low stock medicines data';
        this.toastService.showError(this.error);
        this.isLoading = false;
        console.error('Error loading low stock medicines:', err);
      }
    });
  }

  // Prepare data for charts
  prepareChartData(): void {
    // Prepare stock level distribution data
    const stockCategories = {
      'Out of Stock': 0,
      'Critical (< 25% min)': 0,
      'Low (25-50% min)': 0,
      'Warning (50-75% min)': 0
    };

    // Prepare category distribution data
    const categoryMap = new Map<string, number>();

    this.medicines.forEach(medicine => {
      const currentStock = medicine.currentStock || 0;
      const minStockLevel = medicine.minStockLevel || 0;
      const stockPercentage = minStockLevel > 0 ? (currentStock / minStockLevel) * 100 : 0;
      
      // Categorize by stock level
      if (currentStock === 0) {
        stockCategories['Out of Stock']++;
      } else if (stockPercentage < 25) {
        stockCategories['Critical (< 25% min)']++;
      } else if (stockPercentage < 50) {
        stockCategories['Low (25-50% min)']++;
      } else {
        stockCategories['Warning (50-75% min)']++;
      }

      // Categorize by medicine type/category (using first word of medicine name as category)
      const category = medicine.name ? medicine.name.split(' ')[0] : 'Others';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    // Convert to chart data format
    this.chartData.stockDistribution = Object.entries(stockCategories)
      .filter(([_, count]) => count > 0)
      .map(([label, count]) => ({ label, count }));

    this.chartData.categoryDistribution = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8) // Top 8 categories
      .map(([label, count]) => ({ label, count }));
  }

  // Initialize charts
  initializeCharts(): void {
    this.createStockChart();
    this.createCategoryChart();
  }

  // Create stock distribution chart
  private createStockChart(): void {
    if (!this.stockChartRef?.nativeElement || this.chartData.stockDistribution.length === 0) {
      return;
    }

    const ctx = this.stockChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.stockChart) {
      this.stockChart.destroy();
    }

    const labels = this.chartData.stockDistribution.map(item => item.label);
    const data = this.chartData.stockDistribution.map(item => item.count);
    const colors = ['#dc3545', '#fd7e14', '#ffc107', '#17a2b8']; // Red, Orange, Yellow, Blue

    this.stockChart = new Chart(ctx, {
      type: 'doughnut' as ChartType,
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.slice(0, data.length),
          borderColor: '#fff',
          borderWidth: 3,
          hoverBorderWidth: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              font: {
                size: 12,
                family: 'Inter, sans-serif'
              },
              color: '#495057'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#6b1d14',
            borderWidth: 1,
            callbacks: {
              label: (context) => {
                const total = data.reduce((a, b) => a + b, 0);
                const percentage = ((context.parsed / total) * 100).toFixed(1);
                return `${context.label}: ${context.parsed} (${percentage}%)`;
              }
            }
          }
        },
        elements: {
          arc: {
            borderRadius: 8
          }
        }
      }
    });
  }

  // Create category distribution chart
  private createCategoryChart(): void {
    if (!this.categoryChartRef?.nativeElement || this.chartData.categoryDistribution.length === 0) {
      return;
    }

    const ctx = this.categoryChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.categoryChart) {
      this.categoryChart.destroy();
    }

    const labels = this.chartData.categoryDistribution.map(item => item.label);
    const data = this.chartData.categoryDistribution.map(item => item.count);

    this.categoryChart = new Chart(ctx, {
      type: 'bar' as ChartType,
      data: {
        labels: labels,
        datasets: [{
          label: 'Low Stock Medicines',
          data: data,
          backgroundColor: 'rgba(107, 29, 20, 0.8)',
          borderColor: '#6b1d14',
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#6b1d14',
            borderWidth: 1
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              color: '#6c757d',
              font: {
                family: 'Inter, sans-serif'
              }
            },
            grid: {
              color: 'rgba(0,0,0,0.1)'
            }
          },
          x: {
            ticks: {
              color: '#6c757d',
              font: {
                family: 'Inter, sans-serif'
              },
              maxRotation: 45
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  // Get stock status for display
  getStockStatus(currentStock: number, minStockLevel: number): string {
    if (currentStock === 0) {
      return 'OUT OF STOCK';
    }
    
    const stockPercentage = minStockLevel > 0 ? (currentStock / minStockLevel) * 100 : 0;
    
    if (stockPercentage < 25) {
      return 'CRITICAL';
    } else if (stockPercentage < 50) {
      return 'LOW STOCK';
    } else {
      return 'WARNING';
    }
  }

  exportToCsv(): void {
    if (!this.medicines || this.medicines.length === 0) {
      this.toastService.showWarning('No data available to export');
      return;
    }

    const headers = ['Medicine ID', 'Medicine Name', 'Current Stock', 'Min Stock Level', 'Status'];
    const data = this.medicines.map(med => [
      med.medicineId || med.id || '',
      med.name || '',
      med.currentStock || '0',
      med.minStockLevel || '0',
      this.getStockStatus(med.currentStock, med.minStockLevel)
    ]);

    this.exportService.exportToCsv(data, headers, 'Low_Stock_Medicines_Report');
    this.toastService.showSuccess('Report exported successfully');
  }

  getStockStatusClass(currentStock: number, minStock: number): string {
    if (currentStock === 0) return 'out-of-stock';
    if (currentStock < minStock / 2) return 'critical';
    if (currentStock < minStock) return 'low-stock';
    return 'normal';
  }
  
  // Pagination methods
  updatePaginatedMedicines(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = Math.min(startIndex + this.itemsPerPage, this.medicines.length);
    this.paginatedMedicines = this.medicines.slice(startIndex, endIndex);
  }
  
  onPageChange(page: number): void {
    this.currentPage = page;
    this.updatePaginatedMedicines();
  }
  
  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }
  
  getPagesArray(): number[] {
    return Array.from({length: this.totalPages}, (_, i) => i + 1);
  }
}
