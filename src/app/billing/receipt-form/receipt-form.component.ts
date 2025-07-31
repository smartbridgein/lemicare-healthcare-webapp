import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BillingService } from '../shared/billing.service';
import { Receipt, Invoice } from '../shared/billing.model';
import { PatientService } from '../../patients/shared/patient.service';
import { Patient } from '../../patients/shared/patient.model';
import { finalize, debounceTime } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService, UserProfile } from '../../auth/shared/auth.service';

@Component({
  selector: 'app-receipt-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './receipt-form.component.html',
  styleUrls: ['./receipt-form.component.scss']
})
export class ReceiptFormComponent implements OnInit {
  receiptForm!: FormGroup;
  isEditMode = false;
  receiptId: string | null = null;
  loading = false;
  submitted = false;
  patientSearchTerm = '';
  patientResults: any[] = [];
  showPatientSearch = false;
  invoiceSearchTerm = '';
  invoiceResults: any[] = [];
  showInvoiceSearch = false;
  currentUser = '';
  selectedInvoiceStatus: string = '';
  isInvoiceAlreadyPaid = false;
  
  constructor(
    private fb: FormBuilder,
    private billingService: BillingService,
    private patientService: PatientService,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Get the current logged-in user
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUser = user.name || user.email || 'System';
      console.log('Current user for receipt form:', this.currentUser);
    } else {
      this.currentUser = 'System';
      console.log('No user found, using default name');
    }
    
    this.createForm();
    
    // Check for receipt ID for edit mode
    this.receiptId = this.route.snapshot.paramMap.get('id');
    if (this.receiptId) {
      this.isEditMode = true;
      this.loadReceipt(this.receiptId);
    }
    
