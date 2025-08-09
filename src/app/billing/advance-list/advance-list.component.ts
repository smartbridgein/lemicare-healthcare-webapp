import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../shared/billing.service';
import { Advance } from '../shared/billing.model';
import { AuthService, UserProfile } from '../../auth/shared/auth.service';

@Component({
  selector: 'app-advance-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './advance-list.component.html',
  styleUrls: ['./advance-list.component.scss']
})
export class AdvanceListComponent implements OnInit {
  advances: Advance[] = [];
  filteredAdvances: Advance[] = [];
  searchTerm = '';
  loading = false;
  totalAmount = 0;
  todayCount = 0;
  todayAmount = 0;
  
  // Permission properties
  isSuperAdmin = false;
  private user: UserProfile | null = null;
  
  constructor(
    private billingService: BillingService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.loadUserPermissions();
    this.loadAdvances();
  }
  
  /**
   * Check if current user has super admin permissions
   * Only super admin can delete advances
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
      
      console.log('Advance List Permissions:', {
        email,
        role,
        isSuperAdmin: this.isSuperAdmin
      });
    }
  }

  loadAdvances(): void {
    this.billingService.getAllAdvances().subscribe({
      next: (data: Advance[]) => {
        this.advances = data;
        this.filteredAdvances = [...this.advances];
        this.calculateSummary();
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading advance payments', error);
        this.loading = false;
      }
    });
  }

  calculateSummary(): void {
    const today = new Date();
    const todayStr = this.formatDate(today);
    
    this.totalAmount = this.advances.reduce((sum, advance) => sum + advance.amount, 0);
    
    const todayAdvances = this.advances.filter(advance => {
      const advanceDate = this.formatDate(new Date(advance.date));
      return advanceDate === todayStr;
    });
    
    this.todayCount = todayAdvances.length;
    this.todayAmount = todayAdvances.reduce((sum, advance) => sum + advance.amount, 0);
  }
  
  formatDate(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  applyFilter(): void {
    if (!this.searchTerm) {
      this.filteredAdvances = [...this.advances];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredAdvances = this.advances.filter(advance => 
        advance.patientName?.toLowerCase().includes(term) || 
        advance.patientId?.toLowerCase().includes(term) || 
        advance.advanceId?.toLowerCase().includes(term) ||
        advance.purpose?.toLowerCase().includes(term)
      );
    }
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filteredAdvances = [...this.advances];
  }

  deleteAdvance(id: string | undefined): void {
    if (!id) {
      console.error('Cannot delete advance: ID is undefined');
      return;
    }
    
    if (confirm('Are you sure you want to delete this advance payment?')) {
      this.billingService.deleteAdvance(id).subscribe({
        next: () => {
          this.advances = this.advances.filter(advance => advance.id !== id);
          this.filteredAdvances = this.filteredAdvances.filter(advance => advance.id !== id);
          this.calculateSummary();
        },
        error: (error) => console.error('Error deleting advance payment', error)
      });
    }
  }
  
  calculateTotalAmount(): string {
    if (!this.filteredAdvances || this.filteredAdvances.length === 0) {
      return '0.00';
    }
    
    const total = this.filteredAdvances.reduce((sum, advance) => {
      return sum + (Number(advance.amount) || 0);
    }, 0);
    
    return total.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    });
  }
}
