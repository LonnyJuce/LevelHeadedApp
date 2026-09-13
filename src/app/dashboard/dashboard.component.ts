import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
import { HabitDeleteDialogComponent } from './habit-delete-dialog.component';

interface HabitProgress {
  habit: HabitDefinition;
  completions: number;
  isActive: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    HabitFormComponent,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  title = 'Level-Headed';
  Math = Math;

  isConfigured = false;
  isAuthenticated = false;
  loading = false;
  isDataReady = false;
  errorMessage = '';
  showHabitForm = false;
  userName = 'Hero';
  levelUpToast = '';
  private authSubscription?: { unsubscribe: () => void };
  private levelUpTimeoutId?: number;
  private lastLevel = 1;

  readonly HabitType = HabitType;
  readonly HabitAttribute = HabitAttribute;
  readonly stats = Object.values(HabitAttribute);

  habits: HabitProgress[] = [];
  archivedHabits: HabitProgress[] = [];

  get totalXp(): number {
    if (!this.isDataReady) {
      return 0;
    }

    const total = [...this.habits, ...this.archivedHabits].reduce(
      (sum, entry) => {
        const result = this.habitRules.calculateWeeklyResult(
          entry.habit,
          entry.completions,
        );
        return sum + result.totalXp;
      },
      0,
    );

    return Math.max(0, total);
  }

  get playerLevel(): number {
    return this.habitRules.calculatePlayerLevel(this.totalXp);
  }

  get currentLevelXp(): number {
    let xpIntoCurrentLevel = this.totalXp;
    let level = 1;

    while (xpIntoCurrentLevel >= this.habitRules.xpRequiredForLevel(level)) {
      xpIntoCurrentLevel -= this.habitRules.xpRequiredForLevel(level);
      level += 1;
    }

    return xpIntoCurrentLevel;
  }

  get xpToNextLevel(): number {
    const currentLevel = this.playerLevel;
    return this.habitRules.xpRequiredForLevel(currentLevel);
  }

  get xpProgressTowardNextLevel(): number {
    const currentLevelXp = this.currentLevelXp;
    const nextLevelXp = this.xpToNextLevel;
    if (nextLevelXp <= 0) {
      return 0;
    }

    return Math.min(currentLevelXp / nextLevelXp, 1);
  }

  get playerStats(): PlayerStats {
    if (!this.isDataReady) {
      return this.habitRules.createDefaultStats();
    }

    return this.habitRules.calculateAggregatedStats([
      ...this.habits,
      ...this.archivedHabits,
    ]);
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

  private showLevelUpToastIfNeeded(previousLevel: number): void {
    const currentLevel = this.playerLevel;

    if (currentLevel > previousLevel) {
      this.levelUpToast = `Level Up! ${this.userName} reached level ${currentLevel}!`;
      this.snackBar.open(this.levelUpToast, 'Dismiss', {
        duration: 3200,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['level-up-snackbar'],
      });

      if (this.levelUpTimeoutId) {
        window.clearTimeout(this.levelUpTimeoutId);
      }

      this.levelUpTimeoutId = window.setTimeout(() => {
        this.levelUpToast = '';
      }, 3200);
    }

    this.lastLevel = currentLevel;
  }

  constructor(
    public readonly habitRules: HabitRulesService,
    private readonly supabase: SupabaseService,
    private readonly router: Router,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog,
  ) {}

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

    const { data } = await this.supabase.getSession();
    const session = data.session;
    this.isAuthenticated = Boolean(session);

    if (!this.isAuthenticated) {
      await this.router.navigateByUrl('/login');
      return;
    }

    this.applyUserName(session);

    this.authSubscription = this.supabase
      .getClient()
      .auth.onAuthStateChange(async (_event, session) => {
        this.isAuthenticated = Boolean(session);

        if (session) {
          this.applyUserName(session);
          await this.loadUserHabits();
        } else {
          this.userName = 'Hero';
          this.habits = [];
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
      this.isDataReady = false;
      this.habits = [];
      this.archivedHabits = [];
      return;
    }

    const { data, error } = await this.supabase.getHabits(true);
    if (error || !data?.length) {
      this.habits = [];
      this.archivedHabits = [];
      this.isDataReady = true;
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
          isActive: record.is_active !== false,
        };
      }),
    );

    this.habits = loaded.filter((entry) => entry.isActive);
    this.archivedHabits = loaded.filter((entry) => !entry.isActive);
    this.isDataReady = true;
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
    const previousLevel = this.playerLevel;
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
    this.showLevelUpToastIfNeeded(previousLevel);
  }

  confirmDeleteHabit(habitId: string, habitTitle: string): void {
    const dialogRef = this.dialog.open(HabitDeleteDialogComponent, {
      width: '420px',
      disableClose: true,
      data: { habitTitle },
      panelClass: 'habit-delete-dialog',
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        void this.deleteHabit(habitId);
      }
    });
  }

  async deleteHabit(habitId: string): Promise<void> {
    if (!this.isAuthenticated) {
      this.errorMessage = 'Please sign in before deleting a habit.';
      return;
    }

    const { error } = await this.supabase.deleteHabit(habitId);
    if (error) {
      this.errorMessage = error.message;
      return;
    }

    this.errorMessage = '';
    this.habits = this.habits.filter((entry) => entry.habit.id !== habitId);
    this.isDataReady = false;
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
    if (this.levelUpTimeoutId) {
      window.clearTimeout(this.levelUpTimeoutId);
    }
  }
}
