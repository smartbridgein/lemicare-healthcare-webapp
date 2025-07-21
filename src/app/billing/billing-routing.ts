import { Routes } from '@angular/router';
import { BillingDashboardComponent } from './billing-dashboard/billing-dashboard.component';
import { InvoiceListComponent } from './invoice-list/invoice-list.component';
import { InvoiceFormComponent } from './invoice-form/invoice-form.component';
import { CashMemoListComponent } from './cash-memo-list/cash-memo-list.component';
import { CashMemoFormComponent } from './cash-memo-form/cash-memo-form.component';
import { ReceiptListComponent } from './receipt-list/receipt-list.component';
import { ReceiptFormComponent } from './receipt-form/receipt-form.component';
import { PaymentFormComponent } from './payment-form/payment-form.component';
import { AdvanceFormComponent } from './advance-form/advance-form.component';
import { AdvanceListComponent } from './advance-list/advance-list.component';
import { AuthGuard } from '../auth/shared/auth.guard';

export const BILLING_ROUTES: Routes = [
  {
    path: '',
    component: BillingDashboardComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'invoices',
    component: InvoiceListComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'invoices/new',
    component: InvoiceFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'invoices/edit/:id',
    component: InvoiceFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'invoices/:id',
    component: InvoiceFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'cash-memos',
    component: CashMemoListComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'cash-memos/new',
    component: CashMemoFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'cash-memos/:id',
    component: CashMemoFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'receipts',
    component: ReceiptListComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'receipts/new',
    component: ReceiptFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'receipts/:id',
    component: ReceiptFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'payment/:invoiceId',
    component: PaymentFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'advances',
    component: AdvanceListComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'advances/new',
    component: AdvanceFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'advances/:id',
    component: AdvanceFormComponent,
    canActivate: [AuthGuard]
  }
];
