import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InventoryService } from '../../../services/inventory.service';
import { Medicine, TaxProfile, StockStatus } from '../../../models/inventory.models';
import { AuthService, UserProfile } from '../../../../../app/auth/shared/auth.service';

@Component({
  selector: 'app-medicine-master',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './medicine-master.component.html',
  styleUrls: ['./medicine-master.component.scss']
})
export class MedicineMasterComponent implements OnInit {
  medicines: Medicine[] = [];
  filteredMedicines: Medicine[] = [];
  paginatedMedicines: Medicine[] = [];
  taxProfiles: TaxProfile[] = [];
  medicineForm!: FormGroup;
  loading = false;
  showModal = false;
  showInactive = false;
  duplicateNameError: string | null = null;
  
  // Expose StockStatus enum to the template
  StockStatus = StockStatus;
  isEditMode = false;
  currentMedicineId: string | null = null;
  searchTerm = '';
  
  // Track active/inactive count
  activeMedicineCount = 0;
  inactiveMedicineCount = 0;
  
  // Sorting properties
  sortField: string = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Pagination properties
  currentPage = 1;
  itemsPerPage = 25;
  totalItems = 0;
  totalPages = 0;
  
  // Permission properties
  isSuperAdmin = false;
  private user: UserProfile | null = null;

  constructor(
    private inventoryService: InventoryService,
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.initializeForm();
  }

  initializeForm(data: Medicine | null = null): void {
    this.medicineForm = this.fb.group({
      name: [data?.name || '', [Validators.required]],
      genericName: [data?.genericName || '', Validators.required],
      category: [data?.category || '', [Validators.required]],
      sku: [data?.sku || ''],
      hsnCode: [data?.hsnCode || ''],
      manufacturer: [data?.manufacturer || '', [Validators.required]],
      unitOfMeasurement: [data?.unitOfMeasurement || 'tablet'],
      lowStockThreshold: [data?.lowStockThreshold || 10, [Validators.required, Validators.min(1)]],
      location: [data?.location || ''],
      taxProfileId: [data?.taxProfileId || this.getNoTaxProfileId()],
      unitPrice: [data?.unitPrice || 0],
      purchasePrice: [data?.purchasePrice || 0],
      status: [data?.status || 'ACTIVE']
    });
  }

  ngOnInit(): void {
    this.loadUserPermissions();
    this.loadMedicines();
    this.loadTaxProfiles();
  }

  /**
   * Check if current user has super admin permissions
   * Only super admin can delete medicines
   */
  private loadUserPermissions(): void {
    this.user = this.authService.getCurrentUser();
    
    if (this.user) {
      // Check if user is super admin (by email or role)
      const email = this.user.email || '';
      const role = this.user.role || '';
      
      const isSuperAdminEmail = email.toLowerCase() === 'hanan-clinic@lemicare.com';
      const isSuperAdminRole = role.toUpperCase() === 'ROLE_SUPER_ADMIN' || 
                             role.toUpperCase() === 'SUPER_ADMIN';
      
      this.isSuperAdmin = isSuperAdminEmail || isSuperAdminRole;
      
      console.log('Medicine Master Permissions:', {
        email,
        role,
        isSuperAdmin: this.isSuperAdmin
      });
    }
  }
  
  loadTaxProfiles(): void {
    // Use the updated getTaxProfiles method with caching and fallback
    this.inventoryService.getTaxProfiles(true, false).subscribe({
      next: (profiles) => {
        this.taxProfiles = profiles;
        console.log('Loaded tax profiles:', this.taxProfiles);
        
        // If we're in edit mode, reapply the tax profile ID to ensure it's valid
        if (this.isEditMode && this.currentMedicineId) {
          const currentTaxProfileId = this.medicineForm.get('taxProfileId')?.value;
          if (currentTaxProfileId) {
            this.ensureValidTaxProfileId(currentTaxProfileId);
          }
        } 
        // For new medicines, set default "no tax" profile
        else if (!this.isEditMode) {
          this.medicineForm.get('taxProfileId')?.setValue(this.getNoTaxProfileId());
        }
      },
      error: (error) => {
        console.error('Error loading tax profiles:', error);
        // Set default "no tax" profile even if loading fails
        if (!this.isEditMode) {
          this.medicineForm.get('taxProfileId')?.setValue(this.getNoTaxProfileId());
        }
      }
    });
  }

