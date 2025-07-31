import { Component, OnInit, OnDestroy, ViewContainerRef, ApplicationRef, createComponent, EnvironmentInjector, inject, ChangeDetectorRef } from '@angular/core';
import { RevenueDetailsModalComponent } from '../revenue-details-modal/revenue-details-modal.component';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PatientService } from '../../patients/shared/patient.service';
import { AppointmentService } from '../../appointments/shared/appointment.service';
import { DoctorService } from '../../shared/services/doctor.service';
import { AppointmentFilters } from '../../appointments/shared/appointment.model';
import { Appointment, AppointmentStatus } from '../../appointments/shared/appointment.model';
import { Patient } from '../../patients/shared/patient.model';
import { ApiResponse } from '../../shared/models/api-response.model';
import { Subject, forkJoin, takeUntil, of, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { InventoryService } from '../../inventory/services/inventory.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ExpiringMedicinesReportComponent } from '../../inventory/components/expiring-medicines-report/expiring-medicines-report.component';
import { LowStockMedicinesReportComponent } from '../../inventory/components/low-stock-medicines-report/low-stock-medicines-report.component';
import { BillingService } from '../../billing/shared/billing.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ExpiringMedicinesReportComponent, LowStockMedicinesReportComponent],
  templateUrl: './dashboard-home.component.html',
  styleUrl: './dashboard-home.component.scss'
})
export class DashboardHomeComponent implements OnInit, OnDestroy {
  // Dashboard summary stats
  patientCountToday = 0;
  pendingBillsCount = 0;
  revenueToday = 0;
  appointmentsToday = 0;
  lowStockItemsCount = 0;
  expiringMedicinesCount = 0;
  lowStockItems: any[] = [];
  expiringMedicines: any[] = [];
  loadingInventory = false;
  recentPatients: any[] = [];
  upcomingAppointments: any[] = [];
  
  // Patient name caching for appointments
  private patientNamesCache = new Map<string, string>();
  private allPatients: Patient[] = [];
  
  // Define pagination variables
  pageSize = 5; 
  currentRecentPage = 0;
  currentUpcomingPage = 0;
  totalRecentPatients = 0;
  totalUpcomingAppointments = 0;
  
  // Loading states
  loadingRecent = false;
  loadingUpcoming = false;
  loadingStats = false;
  
  // For cleanup
  private destroy$ = new Subject<void>();
  
  private revenueModalComponentRef: any = null;
  private revenueBreakdown: {cashMemos: any[], invoices: any[], sales: any[], advances?: any[]} = {cashMemos: [], invoices: [], sales: []};
  private environmentInjector = inject(EnvironmentInjector);
  private appRef = inject(ApplicationRef);
  
  // Modal properties for appointments
  showAppointmentDetailsModal = false;
  showRescheduleModal = false;
  selectedAppointmentDetails: any = null;
  selectedAppointmentForReschedule: any = null;
  
  // Enhanced appointment details with doctor and patient info
  appointmentDoctorDetails: any = null;
  appointmentPatientDetails: any = null;
  loadingAppointmentDetails = false;
  doctorDataReady = false;
  
  constructor(
    private patientService: PatientService,
    private appointmentService: AppointmentService,
    private doctorService: DoctorService,
    private inventoryService: InventoryService,
    private billingService: BillingService,
    private http: HttpClient,
    private viewContainerRef: ViewContainerRef,
    private router: Router,
    private applicationRef: ApplicationRef,
    private cdr: ChangeDetectorRef
  ) { }

  /**
   * Get today's date in local timezone (YYYY-MM-DD format)
   * Fixes timezone issues with toISOString() which returns UTC
   */
  private getTodayLocalDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  ngOnInit(): void {
    this.loadDashboardStats();
    this.loadRecentPatients();
    
    // Load all patients for name mapping
    this.loadAllPatients();
    
    // Load appointments from API
    this.loadUpcomingAppointments();
    
    // Load inventory alerts (low stock medicines)
    this.loadInventoryAlerts();
    
    // Load revenue data
    this.loadingStats = true;
    this.loadRevenueData();
    
    // Set up auto-refresh for revenue data
    setInterval(() => {
      this.loadRevenueData();
    }, 300000); // refresh every 5 minutes
    const refreshInterval = setInterval(() => {
      this.refreshData();
    }, 5 * 60 * 1000);
    
    // Clear interval on destroy
    this.destroy$.subscribe(() => {
      clearInterval(refreshInterval);
    });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Make sure to close any open modals when component is destroyed
    this.closeRevenueModal();
  }

