import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { SupabaseService } from '../core/supabase.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let dialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    const supabase = jasmine.createSpyObj('SupabaseService', [
      'isConfigured',
      'getSession',
      'getClient',
      'getHabits',
      'getCompletionHistory',
      'deleteHabit',
    ]);

    supabase.isConfigured.and.returnValue(true);
    supabase.getSession.and.resolveTo({
      data: {
        session: {
          user: {
            user_metadata: { full_name: 'Hero' },
            email: 'hero@example.com',
          },
        },
      },
    });
    supabase.getClient.and.returnValue({
      auth: {
        onAuthStateChange: () => ({
          data: {
            subscription: { unsubscribe: () => undefined },
          },
        }),
      },
    });
    supabase.getHabits.and.resolveTo({ data: [], error: null });

    dialog = jasmine.createSpyObj('MatDialog', ['open']);
    dialog.open.and.returnValue({
      afterClosed: () => of(false),
    } as any);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent, RouterTestingModule],
      providers: [
        { provide: SupabaseService, useValue: supabase },
        { provide: MatDialog, useValue: dialog },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    component.isAuthenticated = true;
    (component as any).dialog = dialog;
  });

  it('starts empty when the user has no saved habits yet', async () => {
    await (component as any).loadUserHabits();

    expect(component.habits).toEqual([]);
  });

  it('waits to reveal dashboard stats until the first habit payload is loaded', async () => {
    const supabase = TestBed.inject(
      SupabaseService,
    ) as jasmine.SpyObj<SupabaseService>;

    component.isConfigured = true;
    component.isAuthenticated = true;
    expect(component.isDataReady).toBeFalse();

    supabase.getHabits.and.resolveTo({
      data: [
        {
          id: 'habit-1',
          title: 'Morning run',
          description: 'Run before work.',
          habit_type: 'positive',
          attribute: 'Strength',
          target_per_week: 4,
          xp_per_completion: 15,
          bonus_xp_for_full_week: 25,
          is_active: true,
          user_id: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ],
      error: null,
    });
    supabase.getCompletionHistory.and.resolveTo({
      data: [{ quantity: 2 }],
      error: null,
    } as any);

    await (component as any).loadUserHabits();

    expect(component.isDataReady).toBeTrue();
    expect(component.habits[0].habit.title).toBe('Morning run');
  });

  it('opens a themed confirmation dialog before deleting a habit', async () => {
    const supabase = TestBed.inject(
      SupabaseService,
    ) as jasmine.SpyObj<SupabaseService>;

    component.habits = [
      {
        habit: {
          id: 'habit-123',
          title: 'Morning walk',
          description: 'Walk outside in the morning.',
          type: 'positive' as any,
          attribute: 'Strength' as any,
          targetPerWeek: 3,
          xpPerCompletion: 10,
          bonusXpForFullWeek: 20,
        },
        completions: 1,
        isActive: true,
      },
    ];

    component.confirmDeleteHabit('habit-123', 'Morning walk');

    expect(dialog.open).toHaveBeenCalled();
    expect(dialog.open.calls.mostRecent().args[0].toString()).toContain(
      'HabitDeleteDialogComponent',
    );

    supabase.deleteHabit.and.resolveTo({ data: null, error: null });
  });

  it('deletes a habit and refreshes the list', async () => {
    const supabase = TestBed.inject(
      SupabaseService,
    ) as jasmine.SpyObj<SupabaseService>;
    component.habits = [
      {
        habit: {
          id: 'habit-123',
          title: 'Morning walk',
          description: 'Walk outside in the morning.',
          type: 'positive' as any,
          attribute: 'Strength' as any,
          targetPerWeek: 3,
          xpPerCompletion: 10,
          bonusXpForFullWeek: 20,
        },
        completions: 1,
        isActive: true,
      },
    ];

    supabase.deleteHabit.and.resolveTo({ data: null, error: null });

    await component.deleteHabit('habit-123');

    expect(supabase.deleteHabit).toHaveBeenCalledWith('habit-123');
    expect(component.habits).toEqual([]);
  });

  it('tracks progress toward the next level while keeping total XP visible', () => {
    component.isDataReady = true;
    component.habits = [
      {
        habit: {
          id: 'habit-leveling',
          title: 'Daily workout',
          description: 'Hit the gym.',
          type: 'positive' as any,
          attribute: 'Strength' as any,
          targetPerWeek: 4,
          xpPerCompletion: 25,
          bonusXpForFullWeek: 15,
        },
        completions: 4,
        isActive: true,
      },
    ];

    expect(component.totalXp).toBe(115);
    expect(component.playerLevel).toBe(2);
    expect(component.xpToNextLevel).toBe(135);
    expect(component.xpProgressTowardNextLevel).toBeCloseTo(15 / 135, 6);
  });

  it('never lets total XP fall below zero', () => {
    component.habits = [
      {
        habit: {
          id: 'habit-negative',
          title: 'Avoid junk food',
          description: 'Skip processed snacks.',
          type: 'negative' as any,
          attribute: 'Willpower' as any,
          targetPerWeek: 2,
          xpPerCompletion: 25,
          bonusXpForFullWeek: 0,
        },
        completions: 3,
        isActive: true,
      },
    ];

    expect(component.totalXp).toBe(0);
    expect(component.playerLevel).toBe(1);
  });
});
