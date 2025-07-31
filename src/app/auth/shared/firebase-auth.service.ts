import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  photoURL?: string;
  role: UserRole;
  isEmailVerified: boolean;
  metadata: {
    creationTime: string;
    lastSignInTime: string;
  };
}

export enum UserRole {
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
  STAFF = 'STAFF',
  ADMIN = 'ADMIN'
}

export interface AuthState {
  user: UserProfile | null;
  token: string | null;
  authenticated: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseAuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private authState = new BehaviorSubject<AuthState>({
    user: null,
    token: null,
    authenticated: false
  });

  authState$ = this.authState.asObservable();
  
  constructor(private http: HttpClient) {
    this.loadAuthFromStorage();
  }

  // Get current user profile
  get currentUser(): UserProfile | null {
    return this.authState.getValue().user;
  }

  // Get current auth token
  get authToken(): string | null {
    return this.authState.getValue().token;
  }

  // Check if user is authenticated
  get isAuthenticated(): boolean {
    return this.authState.getValue().authenticated;
  }

  // Get user role
  get userRole(): UserRole | null {
    const user = this.currentUser;
    return user ? user.role : null;
  }

  // Check if user has specific role
  hasRole(role: UserRole | UserRole[]): boolean {
    if (!this.isAuthenticated || !this.currentUser) {
      return false;
    }

    if (Array.isArray(role)) {
      return role.includes(this.currentUser.role);
    }
    
    return this.currentUser.role === role;
  }

  // Load authentication data from storage
  private loadAuthFromStorage(): void {
    try {
      const token = localStorage.getItem('auth_token');
      const userJson = localStorage.getItem('user_profile');
      
      if (token && userJson) {
        const user = JSON.parse(userJson) as UserProfile;
        this.updateAuthState(user, token, true);
      }
    } catch (error) {
      console.error('Error loading auth from storage:', error);
      this.clearAuthData();
    }
  }

  // Update auth state and storage
  private updateAuthState(user: UserProfile | null, token: string | null, authenticated: boolean): void {
    this.authState.next({ user, token, authenticated });
    
    if (user && token) {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_profile', JSON.stringify(user));
    } else {
      this.clearAuthData();
    }
  }

  // Clear authentication data
  private clearAuthData(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_profile');
    this.authState.next({ user: null, token: null, authenticated: false });
  }

  // Sign in with email and password
  signInWithEmailPassword(email: string, password: string): Observable<UserProfile> {
    return this.http.post<{user: UserProfile, token: string}>(`${this.apiUrl}/signin`, { email, password })
      .pipe(
        tap(response => this.updateAuthState(response.user, response.token, true)),
        map(response => response.user),
        catchError(error => {
          const errorMsg = error.error?.message || 'Failed to sign in';
          console.error('Sign in error:', errorMsg);
          return throwError(() => new Error(errorMsg));
        })
      );
  }

  // Sign in with phone number and OTP
  signInWithPhoneNumber(phoneNumber: string, otp: string): Observable<UserProfile> {
    return this.http.post<{user: UserProfile, token: string}>(`${this.apiUrl}/signin-phone`, { phoneNumber, otp })
      .pipe(
        tap(response => this.updateAuthState(response.user, response.token, true)),
        map(response => response.user),
        catchError(error => {
          const errorMsg = error.error?.message || 'Failed to sign in with phone number';
          console.error('Sign in with phone error:', errorMsg);
          return throwError(() => new Error(errorMsg));
        })
      );
  }

  // Request OTP for phone verification
  requestOTP(phoneNumber: string, purpose: 'signin' | 'signup' | 'reset'): Observable<boolean> {
    return this.http.post<{success: boolean, message: string}>(`${this.apiUrl}/request-otp`, { phoneNumber, purpose })
      .pipe(
        map(response => response.success),
        catchError(error => {
          const errorMsg = error.error?.message || 'Failed to send OTP';
          console.error('OTP request error:', errorMsg);
          return throwError(() => new Error(errorMsg));
        })
      );
  }

  // Register new user
  signUp(userData: {
    displayName: string,
    email: string,
    password: string,
    phoneNumber: string,
    role: UserRole
  }): Observable<UserProfile> {
    return this.http.post<{user: UserProfile, token: string}>(`${this.apiUrl}/signup`, userData)
      .pipe(
        tap(response => this.updateAuthState(response.user, response.token, true)),
        map(response => response.user),
        catchError(error => {
          const errorMsg = error.error?.message || 'Failed to register user';
          console.error('Sign up error:', errorMsg);
          return throwError(() => new Error(errorMsg));
        })
      );
  }

  // Reset password
  resetPassword(email: string): Observable<boolean> {
    return this.http.post<{success: boolean}>(`${this.apiUrl}/reset-password`, { email })
      .pipe(
        map(response => response.success),
        catchError(error => {
          const errorMsg = error.error?.message || 'Failed to reset password';
          console.error('Password reset error:', errorMsg);
          return throwError(() => new Error(errorMsg));
        })
      );
  }

  // Change password (authenticated)
  changePassword(currentPassword: string, newPassword: string): Observable<boolean> {
    return this.http.post<{success: boolean}>(`${this.apiUrl}/change-password`, { 
      currentPassword, 
      newPassword 
    })
      .pipe(
        map(response => response.success),
        catchError(error => {
          const errorMsg = error.error?.message || 'Failed to change password';
          console.error('Password change error:', errorMsg);
          return throwError(() => new Error(errorMsg));
        })
      );
  }

  // Update user profile
  updateProfile(profileData: Partial<Omit<UserProfile, 'uid' | 'role'>>): Observable<UserProfile> {
    return this.http.put<{user: UserProfile}>(`${this.apiUrl}/profile`, profileData)
      .pipe(
        switchMap(response => {
          // Update local storage with new profile but keep token
          const currentState = this.authState.getValue();
          if (currentState.token) {
            this.updateAuthState(response.user, currentState.token, true);
          }
          return of(response.user);
        }),
        catchError(error => {
          const errorMsg = error.error?.message || 'Failed to update profile';
          console.error('Profile update error:', errorMsg);
          return throwError(() => new Error(errorMsg));
        })
      );
  }

  // Sign out
  signOut(): Observable<boolean> {
    return this.http.post<{success: boolean}>(`${this.apiUrl}/signout`, {})
      .pipe(
        tap(() => this.clearAuthData()),
        map(response => response.success),
        catchError(error => {
          // Still clear local auth state even if server call fails
          this.clearAuthData();
          const errorMsg = error.error?.message || 'Error during sign out';
          console.error('Sign out error:', errorMsg);
          return of(true); // Return success anyway since we've cleared local state
        })
      );
  }

  // Verify email address
  verifyEmail(code: string): Observable<boolean> {
    return this.http.post<{success: boolean}>(`${this.apiUrl}/verify-email`, { code })
      .pipe(
        tap(response => {
          if (response.success && this.currentUser) {
            // Update user with verified email status
            const updatedUser = {
              ...this.currentUser,
              isEmailVerified: true
            };
            this.updateAuthState(updatedUser, this.authToken, true);
          }
        }),
        map(response => response.success),
        catchError(error => {
          const errorMsg = error.error?.message || 'Failed to verify email';
          console.error('Email verification error:', errorMsg);
          return throwError(() => new Error(errorMsg));
        })
      );
  }

  // Check if user is in role
  isInRole(allowedRoles: UserRole[]): boolean {
    const userRole = this.userRole;
    return this.isAuthenticated && userRole !== null && allowedRoles.includes(userRole);
  }
}
