import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-brand-symbol',
  standalone: true,
  templateUrl: './brand-symbol.component.html',
  styleUrl: './brand-symbol.component.scss',
})
export class BrandSymbolComponent {
  @Input() compact = false;
}
