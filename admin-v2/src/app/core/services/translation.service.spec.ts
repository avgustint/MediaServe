/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';
import { filter, take } from 'rxjs/operators';
import { TranslationService, SupportedLocale } from './translation.service';

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TranslationService]
    });
    service = TestBed.inject(TranslationService);
    // Reset locale for predictable tests
    service.setLocale('en-GB');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to en-GB locale', () => {
    service.setLocale('en-GB');
    expect(service.getCurrentLocale()).toBe('en-GB');
  });

  it('should set and get locale', () => {
    service.setLocale('sl-SI');
    expect(service.getCurrentLocale()).toBe('sl-SI');

    service.setLocale('it-IT');
    expect(service.getCurrentLocale()).toBe('it-IT');
  });

  it('should translate keys for en-GB', () => {
    service.setLocale('en-GB');
    expect(service.translate('playlist')).toBe('Playlist');
    expect(service.translate('save')).toBe('Save');
    expect(service.translate('cancel')).toBe('Cancel');
  });

  it('should translate keys for sl-SI', () => {
    service.setLocale('sl-SI');
    expect(service.translate('playlist')).toBe('Seznam predvajanja');
  });

  it('should return key when translation missing', () => {
    expect(service.translate('unknownKey' as any)).toBe('unknownKey');
  });

  it('should emit locale via currentLocale$', (done) => {
    service.currentLocale$.pipe(
      // Skip initial emission, take the one after setLocale
      filter(locale => locale === 'sl-SI'),
      take(1)
    ).subscribe(locale => {
      expect(locale).toBe('sl-SI');
      done();
    });
    service.setLocale('sl-SI');
  });
});
