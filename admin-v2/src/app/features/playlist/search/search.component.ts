import { Component, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PlaylistService, LibraryItem } from "../services/playlist.service";
import { CollectionsService, Collection } from "../../editor/services/collections.service";
import { TagsService, Tag } from "../../editor/services/tags.service";
import { TranslatePipe } from "../../../shared/pipes/translation.pipe";
import { TranslationService } from "../../../core/services/translation.service";
import { ViewportService } from "../../../core/services/viewport.service";
import { RecentItemsService, RecentItem } from "../services/recent-items.service";
import { Observable, Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, of, forkJoin } from "rxjs";
import { InputTextModule } from "primeng/inputtext";
import { SelectModule } from "primeng/select";
import { MultiSelectModule } from "primeng/multiselect";
import { AutoFocusModule } from "primeng/autofocus";

@Component({
  selector: "app-search",
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, InputTextModule, SelectModule, MultiSelectModule, AutoFocusModule],
  templateUrl: "./search.component.html",
  styleUrls: ["./search.component.scss"]
})
export class SearchComponent implements OnInit, OnDestroy, AfterViewInit {
  @Output() itemClick = new EventEmitter<{ item: LibraryItem; page: number }>();
  @ViewChild('searchResultsContainer', { read: ElementRef }) searchResultsElementRef?: ElementRef;
  @ViewChild('searchInputWrapper', { read: ElementRef }) searchInputWrapper?: ElementRef;

  searchTerm: string = "";
  searchResults: LibraryItem[] = [];
  showSearchResults: boolean = false;
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  // Filters
  selectedCollectionGuid: number | null = null;
  selectedTagGuids: number[] = [];
  allCollections: Collection[] = [];
  allTags: Tag[] = [];
  showTagDropdown: boolean = false;
  showAdvancedFilters: boolean = false;
  
  // For PrimeNG MultiSelect
  selectedTags: Tag[] = [];
  
  // For PrimeNG Dropdown
  collectionOptions: Array<{ label: string; value: number | null }> = [];

  recentItems: RecentItem[] = [];

  viewportInfo: any = { availableHeight: 0, keyboardHeight: 0 };
  private viewportSubscription?: Subscription;
  private recentItemsSubscription?: Subscription;

  constructor(
    private playlistService: PlaylistService,
    private collectionsService: CollectionsService,
    private tagsService: TagsService,
    private translationService: TranslationService,
    private viewportService: ViewportService,
    private recentItemsService: RecentItemsService
  ) {}

  get showRecentItems(): boolean {
    return !this.showSearchResults && this.searchTerm.trim().length === 0 && !this.hasActiveFilters() && this.recentItems.length > 0;
  }

