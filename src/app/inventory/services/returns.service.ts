import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap, switchMap, take } from 'rxjs/operators';
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
  refundAmount: number;
  overallDiscountPercentage?: number;
  refundMode: string;
  refundReference?: string;
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

  // Cache for medicines to improve performance
  private medicineCache: Map<string, any> = new Map();
  private medicinesLoadedSubject = new BehaviorSubject<boolean>(false);
  private medicinesLoaded$ = this.medicinesLoadedSubject.asObservable();
  
  /**
   * Fetch all medicines from master API with caching for performance
   * @returns Observable of all medicines
   */
  fetchMedicines(): Observable<any[]> {
    // Return cached medicines if available
    if (this.medicineCache.size > 0) {
      return of(Array.from(this.medicineCache.values()));
    }
    
    // If not cached, fetch from API
    console.log('Fetching medicines from API');
    return this.http.get<any[]>(`${environment.apiUrlInventory}/api/inventory/masters/medicines`).pipe(
      tap(medicines => {
        console.log(`Caching ${medicines.length} medicines for faster lookup`);
        // Cache medicines by ID for quick lookups
        medicines.forEach(medicine => {
          this.medicineCache.set(medicine.medicineId, medicine);
        });
        this.medicinesLoadedSubject.next(true);
      }),
      catchError(error => {
        console.error('Error fetching medicines:', error);
        return of([]);
      })
    );
  }
  
  /**
   * Get medicine by ID (with caching)
   * @param medicineId Medicine ID to look up
   * @returns Observable of the medicine
   */
  getMedicineById(medicineId: string): Observable<any> {
    // Return from cache if available
    if (this.medicineCache.has(medicineId)) {
      return of(this.medicineCache.get(medicineId));
    }
    
    // Check if medicines are already loaded
    return this.medicinesLoaded$.pipe(
      take(1),
      switchMap(loaded => {
        if (loaded) {
          // Medicines are loaded but this one isn't in cache
          return of(null);
        } else {
          // Medicines aren't loaded yet, load them first
          return this.fetchMedicines().pipe(
            map(() => this.medicineCache.get(medicineId) || null)
          );
        }
      })
    );
  }

  /**
   * Enrich sale items with medicine names from master data - optimized with caching
   * @param sale The sale to enrich
   * @returns Observable of enriched sale
   */
  enrichSaleWithMedicineNames(sale: Sale): Observable<Sale> {
    if (!sale.items || sale.items.length === 0) {
      return of(sale);
    }

    // Prefetch all medicines if not already cached
    if (this.medicineCache.size === 0) {
      // Preload cache with all medicines in background
      this.fetchMedicines().subscribe();
    }

    // First check which medicineIds aren't in cache
    const uncachedIds = sale.items
      .filter(item => item.medicineId && !this.medicineCache.has(item.medicineId))
      .map(item => item.medicineId);

    // If all medicines are cached, use fast path
    if (uncachedIds.length === 0) {
      console.log('All medicines found in cache, using fast path');
      return of(this.enrichSaleFromCache(sale));
    }

    // Otherwise, fetch medicines first then enrich
    console.log(`${uncachedIds.length} medicines not in cache, fetching first`);
    return this.fetchMedicines().pipe(
      map(() => this.enrichSaleFromCache(sale)),
      catchError(error => {
        console.error('Error enriching sale with medicine names:', error);
        // Return sale with fallback names if fetch fails
        return of(this.enrichSaleWithFallbackNames(sale));
      })
    );
  }

  /**
   * Enriches sale with medicine names from cache (no API calls)
   * @param sale Sale to enrich
   * @returns Enriched sale object
   */
  private enrichSaleFromCache(sale: Sale): Sale {
    // Quick path using cached medicine data
    const updatedItems = sale.items.map(item => {
      if (!item.medicineId) return item;
      
      // Get medicine from cache
      const medicine = this.medicineCache.get(item.medicineId);
      
      if (medicine) {
        // Use cached medicine data
        item.medicineName = medicine.name;
        if (!item.medicine) {
          item.medicine = { 
            id: medicine.medicineId, 
            name: medicine.name 
          };
        } else {
          item.medicine.name = medicine.name;
        }
      } else {
        // Use fallback for cache misses
        this.applyFallbackMedicineName(item);
      }
      
      return item;
    });

    // Update sale items
    sale.items = updatedItems;
    return sale;
  }

  /**
   * Applies fallback medicine names when API or cache lookup fails
   * @param sale Sale to apply fallbacks to
   * @returns Sale with fallback medicine names
   */
  private enrichSaleWithFallbackNames(sale: Sale): Sale {
    const updatedItems = sale.items.map(item => {
      this.applyFallbackMedicineName(item);
      return item;
    });
    
    sale.items = updatedItems;
    return sale;
  }

  /**
   * Helper to apply fallback medicine name to a sale item
   * @param item Sale item to update
   */
  private applyFallbackMedicineName(item: any): void {
    const idPart = item.medicineId ? item.medicineId.split('_')[1] || item.medicineId : '';
    const fallbackName = `Medicine ${idPart.substring(0, 8)}`;
    
    item.medicineName = fallbackName;
    if (!item.medicine) {
      item.medicine = { id: item.medicineId, name: fallbackName };
    } else {
      item.medicine.name = fallbackName;
    }
  }

  /**
   * Search for sales by query string
   * @param query Search query (sale ID, customer name, etc.)
   * @returns Observable of filtered sales
   */
  searchSales(query: string): Observable<Sale[]> {
    if (!query || query.trim() === '') {
      return of([]);
    }
    
    const searchTerm = query.toLowerCase().trim();
    console.log('Searching sales with term:', searchTerm);
    
    // Use direct API endpoint to get sales
    return this.http.get<any[]>(`${environment.apiUrlInventory}/api/inventory/sales/`).pipe(
      map(apiSales => {
        console.log('API returned', apiSales?.length || 0, 'sales');
        
        // Map API response to Sale model
        const sales = apiSales.map((s: any) => this.mapApiSaleToModel(s));
        
        // Filter by sale ID, patient name, mobile, etc.
        const filteredSales = sales.filter(sale => 
          // Search by sale ID
          (sale.saleId && sale.saleId.toLowerCase().includes(searchTerm)) ||
          // Search by formatted sale ID
          (sale.saleId && this.formatSaleId(sale.saleId).toLowerCase().includes(searchTerm)) ||
          // Search by walk-in customer name
          (sale.walkInCustomerName && sale.walkInCustomerName.toLowerCase().includes(searchTerm)) ||
          // Search by walk-in customer mobile
          (sale.walkInCustomerMobile && sale.walkInCustomerMobile.toLowerCase().includes(searchTerm)) ||
          // Search by patient name
          (sale.patientName && sale.patientName.toLowerCase().includes(searchTerm)) ||
          // Search by patient mobile
          (sale.patientMobile && sale.patientMobile.toLowerCase().includes(searchTerm)) ||
          // Search by doctor name
          (sale.doctorName && sale.doctorName.toLowerCase().includes(searchTerm))
        );
        
        console.log('After filtering, found', filteredSales.length, 'matching sales');
        return filteredSales.slice(0, 10); // Limit results
      }),
      catchError(error => {
        console.error('Error searching sales:', error);
        return of([]);
      })
    );
  }
  
  // Removed duplicate formatSaleId and mapApiSaleToModel functions
  // These are already defined elsewhere in the file
  
  // Removed duplicate searchPatients and searchPatientsByPhone functions
  // These methods are already defined elsewhere in the file
  
  // Get all sales and filter locally
  /**
   * Maps API sale response to Sale model
   * @param apiSale Sale data from API
   * @returns Mapped Sale object
   */
  private mapApiSaleToModel(apiSale: any): Sale {
    // Convert dates from protobuf timestamp format if needed
    const saleDate = apiSale.saleDate ? 
      this.convertProtobufTimestampToIsoString(apiSale.saleDate) : 
      undefined;
    
    return {
      id: apiSale.id || apiSale.saleId,
      saleId: apiSale.id || apiSale.saleId,
      saleType: apiSale.saleType || 'REGULAR', // Add default value for required field
      saleDate: saleDate,
      patientId: apiSale.patientId,
      patientName: apiSale.patientName,
      patientMobile: apiSale.patientMobile || apiSale.phoneNumber,
      walkInCustomerName: apiSale.walkInCustomerName,
      walkInCustomerMobile: apiSale.walkInCustomerMobile,
      doctorId: apiSale.doctorId,
      doctorName: apiSale.doctorName,
      paymentMode: apiSale.paymentMode,
      paymentStatus: apiSale.paymentStatus,
      transactionReference: apiSale.transactionReference,
      subtotal: apiSale.subtotal,
      totalDiscount: apiSale.totalDiscount,
      totalTax: apiSale.totalTax,
      grandTotal: apiSale.grandTotal,
      items: Array.isArray(apiSale.items) ? apiSale.items.map((item: any) => {
        // Generate medicine name from ID if not available
        const medicineIdShort = item.medicineId ? item.medicineId.split('_')[1]?.substring(0, 8) : '';
        const medicineName = item.medicineName || `Medicine ${medicineIdShort || ''}`;
        
        return {
          medicineId: item.medicineId,
          // Create medicine object with name for display purposes
          medicine: item.medicine || { id: item.medicineId, name: medicineName },
          medicineName: medicineName,
          batchNo: item.batchNo || '',
          quantity: item.quantity,
          unitPrice: item.mrpPerItem || item.unitPrice || 0,
          mrp: item.mrpPerItem || item.unitPrice || 0,
          discountPercentage: item.discountPercentage || 0,
          taxPercentage: item.taxPercentage || 0,
          expiryDate: item.expiryDate ? this.convertProtobufTimestampToIsoString(item.expiryDate) : undefined,
          total: item.total || item.lineItemTotalAmount || item.lineItemAmount || 0
        };
      }) : [],
      gstType: apiSale.gstType,
      printGst: apiSale.printGst,
      createdAt: apiSale.createdAt ? this.convertProtobufTimestampToIsoString(apiSale.createdAt) : undefined,
      organizationId: apiSale.organizationId,
      branchId: apiSale.branchId,
      notes: apiSale.notes
    };
  }
  
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
    
    // Use direct API endpoint to get purchases
    return this.http.get<any[]>(`${environment.apiUrlInventory}/api/inventory/purchases/`).pipe(
      map(apiPurchases => {
        console.log('API returned', apiPurchases?.length || 0, 'purchases');
        
        // Map API response to Purchase model
        const purchases = apiPurchases.map(p => this.mapApiPurchaseToModel(p));
        
        // Filter by purchase ID or supplier name/ID
        return purchases.filter(purchase => 
          // Search by purchase ID
          (purchase.id && purchase.id.toLowerCase().includes(searchTerm)) ||
          // Search by formatted purchase ID
          (purchase.id && this.formatPurchaseId(purchase.id).toLowerCase().includes(searchTerm)) ||
          // Search by reference ID
          (purchase.referenceId && purchase.referenceId.toLowerCase().includes(searchTerm)) ||
          // Search by supplier ID
          (purchase.supplierId && purchase.supplierId.toLowerCase().includes(searchTerm)) ||
          // Search by supplier name (if available)
          (purchase.supplier && purchase.supplier.name && 
           purchase.supplier.name.toLowerCase().includes(searchTerm))
        );
      }),
      // Limit results to first 10
      map(purchases => purchases.slice(0, 10)),
      catchError(error => {
        console.error('Error searching purchases:', error);
        return of([]);
      })
    );
  }
  
  // Map API purchase response to Purchase model
  private mapApiPurchaseToModel(apiPurchase: any): Purchase {
    // Format the date if it exists in timestamp format
    let invoiceDate = new Date().toISOString();
    if (apiPurchase.invoiceDate) {
      if (apiPurchase.invoiceDate.seconds) {
        invoiceDate = new Date(apiPurchase.invoiceDate.seconds * 1000).toISOString();
      } else if (typeof apiPurchase.invoiceDate === 'string') {
        invoiceDate = apiPurchase.invoiceDate;
      }
    }
    
    // Map purchase items
    const items = apiPurchase.items?.map((item: any) => {
      // Format expiry date if it exists
      let expiryDate = '';
      if (item.expiryDate && item.expiryDate.seconds) {
        expiryDate = new Date(item.expiryDate.seconds * 1000).toISOString();
      }
      
      return {
        medicineId: item.medicineId,
        medicineName: 'Medicine ID: ' + item.medicineId, // Actual name would need to be fetched from medicine service
        batchNo: item.batchNo,
        expiryDate: expiryDate,
        packQuantity: item.packQuantity,
        freePackQuantity: item.freePackQuantity,
        itemsPerPack: item.itemsPerPack,
        quantity: item.totalReceivedQuantity, // Important for return quantity validation
        purchasePrice: item.purchaseCostPerPack,
        mrp: item.mrpPerItem,
        discountPercentage: item.discountPercentage,
        lineItemDiscountAmount: item.lineItemDiscountAmount,
        lineItemTaxableAmount: item.lineItemTaxableAmount,
        lineItemTaxAmount: item.lineItemTaxAmount,
        lineItemTotalAmount: item.lineItemTotalAmount,
        taxProfileId: item.taxProfileId,
        taxRate: item.taxRateApplied,
        taxComponents: item.taxComponents
      };
    }) || [];
    
    // Return mapped Purchase object
    return {
      id: apiPurchase.purchaseId,
      supplierId: apiPurchase.supplierId,
      organizationId: apiPurchase.organizationId,
      branchId: apiPurchase.branchId,
      referenceId: apiPurchase.referenceId,
      invoiceDate: invoiceDate,
      totalAmount: apiPurchase.totalAmount,
      totalTaxAmount: apiPurchase.totalTaxAmount,
      totalTaxableAmount: apiPurchase.totalTaxableAmount,
      totalDiscountAmount: apiPurchase.totalDiscountAmount,
      gstType: apiPurchase.gstType,
      amountPaid: apiPurchase.amountPaid,
      dueAmount: apiPurchase.dueAmount,
      paymentStatus: apiPurchase.paymentStatus,
      createdAt: apiPurchase.createdAt?.seconds ? 
        new Date(apiPurchase.createdAt.seconds * 1000).toISOString() : 
        new Date().toISOString(),
      items: items,
      // Include supplier details if available
      supplier: {
        id: apiPurchase.supplierId,
        // Placeholder for supplier name - would need to be fetched from supplier API
        name: `Supplier (${apiPurchase.supplierId.substring(apiPurchase.supplierId.lastIndexOf('_') + 1, apiPurchase.supplierId.lastIndexOf('_') + 9)})`
      }
    };
  }
}