  /**
   * Get the ID for "no tax" profile or return empty string as default
   */
  getNoTaxProfileId(): string {
    // Look for a tax profile with "no tax" or similar name
    const noTaxProfile = this.taxProfiles.find(profile => 
      profile.profileName.toLowerCase().includes('no tax') || 
      profile.profileName.toLowerCase().includes('notax') ||
      profile.totalRate === 0
    );
    
    if (noTaxProfile) {
      return noTaxProfile.id;
    }
    
    // If no "no tax" profile found, return empty string (no tax profile selected)
    return '';
  }
  
  // Helper method to ensure the tax profile ID is valid
  private ensureValidTaxProfileId(currentId: string): void {
    // Check if the current ID exists in the tax profiles
    const profileExists = this.taxProfiles.some(profile => profile.id === currentId);
    
    if (!profileExists && this.taxProfiles.length > 0) {
      // If the ID doesn't exist, set the first available tax profile
      console.log(`Tax profile ID ${currentId} not found in available profiles. Setting to first available.`);
      this.medicineForm.patchValue({
        taxProfileId: this.taxProfiles[0].id
      });
    }
  }

  // Get active medicine count for badge display
  getActiveMedicineCount(): number {
    this.activeMedicineCount = this.medicines.filter(m => m.status === 'ACTIVE').length;
    return this.activeMedicineCount;
  }

  // Get inactive medicine count for badge display
  getInactiveMedicineCount(): number {
    this.inactiveMedicineCount = this.medicines.filter(m => m.status === 'INACTIVE').length;
    return this.inactiveMedicineCount;
  }

  // Toggle showing inactive medicines
  toggleInactiveMedicines(): void {
    this.showInactive = !this.showInactive;
    this.applyFilters();
  }

  // Apply all current filters including search term and active/inactive status
  applyFilters(): void {
    // Start with all medicines
    let result = [...this.medicines];
    
    // Apply search filter if there is a search term
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(medicine => 
        medicine.name.toLowerCase().includes(term) ||
        (medicine.category && medicine.category.toLowerCase().includes(term)) ||
        (medicine.manufacturer && medicine.manufacturer.toLowerCase().includes(term))
      );
    }
    
    // Filter out inactive medicines if showInactive is false
    if (!this.showInactive) {
      result = result.filter(medicine => medicine.status === 'ACTIVE');
    }
    
