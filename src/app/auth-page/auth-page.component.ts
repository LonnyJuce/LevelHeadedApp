import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.css',
})
export class AuthPageComponent implements OnInit {
  isConfigured = false;
  loading = false;
  authMode: 'sign-in' | 'sign-up' = 'sign-in';
  errorMessage = '';
  successMessage = '';

  form = {
    fullName: '',
    email: '',
    password: '',
  };

  constructor(
    private readonly supabase: SupabaseService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.isConfigured = this.supabase.isConfigured();
  }

  async submitAuth(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.isConfigured) {
      this.errorMessage =
        'Supabase is not configured yet. Add your URL and anon key to the environment file.';
      return;
    }

    if (!this.form.email || !this.form.password) {
      this.errorMessage = 'Email and password are required.';
      return;
    }

    this.loading = true;

    try {
      const result =
        this.authMode === 'sign-up'
          ? await this.supabase.signUpWithEmail(
              this.form.email,
              this.form.password,
              this.form.fullName,
            )
          : await this.supabase.signInWithEmail(
              this.form.email,
              this.form.password,
            );

      if (result.error) {
        this.errorMessage = result.error.message;
        return;
      }

      this.form = { fullName: '', email: '', password: '' };
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong.';
      this.errorMessage = message;
    } finally {
      this.loading = false;
    }
  }

  async resetPassword(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.form.email && !this.supabase.isLocalDevelopmentMode()) {
      this.errorMessage = 'Enter your email to receive a reset link.';
      return;
    }

    this.loading = true;

    try {
      if (this.supabase.isLocalDevelopmentMode()) {
        const devUser = this.supabase.loginWithDevBypass(
          this.form.email || 'local-dev-user@example.com',
          this.form.fullName || 'Local Hero',
        );

        if (devUser.error) {
          this.errorMessage = devUser.error.message;
          return;
        }

        this.successMessage =
          'Development bypass activated. You can now set a new password.';
        await this.router.navigateByUrl('/auth/reset-password');
        return;
      }

      const { error } = await this.supabase.resetPasswordForEmail(
        this.form.email,
      );

      if (error) {
        this.errorMessage = error.message;
        return;
      }

      this.successMessage = 'Password reset email sent. Check your inbox.';
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to send reset email.';
      this.errorMessage = message;
    } finally {
      this.loading = false;
    }
  }
}
