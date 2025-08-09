import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, UserProfile } from '../auth/shared/auth.service';
import { AppointmentService } from '../appointments/shared/appointment.service';
import { TokenService } from '../appointments/shared/token.service';
import { Appointment } from '../appointments/shared/appointment.model';
import { Subject, timer } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  user: UserProfile | null = null;
  private destroy$ = new Subject<void>();
  sessionExpired = false;
  patientsExpanded = false;
  billingExpanded = false;
  appointmentsExpanded = false;
  inventoryExpanded = false;
  memosExpanded = false;
  sidebarCollapsed = false;
  
  // Permission properties
  isSuperAdmin = false;
  // We don't need showBillingMenu anymore as we only hide the Billing Dashboard item, not the entire menu
  
  // Today's appointments count for global display
  todaysAppointmentCount: number = 0;
  loadingAppointments: boolean = false;
  
  // Token system properties
  currentToken: Appointment | null = null;
  waitingTokenCount: number = 0;
  loadingToken: boolean = false;
  
  constructor(
    private authService: AuthService,
    public router: Router,
    private appointmentService: AppointmentService,
    private tokenService: TokenService
  ) {}

  ngOnInit(): void {
    this.checkAuthentication();
    
    // Load sidebar state from localStorage
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState) {
      this.sidebarCollapsed = savedState === 'true';
    }
    
    // Monitor authentication state
    this.authService.authState()
      .pipe(takeUntil(this.destroy$))
      .subscribe((isAuthenticated: boolean) => {
        if (!isAuthenticated) {
          this.sessionExpired = true;
          this.router.navigate(['/auth/login']);
        }
      });
      
    // Set up appointment count refresh (initial load + every 5 minutes)
    this.loadTodaysAppointmentCount();
    
    // Load token information initially
    this.loadTokenInformation();
    
    // Auto-refresh the appointment count and token info every 5 minutes
    timer(5 * 60 * 1000, 5 * 60 * 1000)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => {
          // Only refresh if user is authenticated
          if (this.authService.isAuthenticated()) {
            this.loadTodaysAppointmentCount();
            this.loadTokenInformation();
          }
          return Promise.resolve(null);
        })
      )
      .subscribe();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  /**
   * Load today's appointment count for global display
   */
  loadTodaysAppointmentCount(): void {
    this.loadingAppointments = true;
    this.appointmentService.getTodaysAppointments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (appointments: any[]) => {
          // Filter out completed, finished, and cancelled appointments
          const activeAppointments = appointments.filter(appointment => {
            const status = appointment.status?.toLowerCase();
            return status !== 'completed' && status !== 'finished' && status !== 'cancelled';
          });
          
          this.todaysAppointmentCount = activeAppointments.length;
          console.log('Today\'s appointments:', {
            total: appointments.length,
            active: activeAppointments.length,
            excluded: appointments.length - activeAppointments.length
          });
          this.loadingAppointments = false;
        },
        error: (error: any) => {
          console.error('Error loading today\'s appointments:', error);
          this.loadingAppointments = false;
        }
      });
  }
  
  private checkAuthentication(): void {
    this.user = this.authService.getCurrentUser();
    
    if (!this.user) {
      console.log('No user found in session, redirecting to login');
      this.router.navigate(['/auth/login']);
    } else {
      // Load user permissions once authenticated
      this.loadUserPermissions();
    }
  }
  
  /**
   * Determine user permissions based on role and email
   * Only super admin has access to billing dashboard
   */
  private loadUserPermissions(): void {
    if (this.user) {
      // Check if user is super admin (by email or role)
      const email = this.user.email || '';
      const role = this.user.role || '';
      
      const isSuperAdminEmail = email.toLowerCase() === 'hanan-clinic@lemicare.com';
      const isSuperAdminRole = role.toUpperCase() === 'ROLE_SUPER_ADMIN' || 
                             role.toUpperCase() === 'SUPER_ADMIN';
      
      this.isSuperAdmin = isSuperAdminEmail || isSuperAdminRole;
      
      console.log('Dashboard Permissions:', {
        email,
        role,
        isSuperAdmin: this.isSuperAdmin
      });
    }
  }
  
  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    // Store user preference in localStorage
    localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed.toString());
    
    // Close all submenus when collapsing sidebar
    if (this.sidebarCollapsed) {
      this.patientsExpanded = false;
      this.billingExpanded = false;
      this.appointmentsExpanded = false;
      this.inventoryExpanded = false;
      this.memosExpanded = false;
    }
  }
  
  toggleSubmenu(menu: string): void {
    // Close other submenus if in collapsed state to avoid cluttering
    if (this.sidebarCollapsed) {
      this.sidebarCollapsed = false;
      localStorage.setItem('sidebarCollapsed', 'false');
      
      // Set all to false first
      this.patientsExpanded = false;
      this.billingExpanded = false;
      this.appointmentsExpanded = false;
      this.inventoryExpanded = false;
      this.memosExpanded = false;
      
      // Then open the requested menu after a slight delay
      setTimeout(() => {
        switch(menu) {
          case 'patients':
            this.patientsExpanded = true;
            break;
          case 'billing':
            this.billingExpanded = true;
            break;
          case 'appointments':
            this.appointmentsExpanded = true;
            break;
          case 'inventory':
            this.inventoryExpanded = true;
            break;
          case 'memos':
            this.memosExpanded = true;
            break;
        }
      }, 150);
      return;
    }
    
    // Get current state of the menu we're about to toggle
    const willExpand = this.getMenuExpandState(menu) === false;
    
    // First, collapse ALL submenus
    this.patientsExpanded = false;
    this.billingExpanded = false;
    this.appointmentsExpanded = false;
    this.inventoryExpanded = false;
    this.memosExpanded = false;
    
    // Then, only expand the current menu if it was previously collapsed
    if (willExpand) {
      switch(menu) {
        case 'patients':
          this.patientsExpanded = true;
          break;
        case 'billing':
          this.billingExpanded = true;
          break;
        case 'appointments':
          this.appointmentsExpanded = true;
          break;
        case 'inventory':
          this.inventoryExpanded = true;
          break;
        case 'memos':
          this.memosExpanded = true;
          break;
      }
    }
  }
  
  // Helper method to get the current expand state of a menu
  private getMenuExpandState(menu: string): boolean {
    switch(menu) {
      case 'patients':
        return this.patientsExpanded;
      case 'billing':
        return this.billingExpanded;
      case 'appointments':
        return this.appointmentsExpanded;
      case 'inventory':
        return this.inventoryExpanded;
      case 'memos':
        return this.memosExpanded;
      default:
        return false;
    }
  }

  navigateToSettings(): void {
    console.log('Navigating to settings page');
    this.router.navigate(['/settings']);
  }
  
  logout(): void {
    console.log('Logging out user');
    this.authService.logout().subscribe({
      next: () => {
        console.log('Logout successful, redirecting to login');
        this.user = null;
        this.router.navigate(['/auth/login']);
      },
      error: (error) => {
        console.error('Logout failed', error);
        // Still clear local session and navigate to login
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_profile');
        this.user = null;
        this.router.navigate(['/auth/login']);
      }
    });
  }
  
  /**
   * Create a mock token for display in the header
   * @param doctorId The doctor ID to use for the mock token
   */
  createMockToken(doctorId: string): void {
    this.currentToken = {
      appointmentId: 'test-appointment',
      patientId: 'test-patient',
      patientName: 'Test Patient',
      doctorId: doctorId,
      appointmentDateTime: new Date().toISOString(),
      appointmentType: 'OPD',
      status: 'ENGAGED',
      category: 'Regular',
      subCategory: 'Follow-up',
      notes: '',
      patientLatitude: null,
      patientLongitude: null,
      doctorLatitude: null,
      doctorLongitude: null,
      tokenNumber: 5,
      tokenStatus: 'CURRENT',
      tokenTime: new Date().toISOString(),
      tokenOrder: 1
    };
    this.waitingTokenCount = 3;
    this.loadingToken = false;
    console.log('Created mock token for display:', this.currentToken);
  }

  /**
   * Load token information for current doctor
   */
  loadTokenInformation(): void {
    if (!this.authService.isAuthenticated()) return;
    
    const userProfile = this.authService.getCurrentUser();
    
    // Use the userProfile id or a test doctor ID if user profile doesn't exist
    // For testing purposes - use a doctor ID that exists in the backend
    const doctorId = userProfile?.id || 'doctor-1';
    console.log('Loading token information for doctor ID:', doctorId);
    
    this.loadingToken = true;
    
    // Get current token from API
    this.tokenService.getCurrentToken(doctorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (token) => {
          this.currentToken = token;
          console.log('Current token loaded:', token);
          this.loadingToken = false;
          
          // If no token is returned from API, fall back to mock token for development
          if (!token) {
            console.warn('No token returned from API, using mock token for display');
            this.createMockToken(doctorId);
          }
        },
        error: (error) => {
          console.error('Error loading current token:', error);
          this.loadingToken = false;
          
          // On API error, fall back to mock token for development
          console.warn('Error loading token from API, using mock token for display');
          this.createMockToken(doctorId);
        }
      });
      
    // Get waiting count from API
    this.tokenService.getWaitingTokenCount(doctorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (count) => {
          this.waitingTokenCount = count;
          console.log('Waiting token count loaded:', count);
        },
        error: (error) => {
          console.error('Error loading waiting count:', error);
          // Leave the waiting count as is or set to default
          this.waitingTokenCount = 0;
        }
      });

  }
  
  /**
   * Handle next token operation (complete current token)
   */
  completeCurrentToken(): void {
    if (!this.authService.isAuthenticated()) return;
    
    const userProfile = this.authService.getCurrentUser();
    if (!userProfile) return;
    
    this.loadingToken = true;
    // Use the userProfile id as doctorId
    const doctorId = userProfile.id;
    
    // Use the real API to complete the current token
    this.tokenService.completeCurrentToken(doctorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newToken) => {
          this.currentToken = newToken;
          console.log('Token completed successfully, new token:', newToken);
          // Refresh token information to get updated data
          this.loadTokenInformation();
        },
        error: (error) => {
          console.error('Error completing token:', error);
          this.loadingToken = false;
          // Fall back to mock token on error for development
          console.warn('Error completing token via API, using mock token');
          this.createMockToken(doctorId);
        }
      });
  }
  
  /**
   * Handle token skipping
   */
  skipCurrentToken(): void {
    if (!this.authService.isAuthenticated()) return;
    
    const userProfile = this.authService.getCurrentUser();
    if (!userProfile) return;
    
    this.loadingToken = true;
    // Use the userProfile id as doctorId
    const doctorId = userProfile.id;
    
    // Use the real API to skip the current token
    this.tokenService.skipCurrentToken(doctorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newToken) => {
          this.currentToken = newToken;
          console.log('Token skipped successfully, new token:', newToken);
          // Refresh token information to get updated data
          this.loadTokenInformation();
        },
        error: (error) => {
          console.error('Error skipping token:', error);
          this.loadingToken = false;
          // Fall back to mock token on error for development
          console.warn('Error skipping token via API, using mock token');
          this.createMockToken(doctorId);
        }
      });
  }
}
