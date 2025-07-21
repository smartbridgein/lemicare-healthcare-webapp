import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Sale, Purchase } from '../models/inventory.models';

// Sale Return Interfaces
export interface SaleReturn {
  salesReturnId: string;
  originalSaleId: string;
  patientId?: string | null;
  returnDate: string | { seconds: number; nanos: number };
  netRefundAmount: number;
  reason?: string;
  totalReturnedMrp?: number;
  totalReturnedDiscount?: number;
  totalReturnedTaxable?: number;
  totalReturnedTax?: number;
  overallDiscountPercentage?: number;
  overallDiscountAmount?: number;
  items?: SaleReturnItem[];
}

export interface SaleReturnItem {
  medicineId: string;
  batchNo: string;
  returnQuantity: number;
  returnPrice?: number;
  mrpAtTimeOfSale?: number;
  discountPercentageAtSale?: number;
  lineItemReturnValue?: number;
  lineItemTaxAmount?: number;
}

export interface SaleReturnRequest {
  originalSaleId: string;
  returnDate: string;
  reason: string;
  overallDiscountPercentage?: number;
  items: SaleReturnItemDto[];
}

export interface SaleReturnItemDto {
  medicineId: string;
  batchNo: string;
  returnQuantity: number;
}

// Purchase Return Interfaces
export interface PurchaseReturn {
  purchaseReturnId: string;
  originalPurchaseId: string;
  supplierId: string;
  returnDate: string | { seconds: number; nanos: number };
  totalReturnedAmount: number;
  reason?: string;
  organizationId?: string;
  branchId?: string;
  createdBy?: string;
  items?: PurchaseReturnItem[];
}

export interface PurchaseReturnItem {
  medicineId: string;
  batchNo: string;
  returnQuantity: number;
  costAtTimeOfPurchase?: number;
  lineItemReturnValue?: number;
}

export interface PurchaseReturnRequest {
  originalPurchaseId: string;
  returnDate: string;
  supplierId: string;
  reason: string;
  items: PurchaseReturnItemDto[];
}