  ngOnInit(): void {
    this.recentItemsSubscription = this.recentItemsService.recentItems$.subscribe(items => {
      this.recentItems = items;
    });

    // Subscribe to viewport changes
    this.viewportSubscription = this.viewportService.viewportInfo$.subscribe(info => {
      this.viewportInfo = info;
    });

    // Load collections and tags
    forkJoin({
      collections: this.collectionsService.getAllCollections(),
      tags: this.tagsService.getAllTags()
    }).subscribe({
      next: ({ collections, tags }) => {
        // Sort collections by title (name)
        this.allCollections = collections.sort((a, b) => 
          (a.title || '').localeCompare(b.title || '')
        );
        // Sort tags by name
        this.allTags = tags.sort((a, b) => 
          (a.name || '').localeCompare(b.name || '')
        );
        // Initialize collection options for PrimeNG dropdown with translated "All Collections"
        this.collectionOptions = [
          { label: this.translationService.translate('allCollections'), value: null },
          ...this.allCollections.map(c => {
            let label = c.title;
            if (c.year) {
              label += ` (${c.year})`;
            }
            return { label, value: c.guid };
          })
        ];
        // If filters are already active, trigger initial search
        if (this.hasActiveFilters()) {
          // Use setTimeout to ensure the subscription is set up first
          setTimeout(() => {
            this.triggerSearch();
          }, 0);
        }
      },
      error: (error) => {
        console.error("Error loading collections or tags:", error);
      }
    });

    // Setup search with debounce
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((searchTerm) => {
        if (searchTerm.trim().length === 0 && !this.hasActiveFilters()) {
          this.searchResults = [];
          this.showSearchResults = false;
          return of([]);
        }
        return this.performSearch(searchTerm);
      })
    ).subscribe({
      next: (results) => {
        this.searchResults = results;
        this.showSearchResults = results.length > 0 || this.searchTerm.trim().length > 0 || this.hasActiveFilters();
      },
      error: (error) => {
        console.error("Error searching library items:", error);
        this.searchResults = [];
        this.showSearchResults = false;
      }
    });
  }

  ngAfterViewInit(): void {
    // If filters are active, trigger initial search
    if (this.hasActiveFilters()) {
      setTimeout(() => {
        this.triggerSearch();
      }, 100);
    }
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.viewportSubscription?.unsubscribe();
    this.recentItemsSubscription?.unsubscribe();
  }

  // Removed body append logic - search results are always displayed in component

  hasActiveFilters(): boolean {
    return this.selectedCollectionGuid !== null || (this.selectedTags && this.selectedTags.length > 0);
  }

  performSearch(searchTerm: string): Observable<LibraryItem[]> {
    // If filters are active, we need to filter by collection or tags
    if (this.hasActiveFilters()) {
      // First, get items from collection or get all items for tag filtering
      if (this.selectedCollectionGuid !== null) {
        // Filter by collection - get items from collection first
        return this.collectionsService.getCollectionItems(this.selectedCollectionGuid).pipe(
          switchMap((collectionItems) => {
            const itemGuidsInCollection = new Set(collectionItems.map(item => item.guid));
            
            // If search term is provided, search and filter by collection
            if (searchTerm.trim().length > 0) {
              return this.playlistService.searchLibraryItems(searchTerm).pipe(
                switchMap((searchResults) => {
                  // Filter search results to only include items in the collection
                  const filtered = searchResults.filter(item => itemGuidsInCollection.has(item.guid));
                  
                  // Also filter by tags if selected
                  if (this.selectedTagGuids.length > 0) {
                    return this.filterByTags(of(filtered));
                  }
                  return of(filtered);
                })
              );
            } else {
              // No search term - get all items from collection
              const itemGuids = Array.from(itemGuidsInCollection);
              if (itemGuids.length === 0) {
                return of([]);
              }
              return forkJoin(
                itemGuids.map(guid => 
                  this.playlistService.getLibraryItemByGuid(guid).pipe(
                    switchMap(item => item ? of(item) : of(null))
                  )
                )
              ).pipe(
                switchMap((items) => {
                  const validItems = items.filter(item => item !== null) as LibraryItem[];
                  // Filter by tags if selected
                  if (this.selectedTagGuids.length > 0) {
                    return this.filterByTags(of(validItems));
                  }
                  return of(validItems);
                })
              );
            }
          })
        );
      } else if ((this.selectedTags && this.selectedTags.length > 0) || this.selectedTagGuids.length > 0) {
        // Sync selectedTagGuids if needed
        if (this.selectedTags && this.selectedTags.length > 0 && this.selectedTagGuids.length !== this.selectedTags.length) {
          this.selectedTagGuids = this.selectedTags.map(tag => tag.guid);
        }
        
        // Filter by tags only
        // We need to search all items and filter by tags
        const searchObservable = searchTerm.trim().length > 0 
          ? this.playlistService.searchLibraryItems(searchTerm)
          : this.playlistService.getLibraryItems();
        
        return searchObservable.pipe(
          switchMap((results) => this.filterByTags(of(results)))
        );
      }
    }

    // No filters - just search
    if (searchTerm.trim().length === 0) {
      return of([]);
    }
    return this.playlistService.searchLibraryItems(searchTerm);
  }


  private filterByTags(itemsObservable: Observable<LibraryItem[]>): Observable<LibraryItem[]> {
    return itemsObservable.pipe(
      switchMap((items) => {
        // Filter items that have ALL selected tags
        const filtered = items.filter(item => {
          if (!item.tags || !Array.isArray(item.tags)) {
            return false;
          }
          const itemTagGuids = item.tags.map((t: { guid: number }) => t.guid);
          return this.selectedTagGuids.every(tagGuid => itemTagGuids.includes(tagGuid));
        });
        return of(filtered);
      })
    );
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onCollectionChange(): void {
    // Trigger search when collection changes - even if search term is empty
    // Use a special marker to force search when filters change
    this.triggerSearch();
  }

  onTagsChange(): void {
    // Sync selectedTagGuids from selectedTags (PrimeNG MultiSelect)
    if (this.selectedTags && this.selectedTags.length > 0) {
      this.selectedTagGuids = this.selectedTags.map(tag => tag.guid);
    } else {
      this.selectedTagGuids = [];
    }
    // Trigger search when tags change - even if search term is empty
    this.triggerSearch();
  }

  private triggerSearch(): void {
    // Trigger search immediately when filters change, even if search term is empty
    // This ensures search is called when collection or tags change
    if (this.hasActiveFilters() || this.searchTerm.trim().length > 0) {
      this.performSearch(this.searchTerm).subscribe({
        next: (results) => {
          this.searchResults = results;
          this.showSearchResults = results.length > 0 || this.searchTerm.trim().length > 0 || this.hasActiveFilters();
        },
        error: (error) => {
          console.error("Error searching library items:", error);
          this.searchResults = [];
          this.showSearchResults = false;
        }
      });
    } else {
      // No filters and no search term - clear results
      this.searchResults = [];
      this.showSearchResults = false;
    }
  }

  toggleTagSelection(tagGuid: number): void {
    const index = this.selectedTagGuids.indexOf(tagGuid);
    if (index > -1) {
      this.selectedTagGuids.splice(index, 1);
    } else {
      this.selectedTagGuids.push(tagGuid);
    }
    // Trigger search when tags change
    this.triggerSearch();
  }

  isTagSelected(tagGuid: number): boolean {
    return this.selectedTagGuids.includes(tagGuid);
  }

  clearFilters(): void {
    this.selectedCollectionGuid = null;
    this.selectedTagGuids = [];
    this.selectedTags = [];
    this.searchTerm = "";
    this.searchResults = [];
    this.showSearchResults = false;
    this.searchSubject.next("");
  }

  clearSearch(): void {
    this.searchTerm = "";
    if (!this.hasActiveFilters()) {
      this.searchResults = [];
      this.showSearchResults = false;
    }
    this.searchSubject.next("");
  }

  onSearchResultSelect(item: LibraryItem): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.recentItemsService.addItem(item);
    this.playlistService.getLibraryItemByGuid(item.guid).subscribe({
      next: (fullItem) => {
        if (fullItem) {
          this.itemClick.emit({ item: fullItem, page: 1 });
        } else {
          this.itemClick.emit({ item: item, page: 1 });
        }
      },
      error: (error) => {
        console.error("Error loading full library item:", error);
        this.itemClick.emit({ item: item, page: 1 });
      }
    });
  }

  onRecentItemSelect(recentItem: RecentItem): void {
    this.recentItemsService.addItem(recentItem);
    this.playlistService.getLibraryItemByGuid(recentItem.guid).subscribe({
      next: (fullItem) => {
        if (fullItem) {
          this.itemClick.emit({ item: fullItem, page: 1 });
        } else {
          this.itemClick.emit({ item: { guid: recentItem.guid, name: recentItem.name, type: recentItem.type as any }, page: 1 });
        }
      },
      error: (error) => {
        console.error("Error loading library item:", error);
        this.itemClick.emit({ item: { guid: recentItem.guid, name: recentItem.name, type: recentItem.type as any }, page: 1 });
      }
    });
  }

  getSelectedTagsDisplay(): string {
    if (this.selectedTagGuids.length === 0) {
      return "";
    }
    const selectedTags = this.allTags.filter(t => this.selectedTagGuids.includes(t.guid));
    return selectedTags.map(t => t.name).join(", ");
  }

  toggleTagDropdown(): void {
    this.showTagDropdown = !this.showTagDropdown;
  }

  closeTagDropdown(): void {
    this.showTagDropdown = false;
  }

  onSearchInputFocus(): void {
    // Scroll input into view when keyboard appears
    setTimeout(() => {
      if (this.searchInputWrapper?.nativeElement) {
        this.searchInputWrapper.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  }

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }

  getActiveFiltersCount(): number {
    let count = 0;
    if (this.selectedCollectionGuid !== null) count++;
    if (this.selectedTagGuids && this.selectedTagGuids.length > 0) count += this.selectedTagGuids.length;
    return count;
  }
}

