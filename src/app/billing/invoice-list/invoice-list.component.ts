import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../shared/billing.service';
import { Invoice } from '../shared/billing.model';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

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
  selectedInvoice: any = null;
  detailedInvoice: any = null;
  loadingDetails = false;

  constructor(
    private billingService: BillingService,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    this.loadInvoices();
  }

  loadInvoices(): void {
    this.loading = true;
    this.billingService.getAllInvoices().subscribe({
      next: (data: Invoice[]) => {
        // Sort invoices by timestamp in descending order (newest first)
        this.invoices = this.sortInvoicesByTimestampDesc(data);
        this.filterInvoices();
        this.loading = false;
      },
      error: (error: any) => {
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

  viewInvoice(invoice: Invoice, modal: any): void {
    this.selectedInvoice = invoice;
    this.loadingDetails = true;
    
    // Open the modal first so user sees something is happening
    this.modalService.open(modal, { size: 'xl', centered: true });
    
    // Then load the detailed data
    if (invoice.id) {
      this.billingService.getInvoiceById(invoice.id).subscribe({
        next: (data: Invoice) => {
          console.log('Invoice details from API:', data);
          
          // Ensure line items have service names
          if (data.items && data.items.length > 0) {
            data.items = data.items.map((item: any) => {
              // If serviceName is missing but serviceId exists, use description as fallback
              if (!item.serviceName && item.serviceId) {
                item.serviceName = item.serviceDescription || 'Service ' + item.serviceId;
              }
              return item;
            });
          }
          
          this.detailedInvoice = data;
          console.log('Processed detailed invoice:', this.detailedInvoice);
          this.loadingDetails = false;
        },
        error: (error: any) => {
          console.error('Error loading invoice details', error);
          this.loadingDetails = false;
          this.detailedInvoice = this.selectedInvoice; // Fall back to basic info
        }
      });
    } else {
      this.loadingDetails = false;
      this.detailedInvoice = this.selectedInvoice;
    }
  }

  printInvoice(): void {
    window.print();
  }

  getTaxAmount(item: any): number {
    if (!item.taxDetails || item.taxDetails.length === 0) {
      return 0;
    }
    return item.taxDetails.reduce((sum: number, tax: any) => sum + (tax.amount || 0), 0);
  }

  getTotalQuantity(): number {
    if (!this.detailedInvoice?.items) {
      return 0;
    }
    return this.detailedInvoice.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
  }

  getTaxProfileName(taxProfileId: string): string {
    // This should ideally fetch from a tax profiles service
    // For now, return a formatted version of the ID or a default name
    if (!taxProfileId) {
      return '-';
    }
    
    // Common tax profile patterns - you may need to adjust based on your data
    if (taxProfileId.includes('GST_18')) {
      return 'GST 18%';
    } else if (taxProfileId.includes('GST_12')) {
      return 'GST 12%';
    } else if (taxProfileId.includes('GST_5')) {
      return 'GST 5%';
    } else if (taxProfileId.includes('GST_28')) {
      return 'GST 28%';
    } else {
      // Extract percentage if it's in the ID format
      const match = taxProfileId.match(/(\d+)/g);
      if (match && match.length > 0) {
        return `GST ${match[match.length - 1]}%`;
      }
      return taxProfileId; // Fallback to showing the ID itself
    }
  }

  confirmDelete(invoiceId: string): void {
    if (confirm('Are you sure you want to delete this invoice?')) {
      this.deleteInvoice(invoiceId);
    }
  }

  deleteInvoice(invoiceId: string): void {
    this.billingService.deleteInvoice(invoiceId).subscribe({
      next: () => {
        this.loadInvoices();
        alert('Invoice deleted successfully');
      },
      error: (error: any) => {
        console.error('Error deleting invoice', error);
        alert('Failed to delete invoice');
      }
    });
  }

  /**
   * Sort invoices by timestamp in descending order (newest first)
   * Uses timestamp field for most accurate sorting with fallbacks to other date fields
   */
  sortInvoicesByTimestampDesc(invoices: Invoice[]): Invoice[] {
    return [...invoices].sort((a, b) => {
      // Use timestamp first, then createdTimestamp, then createdDate, then date as fallback
      const timestampA = (a as any).timestamp || (a as any).createdTimestamp || a.createdDate || a.date;
      const timestampB = (b as any).timestamp || (b as any).createdTimestamp || b.createdDate || b.date;
      
      // Sort in descending order (newest first)
      return new Date(timestampB).getTime() - new Date(timestampA).getTime();
    });
  }

  /**
   * Format invoice date and time for display
   * Uses timestamp field first, then falls back to other date fields
   */
  formatInvoiceDateTime(invoice: Invoice): string {
    // Priority: timestamp > createdTimestamp > createdDate > date
    const timestamp = (invoice as any).timestamp || (invoice as any).createdTimestamp;
    const dateOnly = invoice.createdDate || invoice.date;
    
    if (timestamp) {
      // Format timestamp with both date and time
      const date = new Date(timestamp);
      return this.formatDateTimeString(date);
    } else if (dateOnly) {
      // Format date only (fallback for older records)
      const date = new Date(dateOnly);
      return this.formatDateString(date);
    }
    
    return 'N/A';
  }

  /**
   * Get invoice created text for secondary display
   */
  getInvoiceCreatedText(invoice: Invoice): string {
    const timestamp = (invoice as any).createdTimestamp;
    const dateOnly = invoice.createdDate || invoice.date;
    
    if (timestamp) {
      const date = new Date(timestamp);
      return `Created ${this.formatCreatedDateString(date)}`;
    } else if (dateOnly) {
      const date = new Date(dateOnly);
      return `Created ${this.formatCreatedDateString(date)}`;
    }
    
    return 'Created N/A';
  }

  /**
   * Format date and time as 'dd/MM/yyyy HH:mm'
   */
  private formatDateTimeString(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  /**
   * Format date only as 'dd/MM/yyyy'
   */
  private formatDateString(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  }

  /**
   * Format created date as 'MMM d, y'
   */
  private formatCreatedDateString(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    return `${month} ${day}, ${year}`;
  }
}
