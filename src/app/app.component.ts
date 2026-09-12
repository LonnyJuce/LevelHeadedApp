import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: [
    ':host { display: block; min-height: 100vh; background: radial-gradient(circle at top, rgba(108, 89, 255, 0.35), transparent 38%), linear-gradient(180deg, #111827 0%, #1f2937 100%); color: #f9fafb; font-family: Inter, "Segoe UI", sans-serif; }',
    '* { box-sizing: border-box; }',
    'button, input, textarea, select { font: inherit; }',
  ],
})
export class AppComponent {}
