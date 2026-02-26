import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, AfterViewChecked } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PlaylistService, Playlist, LibraryItem, PlaylistSearchResult } from "../../playlist/services/playlist.service";
import { UserService } from "../../../core/services/user.service";
import { ErrorPopupComponent } from "../../../shared/feedback/error-popup/error-popup.component";
import { ConfirmDialogComponent } from "../../../shared/feedback/confirm-dialog/confirm-dialog.component";
import { SearchComponent } from "../../playlist/search/search.component";
import { ToastComponent } from "../../../shared/feedback/toast/toast.component";
import { TranslatePipe } from "../../../shared/pipes/translation.pipe";
import { LocalizedDatePipe } from "../../../shared/pipes/localized-date.pipe";
import { TranslationService } from "../../../core/services/translation.service";
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
  imports: [CommonModule, FormsModule, ErrorPopupComponent, ConfirmDialogComponent, SearchComponent, ToastComponent, TranslatePipe, LocalizedDatePipe, InputTextModule],
  templateUrl: "./playlist-editor.component.html",
  styleUrls: ["./playlist-editor.component.scss"]
})
export class PlaylistEditorComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('libraryItemSearch') libraryItemSearchComponent?: SearchComponent;
  
  searchTerm: string = "";
  searchResults: PlaylistSearchResult[] = [];
  showSearchResults: boolean = false;
  private searchSubject = new Subject<string>();
  private localeSubscription?: Subscription;

  // Recently modified playlists
  recentPlaylists: PlaylistSearchResult[] = [];
  showRecentPlaylists: boolean = true;

  editingPlaylist: Playlist | null = null;
  viewingPlaylist: Playlist | null = null;
  isNewPlaylist: boolean = false;
  loadingPlaylist: boolean = false;

  // Form fields
  playlistName: string = "";
  playlistDescription: string = "";
  playlistItems: PlaylistItemWithDetails[] = [];

  // Available library items for adding (kept for backward compatibility with getLibraryItemName, etc.)
  availableLibraryItems: LibraryItem[] = [];

  // Error popup
  showError: boolean = false;
  errorMessage: string = "";

  // Toast notification
  showToast: boolean = false;
  toastMessage: string = "";
  toastType: 'success' | 'error' | 'info' | 'warning' = 'success';

  // Confirm dialog
  showConfirmDialog: boolean = false;
  confirmDialogTitle: string = "";
  confirmDialogMessage: string = "";
  playlistToDeleteGuid: number | null = null;
  itemToRemoveGuid: number | null = null;

  // Add item modal
  showAddItemModal: boolean = false;

  // Edit pages modal
  showEditPagesModal: boolean = false;
  editingPagesItem: PlaylistItemWithDetails | null = null;

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
        if (this.editingPlaylist?.guid === guidToDelete || this.viewingPlaylist?.guid === guidToDelete) {
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
    this.itemToRemoveGuid = null;
    this.confirmDialogTitle = "";
    this.confirmDialogMessage = "";
  }

  onConfirmDialogAction(): void {
    if (this.itemToRemoveGuid !== null) {
      this.onConfirmRemoveItem();
    } else if (this.playlistToDeleteGuid !== null) {
      this.onConfirmDelete();
    }
  }

  loadPlaylist(guid: number): void {
    this.loadingPlaylist = true;
    forkJoin([
      this.playlistService.getPlaylistMetadata(guid),
      this.playlistService.getPlaylist(guid)
    ]).subscribe({
      next: ([playlist, items]) => {
        this.viewingPlaylist = playlist;
        this.editingPlaylist = null;
        this.isNewPlaylist = false;
        
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
        this.loadingPlaylist = false;
      },
      error: (error) => {
        console.error("Error loading playlist:", error);
        this.showErrorPopup(this.translationService.translate('errorLoadingData'));
        this.loadingPlaylist = false;
      }
    });
  }

  viewPlaylistDetails(playlist: PlaylistSearchResult): void {
    this.loadPlaylist(playlist.guid);
  }

  editPlaylistDetails(): void {
    if (this.viewingPlaylist) {
      this.isNewPlaylist = false;
      this.editingPlaylist = { ...this.viewingPlaylist };
      this.playlistName = this.viewingPlaylist.name;
      this.playlistDescription = this.viewingPlaylist.description || "";
      this.viewingPlaylist = null;
    }
  }

  backToPlaylistList(): void {
    this.viewingPlaylist = null;
    this.editingPlaylist = null;
    this.playlistItems = [];
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
    this.viewingPlaylist = null;
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
      this.showErrorPopup(this.translationService.translate('pleaseSelectValidLibraryItem'));
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

  openAddItemModal(): void {
    this.showAddItemModal = true;
    // Note: SearchComponent doesn't have focusInput method, so we skip auto-focus
  }

  closeAddItemModal(): void {
    this.showAddItemModal = false;
  }

  onLibraryItemSelected(event: { item: LibraryItem; page: number }): void {
    const item = event.item;
    if (this.editingPlaylist || this.isNewPlaylist) {
      // In edit mode, add directly to the list
      this.addLibraryItemToPlaylist(item);
      this.closeAddItemModal();
    } else if (this.viewingPlaylist) {
      // In view mode, add to playlist via API
      this.addLibraryItemToPlaylist(item);
      // Save the playlist
      const playlistData: Playlist = {
        guid: this.viewingPlaylist.guid,
        name: this.viewingPlaylist.name,
        description: this.viewingPlaylist.description || "",
        items: this.playlistItems.map(item => ({
          guid: item.guid,
          page: item.page,
          pages: item.pages,
          description: item.description
        }))
      };

      this.playlistService.updatePlaylist(playlistData).subscribe({
        next: () => {
          this.showSuccessToast(this.translationService.translate('libraryItemAdded'));
          this.loadPlaylist(this.viewingPlaylist!.guid);
          this.closeAddItemModal();
        },
        error: (error) => {
          console.error("Error adding item to playlist:", error);
          this.showErrorPopup(this.translationService.translate('errorDeletingItem'));
          // Revert the addition
          this.playlistItems = this.playlistItems.filter(i => i.guid !== item.guid);
        }
      });
    }
  }

  removeItemFromPlaylistView(item: PlaylistItemWithDetails): void {
    this.itemToRemoveGuid = item.guid;
    this.confirmDialogTitle = this.translationService.translate('remove');
    this.confirmDialogMessage = `${this.translationService.translate('remove')} "${item.name || this.getLibraryItemName(item.guid)}" ${this.translationService.translate('fromPlaylist')}?`;
    this.showConfirmDialog = true;
  }

  onConfirmRemoveItem(): void {
    if (this.itemToRemoveGuid !== null && this.viewingPlaylist) {
      // Remove from local list
      this.playlistItems = this.playlistItems.filter(item => item.guid !== this.itemToRemoveGuid);
      
      // Update playlist on server
      const playlistData: Playlist = {
        guid: this.viewingPlaylist.guid,
        name: this.viewingPlaylist.name,
        description: this.viewingPlaylist.description || "",
        items: this.playlistItems.map(item => ({
          guid: item.guid,
          page: item.page,
          pages: item.pages,
          description: item.description
        }))
      };

      this.playlistService.updatePlaylist(playlistData).subscribe({
        next: () => {
          this.showSuccessToast(this.translationService.translate('playlistSaved'));
          this.loadPlaylist(this.viewingPlaylist!.guid);
          this.closeConfirmDialog();
        },
        error: (error) => {
          console.error("Error removing item from playlist:", error);
          this.showErrorPopup(this.translationService.translate('errorDeletingItem'));
          this.closeConfirmDialog();
        }
      });
    }
  }

  getExcludedGuids(): number[] {
    return this.playlistItems.map(item => item.guid);
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

  // Methods for detail view (with auto-save)
  moveItemUpInDetailView(index: number): void {
    if (index > 0 && this.viewingPlaylist) {
      this.moveItemUp(index);
      this.savePlaylistOrder();
    }
  }

  moveItemDownInDetailView(index: number): void {
    if (index < this.playlistItems.length - 1 && this.viewingPlaylist) {
      this.moveItemDown(index);
      this.savePlaylistOrder();
    }
  }

  openEditPagesModal(item: PlaylistItemWithDetails): void {
    if (!this.hasManagePlaylistsPermission()) {
      return;
    }
    // Create a copy of the item to edit
    this.editingPagesItem = {
      ...item,
      pages: item.pages ? [...item.pages] : undefined
    };
    this.showEditPagesModal = true;
  }

  closeEditPagesModal(): void {
    this.showEditPagesModal = false;
    this.editingPagesItem = null;
  }

  savePagesForItem(): void {
    if (!this.editingPagesItem || !this.viewingPlaylist) {
      return;
    }

    // Find the item in playlistItems and update it
    const itemIndex = this.playlistItems.findIndex(item => item.guid === this.editingPagesItem!.guid);
    if (itemIndex !== -1) {
      this.playlistItems[itemIndex].pages = this.editingPagesItem.pages;
      this.savePlaylistItems();
    }

    this.closeEditPagesModal();
  }

  savePlaylistOrder(): void {
    if (!this.viewingPlaylist) {
      return;
    }

    const playlistData: Playlist = {
      ...this.viewingPlaylist,
      items: this.playlistItems.map(item => ({
        guid: item.guid,
        page: item.page,
        pages: item.pages,
        description: item.description
      }))
    };

    this.playlistService.updatePlaylist(playlistData).subscribe({
      next: () => {
        this.showSuccessToast(this.translationService.translate('playlistSaved'));
        this.loadPlaylist(this.viewingPlaylist!.guid);
      },
      error: (error) => {
        console.error("Error saving playlist order:", error);
        this.showErrorToast(this.translationService.translate('errorSavingPlaylist'));
      }
    });
  }

  savePlaylistItems(): void {
    if (!this.viewingPlaylist) {
      return;
    }

    const playlistData: Playlist = {
      ...this.viewingPlaylist,
      items: this.playlistItems.map(item => ({
        guid: item.guid,
        page: item.page,
        pages: item.pages,
        description: item.description
      }))
    };

    this.playlistService.updatePlaylist(playlistData).subscribe({
      next: () => {
        this.showSuccessToast(this.translationService.translate('playlistSaved'));
        this.loadPlaylist(this.viewingPlaylist!.guid);
      },
      error: (error) => {
        console.error("Error saving playlist items:", error);
        this.showErrorToast(this.translationService.translate('errorSavingPlaylist'));
      }
    });
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

  showSuccessToast(message: string): void {
    this.toastMessage = message;
    this.toastType = 'success';
    this.showToast = true;
  }

  showErrorToast(message: string): void {
    this.toastMessage = message;
    this.toastType = 'error';
    this.showToast = true;
  }

  closeToast(): void {
    this.showToast = false;
    this.toastMessage = "";
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

  ngAfterViewChecked(): void {
  }

  ngOnDestroy(): void {
    this.localeSubscription?.unsubscribe();
  }
}