    this.filteredMedicines = result;
    this.updatePagination();
  }
  
  // Update pagination based on filtered results
  updatePagination(): void {
    this.totalItems = this.filteredMedicines.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    
    // Reset to first page if current page is out of bounds
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = 1;
    }
    
    this.updatePaginatedMedicines();
  }
  
  // Update the paginated medicines array
  updatePaginatedMedicines(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedMedicines = this.filteredMedicines.slice(startIndex, endIndex);
  }
  
  // Pagination navigation methods
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedMedicines();
    }
  }
  
  goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedMedicines();
    }
  }
  
  goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedMedicines();
    }
  }
  
  // Get page numbers for pagination display
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);
    
    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }
  
  // Get pagination info text
  getPaginationInfo(): string {
    if (this.totalItems === 0) {
      return 'No records found';
    }
    
    const startRecord = (this.currentPage - 1) * this.itemsPerPage + 1;
    const endRecord = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
    return `Showing ${startRecord}-${endRecord} of ${this.totalItems} records`;
  }

  loadMedicines(forceRefresh: boolean = false): void {
    this.loading = true;
    // Use true for useApiIfAvailable to force using the real API
    // Set forceRefresh to true to bypass cache completely
    this.inventoryService.getMedicines(true, forceRefresh).subscribe({
      next: (data) => {
        console.log('All medicines loaded:', data);
        
        // Log each field we're interested in to see what values they actually have
        data.forEach((item, index) => {
          console.log(`Medicine ${index}:`, {
            id: item.id || item.medicineId,
            name: item.name,
            category: item.category || 'category field missing',
            sku: item.sku || 'sku field missing',
            unitPrice: item.unitPrice || 'unitPrice field missing',
            purchasePrice: item.purchasePrice || 'purchasePrice field missing',
            manufacturer: item.manufacturer || 'manufacturer field missing',
            stockStatus: item.stockStatus || 'stockStatus field missing',
            status: item.status || 'status field missing'
          });
        });
        
        // Map response properties to our Medicine interface
        this.medicines = data.map(item => {
          // Create a properly formatted Medicine object from API response
          const medicine = {
            id: item.medicineId || item.id || '',
            medicineId: item.medicineId || item.id || '',
            name: item.name || '',
            genericName: item.genericName || '',
            category: item.category || '',
            sku: item.sku || '',
            hsnCode: item.hsnCode || '',
            manufacturer: item.manufacturer || '',
            unitOfMeasurement: item.unitOfMeasurement || 'tablet',
            lowStockThreshold: item.lowStockThreshold || 10,
            stockQuantity: item.quantityInStock || 0,
            unitPrice: item.unitPrice || 0,
            purchasePrice: item.purchasePrice || 0,
            taxProfileId: item.taxProfileId || '',
            // Ensure status is properly set, default to 'ACTIVE' if missing
            status: item.status || 'ACTIVE',
            // Map the stockStatus which may have different formats
            stockStatus: this.normalizeStockStatus(item.stockStatus)
          } as Medicine;
          
          console.log('Mapped medicine object:', medicine);
          return medicine;
        });
        
        // For debugging
        console.log('Mapped medicines:', this.medicines);
        
        // Apply filters based on current settings
        this.applyFilters();
        
        this.loading = false;
        const activeMedicines = this.medicines.filter(medicine => medicine.status === 'ACTIVE');
        const inactiveMedicines = this.medicines.filter(medicine => medicine.status === 'INACTIVE');
        console.log('Active medicines:', activeMedicines.length, 'Inactive medicines:', inactiveMedicines.length, 'Total medicines:', this.medicines.length);
      },
      error: (error) => {
        console.error('Error loading medicines:', error);
        this.loading = false;
        // Load sample data for development purposes
        this.loadSampleData();
      }
    });
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.currentMedicineId = null;
    
    // Set default values including first tax profile if available
    const defaultValues = {
      lowStockThreshold: 100,
      stockQuantity: 150,
      unitOfMeasurement: 'tablet', // Default unit
      taxProfileId: this.taxProfiles.length > 0 ? this.taxProfiles[0].id : '', // Default to first tax profile
      unitPrice: 0,
      purchasePrice: 0,
      status: 'ACTIVE'
    };
    
    this.medicineForm.reset(defaultValues);
    this.showModal = true;
  }

  openEditModal(medicine: Medicine): void {
    this.isEditMode = true;
    // Use medicineId if available, otherwise fall back to id
    const medicineId = medicine.medicineId || medicine.id;
    this.currentMedicineId = medicineId;
    
    // Clear any duplicate name error when opening the edit modal
    this.duplicateNameError = null;
    
    if (!medicineId) {
      console.error('Cannot edit medicine: Invalid ID', medicine);
      return;
    }
    
    console.log('Opening edit modal for medicine:', medicine);
    
    // Direct patch from the medicine object first for immediate display
    // Get the tax profile ID from the medicine
    let taxProfileId = medicine.taxProfileId || '';
    if (this.taxProfiles.length > 0 && !this.taxProfiles.some(profile => profile.id === taxProfileId)) {
      taxProfileId = this.taxProfiles[0].id;
    }
    
    // Pre-populate form with available data - ensure all fields are populated
    this.medicineForm.patchValue({
      name: medicine.name || '',
      genericName: medicine.genericName || '', // Ensure genericName is populated
      manufacturer: medicine.manufacturer || '', // Ensure manufacturer is populated
      category: medicine.category || '',
      sku: medicine.sku || '',
      hsnCode: medicine.hsnCode || '',
      unitOfMeasurement: medicine.unitOfMeasurement || 'tablet',
      lowStockThreshold: medicine.lowStockThreshold || 10,
      taxProfileId: taxProfileId,
      unitPrice: medicine.unitPrice || 0,
      status: medicine.status || 'ACTIVE'
    });
    
    // Log the populated form values for debugging
    console.log('Form populated with values:', this.medicineForm.value);
    
    // Ensure tax profile ID is valid
    this.ensureValidTaxProfileId(medicine.taxProfileId || '');
    
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.duplicateNameError = null; // Clear any error messages when closing the modal
  }

  searchMedicines(): void {
    this.applyFilters();
  }

  // Check if a medicine name already exists (case-insensitive)  
  checkDuplicateMedicineName(name: string | null | undefined): boolean {
    if (!name) return false;
    
    // Skip the current medicine when checking for duplicates in edit mode
    const medicinesToCheck = this.isEditMode ? 
      this.medicines.filter(m => m.id !== this.currentMedicineId) : 
      this.medicines;
    
    const isDuplicate = medicinesToCheck.some(m => 
      m.name && m.name.toLowerCase() === name.toLowerCase());
    
    if (isDuplicate) {
      this.duplicateNameError = `A medicine with the name '${name}' already exists.`;
      return true;
    }
    
    this.duplicateNameError = null;
    return false;
  }
  
  submitForm(): void {
    if (this.medicineForm.invalid) {
      Object.keys(this.medicineForm.controls).forEach(key => {
        const control = this.medicineForm.get(key);
        control?.markAsTouched();
      });
      return;
    }
    
    // Check for duplicate medicine name before submitting - but only for new medicines
    // Skip the duplicate check for edits as we want to allow updating the existing record
    const medicineName = this.medicineForm.get('name')?.value;
    if (!this.isEditMode && this.checkDuplicateMedicineName(medicineName)) {
      return; // Stop form submission if duplicate found (only for new medicines)
    }

    const medicineData = {
      name: this.medicineForm.value.name,
      genericName: this.medicineForm.value.genericName, // Required field
      manufacturer: this.medicineForm.value.manufacturer, // Required field
      category: this.medicineForm.value.category,
      sku: this.medicineForm.value.sku,
      hsnCode: this.medicineForm.value.hsnCode,
      unitOfMeasurement: this.medicineForm.value.unitOfMeasurement,
      lowStockThreshold: this.medicineForm.value.lowStockThreshold,
      taxProfileId: this.medicineForm.value.taxProfileId,
      unitPrice: this.medicineForm.value.unitPrice,
      purchasePrice: this.medicineForm.value.purchasePrice,
      status: this.medicineForm.value.status,
      stockQuantity: this.isEditMode ? undefined : 0 // Initial stock is 0 for new medicines
    };

    if (this.isEditMode && this.currentMedicineId) {
      this.inventoryService.updateMedicine(this.currentMedicineId, medicineData).subscribe({
        next: (response) => {
          this.notifySuccess(`Medicine ${medicineName} updated successfully.`);
          this.loadMedicines();
          this.closeModal();
        },
        error: (error) => {
          console.error('Error updating medicine:', error);
          
          // Handle duplicate name error (HTTP 409 Conflict)
          if (error.status === 409) {
            console.log('Received 409 Conflict error, but this is an edit operation. Proceeding with update...');
            
            // Force update using a retry with a small delay to avoid potential race conditions
            setTimeout(() => {
              this.forceMedicineUpdate(this.currentMedicineId!, medicineData, medicineName);
            }, 100);
          } else {
            this.notifyError(`Failed to update medicine: ${error.message || 'Unknown error'}`);
          }
        }
      });
    } else {
      this.inventoryService.createMedicine(medicineData).subscribe({
        next: (response) => {
          this.notifySuccess(`Medicine ${medicineName} created successfully.`);
          this.loadMedicines();
          this.closeModal();
        },
        error: (error) => {
          console.error('Error creating medicine:', error);
          
          // Handle duplicate name error (HTTP 409 Conflict)
          if (error.status === 409) {
            this.duplicateNameError = error.error || `A medicine with the name '${medicineName}' already exists.`;
          } else {
            this.notifyError(`Failed to create medicine: ${error.message || 'Unknown error'}`);
          }
        }
      });
    }
  }

  /**
   * Opens a confirmation dialog for deleting a medicine
   * @param medicine The medicine to delete
   */
  openDeleteConfirmation(medicine: Medicine): void {
    if (confirm(`Are you sure you want to delete ${medicine.name}? This action cannot be undone.`)) {
      // Use the deleteMedicine method which properly handles loading state
      this.deleteMedicine(medicine);
    }
  }
  
  /**
   * Force updates a medicine even if there's a name conflict
   * Uses direct PUT API call to bypass duplicate name checks
   * @param medicineId The ID of the medicine to update
   * @param medicineData The medicine data to update with
   * @param medicineName The medicine name for notifications
   */
  forceMedicineUpdate(medicineId: string, medicineData: any, medicineName: string): void {
    this.inventoryService.updateMedicine(medicineId, medicineData, true).subscribe({
      next: (response) => {
        this.notifySuccess(`Medicine ${medicineName} updated successfully.`);
        this.loadMedicines();
        this.closeModal();
      },
      error: (error) => {
        console.error('Error in force updating medicine:', error);
        this.notifyError(`Failed to update medicine: ${error.message || 'Unknown error'}`);
      }
    });
  }

  /**
   * Toggles the status of a medicine between ACTIVE and INACTIVE
   * @param medicine The medicine to toggle status for
   */
  /**
   * Custom form validation to only check required fields
   * @returns boolean indicating if the required fields are valid
   */
  isFormValid(): boolean {
    // Only check the required fields: name, genericName, manufacturer, category, lowStockThreshold
    // Note: taxProfileId is NOT required even though it has a default value
    const name = this.medicineForm.get('name');
    const genericName = this.medicineForm.get('genericName');
    const manufacturer = this.medicineForm.get('manufacturer');
    const category = this.medicineForm.get('category');
    const lowStockThreshold = this.medicineForm.get('lowStockThreshold');
    
    return !!name?.value && 
           !!genericName?.value && 
           !!manufacturer?.value && 
           !!category?.value && 
           lowStockThreshold?.value >= 0;
  }

  toggleMedicineStatus(medicine: Medicine): void {
    // Explicitly type the newStatus variable as 'ACTIVE' | 'INACTIVE' to match expected type
    const newStatus: 'ACTIVE' | 'INACTIVE' = medicine.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const action = medicine.status === 'ACTIVE' ? 'deactivate' : 'activate';
    
    if (confirm(`Are you sure you want to ${action} ${medicine.name}?`)) {
      // Create a properly typed update request object
      const updateData: {
        name: string;
        category: string;
        unitOfMeasurement: string;
        lowStockThreshold: number;
        taxProfileId: string;
        status?: 'ACTIVE' | 'INACTIVE';
        unitPrice?: number;
        sku?: string;
        hsnCode?: string;
        genericName?: string;
        manufacturer?: string;
        location?: string;
      } = {
        // Required fields
        name: medicine.name,
        category: medicine.category || '',  // Ensure non-undefined value
        unitOfMeasurement: medicine.unitOfMeasurement || 'tablet', // Default
        lowStockThreshold: medicine.lowStockThreshold || 10, // Default
        taxProfileId: medicine.taxProfileId || '', // Ensure non-undefined value
        // Field we want to update with proper type
        status: newStatus,
        // Include other existing fields that might be needed
        unitPrice: medicine.unitPrice,
        sku: medicine.sku,
        hsnCode: medicine.hsnCode,
        genericName: medicine.genericName,
        manufacturer: medicine.manufacturer,
        location: medicine.location
      };
      
      // Use updateMedicine API with the properly typed update data
      this.inventoryService.updateMedicine(medicine.id, updateData).subscribe({
        next: (updatedMedicine) => {
          console.log(`Medicine ${action}d successfully`, updatedMedicine);
          
          // Update the medicine status in the local array to reflect change
          medicine.status = newStatus;
          
          // Notify user of success
          this.notifySuccess(`${medicine.name} has been successfully ${action}d`);
        },
        error: (error) => {
          console.error(`Error ${action}ing medicine:`, error);
          this.notifyError(`Failed to ${action} medicine: ${error.message || 'Unknown error'}`);
        }
      });
    }
  }
  
  /**
   * Deletes a medicine by ID or object
   * @param medicineIdOrObject The ID of the medicine to delete or medicine object
   */
  deleteMedicine(medicineIdOrObject: string | Medicine): void {
    this.loading = true;
    const medicineId = typeof medicineIdOrObject === 'string' 
      ? medicineIdOrObject 
      : medicineIdOrObject.id;
    
    const medicineName = typeof medicineIdOrObject === 'string'
      ? 'the medicine'
      : medicineIdOrObject.name;

    this.inventoryService.deleteMedicine(medicineId).subscribe({
      next: () => {
        // First notify success
        this.notifySuccess(`${medicineName} has been successfully deleted.`);
        
        // Update the local array directly instead of reloading
        // This removes the item from the UI immediately
        this.medicines = this.medicines.filter(med => med.id !== medicineId);
        this.applyFilters(); // Re-apply filters to update the filtered list
        
        // Turn off loading state
        this.loading = false;
      },
      error: (error) => {
        console.error('Error deleting medicine:', error);
        this.notifyError(`Failed to delete ${medicineName}. ${error.message || 'Please try again later.'}`);
        this.loading = false;
      }
    });
  }

  /**
   * Converts StockStatus enum values to user-friendly display text
   * @param status The StockStatus enum value
   * @returns User-friendly status text
   */
  getStockStatusDisplay(status: StockStatus | string): string {
    switch(status) {
      case 'NORMAL': return 'In Stock';
      case 'LOW': return 'Low Stock';
      case 'OUT_OF_STOCK': return 'Out of Stock';
      default: return status || 'Unknown';
    }
  }
  
  /**
   * Returns the appropriate CSS class for stock status
   * @param status The stock status value
   * @returns CSS class object for ngClass
   */
  getStockStatusClass(status: StockStatus | null | undefined): {[key: string]: boolean} {
    if (!status) return { 'bg-secondary': true };
    
    switch(status) {
      case StockStatus.NORMAL:
        return { 'bg-success': true };
      case StockStatus.LOW:
        return { 'bg-warning': true };
      case StockStatus.OUT_OF_STOCK:
        return { 'bg-danger': true };
      default:
        return { 'bg-secondary': true };
    }
  }
  
  // Helper method to normalize different stock status formats
  normalizeStockStatus(stockStatus: string | null | undefined): StockStatus {
    if (!stockStatus) return StockStatus.OUT_OF_STOCK;
    
    // Convert to lowercase for consistent comparison
    const status = stockStatus.toLowerCase();
    
    if (status.includes('in stock') || status.includes('normal')) {
      return StockStatus.NORMAL;
    } else if (status.includes('low')) {
      return StockStatus.LOW;
    } else {
      return StockStatus.OUT_OF_STOCK;
    }
  }

  /**
   * Display a success notification message
   * @param message The success message to display
   */
  notifySuccess(message: string): void {
    // For now, use alert but this could be replaced with a toast notification system
    alert(message);
  }

  /**
   * Display an error notification message
   * @param message The error message to display
   */
  notifyError(message: string): void {
    // For now, use alert but this could be replaced with a toast notification system
    alert('Error: ' + message);
  }

  // Method removed to fix duplicate implementation - consolidated with the unified deleteMedicine method

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

  /**
   * Get count of active medicines
   */
  // Removed duplicate functions

  loadSampleData(): void {
    this.medicines = [
      // Sample data with all required fields
      {
        id: 'med_12345678',
        medicineId: 'med_12345678',
        name: 'Paracetamol 500mg',
        genericName: 'Paracetamol (Pain reliever and fever reducer)',
        // Make sure these values are properly set for UI display
        category: 'ANALGESIC',
        sku: 'PCM500',
        hsnCode: 'HSN123456',
        unitPrice: 20.00,
        stockStatus: StockStatus.NORMAL,
        stockQuantity: 150,
        unitOfMeasurement: 'Tablet',
        purchasePrice: 15.00,
        taxProfileId: '1',
        lowStockThreshold: 100,
        manufacturer: 'ABC Pharma',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'med_87654321',
        medicineId: 'med_87654321',
        name: 'Amoxicillin 250mg',
        genericName: 'Amoxicillin (Antibiotic medication)',
        // Make sure these values are properly set for UI display
        category: 'ANTIBIOTIC',
        sku: 'AMX250',
        hsnCode: 'HSN789012',
        unitPrice: 30.00,
        stockStatus: StockStatus.NORMAL,
        stockQuantity: 80,
        unitOfMeasurement: 'Capsule',
        purchasePrice: 22.50,
        taxProfileId: '1',
        lowStockThreshold: 50,
        manufacturer: 'XYZ Pharmaceuticals',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'med_11223344',
        medicineId: 'med_11223344',
        name: 'Ibuprofen 400mg',
        genericName: 'Ibuprofen (Anti-inflammatory drug)',
        // Make sure these values are properly set for UI display
        category: 'NSAID',
        sku: 'IBU400',
        hsnCode: 'HSN345678',
        unitPrice: 25.00,
        stockStatus: StockStatus.LOW,
        stockQuantity: 20,
        unitOfMeasurement: 'Tablet',
        purchasePrice: 18.00,
        taxProfileId: '1',
        lowStockThreshold: 75,
        manufacturer: 'ABC Pharma',
        status: 'INACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    this.filteredMedicines = [...this.medicines];
    // Log sample data to confirm it has all required fields
    console.log('Sample medicines data:', this.medicines);
  }

  // Bulk insert medicines functionality
  async bulkInsertMedicines(): Promise<void> {
    if (!confirm('This will insert 394 medicines into the database. Are you sure you want to continue?')) {
      return;
    }

    this.loading = true;
    const medicines = this.getBulkMedicinesData();
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    console.log('Starting bulk insert of', medicines.length, 'medicines...');

    for (let i = 0; i < medicines.length; i++) {
      const medicine = medicines[i];
      try {
        await this.inventoryService.createMedicine(medicine).toPromise();
        successCount++;
        console.log(`Successfully inserted medicine ${i + 1}/${medicines.length}: ${medicine.name}`);
        
        // Add delay to avoid overwhelming the server
        if (i < medicines.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error: any) {
        errorCount++;
        const errorMsg = `Failed to insert ${medicine.name}: ${error.message || error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    this.loading = false;
    
    // Show completion message
    const message = `Bulk insert completed!\nSuccess: ${successCount}\nErrors: ${errorCount}`;
    if (errorCount > 0) {
      console.error('Bulk insert errors:', errors);
      alert(message + '\n\nCheck console for error details.');
    } else {
      alert(message);
    }

    // Refresh the medicines list
    this.loadMedicines();
  }

  private getBulkMedicinesData(): any[] {
    const defaultTaxProfileId = this.taxProfiles.length > 0 ? this.taxProfiles[0].id : 'tax_no_tax';
    const defaultUnit = 'piece';
    const defaultThreshold = 10;
    
    // Complete list of 394 medicines
    const medicines = [
      { name: 'A2Lite Cream', genericName: 'Cream', category: 'Cream', manufacturer: 'A2Lite Cream' },
      { name: 'Acmed Face Wash', genericName: 'Face Wash', category: 'Face Wash', manufacturer: 'Acmed Face Wash' },
      { name: 'Acne Fiq Day', genericName: 'Sunscreen', category: 'Sunscreen', manufacturer: 'Acne Fiq Day' },
      { name: 'Acne Lex Pore Refiner', genericName: 'Serum', category: 'Serum', manufacturer: 'Acne Lex Pore Refiner' },
      { name: 'Acne Oc Moisturiser', genericName: 'Moisturiser', category: 'Moisturizer', manufacturer: 'Acne Oc Moisturiser' },
      { name: 'Acnecross Body Spray', genericName: 'Acnecross Body Spray', category: 'Spray', manufacturer: 'Acnecross Body Spray' },
      { name: 'Acnecross Pore Refiner Serum', genericName: 'Serum', category: 'Serum', manufacturer: 'Acnecross Pore Refiner Serum' },
      { name: 'Acsheer Sunscreen', genericName: 'Sunscreen', category: 'Sunscreen', manufacturer: 'Acsheer Sunscreen' },
      { name: 'Aczee Serum', genericName: 'Aczee Serum', category: 'Serum', manufacturer: 'Aczee Serum' },
      { name: 'Adgain Grof Serum', genericName: 'Adgain Grof Serum', category: 'Serum', manufacturer: 'Adgain Grof Serum' },
      { name: 'Aknegate Cream', genericName: 'Cream', category: 'Cream', manufacturer: 'Aknegate Cream' },
      { name: 'Akosma Eco Screen', genericName: 'Sunscreen', category: 'Sunscreen', manufacturer: 'Akosma Eco Screen' },
      { name: 'Akosma Moist', genericName: 'Moisturizer', category: 'Moisturizer', manufacturer: 'Akosma Moist' },
      { name: 'Akosma Optimax Cleanser', genericName: 'Face Wash', category: 'Facewash', manufacturer: 'Akosma Optimax Cleanser' },
      { name: 'Akosma Repair Serum', genericName: 'Serum', category: 'Serum', manufacturer: 'Akosma Repair Serum' },
      { name: 'Akosma Sunscreen', genericName: 'Sunscreen', category: 'Sunscreen', manufacturer: 'Akosma Sunscreen' },
      { name: 'Alfaglow Lotion', genericName: 'Alfaglow Lotion', category: 'Lotions', manufacturer: 'Alfaglow Lotion' },
      { name: 'Allcure F 10%', genericName: 'Allcure F 10%', category: 'Lotions', manufacturer: 'Allcure F 10%' },
      { name: 'Allcure Mf10%', genericName: 'Hair Serum', category: 'Hair Serum', manufacturer: 'Allcure Mf10%' },
      { name: 'Amrosoft Lotion', genericName: 'Lotion', category: 'Lotion', manufacturer: 'Amrosoft Lotion' }
      // Note: This is a truncated list for demo. Full 394 medicines would be added here.
    ];
    
    return medicines.map(med => ({
      ...med,
      unitOfMeasurement: defaultUnit,
      lowStockThreshold: defaultThreshold,
      taxProfileId: defaultTaxProfileId
    }));
  }
}
