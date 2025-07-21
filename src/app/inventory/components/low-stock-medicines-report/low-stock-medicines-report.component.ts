import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ReportExportService } from '../../services/report-export.service';

@Component({
  selector: 'app-low-stock-medicines-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './low-stock-medicines-report.component.html',
  styleUrls: ['./low-stock-medicines-report.component.scss']
})
export class LowStockMedicinesReportComponent implements OnInit {
  medicines: any[] = [];
  isLoading = false;
  error: string | null = null;
  
  // Pagination properties
  currentPage = 1;
  itemsPerPage = 5;
  totalItems = 0;
  paginatedMedicines: any[] = [];
  
  // Make Math available for the template
  Math = Math;

  constructor(
    private inventoryService: InventoryService,
    private toastService: ToastService,
    private exportService: ReportExportService
  ) { }

  ngOnInit(): void {
    this.loadLowStockMedicines();
  }

  loadLowStockMedicines(): void {
    this.isLoading = true;
    this.error = null;

    this.inventoryService.getLowStockMedicines().subscribe({
      next: (data) => {
        this.medicines = data;
        this.totalItems = data.length;
        this.updatePaginatedMedicines();
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load low stock medicines data';
        this.toastService.showError(this.error);
        this.isLoading = false;
        console.error('Error loading low stock medicines:', err);
      }
    });
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

  getStockStatus(currentStock: number, minStock: number): string {
    if (currentStock === 0) return 'Out of Stock';
    if (currentStock < minStock / 2) return 'Critical';
    if (currentStock < minStock) return 'Low Stock';
    return 'Normal';
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
