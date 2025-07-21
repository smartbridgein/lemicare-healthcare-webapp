import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../shared/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup = new FormGroup({});
  showPassword = false;
  useOTP = false;
  loading = false;
  loginError: string | null = null;
  // Always use email login since backend only accepts email
  loginWithEmail = true;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.initForm();
  }

  initForm(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', this.useOTP ? [] : [Validators.required, Validators.minLength(6)]],
      otp: ['', this.useOTP ? [Validators.required, Validators.pattern(/^[0-9]{6}$/)] : []],
      rememberMe: [false]
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleLoginMethod(): void {
    this.useOTP = !this.useOTP;
    this.loginForm.get('password')?.clearValidators();
    this.loginForm.get('otp')?.clearValidators();
    
    if (this.useOTP) {
      this.loginForm.get('otp')?.setValidators([Validators.required, Validators.pattern(/^[0-9]{6}$/)]);
    } else {
      this.loginForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    }
    
    this.loginForm.get('password')?.updateValueAndValidity();
    this.loginForm.get('otp')?.updateValueAndValidity();
  }

  // No need for toggleIdentifierType since we only support email login
  toggleIdentifierType(): void {
    // Always use email login as backend only supports email field
    this.loginWithEmail = true;
  }

  requestOTP(): void {
    const email = this.loginForm.get('email')?.value;
    if (email && this.loginForm.get('email')?.valid) {
      this.loading = true;
      
      // Call authentication service to request OTP
      this.authService.requestOTP(email, 'login').subscribe({
        next: (response: any) => {
          this.loading = false;
          console.log('OTP requested successfully');
          // Display success message to user
          alert(`OTP sent to ${email}`);
        },
        error: (error: any) => {
          this.loading = false;
          this.loginError = error.message || 'Failed to send OTP. Please try again.';
          console.error('OTP request failed:', error);
        }
      });
    } else {
      this.loginForm.get('email')?.markAsTouched();
      this.loginError = 'Please enter a valid email address';
    }
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.loading = true;
      this.loginError = null;
      
      const email = this.loginForm.get('email')?.value;
      
      if (this.useOTP) {
        // Login with OTP
        const otp = this.loginForm.get('otp')?.value;
        
        this.authService.loginWithOTP(email, otp).subscribe({
          next: (response: any) => {
            this.loading = false;
            console.log('Login successful', response);
            this.router.navigate(['/dashboard']);
          },
          error: (error: any) => {
            this.loading = false;
            this.loginError = error.message || 'Invalid OTP. Please try again.';
            console.error('Login failed:', error);
          }
        });
      } else {
        // Login with password
        const password = this.loginForm.get('password')?.value;
        
        this.authService.loginWithEmail(email, password).subscribe({
          next: (response: any) => {
            this.loading = false;
            console.log('Login successful', response);
            this.router.navigate(['/dashboard']);
          },
          error: (error: any) => {
            this.loading = false;
            this.loginError = error.message || 'Invalid email or password.';
            console.error('Login failed:', error);
          }
        });
      }
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}
