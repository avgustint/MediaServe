/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { FormatTextPipe } from './format-text.pipe';

describe('FormatTextPipe', () => {
  let pipe: FormatTextPipe;
  let sanitizer: jasmine.SpyObj<DomSanitizer>;

  beforeEach(() => {
    sanitizer = jasmine.createSpyObj('DomSanitizer', ['sanitize', 'bypassSecurityTrustHtml']);
    sanitizer.sanitize.and.callFake((_: number, value: string) => value || '');
    sanitizer.bypassSecurityTrustHtml.and.callFake((value: string) => value as any);

    TestBed.configureTestingModule({
      providers: [
        FormatTextPipe,
        { provide: DomSanitizer, useValue: sanitizer }
      ]
    });
    pipe = TestBed.inject(FormatTextPipe);
  });

  it('should create', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return empty string for null or undefined', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(null as any)).toBe('');
    expect(pipe.transform(undefined as any)).toBe('');
  });

  it('should convert newlines to br in plain text', () => {
    const result = pipe.transform('line1\nline2');
    expect(sanitizer.bypassSecurityTrustHtml).toHaveBeenCalled();
    const passedValue = (sanitizer.bypassSecurityTrustHtml as jasmine.Spy).calls.mostRecent().args[0];
    expect(passedValue).toContain('<br>');
  });
});
