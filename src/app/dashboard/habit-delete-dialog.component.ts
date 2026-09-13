import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

@Component({
  selector: 'app-habit-delete-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <div class="habit-delete-dialog__content">
      <h2 mat-dialog-title>Delete habit?</h2>

      <mat-dialog-content>
        <p>
          Are you sure you want to remove
          <strong>"{{ data.habitTitle }}"</strong>? This action cannot be
          undone.
        </p>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-stroked-button type="button" (click)="cancel()">
          Cancel
        </button>
        <button mat-flat-button color="warn" type="button" (click)="confirm()">
          Delete Habit
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .habit-delete-dialog__content {
        background: rgba(15, 23, 42, 0.96);
        color: #f8fafc;
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.5);
      }

      h2,
      h2[mat-dialog-title],
      .mat-mdc-dialog-title {
        margin: 0;
        padding: 20px 24px 0;
        color: #f8fafc !important;
        font-size: 1.4rem;
      }

      mat-dialog-content {
        padding: 16px 24px 8px;
        color: #f1f5f9;
      }

      p {
        margin: 0;
        line-height: 1.6;
        color: #e2e8f0;
      }

      strong {
        color: #f8fafc;
      }

      mat-dialog-actions {
        padding: 0 24px 20px;
        gap: 12px;
      }

      button[mat-stroked-button] {
        color: #f8fafc !important;
        border-color: rgba(148, 163, 184, 0.42) !important;
      }

      button[mat-flat-button][color='warn'],
      button[mat-flat-button][color='warn'] .mdc-button__label {
        background: linear-gradient(135deg, #ef4444, #dc2626) !important;
        color: #ffffff !important;
      }
    `,
  ],
})
export class HabitDeleteDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: { habitTitle: string },
    private readonly dialogRef: MatDialogRef<HabitDeleteDialogComponent>,
  ) {}

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
