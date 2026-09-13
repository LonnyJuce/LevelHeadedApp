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
    expect(await service.getCurrentUserId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[14][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    environment.production = originalProduction;
  });

  it('persists habits and completion history in local development mode', async () => {
    const originalProduction = environment.production;
    environment.production = false;
    localStorage.clear();

    service.setStoredDevSession('dev@local.test', 'Dev User');

    const habitResult = await service.upsertHabit({
      title: 'Morning walk',
      description: 'Take a 20 minute walk outside.',
      habit_type: 'positive',
      attribute: 'Strength',
      target_per_week: 4,
      xp_per_completion: 15,
      bonus_xp_for_full_week: 30,
      is_active: true,
    });

    expect(habitResult.error).toBeNull();

    const habitsResult = await service.getHabits();
    expect(habitsResult.error).toBeNull();
    expect(habitsResult.data).toEqual(
      jasmine.arrayContaining([
        jasmine.objectContaining({ title: 'Morning walk' }),
      ]),
    );

    const completionResult = await service.logCompletion({
      habit_id: habitsResult.data![0].id,
      quantity: 1,
      xp_delta: 15,
      notes: 'Logged from dashboard',
    });

    expect(completionResult.error).toBeNull();

    const historyResult = await service.getCompletionHistory(
      habitsResult.data![0].id,
    );
    expect(historyResult.error).toBeNull();
    expect(historyResult.data?.length).toBeGreaterThan(0);

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
