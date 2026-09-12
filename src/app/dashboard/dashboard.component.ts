import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  HabitAttribute,
  HabitDefinition,
  HabitRulesService,
  HabitType,
  PlayerStats,
} from '../habit-rules.service';
import { HabitRecord, SupabaseService } from '../core/supabase.service';
import {
  HabitFormComponent,
  type HabitFormValues,
} from '../habit-form/habit-form.component';

interface HabitProgress {
  habit: HabitDefinition;
  completions: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, HabitFormComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  title = 'Level-Headed';
  Math = Math;

  isConfigured = false;
  isAuthenticated = false;
  loading = false;
  errorMessage = '';
  showHabitForm = false;
  userName = 'Hero';
  private authSubscription?: { unsubscribe: () => void };

  readonly HabitType = HabitType;
  readonly HabitAttribute = HabitAttribute;
  readonly stats = Object.values(HabitAttribute);

  private readonly demoHabits: HabitProgress[] = [
    {
      habit: {
        id: 'exercise',
        title: 'Exercise 5x a week',
        description: 'Train with focus and consistency.',
        type: HabitType.POSITIVE,
        attribute: HabitAttribute.STRENGTH,
        targetPerWeek: 5,
        xpPerCompletion: 25,
        bonusXpForFullWeek: 50,
      },
      completions: 4,
    },
    {
      habit: {
        id: 'deep-work',
        title: 'Deep Work Block',
        description: 'Complete two focused study sessions.',
        type: HabitType.POSITIVE,
        attribute: HabitAttribute.INTELLIGENCE,
        targetPerWeek: 2,
        xpPerCompletion: 30,
        bonusXpForFullWeek: 40,
      },
      completions: 2,
    },
    {
      habit: {
        id: 'no-junk-food',
        title: 'No Junk Food',
        description: 'Avoid processed snacks and sugar binges.',
        type: HabitType.NEGATIVE,
        attribute: HabitAttribute.WILLPOWER,
        targetPerWeek: 3,
        xpPerCompletion: 15,
        bonusXpForFullWeek: 0,
      },
      completions: 2,
    },
    {
      habit: {
        id: 'morning-routine',
        title: 'Morning Routine',
        description: 'Build consistency before the day starts.',
        type: HabitType.POSITIVE,
        attribute: HabitAttribute.CONSTITUTION,
        targetPerWeek: 4,
        xpPerCompletion: 20,
        bonusXpForFullWeek: 35,
      },
      completions: 4,
    },
    {
      habit: {
        id: 'organization',
        title: 'Tidy Workspace',
        description: 'Reset the desk and keep tasks visible.',
        type: HabitType.POSITIVE,
        attribute: HabitAttribute.DEXTERITY,
        targetPerWeek: 3,
        xpPerCompletion: 18,
        bonusXpForFullWeek: 30,
      },
      completions: 2,
    },
    {
      habit: {
        id: 'sleep-log',
        title: 'Sleep Tracking',
        description: 'Review sleep and recovery patterns nightly.',
        type: HabitType.POSITIVE,
        attribute: HabitAttribute.CHARISMA,
        targetPerWeek: 5,
        xpPerCompletion: 12,
        bonusXpForFullWeek: 20,
      },
      completions: 3,
    },
  ];

  habits: HabitProgress[] = [];

  get totalXp(): number {
    return this.habits.reduce((sum, entry) => {
      const result = this.habitRules.calculateWeeklyResult(
        entry.habit,
        entry.completions,
      );
      return sum + result.totalXp;
    }, 0);
  }

  get playerLevel(): number {
    return this.habitRules.calculatePlayerLevel(this.totalXp);
  }

  get playerStats(): PlayerStats {
    return this.habitRules.calculateAggregatedStats(this.habits);
  }

  get playerClass(): string {
    return this.habitRules.calculateCharacterClass(
      this.playerStats,
      this.playerLevel,
    );
  }

  get statSummaries() {
    return this.stats.map((stat) => {
      const total = this.playerStats[stat];
      return {
        name: stat,
        total,
        progress: Math.min(Math.abs(total) / 25, 1),
      };
    });
  }

