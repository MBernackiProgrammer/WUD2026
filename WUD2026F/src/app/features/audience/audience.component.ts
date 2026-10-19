import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { IconComponent } from '../../shared/components/icon/icon.component';
@Component({
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './audience.component.html',
  styleUrl: './audience.component.scss',
})
export class AudienceComponent {
  readonly education = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => data['audience'] === 'education')),
    { initialValue: true },
  );
}
