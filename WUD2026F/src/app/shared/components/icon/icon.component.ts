import { Component, Input } from '@angular/core';
import { BrandSymbolComponent } from '../brand-symbol/brand-symbol.component';
import { ICON_PATHS } from './icon-paths';
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [BrandSymbolComponent],
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
})
export class IconComponent {
  @Input() name = 'arrow';
  readonly paths = ICON_PATHS;
}
