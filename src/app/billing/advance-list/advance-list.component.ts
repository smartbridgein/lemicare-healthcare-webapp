import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../shared/billing.service';
import { Advance } from '../shared/billing.model';

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
  
  constructor(private billingService: BillingService) {}

  ngOnInit(): void {
    this.loading = true;
    this.loadAdvances();
  }

  loadAdvances(): void {
    this.billingService.getAllAdvances().subscribe({
      next: (data) => {
        this.advances = data;
        this.filteredAdvances = [...this.advances];
        this.calculateSummary();
        this.loading = false;
      },
      error: (error) => {
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
