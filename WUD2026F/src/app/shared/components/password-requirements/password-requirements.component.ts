import { Component, Input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-password-requirements',
  imports: [IconComponent],
  template: `
    <ul aria-label="Wymagania hasła">
      @for (rule of rules; track rule.label) {
        <li [class.met]="rule.test(password)">
          <span
            class="requirement-mark"
            aria-hidden="true"
          >
            @if (rule.test(password)) {
              <app-icon name="check" />
            }
          </span>
          <span>{{ rule.label }}</span>
          <span class="sr-only">
            {{ rule.test(password) ? ' — spełnione' : ' — niespełnione' }}
          </span>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }
    ul {
      list-style: none;
      display: grid;
      gap: 8px;
      padding: 0;
      margin: 0;
    }
    li {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .requirement-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      flex: 0 0 18px;
      border: 1px solid var(--line);
      border-radius: 50%;
    }
    .met {
      color: var(--gold-dark);
    }
    .met .requirement-mark {
      background: var(--ink);
      border-color: var(--ink);
      color: var(--gold);
    }
    app-icon {
      width: 12px;
      height: 12px;
    }
  `,
})
export class PasswordRequirementsComponent {
  @Input() password = '';
  readonly rules = [
    {
      label: 'Od 12 do 128 znaków',
      test: (value: string) => value.length >= 12 && value.length <= 128,
    },
    { label: 'Co najmniej jedna mała litera (a–z)', test: (value: string) => /[a-z]/.test(value) },
    {
      label: 'Co najmniej jedna wielka litera (A–Z)',
      test: (value: string) => /[A-Z]/.test(value),
    },
    { label: 'Co najmniej jedna cyfra (0–9)', test: (value: string) => /[0-9]/.test(value) },
  ];
}
