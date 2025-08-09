// Medicine summary and details
export interface MedicineSummary {
  id: string;
  name: string;
  genericName?: string;
  stockQuantity: number;
  stockStatus: StockStatus;
  unitOfMeasurement: string;
  mrp?: number;
}

export interface MedicineDetails extends Medicine {
  batchDetails?: BatchDetails[];
}

export interface BatchDetails {
  batchNo: string;
  expiryDate: string;
  quantity: number;
  purchaseCost: number;
  mrp: number;
}

// Medicine models
export interface Medicine {
  id: string;
  medicineId?: string; // Added for compatibility with backend model
  name: string;
  category?: string; // New field from CreateMedicineRequest
  sku?: string; // New field from CreateMedicineRequest
  hsnCode?: string; // New field from CreateMedicineRequest (replaces hsn)
  unitOfMeasurement: string;
  lowStockThreshold: number;
  stockQuantity: number;
  quantityInStock?: number; // Added for API response mapping
  stockStatus: StockStatus;
  taxProfileId: string;
  taxProfile?: TaxProfile;
  unitPrice?: number; // New field from CreateMedicineRequest
  status?: 'ACTIVE' | 'INACTIVE'; // Used to filter out inactive/deleted items
  createdAt?: string;
  updatedAt?: string;
  
  // Legacy fields kept for backward compatibility
  generic?: string;
  genericName?: string; // Generic name for the medicine
  group?: string;
  groupName?: string; // Group name for the medicine
  company?: string;
  companyName?: string; // Company/manufacturer name
  manufacturer?: string;
  reorderReminder?: string; // Reminder threshold for reordering
  location?: string; // Storage location
  hsn?: string; // Old HSN code field (replaced by hsnCode)
  mrp?: number; // Maximum Retail Price
  purchasePrice?: number; // Default purchase price
  sellingPrice?: number; // Default selling price
  // Tax related fields
  cgstPercentage?: number;
  sgstPercentage?: number;
}

export enum StockStatus {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  OUT_OF_STOCK = 'OUT_OF_STOCK'
}

// Tax Profile models
export interface TaxProfile {
  id: string;
  taxProfileId?: string;
  profileName: string;
  totalRate: number;
  status?: string;
  components: TaxComponent[];
}

export interface TaxComponent {
  id?: string;
  componentName: string;
  rate: number;
}

// Supplier models
export interface Supplier {
  id: string; // Made non-optional as components depend on it being a string
  supplierId?: string; // New API uses supplierId, mapped to id in service
  name: string;
  address?: string;
  mobileNumber?: string; // New field from API
  contactNumber?: string; // For backward compatibility
  email?: string;
  gstin?: string; // New field from API
  gstNumber?: string; // For backward compatibility
  contactPerson?: string;
  drugLicense?: string;
  drugLicenseNumber?: string; // Required by backend validation
  balance?: number;
  outstandingBalance?: number; // Outstanding balance from API response
  createdAt?: any; // Timestamp object with seconds and nanos
  createdBy?: string;
  status?: string;
}

// Sale models
// Timestamp format received from Firestore backend
export interface TimestampFormat {
  seconds: number;
  nanos: number;
}

// Sale Item in a sale transaction
export interface SaleItem {
  id?: string;
  medicineId: string;
  batchNo?: string;
  quantity: number;
  salePrice?: number;
  discountAmount?: number;
  taxProfileId?: string;
  taxAmount?: number;
  mrpPerItem?: number;
  discountPercentage?: number;
  lineItemDiscountAmount?: number;
  lineItemTaxableAmount?: number;
  lineItemTotalAmount?: number;
  taxRateApplied?: number;
  
  // Additional fields for UI display
  medicine?: Medicine | any;
  medicineName?: string;
  manufacturer?: string;
  expiryDate?: string;
  unitPrice?: number;
  unitCost?: number;
  discount?: number;
  tax?: number;
  total?: number;
  
