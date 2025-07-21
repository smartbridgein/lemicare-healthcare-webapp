import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../../services/inventory.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ReportExportService } from '../../services/report-export.service';

@Component({
  selector: 'app-expiring-medicines-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './expiring-medicines-report.component.html',
  styleUrls: ['./expiring-medicines-report.component.scss']
})
export class ExpiringMedicinesReportComponent implements OnInit {
  medicines: any[] = [];
  isLoading = false;
  error: string | null = null;

  constructor(
    private inventoryService: InventoryService,
    private toastService: ToastService,
    private exportService: ReportExportService
  ) { }

  ngOnInit(): void {
    this.loadExpiringMedicines();
  }

  loadExpiringMedicines(): void {
    this.isLoading = true;
    this.error = null;

    this.inventoryService.getExpiringMedicines().subscribe({
      next: (data) => {
        this.medicines = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load expiring medicines data';
        this.toastService.showError(this.error);
        this.isLoading = false;
        console.error('Error loading expiring medicines:', err);
      }
    });
  }

  exportToCsv(): void {
    if (!this.medicines || this.medicines.length === 0) {
      this.toastService.showWarning('No data available to export');
      return;
    }

    const headers = ['Medicine ID', 'Medicine Name', 'Batch No', 'Expiry Date', 'Stock Quantity', 'Status'];
    const data = this.medicines.map(med => [
      med.medicineId || med.id || '',
      med.name || '',
      med.batchNo || '',
      med.expiryDate || '',
      med.stockQuantity || '0',
      this.getExpiryStatus(med.expiryDate)
    ]);

    this.exportService.exportToCsv(data, headers, 'Expiring_Medicines_Report');
    this.toastService.showSuccess('Report exported successfully');
  }

  getExpiryStatus(expiryDate: string): string {
    if (!expiryDate) return 'Unknown';
    
    const expiry = new Date(expiryDate);
    const today = new Date();
    
    if (expiry < today) {
      return 'Expired';
    }
    
    // Check if within 90 days
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(today.getDate() + 90);
    
    if (expiry <= ninetyDaysFromNow) {
      return 'Expiring Soon';
    }
    
    return 'Valid';
  }

  getStatusClass(expiryDate: string): string {
    const status = this.getExpiryStatus(expiryDate);
    switch (status) {
      case 'Expired': return 'expired';
      case 'Expiring Soon': return 'expiring-soon';
      default: return 'valid';
    }
  }
}
