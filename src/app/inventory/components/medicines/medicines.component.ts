import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { Medicine, StockStatus } from '../../models/inventory.models';

@Component({
  selector: 'app-medicines',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './medicines.component.html',
  styleUrls: ['./medicines.component.scss']
})
export class MedicinesComponent implements OnInit {
  medicines: Medicine[] = [];
  filteredMedicines: Medicine[] = [];
  searchTerm: string = '';
  loading: boolean = true;
  StockStatus = StockStatus; // Expose enum to template

  constructor(private inventoryService: InventoryService) { }

  ngOnInit(): void {
    this.loadMedicines();
  }

  loadMedicines(): void {
    this.inventoryService.getMedicines().subscribe({
      next: (data) => {
        this.medicines = data;
        this.filteredMedicines = [...data];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading medicines', err);
        this.loading = false;
        // For development, load some sample data if API fails
        this.loadSampleData();
      }
    });
  }

  search(): void {
    if (!this.searchTerm.trim()) {
      this.filteredMedicines = [...this.medicines];
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredMedicines = this.medicines.filter(medicine => 
      medicine.name.toLowerCase().includes(term) ||
      medicine.unitOfMeasurement.toLowerCase().includes(term)
    );
  }

  getStockStatusClass(status: StockStatus): string {
    switch (status) {
      case StockStatus.LOW:
        return 'stock-low';
      case StockStatus.NORMAL:
        return 'stock-normal';
      case StockStatus.OUT_OF_STOCK:
        return 'stock-out';
      default:
        return '';
    }
  }
  
  /**
   * Format medicine ID to make it shorter and more readable
   * Example: 'med_a1b2c3d4-e5f6-7890-abcd-ef1234567890' -> 'M-a1b2'
   */
  formatMedicineId(id: string | undefined): string {
    if (!id) return 'N/A';
    
    // If it's a long UUID-style ID
    if (id.includes('_')) {
      // Split by underscore and get the second part (the UUID)
      const parts = id.split('_');
      if (parts.length > 1) {
        // Take just the first 4 characters of the UUID
        return `M-${parts[1].substring(0, 4)}`;
      }
    }
    
    // For numeric IDs or other formats, just return as is or with prefix
    return id.length > 8 ? `M-${id.substring(0, 4)}` : id;
  }

  // Sample data for development/testing
  private loadSampleData(): void {
    this.medicines = [
      { 
        id: 'med_1', 
        name: 'Acnecrosis body spray', 
        unitOfMeasurement: 'Spray',
        lowStockThreshold: 10, 
        stockQuantity: 0, 
        stockStatus: StockStatus.OUT_OF_STOCK,
        taxProfileId: 'tax_1'
      },
      { 
        id: 'med_2', 
        name: 'Adipan Gref serum', 
        unitOfMeasurement: 'Serum',
        lowStockThreshold: 5, 
        stockQuantity: 4, 
        stockStatus: StockStatus.LOW,
        taxProfileId: 'tax_1'
      },
      { 
        id: 'med_3', 
        name: 'Aftaglow lotion', 
        unitOfMeasurement: 'Bottle',
        lowStockThreshold: 5, 
        stockQuantity: 0, 
        stockStatus: StockStatus.OUT_OF_STOCK,
        taxProfileId: 'tax_2'
      },
      { 
        id: 'med_4', 
        name: 'Armosoft nail lacquer', 
        unitOfMeasurement: 'Bottle',
        lowStockThreshold: 20, 
        stockQuantity: 99, 
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'tax_1'
      },
      { 
        id: 'med_5', 
        name: 'Anthocyn TX cream', 
        unitOfMeasurement: 'Tube',
        lowStockThreshold: 15, 
        stockQuantity: 24, 
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'tax_2'
      }
    ];
    this.filteredMedicines = [...this.medicines];
  }
}
