import { Routes } from '@angular/router';
import { AccountComponent } from './account/account.component';
import { AuthPageComponent } from './auth-page/auth-page.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { authGuard, guestGuard } from './auth.guard';

export const routes: Routes = [
  { path: 'login', component: AuthPageComponent, canActivate: [guestGuard] },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  { path: 'account', component: AccountComponent, canActivate: [authGuard] },
  {
    path: 'auth/reset-password',
    component: ResetPasswordComponent,
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' },
];
