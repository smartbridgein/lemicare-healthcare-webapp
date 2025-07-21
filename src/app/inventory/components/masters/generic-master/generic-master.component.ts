import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InventoryService } from '../../../services/inventory.service';
import { Generic } from '../../../models/inventory.models';

@Component({
  selector: 'app-generic-master',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './generic-master.component.html',
  styleUrls: ['./generic-master.component.scss']
})
export class GenericMasterComponent implements OnInit {
  generics: Generic[] = [];
  filteredGenerics: Generic[] = [];
  genericForm: FormGroup;
  loading = false;
  showModal = false;
  isEditMode = false;
  currentGenericId: string | null = null;
  searchTerm = '';

  constructor(
    private inventoryService: InventoryService,
    private fb: FormBuilder
  ) {
    this.genericForm = this.fb.group({
      name: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadGenerics();
  }

  loadGenerics(): void {
    this.loading = true;
    this.inventoryService.getGenerics().subscribe({
      next: (data) => {
        this.generics = data;
        this.filteredGenerics = [...this.generics];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading generics:', error);
        this.loading = false;
        // Load sample data for development purposes
        this.loadSampleData();
      }
    });
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.currentGenericId = null;
    this.genericForm.reset();
    this.showModal = true;
  }

  openEditModal(generic: Generic): void {
    this.isEditMode = true;
    this.currentGenericId = generic.id;
    this.genericForm.patchValue({
      name: generic.name
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  searchGenerics(): void {
    if (!this.searchTerm.trim()) {
      this.filteredGenerics = [...this.generics];
      return;
    }
    
    const term = this.searchTerm.toLowerCase().trim();
    this.filteredGenerics = this.generics.filter(
      generic => generic.name.toLowerCase().includes(term)
    );
  }

  submitForm(): void {
    if (this.genericForm.invalid) {
      this.genericForm.get('name')?.markAsTouched();
      return;
    }

    const genericData = {
      name: this.genericForm.value.name
    };

    if (this.isEditMode && this.currentGenericId) {
      this.inventoryService.updateGeneric(this.currentGenericId, genericData).subscribe({
        next: (response) => {
          this.loadGenerics();
          this.closeModal();
        },
        error: (error) => {
          console.error('Error updating generic:', error);
        }
      });
    } else {
      this.inventoryService.createGeneric(genericData).subscribe({
        next: (response) => {
          this.loadGenerics();
          this.closeModal();
        },
        error: (error) => {
          console.error('Error creating generic:', error);
        }
      });
    }
  }

  deleteGeneric(genericId: string): void {
    if (confirm('Are you sure you want to delete this generic?')) {
      this.inventoryService.deleteGeneric(genericId).subscribe({
        next: () => {
          this.loadGenerics();
        },
        error: (error) => {
          console.error('Error deleting generic:', error);
        }
      });
    }
  }

  // Sample data for development purposes
  loadSampleData(): void {
    this.generics = [
      { id: '1', name: 'ISOPROPYL MYRISTATE' },
      { id: '2', name: 'ARBUTIN' },
      { id: '3', name: 'ALOE' },
      { id: '4', name: 'ZINC' },
      { id: '5', name: 'CLINDAMYCIN' },
      { id: '6', name: 'BENZOYL PEROXIDE' },
      { id: '7', name: 'AZELAIC ACID' },
      { id: '8', name: 'SALICYLIC ACID' },
      { id: '9', name: 'NIACINAMIDE' },
      { id: '10', name: 'HYALURONIC ACID' },
      { id: '11', name: 'RETINOL' },
      { id: '12', name: 'VITAMIN C' }
    ];
    this.filteredGenerics = [...this.generics];
  }
}
