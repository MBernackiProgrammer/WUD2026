import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-icon',
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="paths[name] || paths['arrow']" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      vertical-align: middle;
      width: 1.2em;
      height: 1.2em;
      flex-shrink: 0;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class IconComponent {
  @Input() name = 'arrow';
  readonly paths: Record<string, string> = {
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    diagonal: 'M6 18 18 6M6 6h12v12',
    spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
    calendar:
      'M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1ZM8 3v4m8-4v4M4 10h16M8 14h2m4 0h2m-8 3h2m4 0h2',
  };
}
