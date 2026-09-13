import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SupabaseService } from '../core/supabase.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [FormsModule, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './account.component.html',
  styleUrl: './account.component.css',
})
export class AccountComponent implements OnInit {
  userName = 'Hero';
  isAuthenticated = false;
  loading = false;
  accountActionMessage = '';

  form = {
    email: '',
  };

  constructor(
    private readonly supabase: SupabaseService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.supabase.getSession().then(({ data }) => {
      const session = data.session;
      this.isAuthenticated = Boolean(session);

      if (!this.isAuthenticated) {
        this.router.navigateByUrl('/login');
        return;
      }

      this.userName =
        session?.user?.user_metadata?.['full_name'] ||
        session?.user?.email?.split('@')[0] ||
        'Hero';
      this.form.email = session?.user?.email ?? '';
    });
  }

  get userInitials(): string {
    if (!this.userName || this.userName === 'Hero') {
      return 'H';
    }

    return (
      this.userName
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
        .slice(0, 2) || 'H'
    );
  }

  async resetPassword(): Promise<void> {
    if (!this.form.email) {
      this.accountActionMessage = 'Enter your email to receive a reset link.';
      return;
    }

    this.loading = true;

    try {
      if (this.supabase.isLocalDevelopmentMode()) {
        this.supabase.setStoredDevSession(
          this.form.email,
          this.userName !== 'Hero' ? this.userName : undefined,
        );
        this.accountActionMessage =
          'Development reset flow started. Set a new password on the next screen.';
        await this.router.navigateByUrl('/auth/reset-password');
        return;
      }

      const { error } = await this.supabase.resetPasswordForEmail(
        this.form.email,
      );
      if (error) {
        this.accountActionMessage = error.message;
        return;
      }

      this.accountActionMessage = 'Password reset email sent.';
    } finally {
      this.loading = false;
    }
  }

  async deleteAccount(): Promise<void> {
    const confirmed = window.confirm(
      'This will permanently delete your account and data. Continue?',
    );

    if (!confirmed) {
      return;
    }

    this.loading = true;

    try {
      const { error } = await this.supabase.deleteCurrentAccount();
      if (error) {
        this.accountActionMessage = error.message;
        return;
      }

      this.isAuthenticated = false;
      this.form = { email: '' };
      await this.router.navigateByUrl('/login');
    } finally {
      this.loading = false;
    }
  }
}
