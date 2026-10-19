import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { EventDetails } from '../../core/models/event-details.model';
import { DateInputComponent } from '../../shared/components/date-input.component';

interface Field {
  key: string;
  label: string;
  kind?: 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'lines' | 'checkbox';
  max?: number;
}
interface Group {
  key: string;
  title: string;
  fields: Field[];
}
@Component({
  selector: 'app-event-details-editor',
  standalone: true,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    InputTextModule,
    TextareaModule,
    InputNumberModule,
    SelectModule,
    MultiSelectModule,
    CheckboxModule,
    ButtonModule,
    DateInputComponent,
  ],
  templateUrl: './event-details-editor.component.html',
})
export class EventDetailsEditorComponent {
  @Input() value: EventDetails = {};
  @Output() valueChange = new EventEmitter<EventDetails>();
  readonly standalone = { standalone: true };
  readonly types = [
    { label: 'Koncert', value: 'concert' },
    { label: 'Cykl', value: 'cycle' },
    { label: 'Festiwal', value: 'festival' },
    { label: 'Wystawa', value: 'exhibition' },
    { label: 'Edukacja', value: 'education' },
    { label: 'Zwiedzanie', value: 'tour' },
    { label: 'Inne', value: 'other' },
  ];
  readonly access = [
    { label: 'Ruchowa', value: 'mobility' },
    { label: 'Wzrokowa', value: 'visual' },
    { label: 'Słuchowa', value: 'hearing' },
    { label: 'Informacje sensoryczne', value: 'sensory' },
  ];
  readonly basics: Field[] = [
    { key: 'endDate', label: 'Data zakończenia', kind: 'date' },
    {
      key: 'intermissionMinutes',
      label: 'Przerwa (min, 0 = bez przerwy)',
      kind: 'number',
      max: 180,
    },
    { key: 'priceMax', label: 'Cena do (zł)', kind: 'number', max: 10000 },
    { key: 'ageMax', label: 'Wiek do', kind: 'number', max: 120 },
    { key: 'whyAttend', label: 'Dlaczego warto — 2–3 zdania', kind: 'textarea', max: 1500 },
    { key: 'programUrl', label: 'Program do pobrania — URL', max: 2048 },
    {
      key: 'accessibilityNotes',
      label: 'Dostępność, szatnia i udogodnienia',
      kind: 'textarea',
      max: 3000,
    },
    { key: 'sensoryNotes', label: 'Informacje sensoryczne', kind: 'textarea', max: 2000 },
    { key: 'promoted', label: 'Promuj w podobnych wydarzeniach', kind: 'checkbox' },
    { key: 'promotionPriority', label: 'Priorytet promocji (0–100)', kind: 'number', max: 100 },
  ];
  readonly groups: Group[] = [
    {
      key: 'venue',
      title: 'Miejsce i dojazd',
      fields: [
        { key: 'name', label: 'Nazwa sali / galerii', max: 200 },
        { key: 'number', label: 'Numer sali', max: 80 },
        { key: 'address', label: 'Adres', max: 500 },
        { key: 'directions', label: 'Jak znaleźć salę', kind: 'textarea', max: 1500 },
        { key: 'planUrl', label: 'Plan sali — URL', max: 2048 },
        { key: 'accessibility', label: 'Dostępność miejsca', kind: 'textarea', max: 2000 },
      ],
    },
    {
      key: 'collection',
      title: 'Cykl / festiwal',
      fields: [
        { key: 'name', label: 'Nazwa cyklu lub festiwalu', max: 200 },
        { key: 'season', label: 'Sezon', max: 80 },
        { key: 'description', label: 'Opis cyklu', kind: 'textarea', max: 3000 },
        { key: 'passes', label: 'Karnety — opis', kind: 'textarea', max: 1500 },
        { key: 'passUrl', label: 'Karnety — link zakupu', max: 2048 },
      ],
    },
    {
      key: 'exhibition',
      title: 'Dane wystawy',
      fields: [
        { key: 'title', label: 'Tytuł wystawy', max: 200 },
        { key: 'gallery', label: 'Galeria', max: 200 },
        { key: 'artists', label: 'Artyści wystawy', kind: 'textarea', max: 1000 },
        { key: 'curator', label: 'Kurator', max: 200 },
        { key: 'openingAt', label: 'Wernisaż', kind: 'datetime' },
        { key: 'photos', label: 'Galeria zdjęć — URL, jeden w wierszu', kind: 'lines' },
      ],
    },
    {
      key: 'education',
      title: 'Edukacja i zapisy',
      fields: [
        { key: 'group', label: 'Grupa uczestników', max: 200 },
        { key: 'age', label: 'Przedział wieku — opis', max: 200 },
        { key: 'registration', label: 'Sposób zapisu', kind: 'textarea', max: 1500 },
        { key: 'registrationUrl', label: 'Zapisy — URL', max: 2048 },
        { key: 'benefits', label: 'Co uczestnik zyska', kind: 'textarea', max: 2000 },
      ],
    },
  ];
  readonly lists: Group[] = [
    {
      key: 'performers',
      title: 'Artyści / prowadzący',
      fields: [
        { key: 'id', label: 'Identyfikator profilu (np. jan-kowalski)', max: 100 },
        { key: 'name', label: 'Imię i nazwisko', max: 200 },
        { key: 'role', label: 'Rola lub instrument', max: 200 },
        { key: 'biography', label: 'Biogram', kind: 'textarea', max: 5000 },
        { key: 'photoUrl', label: 'Zdjęcie — URL', max: 2048 },
      ],
    },
    {
      key: 'works',
      title: 'Utwory i odsłuchy',
      fields: [
        { key: 'title', label: 'Tytuł utworu', max: 500 },
        { key: 'composer', label: 'Kompozytor', max: 200 },
        { key: 'duration', label: 'Czas trwania utworu (min)', kind: 'number', max: 1440 },
        { key: 'audioUrl', label: 'Fragment audio z prawem do publikacji — URL', max: 2048 },
      ],
    },
    {
      key: 'articles',
      title: 'Powiązane artykuły',
      fields: [
        { key: 'id', label: 'Identyfikator artykułu', max: 100 },
        { key: 'title', label: 'Tytuł artykułu', max: 250 },
        { key: 'text', label: 'Tekst artykułu', kind: 'textarea', max: 20000 },
        { key: 'date', label: 'Data artykułu', kind: 'date' },
        { key: 'media', label: 'Zdjęcia — URL, jeden w wierszu', kind: 'lines' },
        { key: 'tags', label: 'Tagi artykułu — jeden w wierszu', kind: 'lines' },
      ],
    },
    {
      key: 'faqs',
      title: 'Często zadawane pytania',
      fields: [
        { key: 'question', label: 'Pytanie', max: 500 },
        { key: 'answer', label: 'Odpowiedź', kind: 'textarea', max: 3000 },
        { key: 'category', label: 'Kategoria pytania', max: 100 },
      ],
    },
  ];
  // Dynamic field descriptors keep the form and serialized editorial object in sync.
  get(path: string): any {
    return path.split('.').reduce((o: any, key) => o?.[key], this.value);
  }
  display(path: string, kind?: string): any {
    const value = this.get(path);
    return kind === 'lines'
      ? (value ?? []).join('\n')
      : (value ?? (kind === 'checkbox' ? false : kind === 'number' ? null : ''));
  }
  items(key: string): unknown[] {
    return this.get(key) ?? [];
  }
  set(path: string, raw: unknown, kind?: string): void {
    const next = JSON.parse(JSON.stringify(this.value));
    const keys = path.split('.');
    const last = keys.pop()!;
    let target = next;
    for (const key of keys) {
      target[key] ??= {};
      target = target[key];
    }
    const value =
      kind === 'lines'
        ? String(raw ?? '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : raw;
    if (value === '' || value == null) delete target[last];
    else target[last] = value;
    this.value = next;
    this.valueChange.emit(next);
  }
  add(key: string): void {
    this.set(key, [...this.items(key), {}]);
  }
  remove(key: string, index: number): void {
    this.set(
      key,
      this.items(key).filter((_, i) => i !== index),
    );
  }
}
