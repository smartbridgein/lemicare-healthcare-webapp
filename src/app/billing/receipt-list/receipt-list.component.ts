import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../shared/billing.service';
import { Receipt } from '../shared/billing.model';

@Component({
  selector: 'app-receipt-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './receipt-list.component.html',
  styleUrls: ['./receipt-list.component.scss']
})
export class ReceiptListComponent implements OnInit {
  receipts: Receipt[] = [];
  filteredReceipts: Receipt[] = [];
  loading = true;
  searchTerm = '';

  constructor(private billingService: BillingService) {}

  ngOnInit(): void {
    this.loadReceipts();
  }

  loadReceipts(): void {
    this.loading = true;
    this.billingService.getAllReceipts().subscribe({
      next: (data) => {
        this.receipts = data;
        this.filterReceipts();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading receipts', error);
        this.loading = false;
      }
    });
  }

  filterReceipts(): void {
    this.filteredReceipts = this.receipts.filter(receipt => {
      return this.searchTerm === '' || 
        receipt.patientName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        receipt.receiptId?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (receipt.invoiceId && receipt.invoiceId.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        receipt.modeOfPayment.toLowerCase().includes(this.searchTerm.toLowerCase());
    });
  }

  onSearchChange(): void {
    this.filterReceipts();
  }

  calculateTotalAmount(): number {
    return this.filteredReceipts.reduce((total, receipt) => total + receipt.amount, 0);
  }

  countByPaymentMode(mode: string): number {
    return this.receipts.filter(receipt => receipt.modeOfPayment === mode).length;
  }

  deleteReceipt(id: string | undefined): void {
    if (!id) return;
    
    if (confirm('Are you sure you want to delete this receipt?')) {
      this.billingService.deleteReceipt(id).subscribe({
        next: () => {
          this.receipts = this.receipts.filter(receipt => receipt.id !== id);
          this.filterReceipts();
          alert('Receipt deleted successfully');
        },
        error: (error) => {
          console.error('Error deleting receipt', error);
          alert('Failed to delete receipt');
        }
      });
    }
  }
}
