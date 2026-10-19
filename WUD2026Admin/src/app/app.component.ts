import { Component, inject } from '@angular/core';
import { AccountService } from './core/services/account.service';
import { PUBLIC_SITE_URL } from './core/data/content-api';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly account = inject(AccountService);
  readonly publicSite = PUBLIC_SITE_URL;
}
