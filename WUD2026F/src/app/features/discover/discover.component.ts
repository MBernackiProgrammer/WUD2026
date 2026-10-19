import { VisitGuideComponent } from '../../shared/components/visit-guide/visit-guide.component';
import { Component, computed, inject } from '@angular/core';
import { PhilharmonicStore } from '../../core/services/philharmonic.store';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  standalone: true,
  imports: [VisitGuideComponent, RouterLink, IconComponent, ButtonModule],
  templateUrl: './discover.component.html',
  styleUrl: './discover.component.scss',
})
export class DiscoverComponent {
  private readonly store = inject(PhilharmonicStore);
  readonly artists = computed(() =>
    [
      ...new Map(
        this.store
          .events()
          .flatMap((e) => e.details?.performers ?? [])
          .filter((a) => a.id && a.name)
          .map((a) => [a.id, a]),
      ).values(),
    ].slice(0, 8),
  );
}
