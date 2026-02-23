/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { AuthService } from './core/services/auth.service';
import { UserService } from './core/services/user.service';
import { WebSocketService } from './core/services/websocket.service';
import { TranslationService } from './core/services/translation.service';
import { ViewportService } from './core/services/viewport.service';
import { ApiService } from './core/services/api.service';
import { KeyboardCommandService } from './core/services/keyboard-command.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: Router, useValue: {} },
        { provide: AuthService, useValue: { isAuthenticated: () => false } },
        { provide: UserService, useValue: { user$: of(null) } },
        { provide: WebSocketService, useValue: { messages$: of({}), disconnect: () => {} } },
        { provide: TranslationService, useValue: {} },
        { provide: ViewportService, useValue: {} },
        { provide: ApiService, useValue: { loading$: of(false) } },
        { provide: KeyboardCommandService, useValue: {} }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
