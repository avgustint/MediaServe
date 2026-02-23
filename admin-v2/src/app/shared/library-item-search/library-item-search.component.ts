import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, Renderer2, ViewContainerRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PlaylistService, LibraryItem } from "../../features/playlist/services/playlist.service";
import { TranslatePipe } from "../pipes/translation.pipe";
import { TranslationService } from "../../core/services/translation.service";
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, of } from "rxjs";
import { InputTextModule } from "primeng/inputtext";

@Component({
  selector: "app-library-item-search",
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, InputTextModule],
  templateUrl: "./library-item-search.component.html",
  styleUrls: ["./library-item-search.component.scss"]
})
export class LibraryItemSearchComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() placeholder: string = "Search library items...";
  @Input() excludeGuids: number[] = []; // GUIDs to exclude from results (e.g., already in playlist)
  @Input() autoFocus: boolean = false; // Auto-focus the input when component is shown
  @Output() itemSelected = new EventEmitter<LibraryItem>();
  @ViewChild('searchInputWrapper', { read: ElementRef }) searchInputWrapper!: ElementRef;
  @ViewChild('searchInput', { read: ElementRef }) searchInput!: ElementRef;

  searchTerm: string = "";
  searchResults: LibraryItem[] = [];
  showSearchResults: boolean = false;
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private dropdownElement: HTMLElement | null = null;
  private positionUpdateInterval?: any;
  private clickOutsideListener?: () => void;

  constructor(
    private playlistService: PlaylistService,
    private renderer: Renderer2,
    private elementRef: ElementRef,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    // Setup search with debounce
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((searchTerm) => {
        if (searchTerm.trim().length === 0) {
          this.searchResults = [];
          this.showSearchResults = false;
          this.removeDropdown();
          return of([]);
        }
        return this.playlistService.searchLibraryItems(searchTerm);
      })
    ).subscribe({
      next: (results) => {
        // Filter out excluded GUIDs
        this.searchResults = results.filter(item => !this.excludeGuids.includes(item.guid));
        this.showSearchResults = this.searchResults.length > 0 || this.searchTerm.trim().length > 0;
        if (this.showSearchResults) {
          setTimeout(() => this.createOrUpdateDropdown(), 0);
        } else {
          this.removeDropdown();
        }
      },
      error: (error) => {
        console.error("Error searching library items:", error);
        this.searchResults = [];
        this.showSearchResults = false;
        this.removeDropdown();
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.autoFocus && this.searchInput) {
      // Use setTimeout to ensure the input is rendered
      setTimeout(() => {
        this.focusInput();
      }, 0);
    }
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.removeDropdown();
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
    }
    if (this.clickOutsideListener) {
      this.clickOutsideListener();
    }
  }

  focusInput(): void {
    if (this.searchInput && this.searchInput.nativeElement) {
      this.searchInput.nativeElement.focus();
    }
  }

  private createOrUpdateDropdown(): void {
    if (!this.searchInputWrapper) {
      return;
    }

    const inputElement = this.searchInputWrapper.nativeElement;
    const rect = inputElement.getBoundingClientRect();

    if (!this.dropdownElement) {
      // Create dropdown element
      this.dropdownElement = this.renderer.createElement('div');
      this.renderer.addClass(this.dropdownElement, 'search-results-dropdown');
      this.renderer.setStyle(this.dropdownElement, 'position', 'fixed');
      this.renderer.setStyle(this.dropdownElement, 'z-index', '10000');
      this.renderer.setStyle(this.dropdownElement, 'background-color', '#fff');
      this.renderer.setStyle(this.dropdownElement, 'border', '1px solid #ddd');
      this.renderer.setStyle(this.dropdownElement, 'border-radius', '0 0 4px 4px');
      this.renderer.setStyle(this.dropdownElement, 'box-shadow', '0 2px 8px rgba(0, 0, 0, 0.1)');
      this.renderer.setStyle(this.dropdownElement, 'max-height', '300px');
      this.renderer.setStyle(this.dropdownElement, 'overflow-y', 'auto');
      this.renderer.appendChild(document.body, this.dropdownElement);
    }

    // Update position
    this.updateDropdownPosition();

    // Update content
    this.updateDropdownContent();

    // Update position on scroll/resize
    if (!this.positionUpdateInterval) {
      this.positionUpdateInterval = setInterval(() => {
        if (this.dropdownElement && this.showSearchResults) {
          this.updateDropdownPosition();
        }
      }, 100);
    }

    // Add click outside listener
    if (!this.clickOutsideListener) {
      this.clickOutsideListener = this.renderer.listen('document', 'click', (event: MouseEvent) => {
        if (this.dropdownElement && this.showSearchResults) {
          const target = event.target as HTMLElement;
          if (!this.elementRef.nativeElement.contains(target) && !this.dropdownElement.contains(target)) {
            this.clearSearch();
          }
        }
      });
    }
  }

  private updateDropdownPosition(): void {
    if (!this.dropdownElement || !this.searchInputWrapper) {
      return;
    }

    const inputElement = this.searchInputWrapper.nativeElement;
    const rect = inputElement.getBoundingClientRect();

    this.renderer.setStyle(this.dropdownElement, 'top', `${rect.bottom}px`);
    this.renderer.setStyle(this.dropdownElement, 'left', `${rect.left}px`);
    this.renderer.setStyle(this.dropdownElement, 'width', `${rect.width}px`);
  }

  private updateDropdownContent(): void {
    if (!this.dropdownElement) {
      return;
    }

    // Clear existing content
    this.dropdownElement.innerHTML = '';

    if (this.searchResults.length === 0 && this.searchTerm.trim().length > 0) {
      const noResults = this.renderer.createElement('div');
      this.renderer.addClass(noResults, 'no-results');
      this.renderer.setProperty(noResults, 'textContent', this.translationService.translate('noLibraryItemsFound'));
      this.renderer.appendChild(this.dropdownElement, noResults);
    } else {
      this.searchResults.forEach(result => {
        const item = this.renderer.createElement('div');
        this.renderer.addClass(item, 'search-result-item');
        this.renderer.setStyle(item, 'padding', '0.75rem');
        this.renderer.setStyle(item, 'cursor', 'pointer');
        this.renderer.setStyle(item, 'border-bottom', '1px solid #f0f0f0');
        this.renderer.setStyle(item, 'transition', 'background-color 0.2s');
        this.renderer.listen(item, 'mouseenter', () => {
          this.renderer.setStyle(item, 'background-color', '#f8f9fa');
        });
        this.renderer.listen(item, 'mouseleave', () => {
          this.renderer.setStyle(item, 'background-color', 'transparent');
        });
        this.renderer.listen(item, 'click', () => this.onSearchResultSelect(result));

        const name = this.renderer.createElement('div');
        this.renderer.addClass(name, 'search-result-name');
        this.renderer.setProperty(name, 'textContent', result.name);
        this.renderer.appendChild(item, name);

        if (result.description) {
          const desc = this.renderer.createElement('div');
          this.renderer.addClass(desc, 'search-result-description');
          this.renderer.setStyle(desc, 'font-size', '0.85rem');
          this.renderer.setStyle(desc, 'color', '#666');
          this.renderer.setProperty(desc, 'textContent', result.description);
          this.renderer.appendChild(item, desc);
        }

        const footer = this.renderer.createElement('div');
        this.renderer.addClass(footer, 'search-result-footer');
        this.renderer.setStyle(footer, 'display', 'flex');
        this.renderer.setStyle(footer, 'justify-content', 'space-between');
        this.renderer.setStyle(footer, 'align-items', 'center');
        this.renderer.setStyle(footer, 'margin-top', '0.5rem');

        const type = this.renderer.createElement('div');
        this.renderer.addClass(type, 'search-result-type');
        this.renderer.setStyle(type, 'font-size', '0.75rem');
        this.renderer.setStyle(type, 'color', '#999');
        this.renderer.setProperty(type, 'textContent', `${this.translationService.translate('typeColon')} ${result.type}`);
        this.renderer.appendChild(footer, type);

        const guid = this.renderer.createElement('div');
        this.renderer.addClass(guid, 'item-guid-badge');
        this.renderer.setStyle(guid, 'background-color', '#007bff');
        this.renderer.setStyle(guid, 'color', 'white');
        this.renderer.setStyle(guid, 'padding', '0.25rem 0.5rem');
        this.renderer.setStyle(guid, 'border-radius', '4px');
        this.renderer.setStyle(guid, 'font-size', '0.75rem');
        this.renderer.setStyle(guid, 'font-weight', 'bold');
        this.renderer.setProperty(guid, 'textContent', result.guid.toString());
        this.renderer.appendChild(footer, guid);

        this.renderer.appendChild(item, footer);
        this.renderer.appendChild(this.dropdownElement, item);
      });
    }
  }

  private removeDropdown(): void {
    if (this.dropdownElement) {
      this.renderer.removeChild(document.body, this.dropdownElement);
      this.dropdownElement = null;
    }
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = undefined;
    }
    if (this.clickOutsideListener) {
      this.clickOutsideListener();
      this.clickOutsideListener = undefined;
    }
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onSearchResultSelect(item: LibraryItem): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.removeDropdown();
    // Search results exclude content for performance - fetch full item when needed
    this.playlistService.getLibraryItemByGuid(item.guid).subscribe({
      next: (fullItem) => {
        this.itemSelected.emit(fullItem ?? item);
      },
      error: () => {
        this.itemSelected.emit(item);
      }
    });
  }

  clearSearch(): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.removeDropdown();
    this.searchSubject.next("");
  }
}

