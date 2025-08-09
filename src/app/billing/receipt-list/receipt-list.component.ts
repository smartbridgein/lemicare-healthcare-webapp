import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../shared/billing.service';
import { Receipt } from '../shared/billing.model';
import { AuthService, UserProfile } from '../../auth/shared/auth.service';

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

  // Permission properties
  isSuperAdmin = false;
  private user: UserProfile | null = null;

  constructor(
    private billingService: BillingService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadUserPermissions();
    this.loadReceipts();
  }

  /**
   * Check if current user has super admin permissions
   * Only super admin can delete receipts
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
      
      console.log('Receipt List Permissions:', {
        email,
        role,
        isSuperAdmin: this.isSuperAdmin
      });
    }
  }

  loadReceipts(): void {
    this.loading = true;
    this.billingService.getAllReceipts().subscribe({
      next: (data: Receipt[]) => {
        this.receipts = data;
        this.filterReceipts();
        this.loading = false;
      },
      error: (error: any) => {
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
        error: (error: any) => {
          console.error('Error deleting receipt', error);
          alert('Failed to delete receipt');
        }
      });
    }
  }
}
