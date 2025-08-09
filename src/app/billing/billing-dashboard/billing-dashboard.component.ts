import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../shared/billing.service';
import { ReportExportService } from '../shared/report-export.service';
import { BillingDashboardStats, RevenueStats, RevenuePeriod, CategoryReport, Invoice, CashMemo, Receipt, Advance } from '../shared/billing.model';
import { RevenueChartComponent } from './revenue-chart/revenue-chart.component';
import { CategoryChartComponent } from './category-chart/category-chart.component';
import { AuthService, UserProfile } from '../../auth/shared/auth.service';

@Component({
  selector: 'app-billing-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, RevenueChartComponent, CategoryChartComponent],
  templateUrl: './billing-dashboard.component.html',
  styleUrls: ['./billing-dashboard.component.scss']
})
export class BillingDashboardComponent implements OnInit {
  // Permission properties
  isSuperAdmin = false;
  hasAccessToBillingDashboard = false;
  currentUser: UserProfile | null = null;
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

  constructor(
    private billingService: BillingService, 
    private reportExportService: ReportExportService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadUserPermissions();
    this.loadDashboardData();
    this.loadRevenueStats();
  }

  /**
   * Loads user permissions based on user profile
   * Only super admin (email hanan-clinic@lemicare.com) has access to billing dashboard
   */
  private loadUserPermissions(): void {
    // Get current user profile
    this.currentUser = this.authService.getCurrentUser();
    
    if (this.currentUser) {
      
      // Check if user is super admin (by email or role)
      const email = this.currentUser.email || '';
      const role = this.currentUser.role || '';
      
      const isSuperAdminEmail = email.toLowerCase() === 'hanan-clinic@lemicare.com';
      const isSuperAdminRole = role.toUpperCase() === 'ROLE_SUPER_ADMIN' || 
                             role.toUpperCase() === 'SUPER_ADMIN';
      
      this.isSuperAdmin = isSuperAdminEmail || isSuperAdminRole;
      
      // Only super admin has access to billing dashboard
      this.hasAccessToBillingDashboard = this.isSuperAdmin;
      
      console.log('Billing Dashboard Access:', { 
        email, 
        role,
        isSuperAdmin: this.isSuperAdmin, 
        hasAccess: this.hasAccessToBillingDashboard 
      });
    } else {
      this.hasAccessToBillingDashboard = false;
      console.log('No user profile found, access denied to billing dashboard');
    }
  }

  loadDashboardData(): void {
    this.loading = true;
    
    // Load invoices for counter and recent list
    this.billingService.getAllInvoices().subscribe({
      next: (data: Invoice[]) => {
        this.stats.totalInvoices = data.length;
        this.recentInvoices = data.slice(0, 5); // Get the latest 5 invoices
        this.checkIfLoadingComplete();
      },
      error: (error: any) => {
        console.error('Error loading invoices', error);
        this.checkIfLoadingComplete();
      }
    });

    // Load cash memos for counter
    this.billingService.getAllCashMemos().subscribe({
      next: (data: CashMemo[]) => {
        this.stats.totalCashMemos = data.length;
        this.checkIfLoadingComplete();
      },
      error: (error: any) => {
        console.error('Error loading cash memos', error);
        this.checkIfLoadingComplete();
      }
    });

    // Load receipts for counter and recent list
    this.billingService.getAllReceipts().subscribe({
      next: (data: Receipt[]) => {
        this.stats.totalReceipts = data.length;
        this.recentReceipts = data.slice(0, 5); // Get the latest 5 receipts
        this.checkIfLoadingComplete();
      },
      error: (error: any) => {
        console.error('Error loading receipts', error);
        this.checkIfLoadingComplete();
      }
    });

    // Load advances for counter
    this.billingService.getAllAdvances().subscribe({
      next: (data: Advance[]) => {
        this.stats.totalAdvances = data.length;
        this.checkIfLoadingComplete();
      },
      error: (error: any) => {
        console.error('Error loading advances', error);
        this.checkIfLoadingComplete();
      }
    });
  }
  
  loadRevenueStats(): void {
    this.loadingRevenue = true;
    
    this.billingService.getRevenueStats(this.selectedPeriod).subscribe({
      next: (data: RevenueStats) => {
        this.revenueStats = data;
        this.loadingRevenue = false;
      },
      error: (error: any) => {
        console.error('Error loading revenue statistics', error);
        this.loadingRevenue = false;
      }
    });
  }
  
  loadCategoryReport(): void {
    this.loadingCategoryReport = true;
    
    this.billingService.getCategoryReport(this.selectedPeriod).subscribe({
      next: (data: CategoryReport) => {
        this.categoryReport = data;
        this.loadingCategoryReport = false;
      },
      error: (error: any) => {
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
