import { Component, ElementRef, computed, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ORCHESTRA } from './orchestra.data';
type Musician = (typeof ORCHESTRA)[number]['people'][number];
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './orchestra.component.html',
  styleUrl: './institution.component.scss',
})
export class OrchestraComponent {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('artistDialog');
  open(person: Musician) {
    this.selected.set(person);
    this.dialog().nativeElement.showModal();
  }
  close() {
    this.dialog().nativeElement.close();
  }
  readonly query = signal('');
  readonly selected = signal<Musician | null>(null);
  readonly groups = computed(() => {
    const q = this.normalize(this.query());
    return ORCHESTRA.map((g) => ({
      ...g,
      people: g.people.filter((p) => this.normalize(p.name + ' ' + p.role).includes(q)),
    })).filter((g) => g.people.length);
  });
  private normalize(value: string) {
    return value
      .toLocaleLowerCase('pl')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/g, 'l');
  }
}
