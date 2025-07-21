import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ReportExportService } from '../../services/report-export.service';
import Chart from 'chart.js/auto';

interface DailySalesData {
  date: string;
  totalSales: number;
  transactionCount: number;
}

interface MonthlySalesData {
  month: string;
  totalSales: number;
  transactionCount: number;
}

interface WeeklySalesReport {
  dailySales: DailySalesData[];
  totalSales: number;
  totalTransactions: number;
}

interface QuarterlySalesReport {
  monthlySales: MonthlySalesData[];
  totalSales: number;
  totalTransactions: number;
}

enum ReportPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  QUARTERLY = 'quarterly'
}

interface ReportData {
  date: string;
  sales: number;
  transactions: number;
}

@Component({
  selector: 'app-advanced-sales-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './advanced-sales-report.component.html',
  styleUrls: ['./advanced-sales-report.component.scss']
})
export class AdvancedSalesReportComponent implements OnInit, AfterViewInit {
  @ViewChild('salesChart') salesChartCanvas!: ElementRef;
  
  reportForm!: FormGroup;
  reportPeriods = [
    { value: ReportPeriod.DAILY, label: 'Daily' },
    { value: ReportPeriod.WEEKLY, label: 'Weekly' },
    { value: ReportPeriod.QUARTERLY, label: 'Quarterly' }
  ];
  
  currentYear = new Date().getFullYear();
  quarters = [1, 2, 3, 4];
  
  isLoading = false;
  error: string | null = null;
  reportData: any = null;
  salesChart!: Chart;
  
  constructor(
    private fb: FormBuilder,
    private inventoryService: InventoryService,
    private toastService: ToastService,
    private exportService: ReportExportService
  ) {}
  
  ngOnInit(): void {
    this.initForm();
  }
  
  ngAfterViewInit(): void {
    this.initializeChart();
  }
  
  initForm(): void {
    const today = new Date();
    const todayStr = this.formatDateForInput(today);
    
    // Calculate week start (Monday) and end (Sunday)
    const currentDay = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    // Calculate current quarter
    const currentMonth = today.getMonth();
    const currentQuarter = Math.floor(currentMonth / 3) + 1;
    
    this.reportForm = this.fb.group({
      period: [ReportPeriod.DAILY],
      
      // Daily report fields
      dailyDate: [todayStr],
      
      // Weekly report fields
      weekStartDate: [this.formatDateForInput(weekStart)],
      weekEndDate: [this.formatDateForInput(weekEnd)],
      
      // Quarterly report fields
      quarterYear: [this.currentYear],
      quarter: [currentQuarter]
    });
    
    this.subscribeToFormChanges();
    
    // Generate initial report
    this.generateReport();
  }
  
