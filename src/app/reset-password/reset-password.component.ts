import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
})
export class ResetPasswordComponent implements OnInit {
  newPassword = '';
  confirmPassword = '';
  loading = false;
  errorMessage = '';
  successMessage = '';
  canResetPassword = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    if (!this.supabase.isConfigured()) {
      this.errorMessage =
        'Supabase is not configured yet. Add your URL and anon key to the environment file.';
      return;
    }

    this.canResetPassword = true;

    if (
      this.supabase.isLocalDevelopmentMode() &&
      this.supabase.isDevSessionActive()
    ) {
      this.canResetPassword = true;
      return;
    }

    const { data, error } = await this.supabase.getClient().auth.getSession();

    if (error) {
      this.errorMessage = error.message;
      return;
    }

    if (!data.session) {
      this.errorMessage =
        'This password reset link may still be loading. If it does not finish, request a new reset email.';
    }
  }

  async submitNewPassword(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.canResetPassword) {
      this.errorMessage =
        'Your recovery session is not active. Please request another reset email.';
      return;
    }

    if (!this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'Enter and confirm your new password.';
      return;
    }

    if (this.newPassword.length < 8) {
      this.errorMessage = 'Password must be at least 8 characters long.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.loading = true;

    try {
      if (this.supabase.isLocalDevelopmentMode()) {
        const activeSession = this.supabase.isDevSessionActive()
          ? this.supabase['getStoredDevSession']?.()
          : null;
        const email = activeSession?.email ?? 'local-dev-user@example.com';

        this.supabase.setDevPassword(email, this.newPassword);
        this.successMessage =
          'Password updated successfully. You can now sign in with your new local password.';
        this.newPassword = '';
        this.confirmPassword = '';
        this.canResetPassword = false;

        await this.supabase.signOut();
        await this.router.navigateByUrl('/login');
        return;
      }

      const { error } = await this.supabase
        .getClient()
        .auth.updateUser({ password: this.newPassword });

      if (error) {
        this.errorMessage = error.message;
        return;
      }

      this.successMessage =
        'Password updated successfully. You can now sign in.';
      this.newPassword = '';
      this.confirmPassword = '';
      this.canResetPassword = false;

      await this.supabase.getClient().auth.signOut();
      await this.router.navigateByUrl('/login');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update password.';
      this.errorMessage = message;
    } finally {
      this.loading = false;
    }
  }
}
