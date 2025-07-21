import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { ExpiringMedicine, LowStockMedicine } from '../../models/inventory.models';

// We use the interfaces from inventory.models.ts

@Component({
  selector: 'app-inventory-reports',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './inventory-reports.component.html',
  styleUrls: ['./inventory-reports.component.scss']
})
export class InventoryReportsComponent implements OnInit {
  expiringMedicines: ExpiringMedicine[] = [];
  lowStockMedicines: LowStockMedicine[] = [];
  activeReport: 'expiring' | 'low-stock' = 'expiring';
  loading: boolean = false;
  
  constructor(private inventoryService: InventoryService) {}

  ngOnInit(): void {
    this.loadExpiringMedicines();
  }

  loadExpiringMedicines(): void {
    this.loading = true;
    this.activeReport = 'expiring';
    
    this.inventoryService.getExpiringMedicines().subscribe({
      next: (data) => {
        this.expiringMedicines = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading expiring medicines', err);
        this.loading = false;
        this.loadSampleExpiringMedicines();
      }
    });
  }

  loadLowStockMedicines(): void {
    this.loading = true;
    this.activeReport = 'low-stock';
    
    this.inventoryService.getLowStockMedicines().subscribe({
      next: (data) => {
        this.lowStockMedicines = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading low stock medicines', err);
        this.loading = false;
        this.loadSampleLowStockMedicines();
      }
    });
  }

  changeReport(report: 'expiring' | 'low-stock'): void {
    if (report === 'expiring') {
      this.loadExpiringMedicines();
    } else {
      this.loadLowStockMedicines();
    }
  }

  getExpiryStatus(expiryDate: string): string {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return 'expired';
    } else if (diffDays <= 30) {
      return 'expiring-soon';
    } else if (diffDays <= 90) {
      return 'expiring-medium';
    } else {
      return 'safe';
    }
  }

  getStockStatus(medicine: ExpiringMedicine | LowStockMedicine): string {
    if ('threshold' in medicine) {
      // This is a LowStockMedicine
      if (medicine.currentStock <= 0) {
        return 'out-of-stock';
      } else if (medicine.currentStock <= medicine.threshold) {
        return 'low-stock';
      } else {
        return 'sufficient';
      }
    } else {
      // This is an ExpiringMedicine
      if (medicine.quantity <= 0) {
        return 'out-of-stock';
      } else {
        return 'sufficient';
      }
    }
  }

  exportToCSV(report: 'expiring' | 'low-stock'): void {
    const data = report === 'expiring' ? this.expiringMedicines : this.lowStockMedicines;
    
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }
    
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    // Add Headers
    if (report === 'expiring') {
      csvContent += 'ID,Name,Batch No,Expiry Date,Days Remaining,Stock Quantity\r\n';
      
      // Add Data for expiring medicines
      this.expiringMedicines.forEach(item => {
        csvContent += `${item.id},${item.name},${item.batchNo || ''},${item.expiryDate || ''},${item.daysRemaining || ''},${item.stockQuantity}\r\n`;
      });
    } else {
      csvContent += 'ID,Name,Current Stock,Low Stock Threshold\r\n';
      
      // Add Data for low stock medicines
      this.lowStockMedicines.forEach(item => {
        csvContent += `${item.id},${item.name},${item.currentStock},${item.lowStockThreshold}\r\n`;
      });
    }
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${report}-medicines-report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Sample data for development
  private loadSampleExpiringMedicines(): void {
    const today = new Date();
    
    // For expiring in 15 days
    const expiry15 = new Date();
    expiry15.setDate(today.getDate() + 15);
    
    // For expiring in 45 days
    const expiry45 = new Date();
    expiry45.setDate(today.getDate() + 45);
    
    this.expiringMedicines = [
      {
        id: 'MED001',
        name: 'Paracetamol 500mg',
        batchNo: 'B12345',
        expiryDate: '2023-08-15',
        daysToExpiry: 30, // Required field for ExpiringMedicine interface
        daysRemaining: 30, // For backward compatibility
        quantity: 120, // Required field for ExpiringMedicine interface
        stockQuantity: 120 // For backward compatibility
      },
      {
        id: 'MED002',
        name: 'Amoxicillin 250mg',
        batchNo: 'B23456',
        expiryDate: '2023-09-20',
        daysToExpiry: 45,
        daysRemaining: 45,
        quantity: 85,
        stockQuantity: 85
      },
      {
        id: 'MED003',
        name: 'Cetirizine 10mg',
        batchNo: 'B34567',
        expiryDate: '2023-07-10',
        daysToExpiry: 5,
        daysRemaining: 5,
        quantity: 30,
        stockQuantity: 30
      },
      {
        id: 'MED004',
        name: 'Omeprazole 20mg',
        batchNo: 'B45678',
        expiryDate: '2023-12-05',
        daysToExpiry: 120,
        daysRemaining: 120,
        quantity: 75,
        stockQuantity: 75
      },
      {
        id: 'MED005',
        name: 'Metformin 500mg',
        batchNo: 'B56789',
        expiryDate: '2023-10-18',
        daysToExpiry: 60,
        daysRemaining: 60,
        quantity: 60,
        stockQuantity: 60
      }
    ];
  }

  private loadSampleLowStockMedicines(): void {
    this.lowStockMedicines = [
      {
        id: 'MED006',
        name: 'Aspirin 75mg',
        currentStock: 15,
        threshold: 25,
        lowStockThreshold: 25
      },
      {
        id: 'MED007',
        name: 'Atorvastatin 10mg',
        currentStock: 10,
        threshold: 30,
        lowStockThreshold: 30
      },
      {
        id: 'MED008',
        name: 'Losartan 50mg',
        currentStock: 8,
        threshold: 20,
        lowStockThreshold: 20
      },
      {
        id: 'MED009',
        name: 'Metoprolol 25mg',
        currentStock: 5,
        threshold: 15,
        lowStockThreshold: 15
      },
      {
        id: 'MED010',
        name: 'Amlodipine 5mg',
        currentStock: 0,
        threshold: 25,
        lowStockThreshold: 25
      }
    ];
  }
}
