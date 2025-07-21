import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../shared/billing.service';
import { Invoice } from '../shared/billing.model';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './invoice-list.component.html',
  styleUrls: ['./invoice-list.component.scss']
})
export class InvoiceListComponent implements OnInit {
  invoices: Invoice[] = [];
  filteredInvoices: Invoice[] = [];
  loading = true;
  searchTerm = '';
  statusFilter = 'ALL';

  constructor(private billingService: BillingService) {}

  ngOnInit(): void {
    this.loadInvoices();
  }

  loadInvoices(): void {
    this.loading = true;
    this.billingService.getAllInvoices().subscribe({
      next: (data) => {
        this.invoices = data;
        this.filterInvoices();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading invoices', error);
        this.loading = false;
      }
    });
  }

  filterInvoices(): void {
    this.filteredInvoices = this.invoices.filter(invoice => {
      // Filter by search term
      const matchesSearch = this.searchTerm === '' || 
        invoice.patientName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        invoice.invoiceId?.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      // Filter by status
      const matchesStatus = this.statusFilter === 'ALL' || 
        invoice.status === this.statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }

  onSearchChange(): void {
    this.filterInvoices();
  }

  onStatusFilterChange(): void {
    this.filterInvoices();
  }

  calculateTotalAmount(): number {
    return this.filteredInvoices.reduce((total, invoice) => total + invoice.amount, 0);
  }

  countByStatus(status: string): number {
    return this.invoices.filter(invoice => invoice.status === status).length;
  }

  confirmDelete(id: string | undefined): void {
    this.deleteInvoice(id);
  }
  
  deleteInvoice(id: string | undefined): void {
    if (!id) return;
    
    if (confirm('Are you sure you want to delete this invoice?')) {
      this.billingService.deleteInvoice(id).subscribe({
        next: () => {
          this.invoices = this.invoices.filter(invoice => invoice.id !== id);
          this.filterInvoices();
          alert('Invoice deleted successfully');
        },
        error: (error) => {
          console.error('Error deleting invoice', error);
          alert('Failed to delete invoice');
        }
      });
    }
  }
}
