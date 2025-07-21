import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, catchError, throwError, forkJoin, of } from 'rxjs';
import { 
  CashMemo, 
  Invoice, 
  Receipt, 
  Advance, 
  RevenueStats, 
  RevenuePeriod, 
  CategoryReport, 
  BillingBase,
  TaxProfile 
} from './billing.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BillingService {
  private apiUrl = environment.billingApiUrl;

  constructor(private http: HttpClient) { }

  // Cash Memo APIs
  createCashMemo(cashMemoData: CashMemo): Observable<CashMemo> {
    console.log('Creating cash memo with data:', cashMemoData);
    console.log('API URL:', `${this.apiUrl}/api/billing/cash-memo`);
    
    return this.http.post<ApiResponse<CashMemo>>(`${this.apiUrl}/api/billing/cash-memo`, cashMemoData)
      .pipe(
        map(response => {
          console.log('Create cash memo response:', response);
          return response.data;
        }),
        catchError(error => {
          console.error('Error creating cash memo:', error);
          return throwError(() => error);
        })
      );
  }

  getAllCashMemos(): Observable<CashMemo[]> {
    return this.http.get<ApiResponse<CashMemo[]>>(`${this.apiUrl}/api/billing/cash-memo`)
      .pipe(
        map(response => response.data),
        catchError(error => {
          console.error('Error fetching all cash memos:', error);
          return throwError(() => error);
        })
      );
  }

  getCashMemoById(id: string): Observable<CashMemo> {
    return this.http.get<ApiResponse<CashMemo>>(`${this.apiUrl}/api/billing/cash-memo/${id}`)
      .pipe(
        map(response => response.data),
        catchError(error => {
          console.error(`Error fetching cash memo with ID ${id}:`, error);
          return throwError(() => error);
        })
      );
  }

  getCashMemosByPatient(patientId: string): Observable<CashMemo[]> {
    return this.http.get<ApiResponse<CashMemo[]>>(`${this.apiUrl}/api/billing/cash-memo/patient/${patientId}`)
      .pipe(
        map(response => response.data),
        catchError(error => {
          console.error(`Error fetching cash memos for patient ${patientId}:`, error);
          return throwError(() => error);
        })
      );
  }

  updateCashMemo(id: string, cashMemoData: CashMemo): Observable<CashMemo> {
    console.log(`Updating cash memo with ID ${id} with data:`, cashMemoData);
    
    return this.http.put<ApiResponse<CashMemo>>(`${this.apiUrl}/api/billing/cash-memo/${id}`, cashMemoData)
      .pipe(
        map(response => {
          console.log('Update cash memo response:', response);
          return response.data;
        }),
        catchError(error => {
          console.error(`Error updating cash memo with ID ${id}:`, error);
          return throwError(() => error);
        })
      );
  }

  deleteCashMemo(id: string): Observable<any> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/api/billing/cash-memo/${id}`)
      .pipe(map(response => response.data));
  }

  // Invoice APIs
  createInvoice(invoiceData: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/api/billing/invoice`, invoiceData)
      .pipe(map(response => response.data));
  }

  getAllInvoices(): Observable<any> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/api/billing/invoice`)
      .pipe(map(response => response.data));
  }

  getInvoiceById(id: string): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/api/billing/invoice/${id}`)
      .pipe(map(response => response.data));
  }

  getInvoicesByPatient(patientId: string): Observable<any> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/api/billing/invoice/patient/${patientId}`)
      .pipe(map(response => response.data));
  }

  updateInvoice(id: string, invoiceData: any): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.apiUrl}/api/billing/invoice/${id}`, invoiceData)
      .pipe(map(response => response.data));
  }

  deleteInvoice(id: string): Observable<any> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/api/billing/invoice/${id}`)
      .pipe(map(response => response.data));
  }

  // Receipt APIs
  createReceipt(receiptData: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/api/billing/receipt`, receiptData)
      .pipe(map(response => response.data));
  }

  getAllReceipts(): Observable<any> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/api/billing/receipt`)
      .pipe(map(response => response.data));
  }

  getReceiptById(id: string): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/api/billing/receipt/${id}`)
      .pipe(map(response => response.data));
  }

  getReceiptsByPatient(patientId: string): Observable<any> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/api/billing/receipt/patient/${patientId}`)
      .pipe(map(response => response.data));
  }

  updateReceipt(id: string, receiptData: any): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.apiUrl}/api/billing/receipt/${id}`, receiptData)
      .pipe(map(response => response.data));
  }

  deleteReceipt(id: string): Observable<any> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/api/billing/receipt/${id}`)
      .pipe(map(response => response.data));
  }

  // Advance APIs
  createAdvance(advanceData: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/api/billing/advance`, advanceData)
      .pipe(map(response => response.data));
  }

  getAllAdvances(): Observable<any> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/api/billing/advance`)
      .pipe(map(response => response.data));
  }

  getAdvanceById(id: string): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/api/billing/advance/${id}`)
      .pipe(map(response => response.data));
  }

  getAdvancesByPatient(patientId: string): Observable<any> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/api/billing/advance/patient/${patientId}`)
      .pipe(map(response => response.data));
  }

  updateAdvance(id: string, advanceData: any): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.apiUrl}/api/billing/advance/${id}`, advanceData)
      .pipe(map(response => response.data));
  }

  deleteAdvance(id: string): Observable<any> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/api/billing/advance/${id}`)
      .pipe(map(response => response.data));
  }

  // Credit Note APIs
  createCreditNote(creditNoteData: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/api/billing/credit-note`, creditNoteData)
      .pipe(map(response => response.data));
  }

  getAllCreditNotes(): Observable<any> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/api/billing/credit-note`)
      .pipe(map(response => response.data));
  }

  getCreditNoteById(id: string): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/api/billing/credit-note/${id}`)
      .pipe(map(response => response.data));
  }

  getCreditNotesByPatient(patientId: string): Observable<any> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/api/billing/credit-note/patient/${patientId}`)
      .pipe(map(response => response.data));
  }

  updateCreditNote(id: string, creditNoteData: any): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.apiUrl}/api/billing/credit-note/${id}`, creditNoteData)
      .pipe(map(response => response.data));
  }

  deleteCreditNote(id: string): Observable<any> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/api/billing/credit-notes/${id}`)
      .pipe(map(response => response.data));
  }
  
  // Revenue dashboard methods
  getRevenueStats(period: RevenuePeriod = 'today'): Observable<RevenueStats> {
    return forkJoin({
      invoices: this.getAllInvoices(),
      cashMemos: this.getAllCashMemos(),
      receipts: this.getAllReceipts()
    }).pipe(
      map(result => {
        const { startDate, endDate, periodLabel } = this.getDateRangeForPeriod(period);
        
        // Filter items by date range
        const filteredInvoices = this.filterByDateRange(result.invoices, startDate, endDate);
        const filteredCashMemos = this.filterByDateRange(result.cashMemos, startDate, endDate);
        const filteredReceipts = this.filterByDateRange(result.receipts, startDate, endDate);
        
        // Calculate revenue from each source
        const invoicesRevenue = this.calculateTotalAmount(filteredInvoices);
        const cashMemosRevenue = this.calculateTotalAmount(filteredCashMemos);
        const receiptsRevenue = this.calculateTotalAmount(filteredReceipts);
        
        // Total consolidated revenue
        const totalRevenue = invoicesRevenue + cashMemosRevenue + receiptsRevenue;
        
        return {
          totalRevenue,
          invoicesRevenue,
          cashMemosRevenue,
          receiptsRevenue,
          periodLabel
        };
      }),
      catchError(error => {
        console.error('Error calculating revenue stats:', error);
        return of({
          totalRevenue: 0,
          invoicesRevenue: 0,
          cashMemosRevenue: 0,
          receiptsRevenue: 0,
          periodLabel: this.getDateRangeForPeriod(period).periodLabel
        });
      })
    );
  }
  
  private getDateRangeForPeriod(period: RevenuePeriod): { startDate: Date, endDate: Date, periodLabel: string } {
    const today = new Date();
    const endDate = new Date(today);
    let startDate = new Date(today);
    let periodLabel = '';
    
    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        periodLabel = 'Today';
        break;
      
      case 'week':
        // Start of current week (Sunday)
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek;
        startDate = new Date(today.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        periodLabel = 'This Week';
        break;
      
      case 'month':
        // Start of current month
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        periodLabel = 'This Month';
        break;
      
      case 'quarter':
        // Start of current quarter
        const quarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), quarter * 3, 1);
        periodLabel = `Q${quarter + 1} ${today.getFullYear()}`;
        break;
      
      case 'year':
        // Start of current year
        startDate = new Date(today.getFullYear(), 0, 1);
        periodLabel = today.getFullYear().toString();
        break;
    }
    
    // End of the current day
    endDate.setHours(23, 59, 59, 999);
    
    return { startDate, endDate, periodLabel };
  }
  
  private filterByDateRange<T extends BillingBase>(items: T[], startDate: Date, endDate: Date): T[] {
    return items.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate;
    });
  }
  
  private calculateTotalAmount(items: BillingBase[]): number {
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }
  
  /**
   * Fetches tax profiles from the inventory service
   * @returns Observable of TaxProfile array
   */
  getTaxProfiles(): Observable<TaxProfile[]> {
    return this.http.get<TaxProfile[]>(`${this.apiUrl}/api/inventory/masters/tax-profiles`)
      .pipe(
        catchError(error => {
          console.error('Error fetching tax profiles:', error);
          return throwError(() => error);
        })
      );
  }
  
  /**
   * Generates a report of revenue by service categories
   * @param period The time period to filter the data
   * @returns Observable of CategoryReport
   */
  getCategoryReport(period: RevenuePeriod = 'today'): Observable<CategoryReport> {
    // For category report, we primarily use invoices and cash memos (receipts usually don't have categories)
    return forkJoin({
      invoices: this.getAllInvoices(),
      cashMemos: this.getAllCashMemos()
    }).pipe(
      map(result => {
        const { startDate, endDate, periodLabel } = this.getDateRangeForPeriod(period);
        const filteredInvoices = this.filterByDateRange(result.invoices, startDate, endDate);
        const filteredCashMemos = this.filterByDateRange(result.cashMemos, startDate, endDate);
        
        // Combine both sources for category analysis
        const allBillings = [...filteredInvoices, ...filteredCashMemos];
        
        // Extract and count categories
        const categoryMap = new Map<string, { revenue: number, count: number }>();
        
        allBillings.forEach(billing => {
          // Use service name or type as category
          // If no service name exists, use 'Uncategorized'
          const category = billing.serviceType || billing.serviceName || 'Uncategorized';
          
          const currentCategory = categoryMap.get(category) || { revenue: 0, count: 0 };
          currentCategory.revenue += Number(billing.amount) || 0;
          currentCategory.count += 1;
          
          categoryMap.set(category, currentCategory);
        });
        
        // Convert map to array of CategoryRevenueItem
        const categories = Array.from(categoryMap.entries())
          .map(([category, data]) => ({
            category,
            revenue: data.revenue,
            count: data.count
          }))
          // Sort by revenue (highest first)
          .sort((a, b) => b.revenue - a.revenue);
        
        const totalRevenue = categories.reduce((sum, item) => sum + item.revenue, 0);
        const totalCount = categories.reduce((sum, item) => sum + item.count, 0);
        
        return {
          categories,
          totalRevenue,
          totalCount,
          periodLabel
        };
      }),
      catchError(error => {
        console.error('Error generating category report:', error);
        return of({
          categories: [],
          totalRevenue: 0,
          totalCount: 0,
          periodLabel: this.getDateRangeForPeriod(period).periodLabel
        });
      })
    );
  }
  
  // Get today's revenue from cash memos and invoices
  getTodaysRevenue(): Observable<number> {
    const today = new Date().toISOString().split('T')[0];
    return forkJoin({
      cashMemos: this.getTodaysCashMemos(),
      invoices: this.getTodaysInvoices()
    }).pipe(
      map(({ cashMemos, invoices }) => {
        // Calculate total revenue from cash memos
        const cashMemoTotal = cashMemos.reduce((sum, memo) => sum + (memo.grandTotal || 0), 0);
        
        // Calculate total revenue from invoices
        const invoiceTotal = invoices.reduce((sum, invoice) => sum + (invoice.grandTotal || 0), 0);
        
        // Return combined total
        return cashMemoTotal + invoiceTotal;
      }),
      catchError(error => {
        console.error('Error calculating today\'s revenue:', error);
        return of(0); // Return 0 if there's an error
      })
    );
  }
  
  // Get today's cash memos
  getTodaysCashMemos(): Observable<CashMemo[]> {
    const today = new Date().toISOString().split('T')[0];
    // Format for the date filter: 2023-07-15
    return this.http.get<ApiResponse<CashMemo[]>>(`${this.apiUrl}/api/billing/cash-memo?date=${today}`)
      .pipe(
        map(response => response.data),
        catchError(error => {
          console.error('Error fetching today\'s cash memos:', error);
          return of([]);
        })
      );
  }
  
  // Get today's invoices
  getTodaysInvoices(): Observable<Invoice[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.http.get<ApiResponse<Invoice[]>>(`${this.apiUrl}/api/billing/invoice?date=${today}`)
      .pipe(
        map(response => response.data),
        catchError(error => {
          console.error('Error fetching today\'s invoices:', error);
          return of([]);
        })
      );
  }
}
