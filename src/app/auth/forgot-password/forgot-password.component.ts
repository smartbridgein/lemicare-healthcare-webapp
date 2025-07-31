import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../shared/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
  forgotPasswordForm: FormGroup = new FormGroup({});
  loading = false;
  resetError: string | null = null;
  otpSent = false;
  step: 'request' | 'verify' | 'reset' = 'request';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.initForm();
  }

  initForm(): void {
    this.forgotPasswordForm = this.fb.group({
      mobile: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      otp: ['', this.step !== 'request' ? [Validators.required, Validators.pattern(/^[0-9]{6}$/)] : []],
      newPassword: ['', this.step === 'reset' ? [Validators.required, Validators.minLength(6)] : []],
      confirmPassword: ['', this.step === 'reset' ? [Validators.required] : []]
    }, {
      validators: this.step === 'reset' ? this.checkPasswords : undefined
    });
  }

  // Custom validator to check if password and confirm password match
  checkPasswords(group: FormGroup): {[key: string]: any} | null {
    const password = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    return password === confirmPassword ? null : { notSame: true };
  }

  requestOTP(): void {
    if (this.forgotPasswordForm.get('mobile')?.valid) {
      this.loading = true;
      const mobileNumber = this.forgotPasswordForm.get('mobile')?.value;
      
      // Use the updated auth service method to request password reset
      this.authService.requestOTP(mobileNumber, 'reset').subscribe({
        next: (response) => {
          this.loading = false;
          this.otpSent = true;
          this.step = 'verify';
          
          // Update form validators based on step
          this.forgotPasswordForm.get('otp')?.setValidators([Validators.required, Validators.pattern(/^[0-9]{6}$/)]);
          this.forgotPasswordForm.get('otp')?.updateValueAndValidity();
          
          console.log('Reset OTP sent successfully');
          alert(`Password reset token sent to mobile: ${mobileNumber}`);
        },
        error: (error) => {
          this.loading = false;
          this.resetError = error.message || 'Failed to send password reset token. Please try again.';
          console.error('Password reset request failed:', error);
        }
      });
    } else {
      this.forgotPasswordForm.get('mobile')?.markAsTouched();
    }
  }

  verifyOTP(): void {
    if (this.forgotPasswordForm.get('otp')?.valid) {
      this.step = 'reset';
      
      // Update form validators based on step
      this.forgotPasswordForm.get('newPassword')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.forgotPasswordForm.get('confirmPassword')?.setValidators([Validators.required]);
      this.forgotPasswordForm.get('newPassword')?.updateValueAndValidity();
      this.forgotPasswordForm.get('confirmPassword')?.updateValueAndValidity();
      this.forgotPasswordForm.updateValueAndValidity();
    } else {
      this.forgotPasswordForm.get('otp')?.markAsTouched();
    }
  }

  resetPassword(): void {
    if (this.forgotPasswordForm.valid && this.step === 'reset') {
      this.loading = true;
      this.resetError = null;
      
      const mobileNumber = this.forgotPasswordForm.get('mobile')?.value;
      const otpValue = this.forgotPasswordForm.get('otp')?.value;
      const newPassword = this.forgotPasswordForm.get('newPassword')?.value;
      
      // Use the updated auth service to reset the password
      // The authService now maps 'otp' to 'token' as expected by the backend
      this.authService.resetPassword({
        mobile: mobileNumber,
        otp: otpValue,
        newPassword: newPassword
      }).subscribe({
        next: (response) => {
          this.loading = false;
          console.log('Password reset successful', response);
          alert('Password reset successful! Please login with your new password.');
          this.router.navigate(['/auth/login']);
        },
        error: (error) => {
          this.loading = false;
          this.resetError = error.message || 'Password reset failed. Please try again.';
          console.error('Password reset failed:', error);
        }
      });
    } else {
      this.forgotPasswordForm.markAllAsTouched();
    }
  }

  onSubmit(): void {
    if (this.step === 'request') {
      this.requestOTP();
    } else if (this.step === 'verify') {
      this.verifyOTP();
    } else {
      this.resetPassword();
    }
  }

  goBack(): void {
    if (this.step === 'verify') {
      this.step = 'request';
      // Reset OTP field and its validators
      this.forgotPasswordForm.get('otp')?.setValue('');
      this.forgotPasswordForm.get('otp')?.clearValidators();
      this.forgotPasswordForm.get('otp')?.updateValueAndValidity();
    } else if (this.step === 'reset') {
      this.step = 'verify';
      // Reset password fields and their validators
      this.forgotPasswordForm.get('newPassword')?.setValue('');
      this.forgotPasswordForm.get('confirmPassword')?.setValue('');
      this.forgotPasswordForm.get('newPassword')?.clearValidators();
      this.forgotPasswordForm.get('confirmPassword')?.clearValidators();
      this.forgotPasswordForm.get('newPassword')?.updateValueAndValidity();
      this.forgotPasswordForm.get('confirmPassword')?.updateValueAndValidity();
      this.forgotPasswordForm.updateValueAndValidity();
    }
  }
}
