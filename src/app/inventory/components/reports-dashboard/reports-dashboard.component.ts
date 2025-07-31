import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { StockByCategoryReportComponent } from '../stock-by-category-report/stock-by-category-report.component';
import { DailySalesReportComponent } from '../daily-sales-report/daily-sales-report.component';
import { AdvancedSalesReportComponent } from '../advanced-sales-report/advanced-sales-report.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-reports-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    StockByCategoryReportComponent,
    DailySalesReportComponent,
    AdvancedSalesReportComponent
  ],
  templateUrl: './reports-dashboard.component.html',
  styleUrls: ['./reports-dashboard.component.scss']
})
export class ReportsDashboardComponent implements OnInit {
  activeTab: 'basic' | 'advanced' = 'basic';
  currentDateTime: Date = new Date();
  lastRefreshed: string = '';
  
  constructor(public router: Router) {}
  
  ngOnInit() {
    this.updateLastRefreshed();
    // Auto-refresh time every minute
    setInterval(() => {
      this.currentDateTime = new Date();
    }, 60000);
  }
  
  /**
   * Set the active report tab
   * @param tab Tab to activate ('basic' or 'advanced')
   */
  setActiveTab(tab: 'basic' | 'advanced'): void {
    this.activeTab = tab;
    this.updateLastRefreshed();
  }
  
  /**
   * Format the current date and time as a readable string
   */
  private updateLastRefreshed(): void {
    this.lastRefreshed = new Date().toLocaleString('en-US', { 
      month: 'short',
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  /**
   * Trigger report refresh and update timestamps
   */
  refreshReports(): void {
    // This would trigger child component refreshes in a real implementation
    this.updateLastRefreshed();
  }
}
