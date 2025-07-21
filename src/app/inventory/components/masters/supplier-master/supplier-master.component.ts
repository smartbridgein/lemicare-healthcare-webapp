import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InventoryService } from '../../../services/inventory.service';
import { Supplier, Purchase } from '../../../models/inventory.models';

@Component({
  selector: 'app-supplier-master',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './supplier-master.component.html',
  styleUrls: ['./supplier-master.component.scss']
})
export class SupplierMasterComponent implements OnInit {
  suppliers: Supplier[] = [];
  filteredSuppliers: Supplier[] = [];
  supplierForm: FormGroup;
  loading = false;
  showModal = false;
  isEditMode = false;
  currentSupplierId: string | null = null;
  searchTerm = '';
  nextSupplierId = '';
  showInactiveSuppliers = true; // Default to showing all suppliers including inactive
  // Map to store formatted supplier IDs
  supplierIdMap: Map<string, string> = new Map();
  // Error message for form submission
  formError: string = '';

  // Purchase details modal properties
  showPurchaseModal = false;
  loadingPurchases = false;
  selectedSupplier: Supplier | null = null;
  supplierPurchases: Purchase[] = [];
  selectedPurchaseItems: any[] = [];

  constructor(
    private inventoryService: InventoryService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.supplierForm = this.fb.group({
      name: ['', Validators.required],
      supplierId: [{ value: '', disabled: true }],
      gstNumber: ['', Validators.required], // GST Number is now mandatory
      email: ['', [Validators.email]],
      contactNumber: ['', [Validators.pattern('^[0-9]{10,12}$')]],
      contactPerson: [''],
      drugLicenseNumber: [''], // Optional field, no longer required
      address: [''],
      status: ['ACTIVE'] // Default to ACTIVE status
    });
  }

  ngOnInit(): void {
    this.loadSuppliers();
  }

  loadSuppliers(): void {
    this.loading = true;
    this.inventoryService.getSuppliers().subscribe({
      next: (data) => {
        console.log('All suppliers loaded:', data.length);
        
        // Ensure all suppliers have a status
        const processedSuppliers = data.map(supplier => ({
          ...supplier,
          status: supplier.status || 'ACTIVE' // Set default status to ACTIVE if not specified
        }));
        
        // Store all suppliers and show all by default (both active and inactive)
        this.suppliers = processedSuppliers;
        
        // Show all suppliers (both active and inactive)
        this.filteredSuppliers = [...this.suppliers];
        
        // Log supplier status breakdown
        console.log('Active suppliers:', this.suppliers.filter(s => s.status === 'ACTIVE').length);
        console.log('Inactive suppliers:', this.suppliers.filter(s => s.status === 'INACTIVE').length);
        console.log('No status suppliers:', this.suppliers.filter(s => !s.status).length);
        this.loading = false;
        
        // IDs are formatted on-demand via getFormattedSupplierId method
        
        console.log('Processed suppliers:', this.suppliers.length);
        console.log('Active suppliers:', this.filteredSuppliers.length);
        this.generateNextSupplierId();
      },
      error: (error) => {
        console.error('Error loading suppliers:', error);
        this.loading = false;
        // Load sample data in case of error
        this.loadSampleData();
        this.generateNextSupplierId();
      }
    });
  }

