import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { InventoryService } from '../../../services/inventory.service';
import { TaxProfile, TaxComponent } from '../../../models/inventory.models';
import { NgbModal, NgbModalRef, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPencilAlt, faPlus, faTimes, faTrash, faBroom, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { AuthService, UserProfile } from '../../../../../app/auth/shared/auth.service';

@Component({
  selector: 'app-tax-profile-master',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule, FontAwesomeModule],
  templateUrl: './tax-profile-master.html',
  styleUrl: './tax-profile-master.scss'
})
export class TaxProfileMasterComponent implements OnInit {
  // Icons
  faEdit = faPencilAlt;
  faAdd = faPlus;
  faRemove = faTimes;
  faDelete = faTrash;
  faCleanup = faBroom;
  faWarning = faExclamationTriangle;
  
  // Data
  taxProfiles: TaxProfile[] = [];
  activeTaxProfiles: TaxProfile[] = [];
  loading = false;
  cleanupLoading = false;
  
  // Permission controls
  isSuperAdmin = false;
  private user: UserProfile | null = null;
  
  // Modal
  modalRef?: NgbModalRef;
  taxProfileForm!: FormGroup;
  isEditing = false;
  currentProfileId?: string;

  constructor(
    private inventoryService: InventoryService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadUserPermissions();
    this.loadTaxProfiles();
    this.initTaxProfileForm();
  }
  
