import { Pipe, PipeTransform, inject } from '@angular/core';
import { DatePipe, registerLocaleData } from '@angular/common';
import { TranslationService } from './translation.service';

// Import locale data
import localeEnGB from '@angular/common/locales/en-GB';
import localeSl from '@angular/common/locales/sl';
import localeIt from '@angular/common/locales/it';

// Register locales - Angular expects exact locale codes
registerLocaleData(localeEnGB, 'en-GB');
registerLocaleData(localeSl, 'sl-SI');
registerLocaleData(localeIt, 'it-IT');

@Pipe({
  name: 'localizedDate',
  standalone: true,
  pure: false // Make it impure so it updates when locale changes
})
export class LocalizedDatePipe implements PipeTransform {
  private translationService = inject(TranslationService);

  transform(value: string | Date | null | undefined, format: string = 'short'): string | null {
    if (!value) {
      return null;
    }

    // Always get the current locale fresh from the service (impure pipe re-executes)
    const userLocale = this.translationService.getCurrentLocale();
    const angularLocale = this.convertToAngularLocale(userLocale);
    
    // Create a new DatePipe with the current locale each time
    const datePipe = new DatePipe(angularLocale);
    return datePipe.transform(value, format, undefined, angularLocale) || null;
  }

  private convertToAngularLocale(locale: string): string {
    // Convert our locale format to Angular's registered locale format
    // The locale codes must match what we registered above
    const localeMap: { [key: string]: string } = {
      'en-GB': 'en-GB',
      'sl-SI': 'sl-SI',
      'it-IT': 'it-IT'
    };
    return localeMap[locale] || 'en-GB';
  }
}
