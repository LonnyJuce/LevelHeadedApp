import { TestBed } from '@angular/core/testing';
import {
  HabitAttribute,
  HabitDifficulty,
  HabitResetPeriod,
  HabitType,
  HabitRulesService,
  HabitDefinition,
} from './habit-rules.service';

describe('HabitRulesService', () => {
  let service: HabitRulesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HabitRulesService],
    });
    service = TestBed.inject(HabitRulesService);
  });

  it('awards a weekly bonus when a positive habit reaches its target', () => {
    const habit: HabitDefinition = {
      id: 'exercise',
      title: 'Exercise 5x a week',
      description: 'Train with intention and consistency.',
      type: HabitType.POSITIVE,
      attribute: HabitAttribute.STRENGTH,
      targetPerWeek: 5,
      xpPerCompletion: 25,
      bonusXpForFullWeek: 50,
      resetPeriod: HabitResetPeriod.WEEKLY,
      difficulty: HabitDifficulty.MEDIUM,
    };

    const result = service.calculateWeeklyResult(habit, 5);

    expect(result.baseXp).toBe(125);
    expect(result.bonusXp).toBe(50);
    expect(result.totalXp).toBe(175);
    expect(result.completedTarget).toBeTrue();
  });

  it('penalizes negative habits when they are recorded', () => {
    const habit: HabitDefinition = {
      id: 'junk-food',
      title: 'No Junk Food',
      description: 'Avoid processed snacks and sugar binges.',
      type: HabitType.NEGATIVE,
      attribute: HabitAttribute.WILLPOWER,
      targetPerWeek: 3,
      xpPerCompletion: 15,
      bonusXpForFullWeek: 0,
      resetPeriod: HabitResetPeriod.WEEKLY,
      difficulty: HabitDifficulty.MEDIUM,
    };

    const result = service.calculateWeeklyResult(habit, 2);

    expect(result.baseXp).toBe(-30);
    expect(result.bonusXp).toBe(0);
    expect(result.totalXp).toBe(-30);
    expect(result.completedTarget).toBeFalse();
  });

  it('counts only the current day for daily habits', () => {
    const now = new Date('2026-09-12T15:00:00Z');
    const completions = [
      { completed_at: '2026-09-11T20:00:00Z', quantity: 1 },
      { completed_at: '2026-09-12T09:00:00Z', quantity: 2 },
      { completed_at: '2026-09-12T14:30:00Z', quantity: 1 },
    ];

    expect(
      service.countCompletionsInCurrentResetWindow(
        completions as any,
        HabitResetPeriod.DAILY,
        now,
      ),
    ).toBe(3);
  });

  it('counts only the current week for weekly habits', () => {
    const now = new Date('2026-09-12T15:00:00Z');
    const completions = [
      { completed_at: '2026-09-06T10:00:00Z', quantity: 1 },
      { completed_at: '2026-09-10T07:00:00Z', quantity: 1 },
      { completed_at: '2026-09-12T09:00:00Z', quantity: 2 },
      { completed_at: '2026-09-13T02:00:00Z', quantity: 1 },
    ];

    expect(
      service.countCompletionsInCurrentResetWindow(
        completions as any,
        HabitResetPeriod.WEEKLY,
        now,
      ),
    ).toBe(4);
  });

  it('maps each difficulty to preset XP values', () => {
    expect(service.getDifficultyConfig(HabitDifficulty.EASY)).toEqual({
      xpPerCompletion: 10,
      bonusXpForFullWeek: 25,
    });
    expect(service.getDifficultyConfig(HabitDifficulty.MEDIUM)).toEqual({
      xpPerCompletion: 20,
      bonusXpForFullWeek: 50,
    });
    expect(service.getDifficultyConfig(HabitDifficulty.HARD)).toEqual({
      xpPerCompletion: 35,
      bonusXpForFullWeek: 100,
    });
  });

  it('requires increasingly more XP to reach higher levels', () => {
    expect(service.xpRequiredForLevel(1)).toBe(100);
    expect(service.xpRequiredForLevel(2)).toBe(135);
    expect(service.xpRequiredForLevel(3)).toBe(182);
    expect(service.calculatePlayerLevel(100)).toBe(2);
    expect(service.calculatePlayerLevel(250)).toBe(3);
  });

  it('unlocks level-based achievements that each grant a title', () => {
    const unlocked = service.getUnlockedAchievements(12);

    expect(unlocked.map((achievement) => achievement.title)).toContain(
      'Rookie',
    );
    expect(unlocked.map((achievement) => achievement.title)).toContain(
      'Trailblazer',
    );
    expect(
      unlocked.some((achievement) => achievement.requiredLevel === 10),
    ).toBeTrue();
  });

  it('falls back to the highest unlocked title when a saved title is no longer valid', () => {
    expect(service.getCurrentTitle(8, 'Mythic')).toBe('Trailblazer');
    expect(service.getCurrentTitle(25, 'Mythic')).toBe('Mythic');
  });

  it('adds class and consistency milestones beyond raw level progression', () => {
    const unlocked = service.getUnlockedAchievements(12, {
      className: 'Guardian',
      activeHabits: 4,
      weeklyClears: 3,
    });

    expect(unlocked.map((achievement) => achievement.title)).toContain(
      'Bulwark',
    );
    expect(unlocked.map((achievement) => achievement.title)).toContain(
      'Quest Starter',
    );
    expect(unlocked.map((achievement) => achievement.title)).toContain(
      'Completionist',
    );
  });

  it('supports a fifth class pair and its advanced evolution', () => {
    const sentinelStats = {
      [HabitAttribute.STRENGTH]: 8,
      [HabitAttribute.CONSTITUTION]: 3,
      [HabitAttribute.DEXTERITY]: 7,
      [HabitAttribute.INTELLIGENCE]: 1,
      [HabitAttribute.WILLPOWER]: 1,
      [HabitAttribute.CHARISMA]: 2,
    };

    expect(service.calculateCharacterClass(sentinelStats, 30)).toBe('Sentinel');
    expect(service.calculateCharacterClass(sentinelStats, 60)).toBe('Warden');
  });

  it('includes a title achievement for every class path', () => {
    const titlesByClass = {
      Guardian: 'Bulwark',
      Scholar: 'Archivist',
      Ranger: 'Pathfinder',
      Mystic: 'Oracle',
      Sentinel: 'Watchman',
      Titan: 'Colossus',
      Archmage: 'Arcanist',
      Shadowblade: 'Nightblade',
      Warden: 'Keepkeeper',
      Ascendant: 'Ascendant',
    };

    Object.entries(titlesByClass).forEach(([className, expectedTitle]) => {
      const unlocked = service.getUnlockedAchievements(60, { className });
      const hasMatchingTitle = unlocked.some(
        (achievement) => achievement.title === expectedTitle,
      );

      if (!hasMatchingTitle) {
        throw new Error(
          `Missing title achievement for ${className} (expected ${expectedTitle})`,
        );
      }

      expect(hasMatchingTitle).toBeTrue();
    });
  });
});
