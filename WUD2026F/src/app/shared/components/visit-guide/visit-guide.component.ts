import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-visit-guide',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './visit-guide.component.html',
  styleUrl: './visit-guide.component.scss',
})
export class VisitGuideComponent {}
