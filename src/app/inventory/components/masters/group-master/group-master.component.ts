import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InventoryService } from '../../../services/inventory.service';
import { Group } from '../../../models/inventory.models';

@Component({
  selector: 'app-group-master',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './group-master.component.html',
  styleUrls: ['./group-master.component.scss']
})
export class GroupMasterComponent implements OnInit {
  groups: Group[] = [];
  filteredGroups: Group[] = [];
  groupForm: FormGroup;
  loading = false;
  showModal = false;
  isEditMode = false;
  currentGroupId: string | null = null;
  searchTerm = '';

  constructor(
    private inventoryService: InventoryService,
    private fb: FormBuilder
  ) {
    this.groupForm = this.fb.group({
      name: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadGroups();
  }

  loadGroups(): void {
    this.loading = true;
    this.inventoryService.getGroups().subscribe({
      next: (data) => {
        this.groups = data;
        this.filteredGroups = [...this.groups];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading groups:', error);
        this.loading = false;
        // Load sample data for development purposes
        this.loadSampleData();
      }
    });
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.currentGroupId = null;
    this.groupForm.reset();
    this.showModal = true;
  }

  openEditModal(group: Group): void {
    this.isEditMode = true;
    this.currentGroupId = group.id;
    this.groupForm.patchValue({
      name: group.name
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  searchGroups(): void {
    if (!this.searchTerm.trim()) {
      this.filteredGroups = [...this.groups];
      return;
    }
    
    const term = this.searchTerm.toLowerCase().trim();
    this.filteredGroups = this.groups.filter(
      group => group.name.toLowerCase().includes(term)
    );
  }

  submitForm(): void {
    if (this.groupForm.invalid) {
      this.groupForm.get('name')?.markAsTouched();
      return;
    }

    const groupData = {
      name: this.groupForm.value.name
    };

    if (this.isEditMode && this.currentGroupId) {
      this.inventoryService.updateGroup(this.currentGroupId, groupData).subscribe({
        next: (response) => {
          this.loadGroups();
          this.closeModal();
        },
        error: (error) => {
          console.error('Error updating group:', error);
        }
      });
    } else {
      this.inventoryService.createGroup(groupData).subscribe({
        next: (response) => {
          this.loadGroups();
          this.closeModal();
        },
        error: (error) => {
          console.error('Error creating group:', error);
        }
      });
    }
  }

  deleteGroup(groupId: string): void {
    if (confirm('Are you sure you want to delete this group?')) {
      this.inventoryService.deleteGroup(groupId).subscribe({
        next: () => {
          this.loadGroups();
        },
        error: (error) => {
          console.error('Error deleting group:', error);
        }
      });
    }
  }

  // Sample data for development purposes
  loadSampleData(): void {
    this.groups = [
      { id: '1', name: 'Spray' },
      { id: '2', name: 'SERUM' },
      { id: '3', name: 'lotions' },
      { id: '4', name: 'Lacquers' },
      { id: '5', name: 'cream' },
      { id: '6', name: 'CONDITIONER' },
      { id: '7', name: 'Gel' },
      { id: '8', name: 'ointment' },
      { id: '9', name: 'SUNSCREEN' },
      { id: '10', name: 'FACEWASH' },
      { id: '11', name: 'Dermroller' },
      { id: '12', name: 'Tab' },
      { id: '13', name: 'SOAP' }
    ];
    this.filteredGroups = [...this.groups];
  }
}
