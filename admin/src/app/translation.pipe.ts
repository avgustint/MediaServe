import { Pipe, PipeTransform } from '@angular/core';
import { TranslationService, TranslationKeys } from './translation.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false // Make it impure so it updates when locale changes
})
export class TranslatePipe implements PipeTransform {
  constructor(private translationService: TranslationService) {}

  transform(key: keyof TranslationKeys): string {
    return this.translationService.translate(key);
  }
}

