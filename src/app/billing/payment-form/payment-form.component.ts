import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BillingService } from '../shared/billing.service';
import { Invoice, Receipt } from '../shared/billing.model';

@Component({
  selector: 'app-payment-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './payment-form.component.html',
  styleUrls: ['./payment-form.component.scss']
})
export class PaymentFormComponent implements OnInit {
  paymentForm!: FormGroup;
  invoiceId: string | null = null;
  invoice: Invoice | null = null;
  loading = false;
  submitted = false;
  
  constructor(
    private fb: FormBuilder,
    private billingService: BillingService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.createForm();
    
    this.invoiceId = this.route.snapshot.paramMap.get('invoiceId');
    if (this.invoiceId) {
      this.loadInvoice(this.invoiceId);
    } else {
      alert('No invoice ID provided');
      this.router.navigate(['/billing/invoices']);
    }
  }

  createForm(): void {
    this.paymentForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(0.01)]],
      modeOfPayment: ['CASH', [Validators.required]],
      referenceId: [''],
      date: [this.formatDate(new Date()), [Validators.required]],
      notes: ['']
    });
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  loadInvoice(id: string): void {
    this.loading = true;
    this.billingService.getInvoiceById(id).subscribe({
      next: (invoice) => {
        this.invoice = invoice;
        
        // Set default payment amount to balance
        this.paymentForm.patchValue({
          amount: invoice.balanceAmount || invoice.amount
        });
        
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading invoice', error);
        this.loading = false;
        alert('Failed to load invoice');
        this.router.navigate(['/billing/invoices']);
      }
    });
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.paymentForm.invalid || !this.invoice) {
      return;
    }
    
    const paymentAmount = +this.paymentForm.value.amount;
    
    // Validate payment amount against balance
    const balanceAmount = this.invoice.balanceAmount || this.invoice.amount;
    if (paymentAmount > balanceAmount) {
      alert(`Payment amount cannot exceed the balance amount (₹${balanceAmount})`);
      return;
    }
    
    this.loading = true;
    
    // Create receipt for the payment
    const receipt: Receipt = {
      patientId: this.invoice.patientId,
      patientName: this.invoice.patientName,
      date: this.paymentForm.value.date,
      amount: paymentAmount,
      createdBy: 'System',
      modeOfPayment: this.paymentForm.value.modeOfPayment,
      receiptId: 'RCPT-' + Math.floor(1000 + Math.random() * 9000),
      invoiceId: this.invoiceId || undefined,
      referenceId: this.paymentForm.value.referenceId || undefined
    };
    
    this.billingService.createReceipt(receipt).subscribe({
      next: () => {
        // Update the invoice status and balance
        this.updateInvoice(paymentAmount);
      },
      error: (error) => {
        console.error('Error creating receipt', error);
        this.loading = false;
        alert('Payment failed');
      }
    });
  }

  updateInvoice(paidAmount: number): void {
    if (!this.invoice || !this.invoiceId) return;
    
    const currentPaidAmount = this.invoice.paidAmount || 0;
    const newPaidAmount = currentPaidAmount + paidAmount;
    const newBalanceAmount = Math.max(0, this.invoice.amount - newPaidAmount);
    
    // Determine new status
    let newStatus = 'UNPAID';
    if (newBalanceAmount <= 0) {
      newStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      newStatus = 'PARTIAL';
    }
    
    const updatedInvoice = {
      ...this.invoice,
      paidAmount: newPaidAmount,
      balanceAmount: newBalanceAmount,
      status: newStatus
    };
    
    this.billingService.updateInvoice(this.invoiceId, updatedInvoice).subscribe({
      next: () => {
        this.loading = false;
        alert('Payment processed successfully');
        this.router.navigate(['/billing/invoices', this.invoiceId]);
      },
      error: (error) => {
        console.error('Error updating invoice', error);
        this.loading = false;
        alert('Payment recorded but failed to update invoice status');
        this.router.navigate(['/billing/invoices']);
      }
    });
  }

  cancelPayment(): void {
    if (this.invoiceId) {
      this.router.navigate(['/billing/invoices', this.invoiceId]);
    } else {
      this.router.navigate(['/billing/invoices']);
    }
  }
}
