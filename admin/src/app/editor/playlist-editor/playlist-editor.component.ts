import { Component, OnInit, OnDestroy, ChangeDetectorRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PlaylistService, Playlist, LibraryItem, PlaylistSearchResult } from "../../playlist.service";
import { UserService } from "../../user.service";
import { ErrorPopupComponent } from "../../shared/error-popup/error-popup.component";
import { ConfirmDialogComponent } from "../../shared/confirm-dialog/confirm-dialog.component";
import { LibraryItemSearchComponent } from "../../shared/library-item-search/library-item-search.component";
import { TranslatePipe } from "../../translation.pipe";
import { LocalizedDatePipe } from "../../localized-date.pipe";
import { TranslationService } from "../../translation.service";
import { debounceTime, distinctUntilChanged, Subject, switchMap, of, forkJoin, Subscription } from "rxjs";
import { InputTextModule } from "primeng/inputtext";

interface PlaylistItemWithDetails {
  guid: number;
  page?: number; // Legacy field for backward compatibility
  pages?: number[]; // Array of pages to use, or undefined for all pages
  description?: string;
  name?: string;
  type?: string;
}

@Component({
  selector: "app-playlist-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, ErrorPopupComponent, ConfirmDialogComponent, LibraryItemSearchComponent, TranslatePipe, LocalizedDatePipe, InputTextModule],
  templateUrl: "./playlist-editor.component.html",
  styleUrls: ["./playlist-editor.component.scss"]
})
export class PlaylistEditorComponent implements OnInit, OnDestroy {
  searchTerm: string = "";
  searchResults: PlaylistSearchResult[] = [];
  showSearchResults: boolean = false;
  private searchSubject = new Subject<string>();
  private localeSubscription?: Subscription;

  // Recently modified playlists
  recentPlaylists: PlaylistSearchResult[] = [];
  showRecentPlaylists: boolean = true;

  editingPlaylist: Playlist | null = null;
  isNewPlaylist: boolean = false;

  // Form fields
  playlistName: string = "";
  playlistDescription: string = "";
  playlistItems: PlaylistItemWithDetails[] = [];

  // Available library items for adding (kept for backward compatibility with getLibraryItemName, etc.)
  availableLibraryItems: LibraryItem[] = [];

  // Error popup
  showError: boolean = false;
  errorMessage: string = "";

  // Confirm dialog
  showConfirmDialog: boolean = false;
  confirmDialogTitle: string = "";
  confirmDialogMessage: string = "";
  playlistToDeleteGuid: number | null = null;

  constructor(
    private playlistService: PlaylistService,
    private userService: UserService,
    private translationService: TranslationService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Load recently modified playlists
    this.loadRecentPlaylists();

    // Load all library items for the dropdown
    this.loadLibraryItems();

    // Subscribe to locale changes to trigger date re-rendering
    this.localeSubscription = this.translationService.currentLocale$.subscribe(() => {
      this.changeDetectorRef.markForCheck();
    });

    // Setup search with debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((searchTerm) => {
        if (searchTerm.trim().length === 0) {
          this.searchResults = [];
          this.showSearchResults = false;
          this.showRecentPlaylists = true;
          return of([]);
        }
        this.showRecentPlaylists = false;
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

  loadRecentPlaylists(): void {
    this.playlistService.getRecentlyModifiedPlaylists().subscribe({
      next: (playlists) => {
        this.recentPlaylists = playlists;
      },
      error: (error) => {
        console.error("Error loading recently modified playlists:", error);
        this.recentPlaylists = [];
      }
    });
  }

  loadLibraryItems(): void {
    // Still load library items for backward compatibility (getLibraryItemName, getLibraryItemType, etc.)
    this.playlistService.getLibraryItems().subscribe({
      next: (items) => {
        this.availableLibraryItems = items;
      },
      error: (error) => {
        console.error("Error loading library items:", error);
      }
    });
  }

  onLibraryItemSelected(item: LibraryItem): void {
    this.addLibraryItemToPlaylist(item);
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onSearchResultSelect(result: PlaylistSearchResult): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.loadPlaylist(result.guid);
  }

  clearSearch(): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.showRecentPlaylists = true;
    this.searchSubject.next("");
  }

  deletePlaylistFromList(playlist: PlaylistSearchResult): void {
    // Show confirmation dialog
    this.playlistToDeleteGuid = playlist.guid;
    this.confirmDialogTitle = "Delete Playlist";
    this.confirmDialogMessage = `Are you sure you want to delete playlist "${playlist.name}"? This action cannot be undone.`;
    this.showConfirmDialog = true;
  }