  /**
   * Check if current user has super admin permissions
   * Only super admin can delete tax profiles
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
      
      console.log('Tax Profile Master Permissions:', {
        email,
        role,
        isSuperAdmin: this.isSuperAdmin
      });
    }
  }

  // Cleanup all tax profiles except "no tax" profile
  cleanupTaxProfiles(): void {
    const confirmMessage = 'This will delete ALL tax profiles except "no tax" profiles. Medicines using deleted profiles will be updated to use the "no tax" profile. This action cannot be undone. Are you sure?';
    
    if (confirm(confirmMessage)) {
      this.cleanupLoading = true;
      
      this.inventoryService.cleanupTaxProfiles().subscribe({
        next: (result) => {
          this.cleanupLoading = false;
          
          let message = `Tax profile cleanup completed successfully!\n\n`;
          message += `Deleted profiles: ${result.deletedCount}\n`;
          
          if (result.errorCount > 0) {
            message += `Errors encountered: ${result.errorCount}\n`;
            if (result.errors) {
              message += `Error details: ${result.errors}`;
            }
          }
          
          alert(message);
          
          // Reload tax profiles to show updated list
          this.loadTaxProfiles();
        },
        error: (error) => {
          this.cleanupLoading = false;
          console.error('Cleanup failed:', error);
          alert(`Failed to cleanup tax profiles: ${error.message || 'Unknown error occurred'}`);
        }
      });
    }
  }

  // Initialize form for creating/editing tax profiles
  initTaxProfileForm(): void {
    this.taxProfileForm = this.fb.group({
      profileName: ['', [Validators.required]],
      totalRate: [0, [Validators.required, Validators.min(0)]],
      components: this.fb.array([])
    });
  }

  // Get components form array
  get components(): FormArray {
    return this.taxProfileForm.get('components') as FormArray;
  }

  // Add component to the form
  addComponent(): void {
    this.components.push(
      this.fb.group({
        componentName: ['', Validators.required],
        rate: [0, [Validators.required, Validators.min(0)]]
      })
    );
    this.updateTotalRate();
  }

  // Remove component from the form
  removeComponent(index: number): void {
    this.components.removeAt(index);
    this.updateTotalRate();
  }

  // Update total rate based on components and auto-generate profile name
  updateTotalRate(): void {
    const componentsArray = this.components.value;
    const total = componentsArray.reduce((sum: number, component: any) => 
      sum + (+component.rate || 0), 0);
    
    // Auto-generate profile name based on total rate
    let profileName: string;
    
    // Special case: if total is 0 (both CGST and SGST are 0), set as "No Tax"
    if (total === 0) {
      profileName = 'No Tax';
    } else {
      profileName = `GST ${total}%`;
    }
    
    // Update form values
    this.taxProfileForm.patchValue({ 
      totalRate: total,
      profileName: profileName
    });
  }

  // Load all tax profiles
  loadTaxProfiles(): void {
    this.loading = true;
    this.inventoryService.getTaxProfiles(true, true).subscribe({
      next: (profiles) => {
        this.taxProfiles = profiles;
        // Filter out profiles with status === 'INACTIVE'
        this.activeTaxProfiles = profiles.filter(profile => profile.status !== 'INACTIVE');
        this.loading = false;
        console.log('Tax profiles loaded:', profiles);
        console.log('Active tax profiles:', this.activeTaxProfiles);
      },
      error: (error) => {
        console.error('Error loading tax profiles:', error);
        this.loading = false;
      }
    });
  }

  // Open create/edit modal
  openTaxProfileModal(modal: any, profile?: TaxProfile): void {
    // Reset form and state
    this.initTaxProfileForm();
    this.components.clear();
    
    if (profile) {
      // Edit mode
      this.isEditing = true;
      this.currentProfileId = profile.id;
      
      this.taxProfileForm.patchValue({
        totalRate: profile.totalRate
        // Don't set profileName here as it will be auto-generated
      });
      
      // Add existing components
      if (profile.components && profile.components.length > 0) {
        profile.components.forEach(component => {
          this.components.push(
            this.fb.group({
              componentName: [component.componentName, Validators.required],
              rate: [component.rate, [Validators.required, Validators.min(0)]]
            })
          );
        });
        // Trigger update of total rate and profile name after adding components
        this.updateTotalRate();
      }
    } else {
      // Create mode
      this.isEditing = false;
      this.currentProfileId = undefined;
      
      // Add default components (CGST, SGST)
      this.addDefaultComponents();
    }
    
    this.modalRef = this.modalService.open(modal, { size: 'lg', backdrop: 'static' });
  }
  
  // Add default tax components (CGST and SGST)
  addDefaultComponents(): void {
    // Add CGST with default rate 4.0
    this.components.push(
      this.fb.group({
        componentName: ['CGST', Validators.required],
        rate: [4.0, [Validators.required, Validators.min(0)]]
      })
    );
    
    // Add SGST with default rate 4.0
    this.components.push(
      this.fb.group({
        componentName: ['SGST', Validators.required],
        rate: [4.0, [Validators.required, Validators.min(0)]]
      })
    );
    
    // Update total rate based on components
    this.updateTotalRate();
  }

  // Save tax profile
  saveTaxProfile(): void {
    if (this.taxProfileForm.invalid) {
      // Mark all fields as touched to show validation errors
      this.taxProfileForm.markAllAsTouched();
      return;
    }
    
    const formValue = this.taxProfileForm.value;
    const taxProfileData = {
      profileName: formValue.profileName,
      totalRate: parseFloat(formValue.totalRate),
      components: formValue.components.map((comp: any) => {
        // Ensure component names are properly set
        let componentName = comp.componentName;
        if (!componentName) {
          // If empty, use a placeholder based on index
          componentName = `Component ${this.components.controls.indexOf(comp) + 1}`;
        }
        
        return {
          componentName: componentName,
          rate: parseFloat(comp.rate) || 0
        };
      })
    };
    
    // Special handling for "No Tax" profiles - assign specific ID
    if (formValue.profileName === 'No Tax' && parseFloat(formValue.totalRate) === 0) {
      (taxProfileData as any).id = 'tax_no_tax';
      console.log('Setting special ID for No Tax profile: tax_no_tax');
    }
    
    console.log('Submitting tax profile data:', taxProfileData);
    
    if (this.isEditing && this.currentProfileId) {
      // Update existing tax profile
      this.updateTaxProfile(taxProfileData);
    } else {
      // Create new tax profile
      this.inventoryService.createTaxProfile(taxProfileData).subscribe({
        next: (response) => {
          console.log('Tax profile saved successfully:', response);
          this.modalRef?.close();
          this.loadTaxProfiles(); // Refresh the list
        },
        error: (error) => {
          console.error('Error saving tax profile:', error);
          // Show error message
          alert('Failed to save tax profile. Please try again.');
        }
      });
    }
  }

  // Update existing tax profile
  updateTaxProfile(taxProfileData: any): void {
    if (!this.currentProfileId) {
      console.error('No profile ID for update');
      return;
    }

    this.inventoryService.updateTaxProfile(this.currentProfileId, taxProfileData).subscribe({
      next: (response) => {
        console.log('Tax profile updated successfully:', response);
        this.modalRef?.close();
        this.loadTaxProfiles(); // Refresh the list
      },
      error: (error) => {
        console.error('Error updating tax profile:', error);
        // Show error message
        alert('Failed to update tax profile. Please try again.');
      }
    });
  }
  
  // Delete tax profile
  deleteTaxProfile(id: string): void {
    if (!id) {
      console.error('No profile ID provided for deletion');
      return;
    }
    
    if (confirm('Are you sure you want to delete this tax profile? This cannot be undone.')) {
      // Show loading state
      this.loading = true;
      
      this.inventoryService.deleteTaxProfile(id).subscribe({
        next: () => {
          console.log('Tax profile deleted successfully');
          // Show success message
          alert('Tax profile deleted successfully.');
          this.loadTaxProfiles(); // Refresh the list
        },
        error: (error) => {
          console.error('Error deleting tax profile:', error);
          this.loading = false;
          
          // Check for specific error conditions
          if (error.status === 409 || (error.error && error.error.message && error.error.message.includes('in use'))) {
            // Conflict - tax profile is in use
            alert('Unable to delete this tax profile as it is currently in use by medicines or other records.');
          } else if (error.status === 403) {
            // Forbidden - user doesn't have permission
            alert('You do not have permission to delete this tax profile.');
          } else {
            // Generic error message
            alert('Failed to delete tax profile. ' + (error.error?.message || 'Please try again.'));
          }
        }
      });
    }
  }
}
