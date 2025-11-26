import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'formatText',
  standalone: true
})
export class FormatTextPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) return '';
    
    let cleaned = value;
    
    // Remove potentially dangerous content first
    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleaned = cleaned.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    cleaned = cleaned.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    cleaned = cleaned.replace(/javascript:/gi, '');
    
    // Convert line breaks to <br> for plain text (before processing HTML)
    // Only convert if there's no existing HTML tags
    if (!/<[^>]+>/.test(cleaned)) {
      cleaned = cleaned.replace(/\n/g, '<br>');
    }
    
    // Use Angular's sanitizer to clean the HTML
    // SecurityContext.HTML = 1
    const sanitized = this.sanitizer.sanitize(1, cleaned);
    
    if (!sanitized) return '';
    
    // Angular's sanitizer will strip out dangerous tags but keep safe formatting tags
    // like <b>, <strong>, <i>, <em>, <br>, <p>, <span> (without attributes)
    // Use bypassSecurityTrustHtml to render the sanitized HTML
    return this.sanitizer.bypassSecurityTrustHtml(sanitized);
  }
}

