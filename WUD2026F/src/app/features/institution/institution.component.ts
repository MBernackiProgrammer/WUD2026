import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
@Component({
  standalone: true,
  imports: [RouterLink],
  templateUrl: './institution.component.html',
  styleUrl: './institution.component.scss',
})
export class InstitutionComponent {
  readonly page = inject(ActivatedRoute).snapshot.data['page'] as string;
}
