export interface BillingBase {
  id?: string;
  patientId: string;
  patientName: string;
  date: string;
  amount: number;
  createdBy: string;
  modeOfPayment: PaymentMode;
  serviceType?: string;
  serviceName?: string;
  createdDate?: string;
}

export interface CashMemo extends BillingBase {
  billId?: string;
  taxation?: string;
  category?: string;
  package?: string;
  account?: string;
  referenceNo?: string;
  notes?: string;
  overallDiscount?: number;
  discountType?: string;
  lineItems?: LineItem[];
  
  // Tax-related fields
  totalTax?: number;
  taxBreakdown?: TaxBreakdownItem[];
  grandTotal?: number; // Total amount including taxes
}

export interface TaxBreakdownItem {
  name: string;
  amount: number;
}

export interface Invoice extends BillingBase {
  invoiceId?: string;
  status?: 'PAID' | 'UNPAID' | 'PARTIAL';
  paidAmount?: number;
  balanceAmount?: number;
  grandTotal?: number; // Total invoice amount including taxes
}

export interface Receipt extends BillingBase {
  receiptId?: string;
  invoiceId?: string;
  referenceId?: string;
  purpose?: string;
}

export interface Advance extends BillingBase {
  advanceId?: string;
  purpose: string;
  referenceId?: string;
  notes?: string;
}

export interface CreditNote extends BillingBase {
  creditNoteId?: string;
  reason: string;
}

export interface Refund extends BillingBase {
  refundId?: string;
  reason: string;
  referenceId?: string;
}

export type PaymentMode = 'CASH' | 'CARD' | 'ONLINE' | 'UPI' | 'CHEQUE' | 'BANK_TRANSFER';

export interface LineItem {
  id?: string;
  date: string;
  serviceId: string;
  serviceName?: string;
  serviceGroup?: string;
  description: string;
  incentive?: string;
  quantity: number;
  rate: number;
  discount?: number;
  taxProfileId?: string;
  taxInfo?: {
    taxProfileName: string;
    taxRate: number;
  };
  totalAmount: number;
}

export interface InvoiceItem {
  id?: string;
  invoiceId?: string;
  serviceDate: string;
  serviceType?: string;
  serviceDescription: string;
  incentive?: string;
  quantity: number;
  rate: number;
  amount: number;
  discount?: number;
  tax?: number;
  totalAmount: number;
}

export interface BillingDashboardStats {
  totalCashMemos: number;
  totalInvoices: number;
  totalReceipts: number;
  totalAdvances: number;
}

export interface RevenueStats {
  totalRevenue: number;
  invoicesRevenue: number;
  cashMemosRevenue: number;
  receiptsRevenue: number;
  periodLabel: string;
}

export interface CategoryRevenueItem {
  category: string;
  revenue: number;
  count: number;
}

export interface CategoryReport {
  categories: CategoryRevenueItem[];
  totalRevenue: number;
  totalCount: number;
  periodLabel: string;
}

export type RevenuePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year';

export interface TaxComponent {
  name: string;
  rate: number;
}

export interface TaxProfile {
  taxProfileId: string;
  profileName: string;
  totalRate: number;
  components: TaxComponent[];
}
