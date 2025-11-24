import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Output, EventEmitter, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PlaylistService, LibraryItem, PlaylistSearchResult, Playlist } from "../../playlist.service";
import { PlaylistItemComponent } from "../playlist-item/playlist-item.component";
import { TranslatePipe } from "../../translation.pipe";
import { Subscription, debounceTime, distinctUntilChanged, Subject, switchMap, of, forkJoin } from "rxjs";

@Component({
  selector: "app-playlist-list",
  standalone: true,
  imports: [CommonModule, PlaylistItemComponent, FormsModule, TranslatePipe],
  templateUrl: "./playlist-list.component.html",
  styleUrls: ["./playlist-list.component.scss"]
})
export class PlaylistListComponent implements OnInit, OnDestroy, OnChanges {
  @Input() selectedPlaylistGuid?: number;
  @Output() playlistItemClick = new EventEmitter<LibraryItem>();
  @Output() playlistItemPageClick = new EventEmitter<{ item: LibraryItem; page: number }>();
  @Output() clearClick = new EventEmitter<void>();
  @Output() playlistSelected = new EventEmitter<number>();
  @Output() playlistItemsLoaded = new EventEmitter<LibraryItem[]>();

  playlist: LibraryItem[] = [];
  currentPlaylist: Playlist | null = null;
  searchTerm: string = "";
  searchResults: PlaylistSearchResult[] = [];
  showSearchResults: boolean = false;
  private searchSubscription?: Subscription;
  private searchSubject = new Subject<string>();

  constructor(private playlistService: PlaylistService) {}

  ngOnInit(): void {
    // Load playlist if guid is provided, otherwise load default
    if (this.selectedPlaylistGuid) {
      this.loadPlaylist(this.selectedPlaylistGuid);
    } else {
      this.loadPlaylist();
    }

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
        return this.playlistService.searchPlaylists(searchTerm);
      })
    ).subscribe({
      next: (results) => {
        this.searchResults = results;
        this.showSearchResults = results.length > 0 || this.searchTerm.trim().length > 0;
      },
      error: (error) => {
        console.error("Error searching playlists:", error);
        this.searchResults = [];
        this.showSearchResults = false;
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reload playlist if selectedPlaylistGuid changes
    if (changes['selectedPlaylistGuid'] && !changes['selectedPlaylistGuid'].firstChange) {
      if (this.selectedPlaylistGuid) {
        this.loadPlaylist(this.selectedPlaylistGuid);
      } else {
        this.loadPlaylist();
      }
    }
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  loadPlaylist(guid?: number, emitSelection: boolean = false): void {
    // Clear current playlist while loading
    this.currentPlaylist = null;
    
    // Load both playlist items and metadata
    forkJoin([
      this.playlistService.getPlaylist(guid),
      this.playlistService.getPlaylistMetadata(guid)
    ]).subscribe({
      next: ([items, metadata]) => {
        this.playlist = items;
        this.currentPlaylist = metadata;
        this.playlistItemsLoaded.emit(items);
        if (guid && emitSelection) {
          this.playlistSelected.emit(guid);
        }
      },
      error: (error) => {
        console.error("Error loading playlist:", error);
        this.currentPlaylist = null;
      }
    });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onSearchResultSelect(result: PlaylistSearchResult): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.loadPlaylist(result.guid, true);
  }

  clearSearch(): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.searchSubject.next("");
  }

  onPlaylistItemClick(item: LibraryItem): void {
    this.playlistItemClick.emit(item);
  }

  onPlaylistItemPageClick(event: { item: LibraryItem; page: number }): void {
    this.playlistItemPageClick.emit(event);
  }

  onClearClick(): void {
    this.clearClick.emit();
  }
}

