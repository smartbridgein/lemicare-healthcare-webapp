import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InventoryService } from '../../../services/inventory.service';
import { Company } from '../../../models/inventory.models';

@Component({
  selector: 'app-company-master',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './company-master.component.html',
  styleUrls: ['./company-master.component.scss']
})
export class CompanyMasterComponent implements OnInit {
  companies: Company[] = [];
  filteredCompanies: Company[] = [];
  companyForm: FormGroup;
  loading = false;
  showModal = false;
  isEditMode = false;
  currentCompanyId: string | null = null;
  searchTerm = '';

  constructor(
    private inventoryService: InventoryService,
    private fb: FormBuilder
  ) {
    this.companyForm = this.fb.group({
      name: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.loading = true;
    this.inventoryService.getCompanies().subscribe({
      next: (data) => {
        this.companies = data;
        this.filteredCompanies = [...this.companies];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading companies:', error);
        this.loading = false;
        // Load sample data for development purposes
        this.loadSampleData();
      }
    });
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.currentCompanyId = null;
    this.companyForm.reset();
    this.showModal = true;
  }

  openEditModal(company: Company): void {
    this.isEditMode = true;
    this.currentCompanyId = company.id;
    this.companyForm.patchValue({
      name: company.name
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  searchCompanies(): void {
    if (!this.searchTerm.trim()) {
      this.filteredCompanies = [...this.companies];
      return;
    }
    
    const term = this.searchTerm.toLowerCase().trim();
    this.filteredCompanies = this.companies.filter(
      company => company.name.toLowerCase().includes(term)
    );
  }

  submitForm(): void {
    if (this.companyForm.invalid) {
      this.companyForm.get('name')?.markAsTouched();
      return;
    }

    const companyData = {
      name: this.companyForm.value.name
    };

    if (this.isEditMode && this.currentCompanyId) {
      this.inventoryService.updateCompany(this.currentCompanyId, companyData).subscribe({
        next: (response) => {
          this.loadCompanies();
          this.closeModal();
        },
        error: (error) => {
          console.error('Error updating company:', error);
        }
      });
    } else {
      this.inventoryService.createCompany(companyData).subscribe({
        next: (response) => {
          this.loadCompanies();
          this.closeModal();
        },
        error: (error) => {
          console.error('Error creating company:', error);
        }
      });
    }
  }

  deleteCompany(companyId: string): void {
    if (confirm('Are you sure you want to delete this company?')) {
      this.inventoryService.deleteCompany(companyId).subscribe({
        next: () => {
          this.loadCompanies();
        },
        error: (error) => {
          console.error('Error deleting company:', error);
        }
      });
    }
  }

  // Sample data for development purposes
  loadSampleData(): void {
    this.companies = [
      { id: '1', name: 'GLENMARK' },
      { id: '2', name: 'INTAS' },
      { id: '3', name: 'MANKIND' },
      { id: '4', name: 'USV' },
      { id: '5', name: 'CIPLA' },
      { id: '6', name: 'SANOFI' },
      { id: '7', name: 'BIOCHEM' },
      { id: '8', name: 'IPCA' },
      { id: '9', name: 'ABBOTT' },
      { id: '10', name: 'ZODLEY' },
      { id: '11', name: 'SUN PHARMA' },
      { id: '12', name: 'FOURRTS' }
    ];
    this.filteredCompanies = [...this.companies];
  }
}
