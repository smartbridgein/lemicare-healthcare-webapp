import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { DailySalesReport } from '../../models/inventory.models';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-daily-sales-report',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule
  ],
  templateUrl: './daily-sales-report.component.html',
  styleUrls: ['./daily-sales-report.component.scss']
})
export class DailySalesReportComponent implements OnInit {
  dateControl = new FormControl('');
  dailySalesReport: DailySalesReport | null = null;
  isLoading = false;
  error: string | null = null;

  constructor(
    private inventoryService: InventoryService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Initialize with current date
    const today = new Date();
    const formattedDate = this.formatDateForInput(today);
    this.dateControl.setValue(formattedDate);
    this.loadDailySalesData(this.formatDateForApi(today));
  }
  
  /**
   * Handle date input change event
   */
  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const date = new Date(input.value);
    if (!isNaN(date.getTime())) {
      this.loadDailySalesData(this.formatDateForApi(date));
    }
  }

  loadDailySalesData(date: string): void {
    this.isLoading = true;
    this.error = null;
    
    this.inventoryService.getDailySales(date).subscribe({
      next: (data) => {
        this.dailySalesReport = data;
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

  formatDateForApi(date: Date): string {
    return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  }
  
  /**
   * Format date for HTML date input (YYYY-MM-DD format)
   */
  formatDateForInput(date: Date): string {
    return this.formatDateForApi(date);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR' 
    }).format(amount);
  }

  onRefresh(): void {
    const selectedDate = this.dateControl.value;
    if (selectedDate) {
      // Date is already in YYYY-MM-DD format in the control, so we can use it directly
      this.loadDailySalesData(selectedDate);
    }
  }
}
