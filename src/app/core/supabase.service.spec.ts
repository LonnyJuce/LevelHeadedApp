import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  let service: SupabaseService;

  const originalUrl = environment.supabaseUrl;
  const originalKey = environment.supabaseAnonKey;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SupabaseService],
    });
    service = TestBed.inject(SupabaseService);
  });

  afterEach(() => {
    environment.supabaseUrl = originalUrl;
    environment.supabaseAnonKey = originalKey;
  });

  it('reports as unconfigured when environment values are placeholders', () => {
    environment.supabaseUrl = '';
    environment.supabaseAnonKey = '';

    expect(service.isConfigured()).toBeFalse();
  });

  it('throws a clear error when the client is accessed before configuration', () => {
    environment.supabaseUrl = '';
    environment.supabaseAnonKey = '';

    expect(() => service.getClient()).toThrowError(
      /Supabase is not configured/i,
    );
  });

  it('requests a password reset email when configured', async () => {
    const originalProduction = environment.production;
    environment.production = true;

    const fakeClient = {
      auth: {
        resetPasswordForEmail: jasmine
          .createSpy('resetPasswordForEmail')
          .and.resolveTo({ error: null }),
      },
    };

    spyOn(service as any, 'getClient').and.returnValue(fakeClient);

    await service.resetPasswordForEmail('player@example.com');

    expect(fakeClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'player@example.com',
      jasmine.objectContaining({ redirectTo: jasmine.any(String) }),
    );

    environment.production = originalProduction;
  });

  it('supports a development-only auth bypass when email flows are unavailable', async () => {
    const originalProduction = environment.production;
    environment.production = false;
    localStorage.clear();

    const result = service.loginWithDevBypass('dev@local.test', 'Local Hero');

    expect(result.error).toBeNull();
    expect(service.isDevSessionActive()).toBeTrue();
    expect(await service.getCurrentUserId()).toBe('local-dev-user');

    environment.production = originalProduction;
  });

  it('deletes the current user through the secure database function', async () => {
    const fakeClient = {
      rpc: jasmine.createSpy('rpc').and.resolveTo({ error: null }),
    };

    spyOn(service as any, 'getClient').and.returnValue(fakeClient);

    await service.deleteCurrentAccount();

    expect(fakeClient.rpc).toHaveBeenCalledWith('delete_current_user');
  });
});
