import { TestBed } from '@angular/core/testing';
import {
  HabitAttribute,
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
    };

    const result = service.calculateWeeklyResult(habit, 2);

    expect(result.baseXp).toBe(-30);
    expect(result.bonusXp).toBe(0);
    expect(result.totalXp).toBe(-30);
    expect(result.completedTarget).toBeFalse();
  });

  it('requires increasingly more XP to reach higher levels', () => {
    expect(service.xpRequiredForLevel(1)).toBe(100);
    expect(service.xpRequiredForLevel(2)).toBe(135);
    expect(service.xpRequiredForLevel(3)).toBe(182);
    expect(service.calculatePlayerLevel(100)).toBe(2);
    expect(service.calculatePlayerLevel(250)).toBe(3);
  });
});