  onConfirmDelete(): void {
    if (this.playlistToDeleteGuid === null) {
      return;
    }

    const guidToDelete = this.playlistToDeleteGuid;
    
    // Immediately remove from recent playlists array (optimistic update)
    this.recentPlaylists = this.recentPlaylists.filter(p => p.guid !== guidToDelete);
    
    // Immediately remove from search results if present
    this.searchResults = this.searchResults.filter(p => p.guid !== guidToDelete);
    
    this.playlistService.deletePlaylist(guidToDelete).subscribe({
      next: () => {
        console.log("Playlist deleted");
        // Reload recent playlists to ensure consistency
        this.loadRecentPlaylists();
        if (this.editingPlaylist?.guid === guidToDelete) {
          this.cancelEdit();
        }
        this.closeConfirmDialog();
      },
      error: (error) => {
        console.error("Error deleting playlist:", error);
        // Reload on error to restore correct state
        this.loadRecentPlaylists();
        this.showErrorPopup("Error deleting playlist. Please try again.");
        this.closeConfirmDialog();
      }
    });
  }

  closeConfirmDialog(): void {
    this.showConfirmDialog = false;
    this.playlistToDeleteGuid = null;
    this.confirmDialogTitle = "";
    this.confirmDialogMessage = "";
  }

  loadPlaylist(guid: number): void {
    forkJoin([
      this.playlistService.getPlaylistMetadata(guid),
      this.playlistService.getPlaylist(guid)
    ]).subscribe({
      next: ([playlist, items]) => {
        this.editingPlaylist = playlist;
        this.isNewPlaylist = false;
        this.playlistName = playlist.name;
        this.playlistDescription = playlist.description || "";
        
        // Items from getPlaylist already have name, type, and description
        // Use pages selection from playlist metadata (the original selection, not filtered)
        this.playlistItems = items.map(item => {
          // Find corresponding playlist item metadata to get the original pages selection
          const playlistItem = playlist.items.find(pi => pi.guid === item.guid);
          return {
            guid: item.guid,
            page: playlistItem?.page, // Legacy support
            pages: playlistItem?.pages, // Use pages selection from playlist metadata
            description: item.description,
            name: item.name,
            type: item.type
          };
        });
      },
      error: (error) => {
        console.error("Error loading playlist:", error);
        this.showErrorPopup("Error loading playlist. Please try again.");
      }
    });
  }

  addNewPlaylist(): void {
    this.isNewPlaylist = true;
    this.editingPlaylist = null;
    this.playlistName = "";
    this.playlistDescription = "";
    this.playlistItems = [];
  }

  cancelEdit(): void {
    this.editingPlaylist = null;
    this.isNewPlaylist = false;
    this.playlistName = "";
    this.playlistDescription = "";
    this.playlistItems = [];
  }

  addLibraryItemToPlaylist(item?: LibraryItem): void {
    let libraryItem: LibraryItem | undefined;

    if (item) {
      // Called from search component
      libraryItem = item;
    } else {
      // Legacy support (should not be called anymore)
      return;
    }

    if (!libraryItem) {
      this.showErrorPopup("Please select a valid library item");
      return;
    }

    // Allow adding the same library item multiple times
    // For text items, don't set pages by default (meaning all pages will be used)
    // User can optionally select specific pages later
    this.playlistItems.push({
      guid: libraryItem.guid,
      pages: undefined, // undefined means all pages
      name: libraryItem.name,
      type: libraryItem.type,
      description: libraryItem.description
    });
  }

  removeItemFromPlaylist(guid: number): void {
    this.playlistItems = this.playlistItems.filter(item => item.guid !== guid);
  }

  moveItemUp(index: number): void {
    if (index > 0) {
      const item = this.playlistItems[index];
      this.playlistItems.splice(index, 1);
      this.playlistItems.splice(index - 1, 0, item);
    }
  }

  moveItemDown(index: number): void {
    if (index < this.playlistItems.length - 1) {
      const item = this.playlistItems[index];
      this.playlistItems.splice(index, 1);
      this.playlistItems.splice(index + 1, 0, item);
    }
  }

  getLibraryItemName(guid: number): string {
    const libraryItem = this.availableLibraryItems.find(item => item.guid === guid);
    return libraryItem?.name || `Item ${guid}`;
  }

