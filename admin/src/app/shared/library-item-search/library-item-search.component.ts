import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PlaylistService, LibraryItem } from "../../playlist.service";
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, of } from "rxjs";

@Component({
  selector: "app-library-item-search",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./library-item-search.component.html",
  styleUrls: ["./library-item-search.component.scss"]
})
export class LibraryItemSearchComponent implements OnInit, OnDestroy {
  @Input() placeholder: string = "Search library items...";
  @Input() excludeGuids: number[] = []; // GUIDs to exclude from results (e.g., already in playlist)
  @Output() itemSelected = new EventEmitter<LibraryItem>();

  searchTerm: string = "";
  searchResults: LibraryItem[] = [];
  showSearchResults: boolean = false;
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  constructor(private playlistService: PlaylistService) {}

  ngOnInit(): void {
    // Setup search with debounce
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((searchTerm) => {
        if (searchTerm.trim().length === 0) {
          this.searchResults = [];
          this.showSearchResults = false;
          return of([]);
        }
        return this.playlistService.searchLibraryItems(searchTerm);
      })
    ).subscribe({
      next: (results) => {
        // Filter out excluded GUIDs
        this.searchResults = results.filter(item => !this.excludeGuids.includes(item.guid));
        this.showSearchResults = this.searchResults.length > 0 || this.searchTerm.trim().length > 0;
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

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onSearchResultSelect(item: LibraryItem): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.itemSelected.emit(item);
  }

  clearSearch(): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.searchSubject.next("");
  }
}

