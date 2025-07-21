import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PatientService } from '../../patients/shared/patient.service';
import { AppointmentService } from '../../appointments/shared/appointment.service';
import { AppointmentFilters } from '../../appointments/shared/appointment.model';
import { Appointment, AppointmentStatus } from '../../appointments/shared/appointment.model';
import { Patient } from '../../patients/shared/patient.model';
import { ApiResponse } from '../../shared/models/api-response.model';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { InventoryService } from '../../inventory/services/inventory.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ExpiringMedicinesReportComponent } from '../../inventory/components/expiring-medicines-report/expiring-medicines-report.component';
import { LowStockMedicinesReportComponent } from '../../inventory/components/low-stock-medicines-report/low-stock-medicines-report.component';
import { BillingService } from '../../billing/shared/billing.service';

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
  lowStockItemsCount = 0;
  expiringMedicinesCount = 0;
  lowStockItems: any[] = [];
  expiringMedicines: any[] = [];
  loadingInventory = false;
  recentPatients: any[] = [];
  upcomingAppointments: any[] = [];
  
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
  
  constructor(
    private patientService: PatientService,
    private appointmentService: AppointmentService,
    private inventoryService: InventoryService,
    private billingService: BillingService,
    private http: HttpClient
  ) {}
  
  ngOnInit(): void {
    this.loadDashboardStats();
    this.loadRecentPatients();
    
    // Load appointments from API
    this.loadUpcomingAppointments();
    
    this.loadInventoryAlerts();
    
    // Set up auto-refresh every 5 minutes
    const refreshInterval = setInterval(() => {
      this.refreshData();
    }, 5 * 60 * 1000);
    
    // Clear interval on destroy
    this.destroy$.subscribe(() => {
      clearInterval(refreshInterval);
    });
  }
  
  // This method was kept for fallback but is no longer used
  // Initialize test appointment data directly for debugging
  private initializeTestAppointments(page: number = 0): void {
    console.warn('Using fallback test appointments instead of API data');
    // Method kept for reference/fallback but not used in production
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  // Load inventory alerts - expiring medicines and low stock
  loadInventoryAlerts(): void {
    this.loadingInventory = true;
    
    // Get expiring medicines
    this.inventoryService.getExpiringMedicines().subscribe({
      next: (data) => {
        this.expiringMedicines = data;
        this.expiringMedicinesCount = data.length;
        this.loadingInventory = false;
      },
      error: (error) => {
        console.error('Error loading expiring medicines:', error);
        this.expiringMedicines = [];
        this.expiringMedicinesCount = 0;
        this.loadingInventory = false;
      }
    });
    
    // Get low stock medicines
    this.inventoryService.getLowStockMedicines().subscribe({
      next: (data) => {
        this.lowStockItems = data;
        this.lowStockItemsCount = data.length;
        this.loadingInventory = false;
      },
      error: (error) => {
        console.error('Error loading low stock medicines:', error);
        this.lowStockItems = [];
        this.lowStockItemsCount = 0;
        this.loadingInventory = false;
      }
    });
  }
  
  // Load dashboard summary statistics
  loadDashboardStats(): void {
    this.loadingStats = true;
    
    // Get today's date in YYYY-MM-DD format for filtering
    const today = new Date().toISOString().split('T')[0]; // e.g., "2025-07-15"
    
    // Use forkJoin to get both today's appointments and revenue in parallel
    forkJoin({
      appointments: this.appointmentService.getTodaysAppointments(),
      revenue: this.billingService.getTodaysRevenue()
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
        
        // Set revenue from billing service
        this.revenueToday = results.revenue;
        
        // Get pending bills count from appointments that need billing
        const pendingBillingAppointments = todaysAppointments.filter(app => 
          app.status === 'COMPLETED' && !app.billingCompleted
        );
        this.pendingBillsCount = pendingBillingAppointments.length;
        
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
          
          // Calculate pending bills
          const pendingBillingAppointments = todaysAppointments.filter(app => 
            app.status === 'COMPLETED' && !app.billingCompleted
          );
          this.pendingBillsCount = pendingBillingAppointments.length;
        },
        error: (error) => {
          console.error('Error loading appointments for stats', error);
          this.patientCountToday = 0;
          this.pendingBillsCount = 0;
        }
      });
      
    // Get today's revenue
    this.billingService.getTodaysRevenue()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (revenue: number) => {
          this.revenueToday = revenue;
        },
        error: (error) => {
          console.error('Error loading revenue', error);
          this.revenueToday = 0;
        }
      });
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
          this.recentPatients = patients.slice(0, this.pageSize);
          this.totalRecentPatients = patients.length;
          this.loadingRecent = false;
        },
        error: (error: any) => { // Fix: implicit any type
          console.error('Error loading recent patients', error);
          this.loadingRecent = false;
          // Keep the UI working with empty array
          this.recentPatients = [];
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
    const today = new Date().toISOString().split('T')[0]; // e.g., "2025-07-15"
    
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
  
  // Get patient name by ID
  getPatientName(patientId: string): string {
    if (!patientId) return 'Unknown Patient';
    
    // Find patient in recent patients list if available
    const patient = this.recentPatients.find(p => p.patientId === patientId);
    if (patient) {
      return `${patient.firstName} ${patient.middleName ? patient.middleName + ' ' : ''}${patient.lastName}`;
    }
    
    // If not found in recent patients, return the ID for now
    // In a real implementation, you might want to fetch the patient details from the API
    return patientId;
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
}
