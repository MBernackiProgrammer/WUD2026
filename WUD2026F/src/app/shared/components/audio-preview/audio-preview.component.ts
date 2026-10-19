import { Component, ElementRef, Input, signal, viewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { IconComponent } from '../icon/icon.component';
@Component({
  selector: 'app-audio-preview',
  standalone: true,
  imports: [ButtonModule, IconComponent],
  template: `
    <audio
      #audio
      [src]="src"
      preload="none"
      (timeupdate)="update()"
      (ended)="playing.set(false)"
      (pause)="playing.set(false)"
      (error)="failed.set(true)"
    ></audio>
    <div class="audio-preview">
      <button
        pButton
        class="button outline"
        type="button"
        [disabled]="failed()"
        (click)="toggle()"
        [attr.aria-label]="(playing() ? 'Wstrzymaj fragment: ' : 'Odtwórz fragment: ') + title"
      >
        <app-icon [name]="playing() ? 'pause' : 'play'" />
        {{ playing() ? 'Wstrzymaj' : 'Posłuchaj fragmentu' }}
      </button>
      <span aria-hidden="true">{{ stamp() }} / 1:00</span>
    </div>
    @if (failed()) {
      <p role="status">Nagranie jest chwilowo niedostępne.</p>
    }
  `,
  styles: `
    .audio-preview {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin: 12px 0;
    }
    .audio-preview span {
      font-size: 12px;
    }
    .button {
      font-size: 12px;
    }
  `,
})
export class AudioPreviewComponent {
  @Input({ required: true }) src = '';
  @Input() title = '';
  private readonly audio = viewChild.required<ElementRef<HTMLAudioElement>>('audio');
  readonly playing = signal(false);
  readonly failed = signal(false);
  readonly seconds = signal(0);
  stamp(): string {
    const s = Math.floor(this.seconds());
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  async toggle(): Promise<void> {
    const audio = this.audio().nativeElement;
    if (this.playing()) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
      this.playing.set(true);
    } catch {
      this.failed.set(true);
    }
  }
  update(): void {
    const audio = this.audio().nativeElement;
    this.seconds.set(Math.min(60, audio.currentTime));
    if (audio.currentTime >= 60) {
      audio.pause();
      audio.currentTime = 0;
    }
  }
}