  initializeChart(): void {
    if (!this.salesChartCanvas) return;
    
    const ctx = this.salesChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    
    this.salesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Sales Amount',
          data: [],
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgb(54, 162, 235)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Amount (INR)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          }
        }
      }
    });
  }
  
  resetChart(): void {
    if (this.salesChart) {
      this.salesChart.destroy();
    }
  }
  
  subscribeToFormChanges(): void {
    const periodControl = this.reportForm.get('period');
    if (!periodControl) return;
    
    periodControl.valueChanges.subscribe(period => {
      this.resetChart();
    });
  }
  
  generateReport(): void {
    this.isLoading = true;
    this.error = null;
    
    const period = this.reportForm.get('period')?.value;
    
    switch (period) {
      case ReportPeriod.DAILY:
        this.generateDailyReport();
        break;
      case ReportPeriod.WEEKLY:
        this.generateWeeklyReport();
        break;
      case ReportPeriod.QUARTERLY:
        this.generateQuarterlyReport();
        break;
    }
  }
  
  generateDailyReport(): void {
    const date = this.reportForm.get('dailyDate')?.value;
    
    this.inventoryService.getDailySales(date).subscribe({
      next: (data) => {
        this.reportData = data;
        this.updateChart([date], [data.totalSales]);
        this.isLoading = false;
      },
      error: (err) => {
        console.error(`Error loading daily sales data for ${date}`, err);
        this.error = `Failed to load daily sales data for ${date}. Please try again.`;
        this.toastService.showError(this.error);
        this.isLoading = false;
      }
    });
  }
  
  generateWeeklyReport(): void {
    const startDate = this.reportForm.get('weekStartDate')?.value;
    const endDate = this.reportForm.get('weekEndDate')?.value;
    
    this.inventoryService.getWeeklySales(startDate, endDate).subscribe({
      next: (data) => {
        this.reportData = data;
        
        // Prepare chart data
        const dates = data.dailySales.map((item: DailySalesData) => item.date);
        const salesValues = data.dailySales.map((item: DailySalesData) => item.totalSales);
        this.updateChart(dates, salesValues);
        
        this.isLoading = false;
      },
      error: (err) => {
        console.error(`Error loading weekly sales data`, err);
        this.error = `Failed to load weekly sales data. Please try again.`;
        this.toastService.showError(this.error);
        this.isLoading = false;
      }
    });
  }
  
  generateQuarterlyReport(): void {
    const year = this.reportForm.get('quarterYear')?.value;
    const quarter = this.reportForm.get('quarter')?.value;
    
    this.inventoryService.getQuarterlySales(year, quarter).subscribe({
      next: (data) => {
        this.reportData = data;
        
        // Prepare chart data
        const months = data.monthlySales.map((item: MonthlySalesData) => item.month);
        const salesValues = data.monthlySales.map((item: MonthlySalesData) => item.totalSales);
        this.updateChart(months, salesValues);
        
        this.isLoading = false;
      },
      error: (err) => {
        console.error(`Error loading quarterly sales data`, err);
        this.error = `Failed to load quarterly sales data. Please try again.`;
        this.toastService.showError(this.error);
        this.isLoading = false;
      }
    });
  }
  
  updateChart(labels: string[], data: number[]): void {
    if (this.salesChart) {
      this.salesChart.data.labels = labels;
      this.salesChart.data.datasets[0].data = data;
      this.salesChart.update();
    }
  }
  
  exportToPdf(): void {
    let title = '';
    let fileName = '';
    let headers: string[] = [];
    let data: Record<string, string | number>[] = [];
    
    const period = this.reportForm.get('period')?.value;
    
    switch (period) {
      case ReportPeriod.DAILY:
        const date = this.reportForm.get('dailyDate')?.value;
        title = `Daily Sales Report - ${date}`;
        fileName = `daily_sales_${date}`;
        headers = ['Date', 'Total Sales', 'Transactions'];
        data = [{
          date: date,
          totalsales: this.formatCurrency(this.reportData.totalSales),
          transactions: this.reportData.transactionCount
        }];
        break;
        
      case ReportPeriod.WEEKLY:
        const startDate = this.reportForm.get('weekStartDate')?.value;
        const endDate = this.reportForm.get('weekEndDate')?.value;
        title = `Weekly Sales Report - ${startDate} to ${endDate}`;
        fileName = `weekly_sales_${startDate}_to_${endDate}`;
        headers = ['Date', 'Total Sales', 'Transactions'];
        data = this.reportData.dailySales.map((item: DailySalesData) => ({
          date: item.date,
          totalsales: this.formatCurrency(item.totalSales),
          transactions: item.transactionCount
        }));
        break;
        
      case ReportPeriod.QUARTERLY:
        const year = this.reportForm.get('quarterYear')?.value;
        const quarter = this.reportForm.get('quarter')?.value;
        title = `Quarterly Sales Report - Q${quarter} ${year}`;
        fileName = `quarterly_sales_Q${quarter}_${year}`;
        headers = ['Month', 'Total Sales', 'Transactions'];
        data = this.reportData.monthlySales.map((item: MonthlySalesData) => ({
          month: item.month,
          totalsales: this.formatCurrency(item.totalSales),
          transactions: item.transactionCount
        }));
        break;
    }
    
    this.exportService.exportToPdf(data, headers, title, fileName);
  }
  
  exportToExcel(): void {
    let fileName = '';
    let data: Record<string, string | number>[] = [];
    
    const period = this.reportForm.get('period')?.value;
    
    switch (period) {
      case ReportPeriod.DAILY:
        const date = this.reportForm.get('dailyDate')?.value;
        fileName = `daily_sales_${date}`;
        data = [{
          Date: date,
          'Total Sales': this.reportData.totalSales,
          'Transaction Count': this.reportData.transactionCount
        }];
        break;
        
      case ReportPeriod.WEEKLY:
        const startDate = this.reportForm.get('weekStartDate')?.value;
        const endDate = this.reportForm.get('weekEndDate')?.value;
        fileName = `weekly_sales_${startDate}_to_${endDate}`;
        data = this.reportData.dailySales.map((item: DailySalesData) => ({
          Date: item.date,
          'Total Sales': item.totalSales,
          'Transaction Count': item.transactionCount
        }));
        break;
        
      case ReportPeriod.QUARTERLY:
        const year = this.reportForm.get('quarterYear')?.value;
        const quarter = this.reportForm.get('quarter')?.value;
        fileName = `quarterly_sales_Q${quarter}_${year}`;
        data = this.reportData.monthlySales.map((item: MonthlySalesData) => ({
          Month: item.month,
          'Total Sales': item.totalSales,
          'Transaction Count': item.transactionCount
        }));
        break;
    }
    
    this.exportService.exportToExcel(data, fileName);
  }
  
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR' 
    }).format(amount);
  }
  
  formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  }
}
