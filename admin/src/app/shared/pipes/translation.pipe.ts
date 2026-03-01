import { Pipe, PipeTransform } from '@angular/core';
import { TranslationService, TranslationKeys } from '../../core/services/translation.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false // Make it impure so it updates when locale changes
})
export class TranslatePipe implements PipeTransform {
  constructor(private translationService: TranslationService) {}

  transform(key: keyof TranslationKeys | string): string {
    return this.translationService.translate(key as keyof TranslationKeys);
  }
}