  constructor(
    public readonly habitRules: HabitRulesService,
    private readonly supabase: SupabaseService,
    private readonly router: Router,
  ) {
    this.habits = this.demoHabits.map((entry) => ({ ...entry }));
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

  mapHabitRecord(record: Partial<HabitRecord>): HabitDefinition {
    return {
      id: record.id ?? 'habit-placeholder',
      title: record.title ?? 'Untitled habit',
      description: record.description ?? 'No description provided.',
      type:
        record.habit_type === 'negative'
          ? HabitType.NEGATIVE
          : HabitType.POSITIVE,
      attribute:
        (record.attribute as HabitAttribute) ?? HabitAttribute.STRENGTH,
      targetPerWeek: Number(record.target_per_week ?? 1),
      xpPerCompletion: Number(record.xp_per_completion ?? 10),
      bonusXpForFullWeek: Number(record.bonus_xp_for_full_week ?? 0),
    };
  }

  async ngOnInit(): Promise<void> {
    this.isConfigured = this.supabase.isConfigured();

    if (!this.isConfigured) {
      await this.router.navigateByUrl('/login');
      return;
    }

    const { data } = await this.supabase.getClient().auth.getSession();
    this.isAuthenticated = Boolean(data.session);

    if (!this.isAuthenticated) {
      await this.router.navigateByUrl('/login');
      return;
    }

    this.applyUserName(data.session);

    this.authSubscription = this.supabase
      .getClient()
      .auth.onAuthStateChange(async (_event, session) => {
        this.isAuthenticated = Boolean(session);

        if (session) {
          this.applyUserName(session);
          await this.loadUserHabits();
        } else {
          this.userName = 'Hero';
          this.habits = this.demoHabits.map((entry) => ({ ...entry }));
          await this.router.navigateByUrl('/login');
        }
      }).data.subscription;

    await this.loadUserHabits();
  }

  private applyUserName(
    session: { user?: { user_metadata?: any; email?: string } } | null,
  ): void {
    const metadataName = session?.user?.user_metadata?.['full_name'];
    const emailName = session?.user?.email?.split('@')[0] ?? 'Hero';
    this.userName = metadataName || emailName || 'Hero';
  }

  private async loadUserHabits(): Promise<void> {
    if (!this.isConfigured || !this.isAuthenticated) {
      this.habits = this.demoHabits.map((entry) => ({ ...entry }));
      return;
    }

    const { data, error } = await this.supabase.getHabits();
    if (error || !data?.length) {
      this.habits = this.demoHabits.map((entry) => ({ ...entry }));
      return;
    }

    const loaded = await Promise.all(
      data.map(async (record) => {
        const completionResponse = await this.supabase.getCompletionHistory(
          record.id,
        );
        const completions = completionResponse.error
          ? 0
          : completionResponse.data.reduce(
              (sum, item) => sum + Number(item.quantity ?? 0),
              0,
            );

        return {
          habit: this.mapHabitRecord(record),
          completions,
        };
      }),
    );

    this.habits = loaded.length
      ? loaded
      : this.demoHabits.map((entry) => ({ ...entry }));
  }

  async createHabit(payload: HabitFormValues): Promise<void> {
    if (!this.isAuthenticated) {
      this.errorMessage = 'Please sign in before creating a habit.';
      return;
    }

    const { error } = await this.supabase.upsertHabit({
      title: payload.title.trim(),
      description: payload.description.trim() || null,
      habit_type: payload.type,
      attribute: payload.attribute,
      target_per_week: payload.targetPerWeek,
      xp_per_completion: payload.xpPerCompletion,
      bonus_xp_for_full_week: payload.bonusXpForFullWeek,
      is_active: true,
    });

    if (error) {
      this.errorMessage = error.message;
      return;
    }

    this.errorMessage = '';
    this.showHabitForm = false;
    await this.loadUserHabits();
  }

  async completeHabit(habitId: string, quantity = 1): Promise<void> {
    const targetHabit = this.habits.find((entry) => entry.habit.id === habitId);
    if (!targetHabit) {
      return;
    }

    const currentCompletions = targetHabit.completions;
    const currentTotal = this.habitRules.calculateWeeklyResult(
      targetHabit.habit,
      currentCompletions,
    ).totalXp;
    const updatedTotal = this.habitRules.calculateWeeklyResult(
      targetHabit.habit,
      currentCompletions + quantity,
    ).totalXp;

    await this.supabase.logCompletion({
      habit_id: habitId,
      quantity,
      xp_delta: updatedTotal - currentTotal,
      notes: 'Logged from dashboard',
    });

    await this.loadUserHabits();
  }

  async signOut(): Promise<void> {
    this.loading = true;

    try {
      const { error } = await this.supabase.signOut();
      if (error) {
        this.errorMessage = error.message;
        return;
      }

      this.isAuthenticated = false;
      this.errorMessage = '';
      await this.router.navigateByUrl('/login');
    } finally {
      this.loading = false;
    }
  }

  percentOf(value: number, max: number): number {
    return Math.min((value / max) * 100, 100);
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }
}
