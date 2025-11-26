import { Component, Output, EventEmitter, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PlaylistService, LibraryItem } from "../../playlist.service";
import { CollectionsService, Collection } from "../../collections.service";
import { TagsService, Tag } from "../../tags.service";
import { TranslatePipe } from "../../translation.pipe";
import { TranslationService } from "../../translation.service";
import { Observable, Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, of, forkJoin } from "rxjs";
import { InputTextModule } from "primeng/inputtext";
import { SelectModule } from "primeng/select";
import { MultiSelectModule } from "primeng/multiselect";

@Component({
  selector: "app-search",
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, InputTextModule, SelectModule, MultiSelectModule],
  templateUrl: "./search.component.html",
  styleUrls: ["./search.component.scss"]
})
export class SearchComponent implements OnInit, OnDestroy {
  @Output() itemClick = new EventEmitter<{ item: LibraryItem; page: number }>();

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
  
  // For PrimeNG MultiSelect
  selectedTags: Tag[] = [];
  
  // For PrimeNG Dropdown
  collectionOptions: Array<{ label: string; value: number | null }> = [];

  constructor(
    private playlistService: PlaylistService,
    private collectionsService: CollectionsService,
    private tagsService: TagsService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    // Load collections and tags
    forkJoin({
      collections: this.collectionsService.getAllCollections(),
      tags: this.tagsService.getAllTags()
    }).subscribe({
      next: ({ collections, tags }) => {
        this.allCollections = collections;
        this.allTags = tags;
        // Initialize collection options for PrimeNG dropdown with translated "All Collections"
        this.collectionOptions = [
          { label: this.translationService.translate('allCollections'), value: null },
          ...collections.map(c => ({ label: c.title, value: c.guid }))
        ];
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

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

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
    // Trigger search when collection changes
    this.searchSubject.next(this.searchTerm);
  }

  onTagsChange(): void {
    // Sync selectedTagGuids from selectedTags (PrimeNG MultiSelect)
    if (this.selectedTags && this.selectedTags.length > 0) {
      this.selectedTagGuids = this.selectedTags.map(tag => tag.guid);
    } else {
      this.selectedTagGuids = [];
    }
    // Trigger search when tags change
    this.searchSubject.next(this.searchTerm);
  }

  toggleTagSelection(tagGuid: number): void {
    const index = this.selectedTagGuids.indexOf(tagGuid);
    if (index > -1) {
      this.selectedTagGuids.splice(index, 1);
    } else {
      this.selectedTagGuids.push(tagGuid);
    }
    // Trigger search when tags change
    this.searchSubject.next(this.searchTerm);
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
    this.itemClick.emit({ item: item, page: 1 });
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
}

