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
    
    // Angular's sanitizer will strip custom tags like <chord> and <chi>
    // Extract chord and chi tags and their content before sanitization, then restore after
    const chordData: Array<{ placeholder: string; content: string }> = [];
    const chiData: Array<{ placeholder: string; content: string }> = [];
    const chordRegex = /<chord\b[^>]*>(.*?)<\/chord>/gi;
    const chiRegex = /<chi\b[^>]*>(.*?)<\/chi>/gi;
    let matchIndex = 0;
    
    // Replace chord tags with unique placeholders
    cleaned = cleaned.replace(chordRegex, (fullMatch, content) => {
      const placeholder = `__CHORD_PLACEHOLDER_${matchIndex}__`;
      // Store the content (will be escaped when restored)
      chordData.push({ placeholder, content });
      matchIndex++;
      return placeholder;
    });
    
    // Replace chi tags with unique placeholders
    matchIndex = 0;
    cleaned = cleaned.replace(chiRegex, (fullMatch, content) => {
      const placeholder = `__CHI_PLACEHOLDER_${matchIndex}__`;
      // Store the content (will be escaped when restored)
      chiData.push({ placeholder, content });
      matchIndex++;
      return placeholder;
    });
    
    // Use Angular's sanitizer to clean the HTML
    // SecurityContext.HTML = 1
    let sanitized = this.sanitizer.sanitize(1, cleaned);
    
    if (!sanitized) return '';
    
    // Restore tags after sanitization
    // Since we're using bypassSecurityTrustHtml, we can safely add these tags
    // IMPORTANT: When restoring chord tags, we need to restore chi placeholders within them first
    if (sanitized) {
      // First, restore chi tags that are NOT inside chord placeholders (standalone chi tags)
      // We'll handle chi tags inside chord tags when we restore the chord tags
      chiData.forEach(({ placeholder, content }) => {
        // Check if this placeholder is inside a chord placeholder
        // If it's in the sanitized string as a standalone placeholder, restore it
        if (sanitized!.includes(placeholder)) {
          // Escape HTML entities in chi content to prevent XSS
          const tempDiv = document.createElement('div');
          tempDiv.textContent = content;
          const escapedContent = tempDiv.innerHTML;
          // Replace placeholder with chi tag
          sanitized = sanitized!.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<chi>${escapedContent}</chi>`);
        }
      });
      
      // Then restore chord tags, handling chi placeholders within them
      chordData.forEach(({ placeholder, content }) => {
        // Process the content: restore any chi placeholders first, then escape the rest
        let processedContent = content;
        
        // Check if content contains chi placeholders and restore them
        chiData.forEach(({ placeholder: chiPlaceholder, content: chiContent }) => {
          if (processedContent.includes(chiPlaceholder)) {
            // Escape the chi content
            const tempDiv = document.createElement('div');
            tempDiv.textContent = chiContent;
            const escapedChiContent = tempDiv.innerHTML;
            // Replace chi placeholder with chi tag
            processedContent = processedContent.replace(new RegExp(chiPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<chi>${escapedChiContent}</chi>`);
          }
        });
        
        // Now escape any remaining HTML entities in the content (but preserve chi tags we just added)
        // We need to escape text parts but not chi tags
        const parts: string[] = [];
        const chiTagRegex = /<chi\b[^>]*>(.*?)<\/chi>/gi;
        let lastIndex = 0;
        let match;
        
        while ((match = chiTagRegex.exec(processedContent)) !== null) {
          // Escape text before chi tag
          const before = processedContent.substring(lastIndex, match.index);
          if (before) {
            const tempDiv = document.createElement('div');
            tempDiv.textContent = before;
            parts.push(tempDiv.innerHTML);
          }
          // Keep chi tag as-is
          parts.push(match[0]);
          lastIndex = chiTagRegex.lastIndex;
        }
        // Escape text after last chi tag
        const after = processedContent.substring(lastIndex);
        if (after) {
          const tempDiv = document.createElement('div');
          tempDiv.textContent = after;
          parts.push(tempDiv.innerHTML);
        }
        
        processedContent = parts.length > 0 ? parts.join('') : (() => {
          // No chi tags, just escape normally
          const tempDiv = document.createElement('div');
          tempDiv.textContent = content;
          return tempDiv.innerHTML;
        })();
        
        // Replace placeholder with chord tag
        sanitized = sanitized!.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<chord>${processedContent}</chord>`);
      });
    }
    
    // Angular's sanitizer will strip out dangerous tags but keep safe formatting tags
    // like <b>, <strong>, <i>, <em>, <br>, <p>, <span> (without attributes)
    // Use bypassSecurityTrustHtml to render the sanitized HTML
    return this.sanitizer.bypassSecurityTrustHtml(sanitized);
  }
}

