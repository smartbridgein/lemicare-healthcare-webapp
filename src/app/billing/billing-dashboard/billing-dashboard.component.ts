import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../shared/billing.service';
import { ReportExportService } from '../shared/report-export.service';
import { BillingDashboardStats, RevenueStats, RevenuePeriod, CategoryReport } from '../shared/billing.model';
import { RevenueChartComponent } from './revenue-chart/revenue-chart.component';
import { CategoryChartComponent } from './category-chart/category-chart.component';

@Component({
  selector: 'app-billing-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, RevenueChartComponent, CategoryChartComponent],
  templateUrl: './billing-dashboard.component.html',
  styleUrls: ['./billing-dashboard.component.scss']
})
export class BillingDashboardComponent implements OnInit {
  stats: BillingDashboardStats = {
    totalCashMemos: 0,
    totalInvoices: 0,
    totalReceipts: 0,
    totalAdvances: 0
  };
  
  // Revenue statistics
  revenueStats: RevenueStats = {
    totalRevenue: 0,
    invoicesRevenue: 0,
    cashMemosRevenue: 0,
    receiptsRevenue: 0,
    periodLabel: 'Today'
  };
  
  // Category report properties
  categoryReport: CategoryReport = {
    categories: [],
    totalRevenue: 0,
    totalCount: 0,
    periodLabel: 'Today'
  };
  
  // Safely check if categories exist and have items
  hasCategoryData(): boolean {
    return !this.loadingCategoryReport && 
           this.categoryReport && 
           this.categoryReport.categories && 
           this.categoryReport.categories.length > 0;
  }
  
  // For period filtering
  selectedPeriod: RevenuePeriod = 'today';
  availablePeriods: {value: RevenuePeriod, label: string}[] = [
    {value: 'today', label: 'Today'},
    {value: 'week', label: 'This Week'},
    {value: 'month', label: 'This Month'},
    {value: 'quarter', label: 'This Quarter'},
    {value: 'year', label: 'This Year'}
  ];
  
  recentInvoices: any[] = [];
  recentReceipts: any[] = [];
  recentCashMemos: any[] = [];
  recentAdvances: any[] = [];
  loading = true;
  loadingRevenue = true;
  loadingCategoryReport = true;

  // References to chart components for export
  @ViewChild('revenueChartContainer') revenueChartContainer!: ElementRef;
  @ViewChild('categoryChartContainer') categoryChartContainer!: ElementRef;

  constructor(private billingService: BillingService, private reportExportService: ReportExportService) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadRevenueStats();
  }

  loadDashboardData(): void {
    this.loading = true;
    
    // Load invoices for counter and recent list
    this.billingService.getAllInvoices().subscribe({
      next: (data) => {
        this.stats.totalInvoices = data.length;
        this.recentInvoices = data.slice(0, 5); // Get the latest 5 invoices
        this.checkIfLoadingComplete();
      },
      error: (error) => {
        console.error('Error loading invoices', error);
        this.checkIfLoadingComplete();
      }
    });

    // Load cash memos for counter
    this.billingService.getAllCashMemos().subscribe({
      next: (data) => {
        this.stats.totalCashMemos = data.length;
        this.checkIfLoadingComplete();
      },
      error: (error) => {
        console.error('Error loading cash memos', error);
        this.checkIfLoadingComplete();
      }
    });

    // Load receipts for counter and recent list
    this.billingService.getAllReceipts().subscribe({
      next: (data) => {
        this.stats.totalReceipts = data.length;
        this.recentReceipts = data.slice(0, 5); // Get the latest 5 receipts
        this.checkIfLoadingComplete();
      },
      error: (error) => {
        console.error('Error loading receipts', error);
        this.checkIfLoadingComplete();
      }
    });

    // Load advances for counter
    this.billingService.getAllAdvances().subscribe({
      next: (data) => {
        this.stats.totalAdvances = data.length;
        this.checkIfLoadingComplete();
      },
      error: (error) => {
        console.error('Error loading advances', error);
        this.checkIfLoadingComplete();
      }
    });
  }
  
  loadRevenueStats(): void {
    this.loadingRevenue = true;
    
    this.billingService.getRevenueStats(this.selectedPeriod).subscribe({
      next: (data) => {
        this.revenueStats = data;
        this.loadingRevenue = false;
      },
      error: (error) => {
        console.error('Error loading revenue statistics', error);
        this.loadingRevenue = false;
      }
    });
  }
  
  loadCategoryReport(): void {
    this.loadingCategoryReport = true;
    
    this.billingService.getCategoryReport(this.selectedPeriod).subscribe({
      next: (data) => {
        this.categoryReport = data;
        this.loadingCategoryReport = false;
      },
      error: (error) => {
        console.error('Error loading category report', error);
        this.loadingCategoryReport = false;
      }
    });
  }
  
  onPeriodChange(): void {
    this.loadRevenueStats();
    this.loadCategoryReport();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  }

  // Export functions
  exportRevenueToExcel(): void {
    this.reportExportService.exportRevenueToExcel(this.revenueStats);
  }
  
  exportRevenueToPdf(): void {
    // Use the chart container if available
    const chartElement = this.revenueChartContainer?.nativeElement;
    this.reportExportService.exportRevenueToPdf(this.revenueStats, chartElement);
  }
  
  exportCategoryReportToExcel(): void {
    this.reportExportService.exportCategoryReportToExcel(this.categoryReport);
  }
  
  exportCategoryReportToPdf(): void {
    // Use the chart container if available
    const chartElement = this.categoryChartContainer?.nativeElement;
    this.reportExportService.exportCategoryReportToPdf(this.categoryReport, chartElement);
  }

  private checkIfLoadingComplete(): void {
    // Check if all data is loaded
    if (this.recentInvoices.length > 0 && this.recentReceipts.length > 0) {
      this.loading = false;
    }
  }
}
