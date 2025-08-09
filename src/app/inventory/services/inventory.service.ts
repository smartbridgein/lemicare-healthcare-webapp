import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, forkJoin } from 'rxjs';
import { catchError, map, tap, delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

import {
  Medicine, MedicineDetails, Sale, Purchase, TaxProfile, Supplier,
  InventorySummary, Group, Generic, Company, SaleItem, PurchaseItemDto, BatchDetails,
  StockByCategoryItem, DailySalesReport, ReturnItem, ReturnReport, PurchaseSummary, PurchaseDateFilter, 
  ReturnRequestItem, CreateReturnRequest, ReturnReasonSummary, StockStatus, SalesReturn,
  ExpiringMedicine, LowStockMedicine
} from '../models/inventory.models';

// Patient model for patient search
export interface Patient {
  id: string;
  name: string;
  phoneNumber: string; // API returns phoneNumber instead of mobile
  email?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  allergies?: string;
  medicalHistory?: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
  active?: boolean;
}

// Doctor model for doctor search
export interface Doctor {
  id: string;
  name: string;
  specialization?: string;
}

// Medicine batch information
export interface MedicineBatch {
  batchNumber: string;
  expiryDate: string;
  mrp: number;
  purchaseCost?: number;
  quantity: number;
  taxPercentage: number;
}

// Sale item DTO to match Java backend SaleItemDto
export interface SaleItemDto {
  medicineId: string;
  quantity: number;
  discountPercentage: number;
  // Required by the backend API
  mrp: number; // MRP is required by the backend
  // Optional fields for calculation
  cgst?: number;
  sgst?: number;
  taxableAmount?: number;
  total?: number;
}

// Request interfaces to match backend DTOs
export interface CreateOtcSaleRequest {
  // Patient details
  patientName?: string;
  patientMobile?: string;
  address?: string;
  patientDob?: string | null;
  patientAge?: number | null;
  gender?: string | null;
  walkInCustomerName?: string;
  walkInCustomerMobile?: string;
  
  // Organization details
  orgId?: string;
  
  // Invoice details
  date: string; // ISO format date string
  doctorName?: string;
  
  // Payment details
  paymentMode: string; // Payment mode (CASH, CARD, etc)
  paymentStatus?: string;
  transactionReference?: string;
  
  // Tax details
  gstType?: string; // 'INCLUSIVE' or 'EXCLUSIVE' - match backend enum
  printGst?: boolean;
  cgstTotal?: number;
  sgstTotal?: number;
  
  // Sale items and amounts
  items: SaleItemDto[];
  subtotal?: number;
  totalDiscount?: number; // Match backend field name
  totalTax?: number;      // Match backend field name
  grandTotal: number;     // Required field for backend
  notes?: string;
}

export interface SaleReturnRequest {
  originalSaleId: string;
  returnDate: string; // ISO format date string
  reason: string;
  overallDiscountPercentage?: number;
  items: SaleReturnItemDto[];
}

export interface SaleReturnItemDto {
  medicineId: string;
  batchNo: string;
  returnQuantity: number;
}

export interface PurchaseReturnRequest {
  originalPurchaseId: string;
  returnDate: string; // ISO format date string
  supplierId: string;
  reason: string;
  totalReturnAmount?: number;
  totalBaseAmount?: number;
  totalCGST?: number;
  totalSGST?: number;
  totalTaxAmount?: number;
  totalDiscountAmount?: number;
  items: PurchaseReturnItemDto[];
}

export interface PurchaseReturnItemDto {
  medicineId: string;
  batchNo: string;
  returnQuantity: number;
  returnValue?: number;
  baseReturnValue?: number;
  cgst?: number;
  sgst?: number;
  taxProfileId?: string;
  taxRate?: number;
}

export interface SaleReturn {
  salesReturnId: string;
  originalSaleId: string;
  patientId: string | null;
  returnDate: string;
  netRefundAmount: number;
  reason?: string;
  items?: SaleReturnItemDto[];
}

export interface CreateMedicineRequest {
  name: string;
  genericName: string; // Required field
  manufacturer: string; // Required field
  category?: string;
  sku?: string;
  hsnCode?: string;
  unitOfMeasurement: string;
  lowStockThreshold: number;
  taxProfileId: string;
  unitPrice?: number;
  status?: string;
  stockQuantity?: number;
}

// Add interfaces for other models used in services
// Remove this local interface and use the one from inventory.models.ts instead
// export interface Sale {
//   id: string;
//   patient?: any;
//   date: string;
//   items: any[];
//   totalAmount: number;
//   createdAt?: string;
// }

export interface PurchaseReturn {
  id: string;
  purchaseId: string;
  purchase?: Purchase;
  returnDate: string;
  returnItems: any[];
  totalAmount: number;
  createdAt?: string;
}

// Interface moved to inventory.models.ts

// Interface moved to inventory.models.ts

// Using PurchaseItemDto from models file instead of local interface

interface UpdateMedicineRequest {
  name?: string;
  unitOfMeasurement?: string;
  lowStockThreshold?: number;
  stockQuantity?: number;
  taxProfileId?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  category?: string;
  sku?: string;
  hsnCode?: string;
  unitPrice?: number;
}

interface CreateSupplierRequest {
  name: string;
  address?: string;
  contactNumber?: string;
  phone?: string;  // Added new field for phone
  email?: string;
  gstNumber?: string;
  gstin?: string;  // Added direct GSTIN field
  contactPerson?: string;
  drugLicense?: string;
  drugLicenseNumber?: string; // Required by backend validation
  status?: string; // Added status field for active/inactive state
}

interface CreateGroupRequest {
  name: string;
}

interface UpdateGroupRequest {
  name: string;
}

interface CreateGenericRequest {
  name: string;
}

interface UpdateGenericRequest {
  name: string;
}

interface CreateCompanyRequest {
  name: string;
}

interface UpdateCompanyRequest {
  name: string;
}

interface UpdateSupplierRequest {
  name?: string;
  address?: string;
  contactNumber?: string;
  email?: string;
  gstNumber?: string;
  gstin?: string; // Added for API compatibility
  contactPerson?: string;
  drugLicense?: string;
  drugLicenseNumber?: string; // Added for API compatibility
  status?: string; // Added status field for active/inactive state
}

interface CreateTaxProfileRequest {
  profileName: string;
  totalRate: number;
  components: {
    componentName: string;
    rate: number;
  }[];
}

interface CreatePurchaseRequest {
  supplierId: string;
  invoiceDate: string;
  referenceId?: string;
  totalAmount: number;
  purchaseItems: {
    medicineId: string;
    batchNo: string;
    expiryDate: string;
    paidQuantity: number;
    freeQuantity: number;
    purchaseCost: number;
    mrp: number;
  }[];
}

// Interface is now exported above

interface CreatePrescriptionSaleRequest {
  patientId: string;
  doctorId: string;
  prescriptionDate: Date;
  saleDate: Date;
  items: SaleItemDto[];
}

interface CreateSalesReturnRequest {
  originalSaleId: string;
  returnDate: string;
  refundAmount: number;
  reason?: string;
  returnItems: {
    medicineId: string;
    quantity: number;
    amount: number;
  }[];
}

interface CreatePurchaseReturnRequest {
  originalPurchaseId: string;
  returnDate: string;
  refundAmount: number;
  reason?: string;
  returnItems: {
    medicineId: string;
    batchNo: string;
    quantity: number;
    amount: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private apiUrl = environment.apiUrlInventory;
  private inventoryApiUrl = environment.apiUrlInventory; // Specific inventory API URL (port 8082)
  private pharmacyApiUrl = environment.apiUrl + '/api/inventory';

  constructor(private http: HttpClient) { }

  // ---- MASTER DATA API ----
  
  // Medicines
  private medicinesCache: Medicine[] | null = null;
  
  getMedicines(forceRefresh: boolean = false, skipLoader: boolean = false): Observable<Medicine[]> {
    if (this.medicinesCache && this.medicinesCache.length > 0 && !forceRefresh) {
      console.log('Returning medicines from cache');
      return of(this.medicinesCache);
    }

    const headers: Record<string, string> = skipLoader ? { 'X-Skip-Loader': 'true' } : {};

    console.log('Fetching medicines from API...');
    // Use the correct API URL for inventory with port 8082
    const medicineApiUrl = `${this.apiUrl}/api/inventory/masters/medicines`;
    console.log('API URL:', medicineApiUrl);
    
    return this.http.get<any[]>(medicineApiUrl, { headers }).pipe(
      map(medicinesData => {
        console.log('Raw medicine data:', medicinesData);
        // Show ALL medicines including inactive ones
        const medicines: Medicine[] = medicinesData
          .map((medicine: any) => ({
            id: medicine.medicineId || medicine.id,
            medicineId: medicine.medicineId || medicine.id,
            name: medicine.name,
            // Add these missing fields for proper UI display
            category: medicine.category || '',
            sku: medicine.sku || '',
            hsnCode: medicine.hsnCode || '',
            unitPrice: medicine.unitPrice || 0,
            purchasePrice: medicine.purchasePrice || 0,
            // Standard fields
            unitOfMeasurement: medicine.unitOfMeasurement,
            lowStockThreshold: medicine.lowStockThreshold || 10,
            stockQuantity: medicine.stockQuantity || medicine.quantityInStock || 0,
            stockStatus: medicine.stockStatus || 'NORMAL',
            taxProfileId: medicine.taxProfileId,
            // Additional fields
            manufacturer: medicine.manufacturer || medicine.companyName || '',
            genericName: medicine.genericName || medicine.generic || '',
            groupName: medicine.groupName || medicine.group || '',
            companyName: medicine.companyName || medicine.company || '',
            reorderReminder: medicine.reorderReminder || '',
            location: medicine.location || '',
            status: medicine.status || 'ACTIVE'
          }));
        this.medicinesCache = medicines;
        return medicines;
      }),
      catchError(error => {
        console.error('Error fetching medicines:', error);
        // Fallback to mock data if API call fails
        return this.getMockMedicines();
      })
    );
  }
  
  private refreshMedicinesCache(deletedId?: string): void {
    // If we have a deletedId, remove it from cache without clearing the whole cache
    if (deletedId && this.medicinesCache) {
      console.log(`Removing medicine ${deletedId} from cache`);
      this.medicinesCache = this.medicinesCache.filter((med: Medicine) => 
        med.id !== deletedId && med.medicineId !== deletedId
      );
    } else {
      // Clear the entire cache to force a refresh on next request
      console.log('Clearing entire medicines cache');
      this.medicinesCache = null;
    }
  }
  
  private getMockMedicines(): Observable<Medicine[]> {
    console.log('Using mock medicines data instead of API call');
    
    const mockMedicines: Medicine[] = [
      { 
        id: 'med_1', 
        medicineId: 'med_1',
        name: 'Acnecrosis body spray', 
        unitOfMeasurement: 'Spray',
        lowStockThreshold: 10, 
        stockQuantity: 15, 
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'tax_1',
        genericName: '',
        groupName: '',
        companyName: '',
        reorderReminder: '',
        location: '',
        status: 'ACTIVE'
      },
      { 
        id: 'med_2', 
        medicineId: 'med_2',
        name: 'Adipan Gref serum', 
        unitOfMeasurement: 'Serum',
        lowStockThreshold: 5, 
        stockQuantity: 8, 
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'tax_1',
        genericName: '',
        groupName: '',
        companyName: '',
        reorderReminder: '',
        location: '',
        status: 'ACTIVE'
      },
      { 
        id: 'med_3', 
        medicineId: 'med_3',
        name: 'Aftaglow lotion', 
        unitOfMeasurement: 'Bottle',
        lowStockThreshold: 5, 
        stockQuantity: 12, 
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'tax_2',
        genericName: '',
        groupName: '',
        companyName: '',
        reorderReminder: '',
        location: '',
        status: 'ACTIVE'
      },
      {
        id: 'med_4',
        medicineId: 'med_4',
        name: 'Paracetamol 500mg',
        unitOfMeasurement: 'Strip',
        lowStockThreshold: 20,
        stockQuantity: 45,
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'tax_1',
        genericName: '',
        groupName: '',
        companyName: '',
        reorderReminder: '',
        location: '',
        status: 'ACTIVE'
      },
      {
        id: 'med_5',
        medicineId: 'med_5',
        name: 'Azithromycin 500mg',
        unitOfMeasurement: 'Strip',
        lowStockThreshold: 10,
        stockQuantity: 25,
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'tax_2',
        genericName: '',
        groupName: '',
        companyName: '',
        reorderReminder: '',
        location: '',
        status: 'ACTIVE'
      }
    ];
    
    return of(mockMedicines).pipe(
      delay(500) // Simulate network delay
    );
  }

  getMedicineById(id: string): Observable<Medicine> {
    // First, check the local cached medicines
    if (this.medicinesCache && this.medicinesCache.length > 0) {
      const cachedMedicine = this.medicinesCache.find(m => m.id === id || m.medicineId === id);
      if (cachedMedicine) {
        console.log('Returning cached medicine details:', cachedMedicine);
        return of(cachedMedicine).pipe(delay(100)); // Simulate API delay
      }
    }

    // If not in cache or cache is empty, fetch from API
    console.log('Fetching medicine details from API for ID:', id);
    
    // Return from API
    return this.http.get<any>(`${environment.apiUrl}/api/inventory/masters/medicines/${id}`)
      .pipe(
        map(response => {
          console.log('Received medicine details from API:', response);
          
          // Map API response to our Medicine model
          const medicine: Medicine = {
            id: response.id || '',
            medicineId: response.medicineId || id,
            name: response.name || '',
            category: response.category || '',
            sku: response.sku || '',
            hsnCode: response.hsnCode || '',
            unitOfMeasurement: response.unitOfMeasurement || 'tablet',
            lowStockThreshold: response.lowStockThreshold || 10,
            stockQuantity: response.stockQuantity || response.quantityInStock || 0,
            quantityInStock: response.quantityInStock || response.stockQuantity || 0,
            stockStatus: response.stockStatus || StockStatus.NORMAL,
            unitPrice: response.unitPrice || 0,
            status: response.status || 'ACTIVE',
            taxProfileId: response.taxProfileId || '',
            // Additional fields from legacy data
            genericName: response.genericName || response.generic || '',
            generic: response.generic || '',
            groupName: response.groupName || response.group || '',
            group: response.group || '',
            companyName: response.companyName || response.company || '',
            company: response.company || '',
            reorderReminder: response.reorderReminder || '',
            location: response.location || ''
          };
          
          return medicine;
        }),
        catchError((error) => {
          console.error(`Error fetching medicine with ID ${id}:`, error);
          // If API call fails, try getting all medicines as fallback
          return this.getMedicines(true, true).pipe(
            map(medicines => {
              const medicine = medicines.find(med => med.id === id || med.medicineId === id);
              if (!medicine) {
                throw new Error(`Medicine with ID ${id} not found`);
              }
              console.log(`Medicine with ID ${id} found after refresh`, medicine);
              return medicine;
            }),
            catchError(err => {
              console.error(`Error finding medicine with ID ${id} after refresh:`, err);
              return throwError(() => new Error(`Failed to fetch medicine details: ${err.message}`));
            })
          );
        })
      );
  }

  createMedicine(medicineData: CreateMedicineRequest): Observable<Medicine> {
    return this.http.post<Medicine>(`${this.apiUrl}/api/inventory/masters/medicines`, medicineData).pipe(
      tap((medicine: Medicine) => {
        console.log('Medicine created successfully:', medicine);
        this.refreshMedicinesCache(); // Clear cache to ensure fresh data on next request
      }),
      catchError((error) => {
        console.error('Error creating medicine:', error);
        return throwError(() => new Error(`Failed to create medicine: ${error.message}`));
      })
    );
  }

  /**
   * Creates a mock medicine for development/testing purposes
   * @param id Medicine ID to use for the mock
   * @returns A mock Medicine object
   */
  private createMockMedicineDetails(id: string): Medicine {
    return {
      id: id,
      medicineId: id,
      name: `Medicine ${id}`,
      category: 'General',
      sku: `SKU-${id}`,
      hsnCode: `HSN-${id}`,
      unitOfMeasurement: 'tablet',
      lowStockThreshold: 10,
      stockQuantity: 50,
      stockStatus: StockStatus.NORMAL,
      taxProfileId: 'tax-1',
      unitPrice: 100,
      status: 'ACTIVE',
      quantityInStock: 50
    };
  }

  updateMedicine(id: string, medicineData: UpdateMedicineRequest, forceUpdate: boolean = false): Observable<Medicine> {
    // Add custom headers for force update to bypass duplicate name checks on backend
    const headers: Record<string, string> = forceUpdate ? { 'X-Force-Update': 'true' } : {};
    
    return this.http.put<Medicine>(`${this.apiUrl}/api/inventory/masters/medicines/${id}`, medicineData, { headers }).pipe(
      tap((medicine: Medicine) => {
        console.log(`Medicine ${id} updated successfully:`, medicine);
        this.refreshMedicinesCache(); // Clear cache to ensure fresh data on next request
      }),
      catchError((error) => {
        // If it's a conflict error and we're forcing an update, retry with a different approach
        if (forceUpdate && error.status === 409) {
          console.log('Conflict error during force update, attempting direct update...');
          // Use a different API endpoint or parameter to bypass the duplicate check
          const bypassUrl = `${this.apiUrl}/api/inventory/masters/medicines/${id}?forceUpdate=true`;
          return this.http.put<Medicine>(bypassUrl, medicineData);
        }
        
        console.error(`Error updating medicine ${id}:`, error);
        return throwError(() => new Error(`Failed to update medicine: ${error.message}`));
      })
    );
  }

  deleteMedicine(id: string): Observable<void> {
    if (!id || id === 'undefined') {
      console.error('Invalid medicine ID provided for delete:', id);
      return throwError(() => new Error('Invalid medicine ID for deletion'));
    }
    
    return this.http.delete<void>(`${this.apiUrl}/api/inventory/masters/medicines/${id}`).pipe(
      tap(() => {
        console.log(`Medicine ${id} deleted successfully`);
        // Remove this specific item from cache immediately
        this.refreshMedicinesCache(id);
        
        // Notify subscribers that data has changed
        setTimeout(() => {
          // Force a complete cache refresh after a small delay to ensure data consistency
          this.refreshMedicinesCache();
        }, 200);
      }),
      catchError((error) => {
        console.error(`Error deleting medicine ${id}:`, error);
        return throwError(() => new Error(`Failed to delete medicine: ${error.message}`));
      })
    );
  }

  // Tax Profiles
  private taxProfilesCache: TaxProfile[] | null = null;
  
  getTaxProfiles(useApiIfAvailable: boolean = true, forceRefresh: boolean = false): Observable<TaxProfile[]> {
    // Return from cache if available and not forcing refresh
    if (this.taxProfilesCache && this.taxProfilesCache.length > 0 && !forceRefresh) {
      console.log('Returning tax profiles from cache', this.taxProfilesCache);
      return of(this.taxProfilesCache);
    }
    
    // If API should be used and we're online
    if (useApiIfAvailable) {
      // Use the right API URL for tax profiles
      const taxApiUrl = `${this.apiUrl}/api/inventory/masters/tax-profiles`;
      console.log('Fetching tax profiles from API:', taxApiUrl);
      
      return this.http.get<any[]>(taxApiUrl).pipe(
        map((profiles: any[]) => {
          console.log('Raw tax profile data:', profiles);
          // Map the API response to our TaxProfile model
          const mappedProfiles = profiles.map((profile: any) => {
            // Process components to ensure proper mapping
            let components = [];
            if (profile.components && Array.isArray(profile.components)) {
              components = profile.components.map((comp: any) => ({
                componentName: comp.componentName || comp.name || '',
                rate: comp.rate || 0
              }));
            } else {
              // Default components if none provided
              components = [
                { componentName: 'CGST', rate: 4.0 },
                { componentName: 'SGST', rate: 4.0 }
              ];
            }
            
            return {
              id: profile.id || profile.taxProfileId || profile.profileName?.replace(/\s+/g, '_').toLowerCase(),
              profileName: profile.profileName || profile.name || '',
              totalRate: profile.totalRate || profile.rate || (components.reduce((sum: number, c: any) => sum + c.rate, 0)),
              components: components
            };
          });
          
          // Cache the mapped profiles
          this.taxProfilesCache = mappedProfiles;
          return mappedProfiles;
        }),
        catchError(error => {
          console.error('Error loading tax profiles from API:', error);
          // If we have cached data, return that
          if (this.taxProfilesCache && this.taxProfilesCache.length > 0) {
            return of(this.taxProfilesCache);
          }
          // Otherwise fall back to mock data
          return this.getMockTaxProfiles();
        })
      );
    } else {
      // Offline mode - return mock data
      return this.getMockTaxProfiles();
    }
  }
  
  // Helper method to get mock tax profiles
  private getMockTaxProfiles(): Observable<TaxProfile[]> {
    const mockProfiles: TaxProfile[] = [
      { id: 'tax1', profileName: 'GST 5%', totalRate: 5, components: [] },
      { id: 'tax2', profileName: 'GST 12%', totalRate: 12, components: [] },
      { id: 'tax3', profileName: 'GST 18%', totalRate: 18, components: [] }
    ];
    this.taxProfilesCache = mockProfiles;
    return of(mockProfiles);
  }
  
  // Refresh the tax profiles cache
  refreshTaxProfilesCache(): void {
    this.taxProfilesCache = null;
  }

  createTaxProfile(taxProfileData: any): Observable<TaxProfile> {
    const taxApiUrl = `${this.apiUrl}/api/inventory/masters/tax-profiles`;
    
    // Ensure components are properly formatted
    const formattedData = {
      ...taxProfileData,
      components: taxProfileData.components.map((comp: any) => ({
        componentName: comp.componentName || comp.name || '',
        rate: parseFloat(comp.rate) || 0
      }))
    };
    
    console.log('Creating tax profile:', formattedData);
    
    return this.http.post<TaxProfile>(taxApiUrl, formattedData).pipe(
      tap(response => {
        console.log('Tax profile created successfully:', response);
        // Clear cache to ensure fresh data on next request
        this.refreshTaxProfilesCache();
      }),
      catchError(error => {
        console.error('Error creating tax profile:', error);
        return throwError(() => new Error(`Failed to create tax profile: ${error.message}`));
      })
    );
  }

  /**
   * Update an existing tax profile
   * @param id Tax profile ID to update
   * @param taxProfileData Updated tax profile data
   * @returns Observable of the updated tax profile
   */
  updateTaxProfile(id: string, taxProfileData: any): Observable<TaxProfile> {
    if (!id) {
      return throwError(() => new Error('Tax profile ID is required for update'));
    }

    const taxApiUrl = `${this.apiUrl}/api/inventory/masters/tax-profiles/${id}`;
    
    // Ensure components are properly formatted
    const formattedData = {
      ...taxProfileData,
      components: taxProfileData.components.map((comp: any) => ({
        componentName: comp.componentName || comp.name || '',
        rate: parseFloat(comp.rate) || 0
      }))
    };
    
    console.log(`Updating tax profile ${id}:`, formattedData);
    
    return this.http.put<TaxProfile>(taxApiUrl, formattedData).pipe(
      tap(response => {
        console.log('Tax profile updated successfully:', response);
        // Clear cache to ensure fresh data on next request
        this.refreshTaxProfilesCache();
      }),
      catchError(error => {
        console.error(`Error updating tax profile ${id}:`, error);
        return throwError(() => new Error(`Failed to update tax profile: ${error.message}`));
      })
    );
  }

  /**
   * Delete a tax profile by ID
   * @param id The ID of the tax profile to delete
   * @returns Observable of the API response
   */
  deleteTaxProfile(id: string): Observable<any> {
    if (!id) {
      return throwError(() => new Error('Tax profile ID is required for deletion'));
    }

    const taxApiUrl = `${this.apiUrl}/api/inventory/masters/tax-profiles/${id}`;
    console.log(`Deleting tax profile ${id}`);
    
    return this.http.delete(taxApiUrl).pipe(
      tap(() => {
        console.log(`Tax profile ${id} deleted successfully`);
        // Clear cache to ensure fresh data on next request
        this.refreshTaxProfilesCache();
      }),
      catchError(error => {
        console.error(`Error deleting tax profile ${id}:`, error);
        return throwError(() => new Error(`Failed to delete tax profile: ${error.message}`));
      })
    );
  }

  /**
   * Clean up all tax profiles except "no tax" profile
   * Calls the backend cleanup endpoint to remove inconsistent tax profiles
   * @returns Observable with cleanup results (deletedCount, errorCount, errors)
   */
  cleanupTaxProfiles(): Observable<any> {
    const cleanupApiUrl = `${this.apiUrl}/api/inventory/masters/tax-profiles/cleanup`;
    console.log('Starting tax profile cleanup...');
    
    return this.http.post(cleanupApiUrl, {}).pipe(
      tap((result: any) => {
        console.log('Tax profile cleanup completed:', result);
        // Refresh tax profiles cache after cleanup
        this.refreshTaxProfilesCache();
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Tax profile cleanup failed:', error);
        return throwError(() => new Error(`Failed to cleanup tax profiles: ${error.message}`));
      })
    );
  }

  // Suppliers
  getSuppliers(): Observable<Supplier[]> {
    // Using exact endpoint from MasterDataController.java: @RequestMapping("/api/inventory/masters")
    return this.http.get<any[]>(`${environment.apiUrlInventory}/api/inventory/masters/suppliers`)
      .pipe(
        map((suppliers: any[]) => suppliers.map((supplier: any) => ({
          id: supplier.supplierId, // Map supplierId to id for backward compatibility
          supplierId: supplier.supplierId,
          name: supplier.name,
          address: supplier.address,
          mobileNumber: supplier.mobileNumber,
          contactNumber: supplier.mobileNumber, // Map mobileNumber to contactNumber for compatibility
          email: supplier.email,
          gstin: supplier.gstin,
          gstNumber: supplier.gstin, // Map gstin to gstNumber for compatibility
          contactPerson: supplier.contactPerson,
          status: supplier.status,
          drugLicenseNumber: supplier.drugLicenseNumber,
          balance: supplier.balance, // Map balance field from API response
          outstandingBalance: supplier.outstandingBalance, // Map outstandingBalance field from API response
          createdAt: supplier.createdAt,
          createdBy: supplier.createdBy
        })))
      );
  }

  getSupplierById(id: string): Observable<Supplier> {
    // Using exact endpoint from MasterDataController.java: @RequestMapping("/api/inventory/masters")
    return this.http.get<any>(`${environment.apiUrlInventory}/api/inventory/masters/suppliers/${id}`)
      .pipe(
        map((supplier: any) => ({
          id: supplier.supplierId,
          supplierId: supplier.supplierId,
          name: supplier.name,
          address: supplier.address,
          mobileNumber: supplier.mobileNumber,
          contactNumber: supplier.mobileNumber,
          email: supplier.email,
          gstin: supplier.gstin,
          gstNumber: supplier.gstin,
          contactPerson: supplier.contactPerson,
          status: supplier.status,
          drugLicenseNumber: supplier.drugLicenseNumber,
          balance: supplier.balance, // Map balance field from API response
          outstandingBalance: supplier.outstandingBalance, // Map outstandingBalance field from API response
          createdAt: supplier.createdAt,
          createdBy: supplier.createdBy
        }))
      );
  }

  createSupplier(supplierData: CreateSupplierRequest): Observable<Supplier> {
    // Map frontend model to backend expected format if needed
    const backendSupplier = {
      name: supplierData.name,
      address: supplierData.address,
      // Use phone if provided, otherwise fall back to contactNumber
      mobileNumber: supplierData.phone || supplierData.contactNumber, 
      email: supplierData.email,
      // Use gstin if provided, otherwise fall back to gstNumber
      gstin: supplierData.gstin || supplierData.gstNumber,
      contactPerson: supplierData.contactPerson,
      status: supplierData.status || 'ACTIVE' ,

      // Required by backend validation
      drugLicenseNumber: supplierData.drugLicenseNumber || supplierData.drugLicense || 'DL-12345678'
    };
    
    console.log('Creating new supplier with data:', backendSupplier);
    
    return this.http.post<any>(`${environment.apiUrlInventory}/api/inventory/masters/suppliers`, backendSupplier)
      .pipe(
        map((response: any) => ({
          id: response.supplierId,
          supplierId: response.supplierId,
          name: response.name,
          address: response.address,
          mobileNumber: response.mobileNumber,
          contactNumber: response.mobileNumber,
          email: response.email,
          gstin: response.gstin,
          gstNumber: response.gstin,
          contactPerson: response.contactPerson,
          status: response.status,
          createdAt: response.createdAt,
          createdBy: response.createdBy
        }))
      );
  }
  
  updateSupplier(id: string, supplierData: UpdateSupplierRequest): Observable<Supplier> {
    // Map frontend model to backend expected format if needed
    const backendSupplier = {
      name: supplierData.name,
      address: supplierData.address,
      mobileNumber: supplierData.contactNumber, // Map contactNumber to mobileNumber
      email: supplierData.email,
      gstin: supplierData.gstNumber, // Map gstNumber to gstin
      contactPerson: supplierData.contactPerson,
      drugLicenseNumber: supplierData.drugLicenseNumber, // Include drug license number
      status: supplierData.status || 'ACTIVE' // Explicitly include status with default fallback
    };
    
    // Log the API request payload for debugging
    console.log('Updating supplier with payload:', backendSupplier);
    
    return this.http.put<any>(`${environment.apiUrlInventory}/api/inventory/masters/suppliers/${id}`, backendSupplier)
      .pipe(
        map((response: any) => ({
          id: response.supplierId,
          supplierId: response.supplierId,
          name: response.name,
          address: response.address,
          mobileNumber: response.mobileNumber,
          contactNumber: response.mobileNumber,
          email: response.email,
          gstin: response.gstin,
          gstNumber: response.gstin,
          contactPerson: response.contactPerson,
          status: response.status,
          createdAt: response.createdAt,
          createdBy: response.createdBy
        }))
      );
  }
  
  deleteSupplier(id: string): Observable<void> {
    return this.http.delete<any>(`${environment.apiUrlInventory}/api/inventory/masters/suppliers/${id}`);
  }

  // Groups
  getGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.apiUrl}/masters/groups`);
  }

  getGroupById(id: string): Observable<Group> {
    return this.http.get<Group>(`${this.apiUrl}/masters/groups/${id}`);
  }

  createGroup(groupData: CreateGroupRequest): Observable<Group> {
    return this.http.post<Group>(`${this.apiUrl}/masters/groups`, groupData);
  }

  updateGroup(id: string, groupData: UpdateGroupRequest): Observable<Group> {
    return this.http.put<Group>(`${this.apiUrl}/masters/groups/${id}`, groupData);
  }

  deleteGroup(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/masters/groups/${id}`);
  }

  // Generics
  getGenerics(): Observable<Generic[]> {
    return this.http.get<Generic[]>(`${this.apiUrl}/masters/generics`);
  }

  getGenericById(id: string): Observable<Generic> {
    return this.http.get<Generic>(`${this.apiUrl}/masters/generics/${id}`);
  }

  createGeneric(genericData: CreateGenericRequest): Observable<Generic> {
    return this.http.post<Generic>(`${this.apiUrl}/masters/generics`, genericData);
  }

  updateGeneric(id: string, genericData: UpdateGenericRequest): Observable<Generic> {
    return this.http.put<Generic>(`${this.apiUrl}/masters/generics/${id}`, genericData);
  }

  deleteGeneric(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/masters/generics/${id}`);
  }

  // Companies
  getCompanies(): Observable<Company[]> {
    return this.http.get<Company[]>(`${this.apiUrl}/masters/companies`);
  }

  getCompanyById(id: string): Observable<Company> {
    return this.http.get<Company>(`${this.apiUrl}/masters/companies/${id}`);
  }

  createCompany(companyData: CreateCompanyRequest): Observable<Company> {
    return this.http.post<Company>(`${this.apiUrl}/masters/companies`, companyData);
  }

  updateCompany(id: string, companyData: UpdateCompanyRequest): Observable<Company> {
    return this.http.put<Company>(`${this.apiUrl}/masters/companies/${id}`, companyData);
  }

  deleteCompany(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/masters/companies/${id}`);
  }

  // ---- PURCHASES API ----
  private purchasesCache: Purchase[] | null = null;
  
  /**
   * Refreshes the purchases cache by setting it to null
   * Called after successful create, update, or delete operations
   */
  private refreshPurchasesCache(): void {
    this.purchasesCache = null;
    console.log('Purchases cache invalidated');
  }
  
  /**
   * Get all purchases with optional caching and API fallback
   * @param useApiIfAvailable Whether to use the API if available (default: true)
   * @param forceRefresh Whether to force a refresh of the cache (default: false)
   * @returns Observable of mapped Purchase[] array
   */
  getPurchases(useApiIfAvailable: boolean = true, forceRefresh = false): Observable<Purchase[]> {
    // If we have cached data and don't need to refresh, return it
    if (this.purchasesCache && !forceRefresh) {
      console.log('Using cached purchases data');
      return of(this.purchasesCache);
    }
    
    // If API is available and we want to use it
    if (useApiIfAvailable) {
      // Using exact endpoint from PurchaseController.java: @RequestMapping("/api/inventory/purchases")
      return this.http.get<any[]>(`${environment.apiUrlInventory}/api/inventory/purchases/`).pipe(
        map((purchases: any[]) => {
          // Map backend data to frontend models
          const mappedPurchases = purchases.map((purchase: any) => {
            return {
              id: purchase.purchaseId || purchase.id,
              supplierId: purchase.supplierId,
              // Map supplierName from API response or fallback to supplier.name if available
              supplierName: purchase.supplierName || (purchase.supplier ? purchase.supplier.name : undefined),
              supplier: purchase.supplier ? {
                id: purchase.supplier.supplierId || '', 
                supplierId: purchase.supplier.supplierId,
                name: purchase.supplier.name,
                contactNumber: purchase.supplier.mobileNumber,
                email: purchase.supplier.email,
                address: purchase.supplier.address
              } : undefined,
              invoiceDate: purchase.invoiceDate,
              referenceId: purchase.referenceId || purchase.invoiceNumber,
              totalAmount: purchase.totalAmount,
              // Map items to comply with Purchase interface
              items: Array.isArray(purchase.items) ? purchase.items.map((item: any) => ({
                medicineId: item.medicineId,
                batchNo: item.batchNo || item.batchNumber,
                expiryDate: item.expiryDate,
                paidQuantity: item.paidQuantity || item.quantity || 0,
                freeQuantity: item.freeQuantity || 0,
                purchaseCost: item.purchaseCost || item.cost || 0,
                mrp: item.mrp || 0
              })) : [],
              // Keep purchaseItems for backward compatibility
              purchaseItems: Array.isArray(purchase.items) ? purchase.items.map((item: any) => ({
                id: item.itemId || item.id,
                medicineId: item.medicineId,
                medicine: item.medicine ? {
                  id: item.medicine.medicineId || item.medicine.id,
                  name: item.medicine.name,
                  unitOfMeasurement: item.medicine.unitOfMeasurement,
                  lowStockThreshold: item.medicine.lowStockThreshold,
                  stockQuantity: item.medicine.stockQuantity,
                  stockStatus: item.medicine.stockStatus || StockStatus.NORMAL,
                  taxProfileId: item.medicine.taxProfileId
                } : undefined,
                batchNo: item.batchNo || item.batchNumber,
                expiryDate: item.expiryDate,
                paidQuantity: item.paidQuantity || item.quantity || 0,
                freeQuantity: item.freeQuantity || 0,
                purchaseCost: item.purchaseCost || item.cost || 0,
                mrp: item.mrp || 0
              })) : [],
              createdAt: purchase.createdAt
            };
          });
          
          // Cache the mapped purchases
          this.purchasesCache = mappedPurchases;
          return mappedPurchases;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error fetching purchases:', error);
          return this.getSamplePurchases();
        })
      );
    } 
    
    // Fallback to sample data if API not available
    return this.getSamplePurchases();
  }
  
  /**
   * Delete a purchase by ID
   * @param purchaseId The ID of the purchase to delete
   * @returns Observable of the API response
   */
  deletePurchase(purchaseId: string): Observable<any> {
    console.log(`Deleting purchase with ID: ${purchaseId}`);
    return this.http.delete<any>(`${environment.apiUrlInventory}/api/inventory/purchases/${purchaseId}`)
      .pipe(
        tap(() => {
          // Remove from cache if successful
          if (this.purchasesCache) {
            this.purchasesCache = this.purchasesCache.filter(p => 
              (p.id !== purchaseId && (p.purchaseId || '') !== purchaseId)
            );
          }
        }),
        catchError((error: HttpErrorResponse) => {
          console.error(`Error deleting purchase ${purchaseId}:`, error);
          throw error;
        })
      );
  }
  
  /**
   * Update an existing purchase
   * @param purchaseId ID of the purchase to update
   * @param request Updated purchase data
   * @returns Observable of the API response
   */
  updatePurchase(purchaseId: string, request: CreatePurchaseRequest): Observable<any> {
    console.log(`Updating purchase with ID: ${purchaseId}`, request);
    return this.http.put<any>(`${environment.apiUrlInventory}/api/inventory/purchases/${purchaseId}`, request)
      .pipe(
        tap((response) => {
          // Update cache if available
          if (this.purchasesCache) {
            // Find and update the purchase in cache
            const index = this.purchasesCache.findIndex(p => 
              (p.id === purchaseId || (p.purchaseId || '') === purchaseId)
            );
            
            if (index >= 0) {
              // Update the cached purchase with new data
              const updatedPurchase = this.mapPurchaseResponseToPurchase(response);
              this.purchasesCache[index] = updatedPurchase;
            }
          }
        }),
        catchError((error: HttpErrorResponse) => {
          console.error(`Error updating purchase ${purchaseId}:`, error);
          throw error;
        })
      );
  }
  
  /**
   * Helper method to map API response to Purchase object
   * @param response API response data
   * @returns Purchase object
   */
  private mapPurchaseResponseToPurchase(response: any): Purchase {
    return {
      id: response.purchaseId || response.id,
      purchaseId: response.purchaseId,
      supplierId: response.supplierId,
      supplier: response.supplier ? {
        id: response.supplier.supplierId || '', 
        supplierId: response.supplier.supplierId,
        name: response.supplier.name,
        contactNumber: response.supplier.mobileNumber,
        email: response.supplier.email,
        address: response.supplier.address
      } : undefined,
      invoiceDate: response.invoiceDate,
      referenceId: response.referenceId || response.invoiceNumber,
      totalAmount: response.totalAmount,
      // Map items to comply with Purchase interface
      items: Array.isArray(response.items) ? response.items.map((item: any) => ({
        medicineId: item.medicineId,
        batchNo: item.batchNo || item.batchNumber,
        expiryDate: item.expiryDate,
        paidQuantity: item.paidQuantity || item.quantity || 0,
        freeQuantity: item.freeQuantity || 0,
        purchaseCost: item.purchaseCost || item.cost || 0,
        mrp: item.mrp || 0
      })) : []
    };
  }

  /**
   * Get a specific purchase by ID
   * @param id Purchase ID to retrieve
   * @returns Observable of single mapped Purchase
   */
  getPurchaseById(id: string): Observable<Purchase> {
    return this.http.get<any>(`${environment.apiUrlInventory}/api/inventory/purchases/${id}`).pipe(
      map((purchase: any) => {
        console.log("Purchase API response:", purchase);
        // Map backend response to frontend model
        return {
          id: purchase.purchaseId || purchase.id,
          supplierId: purchase.supplierId,
          supplier: purchase.supplier ? {
            id: purchase.supplier.supplierId || '',
            supplierId: purchase.supplier.supplierId,
            name: purchase.supplier.name,
            contactNumber: purchase.supplier.mobileNumber,
            email: purchase.supplier.email,
            address: purchase.supplier.address
          } : undefined,
          invoiceDate: purchase.invoiceDate,
          referenceId: purchase.referenceId || purchase.invoiceNumber,
          // Additional fields from API response
          gstType: purchase.gstType,
          totalTaxableAmount: purchase.totalTaxableAmount || 0,
          totalDiscountAmount: purchase.totalDiscountAmount || 0,
          totalTaxAmount: purchase.totalTaxAmount || 0,
          totalAmount: purchase.totalAmount || 0,
          createdBy: purchase.createdBy,
          
          // Payment fields - CRITICAL: These were missing!
          amountPaid: purchase.amountPaid || 0,
          dueAmount: purchase.dueAmount || 0,
          paymentStatus: purchase.paymentStatus || 'PENDING',
          
          // Map items with all available fields from API response
          items: Array.isArray(purchase.items) ? purchase.items.map((item: any) => ({
            medicineId: item.medicineId,
            medicineName: item.medicineName,
            batchNo: item.batchNo || item.batchNumber,
            expiryDate: item.expiryDate,
            // Pack related fields
            packQuantity: item.packQuantity || 0,
            freePackQuantity: item.freePackQuantity || 0,
            itemsPerPack: item.itemsPerPack || 1,
            totalReceivedQuantity: item.totalReceivedQuantity || 0,
            purchaseCostPerPack: item.purchaseCostPerPack || 0,
            
            // Backward compatibility fields
            paidQuantity: item.packQuantity || item.quantity || 0,
            freeQuantity: item.freePackQuantity || item.freeQuantity || 0,
            purchaseCost: item.purchaseCostPerPack || item.cost || 0,
            
            // Price and discount fields
            discountPercentage: item.discountPercentage || 0,
            lineItemDiscountAmount: item.lineItemDiscountAmount || 0,
            lineItemTaxableAmount: item.lineItemTaxableAmount || 0,
            lineItemTaxAmount: item.lineItemTaxAmount || 0,
            lineItemTotalAmount: item.lineItemTotalAmount || 0,
            mrp: item.mrpPerItem || item.mrp || 0,
            mrpPerItem: item.mrpPerItem || item.mrp || 0,
            
            // Tax related fields
            taxProfileId: item.taxProfileId,
            taxRateApplied: item.taxRateApplied || 0,
            taxComponents: item.taxComponents || []
          })) : [],
          
          // Keep purchaseItems for backward compatibility with enhanced fields
          purchaseItems: Array.isArray(purchase.items) ? purchase.items.map((item: any) => ({
            id: item.itemId || item.id,
            medicineId: item.medicineId,
            medicineName: item.medicineName,
            medicine: item.medicine ? {
              id: item.medicine?.medicineId || item.medicine?.id,
              name: item.medicine?.name || item.medicineName,
              unitOfMeasurement: item.medicine?.unitOfMeasurement,
              lowStockThreshold: item.medicine?.lowStockThreshold,
              stockQuantity: item.medicine?.stockQuantity,
              stockStatus: item.medicine?.stockStatus || StockStatus.NORMAL,
              taxProfileId: item.medicine?.taxProfileId || item.taxProfileId
            } : {
              // Create medicine object from item data if not present
              id: item.medicineId,
              name: item.medicineName,
              taxProfileId: item.taxProfileId
            },
            batchNo: item.batchNo || item.batchNumber,
            expiryDate: item.expiryDate,
            
            // Pack related fields
            packQuantity: item.packQuantity || 0,
            freePackQuantity: item.freePackQuantity || 0,
            itemsPerPack: item.itemsPerPack || 1,
            totalReceivedQuantity: item.totalReceivedQuantity || 0,
            purchaseCostPerPack: item.purchaseCostPerPack || 0,
            
            // Backward compatibility fields
            paidQuantity: item.packQuantity || item.paidQuantity || item.quantity || 0,
            freeQuantity: item.freePackQuantity || item.freeQuantity || 0,
            purchaseCost: item.purchaseCostPerPack || item.purchaseCost || item.cost || 0,
            
            // Price and discount fields
            discountPercentage: item.discountPercentage || 0,
            lineItemDiscountAmount: item.lineItemDiscountAmount || 0,
            lineItemTaxableAmount: item.lineItemTaxableAmount || 0,
            lineItemTaxAmount: item.lineItemTaxAmount || 0,
            lineItemTotalAmount: item.lineItemTotalAmount || 0,
            mrp: item.mrpPerItem || item.mrp || 0,
            
            // Tax related fields
            taxProfileId: item.taxProfileId,
            taxRateApplied: item.taxRateApplied || 0,
            taxComponents: item.taxComponents || []
          })) : [],
          
          createdAt: purchase.createdAt
        };
      }),
      catchError((error: HttpErrorResponse) => {
        console.error(`Error fetching purchase with ID ${id}:`, error);
        // Return empty observable or throw custom error
        return throwError(() => new Error(`Purchase with ID ${id} not found`));
      })
    );
  }
  
  /**
   * Create a new purchase invoice
   * @param purchaseData Purchase data to create, without ID which will be generated by backend
   * @returns Observable of the created Purchase with assigned ID
   */
  createPurchase(purchaseData: any): Observable<Purchase> {
    // Map frontend model to backend DTO
    const purchaseRequest = {
      supplierId: purchaseData.supplierId,
      invoiceDate: purchaseData.invoiceDate,
      referenceId: purchaseData.referenceId,
      gstType: purchaseData.gstType || 'EXCLUSIVE',
      // Include payment fields required by backend API
      amountPaid: purchaseData.amountPaid || 0,
      paymentMode: purchaseData.paymentMode || 'CASH',
      paymentReference: purchaseData.paymentReference || '',
      // Map to updated PurchaseItemDto array
      items: (purchaseData.items || purchaseData.purchaseItems || []).map((item: any) => ({
        medicineId: item.medicineId,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate,
        packQuantity: item.packQuantity || 0,
        freePackQuantity: item.freePackQuantity || item.freeQuantity || 0,
        itemsPerPack: item.itemsPerPack || 1,
        purchaseCostPerPack: item.purchaseCostPerPack || item.purchaseCost || 0,
        discountPercentage: item.discountPercentage || item.discount || 0,
        mrpPerItem: item.mrpPerItem || item.mrp || 0,
        taxProfileId: item.taxProfileId || ''
      }))
    };

    return this.http.post<any>(`${environment.apiUrlInventory}/api/inventory/purchases/`, purchaseRequest).pipe(
      map(response => {
        // Map response back to frontend model
        const createdPurchase: Purchase = {
          id: response.purchaseId || response.id,
          supplierId: response.supplierId,
          supplier: response.supplier,
          invoiceDate: response.invoiceDate,
          referenceId: response.referenceId || response.invoiceNumber,
          totalAmount: response.totalAmount || 0,
          // Map items to the new structure for compatibility with interface
          items: response.items?.map((item: any) => ({
            medicineId: item.medicineId,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate,
            packQuantity: item.packQuantity || item.paidQuantity || 0,
            freePackQuantity: item.freePackQuantity || item.freeQuantity || 0,
            itemsPerPack: item.itemsPerPack || 1,
            purchaseCostPerPack: item.purchaseCostPerPack || item.purchaseCost || 0,
            discountPercentage: item.discountPercentage || item.discount || 0,
            mrpPerItem: item.mrpPerItem || item.mrp || 0,
            taxProfileId: item.taxProfileId || ''
          })) || [],
          // Also keep purchaseItems for backward compatibility
          purchaseItems: response.items?.map((item: any) => ({
            id: item.id,
            medicineId: item.medicineId,
            medicine: item.medicine,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate,
            paidQuantity: item.paidQuantity || item.quantity || 0,
            freeQuantity: item.freeQuantity || 0,
            purchaseCost: item.purchaseCost || item.cost || 0,
            mrp: item.mrp || 0
          })) || [],
          createdAt: response.createdAt
        };
        
        // Invalidate cache after successful creation
        this.refreshPurchasesCache();
        return createdPurchase;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error creating purchase:', error);
        return throwError(() => new Error('Failed to create purchase: ' + (error.error?.message || error.message)));
      })
    );
  }
  
  /**
   * Get sample purchase data for fallback
   * @returns Observable of sample Purchase[] array
   */
  private getSamplePurchases(): Observable<Purchase[]> {
    console.log('Falling back to sample purchase data');
    // Return mock data for development or fallback
    return of([
      {
        id: '1',
        supplierId: 'supplier-1',
        supplier: { id: 'supplier-1', name: 'ABC Pharmaceuticals', contactNumber: '1234567890', email: 'abc@example.com', address: '123 Main St' },
        invoiceDate: '2023-06-01',
        referenceId: 'INV-001',
        totalAmount: 5000,
        // Add items field required by Purchase interface
        items: [
          { 
            medicineId: 'med-1', 
            batchNo: 'B001', 
            expiryDate: '2024-12-31', 
            packQuantity: 100, 
            freePackQuantity: 5, 
            itemsPerPack: 10,
            purchaseCostPerPack: 45, 
            discountPercentage: 5,
            mrpPerItem: 55,
            taxProfileId: 'tax-1'
          }
        ],
        // Keep purchaseItems for backward compatibility
        purchaseItems: [
          {
            id: 'item-1',
            medicineId: 'med-1', 
            batchNo: 'B001', 
            expiryDate: '2024-12-31', 
            paidQuantity: 100, // Kept original field names for backward compatibility
            freeQuantity: 5, 
            purchaseCost: 45, 
            mrp: 55 
          }
        ],
        createdAt: '2023-06-01T10:00:00Z'
      }
    ]).pipe(delay(300)); // Simulate network delay
  }

  // ---- SALES API ----
  getSales(): Observable<Sale[]> {
    // Using exact endpoint from SalesController.java: @RequestMapping("/api/inventory/sales")
    return this.http.get<any[]>(`${environment.apiUrlInventory}/api/inventory/sales/`)
      .pipe(
        tap(sales => {
          console.log('Raw API sales response:', sales);
        }),
        // Map backend response to ensure consistent discount field mapping
        map((sales: any[]) => sales.map(sale => ({
          ...sale,
          // Ensure consistent discount field mapping
          discount: sale.totalDiscountAmount || sale.discount || 0,
          totalDiscountAmount: sale.totalDiscountAmount || sale.discount || 0,
          // Map item-level discounts consistently
          items: Array.isArray(sale.items) ? sale.items.map((item: any) => ({
            ...item,
            discount: item.discountPercentage || item.discount || 0,
            discountPercentage: item.discountPercentage || item.discount || 0
          })) : [],
          saleItems: Array.isArray(sale.saleItems) ? sale.saleItems.map((item: any) => ({
            ...item,
            discount: item.discountPercentage || item.discount || 0,
            discountPercentage: item.discountPercentage || item.discount || 0
          })) : []
        })))
      );
    
    // MOCK implementation - Commented out as we now use real API
    /* 
    console.log('Using mock sales data instead of API call');
    const mockSales: Sale[] = [...];
    return new Observable<Sale[]>(observer => {
      setTimeout(() => {
        observer.next(mockSales);
        observer.complete();
      }, 500);
    });
    */
  }

  deleteSale(id: string): Observable<any> {
    return this.http.delete<any>(`${environment.apiUrlInventory}/api/inventory/sales/${id}`)
      .pipe(
        tap(() => console.log(`Sale with ID ${id} deleted successfully`)),
        catchError((error) => {
          console.error(`Error deleting sale with ID ${id}:`, error);
          return throwError(() => new Error(`Failed to delete sale: ${error.message}`));
        })
      );
  }

  getSaleById(id: string): Observable<Sale> {
    return this.http.get<any>(`${environment.apiUrlInventory}/api/inventory/sales/${id}`)
      .pipe(
        map((sale: any) => {
          // Map backend sale data to frontend model with consistent discount mapping
          return {
            ...sale, // Preserve all original fields
            id: sale.saleId || sale.id,
            date: sale.saleDate || sale.date,
            totalAmount: sale.totalAmount,
            // Ensure consistent discount field mapping
            discount: sale.totalDiscountAmount || sale.discount || 0,
            totalDiscountAmount: sale.totalDiscountAmount || sale.discount || 0,
            tax: sale.tax || 0,
            netAmount: sale.netAmount,
            items: Array.isArray(sale.items) ? sale.items.map((item: any) => ({
              ...item, // Preserve all original item fields
              id: item.itemId || item.id,
              medicineId: item.medicineId,
              medicine: item.medicine ? {
                id: item.medicine.medicineId || item.medicine.id || '', // Ensure id is always a string
                name: item.medicine.name,
                unitOfMeasurement: item.medicine.unitOfMeasurement,
                lowStockThreshold: item.medicine.lowStockThreshold,
                stockQuantity: item.medicine.stockQuantity,
                stockStatus: item.medicine.stockStatus || 'NORMAL',
                taxProfileId: item.medicine.taxProfileId
              } : undefined,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              // Ensure consistent item-level discount mapping
              discount: item.discountPercentage || item.discount || 0,
              discountPercentage: item.discountPercentage || item.discount || 0,
              tax: item.tax || 0,
              total: item.total
            })) : [],
            status: sale.status || 'COMPLETED',
            patientName: sale.patientName || '',
            phoneNumber: sale.phoneNumber || '',
            saleType: sale.saleType || 'OTC',
            paymentMethod: sale.paymentMethod || 'CASH',
            notes: sale.notes || '',
            createdAt: sale.createdAt
          };
        })
      );
  }

  createOtcSale(saleData: CreateOtcSaleRequest): Observable<Sale> {
    // Real API implementation - using backend API now that CORS issues are fixed
    return this.http.post<any>(`${environment.apiUrlInventory}/api/inventory/sales/otc`, saleData)
      .pipe(
        map((response: any) => {
          // Map the backend response to our frontend model
          return {
            id: response.saleId || response.id,
            date: response.saleDate || response.date,
            totalAmount: response.totalAmount,
            discount: response.discount || 0,
            tax: response.tax || 0, 
            netAmount: response.netAmount,
            items: Array.isArray(response.items) ? response.items.map((item: any) => ({
              id: item.itemId || item.id,
              medicineId: item.medicineId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              tax: item.tax || 0,
              total: item.total
            })) : [],
            status: response.status || 'COMPLETED',
            patientName: response.patientName || 'Walk-in Customer',
            phoneNumber: response.phoneNumber,
            saleType: response.saleType || 'OTC',
            paymentMethod: response.paymentMethod,
            notes: response.notes || '',
            createdAt: response.createdAt
          };
        })
      );
    
    // MOCK implementation - Commented out as we now use real API
    /*
    console.log('Mock createOtcSale called with data:', saleData);
    const mockSale: Sale = { ... };
    return new Observable<Sale>(observer => {
      setTimeout(() => {
        observer.next(mockSale);
        observer.complete();
      }, 800);
    });
    */
  }

  /**
   * Update an existing OTC sale
   * @param id Sale ID to update
   * @param saleData Updated sale data
   * @returns Observable of updated sale
   */
  updateOtcSale(id: string, saleData: CreateOtcSaleRequest): Observable<Sale> {
    // Real API implementation for updating an OTC sale
    return this.http.put<any>(`${environment.apiUrlInventory}/api/inventory/sales/otc/${id}`, saleData)
      .pipe(
        map((response: any) => {
          // Map the backend response to our frontend model (same as createOtcSale)
          return {
            id: response.saleId || response.id,
            date: response.saleDate || response.date,
            totalAmount: response.totalAmount,
            discount: response.discount || 0,
            tax: response.tax || 0,
            netAmount: response.netAmount,
            items: Array.isArray(response.items) ? response.items.map((item: any) => ({
              id: item.itemId || item.id,
              medicineId: item.medicineId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              tax: item.tax || 0,
              total: item.total
            })) : [],
            status: response.status || 'COMPLETED',
            patientName: response.patientName || 'Walk-in Customer',
            phoneNumber: response.phoneNumber,
            saleType: response.saleType || 'OTC',
            paymentMethod: response.paymentMethod,
            notes: response.notes || '',
            createdAt: response.createdAt
          };
        }),
        catchError(error => {
          console.error('Error updating OTC sale:', error);
          return throwError(() => error);
        })
      );
  }

  createPrescriptionSale(saleData: CreatePrescriptionSaleRequest): Observable<Sale> {
    return this.http.post<Sale>(`${environment.apiUrlInventory}/api/inventory/sales/prescription`, saleData);
  }

  // ---- RETURNS API ----
  private returnsCache: any[] | null = null;
  
  /**
   * Gets all returns (both sales and purchase returns)
   * Uses new backend API endpoint
   */
  getReturns(): Observable<any[]> {
    // Backend API endpoint is now available
    const useApiIfAvailable = true;

    if (useApiIfAvailable) {
      // Real API implementation
      return this.http.get<any[]>(`${environment.apiUrlInventory}/api/inventory/returns`)
        .pipe(
          map((returns: any[]) => {
            console.log('Successfully retrieved returns from API');
            return this.mapReturnsData(returns);
          }),
          catchError((error: HttpErrorResponse) => {
            console.error('Error fetching returns:', error);
            return throwError(() => error);
          })
        );
    } else {
      // Mock implementation - no network requests
      console.log('Using mock returns data - API not yet available');
      return this.getMockReturns().pipe(
        map((returns: any[]) => this.mapReturnsData(returns))
      );
    }
  }

  /**
   * Gets only sales returns
   * Uses new backend API endpoint
   */
  getSalesReturns(): Observable<any[]> {
    // Backend API endpoint is now available
    const useApiIfAvailable = true;

    if (useApiIfAvailable) {
      // Real API implementation with confirmed endpoint
      const endpoint = `${environment.apiUrlInventory}/api/inventory/returns/sales`;
      // const endpoint = `${environment.apiUrl}/api/inventory/returns/sale`; // Alternative format

      return this.http.get<any[]>(endpoint)
        .pipe(
          map((returns: any[]) => {
            console.log('Successfully retrieved sales returns from API');
            return this.mapReturnsData(returns);
          }),
          catchError((error: HttpErrorResponse) => {
            console.error('Error fetching sales returns:', error);
            return throwError(() => error);
          })
        );
    } else {
      // Mock implementation - no network requests
      console.log('Using mock sales returns data - API not yet available');
      return this.getMockReturns('Sales Return').pipe(
        map((returns: any[]) => this.mapReturnsData(returns))
      );
    }
  }

  /**
   * Gets only purchase returns
   * Uses new backend API endpoint
   */
  getPurchaseReturns(): Observable<any[]> {
    // Backend API endpoint is now available
    const useApiIfAvailable = true;

    if (useApiIfAvailable) {
      // Real API implementation with confirmed endpoint
      const endpoint = `${environment.apiUrlInventory}/api/inventory/returns/purchases`;
      // const endpoint = `${environment.apiUrl}/api/inventory/returns/purchase`; // Alternative format

      return this.http.get<any[]>(endpoint)
        .pipe(
          map((returns: any[]) => {
            console.log('Successfully retrieved purchase returns from API');
            return this.mapReturnsData(returns);
          }),
          catchError((error: HttpErrorResponse) => {
            console.error('Error fetching purchase returns:', error);
            return throwError(() => error);
          })
        );
    } else {
      // Mock implementation - no network requests
      console.log('Using mock purchase returns data - API not yet available');
      return this.getMockReturns('Purchase Return').pipe(
        map((returns: any[]) => this.mapReturnsData(returns))
      );
    }
  }

  /**
   * Helper method to provide mock returns data
   */
  private getMockReturns(type?: string): Observable<any[]> {
    // Mock data for returns until backend implements the GET endpoint
    const mockReturns = [
      {
        id: 'ret_1',
        returnId: 'ret_1',
        date: new Date(),
        returnDate: new Date(),
        type: 'Sales Return',
        patientName: 'John Doe',
        medicineName: 'Paracetamol 500mg',
        quantity: 10,
        reason: 'Expired',
        staffName: 'Jane Smith'
      },
      {
        id: 'ret_2',
        returnId: 'ret_2',
        date: new Date(),
        returnDate: new Date(),
        type: 'Purchase Return',
        supplier: {
          id: 'sup_1',
          supplierId: 'sup_1',
          name: 'ABC Pharma'
        },
        medicineName: 'Amoxicillin 250mg',
        quantity: 20,
        reason: 'Damaged packaging',
        staffName: 'Jane Smith'
      }
    ];

    // If a specific type is requested, filter the mock data
    if (type) {
      return of(mockReturns.filter(item => item.type === type));
    }
    
    return of(mockReturns);
  }

  /**
   * Maps backend return data to frontend model
   */
  private mapReturnsData(returns: any[]): any[] {
    return returns.map((returnItem: any) => {
      // Map backend return data to frontend model
      return {
        id: returnItem.returnId || returnItem.id,
        originalSaleId: returnItem.originalSaleId,
        returnDate: returnItem.returnDate,
        refundAmount: returnItem.refundAmount,
        reason: returnItem.reason || '',
        returnItems: Array.isArray(returnItem.items) ? returnItem.items.map((item: any) => ({
          id: item.itemId || item.id,
          medicineId: item.medicineId,
          medicine: item.medicine ? {
            id: item.medicine.medicineId || item.medicine.id,
            name: item.medicine.name,
            unitOfMeasurement: item.medicine.unitOfMeasurement,
            lowStockThreshold: item.medicine.lowStockThreshold,
            stockQuantity: item.medicine.stockQuantity,
            stockStatus: item.medicine.stockStatus || StockStatus.NORMAL,
            taxProfileId: item.medicine.taxProfileId
          } : undefined,
          batchNo: item.batchNo,
          quantity: item.quantity,
          amount: item.amount
        })) : [],
        createdAt: returnItem.createdAt
      };
    });
  }
  
  /**
   * Get a specific return by ID and type
   * @param id Return ID to retrieve
   * @param type Type of return ('sales' or 'purchase')
   * @returns Observable with return details
   */
  getReturnById(id: string, type: string): Observable<any> {
    console.log(`Fetching ${type} return with ID: ${id}`);
    return this.http.get<any>(`${environment.apiUrlInventory}/api/inventory/returns/${type}/${id}`)
      .pipe(
        tap(data => console.log('Return details fetched:', data)),
        catchError(error => {
          console.error('Error fetching return details:', error);
          // Fallback to mock data for testing
          if (type === 'sales') {
            return this.getMockSalesReturnDetails(id);
          } else {
            return this.getMockPurchaseReturnDetails(id);
          }
        })
      );
  }

  /**
   * Mock data for testing sales return details
   * @param id Return ID for the mock data
   * @returns Observable with mock sales return details
   */
  private getMockSalesReturnDetails(id: string): Observable<any> {
    const currentDate = new Date().toISOString().split('T')[0];
    const mockReturn = {
      id: id,
      type: 'SALES',
      originalSaleId: `SL-${id.split('-')[1]}`,
      returnDate: currentDate,
      customerName: 'Sample Customer',
      customerMobile: '9876543210',
      refundAmount: 1250.50,
      refundMode: 'CASH',
      refundReference: '',
      reason: 'Medicine expired',
      items: [
        {
          medicineName: 'Paracetamol 500mg',
          medicineId: 'MED001',
          batchNo: 'B12345',
          returnQuantity: 10,
          unitPrice: 125.05,
          amount: 1250.50
        }
      ]
    };
    return of(mockReturn).pipe(delay(300));
  }
  
  /**
   * Mock data for testing purchase return details
   * @param id Return ID for the mock data
   * @returns Observable with mock purchase return details
   */
  private getMockPurchaseReturnDetails(id: string): Observable<any> {
    const currentDate = new Date().toISOString().split('T')[0];
    const mockReturn = {
      id: id,
      type: 'PURCHASE',
      originalPurchaseId: `PO-${id.split('-')[1]}`,
      returnDate: currentDate,
      supplierName: 'AJAX PHARMACEUTICALS',
      supplierGstin: 'GST12345678',
      refundAmount: 3540.25,
      reason: 'Wrong delivery',
      items: [
        {
          medicineName: 'Cetirizine 10mg',
          medicineId: 'MED002',
          batchNo: 'B67890',
          returnQuantity: 30,
          purchasePrice: 118.01,
          amount: 3540.25
        }
      ]
    };
    return of(mockReturn).pipe(delay(300));
  }

  /**
   * Delete a return by ID
   */
  deleteReturn(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrlInventory}/api/inventory/returns/${id}`)
      .pipe(
        tap(() => {
          console.log('Return successfully deleted');
          this.refreshReturnsCache();
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error deleting return:', error);
          return throwError(() => new Error(`Failed to delete return: ${error.message}`));
        })
      );
  }
  
  /**
   * Refreshes the returns data from the backend
   * Call this after creating/updating/deleting returns
   */
  private refreshReturnsCache(): void {
    console.log('Refreshing returns data from API...');
    // This will automatically refresh all returns data next time it's requested
    // You could also use a Subject/BehaviorSubject pattern here for reactive updates
    
    // Optionally force-refresh data now if needed
    this.getReturns().subscribe({
      next: (data) => console.log('Returns data refreshed successfully', data.length, 'records'),
      error: (err) => console.error('Failed to refresh returns data', err)
    });
  }

  /**
   * Create a sales return
   * Matches ReturnsController endpoint: @PostMapping("/sale")
   */
  createSalesReturn(returnData: CreateSalesReturnRequest): Observable<SalesReturn> {
    return this.http.post<SalesReturn>(`${environment.apiUrlInventory}/api/inventory/returns/sale`, returnData)
      .pipe(
        tap((response: SalesReturn) => {
          console.log('Sales return created successfully:', response);
          this.refreshReturnsCache();
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error creating sales return:', error);
          return throwError(() => new Error(`Failed to create sales return: ${error.message}`));
        })
      );
  }

  /**
   * Create a purchase return
   * Matches ReturnsController endpoint: @PostMapping("/purchase")
   */
  createPurchaseReturn(returnData: CreatePurchaseReturnRequest): Observable<PurchaseReturn> {
    return this.http.post<PurchaseReturn>(`${environment.apiUrlInventory}/api/inventory/returns/purchase`, returnData)
      .pipe(
        tap((response: PurchaseReturn) => {
          console.log('Purchase return created successfully:', response);
          this.refreshReturnsCache();
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error creating purchase return:', error);
          return throwError(() => new Error(`Failed to create purchase return: ${error.message}`));
        })
      );
  }
  
  // ---- REPORTS API ----
  // Stock Reports with mock implementation to handle CORS issues

  /**
   * Get stock by category report
   * @returns Observable of StockByCategoryItem array with stock quantity by category
   */
  getStockByCategory(): Observable<StockByCategoryItem[]> {
    const url = `${this.apiUrl}/api/inventory/reports/stock-by-category`;
    return this.http.get<StockByCategoryItem[]>(url).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error fetching stock by category data:', error);
        // Return empty array instead of mock data
        return throwError(() => error);
      })
    );
  }

  /**
   * Get daily sales report for a specific date
   * @param date The date to get sales data for (format: YYYY-MM-DD)
   * @returns Observable of DailySalesReport with sales data for the specified date
   */
  getDailySales(date: string): Observable<DailySalesReport> {
    const url = `${this.apiUrl}/api/inventory/reports/daily-sales?date=${date}`;
    return this.http.get<DailySalesReport>(url).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error(`Error fetching daily sales for date ${date}:`, error);
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Get weekly sales report for a specific week
   * @param startDate Start date of the week (format: YYYY-MM-DD)
   * @param endDate End date of the week (format: YYYY-MM-DD)
   * @returns Observable of sales data for the specified week
   */
  getWeeklySales(startDate: string, endDate: string): Observable<any> {
    const url = `${this.apiUrl}/api/inventory/reports/sales?startDate=${startDate}&endDate=${endDate}&period=WEEKLY`;
    return this.http.get<any>(url).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error(`Error fetching weekly sales for period ${startDate} to ${endDate}:`, error);
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Get quarterly sales report
   * @param year The year for the quarterly report
   * @param quarter The quarter number (1-4)
   * @returns Observable of sales data for the specified quarter
   */
  getQuarterlySales(year: number, quarter: number): Observable<any> {
    // Calculate start and end dates for the quarter
    const startMonth = (quarter - 1) * 3;
    const startDate = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
    
    let endMonth = startMonth + 3;
    let endYear = year;
    if (endMonth > 11) {
      endMonth = 0;
      endYear++;
    }
    
    // Last day of month calculation
    const lastDay = new Date(endYear, endMonth, 0).getDate();
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    const url = `${this.apiUrl}/api/inventory/reports/sales?startDate=${startDate}&endDate=${endDate}&period=QUARTERLY`;
    return this.http.get<any>(url).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error(`Error fetching quarterly sales for Q${quarter} ${year}:`, error);
        return throwError(() => error);
      })
    );
  }

  getExpiringMedicines(): Observable<ExpiringMedicine[]> {
    // Get purchase data to check actual batch expiry dates
    return this.getExpiringMedicinesFromPurchases();
  }

  // New method to get expiring medicines from purchase API data
  getExpiringMedicinesFromPurchases(): Observable<ExpiringMedicine[]> {
    // Fetch purchase data, medicines, and suppliers concurrently
    return forkJoin({
      purchases: this.http.get<any[]>(`${environment.apiUrlInventory}/api/inventory/purchases/`),
      medicines: this.getMedicines(),
      suppliers: this.getSuppliers()
    }).pipe(
      map(({ purchases, medicines, suppliers }) => {
        const today = new Date();
        const tenDaysFromNow = new Date();
        tenDaysFromNow.setDate(today.getDate() + 10); // Medicines expiring in the next 10 days
        
        console.log('Processing purchase data for expiring medicines:', purchases.length, 'purchases');
        console.log('Available medicines for mapping:', medicines.length);
        console.log('Available suppliers for mapping:', suppliers.length);
        
        // Create lookup maps for efficient searching
        const medicineMap = new Map<string, Medicine>();
        medicines.forEach(medicine => {
          medicineMap.set(medicine.medicineId || medicine.id, medicine);
        });
        
        const supplierMap = new Map<string, Supplier>();
        suppliers.forEach(supplier => {
          supplierMap.set(supplier.supplierId || supplier.id, supplier);
        });
        
        const expiringMedicines: ExpiringMedicine[] = [];
        const processedMedicines = new Map<string, ExpiringMedicine>(); // To avoid duplicates
        
        purchases.forEach(purchase => {
          if (purchase.items && Array.isArray(purchase.items)) {
            purchase.items.forEach((item: any) => {
              if (item.expiryDate && item.medicineId) {
                // Convert timestamp to date
                const expiryDate = new Date(item.expiryDate.seconds * 1000);
                const daysToExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                
                // Check if medicine is expired or expiring within 10 days
                if (daysToExpiry <= 10) {
                  const key = `${item.medicineId}_${item.batchNo}`;
                  
                  // Only add if not already processed or if this batch expires sooner
                  if (!processedMedicines.has(key) || processedMedicines.get(key)!.daysToExpiry > daysToExpiry) {
                    // Get medicine details
                    const medicine = medicineMap.get(item.medicineId);
                    const medicineName = medicine?.name || item.medicineName || `Medicine ${item.medicineId}`;
                    
                    // Get supplier details
                    const supplier = supplierMap.get(purchase.supplierId);
                    const supplierName = purchase.supplierName || supplier?.name || 'Unknown Supplier';
                    
                    const expiringMedicine: ExpiringMedicine = {
                      id: item.medicineId,
                      name: medicineName,
                      batchNo: item.batchNo || 'N/A',
                      expiryDate: expiryDate.toISOString(),
                      daysToExpiry: daysToExpiry,
                      quantity: item.totalReceivedQuantity || 0,
                      purchaseId: purchase.purchaseId,
                      referenceId: purchase.referenceId,
                      supplierId: purchase.supplierId,
                      supplierName: supplierName
                    };
                    
                    processedMedicines.set(key, expiringMedicine);
                  }
                }
              }
            });
          }
        });
        
        // Convert map to array and sort by days to expiry
        const result = Array.from(processedMedicines.values())
          .sort((a, b) => a.daysToExpiry - b.daysToExpiry);
        
        console.log('Found expiring medicines from purchases:', result.length);
        console.log('Enhanced expiring medicines with supplier names:', result);
        
        return result;
      }),
      catchError(error => {
        console.error('Error fetching purchase data for expiring medicines:', error);
        // Fallback to original method if purchase API fails
        return this.getExpiringMedicinesFromMedicinesAPI();
      })
    );
  }

  // Fallback method using medicines API (original implementation)
  private getExpiringMedicinesFromMedicinesAPI(): Observable<ExpiringMedicine[]> {
    return this.http.get<any[]>(`${environment.apiUrlInventory}/api/inventory/masters/medicines`)
      .pipe(
        map((medicines: any[]) => {
          const today = new Date();
          const tenDaysFromNow = new Date();
          tenDaysFromNow.setDate(today.getDate() + 10); // Medicines expiring in the next 10 days
          
          // Filter medicines with expiry dates within 10 days and map to ExpiringMedicine interface
          return medicines
            .filter(medicine => {
              if (!medicine.expiryDate) return false;
              
              const expiryDate = new Date(medicine.expiryDate);
              return expiryDate <= tenDaysFromNow;
            })
            .map(medicine => {
              const expiryDate = new Date(medicine.expiryDate);
              const daysToExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              
              return {
                id: medicine.medicineId || medicine.id,
                name: medicine.name,
                batchNo: medicine.batchNo || medicine.batchNumber || 'N/A',
                expiryDate: medicine.expiryDate,
                daysToExpiry: daysToExpiry,
                quantity: medicine.quantityInStock || medicine.quantity || 0
              };
            })
            // Sort by days to expiry (ascending)
            .sort((a, b) => a.daysToExpiry - b.daysToExpiry);
        })
      );
  }

  getLowStockMedicines(): Observable<LowStockMedicine[]> {
    // Using the general medicines endpoint since the low-stock endpoint doesn't exist
    return this.http.get<any[]>(`${environment.apiUrlInventory}/api/inventory/masters/medicines`)
      .pipe(
        map((medicines: any[]) => {
          console.log('🔍 Inventory service - Raw medicines data:', medicines.length);
          
          // Filter medicines where current stock is below the threshold
          const lowStockMedicines = medicines
            .filter(medicine => {
              const currentStock = Number(medicine.quantityInStock) || 0;
              const threshold = Number(medicine.lowStockThreshold) || 0; // Use actual threshold, not default
              const isActive = medicine.status === 'ACTIVE';
              const isLowStock = currentStock < threshold && isActive && threshold > 0;
              
              // Debug specific medicines
              if (medicine.name && (medicine.name.includes('Softina') || medicine.name.includes('Cirascreen'))) {
                console.log(`🔍 Service checking ${medicine.name}:`, {
                  currentStock,
                  threshold,
                  status: medicine.status,
                  isActive,
                  isLowStock
                });
              }
              
              return isLowStock;
            })
            .map(medicine => {
              // Map to LowStockMedicine interface
              return {
                id: medicine.medicineId || medicine.id,
                name: medicine.name,
                currentStock: medicine.quantityInStock || 0,
                threshold: medicine.lowStockThreshold || 0
              };
            })
            // Sort by stock level (ascending)
            .sort((a, b) => a.currentStock - b.currentStock);
            
          console.log('🔍 Inventory service - Low stock result:', {
            totalMedicines: medicines.length,
            lowStockCount: lowStockMedicines.length,
            lowStockItems: lowStockMedicines
          });
          
          return lowStockMedicines;
        })
      );
  }
  
  getInventorySummary(): Observable<InventorySummary> {
    // Real API implementation using backend API now that CORS issues are fixed
    return this.http.get<InventorySummary>(`${environment.apiUrlInventory}/api/inventory/reports/summary`)
      .pipe(
        map((summary: any) => {
          // Map backend data to frontend model
          return {
            totalMedicines: summary.totalMedicines || 0,
            lowStockMedicines: summary.lowStockMedicines || 0,
            expiringMedicines: summary.expiringMedicines || 0,
            totalSuppliers: summary.totalSuppliers || 0,
            totalPurchases: summary.totalPurchases || 0,
            totalSales: summary.totalSales || 0,
            recentSales: Array.isArray(summary.recentSales) ? summary.recentSales.map((sale: any) => ({
              id: sale.saleId || sale.id,
              date: sale.saleDate || sale.date,
              totalAmount: sale.totalAmount,
              netAmount: sale.netAmount
            })) : [],
            recentPurchases: Array.isArray(summary.recentPurchases) ? summary.recentPurchases.map((purchase: any) => ({
              id: purchase.purchaseId || purchase.id,
              invoiceDate: purchase.invoiceDate,
              totalAmount: purchase.totalAmount
            })) : []
          };
        })
      );
  }

  // Patient models are defined at the top of the file
  
  // Cache all patients for better searching performance
  private patientsCache: Patient[] | null = null;
  
  // Cache all doctors for better searching performance
  private doctorsCache: Doctor[] | null = null;
  
   private apiUrlOpd = `${environment.opdApiUrl}`;
  
  /**
   * Get all patients from the backend or cache
   * @returns Observable of Patient array containing all patients
   */
  getAllPatients(): Observable<Patient[]> {
    // If we already have cached patients, return them
    if (this.patientsCache) {
      return of(this.patientsCache);
    }

    // Try to get from backend API - using the correct URL provided
    return this.http.get<Patient[]>(`${this.apiUrlOpd}/api/patients`)
      .pipe(
        tap((patients: Patient[]) => {
          console.log('Successfully retrieved patients from API');
          this.patientsCache = patients;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error fetching patients:', error);
          // Fall back to sample data
          this.patientsCache = this.getSamplePatients();
          return of(this.patientsCache);
        })
      );
  }
  
  /**
   * Get sample patient data for development/fallback
   * @returns Array of sample patients
   */
  getSamplePatients(): Patient[] {
    return [
      { 
        id: 'PAT-2025-0001', 
        name: 'John Doe', 
        phoneNumber: '9876543210', 
        email: 'john@example.com',
        address: 'Sample Address, Chennai',
        gender: 'Male',
        active: true
      },
      { 
        id: 'PAT-2025-0002', 
        name: 'Murgan Siva', 
        phoneNumber: '2222222221', 
        address: 'Sample Street, Madurai, Tamilnadu - 222222',
        gender: 'Male',
        dateOfBirth: '1992-11-12',
        active: true
      },
      { 
        id: 'PAT-2025-0003', 
        name: 'Patient Three', 
        phoneNumber: '8888888888', 
        address: 'Sample Street, Chennai, gggg - 123456',
        gender: 'Female',
        dateOfBirth: '1996-02-16',
        active: true
      }
    ];
  }
  
  /**
   * Search patients by name or email
   * @param searchTerm The search term to look for in patient names or emails
   * @returns Observable of Patient array matching the search term
   */
  searchPatients(searchTerm: string): Observable<Patient[]> {
    // Use backend search API if available
    // For now, use local filtering from the full patient list endpoint
    return this.getAllPatients().pipe(
      map(patients => {
        const term = searchTerm.toLowerCase();
        return patients.filter(patient => 
          patient.name.toLowerCase().includes(term) || 
          (patient.email && patient.email.toLowerCase().includes(term))
        ).slice(0, 10); // Limit to 10 results
      })
    );
  }
  
  /**
   * Search patients by phone number
   * @param phoneNumber The phone number to search for
   * @returns Observable of Patient array matching the phone number
   */
  searchPatientsByPhone(phoneNumber: string): Observable<Patient[]> {
    // Use backend search API if available
    // For now, use local filtering from the full patient list endpoint
    return this.getAllPatients().pipe(
      map(patients => {
        return patients.filter(patient => 
          patient.phoneNumber && patient.phoneNumber.includes(phoneNumber)
        ).slice(0, 10); // Limit to 10 results
      })
    );
  }

  /**
   * Get all doctors from the backend and cache them
   * @returns Observable of Doctor array containing all doctors
   */
  getAllDoctors(): Observable<Doctor[]> {
    // If we already have doctors cached, return them
    if (this.doctorsCache !== null) {
      console.log('Using cached doctors:', this.doctorsCache.length);
      return of(this.doctorsCache);
    }
    
    // Using the OPD Management Service on port 8084
    const url = `${this.apiUrlOpd}/api/doctors`;
    return this.http.get<any>(url).pipe(
      map((response: any) => {
        // Handle API response format: { success: true, message: string, data: Doctor[] }
        let doctorsData: any[] = [];
        
        if (response && response.data && Array.isArray(response.data)) {
          doctorsData = response.data;
        } else if (Array.isArray(response)) {
          doctorsData = response;
        } else {
          return [];
        }

        const doctors: Doctor[] = doctorsData.map((doctor: any) => ({
          id: doctor.id || '',
          name: doctor.name || 'Unknown Doctor',
          specialization: doctor.specialization || ''
        })).filter((doctor: Doctor) => doctor.name && doctor.name !== 'Unknown Doctor');

        this.doctorsCache = doctors;
        console.log('Cached doctors from API:', doctors.length);
        return doctors;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error fetching doctors:', error);
        // Return sample doctors for development/fallback
        const sampleDoctors = this.getSampleDoctors();
        this.doctorsCache = sampleDoctors;
        console.log('Using sample doctors:', sampleDoctors.length);
        return of(sampleDoctors);
      })
    );
  }

  /**
   * Get list of doctors from backend API or cache
   * @returns Observable of Doctor array containing all doctors
   */
  getDoctors(): Observable<Doctor[]> {
    return this.getAllDoctors();
  }
  
  /**
   * Search doctors by name
   * @param searchTerm The search term to look for in doctor names
   * @returns Observable of Doctor array matching the search term
   */
  searchDoctors(searchTerm: string): Observable<Doctor[]> {
    // Get all doctors and filter locally
    return this.getAllDoctors().pipe(
      map((doctors: Doctor[]) => {
        if (!searchTerm || searchTerm.trim() === '') {
          // If no search term, return all doctors (limited to 10)
          return doctors.slice(0, 10);
        }
        
        const term = searchTerm.toLowerCase().trim();
        console.log('Searching doctors for term:', term);
        
        // Case insensitive search that's more lenient
        const results = doctors.filter((doctor: Doctor) => {
          if (!doctor.name) return false;
          return doctor.name.toLowerCase().includes(term);
        });
        
        console.log('Found doctors:', results.length, results);
        return results.length > 0 ? results : doctors.slice(0, 10); // Show all doctors if no matches
      }),
      catchError((error: Error) => {
        console.error('Error in searchDoctors:', error);
        return of(this.getSampleDoctors());
      })
    );
  }
  
  /**
   * Get sample doctors for development/fallback
   * @returns Array of sample doctor data
   */
  getSampleDoctors(): Doctor[] {
    return [
      { id: 'dr1', name: 'Dr. Ravi Kumar', specialization: 'General Medicine' },
      { id: 'dr2', name: 'Dr. Anitha Reddy', specialization: 'Pediatrics' },
      { id: 'dr3', name: 'Dr. Mahesh Sharma', specialization: 'Cardiology' },
      { id: 'dr4', name: 'Dr. Priya Singh', specialization: 'Dermatology' }
    ];
  }
  
  // Medicine search and batch information methods
  
  /**
   * Search medicines by name or other identifiers
   * @param searchTerm The search term to look for in medicine names or other fields
   * @returns Observable of Medicine array matching the search term
   */
  searchMedicines(searchTerm: string): Observable<Medicine[]> {
    const url = `${this.apiUrl}/medicines/search?term=${encodeURIComponent(searchTerm)}`;
    return this.http.get<Medicine[]>(url).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error searching medicines:', error);
        // Use the cached medicines for local search if API fails
        if (this.medicinesCache) {
          const term = searchTerm.toLowerCase();
          const results = this.medicinesCache.filter((med: Medicine) => 
            med.name.toLowerCase().includes(term)
          );
          return of(results);
        }
        // If no cache, get medicines first
        return this.getMedicines().pipe(
          map((medicines: Medicine[]) => {
            const term = searchTerm.toLowerCase();
            return medicines.filter((med: Medicine) => med.name.toLowerCase().includes(term));
          })
        );
      })
    );
  }
  
  /**
   * Get latest batch information for a medicine
   * @param medicineId The ID of the medicine to get batch info for
   * @returns Observable of MedicineBatch with latest batch information
   */
  getMedicineBatch(medicineId: string): Observable<MedicineBatch> {
    const url = `${this.apiUrl}/medicines/${medicineId}/batches/latest`;
    return this.http.get<MedicineBatch>(url).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error fetching medicine batch info:', error);
        // Return sample batch data for development/fallback
        return of({
          batchNumber: `BATCH-${Math.floor(1000 + Math.random() * 9000)}`,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          mrp: Math.floor(50 + Math.random() * 500),
          quantity: Math.floor(10 + Math.random() * 50),
          taxPercentage: [5, 12, 18][Math.floor(Math.random() * 3)]
        });
      })
    );
  }

  /**
   * Format a sale ID for display (e.g. SALE-12345)
   * @param id The raw sale ID to format
   * @returns Formatted sale ID string
   */
  formatSaleId(id: string): string {
    if (!id) return 'N/A';
    return id.includes('SALE-') ? id : `SALE-${id}`;
  }
  
  /**
   * Format a purchase ID for display (e.g. PUR-12345)
   * @param id The raw purchase ID to format
   * @returns Formatted purchase ID string
   */
  formatPurchaseId(id: string): string {
    if (!id) return 'N/A';
    return id.includes('PUR-') ? id : `PUR-${id}`;
  }
  
  /**
   * Format a return ID for display (e.g. RET-12345)
   * @param id The raw return ID to format
   * @returns Formatted return ID string
   */
  formatReturnId(id: string): string {
    if (!id) return 'N/A';
    return id.includes('RET-') ? id : `RET-${id}`;
  }

  // Note: Using the existing getMedicines method instead of duplicating functionality

  /**
   * Get sample medicine data for development/fallback
   * Used as fallback when getMedicines() fails to fetch from API
   * @returns Array of sample medicines
   */
  getSampleMedicines(): Medicine[] {
    return [
      { 
        id: 'm1', 
        name: 'Paracetamol', 
        sku: 'PARA500', 
        category: 'Analgesic',
        unitOfMeasurement: 'Tablet',
        lowStockThreshold: 20,
        stockQuantity: 100,
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'tax1'
      },
      { 
        id: 'm2', 
        name: 'Amoxicillin', 
        sku: 'AMOX250', 
        category: 'Antibiotic',
        unitOfMeasurement: 'Capsule',
        lowStockThreshold: 15,
        stockQuantity: 75,
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'tax1'
      },
      { 
        id: 'm3', 
        name: 'Cetirizine', 
        sku: 'CET10', 
        category: 'Antiallergic',
        unitOfMeasurement: 'Tablet',
        lowStockThreshold: 10,
        stockQuantity: 50,
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'tax2'
      },
      { 
        id: 'm4', 
        name: 'Ibuprofen', 
        sku: 'IBU400', 
        category: 'NSAID',
        unitOfMeasurement: 'Tablet',
        lowStockThreshold: 25,
        stockQuantity: 120,
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'tax2'
      },
      { 
        id: 'm5', 
        name: 'Metformin', 
        sku: 'MET500', 
        category: 'Antidiabetic',
        unitOfMeasurement: 'Tablet',
        lowStockThreshold: 20,
        stockQuantity: 80,
        stockStatus: StockStatus.NORMAL,
        taxProfileId: 'tax1'
      }
    ];
  }
}