  // For GST details
  cgstAmount?: number;
  sgstAmount?: number;
  cgstPercentage?: number;
  sgstPercentage?: number;
  taxPercentage?: number;
  taxableAmount?: number;
}

// Sale interface matching backend response
export interface Sale {
  // For backward compatibility with existing code
  id?: string;
  // New API fields
  saleId?: string;
  organizationId?: string;
  branchId?: string;
  saleType: string;
  saleDate?: string | TimestampFormat;
  createdBy?: string;
  patientId?: string;
  patientName?: string;
  phoneNumber?: string;
  patientMobile?: string; // Added for mapping patient mobile
  walkInCustomerName?: string;
  walkInCustomerMobile?: string;
  doctorId?: string;
  doctorName?: string; // Added for doctor name
  prescriptionDate?: string | TimestampFormat;
  totalTaxableAmount?: number;
  totalTaxAmount?: number;
  totalTax?: number; // Added to match API response
  grandTotal?: number;
  totalMrpAmount?: number;
  totalDiscountAmount?: number;
  totalDiscount?: number; // Added to match API response
  items: SaleItem[];
  
  // Legacy fields for backward compatibility
  date?: string;
  totalAmount?: number;
  netAmount?: number;
  paymentMethod?: string;
  paymentMode?: string; // Added to match API response
  status?: string;
  createdAt?: string;
  
  // No duplicate fields needed
  saleItems?: SaleItem[]; // Alias for items
  
  // Additional fields for UI display
  subtotal?: number;
  tax?: number;
  discount?: number;
  gstType?: 'INCLUSIVE' | 'EXCLUSIVE' | 'NON_GST';
  printGst?: boolean;
  paymentStatus?: string;
  transactionReference?: string;
  notes?: string;
  
  // For GST details
  cgstAmount?: number;
  sgstAmount?: number;
  cgstPercentage?: number;
  sgstPercentage?: number;
}

// Legacy SaleItem interface removed to avoid duplication

// Service models
export interface Service {
  id: string;
  name: string;
  description: string;
  group: string;
  rate: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Purchase models
export interface Purchase {
  id?: string;
  purchaseId?: string; // From API response
  supplierId: string;
  supplier?: Supplier;
  supplierName?: string; // Added to match API response structure
  invoiceDate: string | any; // Can be string or timestamp object with seconds/nanos
  referenceId?: string;
  totalAmount: number;
  totalTaxableAmount?: number;
  totalDiscountAmount?: number;
  totalTaxAmount?: number;
  gstType?: string; // "EXCLUSIVE", "INCLUSIVE", "NON_GST"
  organizationId?: string;
  branchId?: string;
  createdBy?: string;
  createdAt?: string | any; // Can be string or timestamp object
  items: PurchaseItemDto[];
  purchaseItems?: PurchaseItem[]; // For backward compatibility
  paymentMethod?: string;
  paymentStatus?: string; // "PENDING", "PAID", "PARTIALLY_PAID"
  notes?: string;
  
