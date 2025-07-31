import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../../services/inventory.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ReportExportService } from '../../services/report-export.service';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

@Component({
  selector: 'app-expiring-medicines-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './expiring-medicines-report.component.html',
  styleUrls: ['./expiring-medicines-report.component.scss']
})
export class ExpiringMedicinesReportComponent implements OnInit, AfterViewInit, OnDestroy {
  medicines: any[] = [];
  isLoading = false;
  error: string | null = null;
  
  // Pagination properties
  currentPage = 1;
  itemsPerPage = 6;
  totalItems = 0;
  paginatedMedicines: any[] = [];
  
  // Chart properties
  @ViewChild('expiryChart', { static: false }) expiryChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryChart', { static: false }) categoryChartRef!: ElementRef<HTMLCanvasElement>;
  private expiryChart: Chart | null = null;
  private categoryChart: Chart | null = null;
  
  // Chart data
  chartData = {
    expiryDistribution: [] as any[],
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
    this.loadExpiringMedicines();
  }

  ngAfterViewInit(): void {
    // Charts will be initialized after data is loaded
  }

  ngOnDestroy(): void {
    if (this.expiryChart) {
      this.expiryChart.destroy();
    }
    if (this.categoryChart) {
      this.categoryChart.destroy();
    }
  }

  // Getter methods for template statistics
  get expiredCount(): number {
    return this.medicines.filter(m => (m.daysToExpiry || 0) <= 0).length;
  }

  get criticalCount(): number {
    return this.medicines.filter(m => (m.daysToExpiry || 0) > 0 && (m.daysToExpiry || 0) <= 3).length;
  }

  get warningCount(): number {
    return this.medicines.filter(m => (m.daysToExpiry || 0) > 3 && (m.daysToExpiry || 0) <= 7).length;
  }

  get soonCount(): number {
    return this.medicines.filter(m => (m.daysToExpiry || 0) > 7).length;
  }

  loadExpiringMedicines(): void {
    this.isLoading = true;
    this.error = null;

    this.inventoryService.getExpiringMedicines().subscribe({
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
        this.error = 'Failed to load expiring medicines data';
        this.toastService.showError(this.error);
        this.isLoading = false;
        console.error('Error loading expiring medicines:', err);
      }
    });
  }

  // Get CSS class for days to expiry display
  getDaysClass(daysToExpiry: number): string {
    if (daysToExpiry <= 0) {
      return 'text-danger fw-bold'; // Expired
    } else if (daysToExpiry <= 3) {
      return 'text-danger'; // Critical - expiring in 3 days
    } else if (daysToExpiry <= 7) {
      return 'text-warning'; // Warning - expiring in 7 days
    } else {
      return 'text-info'; // Info - expiring in 10 days
    }
  }

 

  // Get expiry status text based on days to expiry
  getExpiryStatus(daysToExpiry: number): string {
    if (daysToExpiry <= 0) {
      return 'EXPIRED';
    } else if (daysToExpiry <= 3) {
      return 'CRITICAL';
    } else if (daysToExpiry <= 7) {
      return 'EXPIRING SOON';
    } else {
      return 'EXPIRES SOON';
    }
  }

  // Get status class for badge based on days to expiry
  getStatusClass(daysToExpiry: number): string {
    if (daysToExpiry <= 0) {
      return 'expired'; // Red badge for expired
    } else if (daysToExpiry <= 7) {
      return 'expiring-soon'; // Yellow badge for expiring soon
    } else {
      return 'valid'; // Green badge for valid
    }
  }

  // Prepare data for charts
  prepareChartData(): void {
    // Prepare expiry distribution data
    const expiryCategories = {
      'Expired': 0,
      'Critical (1-3 days)': 0,
      'Warning (4-7 days)': 0,
      'Soon (8-30 days)': 0
    };

    // Prepare category distribution data
    const categoryMap = new Map<string, number>();

    this.medicines.forEach(medicine => {
      const daysToExpiry = medicine.daysToExpiry || 0;
      
      // Categorize by expiry timeline
      if (daysToExpiry <= 0) {
        expiryCategories['Expired']++;
      } else if (daysToExpiry <= 3) {
        expiryCategories['Critical (1-3 days)']++;
      } else if (daysToExpiry <= 7) {
        expiryCategories['Warning (4-7 days)']++;
      } else {
        expiryCategories['Soon (8-30 days)']++;
      }

      // Categorize by medicine type/category (using first word of medicine name as category)
      const category = medicine.name ? medicine.name.split(' ')[0] : 'Others';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    // Convert to chart data format
    this.chartData.expiryDistribution = Object.entries(expiryCategories)
      .filter(([_, count]) => count > 0)
      .map(([label, count]) => ({ label, count }));

    this.chartData.categoryDistribution = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8) // Top 8 categories
      .map(([label, count]) => ({ label, count }));
  }

  // Initialize charts
  initializeCharts(): void {
    this.createExpiryChart();
    this.createCategoryChart();
  }

  // Create expiry distribution chart
  private createExpiryChart(): void {
    if (!this.expiryChartRef?.nativeElement || this.chartData.expiryDistribution.length === 0) {
      return;
    }

    const ctx = this.expiryChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.expiryChart) {
      this.expiryChart.destroy();
    }

    const labels = this.chartData.expiryDistribution.map(item => item.label);
    const data = this.chartData.expiryDistribution.map(item => item.count);
    const colors = ['#dc3545', '#fd7e14', '#ffc107', '#17a2b8']; // Red, Orange, Yellow, Blue

    this.expiryChart = new Chart(ctx, {
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
          label: 'Expiring Medicines',
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

  exportToCsv(): void {
    if (!this.medicines || this.medicines.length === 0) {
      this.toastService.showWarning('No data available to export');
      return;
    }

    const headers = ['Medicine ID', 'Medicine Name', 'Batch No', 'Expiry Date', 'Days to Expiry', 'Quantity', 'Purchase Ref', 'Status'];
    const data = this.medicines.map(med => [
      med.id || '',
      med.name || '',
      med.batchNo || '',
      med.expiryDate || '',
      med.daysToExpiry?.toString() || '0',
      med.quantity?.toString() || '0',
      med.referenceId || 'N/A',
      this.getExpiryStatus(med.daysToExpiry || 0)
    ]);

    this.exportService.exportToCsv(data, headers, 'Expiring_Medicines_Report');
    this.toastService.showSuccess('Report exported successfully');
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
    const totalPages = this.totalPages;
    const pages: number[] = [];
    
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    
    return pages;
  }
}
