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
      invoiceId: [''],
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
      next: (receipt) => {
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
            error: (error) => {
              console.error('Error fetching patient details:', error);
            }
          });
        }
        
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading receipt', error);
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    this.submitted = true;
    console.log('Form submitted with values:', this.receiptForm.value);
    
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
          error: (error) => {
            console.error('Error updating receipt', error);
            alert('Failed to update receipt: ' + (error.message || 'Unknown error'));
          }
        });
    } else {
      this.billingService.createReceipt(receipt)
        .pipe(finalize(() => this.loading = false))
        .subscribe({
          next: () => {
            // If this is linked to an invoice, update the invoice status
            if (receipt.invoiceId) {
              this.updateInvoiceStatus(receipt.invoiceId, receipt.amount);
            } else {
              alert('Receipt created successfully');
              this.router.navigate(['/billing/receipts']);
            }
          },
          error: (error) => {
            console.error('Error creating receipt', error);
            alert('Failed to create receipt: ' + (error.message || 'Unknown error'));
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
        next: (invoice) => {
          console.log('Invoice fetched successfully:', invoice);
          const currentPaidAmount = invoice.paidAmount || 0;
          const newPaidAmount = currentPaidAmount + paidAmount;
          let newStatus = 'UNPAID';
          
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
              error: (error) => {
                console.error('Error updating invoice', error);
                // Still consider the receipt creation successful
                alert('Receipt created but failed to update invoice status');
                this.router.navigate(['/billing/receipts']);
              }
            });
        },
        error: (error) => {
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
          error: (error) => {
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
    
    this.billingService.getAllInvoices()
      .pipe(
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (invoices: Invoice[]) => {
          // Filter invoices for this patient and sort by date (newest first)
          const patientInvoices = invoices
            .filter(inv => inv.patientId === patientId)
            .filter(inv => (inv.balanceAmount || 0) > 0) // Only show invoices with balance
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
              balance: inv.balanceAmount || (inv.amount - (inv.paidAmount || 0)),
              date: inv.date ? new Date(inv.date).toLocaleDateString() : 'Unknown Date'
            }));
          
          console.log('Patient invoices found:', patientInvoices);
          
          // If no real invoices found, provide mock data for testing
          if (patientInvoices.length === 0) {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const lastWeek = new Date(today);
            lastWeek.setDate(lastWeek.getDate() - 7);
            
            this.invoiceResults = [
              { 
                id: 'INV-001', 
                patientId: patientId, 
                patientName: this.patientSearchTerm, 
                amount: 5000, 
                balance: 5000,
                date: today.toLocaleDateString()
              },
              { 
                id: 'INV-002', 
                patientId: patientId, 
                patientName: this.patientSearchTerm, 
                amount: 3500, 
                balance: 3500,
                date: yesterday.toLocaleDateString()
              },
              { 
                id: 'INV-003', 
                patientId: patientId, 
                patientName: this.patientSearchTerm, 
                amount: 2000, 
                balance: 2000,
                date: lastWeek.toLocaleDateString()
              }
            ];
          } else {
            this.invoiceResults = patientInvoices;
          }
          
          // Automatically show invoice dropdown
          this.showInvoiceSearch = true;
          // Update the invoice search term to prompt user to select
          this.invoiceSearchTerm = '';
        },
        error: (error) => {
          console.error('Error fetching patient invoices:', error);
          // Provide mock data on error
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const lastWeek = new Date(today);
          lastWeek.setDate(lastWeek.getDate() - 7);
          
          this.invoiceResults = [
            { 
              id: 'INV-001', 
              patientId: patientId, 
              patientName: this.patientSearchTerm, 
              amount: 5000, 
              balance: 5000,
              date: today.toLocaleDateString()
            },
            { 
              id: 'INV-002', 
              patientId: patientId, 
              patientName: this.patientSearchTerm, 
              amount: 3500, 
              balance: 3500,
              date: yesterday.toLocaleDateString()
            },
            { 
              id: 'INV-003', 
              patientId: patientId, 
              patientName: this.patientSearchTerm, 
              amount: 2000, 
              balance: 2000,
              date: lastWeek.toLocaleDateString()
            }
          ];
          
          // Automatically show invoice dropdown
          this.showInvoiceSearch = true;
        }
      });
  }

  searchInvoices(): void {
    if (this.invoiceSearchTerm.length > 2) {
      this.loading = true;
      this.showInvoiceSearch = true;
      
      // Get patient ID from form if available, to filter by patient
      const patientId = this.receiptForm.get('patientId')?.value;
      
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
            this.invoiceResults = invoices
              .filter(inv => 
                (!patientId || inv.patientId === patientId) && // Filter by patient if selected
                ((inv.invoiceId && inv.invoiceId.toLowerCase().includes(this.invoiceSearchTerm.toLowerCase())) ||
                (inv.patientName && inv.patientName.toLowerCase().includes(this.invoiceSearchTerm.toLowerCase())))
              )
              .map(inv => ({
                id: inv.invoiceId || inv.id || '',
                patientId: inv.patientId,
                patientName: inv.patientName,
                amount: inv.amount,
                balance: inv.balanceAmount || (inv.amount - (inv.paidAmount || 0))
              }));
              
            // If no results, provide mock data for testing
            if (this.invoiceResults.length === 0) {
              console.log('No invoice results, providing mock data');
              this.invoiceResults = [
                { id: 'INV-001', patientName: 'John Doe', patientId: 'P001', amount: 5000, balance: 5000 },
                { id: 'INV-002', patientName: 'Jane Smith', patientId: 'P002', amount: 3500, balance: 3500 },
                { id: 'INV-003', patientName: 'Test Patient', patientId: 'P003', amount: 2000, balance: 2000 }
              ];
              
              // If we have a selected patient, only show invoices for that patient in mock data
              if (patientId) {
                const patientName = this.receiptForm.get('patientName')?.value;
                this.invoiceResults = [
                  { id: 'INV-001', patientName: patientName, patientId: patientId, amount: 5000, balance: 5000 },
                  { id: 'INV-002', patientName: patientName, patientId: patientId, amount: 3500, balance: 2000 }
                ];
              }
            }
            
            console.log('Invoice search results:', this.invoiceResults);
          },
          error: (error: any) => {
            console.error('Error searching invoices:', error);
            // Provide mock data on error for testing
            this.invoiceResults = [
              { id: 'INV-001', patientName: 'John Doe', patientId: 'P001', amount: 5000, balance: 5000 },
              { id: 'INV-002', patientName: 'Jane Smith', patientId: 'P002', amount: 3500, balance: 3500 },
              { id: 'INV-003', patientName: 'Test Patient', patientId: 'P003', amount: 2000, balance: 2000 }
            ];
          }
        });
    } else if (this.invoiceSearchTerm.length === 0) {
      this.showInvoiceSearch = false;
      this.invoiceResults = [];
    }
  }

  selectInvoice(invoice: any): void {
    console.log('Invoice selected:', invoice);
    
    // Auto-fill form with invoice details
    this.receiptForm.patchValue({
      patientId: invoice.patientId,
      patientName: invoice.patientName,
      invoiceId: invoice.id,
      amount: invoice.balance, // Set default amount to remaining balance
      purpose: 'Invoice Payment' // Set default purpose
    });
    
    // Update the search field with the selected invoice's ID
    this.invoiceSearchTerm = invoice.id;
    
    // Hide the dropdown
    this.showInvoiceSearch = false;
    
    // Also update patient search term to match patient name
    this.patientSearchTerm = invoice.patientName;
    
    // Log the form value after selection
    console.log('Form after invoice selection:', this.receiptForm.value);
  }

  cancelForm(): void {
    this.router.navigate(['/billing/receipts']);
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
        next: (invoice) => {
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
        error: (error) => {
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