  // Additional fields from API response
  amountPaid?: number;
  dueAmount?: number;
}

// CreatePurchaseRequest matches backend DTO
export interface CreatePurchaseRequest {
  supplierId: string;
  invoiceDate: string; // Will be converted to Date in the backend
  referenceId?: string; // Optional invoice number from the supplier
  gstType: string; // "EXCLUSIVE" or "INCLUSIVE"
  items: PurchaseItemDto[];
  // Payment fields required by the backend API
  amountPaid: number;
  paymentMode: string; // 'CASH', 'CARD', 'UPI', etc.
  paymentReference: string; // Reference number for non-cash payments
}

// PurchaseItemDto matches backend DTO for create/update operations
export interface PurchaseItemDto {
  medicineId: string;
  medicineName?: string; // Added to match API response
  batchNo: string;
  expiryDate: string | any; // Can be string or timestamp object with seconds/nanos
  packQuantity: number;
  freePackQuantity: number;
  itemsPerPack: number;
  totalReceivedQuantity?: number;
  purchaseCostPerPack: number;
  discountPercentage: number;
  lineItemDiscountAmount?: number;
  lineItemTaxableAmount?: number;
  lineItemTaxAmount?: number;
  lineItemTotalAmount?: number;
  mrpPerItem: number;
  taxProfileId: string;
  taxRateApplied?: number;
  taxComponents?: TaxComponentItem[];
  createdBatchId?: string; // Added to match API response
}

export interface TaxComponentItem {
  name: string;
  rate: number;
  taxAmount?: number;
}

// Original PurchaseItem for backward compatibility
export interface PurchaseItem {
  id?: string;
  medicineId: string;
  medicine?: Medicine;
  batchNo: string;
  expiryDate: string;
  paidQuantity: number;
  freeQuantity: number;
  purchaseCost: number;
  mrp: number;
}

// These interfaces are already defined above

// Return models
export interface SalesReturn {
  id: string;
  originalSaleId: string;
  returnDate: string;
  refundAmount: number;
  reason?: string;
  returnItems: ReturnItem[];
  createdAt?: string;
}

export interface PurchaseReturn {
  id: string;
  originalPurchaseId: string;
  returnDate: string;
  refundAmount: number;
  reason?: string;
  returnItems: ReturnItem[];
  createdAt?: string;
}

export interface ReturnItem {
  id?: string;
  medicineId: string;
  medicine?: Medicine;
  batchNo: string;
  quantity: number;
  amount: number;
}

// Purchase Report models
export interface PurchaseSummary {
  id: string;
  invoiceDate: string;
  supplier: {
    name: string;
  };
  totalAmount: number;
  items: number;
}

export interface PurchaseDateFilter {
  startDate: string;
  endDate: string;
}

// Return Report models
export interface ReturnReport {
  id: string;
  returnDate: string;
  originalInvoiceId: string;
  refundAmount: number;
  reason: string;
  items: ReturnRequestItem[];
}

export interface ReturnRequestItem {
  medicineId: string;
  medicineName?: string;
  batchNo: string;
  quantity: number;
  amount: number;
  reason?: string;
}

export interface CreateReturnRequest {
  originalInvoiceId: string;
  returnDate: string;
  reason: string;
  items: ReturnRequestItem[];
}

export interface ReturnReasonSummary {
  reason: string;
  count: number;
  totalAmount: number;
}

// Report models

// Stock by Category Report
export interface StockByCategoryItem {
  category: string;
  totalStock: number;
}

// Daily Sales Report
export interface DailySalesReport {
  organizationId: string;
  branchId: string;
  date: string;
  totalSales: number;
  transactionCount: number;
}

export interface ExpiringMedicine {
  id: string;
  name: string;
  batchNo: string;
  expiryDate: string;
  // Support both field names for backward compatibility
  daysToExpiry: number;
  daysRemaining?: number;
  quantity: number;
  stockQuantity?: number;
  // New fields for purchase tracking
  purchaseId?: string;
  referenceId?: string;
  // New fields for supplier information
  supplierId?: string;
  supplierName?: string;
}

export interface LowStockMedicine {
  id: string;
  name: string;
  currentStock: number;
  // Support both field names for backward compatibility
  threshold: number;
  lowStockThreshold?: number;
}

// Dashboard Summary
export interface InventorySummary {
  totalMedicines: number;
  lowStockMedicines: number;
  expiringMedicines: number;
  totalSuppliers: number;
  totalPurchases: number;
  totalSales: number;
  recentSales: Sale[];
  recentPurchases: Purchase[];
}

export interface Group {
  id: string;
  name: string;
}

export interface Generic {
  id: string;
  name: string;
}

export interface Company {
  id: string;
  name: string;
}