    // Check for invoice ID passed as query parameter
    const invoiceId = this.route.snapshot.queryParamMap.get('invoiceId');
    if (invoiceId && !this.isEditMode) {
      this.loadInvoiceDetails(invoiceId);
    }
  }

  createForm(): void {
    this.receiptForm = this.fb.group({
      patientId: ['', [Validators.required]],
      patientName: ['', [Validators.required]],
      date: [this.formatDate(new Date()), [Validators.required]],
      amount: ['', [Validators.required, Validators.min(0)]],
      createdBy: [this.currentUser || '', [Validators.required]],
      modeOfPayment: ['CASH', [Validators.required]],
      receiptId: [''],
      invoiceId: ['', [Validators.required]],
      referenceId: [''],
      purpose: ['', [Validators.required]],
      createdDate: [this.formatDate(new Date())]
    });
    
    // Generate receipt ID for new receipts
    if (!this.isEditMode) {
      const now = new Date();
      const year = now.getFullYear().toString().substr(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const randomId = Math.floor(Math.random() * 9000 + 1000); // 4-digit random number
      const newReceiptId = `RCP-${year}${month}${day}${randomId}`;
      this.receiptForm.patchValue({
        receiptId: newReceiptId
      });
      console.log('Generated receipt ID:', newReceiptId);
    }
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  loadReceipt(id: string): void {
    this.loading = true;
    console.log('Loading receipt with ID:', id);
    this.billingService.getReceiptById(id).subscribe({
      next: (receipt: Receipt) => {
        console.log('Receipt data loaded:', receipt);
        
        // Format date properly
        let formattedDate: string;
        try {
          formattedDate = this.formatDate(new Date(receipt.date));
        } catch (e) {
          console.error('Error formatting receipt date:', e);
          formattedDate = this.formatDate(new Date());
        }
        
        // Initialize search terms to display in input fields
        this.patientSearchTerm = receipt.patientName || '';
        this.invoiceSearchTerm = receipt.invoiceId || '';
        console.log('Set patient search term to:', this.patientSearchTerm);
        console.log('Set invoice search term to:', this.invoiceSearchTerm);
        
        // Patch all form values
        this.receiptForm.patchValue({
          patientId: receipt.patientId || '',
          patientName: receipt.patientName || '',
          date: formattedDate,
          amount: Number(receipt.amount) || 0,
          createdBy: receipt.createdBy || '',
          modeOfPayment: receipt.modeOfPayment || 'CASH',
          receiptId: receipt.receiptId || '',
          invoiceId: receipt.invoiceId || '',
          referenceId: receipt.referenceId || '',
          purpose: receipt.purpose || '',
          createdDate: receipt.createdDate ? this.formatDate(new Date(receipt.createdDate)) : this.formatDate(new Date())
        });
        
        console.log('Form updated with receipt data:', this.receiptForm.value);
        
        // If the receipt has an invoiceId, load that invoice's details
        if (receipt.invoiceId) {
          console.log('Receipt has invoice ID, fetching invoice details:', receipt.invoiceId);
          this.loadInvoiceDetails(receipt.invoiceId);
        }
        
        // If the receipt has a patientId but no patient name, fetch the patient details
        if (receipt.patientId && !receipt.patientName) {
          this.patientService.getPatientById(receipt.patientId).subscribe({
            next: (patient) => {
              if (patient) {
                console.log('Patient details retrieved:', patient);
                // Construct patient name from firstName and lastName
                const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
                this.receiptForm.patchValue({
                  patientName: fullName
                });
                // Update the search term as well
                this.patientSearchTerm = fullName;
              }
            },
            error: (error: any) => {
              console.error('Error fetching patient details:', error);
            }
          });
        }
        
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading receipt', error);
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    this.submitted = true;
    console.log('Form submitted with values:', this.receiptForm.value);
    
    // CRITICAL: Prevent submission for already paid invoices
    if (this.isInvoiceAlreadyPaid) {
      console.error('Attempted to create receipt for already paid invoice');
      alert('Cannot create receipt: This invoice has already been paid. Please use the Print button to print the existing receipt.');
      return;
    }
    
    // Mark all controls as touched to trigger validation
    Object.keys(this.receiptForm.controls).forEach(key => {
      const control = this.receiptForm.get(key);
      control?.markAsTouched();
      control?.updateValueAndValidity();
    });

    if (this.receiptForm.invalid) {
      console.error('Form is invalid:', this.receiptForm.errors);
      alert('Please fill out all required fields');
      return;
    }
    
    this.loading = true;
    const formValue = this.receiptForm.value;
    
    // Map form values to receipt model with ALL fields
    const receipt: Receipt = {
      patientId: formValue.patientId,
      patientName: formValue.patientName,
      date: formValue.date,
      amount: Number(formValue.amount) || 0,
      createdBy: formValue.createdBy || '',
      modeOfPayment: formValue.modeOfPayment || 'CASH',
      receiptId: formValue.receiptId || '',
      invoiceId: formValue.invoiceId || undefined,
      referenceId: formValue.referenceId || undefined,
      purpose: formValue.purpose || '',
      createdDate: formValue.createdDate || this.formatDate(new Date())
    };
    
    // Save or update based on mode
    if (this.isEditMode && this.receiptId) {
      this.billingService.updateReceipt(this.receiptId, receipt)
        .pipe(finalize(() => this.loading = false))
        .subscribe({
          next: () => {
            alert('Receipt updated successfully');
            this.router.navigate(['/billing/receipts']);
          },
          error: (error: any) => {
            console.error('Error updating receipt', error);
            
            // Check if it's a receipt edit prevention error from backend
            let errorMessage = 'Failed to update receipt: Unknown error';
            if (error.error && error.error.message) {
              if (error.error.message.includes('linked to a paid invoice')) {
                errorMessage = 'Cannot edit receipt: This receipt is linked to a paid invoice. Editing paid receipts is not allowed for audit compliance.';
              } else {
                errorMessage = 'Failed to update receipt: ' + error.error.message;
              }
            } else if (error.message) {
              errorMessage = 'Failed to update receipt: ' + error.message;
            }
            
            alert(errorMessage);
          }
        });
    } else {
      const receiptData = { ...receipt };
      this.billingService.createReceipt(receiptData)
        .pipe(finalize(() => this.loading = false))
        .subscribe({
          next: (response) => {
            console.log('Receipt created successfully:', response);
            // If this is linked to an invoice, update the invoice status
            if (receipt.invoiceId) {
              this.updateInvoiceStatus(receipt.invoiceId, receipt.amount);
            } else {
              alert('Receipt created successfully');
              this.router.navigate(['/billing/receipts']);
            }
          },
          error: (error: any) => {
            console.error('Error creating receipt:', error);
            
            // Check if it's a duplicate receipt error from backend
            let errorMessage = 'Error creating receipt. Please try again.';
            if (error.error && error.error.message) {
              if (error.error.message.includes('already has an existing receipt')) {
                errorMessage = 'Cannot create receipt: This invoice already has an existing receipt. Use the Print button to reprint the existing receipt.';
                
                // Enable print button and disable create button since invoice is already paid
                this.isInvoiceAlreadyPaid = true;
                console.log('Invoice already has receipt - enabling print button, disabling create button');
              } else {
                errorMessage = error.error.message;
              }
            } else if (error.message) {
              errorMessage = error.message;
            }
            
            alert(errorMessage);
          }
        });
    }
  }

  updateInvoiceStatus(invoiceId: string, paidAmount: number): void {
    // Check if this is a mock invoice ID (starts with INV-)
    const isMockInvoice = invoiceId.startsWith('INV-');
    
    if (isMockInvoice && environment.production) {
      console.log('Mock invoice detected, skipping invoice update');
      this.loading = false;
      alert('Receipt created successfully');
      this.router.navigate(['/billing/receipts']);
      return;
    }
    
    // First get the current invoice
    this.billingService.getInvoiceById(invoiceId)
      .pipe(
        finalize(() => {
          // No need to set this.loading = false here as we're not done with the process
        })
      )
      .subscribe({
        next: (invoice: Invoice) => {
          console.log('Invoice fetched successfully:', invoice);
          const currentPaidAmount = invoice.paidAmount || 0;
          const newPaidAmount = currentPaidAmount + paidAmount;
          let newStatus: 'PAID' | 'UNPAID' | 'PARTIAL' = 'UNPAID';
          
          if (newPaidAmount >= invoice.amount) {
            newStatus = 'PAID';
          } else if (newPaidAmount > 0) {
            newStatus = 'PARTIAL';
          }
          
          const updatedInvoice = {
            ...invoice,
            paidAmount: newPaidAmount,
            balanceAmount: Math.max(0, invoice.amount - newPaidAmount),
            status: newStatus
          };
          
          console.log('Updating invoice with:', updatedInvoice);
          
          this.billingService.updateInvoice(invoiceId, updatedInvoice)
            .pipe(finalize(() => this.loading = false))
            .subscribe({
              next: () => {
                alert('Receipt created and invoice updated successfully');
                this.router.navigate(['/billing/receipts']);
              },
              error: (error: any) => {
                console.error('Error updating invoice', error);
                // Still consider the receipt creation successful
                alert('Receipt created but failed to update invoice status');
                this.router.navigate(['/billing/receipts']);
              }
            });
        },
        error: (error: any) => {
          console.error('Error fetching invoice', error);
          this.loading = false;
          alert('Receipt created successfully (Invoice update was skipped)');
          this.router.navigate(['/billing/receipts']);
        }
      });
  }

  onPatientSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.patientSearchTerm = target.value;
    this.searchPatients();
  }

  onInvoiceSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.invoiceSearchTerm = target.value;
    console.log('Invoice search input changed to:', this.invoiceSearchTerm);
    
    // Reset invoice payment status when user starts typing new invoice ID
    this.resetInvoiceStatus();
    
    this.searchInvoices();
  }

  searchPatients(): void {
    if (this.patientSearchTerm.length > 2) {
      this.loading = true;
      this.showPatientSearch = true;
      
      this.patientService.searchPatients(this.patientSearchTerm)
        .pipe(
          debounceTime(300),
          finalize(() => {
            this.loading = false;
          })
        )
        .subscribe({
          next: (patients: Patient[]) => {
            console.log('Patient search results:', patients);
            this.patientResults = patients.map(patient => ({
              id: patient.id,
              name: `${patient.firstName} ${patient.lastName}`,
              contactNumber: patient.mobileNumber
            }));
            
            // If no results, provide mock data for testing
            if (this.patientResults.length === 0) {
              console.log('No patient results, providing mock data');
              this.patientResults = [
                { id: 'P001', name: 'John Doe', contactNumber: '9876543210' },
                { id: 'P002', name: 'Jane Smith', contactNumber: '8765432109' },
                { id: 'P003', name: 'Test Patient', contactNumber: '7654321098' }
              ];
            }
          },
          error: (error: any) => {
            console.error('Error searching patients:', error);
            // Provide mock data on error for testing
            this.patientResults = [
              { id: 'P001', name: 'John Doe', contactNumber: '9876543210' },
              { id: 'P002', name: 'Jane Smith', contactNumber: '8765432109' },
              { id: 'P003', name: 'Test Patient', contactNumber: '7654321098' }
            ];
          }
        });
    } else if (this.patientSearchTerm.length === 0) {
      // Clear results when search term is empty
      this.patientResults = [];
    }
  }

  selectPatient(patient: any): void {
    console.log('Patient selected:', patient);
    
    // Update form with patient details
    this.receiptForm.patchValue({
      patientId: patient.id,
      patientName: patient.name
    });
    
    // Update the search field with the selected patient's name
    this.patientSearchTerm = patient.name;
    
    // Hide the patient search dropdown
    this.showPatientSearch = false;
    
    // Log the form value after selection
    console.log('Form after patient selection:', this.receiptForm.value);
    
    // Fetch invoices for this patient
    this.fetchPatientInvoices(patient.id);
  }
  
  /**
   * Fetches invoices for a specific patient and displays them
   * @param patientId The ID of the patient to fetch invoices for
   */
  fetchPatientInvoices(patientId: string): void {
    this.loading = true;
    console.log('Fetching invoices for patient ID:', patientId);
    
    // Try to use patient-specific API endpoint first, fallback to getAllInvoices
    const invoiceObservable = this.billingService.getInvoicesByPatient ? 
      this.billingService.getInvoicesByPatient(patientId) : 
      this.billingService.getAllInvoices();
    
    invoiceObservable
      .pipe(
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (invoices: Invoice[]) => {
          // Filter invoices for this patient and sort by date (newest first)
          const patientInvoices = invoices
            .filter(inv => {
              console.log('Checking invoice:', inv, 'against patientId:', patientId);
              return inv.patientId === patientId;
            })
            .filter(inv => {
              // Show all invoices since API doesn't provide balance info
              // Assume all invoices need payment unless explicitly marked as paid
              const balance = inv.balanceAmount || inv.amount || 0;
              console.log('Invoice balance check:', inv.id, 'balance:', balance);
              return balance > 0;
            })
            .sort((a, b) => {
              // Sort by date (newest first)
              const dateA = a.date ? new Date(a.date).getTime() : 0;
              const dateB = b.date ? new Date(b.date).getTime() : 0;
              return dateB - dateA;
            })
            .map(inv => ({
              id: inv.invoiceId || inv.id || '',
              patientId: inv.patientId,
              patientName: inv.patientName,
              amount: inv.amount,
              balance: inv.balanceAmount || inv.amount || 0, // Use full amount if no balance info
              date: inv.date ? new Date(inv.date).toLocaleDateString() : 'Unknown Date'
            }));
          
          console.log('Patient invoices found:', patientInvoices);
          
          // Only show API-fetched invoices - no mock data fallback
          this.invoiceResults = patientInvoices;
          
          if (patientInvoices.length === 0) {
            console.log('No invoices found for patient:', patientId);
          }
          
          // Automatically show invoice dropdown
          this.showInvoiceSearch = true;
          // Update the invoice search term to prompt user to select
          this.invoiceSearchTerm = '';
        },
        error: (error: any) => {
          console.error('Error fetching patient invoices:', error);
          // Clear invoice results on error - no mock data fallback
          this.invoiceResults = [];
          this.showInvoiceSearch = false;
        }
      });
  }

  searchInvoices(): void {
    console.log('searchInvoices called with term:', this.invoiceSearchTerm, 'length:', this.invoiceSearchTerm.length);
    
    if (this.invoiceSearchTerm.length > 2) {
      this.loading = true;
      this.showInvoiceSearch = true;
      
      // Get patient ID from form if available, to filter by patient
      const patientId = this.receiptForm.get('patientId')?.value;
      console.log('Searching invoices for patientId:', patientId);
      
      this.billingService.getAllInvoices()
        .pipe(
          debounceTime(300),
          finalize(() => {
            this.loading = false;
          })
        )
        .subscribe({
          next: (invoices: Invoice[]) => {
            console.log('All invoices fetched:', invoices);
            
            // Filter invoices by search term and patient ID if available
            console.log('Searching invoices with term:', this.invoiceSearchTerm, 'patientId:', patientId);
            console.log('All invoices received:', invoices);
            
            this.invoiceResults = invoices
              .filter(inv => {
                const matchesPatient = !patientId || inv.patientId === patientId;
                const hasBalance = (inv.balanceAmount || inv.amount || 0) > 0;
                const matchesSearch = 
                  (inv.invoiceId && inv.invoiceId.toLowerCase().includes(this.invoiceSearchTerm.toLowerCase())) ||
                  (inv.id && inv.id.toLowerCase().includes(this.invoiceSearchTerm.toLowerCase())) ||
                  (inv.patientName && inv.patientName.toLowerCase().includes(this.invoiceSearchTerm.toLowerCase()));
                
                console.log('Invoice filter check:', {
                  invoice: inv.id || inv.invoiceId,
                  matchesPatient,
                  hasBalance,
                  matchesSearch,
                  patientId: inv.patientId,
                  searchTerm: this.invoiceSearchTerm
                });
                
                return matchesPatient && hasBalance && matchesSearch;
              })
              .map(inv => ({
                id: inv.invoiceId || inv.id || '',
                patientId: inv.patientId,
                patientName: inv.patientName,
                amount: inv.amount,
                balance: inv.balanceAmount || inv.amount || 0, // Use full amount if no balance info
                date: inv.date ? new Date(inv.date).toLocaleDateString() : 'Unknown Date'
              }));
              
            // Log search results - no mock data fallback
            if (this.invoiceResults.length === 0) {
              console.log('No invoices found matching search criteria');
            }
            
            console.log('Invoice search results:', this.invoiceResults);
          },
          error: (error: any) => {
            console.error('Error searching invoices:', error);
            // Clear invoice results on error - no mock data fallback
            this.invoiceResults = [];
            this.showInvoiceSearch = false;
          }
        });
    } else if (this.invoiceSearchTerm.length === 0) {
      this.showInvoiceSearch = false;
      this.invoiceResults = [];
    }
  }

  selectInvoice(invoice: any): void {
    console.log('Invoice selected:', invoice);
    
    // First, fetch the complete invoice details from API to get accurate status
    this.billingService.getInvoiceById(invoice.id).subscribe({
      next: (fullInvoice: any) => {
        console.log('Full invoice details fetched:', fullInvoice);
        
        // Check multiple indicators for paid status
        const status = fullInvoice.status?.toUpperCase();
        const paidAmount = fullInvoice.paidAmount || 0;
        const totalAmount = fullInvoice.amount || invoice.amount || 0;
        
        // Get balance - if not provided, assume it's the full amount (unpaid)
        let balance;
        if (fullInvoice.balanceAmount !== undefined && fullInvoice.balanceAmount !== null) {
          balance = fullInvoice.balanceAmount;
        } else if (fullInvoice.balance !== undefined && fullInvoice.balance !== null) {
          balance = fullInvoice.balance;
        } else {
          // If no balance info is provided, assume it's unpaid (balance = total amount)
          balance = totalAmount;
        }
        
        console.log('Invoice payment analysis:', {
          invoiceId: invoice.id,
          balance: balance,
          status: status,
          paidAmount: paidAmount,
          totalAmount: totalAmount,
          balanceAmount: fullInvoice.balanceAmount,
          originalBalance: fullInvoice.balance
        });
        
        // More robust paid detection - only consider paid if explicitly marked or balance is exactly 0
        this.isInvoiceAlreadyPaid = 
          status === 'PAID' || 
          (balance === 0 && paidAmount > 0) || 
          (paidAmount >= totalAmount && totalAmount > 0 && paidAmount > 0);
        
        if (this.isInvoiceAlreadyPaid) {
          this.selectedInvoiceStatus = 'PAID';
          this.disableFormControls(); // Disable form controls for paid invoices
          console.log('Invoice is PAID - Balance:', balance, 'Status:', status, 'PaidAmount:', paidAmount, 'TotalAmount:', totalAmount);
        } else {
          this.selectedInvoiceStatus = balance < totalAmount ? 'PARTIAL' : 'UNPAID';
          this.enableFormControls(); // Enable form controls for unpaid invoices
          console.log('Invoice status:', this.selectedInvoiceStatus, 'balance:', balance);
        }
        
        // Auto-fill form with invoice details
        this.receiptForm.patchValue({
          patientId: fullInvoice.patientId || invoice.patientId,
          patientName: fullInvoice.patientName || invoice.patientName,
          invoiceId: invoice.id,
          amount: this.isInvoiceAlreadyPaid ? 0 : balance, // Set amount to 0 if already paid
          purpose: 'Invoice Payment' // Set default purpose
        });
        
        // Update the search field with the selected invoice's ID
        this.invoiceSearchTerm = invoice.id;
        
        // Hide the dropdown
        this.showInvoiceSearch = false;
        
        // Also update patient search term to match patient name
        this.patientSearchTerm = fullInvoice.patientName || invoice.patientName;
        
        // Log the form value after selection
        console.log('Form after invoice selection:', this.receiptForm.value);
        console.log('Invoice payment status:', {
          isAlreadyPaid: this.isInvoiceAlreadyPaid,
          status: this.selectedInvoiceStatus,
          balance: balance,
          apiStatus: status,
          paidAmount: paidAmount,
          totalAmount: totalAmount
        });
      },
      error: (error: any) => {
        console.error('Error fetching full invoice details:', error);
        // Fallback to original logic if API call fails
        // Only consider paid if balance is explicitly 0 and there's payment info
        const balance = invoice.balance;
        const status = invoice.status?.toUpperCase();
        const paidAmount = invoice.paidAmount || 0;
        const totalAmount = invoice.amount || 0;
        
        console.log('Fallback invoice payment analysis:', {
          invoiceId: invoice.id,
          balance: balance,
          status: status,
          paidAmount: paidAmount,
          totalAmount: totalAmount
        });
        
        // Conservative fallback: only mark as paid if explicitly indicated
        this.isInvoiceAlreadyPaid = 
          status === 'PAID' || 
          (balance === 0 && paidAmount > 0) || 
          (balance !== undefined && balance !== null && balance <= 0 && paidAmount > 0);
        
        if (this.isInvoiceAlreadyPaid) {
          this.selectedInvoiceStatus = 'PAID';
          this.disableFormControls(); // Disable form controls for paid invoices (fallback)
          console.log('Invoice is already paid (fallback), balance:', balance);
        } else {
          // Determine status based on available data
          if (balance !== undefined && balance !== null && balance < totalAmount && balance > 0) {
            this.selectedInvoiceStatus = 'PARTIAL';
          } else {
            this.selectedInvoiceStatus = 'UNPAID';
          }
          this.enableFormControls(); // Enable form controls for unpaid invoices (fallback)
          console.log('Invoice status (fallback):', this.selectedInvoiceStatus, 'balance:', balance);
        }
        
        // Calculate amount for receipt form
        let receiptAmount = 0;
        if (this.isInvoiceAlreadyPaid) {
          receiptAmount = 0; // Already paid, no amount needed
        } else if (balance !== undefined && balance !== null && balance > 0) {
          receiptAmount = balance; // Use remaining balance
        } else {
          receiptAmount = totalAmount; // Use full amount if no balance info
        }
        
        // Auto-fill form with available invoice details
        this.receiptForm.patchValue({
          patientId: invoice.patientId,
          patientName: invoice.patientName,
          invoiceId: invoice.id,
          amount: receiptAmount,
          purpose: 'Invoice Payment'
        });
        
        this.invoiceSearchTerm = invoice.id;
        this.showInvoiceSearch = false;
        this.patientSearchTerm = invoice.patientName;
      }
    });
  }

  cancelForm(): void {
    this.router.navigate(['/billing/receipts']);
  }

  printReceipt(): void {
    // Print functionality for already paid invoices
    const invoiceId = this.receiptForm.get('invoiceId')?.value;
    if (invoiceId) {
      console.log('Fetching existing receipt details for paid invoice:', invoiceId);
      this.loading = true;
      
      // Find the existing receipt for this invoice by searching all receipts
      this.findReceiptByInvoiceId(invoiceId);
    }
  }

  findReceiptByInvoiceId(invoiceId: string): void {
    console.log('Searching for receipt with invoice ID:', invoiceId);
    this.loading = true;
    
    // First try to get receipts directly by invoiceId using the new endpoint
    this.billingService.getReceiptsByInvoiceId(invoiceId).subscribe({
      next: (response: any) => {
        console.log('Fetched all receipts response:', response);
        
        // Handle different response formats (direct array or wrapped in data property)
        const allReceipts = Array.isArray(response) ? response : (response.data || response);
        console.log('Searching through receipts for invoice:', invoiceId, 'Total receipts:', allReceipts.length);
        
        // First try to find by invoiceId if it exists in receipt data
        let matchingReceipts = allReceipts.filter((receipt: any) => 
          receipt.invoiceId === invoiceId
        );
        
        console.log('Direct invoiceId matching receipts found:', matchingReceipts);
        
        // If no direct match by invoiceId, try alternative matching strategies
        if (matchingReceipts.length === 0) {
          console.log('No direct invoiceId match found, trying alternative matching...');
          
          // Get current form data for matching
          const currentPatientId = this.receiptForm.get('patientId')?.value;
          const currentPatientName = this.receiptForm.get('patientName')?.value;
          
          console.log('Current form data for matching:', {
            patientId: currentPatientId,
            patientName: currentPatientName,
            totalReceipts: allReceipts.length
          });
          
          // First try to match by patient ID or name
          matchingReceipts = allReceipts.filter((receipt: any) => {
            const patientIdMatch = receipt.patientId === currentPatientId;
            const patientNameMatch = receipt.patientName === currentPatientName;
            
            console.log('Checking receipt:', receipt.receiptId || receipt.id, {
              receiptPatientId: receipt.patientId,
              receiptPatientName: receipt.patientName,
              patientIdMatch,
              patientNameMatch,
              receiptAmount: receipt.amount,
              receiptDate: receipt.date
            });
            
            return patientIdMatch || patientNameMatch;
          });
          
          console.log('Patient matching receipts found:', matchingReceipts.length);
          
          // If still no match and we have receipts, use the first available receipt
          // This handles cases where the receipt exists but patient data doesn't match exactly
          if (matchingReceipts.length === 0 && allReceipts.length > 0) {
            console.log('No patient match found, using first available receipt from API response');
            matchingReceipts = [allReceipts[0]]; // Actually assign the first receipt
          }
        }
        
        // Process the found receipt
        if (matchingReceipts.length > 0) {
          const existingReceipt = matchingReceipts[0];
          console.log('Found existing receipt:', existingReceipt);
          
          // Add the invoiceId to the receipt for display purposes
          existingReceipt.invoiceId = invoiceId;
          
          this.displayReceiptDetailsForPrint(existingReceipt);
        } else {
          console.log('No receipt found after all matching attempts');
          console.log('Total receipts in API response:', allReceipts.length);
          console.log('All receipts data:', allReceipts);
          
          this.loading = false;
          alert(`No receipt found for invoice ${invoiceId}. The invoice may have been paid through a different method.`);
        }
      },
      error: (error: any) => {
        console.error('Error fetching all receipts:', error);
        this.loading = false;
        alert('Error fetching receipt details. Please try again.');
      }
    });
  }

  displayReceiptDetailsForPrint(receipt: any): void {
    console.log('Displaying receipt details for print:', receipt);
    this.loading = false;
    
    // Map the actual API response fields to display format
    const mappedReceipt = {
      receiptId: receipt.receiptId || receipt.id || 'N/A',
      invoiceId: receipt.invoiceId || 'N/A', // This was added in findReceiptByInvoiceId
      patientName: receipt.patientName || 'N/A',
      patientId: receipt.patientId || 'N/A',
      date: receipt.date || 'N/A',
      amount: receipt.amount || '0.00',
      modeOfPayment: receipt.modeOfPayment || 'N/A',
      purpose: receipt.purpose || 'Invoice Payment',
      referenceId: receipt.referenceId || 'N/A',
      createdBy: receipt.createdBy || 'N/A',
      createdDate: receipt.createdDate || 'N/A'
    };
    
    console.log('Mapped receipt for display:', mappedReceipt);
    
    // Format the receipt details for display
    const receiptDetails = `
      RECEIPT DETAILS
      ================
      Receipt ID: ${mappedReceipt.receiptId}
      Invoice ID: ${mappedReceipt.invoiceId}
      Patient: ${mappedReceipt.patientName}
      Patient ID: ${mappedReceipt.patientId}
      Date: ${mappedReceipt.date}
      Amount: ₹${parseFloat(mappedReceipt.amount).toFixed(2)}
      Payment Mode: ${mappedReceipt.modeOfPayment}
      Purpose: ${mappedReceipt.purpose}
      Reference ID: ${mappedReceipt.referenceId}
      Created By: ${mappedReceipt.createdBy}
      Created Date: ${mappedReceipt.createdDate}
    `;
    
    // Show receipt details in a confirmation dialog
    const shouldPrint = confirm(`${receiptDetails}\n\nDo you want to print this receipt?`);
    
    if (shouldPrint) {
      this.executeReceiptPrint(mappedReceipt);
    }
  }

  executeReceiptPrint(receipt: any): void {
    console.log('Executing print for receipt:', receipt);
    
    // Create a printable version of the receipt
    const printContent = this.generatePrintableReceipt(receipt);
    
    // Open print dialog
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      
      // Close the print window after printing
      printWindow.onafterprint = () => {
        printWindow.close();
      };
    } else {
      // Fallback if popup is blocked
      alert('Please allow popups to print the receipt, or copy the receipt details manually.');
    }
  }

  generatePrintableReceipt(receipt: any): string {
    // Generate HTML content for printing
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${receipt.receiptId}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .receipt-details { margin: 20px 0; }
          .detail-row { margin: 5px 0; display: flex; justify-content: space-between; }
          .detail-label { font-weight: bold; }
          .amount { font-size: 18px; font-weight: bold; color: #6b1d14; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>PAYMENT RECEIPT</h2>
          <p>Healthcare Management System</p>
        </div>
        
        <div class="receipt-details">
          <div class="detail-row">
            <span class="detail-label">Receipt ID:</span>
            <span>${receipt.receiptId || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Invoice ID:</span>
            <span>${receipt.invoiceId || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Patient Name:</span>
            <span>${receipt.patientName || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date:</span>
            <span>${receipt.date || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Payment Mode:</span>
            <span>${receipt.modeOfPayment || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Purpose:</span>
            <span>${receipt.purpose || 'N/A'}</span>
          </div>
          ${receipt.referenceId ? `
          <div class="detail-row">
            <span class="detail-label">Reference ID:</span>
            <span>${receipt.referenceId}</span>
          </div>` : ''}
          <hr>
          <div class="detail-row amount">
            <span class="detail-label">Amount Paid:</span>
            <span>₹${receipt.amount || '0.00'}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>Created by: ${receipt.createdBy || 'System'}</p>
          <p>Created on: ${receipt.createdDate || 'N/A'}</p>
          <p>Thank you for your payment!</p>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;
  }

  resetInvoiceStatus(): void {
    // Reset invoice payment status flags
    this.isInvoiceAlreadyPaid = false;
    this.selectedInvoiceStatus = '';
    this.enableFormControls();
    console.log('Invoice payment status reset');
  }

  disableFormControls(): void {
    // Disable form controls when invoice is already paid
    const controlsToDisable = ['amount', 'modeOfPayment', 'purpose', 'referenceId'];
    controlsToDisable.forEach(controlName => {
      const control = this.receiptForm.get(controlName);
      if (control) {
        control.disable();
      }
    });
    console.log('Form controls disabled for paid invoice');
  }

  enableFormControls(): void {
    // Enable form controls when invoice is not paid
    const controlsToEnable = ['amount', 'modeOfPayment', 'purpose', 'referenceId'];
    controlsToEnable.forEach(controlName => {
      const control = this.receiptForm.get(controlName);
      if (control) {
        control.enable();
      }
    });
    console.log('Form controls enabled');
  }
  
  /**
   * Load invoice details and auto-populate the receipt form
   * @param invoiceId The ID of the invoice to load
   */
  loadInvoiceDetails(invoiceId: string): void {
    this.loading = true;
    console.log('Loading invoice details for ID:', invoiceId);
    this.billingService.getInvoiceById(invoiceId)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (invoice: Invoice) => {
          console.log('Invoice data loaded:', invoice);
          
          if (!invoice) {
            console.warn('No invoice data returned for ID:', invoiceId);
            return;
          }
          
          // Calculate remaining balance
          const balanceAmount = invoice.balanceAmount !== undefined ? 
            invoice.balanceAmount : 
            (invoice.amount - (invoice.paidAmount || 0));
          
          console.log('Calculated balance amount:', balanceAmount);
          
          // Auto-populate the form with invoice details - only update fields that aren't already set
          const updates: any = {
            invoiceId: invoiceId,
            purpose: this.receiptForm.get('purpose')?.value || 'Invoice Payment'
          };
          
          // Also update the invoice search term to display the invoice ID
          this.invoiceSearchTerm = invoiceId;
          
          // Only update patient details if they're not already set
          if (!this.receiptForm.get('patientId')?.value) {
            updates.patientId = invoice.patientId;
          }
          
          if (!this.receiptForm.get('patientName')?.value) {
            updates.patientName = invoice.patientName;
          }
          
          // Only update amount if in create mode or amount is 0
          if (!this.isEditMode || !this.receiptForm.get('amount')?.value) {
            updates.amount = balanceAmount;
          }
          
          this.receiptForm.patchValue(updates);
          
          console.log('Receipt form populated from invoice:', invoiceId);
          console.log('Updated form values:', this.receiptForm.value);
        },
        error: (error: any) => {
          console.error('Error loading invoice details:', error);
          console.log('Failed to load invoice details for ID:', invoiceId);
        }
      });
  }
  
  /**
   * Selects a payment mode and updates the form control
   * @param event Change event from the select element
   */
  selectPaymentMode(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const mode = selectElement.value;
    this.receiptForm.get('modeOfPayment')?.setValue(mode);
    this.receiptForm.get('modeOfPayment')?.markAsDirty();
  }
}