export interface PurchaseReturnItemDto {
  medicineId: string;
  batchNo: string;
  returnQuantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReturnsService {
  constructor(private http: HttpClient) {}

  // Helper methods for formatting IDs
  formatReturnId(id: string): string {
    if (!id) return '';
    
    // If the ID is already short (less than 8 characters), return as is
    if (id.length <= 8) return id.toUpperCase();
    
    // Otherwise, format it as RET-XXXX where XXXX is the last 4 characters
    return `RET-${id.slice(-4)}`.toUpperCase();
  }
  
  formatSaleId(id: string): string {
    if (!id) return '';
    
    // If the ID is already short (less than 8 characters), return as is
    if (id.length <= 8) return id.toUpperCase();
    
    // Otherwise, format it as SL-XXXX where XXXX is the last 4 characters
    return `SL-${id.slice(-4)}`.toUpperCase();
  }
  
  formatPurchaseId(id: string): string {
    if (!id) return '';
    
    // If the ID is already short (less than 8 characters), return as is
    if (id.length <= 8) return id.toUpperCase();
    
    // Otherwise, format it as PUR-XXXX where XXXX is the last 4 characters
    return `PUR-${id.slice(-4)}`.toUpperCase();
  }

  // API methods for returns
  createSaleReturn(returnData: SaleReturnRequest): Observable<any> {
    // Use the new API endpoint format
    return this.http.post(`${environment.apiUrlInventory}/api/inventory/returns/sale`, returnData)
      .pipe(
        tap(response => console.log('Sale return created:', response)),
        catchError(error => {
          console.error('Error creating sale return:', error);
          return of(null);
        })
      );
  }

  createPurchaseReturn(returnData: PurchaseReturnRequest): Observable<any> {
    // Use the new API endpoint format
    return this.http.post(`${environment.apiUrlInventory}/api/inventory/returns/purchase`, returnData)
      .pipe(
        tap(response => console.log('Purchase return created:', response)),
        catchError(error => {
          console.error('Error creating purchase return:', error);
          return of(null);
        })
      );
  }

  getSalesReturns(): Observable<SaleReturn[]> {
    return this.http.get<SaleReturn[]>(`${environment.apiUrlInventory}/api/inventory/returns/sales`)
      .pipe(
        tap(returns => console.log('Sales returns fetched:', returns)),
        map(returns => this.processSaleReturns(returns)),
        catchError(error => {
          console.error('Error fetching sales returns:', error);
          return of([]);
        })
      );
  }

  // Helper method to process sale returns and format dates
  private processSaleReturns(returns: SaleReturn[]): SaleReturn[] {
    return returns.map(ret => ({
      ...ret,
      returnDate: this.formatDateFromResponse(ret.returnDate)
    }));
  }

  getPurchaseReturns(): Observable<PurchaseReturn[]> {
    return this.http.get<PurchaseReturn[]>(`${environment.apiUrlInventory}/api/inventory/returns/purchases`)
      .pipe(
        tap(returns => console.log('Purchase returns fetched:', returns)),
        map(returns => this.processPurchaseReturns(returns)),
        catchError(error => {
          console.error('Error fetching purchase returns:', error);
          return of([]);
        })
      );
  }

  // Helper method to process purchase returns and format dates
  private processPurchaseReturns(returns: PurchaseReturn[]): PurchaseReturn[] {
    return returns.map(ret => ({
      ...ret,
      returnDate: this.formatDateFromResponse(ret.returnDate)
    }));
  }

  // Helper method to format date from API response
  private formatDateFromResponse(date: string | { seconds: number; nanos: number }): string {
    if (typeof date === 'string') {
      return date;
    }
    if (date && 'seconds' in date) {
      return new Date(date.seconds * 1000).toISOString();
    }
    return new Date().toISOString();
  }
  
  // Helper to format date from server response
  private formatDateToISO(dateObj: any): string {
    if (!dateObj) return new Date().toISOString();
    
    // If it's a protobuf timestamp with seconds and nanos
    if (dateObj.seconds && dateObj.nanos) {
      const milliseconds = dateObj.seconds * 1000 + dateObj.nanos / 1000000;
      return new Date(milliseconds).toISOString();
    }
    
    return new Date().toISOString();
  }
  
  // Helper method to convert protobuf timestamp to ISO string
  private convertProtobufTimestampToIsoString(timestamp: any): string {
    if (!timestamp) return new Date().toISOString();
    
    // If it's a protobuf timestamp with seconds and nanos
    if (timestamp.seconds && timestamp.nanos) {
      const milliseconds = timestamp.seconds * 1000 + timestamp.nanos / 1000000;
      return new Date(milliseconds).toISOString();
    }
    
    // If it's already a string, return it
    if (typeof timestamp === 'string') return timestamp;
    
    return new Date().toISOString();
  }
  
  // Get sale by ID by fetching all sales and filtering for the requested ID
  getSaleById(saleId: string): Observable<Sale | null> {
    console.log('Fetching sale by ID:', saleId);
    return this.http.get<Sale[]>(`${environment.apiUrlInventory}/api/inventory/sales`)
      .pipe(
        map(sales => {
          console.log(`Retrieved ${sales?.length || 0} sales, looking for ID: ${saleId}`);
          // Find the sale with the matching ID
          const normalizedSaleId = saleId.trim().toLowerCase();
          const matchingSale = sales.find(sale => {
            const currentId = (sale.saleId || sale.id || '').toLowerCase();
            return currentId === normalizedSaleId || 
                  this.formatSaleId(currentId) === normalizedSaleId;
          });
          
          if (matchingSale) {
            console.log('Sale found by ID:', matchingSale);
            // Process the sale date if it exists
            if (matchingSale.saleDate) {
              matchingSale.saleDate = this.convertProtobufTimestampToIsoString(matchingSale.saleDate);
            }
            return matchingSale;
          } else {
            console.log('No sale found with ID:', saleId);
            return null;
          }
        }),
        catchError(error => {
          console.error('Error fetching sales to find by ID:', error);
          return of(null);
        })
      );
  }

  // Search methods for sales and purchases
  searchSales(query: string, salesService: any): Observable<Sale[]> {
    console.log('Searching sales with query:', query);
    // If query is empty, return empty array
    if (!query || query.trim() === '') {
      return of([]);
    }
    
    const searchTerm = query.toLowerCase().trim();
    
    // Check if the search looks like it could be a patient search (name or phone)
    if (isNaN(Number(searchTerm)) && !searchTerm.includes('sale_') && !searchTerm.includes('-')) {
      // Could be a patient name, check patient API first
      return this.searchPatients(searchTerm).pipe(
        switchMap(patients => {
          if (patients && patients.length > 0) {
            console.log('Found matching patients:', patients);
            // Found patients, now search for sales related to these patients
            return this.getAllSalesAndFilter(searchTerm, patients);
          } else {
            // No matching patients, just do regular sale search
            return this.getAllSalesAndFilter(searchTerm);
          }
        }),
        catchError(error => {
          console.error('Error in patient search:', error);
          // Fall back to regular search
          return this.getAllSalesAndFilter(searchTerm);
        })
      );
    } else if (searchTerm.match(/^\d{10}$/)) {
      // Looks like a phone number (10 digits)
      // Try to find patients with this phone
      return this.searchPatientsByPhone(searchTerm).pipe(
        switchMap(patients => {
          if (patients && patients.length > 0) {
            console.log('Found patients by phone:', patients);
            return this.getAllSalesAndFilter(searchTerm, patients);
          } else {
            return this.getAllSalesAndFilter(searchTerm);
          }
        }),
        catchError(error => {
          console.error('Error in patient phone search:', error);
          return this.getAllSalesAndFilter(searchTerm);
        })
      );
    } else {
      // Just do a regular sale search
      return this.getAllSalesAndFilter(searchTerm);
    }
  }
  
  // Search patients by name
  private searchPatients(query: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.opdApiUrl}/api/patients`).pipe(
      map(patients => {
        console.log(`Retrieved ${patients?.length || 0} patients`);
        // Filter patients by name
        return patients.filter(patient => 
          (patient.name && patient.name.toLowerCase().includes(query.toLowerCase())) ||
          (patient.mobile && patient.mobile.toLowerCase().includes(query.toLowerCase()))
        );
      }),
      catchError(error => {
        console.error('Error searching patients:', error);
        return of([]);
      })
    );
  }
  
  // Search patients by phone
  private searchPatientsByPhone(phone: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.opdApiUrl}/api/patients`).pipe(
      map(patients => {
        // Filter patients by phone
        return patients.filter(patient => 
          patient.mobile && patient.mobile.includes(phone)
        );
      }),
      catchError(error => {
        console.error('Error searching patients by phone:', error);
        return of([]);
      })
    );
  }
  
  // Get all sales and filter locally
  private getAllSalesAndFilter(searchTerm: string, patients: Array<any> = []): Observable<Sale[]> {
    console.log('Getting all sales and filtering locally for:', searchTerm);
    console.log('With patient matches:', patients.length);
    
    return this.http.get<Sale[]>(`${environment.apiUrlInventory}/api/inventory/sales`).pipe(
      map(sales => {
        console.log('API returned', sales?.length || 0, 'sales');
        
        // Start with basic sale filtering
        let filteredSales = sales.filter(sale => 
          // Search by sale ID
          (sale.saleId && sale.saleId.toLowerCase().includes(searchTerm)) ||
          // Search by formatted sale ID
          (sale.saleId && this.formatSaleId(sale.saleId).toLowerCase().includes(searchTerm)) ||
          // Search by walk-in customer name
          (sale.walkInCustomerName && sale.walkInCustomerName.toLowerCase().includes(searchTerm)) ||
          // Search by walk-in customer mobile
          (sale.walkInCustomerMobile && sale.walkInCustomerMobile.toLowerCase().includes(searchTerm)) ||
          // Legacy fields support
          (sale.patientName && sale.patientName.toLowerCase().includes(searchTerm)) ||
          (sale.phoneNumber && sale.phoneNumber.toLowerCase().includes(searchTerm))
        );
        
        // If we have patients, also include sales for those patients
        if (patients && patients.length > 0) {
          const patientIds = patients.map(p => p.patientId || p.id);
          const patientPhones = patients.map(p => p.mobile).filter(Boolean);
          
          // Add sales that match our patient IDs or phones
          const patientSales = sales.filter(sale => 
            (sale.patientId && patientIds.includes(sale.patientId)) ||
            (sale.phoneNumber && patientPhones.includes(sale.phoneNumber))
          );
          
          // Combine the results, removing duplicates
          const combinedSaleIds = new Set<string>();
          const combinedSales: Sale[] = [];
          
          // Add direct matches first
          filteredSales.forEach(sale => {
            const saleId = sale.saleId || sale.id;
            if (saleId && !combinedSaleIds.has(saleId)) {
              combinedSaleIds.add(saleId);
              combinedSales.push(sale);
            }
          });
          
          // Then add patient matches if not already included
          patientSales.forEach(sale => {
            const saleId = sale.saleId || sale.id;
            if (saleId && !combinedSaleIds.has(saleId)) {
              combinedSaleIds.add(saleId);
              combinedSales.push(sale);
            }
          });
          
          filteredSales = combinedSales;
        }
        
        // Process dates
        filteredSales = filteredSales.map(sale => {
          if (sale.saleDate) {
            sale.saleDate = this.convertProtobufTimestampToIsoString(sale.saleDate);
          }
          return sale;
        });
        
        console.log('After filtering, found', filteredSales.length, 'matching sales');
        return filteredSales.slice(0, 10); // Limit results
      }),
      catchError(error => {
        console.error('Error searching sales:', error);
        return of([]);
      })
    );
  }
  
  searchPurchases(query: string, purchaseService: any): Observable<Purchase[]> {
    // If query is empty, return empty array
    if (!query || query.trim() === '') {
      return of([]);
    }
    
    const searchTerm = query.toLowerCase().trim();
    
    // Search by purchase ID or supplier name
    return purchaseService.getPurchases().pipe(
      map((purchases: Purchase[]) => purchases.filter((purchase: Purchase) => 
        (purchase.id && purchase.id.toLowerCase().includes(searchTerm)) ||
        (purchase.id && this.formatPurchaseId(purchase.id).toLowerCase().includes(searchTerm)) ||
        (purchase.supplier && purchase.supplier.name && 
         purchase.supplier.name.toLowerCase().includes(searchTerm))
      )),
      // Limit results to first 10
      map((purchases: Purchase[]) => purchases.slice(0, 10))
    );
  }
}
