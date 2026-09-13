import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import {
  HabitAttribute,
  HabitDifficulty,
  HabitResetPeriod,
  HabitRulesService,
  HabitType,
} from '../habit-rules.service';

export interface HabitFormValues {
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

@Component({
  selector: 'app-habit-form',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatIconModule],
  templateUrl: './habit-form.component.html',
  styleUrl: './habit-form.component.css',
})
export class HabitFormComponent {
  readonly HabitType = HabitType;
  readonly HabitAttribute = HabitAttribute;
  readonly HabitResetPeriod = HabitResetPeriod;
  readonly HabitDifficulty = HabitDifficulty;
  readonly stats = Object.values(HabitAttribute);

  constructor(
    private readonly habitRules: HabitRulesService,
    private readonly dialogRef: MatDialogRef<HabitFormComponent>,
  ) {}

  get isFormValid(): boolean {
    const validAttributes = Object.values(HabitAttribute);
    const validDifficulties = Object.values(HabitDifficulty);

    return (
      this.form.title.trim().length > 0 &&
      validAttributes.includes(this.form.attribute as HabitAttribute) &&
      validDifficulties.includes(this.form.difficulty) &&
      Number.isFinite(this.form.targetPerWeek) &&
      this.form.targetPerWeek >= 1
    );
  }

  form: HabitFormValues = {
    title: '',
    description: '',
    type: HabitType.POSITIVE,
    attribute: HabitAttribute.STRENGTH,
    targetPerWeek: 3,
    xpPerCompletion: 10,
    bonusXpForFullWeek: 25,
    resetPeriod: HabitResetPeriod.WEEKLY,
    difficulty: HabitDifficulty.MEDIUM,
  };

  @Output() habitSubmitted = new EventEmitter<HabitFormValues>();

  submit(): void {
    if (!this.isFormValid) {
      return;
    }

    const difficultyConfig = this.getDifficultyConfig(this.form.difficulty);

    this.habitSubmitted.emit({
      ...this.form,
      xpPerCompletion: difficultyConfig.xpPerCompletion,
      bonusXpForFullWeek: difficultyConfig.bonusXpForFullWeek,
      title: this.form.title.trim(),
      description: this.form.description.trim(),
    });

    this.reset();
  }

  cancel(): void {
    this.dialogRef.close();
  }

  getDifficultyConfig(difficulty: HabitDifficulty): {
    xpPerCompletion: number;
    bonusXpForFullWeek: number;
  } {
    return this.habitRules.getDifficultyConfig(difficulty);
  }

  reset(): void {
    this.form = {
      title: '',
      description: '',
      type: HabitType.POSITIVE,
      attribute: HabitAttribute.STRENGTH,
      targetPerWeek: 3,
      xpPerCompletion: 10,
      bonusXpForFullWeek: 25,
      resetPeriod: HabitResetPeriod.WEEKLY,
      difficulty: HabitDifficulty.MEDIUM,
    };
  }
}
