import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../../services/inventory.service';
import * as XLSX from 'xlsx';

interface ExpiringMedicine {
  id?: string;
  medicineId?: string;
  name: string;
  batchNo?: string;
  expiryDate?: string;
  stockQuantity?: number;
}

interface LowStockMedicine {
  id?: string;
  medicineId?: string;
  name: string;
  currentStock?: number;
  threshold?: number;
  lowStockThreshold?: number;
}

// Using specific interfaces for each medicine type for better type safety

@Component({
  selector: 'app-inventory-alerts-dashboard',
  templateUrl: './inventory-alerts-dashboard.component.html',
  styleUrls: ['./inventory-alerts-dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class InventoryAlertsDashboardComponent implements OnInit {
  expiringMedicines: ExpiringMedicine[] = [];
  lowStockMedicines: LowStockMedicine[] = [];
  loadingExpiring = true;
  loadingLowStock = true;
  errorExpiring: string | null = null;
  errorLowStock: string | null = null;

  constructor(private inventoryService: InventoryService) { }

  ngOnInit(): void {
    this.loadExpiringMedicines();
    this.loadLowStockMedicines();
  }

  loadExpiringMedicines(): void {
    this.loadingExpiring = true;
    this.errorExpiring = null;
    
    this.inventoryService.getExpiringMedicines().subscribe({
      next: (data: ExpiringMedicine[]) => {
        this.expiringMedicines = data;
        this.loadingExpiring = false;
      },
      error: (err: any) => {
        console.error('Error loading expiring medicines', err);
        this.errorExpiring = 'Failed to load expiring medicines. Please try again later.';
        this.loadingExpiring = false;
      }
    });
  }

  loadLowStockMedicines(): void {
    this.loadingLowStock = true;
    this.errorLowStock = null;
    
    this.inventoryService.getLowStockMedicines().subscribe({
      next: (data: LowStockMedicine[]) => {
        this.lowStockMedicines = data;
        this.loadingLowStock = false;
      },
      error: (err: any) => {
        console.error('Error loading low stock medicines', err);
        this.errorLowStock = 'Failed to load low stock medicines. Please try again later.';
        this.loadingLowStock = false;
      }
    });
  }

  getExpiryStatus(expiryDate: string | undefined): string {
    if (!expiryDate) return 'Unknown';
    
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysDifference = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));
    
    if (daysDifference < 0) {
      return 'Expired';
    } else if (daysDifference < 30) {
      return 'Critical';
    } else if (daysDifference < 90) {
      return 'Warning';
    } else {
      return 'OK';
    }
  }

  getExpiryStatusClass(expiryDate: string | undefined): string {
    if (!expiryDate) return '';
    
    const status = this.getExpiryStatus(expiryDate);
    
    switch (status) {
      case 'Expired':
      case 'Critical':
        return 'critical';
      case 'Warning':
        return 'warning';
      case 'OK':
        return 'ok';
      default:
        return '';
    }
  }

  getStockStatus(currentStock: number | undefined, threshold: number | undefined): string {
    if (currentStock === undefined || threshold === undefined) return 'Unknown';
    
    if (currentStock === 0) {
      return 'Out of Stock';
    } else if (currentStock < threshold * 0.5) {
      return 'Critical';
    } else if (currentStock < threshold) {
      return 'Low';
    } else {
      return 'OK';
    }
  }

  getStockStatusClass(currentStock: number | undefined, threshold: number | undefined): string {
    if (currentStock === undefined || threshold === undefined) return '';
    
    if (currentStock === 0 || currentStock < threshold * 0.5) {
      return 'critical';
    } else if (currentStock < threshold) {
      return 'warning';
    } else {
      return 'ok';
    }
  }

  exportExpiringMedicines(): void {
    this.exportToExcel(this.expiringMedicines, 'Expiring_Medicines_Report');
  }

  exportLowStockMedicines(): void {
    this.exportToExcel(this.lowStockMedicines, 'Low_Stock_Medicines_Report');
  }

  private exportToExcel(data: (ExpiringMedicine | LowStockMedicine)[], fileName: string): void {
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
    
    // Format header row
    const headerRange = XLSX.utils.decode_range(worksheet['!ref'] as string);
    for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '1';
      if (worksheet[address]) {
        worksheet[address].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "EFEFEF" } }
        };
      }
    }
    
    // Auto-size columns
    const maxWidths: number[] = [];
    for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
      let maxWidth = 10; // Default width
      for (let R = headerRange.s.r; R <= headerRange.e.r; ++R) {
        const address = XLSX.utils.encode_cell({r: R, c: C});
        if (worksheet[address] && worksheet[address].v) {
          const cellValue = String(worksheet[address].v);
          maxWidth = Math.max(maxWidth, cellValue.length);
        }
      }
      maxWidths[C] = maxWidth;
    }
    
    worksheet['!cols'] = maxWidths.map(width => ({ width }));
    
    // Generate Excel file
    XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
}
