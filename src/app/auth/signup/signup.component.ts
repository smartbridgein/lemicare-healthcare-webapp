import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../shared/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export class SignupComponent {
  signupForm: FormGroup = new FormGroup({});
  loading = false;
  signupError: string | null = null;
  otpSent = false;
  otp = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.initForm();
  }

  showPassword = false;
  showConfirmPassword = false;

  initForm(): void {
    this.signupForm = this.fb.group({
      // Clinic Information
      clinicName: ['', [Validators.required]],
      registrationNumber: ['', [Validators.required]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      email: ['', [Validators.required, Validators.email]],
      address: ['', [Validators.required]],
      
      // Admin Information
      adminName: ['', [Validators.required]],
      adminPhone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      adminEmail: ['', [Validators.required, Validators.email]],
      designation: ['', [Validators.required]],
      
      // Login Credentials
      username: ['', [Validators.required, Validators.minLength(4)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      termsAccepted: [false, [Validators.requiredTrue]],
    }, {
      validators: this.passwordMatchValidator
    });
  }

  // Password match validator
  passwordMatchValidator(formGroup: FormGroup) {
    const password = formGroup.get('password')?.value;
    const confirmPassword = formGroup.get('confirmPassword')?.value;
    
    if (password && confirmPassword && password !== confirmPassword) {
      formGroup.get('confirmPassword')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  // Toggle password visibility
  togglePasswordVisibility(field: string = 'password'): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else if (field === 'confirm') {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  onSubmit(): void {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.signupError = null;
    
    // Create clinic registration data object from form
    const clinicData = {
      clinic: {
        name: this.signupForm.get('clinicName')?.value,
        registrationNumber: this.signupForm.get('registrationNumber')?.value,
        phoneNumber: this.signupForm.get('phoneNumber')?.value,
        email: this.signupForm.get('email')?.value,
        address: this.signupForm.get('address')?.value
      },
      admin: {
        name: this.signupForm.get('adminName')?.value,
        phone: this.signupForm.get('adminPhone')?.value,
        email: this.signupForm.get('adminEmail')?.value,
        designation: this.signupForm.get('designation')?.value
      },
      credentials: {
        username: this.signupForm.get('username')?.value,
        password: this.signupForm.get('password')?.value
      }
    };
    
    // For demonstration, just log and show success
    console.log('Clinic registration data:', clinicData);
    
    // Simulate API call with timeout
    setTimeout(() => {
      this.loading = false;
      alert('Clinic registered successfully!');
      this.router.navigate(['/auth/login']);
    }, 1500);
    
    // Uncomment and adapt when ready to connect to real API
    /*
    this.authService.registerClinic(clinicData).subscribe({
      next: (response) => {
        this.loading = false;
        console.log('Registration successful', response);
        alert('Clinic registered successfully!');
        this.router.navigate(['/auth/login']);
      },
      error: (error) => {
        this.loading = false;
        this.signupError = error.message || 'Registration failed. Please try again.';
        console.error('Registration failed:', error);
      }
    });
    */
  }
}
