import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, delay, map, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export interface LoginResponse {
  token: string;
  userId: string;
  displayName: string | null;
  role: string;
  organizations: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private authApiUrl = environment.authApiUrl;
  private currentUser: UserProfile | null = null;
  private authToken: string | null = null;
  private authStateSubject = new BehaviorSubject<boolean>(false);
  private tokenExpirationTimer: any;

  constructor(private http: HttpClient, private router: Router) {
    // Check if user is already logged in from localStorage
    this.loadAuthFromStorage();
    // Update auth state based on token presence
    this.authStateSubject.next(!!this.authToken);
  }

  // Load authentication data from storage if available
  private loadAuthFromStorage(): void {
    try {
      // Get stored authentication data
      const storedToken = localStorage.getItem('auth_token');
      const storedUserStr = localStorage.getItem('user_profile');
      const tokenExpTimeStr = localStorage.getItem('token_expiration');
      
      // Check if we have the required data
      if (!storedToken || !storedUserStr) {
        console.log('No stored authentication found');
        return;
      }
      
      // Parse the user data
      let parsedUser: UserProfile;
      try {
        parsedUser = JSON.parse(storedUserStr);
        if (!parsedUser || typeof parsedUser !== 'object') {
          throw new Error('Invalid user profile format');
        }
      } catch (parseError) {
        console.error('Failed to parse stored user data:', parseError);
        this.clearAuthStorage();
        return;
      }
      
      // Set the authentication state
      this.authToken = storedToken;
      this.currentUser = parsedUser;
      
      console.log('Restored authentication for user:', parsedUser.name || 'Unknown');
      
      // Check token expiration if available
      if (tokenExpTimeStr) {
        const expTime = new Date(tokenExpTimeStr).getTime();
        const now = new Date().getTime();
        
        if (expTime > now) {
          // Set auto logout timer
          this.autoLogout(expTime - now);
          console.log(`Token valid for ${Math.round((expTime - now) / 1000 / 60)} more minutes`);
          
          // Activate the auth state
          this.authStateSubject.next(true);
        } else {
          console.log('Token has expired, logging out');
          this.clearAuthStorage();
          return;
        }
      } else {
        // No expiration time, default to 24 hours
        const defaultExpiration = 24 * 60 * 60 * 1000; // 24 hours
        this.autoLogout(defaultExpiration);
        
        // Activate the auth state
        this.authStateSubject.next(true);
      }
    } catch (error) {
      console.error('Error loading auth from storage:', error);
      this.clearAuthStorage();
    }
  }

  // Save authentication data to localStorage with expiration
  private saveAuthToStorage(token: string, user: UserProfile): void {
    // Calculate token expiration (default to 24 hours if not in token)
    const tokenExpiration = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
    
    // Save all auth data
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_profile', JSON.stringify(user));
    localStorage.setItem('token_expiration', tokenExpiration.toISOString());
    
    // Set auto-logout timer
    const expirationDuration = tokenExpiration.getTime() - new Date().getTime();
    this.autoLogout(expirationDuration);
    
    // Update auth state
    this.authStateSubject.next(true);
    console.log('Authentication data saved to localStorage with expiration:', tokenExpiration);
  }

  // Clear authentication data from localStorage
  private clearAuthStorage(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_profile');
    localStorage.removeItem('token_expiration');
    
    // Clear timers
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = null;
    }
    
    // Reset state
    this.authToken = null;
    this.currentUser = null;
    this.authStateSubject.next(false);
    
    console.log('Authentication data cleared from localStorage');
  }

  // Get current auth token
  getToken(): string | null {
    return this.authToken;
  }

  // Get logged in user profile
  getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.authToken;
  }
  
  // Observable to monitor authentication state
  authState(): Observable<boolean> {
    return this.authStateSubject.asObservable();
  }
  
  // Logout method used by the interceptor
  logout(): Observable<boolean> {
    // Clear local authentication data
    this.authToken = null;
    this.currentUser = null;
    this.clearAuthStorage();
    
    console.log('User logged out');
    return of(true).pipe(delay(100)); // Small delay to allow UI to update
  }

  // Set automatic logout timer based on token expiration
  private autoLogout(expirationDuration: number): void {
    // Clear any existing timer
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
    }
    
    console.log(`Setting auto-logout timer for ${Math.round(expirationDuration / 1000)} seconds`);
    this.tokenExpirationTimer = setTimeout(() => {
      console.log('Auto-logout timer triggered');
      this.logout().subscribe();
      this.router.navigate(['/auth/login']);
    }, expirationDuration);
  }

  // Verify token validity with backend (useful after page refresh)
  verifyToken(): Observable<boolean> {
    // If no token exists, return false immediately
    if (!this.authToken) {
      return of(false);
    }
    
    // Check with backend if token is still valid
    // You can implement this endpoint on your backend
    return this.http.get<{valid: boolean}>(`${this.authApiUrl}/api/auth/verify-token`)
      .pipe(
        map(response => response.valid),
        catchError(error => {
          console.error('Token verification failed:', error);
          this.clearAuthStorage();
          return of(false);
        })
      );
  }
  
  // Login with mobile number and password
  loginWithMobile(mobile: string, password: string): Observable<LoginResponse> {
    // Use auth-service API endpoint
    // The backend only accepts email and password fields
    // For mobile login, we'll treat the mobile as an email for now
    return this.http.post<LoginResponse>(`${this.authApiUrl}/api/public/auth/signin`, { email: mobile, password })
      .pipe(
        tap(response => {
          this.authToken = response.token;
          // Map response to user profile
          const user: UserProfile = {
            id: response.userId,
            name: response.displayName || 'User',
            email: mobile,
            mobile: mobile,
            role: response.role
          };
          this.currentUser = user;
          this.saveAuthToStorage(response.token, user);
        }),
        catchError(error => {
          return throwError(() => new Error(error.error?.message || 'Login failed'));
        })
      );
  }

  // Login with email and password
  loginWithEmail(email: string, password: string): Observable<LoginResponse> {
    // Use auth-service API endpoint
    return this.http.post<LoginResponse>(`${this.authApiUrl}/api/public/auth/signin`, { email, password })
      .pipe(
        tap(response => {
          this.authToken = response.token;
          // Map response to user profile
          const user: UserProfile = {
            id: response.userId,
            name: response.displayName || 'User',
            email: email,
            mobile: '',
            role: response.role
          };
          this.currentUser = user;
          this.saveAuthToStorage(response.token, user);
        }),
        catchError(error => {
          console.error('Login error:', error);
          return throwError(() => new Error(error.error || 'Login failed'));
        })
      );
  }

  // Login with OTP
  loginWithOTP(mobile: string, otp: string): Observable<LoginResponse> {
    // Use auth-service signin-otp endpoint
    return this.http.post<LoginResponse>(`${this.authApiUrl}/api/public/auth/signin-otp`, { mobile, otp })
      .pipe(
        tap(response => {
          this.authToken = response.token;
          // Map response to user profile
          const user: UserProfile = {
            id: response.userId,
            name: response.displayName || 'User',
            email: '',
            mobile: mobile,
            role: response.role
          };
          this.currentUser = user;
          this.saveAuthToStorage(response.token, user);
        }),
        catchError(error => {
          return throwError(() => new Error(error.error?.message || 'OTP login failed'));
        })
      );
  }

  // Request OTP for login or registration
  requestOTP(mobile: string, purpose: 'login' | 'signup' | 'reset'): Observable<{ success: boolean, message: string }> {
    // For 'reset' purpose, use forgot-password endpoint
    if (purpose === 'reset') {
      return this.http.post<{ success: boolean, message: string }>(`${this.authApiUrl}/api/public/auth/forgot-password`, { mobile })
        .pipe(
          catchError(error => {
            return throwError(() => new Error(error.error?.message || 'Failed to send OTP'));
          })
        );
    } else {
      // For login and signup, use request-otp endpoint
      return this.http.post<{ success: boolean, message: string }>(`${this.authApiUrl}/api/public/auth/request-otp`, { mobile, purpose })
        .pipe(
          catchError(error => {
            return throwError(() => new Error(error.error?.message || 'Failed to send OTP'));
          })
        );
    }
  }

  // Register a new user
  signup(userData: { mobile: string, otp: string, name?: string }): Observable<{ success: boolean, message: string }> {
    // For development, simulate API call
    // Replace with actual API call in production
    if (environment.production) {
      return this.http.post<{ success: boolean, message: string }>(`${this.authApiUrl}/auth/register`, userData)
        .pipe(
          catchError(error => {
            return throwError(() => new Error(error.error?.message || 'Registration failed'));
          })
        );
    } else {
      // Mock response for development
      return of({
        success: true,
        message: 'Registration successful. Please log in.'
      }).pipe(delay(800)); // Simulate network delay
    }
  }

  // Reset password with OTP verification
  resetPassword(data: { mobile: string, otp: string, newPassword: string }): Observable<{ success: boolean, message: string }> {
    // Use auth-service reset-password endpoint
    return this.http.post<{ success: boolean, message: string }>(`${this.authApiUrl}/api/public/auth/reset-password`, {
      mobile: data.mobile,
      token: data.otp, // The backend expects 'token' instead of 'otp'
      password: data.newPassword
    })
      .pipe(
        catchError(error => {
          return throwError(() => new Error(error.error?.message || 'Password reset failed'));
        })
      );
  }
}
