import { Component, Input, OnInit, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sale } from '../../../models/inventory.models';
import { InventoryService, Patient } from '../../../services/inventory.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

// Define a window interface extension for Bootstrap
declare global {
  interface Window {
    bootstrap: {
      Modal: {
        getInstance: (element: Element) => any;
        new(element: Element, options?: any): { show: () => void; hide: () => void; };
      };
    };
  }
}

@Component({
  selector: 'app-sale-detail-dialog',
  templateUrl: './sale-detail-dialog.component.html',
  styleUrls: ['./sale-detail-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class SaleDetailDialogComponent implements OnInit, AfterViewInit {
  @Input() sale: Sale | null = null;
  @Input() printMode = false;
  
  isModalVisible: boolean = false;
  private modalInstance: any = null;
  private modalElement: HTMLElement | null = null;

  private patientDetails: Patient | null = null;
  doctorDetails: any = null;

  constructor(
    private elementRef: ElementRef,
    private inventoryService: InventoryService,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    // Initialize any component data here
    if (this.sale && this.sale.items && Array.isArray(this.sale.items)) {
      this.loadMedicineDetailsForItems(this.sale.items);
    }
  }
  
  ngAfterViewInit(): void {
    // Get modal element reference
    this.modalElement = document.getElementById('saleDetailModal');
  }

  // Show the sale details modal
  show(sale: Sale): void {
    this.sale = sale;
    this.isModalVisible = true;
    console.log('Showing sale details:', sale);
    
    // Fetch patient details if this is a prescription sale with a patient ID
    if (sale && sale.saleType === 'PRESCRIPTION' && sale.patientId && 
        (!sale.walkInCustomerName || !sale.walkInCustomerMobile)) {
      this.fetchPatientDetails(sale.patientId);
    }
    
    // Fetch doctor details if doctor ID is available
    if (sale && sale.doctorId) {
      this.fetchDoctorDetails(sale.doctorId);
    }
    
    // Fetch medicine details for each sale item
    if (sale && sale.items && Array.isArray(sale.items)) {
      this.loadMedicineDetailsForItems(sale.items);
    }
    
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      // Re-query the DOM to ensure element is available
      const modalEl = document.getElementById('saleDetailModal');
      
      if (modalEl && typeof window !== 'undefined' && window.bootstrap) {
        try {
          // Create new instance every time to avoid stale references
          this.modalInstance = new window.bootstrap.Modal(modalEl, {
            backdrop: 'static',
            keyboard: false
          });
          this.modalInstance.show();
        } catch (err) {
          console.error('Error showing modal:', err);
        }
      } else {
        console.error('Modal element not found or Bootstrap not available');
      }
    }, 100);
  }

  // Hide the sale details modal
  hide(): void {
    this.isModalVisible = false;
    
    if (this.modalInstance) {
      this.modalInstance.hide();
    } else if (this.modalElement && typeof window !== 'undefined' && window.bootstrap) {
      // Try to get instance if we don't have it stored
      const bsModal = window.bootstrap.Modal.getInstance(this.modalElement);
      if (bsModal) {
        bsModal.hide();
      }
    }
  }

  // Print the sale details
  print(): void {
    // Check if we have a sale to print
    if (!this.sale) {
      console.error('No sale data to print');
      return;
    }
    
    this.printMode = true;
    
    // Wait for view to update
    setTimeout(() => {
      window.print();
      
      // Reset print mode after printing
      setTimeout(() => {
        this.printMode = false;
      }, 1000);
    }, 300);
  }

  // Format date values for display
  formatDate(dateValue: any): string {
    if (!dateValue) return 'N/A';
    
    try {
      if (typeof dateValue === 'object' && dateValue !== null && 'seconds' in dateValue) {
        // Handle Firebase timestamp
        return new Date(dateValue.seconds * 1000).toLocaleDateString();
      } else if (dateValue instanceof Date) {
        // Handle Date object
        return dateValue.toLocaleDateString();
      } else if (typeof dateValue === 'string') {
        // Handle date strings
        if (dateValue.includes('T')) {
          // ISO format
          return dateValue.split('T')[0];
        } else {
          return dateValue;
        }
      } else {
        // Fallback
        return String(dateValue);
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return String(dateValue || 'N/A');
    }
  }

  // Get batch number from batchAllocations array
  getBatchNumber(item: any): string {
    if (!item || !item.batchAllocations || !Array.isArray(item.batchAllocations) || item.batchAllocations.length === 0) {
      return 'N/A';
    }
    
    // Get the first batch allocation's batch number
    const firstBatch = item.batchAllocations[0];
    return firstBatch.batchNo || 'N/A';
  }

  // Get expiry date from batchAllocations array
  getExpiryDate(item: any): string {
    if (!item || !item.batchAllocations || !Array.isArray(item.batchAllocations) || item.batchAllocations.length === 0) {
      return 'N/A';
    }
    
    // Get the first batch allocation's expiry date
    const firstBatch = item.batchAllocations[0];
    if (!firstBatch.expiryDate) {
      return 'N/A';
    }
    
    return this.formatDate(firstBatch.expiryDate);
  }

  // Get all batch information for display (in case multiple batches)
  getBatchInfo(item: any): string {
    if (!item || !item.batchAllocations || !Array.isArray(item.batchAllocations) || item.batchAllocations.length === 0) {
      return 'N/A';
    }
    
    // If single batch, return batch number
    if (item.batchAllocations.length === 1) {
      return item.batchAllocations[0].batchNo || 'N/A';
    }
    
    // If multiple batches, return comma-separated list
    return item.batchAllocations
      .map((batch: any) => `${batch.batchNo || 'N/A'} (${batch.quantityTaken || 0})`)
      .join(', ');
  }

  // Format sale ID for display
  /**
   * Fetch patient details from the API
   * @param patientId The patient ID to fetch details for
   */
  private fetchPatientDetails(patientId: string): void {
    this.inventoryService.getAllPatients().subscribe({
      next: (patients: Patient[]) => {
        const patient = patients.find(p => p.id === patientId);
        if (patient && this.sale) {
          console.log('Patient details fetched:', patient);
          
          // Set patient details
          this.patientDetails = patient;
          
          // Update sale object with patient name and phone if not already set
          if (!this.sale.walkInCustomerName) {
            this.sale.walkInCustomerName = patient.name;
          }
          if (!this.sale.walkInCustomerMobile) {
            this.sale.walkInCustomerMobile = patient.phoneNumber;
          }
        }
      },
      error: (err: any) => {
        console.error('Error fetching patient details:', err);
      }
    });
  }
  
  /**
   * Load medicine details for all sale items
   * @param items Array of sale items
   */
  private loadMedicineDetailsForItems(items: any[]): void {
    console.log('Loading medicine details for items:', items);
    
    // Process each item to load medicine details
    items.forEach((item, index) => {
      if (item.medicineId && !item.medicine) {
        this.inventoryService.getMedicineById(item.medicineId).subscribe({
          next: (medicine) => {
            console.log(`Medicine details for item ${index}:`, medicine);
            
            // Add medicine details to the item
            if (this.sale && this.sale.items && this.sale.items[index]) {
              // Create a custom type for medicine with extended properties
              const extendedMedicine = medicine as any;
              
              // Add the medicine object to the item
              this.sale.items[index].medicine = extendedMedicine;
              
              // Extend the item with additional properties if needed
              const extendedItem = this.sale.items[index] as any;
              
              // Handle expiry date if available from medicine batches
              if (extendedMedicine.batches && Array.isArray(extendedMedicine.batches) && 
                  extendedMedicine.batches.length > 0) {
                const batch = extendedMedicine.batches.find((b: any) => 
                  b.batchNumber === item.batchNo
                ) || extendedMedicine.batches[0];
                
                if (batch && batch.expiryDate) {
                  extendedItem.expiryDate = batch.expiryDate;
                }
              }
            }
          },
          error: (err) => {
            console.error(`Error loading medicine details for item ${index}:`, err);
          }
        });
      }
    });
  }
  
  /**
   * Fetch doctor details from the API
   * @param doctorId The doctor ID to fetch details for
   */
  private fetchDoctorDetails(doctorId: string): void {
    console.log('Fetching doctor details for ID:', doctorId);
    console.log('Environment API URL:', environment.apiUrl);
    
    const url = `${environment.opdApiUrl}/api/doctors`;
    console.log('Doctor API endpoint URL:', url);
    
    this.http.get<any>(url).subscribe({
      next: (response: any) => {
        console.log('Doctor API raw response:', response);
        
        if (response && response.success && response.data && Array.isArray(response.data)) {
          console.log('Doctors found in API:', response.data.length);
          
          // Find the doctor with matching ID
          const doctor = response.data.find((doc: any) => doc.id === doctorId);
          
          if (doctor) {
            console.log('✅ Doctor details found:', doctor);
            console.log('Doctor name:', doctor.name);
            this.doctorDetails = doctor;
            
            // Force change detection
            setTimeout(() => {
              console.log('Current doctor details after timeout:', this.doctorDetails);
            }, 100);
          } else {
            console.warn(`❌ Doctor with ID ${doctorId} not found in the response`);
            console.log('Available doctor IDs:', response.data.map((d: any) => d.id));
          }
        } else {
          console.error('Invalid doctor API response structure:', response);
        }
      },
      error: (err: any) => {
        console.error('Error fetching doctor details:', err);
      }
    });
  }
  
  // Get doctor name from either doctorDetails (API lookup) or direct doctorName field
  getDoctorName(): string {
    if (!this.sale) return 'N/A';
    
    // First priority: Doctor details loaded from API (for prescription sales)
    if (this.doctorDetails && this.doctorDetails.name) {
      return 'Dr. ' + this.doctorDetails.name;
    }
    
    // Second priority: Direct doctor name from sale object (for OTC sales)
    if (this.sale.doctorName) {
      return this.sale.doctorName.startsWith('Dr.') ? this.sale.doctorName : 'Dr. ' + this.sale.doctorName;
    }
    
    // Fallback: No doctor information available
    return 'N/A';
  }
  
  // Get patient name from either walkInCustomerName or patient details
  getPatientName(): string {
    if (!this.sale) return 'N/A';
    
    if (this.sale.walkInCustomerName) {
      return this.sale.walkInCustomerName;
    }
    
    if (this.patientDetails) {
      return this.patientDetails.name;
    }
    
    return this.sale.patientId || 'N/A';
  }
  
  // Get patient phone from either walkInCustomerMobile or patient details
  getPatientPhone(): string {
    if (!this.sale) return 'N/A';
    
    if (this.sale.walkInCustomerMobile) {
      return this.sale.walkInCustomerMobile;
    }
    
    if (this.patientDetails) {
      return this.patientDetails.phoneNumber;
    }
    
    return 'N/A';
  }
  
  formatSaleId(saleId: string | undefined): string {
    if (!saleId) return 'N/A';
    
    // Check if it's a sale_UUID format
    if (saleId.startsWith('sale_')) {
      // Format with hyphens for readability
      // example: sale_123456789 -> SALE-1234-5678
      const firstSegment = saleId.substring(5, 9).toUpperCase();
      const secondSegment = saleId.substring(9, 13).toUpperCase();
      return `SALE-${firstSegment}-${secondSegment}`;
    }
    
    // Extract numeric part if available
    const numericMatch = saleId.match(/\d+/);
    if (numericMatch) {
      const numericPart = numericMatch[0];
      if (numericPart.length > 4) {
        return `INV-${numericPart}`;
      }
    }
    
    // Default formatting
    return saleId.toUpperCase();
  }
}