  /**
   * Get stock status CSS class based on current and minimum stock
   */
  getStockStatusClass(currentStock: number, minimumStock: number): string {
    if (currentStock === 0) return 'critical';
    if (currentStock < minimumStock / 2) return 'critical';
    if (currentStock < minimumStock) return 'low';
    return 'normal';
  }

  /**
   * Get stock status label based on current and minimum stock
   */
  getStockStatusLabel(currentStock: number, minimumStock: number): string {
    if (currentStock === 0) return 'Out of Stock';
    if (currentStock < minimumStock / 2) return 'Critical';
    if (currentStock < minimumStock) return 'Low Stock';
    return 'Normal';
  }

  /**
   * Load revenue data and breakdown for dashboard
   */
  loadRevenueData() {
    console.log('📊 Loading revenue data...');
    console.log('📅 Today\'s date:', this.getTodayLocalDate());
    
    this.loadingStats = true;
    
    // Load comprehensive revenue data including advances
    forkJoin({
      appointments: this.appointmentService.getTodaysAppointments(),
      cashMemos: this.billingService.getTodaysCashMemos(),
      invoices: this.billingService.getTodaysInvoices(),
      sales: this.billingService.getTodaysSales(),
      advances: this.getAdvancesToday() // Include advances
    }).subscribe(({ appointments, cashMemos, invoices, sales, advances }) => {
      this.appointmentsToday = appointments.length;
      
      // Calculate revenue with proper decimal handling and local time filtering
      const today = this.getTodayLocalDate();
      
      // Filter cash memos for today (local time)
      const todaysCashMemos = cashMemos.filter(memo => {
        const memoDate = this.extractLocalDate(memo.createdDate || memo.date);
        return memoDate === today;
      });
      
      // Filter invoices for today (local time) - fix the issue with yesterday's invoices
      const todaysInvoices = invoices.filter(invoice => {
        const invoiceDate = this.extractLocalDate(invoice.createdDate || invoice.date);
        return invoiceDate === today;
      });
      
      // Filter sales for today (already handled by service but double-check)
      const todaysSales = sales.filter(sale => {
        if (sale.saleDate && sale.saleDate.seconds) {
          const saleDate = new Date(sale.saleDate.seconds * 1000);
          return this.extractLocalDate(saleDate.toISOString()) === today;
        }
        return this.extractLocalDate(sale.createdDate || sale.date) === today;
      });
      
      // Filter advances for today
      const todaysAdvances = advances.filter(advance => {
        const advanceDate = this.extractLocalDate(advance.createdDate || advance.date);
        return advanceDate === today;
      });
      
      // Calculate totals with proper decimal handling
      const cashMemoTotal = this.calculateTotal(todaysCashMemos, 'amount');
      const invoiceTotal = this.calculateTotal(todaysInvoices, 'grandTotal');
      const salesTotal = this.calculateTotal(todaysSales, 'grandTotal');
      const advanceTotal = this.calculateTotal(todaysAdvances, 'amount');
      
      // Set revenue total with proper decimal precision
      this.revenueToday = this.roundToDecimal(cashMemoTotal + invoiceTotal + salesTotal + advanceTotal, 2);
      
      // Store breakdown for modal
      this.revenueBreakdown = {
        cashMemos: todaysCashMemos,
        invoices: todaysInvoices,
        sales: todaysSales,
        advances: todaysAdvances
      };
      
      console.log('💰 Revenue calculation:', {
        today,
        cashMemoTotal: this.roundToDecimal(cashMemoTotal, 2),
        invoiceTotal: this.roundToDecimal(invoiceTotal, 2),
        salesTotal: this.roundToDecimal(salesTotal, 2),
        advanceTotal: this.roundToDecimal(advanceTotal, 2),
        totalRevenue: this.revenueToday,
        counts: {
          cashMemos: todaysCashMemos.length,
          invoices: todaysInvoices.length,
          sales: todaysSales.length,
          advances: todaysAdvances.length
        }
      });
      
      this.loadingStats = false;
    }, error => {
      console.error('❌ Error loading revenue data:', error);
      this.revenueToday = 0;
      this.loadingStats = false;
    });
  }
  
