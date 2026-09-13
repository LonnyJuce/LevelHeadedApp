import { TitleCasePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import type { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import {
  HabitAttribute,
  HabitDefinition,
  HabitResetPeriod,
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

interface HabitQuestGroup {
  label: string;
  pendingCount: number;
  entries: HabitProgress[];
}

interface HexStatPoint {
  label: string;
  value: number;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  valueX: number;
  valueY: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
    BaseChartDirective,
    TitleCasePipe,
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
  userName = 'Hero';
  levelUpToast = '';
  private authSubscription?: { unsubscribe: () => void };
  private levelUpTimeoutId?: number;
  private lastLevel = 1;

  readonly HabitType = HabitType;
  readonly HabitAttribute = HabitAttribute;
  readonly stats = Object.values(HabitAttribute);
  statView: 'bars' | 'hex' = 'bars';

  habits: HabitProgress[] = [];
  archivedHabits: HabitProgress[] = [];
  selectedTitle = 'Rookie';

  private readonly playerProgressKey = 'level-headed-player-progress';

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

  get unlockedAchievements() {
    return this.habitRules.getUnlockedAchievements(this.playerLevel, {
      className: this.playerClass,
      activeHabits: this.habits.length,
      weeklyClears: this.habits.filter(
        (entry) => entry.completions >= entry.habit.targetPerWeek,
      ).length,
    });
  }

  get playerTitle(): string {
    return this.habitRules.getCurrentTitle(
      this.playerLevel,
      this.selectedTitle,
      {
        className: this.playerClass,
        activeHabits: this.habits.length,
        weeklyClears: this.habits.filter(
          (entry) => entry.completions >= entry.habit.targetPerWeek,
        ).length,
      },
    );
  }

  get classFlavorText(): string {
    switch (this.playerClass) {
      case 'Guardian':
        return 'A steadfast defender who stands firm in every storm.';
      case 'Scholar':
        return 'A sharp mind turning discipline into progress.';
      case 'Ranger':
        return 'A quiet tracker who moves with purpose and pace.';
      case 'Mystic':
        return 'A seeker of hidden patterns and deeper purpose.';
      case 'Sentinel':
        return 'A disciplined protector who strikes with speed and resolve.';
      case 'Titan':
        return 'A towering force that breaks resistance with patient might.';
      case 'Archmage':
        return 'A disciplined wielder of arcane precision and control.';
      case 'Shadowblade':
        return 'A fluid duelist moving faster than the eye can track.';
      case 'Warden':
        return 'A towering guardian of balance, strength, and vigilance.';
      case 'Ascendant':
        return 'A rare hero standing at the edge of legend.';
      default:
        return 'A hero still shaping their legend.';
    }
  }

  get titleFlavorText(): string {
    const title = this.playerTitle;
    const titleMap: Record<string, string> = {
      Rookie: 'The first step on a longer journey.',
      Trailblazer: 'A pathfinder blazing a fresh route ahead.',
      Vanguard: 'A bold leader rising to the front.',
      Bulwark: 'A protector standing between chaos and calm.',
      Archivist: 'A mind that learns, adapts, and prevails.',
      Pathfinder: 'A traveler who keeps pace with the wild.',
      Oracle: 'A keeper of hidden truths and quiet power.',
      Watchman: 'A disciplined sentinel guarding the threshold of progress.',
      Colossus: 'A heavy-footed conqueror who bends the battlefield to will.',
      Arcanist: 'A master of arcane discipline and exacting focus.',
      Nightblade: 'A stealthy duelist whose motion is both elegant and lethal.',
      Keepkeeper: 'A towering guardian of balance, strength, and vigilance.',
      'Quest Starter': 'A dependable adventurer ready for the next quest.',
      Completionist: 'A relentless finisher who leaves no goal behind.',
      Mythic: 'A legendary force celebrated by the realm.',
      Ascendant: 'A rare champion standing above the ordinary.',
    };

    return (
      titleMap[title] ?? 'A title earned through perseverance and progress.'
    );
  }

  get habitGroups(): HabitQuestGroup[] {
    const groups: Array<{
      label: string;
      key: HabitResetPeriod;
      entries: HabitProgress[];
    }> = [
      {
        label: 'Daily Quests',
        key: HabitResetPeriod.DAILY,
        entries: this.habits.filter(
          (entry) => entry.habit.resetPeriod === HabitResetPeriod.DAILY,
        ),
      },
      {
        label: 'Weekly Quests',
        key: HabitResetPeriod.WEEKLY,
        entries: this.habits.filter(
          (entry) => entry.habit.resetPeriod === HabitResetPeriod.WEEKLY,
        ),
      },
    ];

    const difficultyOrder: Record<string, number> = {
      easy: 1,
      medium: 2,
      hard: 3,
    };

    return groups
      .filter((group) => group.entries.length > 0)
      .map((group) => {
        const entries = [...group.entries].sort((left, right) => {
          const leftComplete = left.completions >= left.habit.targetPerWeek;
          const rightComplete = right.completions >= right.habit.targetPerWeek;

          if (leftComplete !== rightComplete) {
            return Number(leftComplete) - Number(rightComplete);
          }

          const difficultyDelta =
            (difficultyOrder[right.habit.difficulty] ?? 0) -
            (difficultyOrder[left.habit.difficulty] ?? 0);

          if (difficultyDelta !== 0) {
            return difficultyDelta;
          }

          return left.habit.title.localeCompare(right.habit.title);
        });

        return {
          label: group.label,
          pendingCount: entries.filter(
            (entry) => entry.completions < entry.habit.targetPerWeek,
          ).length,
          entries,
        };
      });
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

  get radarChartData() {
    const values = this.stats.map((stat) =>
      Math.max(0, this.playerStats[stat] ?? 0),
    );

    return {
      labels: this.stats,
      datasets: [
        {
          label: 'Base stats',
          data: values,
          borderColor: '#8b5cf6',
          borderWidth: 2,
          backgroundColor: 'rgba(96, 165, 250, 0.2)',
          pointBackgroundColor: '#f8fafc',
          pointBorderColor: '#8b5cf6',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 6,
        },
      ],
    };
  }

  get radarChartOptions(): ChartConfiguration<'radar'>['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#f8fafc',
          bodyColor: '#f8fafc',
          borderColor: 'rgba(148, 163, 184, 0.5)',
          borderWidth: 1,
        },
      },
      scales: {
        r: {
          min: 0,
          max: 120,
          ticks: {
            display: false,
            stepSize: 20,
          },
          pointLabels: {
            color: '#e2e8f0',
            font: {
              size: 12,
              weight: 'bold',
            },
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.2)',
          },
          angleLines: {
            color: 'rgba(148, 163, 184, 0.2)',
          },
        },
      },
    };
  }

  get hexStatPoints(): HexStatPoint[] {
    const entries = this.stats.map((stat) => ({
      label: stat,
      value: this.playerStats[stat] ?? 0,
    }));

    const maxValue = Math.max(
      1,
      ...entries.map((entry) => Math.abs(entry.value)),
    );
    const cx = 150;
    const cy = 150;
    const radius = 98;

    return entries.map((entry, index) => {
      const angle = -Math.PI / 2 + (index / entries.length) * Math.PI * 2;
      const normalized = Math.min(
        Math.max(Math.abs(entry.value) / maxValue, 0.12),
        1,
      );
      const pointRadius = radius * normalized;
      const x = cx + Math.cos(angle) * pointRadius;
      const y = cy + Math.sin(angle) * pointRadius;
      const labelRadius = radius + 26;
      const labelX = cx + Math.cos(angle) * labelRadius;
      const labelY = cy + Math.sin(angle) * labelRadius;
      const valueX = cx + Math.cos(angle) * (pointRadius + 18);
      const valueY = cy + Math.sin(angle) * (pointRadius + 18);

      return {
        label: entry.label,
        value: entry.value,
        x,
        y,
        labelX,
        labelY,
        valueX,
        valueY,
      };
    });
  }

  get hexPolygonPoints(): string {
    return this.hexStatPoints.map((point) => `${point.x},${point.y}`).join(' ');
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
    const resetPeriodValue =
      record.reset_period === HabitResetPeriod.DAILY
        ? HabitResetPeriod.DAILY
        : HabitResetPeriod.WEEKLY;

    const difficultyValue =
      record.difficulty === 'easy'
        ? 'easy'
        : record.difficulty === 'hard'
          ? 'hard'
          : 'medium';

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
      resetPeriod: resetPeriodValue,
      difficulty: difficultyValue as any,
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
    this.loadStoredPlayerProgress();
  }

  private loadStoredPlayerProgress(): void {
    try {
      const raw = localStorage.getItem(this.playerProgressKey);
      const options = {
        className: this.playerClass,
        activeHabits: this.habits.length,
        weeklyClears: this.habits.filter(
          (entry) => entry.completions >= entry.habit.targetPerWeek,
        ).length,
      };

      if (!raw) {
        this.selectedTitle = this.habitRules.getCurrentTitle(
          this.playerLevel,
          null,
          options,
        );
        return;
      }

      const parsed = JSON.parse(raw) as {
        level?: number;
        title?: string;
        className?: string;
        activeHabits?: number;
        weeklyClears?: number;
      };
      const level = Number.isFinite(parsed.level)
        ? Number(parsed.level)
        : this.playerLevel;
      const unlocked = this.habitRules.getUnlockedAchievements(level, {
        className: parsed.className ?? options.className,
        activeHabits: Number.isFinite(parsed.activeHabits)
          ? Number(parsed.activeHabits)
          : options.activeHabits,
        weeklyClears: Number.isFinite(parsed.weeklyClears)
          ? Number(parsed.weeklyClears)
          : options.weeklyClears,
      });
      const storedTitle =
        parsed.title ??
        this.habitRules.getCurrentTitle(level, null, {
          className: parsed.className ?? options.className,
          activeHabits: Number.isFinite(parsed.activeHabits)
            ? Number(parsed.activeHabits)
            : options.activeHabits,
          weeklyClears: Number.isFinite(parsed.weeklyClears)
            ? Number(parsed.weeklyClears)
            : options.weeklyClears,
        });
      this.selectedTitle = unlocked.some(
        (achievement) => achievement.title === storedTitle,
      )
        ? storedTitle
        : this.habitRules.getCurrentTitle(level, null, {
            className: parsed.className ?? options.className,
            activeHabits: Number.isFinite(parsed.activeHabits)
              ? Number(parsed.activeHabits)
              : options.activeHabits,
            weeklyClears: Number.isFinite(parsed.weeklyClears)
              ? Number(parsed.weeklyClears)
              : options.weeklyClears,
          });
    } catch {
      this.selectedTitle = this.habitRules.getCurrentTitle(
        this.playerLevel,
        null,
        {
          className: this.playerClass,
          activeHabits: this.habits.length,
          weeklyClears: this.habits.filter(
            (entry) => entry.completions >= entry.habit.targetPerWeek,
          ).length,
        },
      );
    }
  }

  async savePlayerProgress(): Promise<void> {
    const level = this.playerLevel;
    const weeklyClears = this.habits.filter(
      (entry) => entry.completions >= entry.habit.targetPerWeek,
    ).length;
    const title = this.habitRules.getCurrentTitle(level, this.selectedTitle, {
      className: this.playerClass,
      activeHabits: this.habits.length,
      weeklyClears,
    });

    const unlockedTitles = this.habitRules
      .getUnlockedAchievements(level, {
        className: this.playerClass,
        activeHabits: this.habits.length,
        weeklyClears,
      })
      .map((achievement) => achievement.title);

    localStorage.setItem(
      this.playerProgressKey,
      JSON.stringify({
        level,
        title,
        className: this.playerClass,
        activeHabits: this.habits.length,
        weeklyClears,
        unlockedAchievements: unlockedTitles,
        totalXp: this.totalXp,
      }),
    );

    const userId = await this.supabase.getCurrentUserId();
    if (userId) {
      await this.supabase.savePlayerProfileProgress({
        userId,
        selectedTitle: title,
        unlockedAchievements: unlockedTitles,
        level,
        totalXp: this.totalXp,
        characterClass: this.playerClass,
      });
    }
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
        const habit = this.mapHabitRecord(record);
        const completionResponse = await this.supabase.getCompletionHistory(
          record.id,
        );
        const completions = completionResponse.error
          ? 0
          : this.habitRules.countCompletionsInCurrentResetWindow(
              completionResponse.data ?? [],
              habit.resetPeriod,
            );

        return {
          habit,
          completions,
          isActive: record.is_active !== false,
        };
      }),
    );

    this.habits = loaded.filter((entry) => entry.isActive);
    this.archivedHabits = loaded.filter((entry) => !entry.isActive);
    this.isDataReady = true;
    this.loadStoredPlayerProgress();
    this.savePlayerProgress();
  }

  openNewHabitDialog(): void {
    const dialogRef = this.dialog.open(HabitFormComponent, {
      width: '640px',
      maxWidth: '90vw',
      panelClass: 'habit-form-dialog',
      disableClose: true,
    });

    const formComponent = dialogRef.componentInstance as HabitFormComponent;
    formComponent.habitSubmitted.subscribe(async (payload: HabitFormValues) => {
      await this.createHabit(payload);
      dialogRef.close();
    });
  }

  async createHabit(payload: HabitFormValues): Promise<void> {
    if (!this.isAuthenticated) {
      this.errorMessage = 'Please sign in before creating a habit.';
      return;
    }

    const difficultyConfig = this.habitRules.getDifficultyConfig(
      payload.difficulty,
    );

    const { error } = await this.supabase.upsertHabit({
      title: payload.title.trim(),
      description: payload.description.trim() || null,
      habit_type: payload.type,
      attribute: payload.attribute,
      target_per_week: payload.targetPerWeek,
      xp_per_completion: difficultyConfig.xpPerCompletion,
      bonus_xp_for_full_week: difficultyConfig.bonusXpForFullWeek,
      reset_period: payload.resetPeriod,
      difficulty: payload.difficulty,
      is_active: true,
    });

    if (error) {
      this.errorMessage = error.message;
      return;
    }

    this.errorMessage = '';
    await this.loadUserHabits();
  }

  async completeHabit(habitId: string, quantity = 1): Promise<void> {
    const targetHabit = this.habits.find((entry) => entry.habit.id === habitId);
    if (!targetHabit) {
      return;
    }

    const delta = Number(quantity) || 0;
    if (!Number.isFinite(delta) || delta <= 0) {
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
      currentCompletions + delta,
    ).totalXp;

    await this.supabase.logCompletion({
      habit_id: habitId,
      quantity: delta,
      xp_delta: updatedTotal - currentTotal,
      notes: 'Logged from dashboard',
    });

    await this.loadUserHabits();
    this.showLevelUpToastIfNeeded(previousLevel);
  }

  async undoHabitCompletion(habitId: string): Promise<void> {
    const targetHabit = this.habits.find((entry) => entry.habit.id === habitId);
    if (!targetHabit || targetHabit.completions <= 0) {
      return;
    }

    const { data, error } = await this.supabase.getCompletionHistory(habitId);
    if (error || !data?.length) {
      return;
    }

    const latestCompletion = [...data]
      .sort(
        (left, right) =>
          new Date(right.completed_at ?? 0).getTime() -
          new Date(left.completed_at ?? 0).getTime(),
      )
      .find((entry) => entry.id);

    if (!latestCompletion?.id) {
      return;
    }

    const previousLevel = this.playerLevel;
    await this.supabase.deleteCompletion(latestCompletion.id);
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