  generateNextSupplierId(): void {
    // Generate a supplier ID in the format SP-YYYYMMDD## where ## is a sequential number
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    // Find the highest existing ID with the same date prefix
    let maxNum = 0;
    const prefix = `SP-${dateStr}`;
    
    this.suppliers.forEach(supplier => {
      if (supplier.id && supplier.id.startsWith(prefix)) {
        const numStr = supplier.id.substring(prefix.length);
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    
    // Generate the next ID
    this.nextSupplierId = `${prefix}${String(maxNum + 1).padStart(2, '0')}`;
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.currentSupplierId = null;
    this.supplierForm.reset();
    this.formError = ''; // Clear any previous error message
    this.supplierForm.patchValue({
      supplierId: this.nextSupplierId,
      status: 'ACTIVE' // Default to ACTIVE for new suppliers
    });
    this.showModal = true;
  }

  openEditModal(supplier: Supplier): void {
    this.isEditMode = true;
    this.currentSupplierId = supplier.id;
    this.formError = ''; // Clear any previous error message
    
    // Log the incoming supplier object for debugging
    console.log('Editing supplier object:', JSON.stringify(supplier));
    
    // Populate the form with supplier data
    this.supplierForm.patchValue({
      name: supplier.name || '',
      supplierId: supplier.id || '',
      gstNumber: supplier.gstNumber || supplier.gstin || '',
      email: supplier.email || '',
      contactNumber: supplier.contactNumber || supplier.mobileNumber || '',
      contactPerson: supplier.contactPerson || '', // Ensure contact person is patched
      drugLicenseNumber: supplier.drugLicense || supplier.drugLicenseNumber || '',
      address: supplier.address || '',
      status: supplier.status || 'ACTIVE' // Default to ACTIVE if not specified
    });
    
    // Manually set contactPerson as a backup to ensure it gets set
    if (supplier.contactPerson) {
      this.supplierForm.get('contactPerson')?.setValue(supplier.contactPerson);
    }
    
    console.log('Form values after patch:', this.supplierForm.value);
    console.log('Contact person value:', this.supplierForm.get('contactPerson')?.value);
    
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }
  
  // Get count of active suppliers
  getActiveSupplierCount(): number {
    return this.suppliers.filter(supplier => supplier.status === 'ACTIVE').length;
  }
  
  // Get count of inactive suppliers
  getInactiveSupplierCount(): number {
    return this.suppliers.filter(supplier => supplier.status === 'INACTIVE').length;
  }

  toggleInactiveFilter(): void {
    // Toggle the filter state
    this.showInactiveSuppliers = !this.showInactiveSuppliers;
    
    // Update the filtered suppliers based on the filter state
    if (this.showInactiveSuppliers) {
      this.filteredSuppliers = [...this.suppliers];
    } else {
      this.filteredSuppliers = this.suppliers.filter(supplier => supplier.status === 'ACTIVE');
    }
    
    // If search term is active, apply search filter on top of the status filter
    if (this.searchTerm.trim()) {
      this.searchSuppliers();
    }
    
    console.log(`Filter changed: ${this.showInactiveSuppliers ? 'Showing all suppliers' : 'Showing only active suppliers'}`);
    console.log(`Suppliers shown: ${this.filteredSuppliers.length}`);
  }
  
  searchSuppliers(): void {
    // Start with either all suppliers or just active ones depending on filter setting
    let baseSuppliers = this.showInactiveSuppliers ? [...this.suppliers] : this.suppliers.filter(s => s.status === 'ACTIVE');
    
    if (!this.searchTerm.trim()) {
      this.filteredSuppliers = baseSuppliers;
      return;
    }
    
    const term = this.searchTerm.toLowerCase().trim();
    this.filteredSuppliers = this.suppliers.filter(
      supplier => supplier.name.toLowerCase().includes(term) || 
                 (supplier.contactNumber && supplier.contactNumber.includes(term)) ||
                 (supplier.mobileNumber && supplier.mobileNumber.includes(term)) ||
                 (supplier.email && supplier.email.toLowerCase().includes(term)) ||
                 (supplier.gstin && supplier.gstin.toLowerCase().includes(term)) ||
                 (supplier.gstNumber && supplier.gstNumber.toLowerCase().includes(term))
    );
  }

  // Check if supplier name already exists
  checkDuplicateSupplierName(name: string, excludeSupplierId?: string): boolean {
    if (!name) return false;
    
    // Case-insensitive comparison
    const normalizedName = name.toLowerCase().trim();
    
    return this.suppliers.some(supplier => 
      // Skip the current supplier being edited
      supplier.id !== excludeSupplierId && 
      // Case-insensitive comparison
      supplier.name.toLowerCase().trim() === normalizedName
    );
  }

  /**
   * Custom form validation to only check required fields
   * @returns boolean indicating if the required fields are valid
   */
  isFormValid(): boolean {
    // Check required fields: name and gstNumber (drugLicenseNumber is optional)
    const name = this.supplierForm.get('name');
    const gstNumber = this.supplierForm.get('gstNumber');
    
    // Email validation if provided
    const email = this.supplierForm.get('email');
    const isEmailValid = !email?.value || (email?.valid || !email?.touched);
    
    // Contact number validation if provided
    const contactNumber = this.supplierForm.get('contactNumber');
    const isContactValid = !contactNumber?.value || (contactNumber?.valid || !contactNumber?.touched);
    
    // Both name and gstNumber are required, along with valid email/contact if provided
    return !!name?.value && !!gstNumber?.value && isEmailValid && isContactValid;
  }

  submitForm(): void {
    // Reset error message
    this.formError = '';
    
    if (this.supplierForm.invalid) {
      Object.keys(this.supplierForm.controls).forEach(key => {
        const control = this.supplierForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    const supplierName = this.supplierForm.value.name;
    
    // Check for duplicate name in frontend first
    if (this.checkDuplicateSupplierName(supplierName, this.currentSupplierId || undefined)) {
      this.formError = `A supplier with the name '${supplierName}' already exists.`;
      return;
    }

    // Extract form values directly using getRawValue to include disabled controls
    const formValues = this.supplierForm.getRawValue();
    
    // Log form values before creating API payload
    console.log('Form values before API submission:', formValues);
    
    // Map form fields to match the API contract
    const supplierData = {
      name: supplierName,
      gstNumber: formValues.gstNumber,
      gstin: formValues.gstNumber, // Also include as gstin for API compatibility
      email: formValues.email,
      contactNumber: formValues.contactNumber,
      mobileNumber: formValues.contactNumber, // Also include as mobileNumber for API compatibility
      contactPerson: formValues.contactPerson, // Explicitly include contact person
      drugLicenseNumber: formValues.drugLicenseNumber,
      address: formValues.address,
      status: formValues.status || 'ACTIVE' // Explicitly include status with default fallback
    };
    
    // Log the API payload for debugging
    console.log('API submission payload:', supplierData);
    
    console.log('Saving supplier with status:', this.supplierForm.value.status);

    if (this.isEditMode && this.currentSupplierId) {
      this.inventoryService.updateSupplier(this.currentSupplierId, supplierData).subscribe({
        next: (response) => {
          this.loadSuppliers();
          this.closeModal();
        },
        error: (error) => {
          console.error('Error updating supplier:', error);
          if (error.status === 409) {
            // Display error message for duplicate name conflict
            this.formError = error.error || `A supplier with the name '${supplierName}' already exists.`;
          } else {
            this.formError = 'Failed to update supplier. Please try again.';
          }
        }
      });
    } else {
      this.inventoryService.createSupplier(supplierData).subscribe({
        next: (response) => {
          this.loadSuppliers();
          this.closeModal();
        },
        error: (error) => {
          console.error('Error creating supplier:', error);
          if (error.status === 409) {
            // Display error message for duplicate name conflict
            this.formError = error.error || `A supplier with the name '${supplierName}' already exists.`;
          } else {
            this.formError = 'Failed to create supplier. Please try again.';
          }
        }
      });
    }
  }

  toggleSupplierStatus(supplier: Supplier): void {
    // Explicitly type the newStatus variable as 'ACTIVE' | 'INACTIVE' to match expected type
    const newStatus: 'ACTIVE' | 'INACTIVE' = supplier.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const action = supplier.status === 'ACTIVE' ? 'deactivate' : 'activate';
    
    if (confirm(`Are you sure you want to ${action} ${supplier.name}? ${newStatus === 'INACTIVE' ? 'This will hide it from all purchase forms.' : ''}`)) {
      // Create a properly typed update request object with all fields for the API
      const updateData: {
        name: string;
        gstNumber: string;
        gstin: string; // For API compatibility
        contactNumber?: string;
        mobileNumber?: string; // For API compatibility
        email?: string;
        contactPerson?: string;
        drugLicenseNumber?: string;
        address?: string;
        status: 'ACTIVE' | 'INACTIVE'; // Make status required, not optional
      } = {
        // Required fields
        name: supplier.name,
        gstNumber: supplier.gstNumber || supplier.gstin || '',  // Ensure non-undefined value
        gstin: supplier.gstNumber || supplier.gstin || '', // Also include as gstin for API compatibility
        // Field we want to update with proper type
        status: newStatus, // Explicitly set the new status
        // Include other existing fields that might be needed
        contactNumber: supplier.contactNumber || supplier.mobileNumber || '',
        mobileNumber: supplier.contactNumber || supplier.mobileNumber || '', // Also include as mobileNumber
        email: supplier.email || '',
        contactPerson: supplier.contactPerson || '', // Ensure contact person is included
        drugLicenseNumber: supplier.drugLicenseNumber || supplier.drugLicense || '',
        address: supplier.address || ''
      };
      
      // Log the toggle status update payload
      console.log(`Updating supplier status to ${newStatus}:`, updateData);
      
      // Use updateSupplier API with the properly typed update data for both directions
      this.inventoryService.updateSupplier(supplier.id, updateData).subscribe({
        next: () => {
          console.log(`Supplier ${action}d successfully`);
          this.loadSuppliers();
        },
        error: (error) => {
          console.error(`Error ${action}ing supplier:`, error);
        }
      });
    }
  }

  addLoshithSupplier(): void {
    const supplierData = {
      name: "LOshith Pharma Distributors33",
      contactPerson: "mani Loshith",
      email: "sales1@globalpharma.com",
      phone: "98401750184",  // Using phone field directly as per API requirements
      address: "chennai",
      gstin: "GST12345",      // Using gstin field directly as per API requirements
      drugLicenseNumber: "DL-123456789TN"  // Added required drug license number
    };

    console.log('Creating new supplier with data:', supplierData);
    this.loading = true;
    
    // Call the service to create the supplier
    this.inventoryService.createSupplier(supplierData).subscribe({
      next: (response) => {
        console.log('Supplier created successfully:', response);
        this.loadSuppliers(); // Reload the suppliers list
        this.loading = false;
        // Show a success message
        alert('Supplier "LOshith Pharma Distributors33" created successfully!');
      },
      error: (err) => {
        console.error('Error creating supplier:', err);
        this.loading = false;
        // Show an error message
        alert('Error creating supplier: ' + (err.error?.message || err.message || 'Unknown error'));
      }
    });
  }

  /**
   * Format supplier ID for display to match purchase invoice format
   * @param id The raw supplier ID from the database
   * @returns Formatted supplier ID for display
   */
  getFormattedSupplierId(id: string | undefined): string {
    if (!id) return 'N/A';
    
    // Check if we already formatted this ID
    if (this.supplierIdMap.has(id)) {
      return this.supplierIdMap.get(id) || 'N/A';
    }
    
    // Extract the UUID part after 'sup_'
    const supplierIdMatch = id.match(/sup_([a-f0-9-]+)/i);
    if (supplierIdMatch && supplierIdMatch[1]) {
      const uuidPart = supplierIdMatch[1].substring(0, 8).toUpperCase();
      const formattedId = `SUP-${uuidPart.substring(0, 4)}-${uuidPart.substring(4, 8)}`;
      this.supplierIdMap.set(id, formattedId);
      return formattedId;
    }
    
    // Fallback to the original ID if pattern doesn't match
    return id;
  }
  
  /**
   * Format purchase ID for display
   * @param id The purchase ID to format
   * @returns Formatted purchase ID
   */
  formatPurchaseId(id: string): string {
    if (!id) return 'N/A';
    return this.inventoryService.formatPurchaseId(id);
  }
  
  /**
   * View purchase details for a supplier
   * @param supplier The supplier to view purchase details for
   */
  viewPurchaseDetails(supplier: Supplier): void {
    this.selectedSupplier = supplier;
    this.showPurchaseModal = true;
    this.loadingPurchases = true;
    this.supplierPurchases = [];
    this.selectedPurchaseItems = [];
    
    // Load purchases for this supplier
    this.inventoryService.getPurchases(true, true).subscribe({
      next: (purchases) => {
        // Filter purchases for this supplier
        this.supplierPurchases = purchases.filter(p => p.supplierId === supplier.id);
        
        // Sort by invoice date descending (newest first)
        this.supplierPurchases.sort((a, b) => {
          const dateA = new Date(a.invoiceDate).getTime();
          const dateB = new Date(b.invoiceDate).getTime();
          return dateB - dateA;
        });
        
        this.loadingPurchases = false;
      },
      error: (err) => {
        console.error('Error loading purchases:', err);
        this.loadingPurchases = false;
      }
    });
  }
  
  /**
   * Close the purchase details modal
   */
  closePurchaseModal(): void {
    this.showPurchaseModal = false;
    this.selectedSupplier = null;
    this.supplierPurchases = [];
    this.selectedPurchaseItems = [];
  }
  
  /**
   * Navigate to the supplier overview page
   * @param supplier The supplier to view
   */
  viewSupplierOverview(supplier: Supplier): void {
    if (supplier && supplier.id) {
      this.router.navigate(['/inventory/masters/supplier/overview', supplier.id]);
    }
  }

  /**
   * View purchase items detail
   * @param purchase The purchase to view details for
   */
  viewPurchaseItems(purchase: Purchase): void {
    if (purchase && purchase.purchaseItems) {
      this.selectedPurchaseItems = purchase.purchaseItems.map(item => ({
        ...item,
        medicineName: this.getMedicineName(item.medicineId)
      }));
    }
  }
  
  /**
   * Calculate total amount of selected purchase items
   * @returns Total amount of all selected purchase items
   */
  getTotalAmount(): number {
    if (!this.selectedPurchaseItems || this.selectedPurchaseItems.length === 0) {
      return 0;
    }
    
    return this.selectedPurchaseItems.reduce(
      (total, item) => total + (item.quantity * item.unitPrice),
      0
    );
  }
  
  /**
   * Get medicine name by ID
   * @param medicineId The medicine ID to look up
   * @returns The medicine name or a placeholder
   */
  private getMedicineName(medicineId: string): string {
    // In a real implementation, this would look up the medicine name from a cached list
    // For now, just return a placeholder
    return medicineId ? `Medicine ${medicineId.substring(0, 4)}...` : 'Unknown';
  }
  
  /**
   * Load sample supplier data for testing
   */
  loadSampleData(): void {
    this.suppliers = [
      {
        id: 'SP-20240101001',
        name: 'Dr Hanan Old stock',
        contactNumber: '8888888888',
        gstNumber: '',
        balance: -411347.46,
        status: 'ACTIVE'
      },
      {
        id: 'SP-20240112',
        name: 'S PHARMACEUTICALS',
        contactNumber: '9710787787',
        gstNumber: '33DHEPSR105N1ZY',
        balance: -39213.21,
        status: 'ACTIVE'
      },
      {
        id: 'SP-20250543',
        name: 'ZARA ENTERPRISES',
        contactNumber: '8056112673',
        gstNumber: '33DYPM0019BZZ',
        balance: -685038.7,
        status: 'ACTIVE'
      },
      {
        id: 'SP-20250654',
        name: 'MUTHU PHARMA',
        contactNumber: '8939991980',
        gstNumber: '33AAPL9022F1Z5',
        balance: -152770,
        status: 'ACTIVE'
      },
      {
        id: 'SP-20250655',
        name: 'AJAY PHARMACEUTICALS',
        contactNumber: '4282592522',
        gstNumber: '33AFPA0992F1ZU',
        balance: -1076614.93,
        status: 'INACTIVE'
      }
    ];
    this.filteredSuppliers = [...this.suppliers];
  }
}
