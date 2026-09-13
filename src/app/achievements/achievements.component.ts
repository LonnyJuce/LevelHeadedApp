import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { HabitRulesService } from '../habit-rules.service';

@Component({
  selector: 'app-achievements',
  standalone: true,
  imports: [RouterLink, MatButtonModule, FormsModule],
  templateUrl: './achievements.component.html',
  styleUrl: './achievements.component.css',
})
export class AchievementsComponent {
  readonly playerProgressKey = 'level-headed-player-progress';
  selectedTitle = 'Rookie';

  constructor(
    public readonly habitRules: HabitRulesService,
    private readonly supabase: SupabaseService,
  ) {
    void this.loadCurrentUserProfile();
  }

  get unlockedAchievements() {
    const progress = this.playerProgressSnapshot;
    return this.habitRules.getUnlockedAchievements(progress.level, {
      className: progress.className,
      activeHabits: progress.activeHabits,
      weeklyClears: progress.weeklyClears,
    });
  }

  get allAchievements() {
    return this.habitRules.titleAchievements;
  }

  async saveSelectedTitle(): Promise<void> {
    const progress = this.playerProgressSnapshot;
    const unlocked = this.habitRules.getUnlockedAchievements(progress.level, {
      className: progress.className,
      activeHabits: progress.activeHabits,
      weeklyClears: progress.weeklyClears,
    });

    const validSelection = unlocked.some(
      (achievement) => achievement.title === this.selectedTitle,
    )
      ? this.selectedTitle
      : this.habitRules.getCurrentTitle(progress.level, null, {
          className: progress.className,
          activeHabits: progress.activeHabits,
          weeklyClears: progress.weeklyClears,
        });

    this.selectedTitle = validSelection;

    const stored = this.readStoredProgress();
    const nextProgress = {
      ...stored,
      title: validSelection,
      unlockedAchievements: unlocked.map((achievement) => achievement.title),
      className: progress.className,
      level: progress.level,
      activeHabits: progress.activeHabits,
      weeklyClears: progress.weeklyClears,
      totalXp: progress.totalXp ?? 0,
    };

    localStorage.setItem(this.playerProgressKey, JSON.stringify(nextProgress));

    const userId = await this.supabase.getCurrentUserId();
    if (!userId) {
      return;
    }

    await this.supabase.savePlayerProfileProgress({
      userId,
      selectedTitle: validSelection,
      unlockedAchievements: unlocked.map((achievement) => achievement.title),
      level: progress.level,
      totalXp: progress.totalXp ?? 0,
      characterClass: progress.className,
    });
  }

  private getCurrentSelectedTitle(): string {
    const progress = this.playerProgressSnapshot;
    const unlocked = this.habitRules.getUnlockedAchievements(progress.level, {
      className: progress.className,
      activeHabits: progress.activeHabits,
      weeklyClears: progress.weeklyClears,
    });

    const stored = this.readStoredProgress();
    const candidate = stored.title ?? 'Rookie';

    return unlocked.some((achievement) => achievement.title === candidate)
      ? candidate
      : this.habitRules.getCurrentTitle(progress.level, null, {
          className: progress.className,
          activeHabits: progress.activeHabits,
          weeklyClears: progress.weeklyClears,
        });
  }

  private readStoredProgress(): {
    level?: number;
    title?: string;
    className?: string;
    activeHabits?: number;
    weeklyClears?: number;
    totalXp?: number;
  } {
    const raw = localStorage.getItem(this.playerProgressKey);
    if (!raw) {
      return {};
    }

    try {
      return JSON.parse(raw) as {
        level?: number;
        title?: string;
        className?: string;
        activeHabits?: number;
        weeklyClears?: number;
        totalXp?: number;
      };
    } catch {
      return {};
    }
  }

  private async loadCurrentUserProfile(): Promise<void> {
    const userId = await this.supabase.getCurrentUserId();
    if (!userId) {
      this.selectedTitle = this.getCurrentSelectedTitle();
      return;
    }

    const profile = await this.supabase.getPlayerProfileProgress(userId);
    if (!profile.error && profile.selectedTitle) {
      this.selectedTitle = profile.selectedTitle;
      return;
    }

    this.selectedTitle = this.getCurrentSelectedTitle();
  }

  private get playerProgressSnapshot(): {
    level: number;
    className?: string;
    activeHabits: number;
    weeklyClears: number;
    totalXp?: number;
  } {
    const raw = localStorage.getItem(this.playerProgressKey);
    if (!raw) {
      return { level: 1, activeHabits: 0, weeklyClears: 0 };
    }

    try {
      const parsed = JSON.parse(raw) as {
        level?: number;
        className?: string;
        activeHabits?: number;
        weeklyClears?: number;
        totalXp?: number;
      };

      return {
        level: Number.isFinite(parsed.level) ? Number(parsed.level) : 1,
        className: parsed.className,
        activeHabits: Number.isFinite(parsed.activeHabits)
          ? Number(parsed.activeHabits)
          : 0,
        weeklyClears: Number.isFinite(parsed.weeklyClears)
          ? Number(parsed.weeklyClears)
          : 0,
        totalXp: Number.isFinite(parsed.totalXp) ? Number(parsed.totalXp) : 0,
      };
    } catch {
      return { level: 1, activeHabits: 0, weeklyClears: 0 };
    }
  }
}
