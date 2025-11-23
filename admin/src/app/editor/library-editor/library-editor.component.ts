import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PlaylistService, LibraryItem, LibraryContent } from "../../playlist.service";
import { UserService } from "../../user.service";
import { ErrorPopupComponent } from "../../shared/error-popup/error-popup.component";
import { ConfirmDialogComponent } from "../../shared/confirm-dialog/confirm-dialog.component";
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from "rxjs";

@Component({
  selector: "app-library-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, ErrorPopupComponent, ConfirmDialogComponent],
  templateUrl: "./library-editor.component.html",
  styleUrls: ["./library-editor.component.scss"]
})
export class LibraryEditorComponent implements OnInit {
  searchTerm: string = "";
  searchResults: LibraryItem[] = [];
  showSearchResults: boolean = false;
  private searchSubject = new Subject<string>();

  // Recently modified items
  recentItems: LibraryItem[] = [];
  showRecentItems: boolean = true;

  editingItem: LibraryItem | null = null;
  isNewItem: boolean = false;

  // Form fields
  itemName: string = "";
  itemType: "text" | "image" | "url" = "text";
  itemDescription: string = "";
  
  // Text type fields
  textPages: LibraryContent[] = [{ page: 1, content: "" }];
  
  // Image type field
  imageFile: File | null = null;
  imagePreview: string | null = null;
  imageBase64: string | null = null;
  
  // URL type field
  urlContent: string = "";

  // Error popup
  showError: boolean = false;
  errorMessage: string = "";

  // Confirm dialog
  showConfirmDialog: boolean = false;
  confirmDialogTitle: string = "";
  confirmDialogMessage: string = "";
  itemToDeleteGuid: number | null = null;

