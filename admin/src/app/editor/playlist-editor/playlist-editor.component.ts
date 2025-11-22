import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PlaylistService, Playlist, LibraryItem, PlaylistSearchResult } from "../../playlist.service";
import { UserService } from "../../user.service";
import { ErrorPopupComponent } from "../../shared/error-popup/error-popup.component";
import { debounceTime, distinctUntilChanged, Subject, switchMap, of, forkJoin } from "rxjs";

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
  imports: [CommonModule, FormsModule, ErrorPopupComponent],
  templateUrl: "./playlist-editor.component.html",
  styleUrls: ["./playlist-editor.component.scss"]
})
export class PlaylistEditorComponent implements OnInit {
  searchTerm: string = "";
  searchResults: PlaylistSearchResult[] = [];
  showSearchResults: boolean = false;
  private searchSubject = new Subject<string>();

  editingPlaylist: Playlist | null = null;
  isNewPlaylist: boolean = false;

  // Form fields
  playlistName: string = "";
  playlistDescription: string = "";
  playlistItems: PlaylistItemWithDetails[] = [];

  // Available library items for adding
  availableLibraryItems: LibraryItem[] = [];
  showAddItemDropdown: boolean = false;
  selectedLibraryItemGuid: number | null = null;

  // Error popup
  showError: boolean = false;
  errorMessage: string = "";

  constructor(
    private playlistService: PlaylistService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    // Load all library items for the dropdown
    this.loadLibraryItems();

    // Setup search with debounce
    this.searchSubject.pipe(
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

  loadLibraryItems(): void {
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
    this.searchSubject.next("");
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
    this.selectedLibraryItemGuid = null;
    this.showAddItemDropdown = false;
  }

  addLibraryItemToPlaylist(): void {
    if (!this.selectedLibraryItemGuid) {
      return;
    }

    // Ensure selectedLibraryItemGuid is a number (select elements return strings)
    let selectedGuid: number;
    if (typeof this.selectedLibraryItemGuid === 'string') {
      selectedGuid = parseInt(this.selectedLibraryItemGuid, 10);
    } else {
      selectedGuid = this.selectedLibraryItemGuid;
    }

    if (isNaN(selectedGuid)) {
      this.showErrorPopup("Please select a valid library item");
      return;
    }

    const libraryItem = this.availableLibraryItems.find(item => item.guid === selectedGuid);
    if (!libraryItem) {
      this.showErrorPopup("Selected library item not found");
      return;
    }

    // Check if item already exists in playlist
    if (this.playlistItems.some(item => item.guid === selectedGuid)) {
      this.showErrorPopup("This library item is already in the playlist");
      return;
    }

    // For text items, don't set pages by default (meaning all pages will be used)
    // User can optionally select specific pages later
    this.playlistItems.push({
      guid: selectedGuid,
      pages: undefined, // undefined means all pages
      name: libraryItem.name,
      type: libraryItem.type,
      description: libraryItem.description
    });

    // Reset selection
    this.selectedLibraryItemGuid = null;
    this.showAddItemDropdown = false;
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

  isItemInPlaylist(guid: number): boolean {
    return this.playlistItems.some(pi => pi.guid === guid);
  }

  onLibraryItemSelectionChange(): void {
    this.showAddItemDropdown = false;
    // Convert string value to number if needed (select elements return strings)
    if (this.selectedLibraryItemGuid !== null && typeof this.selectedLibraryItemGuid === 'string') {
      this.selectedLibraryItemGuid = parseInt(this.selectedLibraryItemGuid, 10);
    }
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
          this.cancelEdit();
          // Optionally refresh search or show success message
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
          this.cancelEdit();
          // Optionally refresh search or show success message
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

    // Ask for confirmation
    const confirmed = confirm(`Are you sure you want to delete playlist "${this.editingPlaylist.name}"? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    // Delete the playlist
    this.playlistService.deletePlaylist(this.editingPlaylist.guid).subscribe({
      next: () => {
        console.log("Playlist deleted");
        this.cancelEdit();
        // Optionally refresh search or show success message
      },
      error: (error) => {
        console.error("Error deleting playlist:", error);
        this.showErrorPopup("Error deleting playlist. Please try again.");
      }
    });
  }

  hasDeletePermission(): boolean {
    return this.userService.hasPermission('DeletePlaylistEditor');
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
}
