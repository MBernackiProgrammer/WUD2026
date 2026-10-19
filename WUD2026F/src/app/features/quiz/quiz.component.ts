import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { ProgressBarModule } from 'primeng/progressbar';
import { PhilharmonicStore } from '../../core/services/philharmonic.store';
import { getRecommendationReason, recommendConcerts } from '../../core/utils/recommendations';
import { EventCardComponent } from '../../shared/components/event-card/event-card.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { QUIZ_QUESTIONS } from './quiz.data';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    IconComponent,
    EventCardComponent,
    ButtonModule,
    InputNumberModule,
    ProgressBarModule,
  ],
  templateUrl: './quiz.component.html',
})
export class QuizComponent {
  readonly store = inject(PhilharmonicStore);
  readonly step = signal(0);
  readonly answers = signal<string[]>(['', '', '', '', '']);
  readonly childAge = signal(5);
  readonly questions = QUIZ_QUESTIONS;
  readonly totalSteps = this.questions.length;
  readonly reason = computed(() => getRecommendationReason(this.answers()));
  readonly recommendations = computed(() =>
    recommendConcerts(this.store.events(), this.answers(), this.childAge()),
  );

  choose(value: string): void {
    this.answers.update((answers) =>
      answers.map((answer, index) => (index === this.step() ? value : answer)),
    );
  }

  move(delta: number): void {
    this.step.update((step) => Math.max(0, Math.min(this.totalSteps, step + delta)));
    setTimeout(() => document.getElementById('question-heading')?.focus());
  }

  skip(): void {
    this.choose('');
    this.move(1);
  }
}
