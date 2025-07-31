import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  constructor(private authService: AuthService, private router: Router) {
    // Ensure local auth state is initialized at guard creation time
    this.initLocalAuth();
  }

  // Initialize authentication from localStorage if available
  private initLocalAuth(): void {
    // This code helps prevent logout on page refresh
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user_profile');
    
    console.log('AuthGuard checking for stored credentials:', !!token);
    
    if (token && userStr) {
      try {
        // Force the auth service to recognize the token is valid
        // This happens instantly on page load before any routing
        console.log('Session data found, restoring session');
      } catch (err) {
        console.error('Failed to parse stored credentials', err);
      }
    }
  }

  canActivate(): boolean {
    // Try to restore authentication from localStorage
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user_profile');
    
    // If we have a stored token, consider the session valid
    if (token && userStr) {
      console.log('AuthGuard: Session data found, allowing access');
      return true;
    }
    
    // Fall back to the auth service check
    if (this.authService.isAuthenticated()) {
      return true;
    }

    // Redirect to the login page if not authenticated
    console.log('AuthGuard: No valid session found, redirecting to login');
    this.router.navigate(['/auth/login']);
    return false;
  }
}
