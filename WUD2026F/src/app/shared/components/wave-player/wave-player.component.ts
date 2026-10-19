import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { IconComponent } from '../icon/icon.component';
@Component({
  selector: 'app-wave-player',
  imports: [IconComponent],
  templateUrl: './wave-player.component.html',
  styleUrl: './wave-player.component.scss',
})
export class WavePlayerComponent {
  private readonly audio = viewChild.required<ElementRef<HTMLAudioElement>>('audio');
  readonly playing = signal(false);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly duration = signal(0);
  readonly current = signal(0);
  readonly peaks = signal<number[]>([]);
  readonly progress = computed(() =>
    this.duration() > 0 ? (this.current() / this.duration()) * 100 : 0,
  );
  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const controller = new AbortController();
      let context: AudioContext | undefined;
      void (async () => {
        try {
          const response = await fetch('/chopin.mp3', { signal: controller.signal });
          if (!response.ok) return;
          const bytes = await response.arrayBuffer();
          if (controller.signal.aborted) return;
          context = new AudioContext();
          const buffer = await context.decodeAudioData(bytes);
          const samples = buffer.getChannelData(0);
          const count = 160,
            step = Math.floor(samples.length / count);
          const peaks = Array.from({ length: count }, (_, i) => {
            let sum = 0;
            for (let j = i * step; j < Math.min((i + 1) * step, samples.length); j++)
              sum += samples[j] * samples[j];
            return Math.sqrt(sum / step);
          });
          const max = Math.max(...peaks, 0.001);
          if (!controller.signal.aborted)
            this.peaks.set(peaks.map((p) => Math.max(0.035, p / max)));
        } catch {
          /* Audio playback remains available if waveform decoding is unsupported. */
        } finally {
          if (context && context.state !== 'closed') void context.close();
        }
      })();
      destroy.onDestroy(() => {
        controller.abort();
        this.audio().nativeElement.pause();
        if (context && context.state !== 'closed') void context.close();
      });
    });
  }
  metadata(): void {
    const d = this.audio().nativeElement.duration;
    this.duration.set(Number.isFinite(d) ? d : 0);
  }
  update(): void {
    this.current.set(this.audio().nativeElement.currentTime);
  }
  seek(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.audio().nativeElement.currentTime = value;
    this.current.set(value);
  }
  async toggle(): Promise<void> {
    const audio = this.audio().nativeElement;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    this.loading.set(true);
    try {
      await audio.play();
      this.failed.set(false);
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
  stamp(value: number): string {
    const seconds = Math.floor(value);
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }
}
