import { Injectable } from '@angular/core';

export enum HabitType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
}

export enum HabitResetPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
}

export enum HabitDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

export enum HabitAttribute {
  STRENGTH = 'Strength',
  CONSTITUTION = 'Constitution',
  DEXTERITY = 'Dexterity',
  INTELLIGENCE = 'Intelligence',
  WILLPOWER = 'Willpower',
  CHARISMA = 'Charisma',
}

export type PlayerStats = Record<HabitAttribute, number>;

export interface HabitDefinition {
  id: string;
  title: string;
  description: string;
  type: HabitType;
  attribute: HabitAttribute;
  targetPerWeek: number;
  xpPerCompletion: number;
  bonusXpForFullWeek: number;
  resetPeriod: HabitResetPeriod;
  difficulty: HabitDifficulty;
}

export interface WeeklyHabitResult {
  baseXp: number;
  bonusXp: number;
  totalXp: number;
  completedTarget: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class HabitRulesService {
  readonly MIN_STAT_VALUE = 1;
  readonly BASE_XP_PER_LEVEL = 100;
  readonly LEVEL_GROWTH_FACTOR = 1.35;

  getDifficultyConfig(difficulty: HabitDifficulty): {
    xpPerCompletion: number;
    bonusXpForFullWeek: number;
  } {
    const config: Record<
      HabitDifficulty,
      { xpPerCompletion: number; bonusXpForFullWeek: number }
    > = {
      [HabitDifficulty.EASY]: { xpPerCompletion: 10, bonusXpForFullWeek: 25 },
      [HabitDifficulty.MEDIUM]: { xpPerCompletion: 20, bonusXpForFullWeek: 50 },
      [HabitDifficulty.HARD]: { xpPerCompletion: 35, bonusXpForFullWeek: 100 },
    };

    return config[difficulty] ?? config[HabitDifficulty.EASY];
  }

  xpRequiredForLevel(level: number): number {
    if (level <= 1) {
      return this.BASE_XP_PER_LEVEL;
    }

    return Math.round(
      this.BASE_XP_PER_LEVEL * Math.pow(this.LEVEL_GROWTH_FACTOR, level - 1),
    );
  }

  createDefaultStats(): PlayerStats {
    return {
      [HabitAttribute.STRENGTH]: this.MIN_STAT_VALUE,
      [HabitAttribute.CONSTITUTION]: this.MIN_STAT_VALUE,
      [HabitAttribute.DEXTERITY]: this.MIN_STAT_VALUE,
      [HabitAttribute.INTELLIGENCE]: this.MIN_STAT_VALUE,
      [HabitAttribute.WILLPOWER]: this.MIN_STAT_VALUE,
      [HabitAttribute.CHARISMA]: this.MIN_STAT_VALUE,
    };
  }

  private startOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private startOfWeek(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + diff);
    return start;
  }

  private startOfNextDay(date: Date): Date {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    return nextDay;
  }

  private startOfNextWeek(date: Date): Date {
    const nextWeek = new Date(date);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek;
  }

  countCompletionsInCurrentResetWindow(
    completions: Array<{
      completed_at?: string | null;
      quantity?: number | null;
    }>,
    resetPeriod: HabitResetPeriod,
    now = new Date(),
  ): number {
    if (!Array.isArray(completions)) {
      return 0;
    }

    const windowStart =
      resetPeriod === HabitResetPeriod.DAILY
        ? this.startOfDay(now)
        : this.startOfWeek(now);
    const windowEnd =
      resetPeriod === HabitResetPeriod.DAILY
        ? this.startOfNextDay(windowStart)
        : this.startOfNextWeek(windowStart);

    return completions.reduce((sum, entry) => {
      const quantity = Number(entry?.quantity ?? 0);
      const completedAt = entry?.completed_at
        ? new Date(entry.completed_at)
        : null;

      if (!completedAt || Number.isNaN(completedAt.getTime())) {
        return sum;
      }

      if (completedAt >= windowStart && completedAt < windowEnd) {
        return sum + (Number.isFinite(quantity) ? quantity : 0);
      }

      return sum;
    }, 0);
  }

