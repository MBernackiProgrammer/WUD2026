import { eventArtists, artistKey } from '../../core/utils/event-artists';
import {
  Component,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { AccountRole, AccountService, AccountUser } from '../../core/services/account.service';
import { PhilharmonicStore } from '../../core/services/philharmonic.store';
import { EventCardComponent } from '../../shared/components/event-card/event-card.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ProviderIconComponent } from '../../shared/components/provider-icon/provider-icon.component';
import { ADMIN_SITE_URL } from '../../core/data/content-api';
import { DiscoveryService } from '../../core/services/discovery.service';
import { TicketPreviewComponent } from '../../shared/components/ticket-preview/ticket-preview.component';
import { readStorage, writeStorage } from '../../core/utils/browser-storage';
import { PasswordRequirementsComponent } from '../../shared/components/password-requirements/password-requirements.component';

@Component({
  standalone: true,
  imports: [
    SelectModule,
    CheckboxModule,
    PasswordRequirementsComponent,
    ProviderIconComponent,
    FormsModule,
    RouterLink,
    EventCardComponent,
    IconComponent,
    ButtonModule,
    InputTextModule,
    DialogModule,
    TicketPreviewComponent,
  ],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent {
  readonly account = inject(AccountService);
  readonly discovery = inject(DiscoveryService);
  readonly readNotifications = signal<string[]>([]);
  readonly notifications = computed(() =>
    this.discovery
      .upcoming()
      .filter((e) => this.store.favorites().includes(e.id))
      .slice(0, 12),
  );
  readonly store = inject(PhilharmonicStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly savedArtists = computed(() => {
    const artists = this.store.events().flatMap(eventArtists);
    return (this.account.user()?.favoriteArtistIds ?? []).map((id) => ({
      id,
      name:
        artists.find((person) => 'nazwa-' + artistKey(person.name) === id || person.id === id)
          ?.name ?? id.replace(/^nazwa-/, '').replace(/-/g, ' '),
    }));
  });
  async removeArtist(id: string) {
    try {
      await this.account.toggleArtistFavorite(id);
    } catch (error) {
      this.store.notify(this.account.message(error));
    }
  }
  readonly saved = computed(() =>
    this.store.events().filter((event) => this.store.favorites().includes(event.id)),
  );
  readonly admin = computed(() => this.account.user()?.roles.includes('Admin') ?? false);
  readonly school = computed(() => this.account.user()?.roles.includes('School') ?? false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly mode = signal<'login' | 'register' | 'forgot' | 'reset'>('login');
  readonly tab = signal<
    'profile' | 'security' | 'favorites' | 'users' | 'tickets' | 'history' | 'notifications'
  >('profile');
  readonly users = signal<AccountUser[]>([]);
  readonly totalUsers = signal(0);
  readonly deleteVisible = signal(false);
  readonly roleOptions: { label: string; value: AccountRole }[] = [
    { label: 'Użytkownik', value: 'User' },
    { label: 'Administrator', value: 'Admin' },
    { label: 'Szkoła', value: 'School' },
  ];
  readonly registrationRoles = this.roleOptions.filter((option) => option.value !== 'Admin');
  email = '';
  password = '';
  passwordAgain = '';
  displayName = '';
  accountType = 'User';
  schoolName = '';
  rememberMe = false;
  currentPassword = '';
  newPassword = '';
  newPasswordAgain = '';
  newEmail = '';
  profile = { displayName: '', phoneNumber: '', schoolName: '', schoolAddress: '' };
  deletePassword = '';
  confirmation = '';
  userQuery = '';
  userPage = 0;
  constructor() {
    afterRenderEffect(() => {
      const userId = this.account.user()?.id;
      untracked(() => {
        let ids: string[] = [];
        if (userId) {
          try {
            const value = JSON.parse(readStorage('philharmonic-notifications-' + userId) || '[]');
            if (Array.isArray(value)) ids = value.filter((id) => typeof id === 'string');
          } catch {
            /* Local read state is optional. */
          }
        }
        this.readNotifications.set(ids);
      });
    });
    afterNextRender(() => {
      void this.initialize();
    });
  }
  private async initialize(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const tab = params.get('tab');
    if (tab === 'favorites' || tab === 'tickets' || tab === 'history' || tab === 'notifications')
      this.tab.set(tab);
    if (params.get('action') === 'reset') {
      this.mode.set('reset');
      this.email = params.get('email') ?? '';
    }
    const messages: Record<string, string> = {
      external_failed: 'Nie udało się zalogować przez wybranego dostawcę. Spróbuj ponownie.',
      existing_account:
        'Masz już konto z tym adresem. Zaloguj się dotychczasową metodą i podłącz dostawcę w ustawieniach.',
      email_missing:
        'Dostawca nie udostępnił e-maila. Zezwól na jego udostępnienie lub zarejestruj się e-mailem.',
      reauthenticate: 'Zaloguj się ponownie, aby wykonać tę operację.',
      already_linked: 'To konto dostawcy jest już podłączone. Użyj właściwego konta.',
      signin_denied:
        'Logowanie jest niedostępne. Sprawdź potwierdzenie e-mail lub skontaktuj się z Filharmonią.',
      confirm_email: 'Potwierdź adres e-mail przed logowaniem.',
    };
    const authError = params.get('authError');
    if (authError) this.error.set(messages[authError] ?? messages['external_failed']);
    if (params.get('authSuccess') === 'linked') this.notice.set('Konto zostało podłączone.');
    await this.run(async () => {
      await this.account.refresh();
      this.loadProfile();
      if (params.get('action') === 'confirm') {
        await this.account.request('POST', '/confirm-email', {
          userId: params.get('userId'),
          token: params.get('token'),
          newEmail: params.get('newEmail'),
        });
        this.notice.set('Adres e-mail został potwierdzony.');
        await this.account.refresh();
        await this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      } else if (authError || params.get('authSuccess'))
        await this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
    }, false);
  }
  loadProfile(): void {
    const user = this.account.user();
    if (user)
      this.profile = {
        displayName: user.displayName,
        phoneNumber: user.phoneNumber ?? '',
        schoolName: user.schoolName,
        schoolAddress: user.schoolAddress,
      };
  }
  markNotificationsRead(): void {
    const ids = this.notifications().map((e) => e.id);
    this.readNotifications.set(ids);
    if (this.account.user())
      writeStorage('philharmonic-notifications-' + this.account.user()!.id, JSON.stringify(ids));
  }
  async run(action: () => Promise<void>, clear = true): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    if (clear) {
      this.error.set('');
      this.notice.set('');
    }
    try {
      await action();
    } catch (error) {
      this.error.set(this.account.message(error));
    } finally {
      this.busy.set(false);
    }
  }
  submitAccess(): void {
    void this.run(async () => {
      if (this.mode() === 'register') {
        if (this.password !== this.passwordAgain) {
          this.error.set('Hasła muszą być takie same.');
          return;
        }
        const result = await this.account.request<{ requiresConfirmation: boolean }>(
          'POST',
          '/register',
          {
            email: this.email,
            password: this.password,
            displayName: this.displayName,
            accountType: this.accountType,
            schoolName: this.schoolName,
          },
        );
        if (result.requiresConfirmation) {
          this.notice.set('Konto utworzone. Potwierdź adres e-mail z otrzymanej wiadomości.');
          this.mode.set('login');
        }
      } else if (this.mode() === 'forgot') {
        await this.account.request('POST', '/forgot-password', { email: this.email });
        this.notice.set('Jeśli konto istnieje, wysłaliśmy instrukcję zmiany hasła.');
        return;
      } else if (this.mode() === 'reset') {
        if (this.password !== this.passwordAgain) {
          this.error.set('Hasła muszą być takie same.');
          return;
        }
        await this.account.request('POST', '/reset-password', {
          email: this.email,
          token: this.route.snapshot.queryParamMap.get('token'),
          newPassword: this.password,
        });
        this.notice.set('Hasło zmienione. Możesz się zalogować.');
        this.mode.set('login');
        await this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      } else
        await this.account.request('POST', '/login', {
          email: this.email,
          password: this.password,
          rememberMe: this.rememberMe,
        });
      this.password = '';
      this.passwordAgain = '';
      await this.account.refresh();
      this.loadProfile();
    });
  }
  logout(all = false): void {
    void this.run(async () => {
      await this.account.request('POST', all ? '/logout-all' : '/logout');
      await this.account.refresh();
      this.tab.set('profile');
      this.users.set([]);
      this.profile = { displayName: '', phoneNumber: '', schoolName: '', schoolAddress: '' };
      this.notice.set('Wylogowano.');
    });
  }
  saveProfile(): void {
    void this.run(async () => {
      await this.account.request('PUT', '/profile', this.profile);
      await this.account.refresh();
      this.notice.set('Dane zapisane.');
    });
  }
  savePassword(): void {
    void this.run(async () => {
      if (this.newPassword !== this.newPasswordAgain) {
        this.error.set('Hasła muszą być takie same.');
        return;
      }
      await this.account.request('POST', '/password', {
        currentPassword: this.currentPassword,
        newPassword: this.newPassword,
      });
      this.currentPassword = '';
      this.newPassword = '';
      this.newPasswordAgain = '';
      await this.account.refresh();
      this.notice.set('Hasło zapisane. Pozostałe sesje zostały unieważnione.');
    });
  }
  changeEmail(email: string): void {
    void this.run(async () => {
      await this.account.request('POST', '/email', { email });
      this.notice.set('Sprawdź pocztę i potwierdź adres linkiem w wiadomości.');
    });
  }
  resendConfirmation(): void {
    void this.run(async () => {
      await this.account.request('POST', '/resend-confirmation', { email: this.email });
      this.notice.set('Jeśli konto wymaga potwierdzenia, wysłaliśmy wiadomość e-mail.');
    });
  }
  external(provider: string, link = false): void {
    void this.run(async () => {
      await this.account.external(provider, link);
    });
  }
  unlink(provider: string): void {
    void this.run(async () => {
      await this.account.request('DELETE', '/external/' + encodeURIComponent(provider));
      await this.account.refresh();
      this.notice.set('Konto odłączone.');
    });
  }
  deleteAccount(): void {
    void this.run(async () => {
      await this.account.request('DELETE', '', {
        password: this.deletePassword,
        confirmation: this.confirmation,
      });
      this.deleteVisible.set(false);
      this.deletePassword = '';
      this.confirmation = '';
      await this.account.refresh();
      this.notice.set('Konto usunięte.');
    });
  }
  exportAccount(): void {
    void this.run(async () => {
      const data = await this.account.request('GET', '/export');
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'konto-melomana.json';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  loadUsers(page = 0): void {
    void this.run(async () => {
      this.userPage = page;
      const result = await this.account.users(this.userQuery, page);
      this.users.set(result.items);
      this.totalUsers.set(result.total);
      this.tab.set('users');
    });
  }
  roleLabel(role: string): string {
    return this.roleOptions.find((item) => item.value === role)?.label ?? role;
  }
  setRole(user: AccountUser, role: string): void {
    void this.run(async () => {
      await this.account.request('PUT', '/users/' + user.id + '/role', { role });
      const result = await this.account.users(this.userQuery, this.userPage);
      this.users.set(result.items);
      await this.account.refresh();
      this.notice.set('Rodzaj konta zmieniony. Użytkownik musi zalogować się ponownie.');
    });
  }
  readonly adminUrl = ADMIN_SITE_URL;
}
