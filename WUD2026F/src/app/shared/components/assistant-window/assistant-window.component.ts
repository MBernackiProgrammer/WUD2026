import { DOCUMENT } from '@angular/common';
import {
  Component,
  afterRenderEffect,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { ASSISTANT_CONTENT } from '../../../core/data/assistant-content';
import { AssistantService } from '../../../core/services/assistant.service';
import { AssistantDialogService } from '../../../core/services/assistant-dialog.service';
import { CuratorConversationComponent } from '../curator-conversation/curator-conversation.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-assistant-window',
  imports: [FormsModule, ButtonModule, TextareaModule, IconComponent, CuratorConversationComponent],
  templateUrl: './assistant-window.component.html',
})
export class AssistantWindowComponent {
  readonly assistant = inject(AssistantService);
  private readonly dialogRequests = inject(AssistantDialogService);
  private readonly document = inject(DOCUMENT);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly input = viewChild.required<ElementRef<HTMLTextAreaElement>>('input');
  private readonly log = viewChild.required<ElementRef<HTMLElement>>('log');
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private previousOverflow = '';
  private closeTimer?: ReturnType<typeof setTimeout>;
  private openTimer?: ReturnType<typeof setTimeout>;
  readonly opening = signal(false);
  readonly opened = signal(false);
  readonly closing = signal(false);
  question = '';
  readonly messages = this.assistant.messages;
  readonly content = ASSISTANT_CONTENT;
  readonly prompts = this.content.prompts;

  constructor() {
    afterRenderEffect(() => {
      if (this.dialogRequests.openRequest()) untracked(() => this.open());
    });
    afterRenderEffect((onCleanup) => {
      this.assistant.messages();
      this.assistant.busy();
      this.assistant.error();
      if (!this.opened()) return;
      const frame = requestAnimationFrame(() => {
        this.log().nativeElement.scrollTop = this.log().nativeElement.scrollHeight;
      });
      onCleanup(() => cancelAnimationFrame(frame));
    });
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationStart || event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        if (event instanceof NavigationStart) this.close(false);
        if (event instanceof NavigationEnd && event.urlAfterRedirects.split('?')[0] === '/asystent')
          this.dialogRequests.open();
      });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.closeTimer);
      clearTimeout(this.openTimer);
      if (this.opened()) this.document.body.style.overflow = this.previousOverflow;
    });
  }

  open(): void {
    if (this.opened() || this.opening()) return;
    this.opening.set(true);
    void this.assistant.checkStatus();
    // Hide the name first, then launch the dialog from the remaining circular icon.
    this.openTimer = setTimeout(() => this.showWindow(), 160);
  }

  private showWindow(): void {
    this.opening.set(false);
    this.previousOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.closing.set(false);
    this.opened.set(true);
    const dialog = this.dialog().nativeElement;
    const trigger = this.trigger().nativeElement.getBoundingClientRect();
    this.updateBounds();
    dialog.style.animation = 'none';
    dialog.show();
    const panel = dialog.getBoundingClientRect();
    dialog.style.setProperty('--launch-x', `${trigger.x - panel.x}px`);
    dialog.style.setProperty('--launch-y', `${trigger.y - panel.y}px`);
    dialog.style.setProperty('--launch-scale-x', String(trigger.width / panel.width));
    dialog.style.setProperty('--launch-scale-y', String(trigger.height / panel.height));
    void dialog.offsetWidth;
    dialog.style.removeProperty('animation');
    this.log().nativeElement.focus({ preventScroll: true });
  }

  close(restoreFocus = true): void {
    if (this.opening()) {
      clearTimeout(this.openTimer);
      this.opening.set(false);
      return;
    }
    if (this.closing() || !this.opened()) return;
    this.closing.set(true);
    this.closeTimer = setTimeout(() => {
      this.dialog().nativeElement.close();
      this.opened.set(false);
      this.closing.set(false);
      this.document.body.style.overflow = this.previousOverflow;
      if (restoreFocus) this.trigger().nativeElement.focus({ preventScroll: true });
    }, 240);
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (!this.opened() && !this.opening()) return;
    if (this.document.querySelector('.calendar-choice-dialog')) return;
    event.preventDefault();
    this.close();
  }

  @HostListener('window:resize')
  updateBounds(): void {
    const nav = this.document.querySelector<HTMLElement>('.bottom-nav');
    const navVisible = nav && getComputedStyle(nav).display !== 'none';
    const bottom = navVisible ? Math.max(0, innerHeight - nav.getBoundingClientRect().top) : 0;
    const header = this.document.querySelector<HTMLElement>('.site-header');
    const accessibilityBar = this.document.querySelector<HTMLElement>('.accessibility-bar');
    const top = Math.max(
      accessibilityBar?.getBoundingClientRect().bottom ?? 0,
      !navVisible && header ? Math.max(0, header.getBoundingClientRect().bottom) : 0,
    );
    const dialog = this.dialog().nativeElement;
    dialog.style.setProperty('--navigation-bottom', `${bottom}px`);
    dialog.style.setProperty('--navigation-top', `${top}px`);
    this.document.documentElement.style.setProperty('--assistant-navigation-bottom', `${bottom}px`);
    this.document.documentElement.style.setProperty('--assistant-navigation-top', `${top}px`);
  }

  resizeInput(): void {
    const input = this.input().nativeElement;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.ask(this.question);
    }
  }

  ask(raw: string): void {
    const question = raw.trim();
    if (!question || this.assistant.busy() || this.assistant.restoring()) return;
    this.question = '';
    this.input().nativeElement.value = '';
    this.resizeInput();
    void this.assistant.ask(question);
  }

  async resetConversation(): Promise<void> {
    if (await this.assistant.reset()) {
      this.question = '';
      this.input().nativeElement.value = '';
      this.resizeInput();
    }
  }
}