  calculateWeeklyResult(
    habit: HabitDefinition,
    completions: number,
  ): WeeklyHabitResult {
    const baseXp = completions * habit.xpPerCompletion;
    const completedTarget = completions >= habit.targetPerWeek;
    const bonusXp = completedTarget ? habit.bonusXpForFullWeek : 0;

    const totalXp =
      habit.type === HabitType.NEGATIVE ? -baseXp + bonusXp : baseXp + bonusXp;

    return {
      baseXp: habit.type === HabitType.NEGATIVE ? -baseXp : baseXp,
      bonusXp,
      totalXp,
      completedTarget,
    };
  }

  calculatePlayerLevel(totalXp: number): number {
    let level = 1;
    let remainingXp = Math.max(0, totalXp);

    while (remainingXp >= this.xpRequiredForLevel(level)) {
      remainingXp -= this.xpRequiredForLevel(level);
      level += 1;
    }

    return level;
  }

  calculateAttributeGrowth(
    habit: HabitDefinition,
    completions: number,
  ): number {
    if (completions <= 0) {
      return 0;
    }

    const magnitude = Math.max(1, Math.round(habit.xpPerCompletion / 15));
    const quantity = Math.max(
      1,
      Math.round(completions / Math.max(1, habit.targetPerWeek)),
    );

    return Math.max(1, magnitude + quantity);
  }

  calculateAggregatedStats(
    habits: Array<{ habit: HabitDefinition; completions: number }>,
  ): PlayerStats {
    const stats = this.createDefaultStats();

    for (const entry of habits) {
      const growth = this.calculateAttributeGrowth(
        entry.habit,
        entry.completions,
      );

      if (entry.habit.type === HabitType.NEGATIVE) {
        stats[entry.habit.attribute] = Math.max(
          this.MIN_STAT_VALUE,
          stats[entry.habit.attribute] - growth,
        );
        continue;
      }

      stats[entry.habit.attribute] += growth;
    }

    return stats;
  }

  calculateCharacterClass(stats: PlayerStats, level: number): string {
    if (level < 25) {
      return 'Initiate';
    }

    const ranked = Object.entries(stats).sort(([, a], [, b]) => b - a) as Array<
      [HabitAttribute, number]
    >;
    const [primaryStat] = ranked[0];
    const secondaryStat = ranked[1]?.[0];

    if (level >= 50) {
      if (
        (primaryStat === HabitAttribute.STRENGTH &&
          secondaryStat === HabitAttribute.CONSTITUTION) ||
        (primaryStat === HabitAttribute.CONSTITUTION &&
          secondaryStat === HabitAttribute.STRENGTH)
      ) {
        return 'Titan';
      }
      if (
        (primaryStat === HabitAttribute.INTELLIGENCE &&
          secondaryStat === HabitAttribute.WILLPOWER) ||
        (primaryStat === HabitAttribute.WILLPOWER &&
          secondaryStat === HabitAttribute.INTELLIGENCE)
      ) {
        return 'Archmage';
      }
      if (
        (primaryStat === HabitAttribute.DEXTERITY &&
          secondaryStat === HabitAttribute.CHARISMA) ||
        (primaryStat === HabitAttribute.CHARISMA &&
          secondaryStat === HabitAttribute.DEXTERITY)
      ) {
        return 'Shadowblade';
      }
      return 'Ascendant';
    }

    if (
      (primaryStat === HabitAttribute.STRENGTH &&
        secondaryStat === HabitAttribute.CONSTITUTION) ||
      (primaryStat === HabitAttribute.CONSTITUTION &&
        secondaryStat === HabitAttribute.STRENGTH)
    ) {
      return 'Guardian';
    }
    if (
      (primaryStat === HabitAttribute.INTELLIGENCE &&
        secondaryStat === HabitAttribute.WILLPOWER) ||
      (primaryStat === HabitAttribute.WILLPOWER &&
        secondaryStat === HabitAttribute.INTELLIGENCE)
    ) {
      return 'Scholar';
    }
    if (
      (primaryStat === HabitAttribute.DEXTERITY &&
        secondaryStat === HabitAttribute.CHARISMA) ||
      (primaryStat === HabitAttribute.CHARISMA &&
        secondaryStat === HabitAttribute.DEXTERITY)
    ) {
      return 'Ranger';
    }
    if (
      (primaryStat === HabitAttribute.WILLPOWER &&
        secondaryStat === HabitAttribute.CHARISMA) ||
      (primaryStat === HabitAttribute.CHARISMA &&
        secondaryStat === HabitAttribute.WILLPOWER)
    ) {
      return 'Mystic';
    }
    return 'Adept';
  }
}
