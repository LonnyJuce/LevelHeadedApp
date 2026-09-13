import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { environment } from '../../environments/environment';
import { routes } from '../app.routes';
import { SupabaseService } from '../core/supabase.service';
import { AccountComponent } from './account.component';

describe('AccountComponent', () => {
  let fixture: ComponentFixture<AccountComponent>;
  let component: AccountComponent;
  let supabase: SupabaseService;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [SupabaseService, provideRouter(routes)],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountComponent);
    component = fixture.componentInstance;
    supabase = TestBed.inject(SupabaseService);
    router = TestBed.inject(Router);

    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    localStorage.setItem(
      'level-headed-dev-session',
      JSON.stringify({
        id: 'local-dev-user',
        email: 'dev@example.com',
        user_metadata: { full_name: 'Dev User' },
      }),
    );

    spyOn(supabase, 'getClient').and.returnValue({
      auth: {
        getSession: jasmine
          .createSpy('getSession')
          .and.resolveTo({ data: { session: null } }),
      },
    } as any);

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('redirects to login when no real session exists in production mode', () => {
    expect(component.isAuthenticated).toBeFalse();
    expect(component.userName).toBe('Hero');
    expect(component.form.email).toBe('');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('starts the development reset flow by navigating to the password form', async () => {
    const originalProduction = environment.production;
    environment.production = false;

    localStorage.setItem(
      'level-headed-dev-session',
      JSON.stringify({
        id: 'local-dev-user',
        email: 'dev@example.com',
        user_metadata: { full_name: 'Dev User' },
      }),
    );

    component.form.email = 'dev@example.com';
    component.userName = 'Dev User';
    await component.resetPassword();

    expect(component.accountActionMessage).toContain('Development reset flow');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/auth/reset-password');

    environment.production = originalProduction;
  });
});