  /**
   * Manual refresh of revenue data for debugging
   */
  refreshRevenueData() {
    console.log('🔄 Manually refreshing revenue data...');
    console.log('📅 Current date:', this.getTodayLocalDate());
    console.log('🕐 Current time:', new Date().toISOString());
    
    this.loadingStats = true;
    this.revenueToday = 0; // Reset to see if it changes
    
    // Force fresh data by calling the service again
    this.billingService.getTodaysRevenue()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (revenue: number) => {
          console.log('🔄 Manual refresh result:', revenue);
          this.revenueToday = revenue;
          this.loadingStats = false;
        },
        error: (error: any) => {
          console.error('❌ Manual refresh error:', error);
          this.revenueToday = 0;
          this.loadingStats = false;
        }
      });
  }

  /**
   * Show revenue details modal with breakdown
   */
  showRevenueDetails() {
    // Create revenue details modal component
    this.revenueModalComponentRef = createComponent(RevenueDetailsModalComponent, {
      environmentInjector: this.environmentInjector
    });

    // Set component inputs - include advances
    const instance = this.revenueModalComponentRef.instance;
    instance.cashMemos = this.revenueBreakdown.cashMemos || [];
    instance.invoices = this.revenueBreakdown.invoices || [];
    instance.sales = this.revenueBreakdown.sales || [];
    instance.advances = this.revenueBreakdown.advances || []; // Add advances

    // Handle close event
    instance.closed.subscribe(() => {
      this.closeRevenueModal();
    });

    // Attach to the DOM
    document.body.appendChild(this.revenueModalComponentRef.location.nativeElement);
    
    // Attach to Angular's change detection
    this.appRef.attachView(this.revenueModalComponentRef.hostView);
    
    // Add modal-open class to body to prevent scrolling
    document.body.classList.add('modal-open');
  }

  /**
   * Close the revenue details modal
   */
  closeRevenueModal() {
    if (this.revenueModalComponentRef) {
      // Remove from DOM
      const element = this.revenueModalComponentRef.location.nativeElement;
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      
      // Detach from Angular's change detection
      this.appRef.detachView(this.revenueModalComponentRef.hostView);
      
      // Destroy the component reference
      this.revenueModalComponentRef.destroy();
      this.revenueModalComponentRef = null;
      
      // Remove modal-open class from body
      document.body.classList.remove('modal-open');
    }
  }
  
  // Load inventory alerts - expiring medicines and low stock
  loadInventoryAlerts(): void {
    this.loadingInventory = true;
    
    // Initialize counts to 0
    this.lowStockItemsCount = 0;
    this.expiringMedicinesCount = 0;
    
    // Get expiring medicines first
    this.inventoryService.getExpiringMedicines().subscribe({
      next: (data) => {
        this.expiringMedicines = data;
        this.expiringMedicinesCount = data.length;
        console.log('✅ Expiring medicines loaded:', this.expiringMedicinesCount);
      },
      error: (error: any) => {
        console.error('❌ Error loading expiring medicines:', error);
        this.expiringMedicines = [];
        this.expiringMedicinesCount = 0;
      }
    });
    
    // Use the same inventory service method that works for Low Stock Medicines Report
    console.log('🚀 Dashboard: Starting getLowStockMedicines() call');
    console.log('🚀 Dashboard: Current lowStockItemsCount before call:', this.lowStockItemsCount);
    
    this.inventoryService.getLowStockMedicines().subscribe({
      next: (lowStockMedicines) => {
        console.log('📦 Dashboard: Service returned data:', lowStockMedicines);
        console.log('📦 Dashboard: Data type:', typeof lowStockMedicines);
        console.log('📦 Dashboard: Is array:', Array.isArray(lowStockMedicines));
        console.log('📦 Dashboard: Length:', lowStockMedicines?.length);
        
        // Update state directly from the working service
        this.lowStockItems = lowStockMedicines;
        this.lowStockItemsCount = lowStockMedicines.length;
        this.loadingInventory = false;
        
        console.log('🎯 Dashboard: State updated - lowStockItemsCount:', this.lowStockItemsCount);
        console.log('🎯 Dashboard: State updated - loadingInventory:', this.loadingInventory);
        console.log('🎯 Dashboard: State updated - lowStockItems:', this.lowStockItems);
        
        // Force Angular change detection to update the UI immediately
        this.cdr.detectChanges();
        console.log('🔄 Dashboard: Manual change detection triggered');
        
        // Additional check to ensure UI is updated
        setTimeout(() => {
          console.log('🔄 Dashboard: Final state check:');
          console.log('  - lowStockItemsCount:', this.lowStockItemsCount);
          console.log('  - loadingInventory:', this.loadingInventory);
          console.log('  - UI should display:', this.lowStockItemsCount);
        }, 100);
      },
      error: (error: any) => {
        console.error('❌ Error loading low stock medicines from service:', error);
        this.lowStockItems = [];
        this.lowStockItemsCount = 0;
        this.loadingInventory = false;
        this.cdr.detectChanges();
      }
    });
  }
  
  // Load dashboard summary statistics (excluding revenue - handled by loadRevenueData)
  loadDashboardStats(): void {
    this.loadingStats = true;
    
    // Get today's date in YYYY-MM-DD format for filtering
    const today = this.getTodayLocalDate(); // e.g., "2025-07-15"
    
    // Use forkJoin to get appointments and invoices in parallel (revenue handled separately)
    forkJoin({
      appointments: this.appointmentService.getTodaysAppointments(),
      invoices: this.billingService.getAllInvoices()
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (results) => {
        // Filter to ensure only today's appointments are counted
        const todaysAppointments = results.appointments.filter(appointment => {
          if (!appointment.appointmentDateTime) return false;
          // Extract the date part from the appointment's datetime (YYYY-MM-DD)
          const appointmentDate = appointment.appointmentDateTime.split('T')[0];
          // Compare with today's date
          return appointmentDate === today;
        });
        
        // Set patient count for today from filtered appointments
        this.patientCountToday = todaysAppointments.length;
        console.log(`Today's appointments count (${today}):`, this.patientCountToday);
        
        // Get unpaid invoices count
        const unpaidInvoices = results.invoices.filter((invoice: any) => 
          invoice.status === 'UNPAID'
        );
        this.pendingBillsCount = unpaidInvoices.length;
        console.log(`Unpaid invoices count:`, this.pendingBillsCount);
        
        this.loadingStats = false;
      },
      error: (error: any) => {
        console.error('Error loading dashboard stats', error);
        this.loadingStats = false;
        
        // Fallback to separate API calls if the combined request fails
        this.loadDashboardStatsIndividually();
      }
    });
  }
  
  // Fallback method to load dashboard stats individually if the combined request fails
  loadDashboardStatsIndividually(): void {
    // Get today's date in YYYY-MM-DD format for filtering
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's appointments count
    this.appointmentService.getTodaysAppointments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (appointments: Appointment[]) => {
          // Filter to ensure only today's appointments are counted
          const todaysAppointments = appointments.filter(appointment => {
            if (!appointment.appointmentDateTime) return false;
            // Extract the date part from the appointment's datetime
            const appointmentDate = appointment.appointmentDateTime.split('T')[0];
            // Compare with today's date
            return appointmentDate === today;
          });
          
          this.patientCountToday = todaysAppointments.length;
          console.log(`Today's appointments count (${today}) from fallback:`, this.patientCountToday);
        },
        error: (error: any) => {
          console.error('Error loading appointments for stats', error);
          this.patientCountToday = 0;
        }
      });
      
    // Get unpaid invoices count
    this.billingService.getAllInvoices()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (invoices: any[]) => {
          const unpaidInvoices = invoices.filter((invoice: any) => 
            invoice.status === 'UNPAID'
          );
          this.pendingBillsCount = unpaidInvoices.length;
          console.log(`Unpaid invoices count from fallback:`, this.pendingBillsCount);
        },
        error: (error: any) => {
          console.error('Error loading invoices for stats', error);
          this.pendingBillsCount = 0;
        }
      });
      
    // Revenue is handled by loadRevenueData() method for consistency
    console.log('💰 Revenue calculation handled by loadRevenueData() method');
  }
  
  // Low stock items and expiring medicines now handled by standalone components
  
  // Load recent patients list
  loadRecentPatients(page: number = 0): void {
    this.loadingRecent = true;
    this.currentRecentPage = page;
    
    this.patientService.getAllPatients() // Add pagination params when API supports it
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (patients: Patient[]) => { // Fix: implicit any type
          // Sort patients by registration date (most recent first)
          const sortedPatients = patients.sort((a, b) => {
            const dateA = new Date(a.registrationDate || 0);
            const dateB = new Date(b.registrationDate || 0);
            return dateB.getTime() - dateA.getTime();
          });
          
          // Implement proper pagination
          const startIdx = page * this.pageSize;
          const endIdx = startIdx + this.pageSize;
          this.recentPatients = sortedPatients.slice(startIdx, endIdx);
          this.totalRecentPatients = sortedPatients.length;
          this.loadingRecent = false;
          
          console.log(`Showing recent patients ${startIdx+1}-${Math.min(endIdx, this.totalRecentPatients)} of ${this.totalRecentPatients}`);
        },
        error: (error: any) => { // Fix: implicit any type
          console.error('Error loading recent patients', error);
          this.loadingRecent = false;
          // Keep the UI working with empty array
          this.recentPatients = [];
          this.totalRecentPatients = 0;
        }
      });
  }
  
  // Load patients in queue method removed
  
  // Load appointments - showing only today's appointments
  loadUpcomingAppointments(page: number = 0): void {
    this.loadingUpcoming = true;
    this.currentUpcomingPage = page;
    
    // Calculate pagination offsets for manual pagination if needed
    const startIdx = page * this.pageSize;
    
    // Get current date in YYYY-MM-DD format for filtering
    const today = this.getTodayLocalDate(); // e.g., "2025-07-15"
    
    // Fetch today's appointments from API
    this.appointmentService.getTodaysAppointments(0, 50) // Get more records to allow for filtering
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (appointments: Appointment[]) => {
          console.log('Fetched appointments from API:', appointments);
          
          // Filter to ensure only today's appointments are shown
          const todaysAppointments = appointments.filter(appointment => {
            if (!appointment.appointmentDateTime) return false;
            
            // Extract the date part from the appointment's datetime (YYYY-MM-DD)
            const appointmentDate = appointment.appointmentDateTime.split('T')[0];
            
            // Compare with today's date
            return appointmentDate === today;
          });
          
          console.log('After filtering for today\'s date:', todaysAppointments.length, 'appointments');
          
          // Sort by appointment time (soonest first)
          const sortedAppointments = todaysAppointments.sort((a, b) => {
            if (!a.appointmentDateTime) return 1; // Push nulls to end
            if (!b.appointmentDateTime) return -1; // Push nulls to end
            return new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime();
          });
          
          // Apply pagination manually
          this.totalUpcomingAppointments = sortedAppointments.length;
          this.upcomingAppointments = sortedAppointments.slice(startIdx, startIdx + this.pageSize);
          
          // Load patient names for all appointments
          this.loadPatientNamesForAppointments(this.upcomingAppointments);
          
          this.loadingUpcoming = false;
          
          console.log(`Showing today's appointments ${startIdx+1}-${Math.min(startIdx + this.pageSize, this.totalUpcomingAppointments)} of ${this.totalUpcomingAppointments}`);
        },
        error: (error: any) => {
          console.error('Error fetching today\'s appointments:', error);
          this.loadingUpcoming = false;
          this.upcomingAppointments = [];
          this.totalUpcomingAppointments = 0;
        }
      });
  }
  
  // Get formatted date and time from ISO string
  formatDateTime(dateTimeString: string | null): string {
    if (!dateTimeString) return 'Not scheduled';
    
    const date = new Date(dateTimeString);
    const today = new Date();
    let formattedDate = '';
    
    // Check if date is today
    if (date.toDateString() === today.toDateString()) {
      formattedDate = 'Today';
    } else {
      formattedDate = date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short'
      });
    }
    
    const formattedTime = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    return `${formattedDate}, ${formattedTime}`;
  }
  

  
  // Get status badge class
  getStatusClass(status: string): string {
    switch (status) {
      case AppointmentStatus.COMPLETED:
      case AppointmentStatus.FINISHED:
        return 'completed';
      case AppointmentStatus.ENGAGED:
      case AppointmentStatus.ARRIVED:
        return 'in-progress';
      case AppointmentStatus.QUEUE:
        return 'waiting';
      case AppointmentStatus.SCHEDULED:
      case AppointmentStatus.RESCHEDULED:
        return 'scheduled';
      case AppointmentStatus.CANCELLED:
        return 'cancelled';
      default:
        return 'scheduled';
    }
  }

  // Get category badge class
  getCategoryClass(category: string): string {
    if (!category) return 'regular';
    
    switch (category.toLowerCase()) {
      case 'vip':
        return 'vip';
      case 'priority':
        return 'priority';
      case 'regular':
      default:
        return 'regular';
    }
  }

  // Format appointment time for display
  formatAppointmentTime(dateTimeString: string | null): string {
    if (!dateTimeString) return '';
    
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  // Get time class based on how soon the appointment is
  getTimeClass(dateTimeString: string | null): string {
    if (!dateTimeString) return '';
    
    const appointmentTime = new Date(dateTimeString).getTime();
    const currentTime = new Date().getTime();
    const diffMs = appointmentTime - currentTime;
    
    // If appointment is in the past or very soon (within 30 minutes)
    if (diffMs < 30 * 60 * 1000) return 'urgent';
    
    // If appointment is within 2 hours
    if (diffMs < 2 * 60 * 60 * 1000) return 'soon';
    
    // If appointment is today
    const today = new Date();
    const appointmentDate = new Date(dateTimeString);
    if (
      appointmentDate.getDate() === today.getDate() &&
      appointmentDate.getMonth() === today.getMonth() &&
      appointmentDate.getFullYear() === today.getFullYear()
    ) {
      return 'today';
    }
    
    return 'future';
  }

  // Format appointment wait time
  getWaitTime(dateTimeString: string | null): string {
    if (!dateTimeString) return '';
    
    const appointmentTime = new Date(dateTimeString).getTime();
    const currentTime = new Date().getTime();
    const diffMs = appointmentTime - currentTime;
    
    if (diffMs < 0) return 'Due now';
    
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 60) return `${diffMins}m`;
    
    const hours = Math.floor(diffMins / 60);
    return `${hours}h`;
  }

  // Get patient name by ID with enhanced mapping
  getPatientName(patientId: string): string {
    if (!patientId) return 'Unknown Patient';
    
    // Check cache first for best performance
    if (this.patientNamesCache.has(patientId)) {
      return this.patientNamesCache.get(patientId) || 'Unknown Patient';
    }
    
    // Check recent patients (existing logic)
    const recentPatient = this.recentPatients.find(p => p.patientId === patientId);
    if (recentPatient) {
      const fullName = `${recentPatient.firstName} ${recentPatient.lastName}`.trim();
      this.patientNamesCache.set(patientId, fullName);
      return fullName;
    }
    
    // Check all patients array
    const patient = this.allPatients.find(p => p.id === patientId);
    if (patient) {
      const fullName = `${patient.firstName} ${patient.lastName}`.trim();
      this.patientNamesCache.set(patientId, fullName);
      return fullName;
    }
    
    // If still not found, try to load the specific patient
    this.loadPatientById(patientId);
    
    return 'Loading...';
  }
  
  /**
   * Load a specific patient by ID
   */
  private loadPatientById(patientId: string): void {
    this.patientService.getPatientById(patientId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (patient: Patient) => {
          if (patient) {
            const fullName = `${patient.firstName} ${patient.lastName}`.trim();
            this.patientNamesCache.set(patientId, fullName);
            // Trigger change detection to update the view
            this.cdr.detectChanges();
          }
        },
        error: (error: any) => {
          console.error(`Error loading patient ${patientId}:`, error);
        }
      });
  }

  // Get patient phone from appointment
  getPatientPhone(patientId: string): string {
    console.log('getPatientPhone called with patientId:', patientId);
    console.log('appointmentPatientDetails:', this.appointmentPatientDetails);
    
    // First check if we have fetched patient details
    if (this.appointmentPatientDetails) {
      // Check various possible field names for phone number
      const phoneFields = ['phoneNumber', 'phone', 'mobile', 'mobileNumber', 'contactNumber'];
      for (const field of phoneFields) {
        if (this.appointmentPatientDetails[field]) {
          console.log(`Using fetched patient ${field}:`, this.appointmentPatientDetails[field]);
          return this.appointmentPatientDetails[field];
        }
      }
      console.log('Patient details found but no phone field available');
    }
    
    // Fallback to searching in recent patients cache
    const patient = this.recentPatients.find(p => p.patientId === patientId);
    if (patient && patient.phoneNumber) {
      console.log('Using cached patient phone:', patient.phoneNumber);
      return patient.phoneNumber;
    }
    
    // Final fallback
    console.log('No patient phone available for:', patientId);
    return 'N/A';
  }

  // Get doctor name from appointment
  getDoctorName(doctorId: string): string {
    // First check if we have fetched doctor details
    if (this.appointmentDoctorDetails && this.appointmentDoctorDetails.name) {
      console.log('Using fetched doctor name:', this.appointmentDoctorDetails.name);
      return this.appointmentDoctorDetails.name;
    }
    
    // Fallback to doctor ID if no fetched data available
    console.log('Using fallback doctor ID:', doctorId);
    return doctorId ? `${doctorId}` : 'No doctor assigned';
  }

  // Pagination handlers
  goToNextPage(listType: 'recent' | 'upcoming'): void {
  switch (listType) {
    case 'recent':
      this.loadRecentPatients(this.currentRecentPage + 1);
      break;
    case 'upcoming':
      this.loadUpcomingAppointments(this.currentUpcomingPage + 1);
      break;
  }
}

  goToPrevPage(listType: 'recent' | 'upcoming'): void {
    switch (listType) {
      case 'recent':
        this.loadRecentPatients(Math.max(0, this.currentRecentPage - 1));
        break;
      case 'upcoming':
        this.loadUpcomingAppointments(Math.max(0, this.currentUpcomingPage - 1));
        break;
    }
  }

  refreshData(): void {
    this.loadDashboardStats();
    this.loadRecentPatients(this.currentRecentPage);
    this.loadUpcomingAppointments(this.currentUpcomingPage);
    this.loadInventoryAlerts();
  }

  // View appointment details - opens a modal with appointment details
  viewAppointmentDetails(appointment: any): void {
    console.log('Viewing appointment details:', appointment);
    this.selectedAppointmentDetails = appointment;
    this.loadingAppointmentDetails = true;
    this.appointmentDoctorDetails = null;
    this.appointmentPatientDetails = null;
    this.doctorDataReady = false;
    this.showAppointmentDetailsModal = true;
    
    // Fetch doctor and patient details concurrently
    const doctorRequest = appointment.doctorId ? 
      this.doctorService.getDoctorById(appointment.doctorId).pipe(
        map(response => response.data),
        catchError(error => {
          console.error('Error fetching doctor details:', error);
          return of(null);
        })
      ) : of(null);
    
    const patientRequest = appointment.patientId ? 
      this.patientService.getPatientById(appointment.patientId).pipe(
        catchError(error => {
          console.error('Error fetching patient details:', error);
          return of(null);
        })
      ) : of(null);
    
    // Execute both requests concurrently
    forkJoin({
      doctor: doctorRequest,
      patient: patientRequest
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        console.log('Fetched appointment details:', result);
        console.log('Doctor data:', result.doctor);
        console.log('Patient data:', result.patient);
        this.appointmentDoctorDetails = result.doctor;
        this.appointmentPatientDetails = result.patient;
        console.log('Assigned appointmentDoctorDetails:', this.appointmentDoctorDetails);
        console.log('Assigned appointmentPatientDetails:', this.appointmentPatientDetails);
        this.loadingAppointmentDetails = false;
        this.doctorDataReady = !!(this.appointmentDoctorDetails && this.appointmentDoctorDetails.name);
        console.log('Doctor data ready:', this.doctorDataReady);
        
        // Force change detection
        setTimeout(() => {
          this.cdr.detectChanges();
          console.log('Change detection triggered');
        }, 0);
      },
      error: (error) => {
        console.error('Error fetching appointment details:', error);
        this.loadingAppointmentDetails = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Close appointment details modal
  closeAppointmentDetailsModal(): void {
    this.showAppointmentDetailsModal = false;
    this.selectedAppointmentDetails = null;
  }

  // Open reschedule modal
  openRescheduleModal(appointment: any): void {
    console.log('Opening reschedule modal for appointment:', appointment);
    this.selectedAppointmentForReschedule = appointment;
    this.showRescheduleModal = true;
  }

  // Close reschedule modal
  closeRescheduleModal(): void {
    this.showRescheduleModal = false;
    this.selectedAppointmentForReschedule = null;
  }
  
  // Save appointment reschedule
  saveReschedule(): void {
    // Get form values from the DOM (since we don't have FormGroup in this component)
    const dateInput = document.getElementById('rescheduleDate') as HTMLInputElement;
    const timeInput = document.getElementById('rescheduleTime') as HTMLInputElement;
    const reasonSelect = document.getElementById('rescheduleReason') as HTMLSelectElement;
    const notesTextarea = document.getElementById('rescheduleNotes') as HTMLTextAreaElement;
    
    if (!dateInput.value || !timeInput.value || !reasonSelect.value) {
      console.error('Please fill all required fields');
      // Here you might want to show validation errors in the UI
      return;
    }
    
    // Create a new date from the selected date and time
    const [year, month, day] = dateInput.value.split('-').map(Number);
    const [hours, minutes] = timeInput.value.split(':').map(Number);
    const newAppointmentDate = new Date(year, month - 1, day, hours, minutes);
    
    // Get current appointment data
    const appointmentId = this.selectedAppointmentForReschedule.id;
    
    console.log('Rescheduling appointment:', {
      appointmentId,
      originalDateTime: this.selectedAppointmentForReschedule.appointmentDateTime,
      newDateTime: newAppointmentDate.toISOString(),
      reason: reasonSelect.value,
      notes: notesTextarea.value
    });
    
    // TODO: Call the appointment service to update the appointment
    // For now, we'll just simulate a successful update
    setTimeout(() => {
      // Update the appointment in the local data
      const appointmentIndex = this.upcomingAppointments.findIndex(
        a => a.id === appointmentId
      );
      
      if (appointmentIndex !== -1) {
        this.upcomingAppointments[appointmentIndex] = {
          ...this.upcomingAppointments[appointmentIndex],
          appointmentDateTime: newAppointmentDate.toISOString(),
          notes: notesTextarea.value ? 
            (this.upcomingAppointments[appointmentIndex].notes || '') + '\n\nRescheduled: ' + reasonSelect.value + 
            (notesTextarea.value ? ' - ' + notesTextarea.value : '') : 
            this.upcomingAppointments[appointmentIndex].notes
        };
      }
      
      // Close the modal
      this.closeRescheduleModal();
      
      // In a real app, we would refresh data from the server
      // this.loadUpcomingAppointments(this.currentUpcomingPage);
    }, 500); // Simulate network delay
  }

  /**
   * Get today's advances from the billing API
   */
  private getAdvancesToday(): Observable<any[]> {
    const today = this.getTodayLocalDate();
    return this.http.get<any>(`${environment.opdApiUrl}/api/billing/advance`)
      .pipe(
        map((response: any) => {
          if (response.success && response.data) {
            // Filter advances for today using local date
            const todaysAdvances = response.data.filter((advance: any) => {
              const advanceDate = this.extractLocalDate(advance.createdDate || advance.date);
              return advanceDate === today;
            });
            
            console.log('📈 Advances filtered:', {
              total: response.data.length,
              today: todaysAdvances.length,
              todayDate: today,
              advances: todaysAdvances
            });
            
            return todaysAdvances;
          }
          return [];
        }),
        catchError((error: any) => {
          console.error('❌ Error fetching today\'s advances:', error);
          return of([]);
        })
      );
  }

  /**
   * Extract local date from various date formats (YYYY-MM-DD)
   */
  private extractLocalDate(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return '';
    
    try {
      let date: Date;
      
      if (typeof dateInput === 'string') {
        // Handle ISO string or date string
        date = new Date(dateInput);
      } else {
        date = dateInput;
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return '';
      }
      
      // Extract local date in YYYY-MM-DD format
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error extracting local date:', error, dateInput);
      return '';
    }
  }

  /**
   * Calculate total from array of objects with proper decimal handling
   */
  private calculateTotal(items: any[], property: string): number {
    if (!items || !Array.isArray(items)) {
      return 0;
    }
    
    return items.reduce((sum, item) => {
      const value = item[property];
      const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
      return sum + numValue;
    }, 0);
  }

  /**
   * Round number to specified decimal places
   */
  private roundToDecimal(value: number, decimals: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      return 0;
    }
    
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
  
  /**
   * Load all patients for name mapping
   */
  loadAllPatients(): void {
    this.patientService.getAllPatients()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (patients: Patient[]) => {
          this.allPatients = patients;
          // Cache patient names for quick lookup
          patients.forEach(patient => {
            if (patient.id) {
              const fullName = `${patient.firstName} ${patient.lastName}`.trim();
              this.patientNamesCache.set(patient.id, fullName);
            }
          });
          console.log('Loaded patients for name mapping:', patients.length);
        },
        error: (error: any) => {
          console.error('Error loading patients:', error);
        }
      });
  }
  
  /**
   * Load patient names for a list of appointments
   */
  loadPatientNamesForAppointments(appointments: any[]): void {
    appointments.forEach(appointment => {
      if (appointment.patientId && !this.patientNamesCache.has(appointment.patientId)) {
        // If we don't have the patient name cached, try to get it from allPatients
        const patient = this.allPatients.find(p => p.id === appointment.patientId);
        if (patient) {
          const fullName = `${patient.firstName} ${patient.lastName}`.trim();
          this.patientNamesCache.set(appointment.patientId, fullName);
        }
      }
    });
  }
}
