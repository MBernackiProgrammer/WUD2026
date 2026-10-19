import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ASSISTANT_CONTENT } from '../../core/data/assistant-content';
import { AssistantDialogService } from '../../core/services/assistant-dialog.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  standalone: true,
  imports: [ButtonModule, IconComponent],
  templateUrl: './assistant.component.html',
})
export class AssistantComponent {
  readonly dialog = inject(AssistantDialogService);
  readonly content = ASSISTANT_CONTENT;
}