  getLibraryItemType(guid: number): string {
    const libraryItem = this.availableLibraryItems.find(item => item.guid === guid);
    return libraryItem?.type || "unknown";
  }

  getAvailablePages(guid: number): number[] {
    const libraryItem = this.availableLibraryItems.find(item => item.guid === guid);
    if (libraryItem?.type === "text" && Array.isArray(libraryItem.content)) {
      return libraryItem.content.map(page => page.page);
    }
    return [];
  }



  showErrorPopup(message: string): void {
    this.errorMessage = message;
    this.showError = true;
  }

  closeErrorPopup(): void {
    this.showError = false;
    this.errorMessage = "";
  }

  savePlaylist(): void {
    if (!this.playlistName.trim()) {
      this.showErrorPopup("Please enter a name for the playlist");
      return;
    }

    const playlistData: Partial<Playlist> = {
      name: this.playlistName.trim(),
      description: this.playlistDescription.trim() || "",
      items: this.playlistItems.map(item => ({
        guid: item.guid,
        page: item.page, // Legacy support
        pages: item.pages, // Array of pages (undefined means all pages)
        description: item.description
      }))
    };

    if (this.isNewPlaylist) {
      // Create new playlist
      this.playlistService.createPlaylist(playlistData).subscribe({
      next: (newPlaylist) => {
        console.log("Playlist created:", newPlaylist);
        this.loadRecentPlaylists();
        this.cancelEdit();
      },
        error: (error) => {
          console.error("Error creating playlist:", error);
          this.showErrorPopup("Error creating playlist. Please try again.");
        }
      });
    } else if (this.editingPlaylist) {
      // Update existing playlist
      const updatedPlaylist: Playlist = {
        ...this.editingPlaylist,
        ...playlistData
      };

      this.playlistService.updatePlaylist(updatedPlaylist).subscribe({
      next: (result) => {
        console.log("Playlist updated:", result);
        this.loadRecentPlaylists();
        this.cancelEdit();
      },
        error: (error) => {
          console.error("Error updating playlist:", error);
          this.showErrorPopup("Error updating playlist. Please try again.");
        }
      });
    }
  }

  deletePlaylist(): void {
    if (!this.editingPlaylist) {
      return;
    }

    // Show confirmation dialog
    this.playlistToDeleteGuid = this.editingPlaylist.guid;
    this.confirmDialogTitle = "Delete Playlist";
    this.confirmDialogMessage = `Are you sure you want to delete playlist "${this.editingPlaylist.name}"? This action cannot be undone.`;
    this.showConfirmDialog = true;
  }

  hasManagePlaylistsPermission(): boolean {
    return this.userService.hasPermission('ManagePlaylists');
  }

  hasDeletePermission(): boolean {
    return this.hasManagePlaylistsPermission();
  }

  // Multiple pages selection methods
  isPageSelected(item: PlaylistItemWithDetails, pageNum: number): boolean {
    // If pages array exists and has items, check if page is in the array
    if (item.pages && Array.isArray(item.pages) && item.pages.length > 0) {
      return item.pages.includes(pageNum);
    }
    // If pages is undefined/null, all pages are selected
    return false;
  }

  togglePageSelection(item: PlaylistItemWithDetails, pageNum: number): void {
    // Initialize pages array if it doesn't exist
    if (!item.pages || !Array.isArray(item.pages)) {
      item.pages = [];
    }

    // Toggle page selection
    const index = item.pages.indexOf(pageNum);
    if (index > -1) {
      // Remove page from array
      item.pages.splice(index, 1);
      // If array becomes empty, set to undefined to mean "all pages"
      if (item.pages.length === 0) {
        item.pages = undefined;
      }
    } else {
      // Add page to array
      item.pages.push(pageNum);
      // Sort pages array
      item.pages.sort((a, b) => a - b);
    }
  }

  selectAllPages(item: PlaylistItemWithDetails): void {
    const availablePages = this.getAvailablePages(item.guid);
    item.pages = [...availablePages];
  }

  clearPages(item: PlaylistItemWithDetails): void {
    // Setting to undefined means all pages will be used
    item.pages = undefined;
  }

  getSelectedPagesText(item: PlaylistItemWithDetails): string {
    if (!item.pages || !Array.isArray(item.pages) || item.pages.length === 0) {
      return "All pages";
    }
    return item.pages.join(", ");
  }

  ngOnDestroy(): void {
    this.localeSubscription?.unsubscribe();
  }
}
