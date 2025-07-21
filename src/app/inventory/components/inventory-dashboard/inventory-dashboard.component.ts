import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { InventoryService } from '../../services/inventory.service';
import { InventorySummary } from '../../models/inventory.models';

@Component({
  selector: 'app-inventory-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inventory-dashboard.component.html',
  styleUrls: ['./inventory-dashboard.component.scss']
})
export class InventoryDashboardComponent implements OnInit {
  // Summary data
  purchases: number = 0;
  purchaseReturns: number = 0;
  sales: number = 0;
  saleReturns: number = 0;
  
  // Loading state
  loading: boolean = true;
  
  // Chart data - we'll mock this for now
  chartData: any = {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    purchaseData: [10, 15, 8, 25, 35, 22, 30, 45, 60, 22, 15, 10],
    purchaseReturnData: [2, 3, 1, 4, 6, 3, 4, 6, 8, 3, 2, 1],
    saleData: [8, 12, 6, 20, 30, 18, 25, 40, 55, 20, 12, 8],
    saleReturnData: [1, 2, 1, 3, 4, 2, 3, 5, 7, 2, 1, 1]
  };

  constructor(private inventoryService: InventoryService) { }

  ngOnInit(): void {
    // In a real app, we'd fetch this data from the API
    this.loadSummaryData();
  }

  loadSummaryData(): void {
    // For now, we'll use mock data; in a real app, we'd use the service
    setTimeout(() => {
      this.purchases = 193;
      this.purchaseReturns = 6;
      this.sales = 2631;
      this.saleReturns = 40;
      this.loading = false;
    }, 500);
    
    // Actual API call would look like:
    /*
    this.inventoryService.getInventorySummary().subscribe({
      next: (data: InventorySummary) => {
        this.purchases = data.totalPurchases;
        this.purchaseReturns = data.totalPurchaseReturns;
        this.sales = data.totalSales;
        this.saleReturns = data.totalSaleReturns;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading inventory summary', err);
        this.loading = false;
      }
    });
    */
  }
}