  constructor(
    private playlistService: PlaylistService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    // Load recently modified items
    this.loadRecentItems();

    // Setup search with debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((searchTerm) => {
        if (searchTerm.trim().length === 0) {
          this.searchResults = [];
          this.showSearchResults = false;
          this.showRecentItems = true;
          return of([]);
        }
        this.showRecentItems = false;
        return this.playlistService.searchLibraryItems(searchTerm);
      })
    ).subscribe({
      next: (results) => {
        this.searchResults = results;
        this.showSearchResults = results.length > 0 || this.searchTerm.trim().length > 0;
      },
      error: (error) => {
        console.error("Error searching library items:", error);
        this.searchResults = [];
        this.showSearchResults = false;
      }
    });
  }

  loadRecentItems(): void {
    this.playlistService.getRecentlyModifiedLibraryItems().subscribe({
      next: (items) => {
        this.recentItems = items;
      },
      error: (error) => {
        console.error("Error loading recently modified library items:", error);
        this.recentItems = [];
      }
    });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onSearchResultSelect(item: LibraryItem): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.editItem(item);
  }

  clearSearch(): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.showRecentItems = true;
    this.searchSubject.next("");
  }

  deleteItemFromList(item: LibraryItem): void {
    // Check if item is used in any playlist first
    this.playlistService.checkLibraryItemUsage(item.guid).subscribe({
      next: (usageInfo) => {
        if (usageInfo.isUsed) {
          const playlistNames = usageInfo.playlists.map(p => p.name).join(", ");
          this.showErrorPopup(`Cannot delete library item "${item.name}". It is used in the following playlist(s): ${playlistNames}`);
          return;
        }

        // Show confirmation dialog
        this.itemToDeleteGuid = item.guid;
        this.confirmDialogTitle = "Delete Library Item";
        this.confirmDialogMessage = `Are you sure you want to delete library item "${item.name}"? This action cannot be undone.`;
        this.showConfirmDialog = true;
      },
      error: (error) => {
        console.error("Error checking library item usage:", error);
        this.showErrorPopup("Error checking library item usage. Please try again.");
      }
    });
  }

  editItem(item: LibraryItem): void {
    this.isNewItem = false;
    this.editingItem = { ...item };
    this.itemName = item.name;
    this.itemType = item.type;
    this.itemDescription = item.description || "";
    
    if (item.type === "text" && Array.isArray(item.content)) {
      this.textPages = [...item.content];
    } else if (item.type === "text") {
      this.textPages = [{ page: 1, content: item.content as string }];
    } else {
      this.textPages = [{ page: 1, content: "" }];
    }

    if (item.type === "image") {
      this.imageBase64 = item.content as string;
      this.imagePreview = item.content as string;
      if (!this.imagePreview.startsWith("data:image")) {
        this.imagePreview = `data:image/png;base64,${this.imagePreview}`;
      }
    } else {
      this.imageFile = null;
      this.imagePreview = null;
      this.imageBase64 = null;
    }

    if (item.type === "url") {
      this.urlContent = item.content as string;
    } else {
      this.urlContent = "";
    }
  }

  addNewItem(): void {
    this.isNewItem = true;
    this.editingItem = null;
    this.itemName = "";
    this.itemType = "text";
    this.itemDescription = "";
    this.textPages = [{ page: 1, content: "" }];
    this.imageFile = null;
    this.imagePreview = null;
    this.imageBase64 = null;
    this.urlContent = "";
  }

  cancelEdit(): void {
    this.editingItem = null;
    this.isNewItem = false;
    this.itemName = "";
    this.itemType = "text";
    this.itemDescription = "";
    this.textPages = [{ page: 1, content: "" }];
    this.imageFile = null;
    this.imagePreview = null;
    this.imageBase64 = null;
    this.urlContent = "";
  }

  onTypeChange(): void {
    // Reset content when type changes
    if (this.itemType === "text") {
      this.textPages = [{ page: 1, content: "" }];
      this.imageFile = null;
      this.imagePreview = null;
      this.imageBase64 = null;
      this.urlContent = "";
    } else if (this.itemType === "image") {
      this.textPages = [{ page: 1, content: "" }];
      this.urlContent = "";
      this.imageFile = null;
      this.imagePreview = null;
      this.imageBase64 = null;
    } else if (this.itemType === "url") {
      this.textPages = [{ page: 1, content: "" }];
      this.imageFile = null;
      this.imagePreview = null;
      this.imageBase64 = null;
      this.urlContent = "";
    }
  }

  addPage(): void {
    const nextPageNumber = Math.max(...this.textPages.map(p => p.page), 0) + 1;
    this.textPages.push({ page: nextPageNumber, content: "" });
  }

  removePage(pageNumber: number): void {
    if (this.textPages.length > 1) {
      this.textPages = this.textPages.filter(p => p.page !== pageNumber);
      // Renumber pages sequentially
      this.textPages.forEach((page, index) => {
        page.page = index + 1;
      });
    }
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.imageFile = input.files[0];
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
        // Extract base64 without data URI prefix
        const base64String = e.target.result.split(',')[1] || e.target.result;
        this.imageBase64 = base64String;
      };
      reader.readAsDataURL(this.imageFile);
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

  saveItem(): void {
    if (!this.itemName.trim()) {
      this.showErrorPopup("Please enter a name for the item");
      return;
    }

    let content: string | LibraryContent[];

    if (this.itemType === "text") {
      // Validate that all pages have content
      const validPages = this.textPages.filter(p => p.content.trim().length > 0);
      if (validPages.length === 0) {
        this.showErrorPopup("Please enter content for at least one page");
        return;
      }
      content = validPages;
    } else if (this.itemType === "image") {
      if (!this.imageBase64 && !this.imagePreview) {
        this.showErrorPopup("Please upload an image");
        return;
      }
      content = this.imageBase64 || this.imagePreview || "";
    } else if (this.itemType === "url") {
      if (!this.urlContent.trim()) {
        this.showErrorPopup("Please enter a URL");
        return;
      }
      content = this.urlContent.trim();
    } else {
      content = "";
    }

    const itemData: Partial<LibraryItem> = {
      name: this.itemName.trim(),
      type: this.itemType,
      content: content,
      description: this.itemDescription.trim() || undefined
    };

    if (this.isNewItem) {
      // Create new item
      this.playlistService.createLibraryItem(itemData).subscribe({
        next: (newItem) => {
          console.log("Library item created:", newItem);
          this.cancelEdit();
          // Refresh the recently modified items list to show the new item on top
          this.loadRecentItems();
        },
        error: (error) => {
          console.error("Error creating library item:", error);
          this.showErrorPopup("Error creating library item. Please try again.");
        }
      });
    } else if (this.editingItem) {
      // Update existing item
      const updatedItem: LibraryItem = {
        ...this.editingItem,
        ...itemData
      };
      
      this.playlistService.updateLibraryItem(updatedItem).subscribe({
      next: (result) => {
        console.log("Library item updated:", result);
        this.loadRecentItems();
        this.cancelEdit();
      },
        error: (error) => {
          console.error("Error updating library item:", error);
          this.showErrorPopup("Error updating library item. Please try again.");
        }
      });
    }
  }

  deleteItem(): void {
    if (!this.editingItem) {
      return;
    }

    // Show confirmation dialog
    this.itemToDeleteGuid = this.editingItem.guid;
    this.confirmDialogTitle = "Delete Library Item";
    this.confirmDialogMessage = `Are you sure you want to delete library item "${this.editingItem.name}"? This action cannot be undone.`;
    this.showConfirmDialog = true;
  }

  onConfirmDelete(): void {
    if (this.itemToDeleteGuid === null) {
      return;
    }

    const guidToDelete = this.itemToDeleteGuid;
    const itemName = this.editingItem?.name || this.recentItems.find(item => item.guid === guidToDelete)?.name || "this item";
    
    // Check if item is used in any playlist before deleting
    this.playlistService.checkLibraryItemUsage(guidToDelete).subscribe({
      next: (usageInfo) => {
        if (usageInfo.isUsed) {
          const playlistNames = usageInfo.playlists.map(p => p.name).join(", ");
          this.showErrorPopup(`Cannot delete library item "${itemName}". It is used in the following playlist(s): ${playlistNames}`);
          this.closeConfirmDialog();
          return;
        }

        // Delete the item
        this.playlistService.deleteLibraryItem(guidToDelete).subscribe({
          next: () => {
            console.log("Library item deleted");
            this.loadRecentItems();
            if (this.editingItem?.guid === guidToDelete) {
              this.cancelEdit();
            }
            this.closeConfirmDialog();
          },
          error: (error) => {
            console.error("Error deleting library item:", error);
            this.showErrorPopup("Error deleting library item. Please try again.");
            this.closeConfirmDialog();
          }
        });
      },
      error: (error) => {
        console.error("Error checking library item usage:", error);
        this.showErrorPopup("Error checking library item usage. Please try again.");
        this.closeConfirmDialog();
      }
    });
  }

  closeConfirmDialog(): void {
    this.showConfirmDialog = false;
    this.itemToDeleteGuid = null;
    this.confirmDialogTitle = "";
    this.confirmDialogMessage = "";
  }

  hasDeletePermission(): boolean {
    return this.userService.hasPermission('DeleteLibraryEditor');
  }
}
