import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { Supplier } from '../../models/inventory.models';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './suppliers.component.html',
  styleUrls: ['./suppliers.component.scss']
})
export class SuppliersComponent implements OnInit {
  suppliers: Supplier[] = [];
  filteredSuppliers: Supplier[] = [];
  searchTerm: string = '';
  loading: boolean = true;
  showForm: boolean = false;
  editMode: boolean = false;
  currentSupplierId: string = '';
  submitting: boolean = false;
  
  supplierForm: FormGroup;

  constructor(
    private inventoryService: InventoryService,
    private fb: FormBuilder
  ) { 
    this.supplierForm = this.fb.group({
      name: ['', Validators.required],
      contactNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      contactPerson: [''],
      email: ['', Validators.email],
      address: [''],
      gstNumber: [''],
      drugLicense: ['']
    });
  }

  ngOnInit(): void {
    this.loadSuppliers();
  }

  loadSuppliers(): void {
    this.loading = true;
    this.inventoryService.getSuppliers().subscribe({
      next: (data) => {
        this.suppliers = data;
        this.filteredSuppliers = [...data];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading suppliers', err);
        this.loading = false;
        this.loadSampleData();
      }
    });
  }

  search(): void {
    if (!this.searchTerm.trim()) {
      this.filteredSuppliers = [...this.suppliers];
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredSuppliers = this.suppliers.filter(supplier => {
      return (
        supplier.name.toLowerCase().includes(term) || 
        supplier.id.toLowerCase().includes(term) ||
        (supplier.contactNumber && supplier.contactNumber.toLowerCase().includes(term)) ||
        (supplier.email && supplier.email.toLowerCase().includes(term))
      );
    });
  }

  openAddForm(): void {
    this.editMode = false;
    this.currentSupplierId = '';
    this.supplierForm.reset();
    this.showForm = true;
  }

  openEditForm(supplier: Supplier): void {
    this.editMode = true;
    this.currentSupplierId = supplier.id;
    
    // Patch the form with supplier data
    this.supplierForm.patchValue({
      name: supplier.name,
      contactNumber: supplier.contactNumber,
      contactPerson: supplier.contactPerson || '',
      email: supplier.email || '',
      address: supplier.address || '',
      gstNumber: supplier.gstNumber || '',
      drugLicense: supplier.drugLicense || ''
    });
    
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.supplierForm.reset();
  }

  onSubmit(): void {
    if (this.supplierForm.invalid) {
      // Mark form controls as touched to show validation errors
      Object.keys(this.supplierForm.controls).forEach(key => {
        const control = this.supplierForm.get(key);
        control?.markAsTouched();
      });
      return;
    }
    
    this.submitting = true;
    const formData = this.supplierForm.value;
    
    if (this.editMode) {
      // Update existing supplier
      this.inventoryService.updateSupplier(this.currentSupplierId, formData).subscribe({
        next: (updatedSupplier) => {
          console.log('Supplier updated successfully', updatedSupplier);
          this.submitting = false;
          this.showForm = false;
          
          // Update the supplier in the local array
          const index = this.suppliers.findIndex(s => s.id === this.currentSupplierId);
          if (index !== -1) {
            this.suppliers[index] = { ...updatedSupplier, id: this.currentSupplierId };
            this.filteredSuppliers = [...this.suppliers];
          }
        },
        error: (error) => {
          console.error('Error updating supplier', error);
          this.submitting = false;
          alert('Error updating supplier');
        }
      });
    } else {
      // Create new supplier
      this.inventoryService.createSupplier(formData).subscribe({
        next: (newSupplier) => {
          console.log('Supplier created successfully', newSupplier);
          this.submitting = false;
          this.showForm = false;
          
          // Add the new supplier to the local array
          this.suppliers.push(newSupplier);
          this.filteredSuppliers = [...this.suppliers];
        },
        error: (error) => {
          console.error('Error creating supplier', error);
          this.submitting = false;
          alert('Error creating supplier');
        }
      });
    }
  }

  deleteSupplier(id: string): void {
    if (!confirm('Are you sure you want to delete this supplier?')) {
      return;
    }
    
    this.inventoryService.deleteSupplier(id).subscribe({
      next: () => {
        console.log('Supplier deleted successfully');
        
        // Remove the supplier from the local array
        this.suppliers = this.suppliers.filter(s => s.id !== id);
        this.filteredSuppliers = [...this.suppliers];
      },
      error: (error) => {
        console.error('Error deleting supplier', error);
        alert('Error deleting supplier');
      }
    });
  }

  // Sample data for development/testing
  /**
   * Format supplier ID to make it shorter and more readable
   * Example: 'sup_1564cf0f-1440-4bf4-8acf-0751aad9372b' -> 'S-1564'
   */
  formatSupplierId(id: string | undefined): string {
    if (!id) return 'N/A';
    
    // If it's a long UUID-style ID
    if (id.includes('_')) {
      // Split by underscore and get the second part (the UUID)
      const parts = id.split('_');
      if (parts.length > 1) {
        // Take just the first 4 characters of the UUID
        return `S-${parts[1].substring(0, 4)}`;
      }
    }
    
    // For numeric IDs or other formats, just return as is or with prefix
    return id.length > 8 ? `S-${id.substring(0, 4)}` : id;
  }

  private loadSampleData(): void {
    this.suppliers = [
      {
        id: 'SP-2025057',
        name: 'ALPHA AGENCIES',
        contactNumber: '7550020555',
        contactPerson: 'Rahul Shah',
        email: 'info@alphaagencies.com',
        address: '123 Medical Lane, Chennai',
        gstNumber: 'GST9876543210',
        drugLicense: 'DL78945612'
      },
      {
        id: 'SP-2025055',
        name: 'AJAX PHARMACEUTICALS',
        contactNumber: '4282592522',
        contactPerson: 'Priya Sharma',
        email: 'sales@ajaxpharma.com',
        address: '456 Pharma Street, Hyderabad',
        gstNumber: 'GST1234567890',
        drugLicense: 'DL45678912'
      },
      {
        id: 'SP-2025056',
        name: 'UBK DISTRIBUTORS',
        contactNumber: '7358412905',
        contactPerson: 'Vinod Kumar',
        email: 'contact@ubk.com',
        address: '789 Distribution Center, Bangalore',
        gstNumber: 'GST5678901234',
        drugLicense: 'DL12345678'
      }
    ];
    
    this.filteredSuppliers = [...this.suppliers];
  }
}
