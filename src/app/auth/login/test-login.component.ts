import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirebaseAuthService, UserRole } from '../shared/firebase-auth.service';

@Component({
  selector: 'app-test-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <h2>Cosmic Doc Authentication Demo</h2>
      
      <div class="auth-form">
        <h3>Login</h3>
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" [(ngModel)]="email" placeholder="Enter email">
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" [(ngModel)]="password" placeholder="Enter password">
        </div>
        <button class="btn-login" (click)="login()">Login</button>
        
        <div class="error-message" *ngIf="errorMessage">
          {{ errorMessage }}
        </div>
      </div>
      
      <div class="auth-form">
        <h3>Register</h3>
        <div class="form-group">
          <label for="regName">Name</label>
          <input type="text" id="regName" name="regName" [(ngModel)]="regName" placeholder="Enter name">
        </div>
        <div class="form-group">
          <label for="regEmail">Email</label>
          <input type="email" id="regEmail" name="regEmail" [(ngModel)]="regEmail" placeholder="Enter email">
        </div>
        <div class="form-group">
          <label for="regPassword">Password</label>
          <input type="password" id="regPassword" name="regPassword" [(ngModel)]="regPassword" placeholder="Enter password">
        </div>
        <div class="form-group">
          <label for="regPhone">Phone Number</label>
          <input type="text" id="regPhone" name="regPhone" [(ngModel)]="regPhone" placeholder="Enter phone (e.g. +1234567890)">
        </div>
        <div class="form-group">
          <label for="regRole">Role</label>
          <select id="regRole" name="regRole" [(ngModel)]="regRole">
            <option [value]="UserRole.PATIENT">Patient</option>
            <option [value]="UserRole.DOCTOR">Doctor</option>
            <option [value]="UserRole.STAFF">Staff</option>
            <option [value]="UserRole.ADMIN">Admin</option>
          </select>
        </div>
        <button class="btn-register" (click)="register()">Register</button>
        
        <div class="error-message" *ngIf="regErrorMessage">
          {{ regErrorMessage }}
        </div>
      </div>
      
      <div class="auth-status" *ngIf="authService.isAuthenticated">
        <h3>Currently logged in as:</h3>
        <div class="user-info">
          <p><strong>Name:</strong> {{ authService.currentUser?.displayName }}</p>
          <p><strong>Email:</strong> {{ authService.currentUser?.email }}</p>
          <p><strong>Role:</strong> {{ authService.currentUser?.role }}</p>
        </div>
        <button class="btn-logout" (click)="logout()">Logout</button>
        <button class="btn-profile" (click)="goToProfile()">View Profile</button>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      font-family: 'Roboto', sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    
    h2 {
      text-align: center;
      margin-bottom: 30px;
      color: #2196F3;
    }
    
    .auth-form {
      background: white;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    
    .form-group {
      margin-bottom: 15px;
    }
    
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
      color: #333;
    }
    
    input, select {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    }
    
    button {
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.3s;
    }
    
    .btn-login {
      background: #2196F3;
      color: white;
      margin-top: 10px;
    }
    
    .btn-login:hover {
      background: #0b7dda;
    }
    
    .btn-register {
      background: #4CAF50;
      color: white;
      margin-top: 10px;
    }
    
    .btn-register:hover {
      background: #3e8e41;
    }
    
    .error-message {
      color: #f44336;
      margin-top: 10px;
      font-size: 14px;
    }
    
    .auth-status {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 5px;
      margin-top: 30px;
    }
    
    .user-info {
      margin: 15px 0;
    }
    
    .btn-logout {
      background: #f44336;
      color: white;
      margin-right: 10px;
    }
    
    .btn-profile {
      background: #9c27b0;
      color: white;
    }
  `]
})
export class TestLoginComponent {
  // Login form
  email: string = '';
  password: string = '';
  errorMessage: string = '';
  
  // Register form
  regName: string = '';
  regEmail: string = '';
  regPassword: string = '';
  regPhone: string = '';
  regRole: UserRole = UserRole.PATIENT;
  regErrorMessage: string = '';
  
  UserRole = UserRole; // Expose enum to template
  
  constructor(
    public authService: FirebaseAuthService,
    private router: Router
  ) {}
  
  login(): void {
    if (!this.email || !this.password) {
      this.errorMessage = "Please enter both email and password";
      return;
    }
    
    this.errorMessage = '';
    this.authService.signInWithEmailPassword(this.email, this.password)
      .subscribe({
        next: (response: any) => {
          console.log('Login successful', response);
        },
        error: (error: any) => {
          console.error('Login error', error);
          this.errorMessage = error.message || "Login failed. Please check your credentials.";
        }
      });
  }
  
  register(): void {
    if (!this.regName || !this.regEmail || !this.regPassword || !this.regPhone) {
      this.regErrorMessage = "Please fill in all fields";
      return;
    }
    
    this.regErrorMessage = '';
    this.authService.signUp({
      displayName: this.regName,
      email: this.regEmail,
      password: this.regPassword,
      phoneNumber: this.regPhone,
      role: this.regRole
    })
      .subscribe({
        next: (response: any) => {
          console.log('Registration successful', response);
          // Clear the form
          this.regName = '';
          this.regEmail = '';
          this.regPassword = '';
          this.regPhone = '';
        },
        error: (error: any) => {
          console.error('Registration error', error);
          this.regErrorMessage = error.message || "Registration failed. Please try again.";
        }
      });
  }
  
  logout(): void {
    this.authService.signOut().subscribe(() => {
      console.log('Logged out successfully');
    });
  }
  
  goToProfile(): void {
    this.router.navigate(['/profile']);
  }
}
