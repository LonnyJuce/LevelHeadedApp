import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HabitAttribute, HabitType } from '../habit-rules.service';

export interface HabitFormValues {
  title: string;
  description: string;
  type: HabitType;
  attribute: HabitAttribute;
  targetPerWeek: number;
  xpPerCompletion: number;
  bonusXpForFullWeek: number;
}

@Component({
  selector: 'app-habit-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './habit-form.component.html',
  styleUrl: './habit-form.component.css',
})
export class HabitFormComponent {
  readonly HabitType = HabitType;
  readonly HabitAttribute = HabitAttribute;
  readonly stats = Object.values(HabitAttribute);

  form: HabitFormValues = {
    title: '',
    description: '',
    type: HabitType.POSITIVE,
    attribute: HabitAttribute.STRENGTH,
    targetPerWeek: 3,
    xpPerCompletion: 10,
    bonusXpForFullWeek: 25,
  };

  @Output() habitSubmitted = new EventEmitter<HabitFormValues>();

  submit(): void {
    if (!this.form.title.trim()) {
      return;
    }

    this.habitSubmitted.emit({
      ...this.form,
      title: this.form.title.trim(),
      description: this.form.description.trim(),
    });

    this.reset();
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
    };
  }
}
