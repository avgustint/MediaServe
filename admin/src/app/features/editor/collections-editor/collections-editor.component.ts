import { Component, OnInit, OnDestroy, ViewChild, AfterViewChecked } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { CollectionsService, Collection, CollectionItem } from "../services/collections.service";
import { UserService } from "../../../core/services/user.service";
import { ErrorPopupComponent } from "../../../shared/feedback/error-popup/error-popup.component";
import { ConfirmDialogComponent } from "../../../shared/feedback/confirm-dialog/confirm-dialog.component";
import { SearchComponent } from "../../playlist/search/search.component";
import { ToastComponent } from "../../../shared/feedback/toast/toast.component";
import { TranslatePipe } from "../../../shared/pipes/translation.pipe";
import { TranslationService } from "../../../core/services/translation.service";
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, of } from "rxjs";
import { HttpErrorResponse } from "@angular/common/http";
import { LibraryItem } from "../../playlist/services/playlist.service";

import { InputTextModule } from "primeng/inputtext";
import { InputNumberModule } from "primeng/inputnumber";

@Component({
  selector: "app-collections-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, ErrorPopupComponent, ConfirmDialogComponent, SearchComponent, ToastComponent, TranslatePipe, InputTextModule, InputNumberModule],
  templateUrl: "./collections-editor.component.html",
  styleUrls: ["./collections-editor.component.scss"]
})
export class CollectionsEditorComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('libraryItemSearch') libraryItemSearchComponent?: SearchComponent;
  
  searchTerm: string = "";
  allCollections: Collection[] = [];
  filteredCollections: Collection[] = [];
  
  editingCollection: Collection | null = null;
  viewingCollection: Collection | null = null;
  isNewCollection: boolean = false;
  collectionItems: CollectionItem[] = [];
  loadingItems: boolean = false;

  // Form fields
  collectionTitle: string = "";
  collectionLabel: string = "";
  collectionYear: string = "";
  collectionPublisher: string = "";
  collectionSource: string = "";

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
  collectionToDeleteGuid: number | null = null;
  itemToRemoveGuid: number | null = null;

  // Add item modal
  showAddItemModal: boolean = false;
  
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  hasManageCollectionsPermission: boolean = false;

  constructor(
    private collectionsService: CollectionsService,
    private userService: UserService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.hasManageCollectionsPermission = this.userService.hasPermission("ManageCollections");
    this.loadData();
    
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((searchTerm) => {
        return of(this.filterCollections(searchTerm));
      })
    ).subscribe({
      next: (filtered) => {
        this.filteredCollections = filtered;
      }
    });
  }

  ngAfterViewChecked(): void {
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  loadData(): void {
    this.collectionsService.getAllCollections().subscribe({
      next: (collections) => {
        this.allCollections = collections;
        this.filteredCollections = collections;
      },
      error: (error) => {
        console.error("Error loading collections:", error);
        this.showErrorPopup(this.translationService.translate('errorLoadingData'));
      }
    });
  }

  filterCollections(searchTerm: string): Collection[] {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return this.allCollections;
    }
    const term = searchTerm.toLowerCase().trim();
    return this.allCollections.filter(collection => 
      collection.title.toLowerCase().includes(term) ||
      (collection.label && collection.label.toLowerCase().includes(term)) ||
      (collection.publisher && collection.publisher.toLowerCase().includes(term))
    );
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  clearSearch(): void {
    this.searchTerm = "";
    this.searchSubject.next("");
  }

  addNewCollection(): void {
    this.isNewCollection = true;
    this.editingCollection = null;
    this.collectionTitle = "";
    this.collectionLabel = "";
    this.collectionYear = "";
    this.collectionPublisher = "";
    this.collectionSource = "";
  }

  selectCollection(collection: Collection): void {
    this.viewingCollection = { ...collection };
    this.editingCollection = null;
    this.isNewCollection = false;
    this.loadCollectionItems(collection.guid);
  }

  viewCollectionDetails(collection: Collection): void {
    this.selectCollection(collection);
  }

  editCollectionDetails(): void {
    if (this.viewingCollection) {
      this.isNewCollection = false;
      this.editingCollection = { ...this.viewingCollection };
      this.collectionTitle = this.viewingCollection.title;
      this.collectionLabel = this.viewingCollection.label || "";
      this.collectionYear = this.viewingCollection.year ? this.viewingCollection.year.toString() : "";
      this.collectionPublisher = this.viewingCollection.publisher || "";
      this.collectionSource = this.viewingCollection.source || "";
      this.viewingCollection = null;
    }
  }

  loadCollectionItems(collectionGuid: number): void {
    this.loadingItems = true;
    this.collectionItems = [];
    this.collectionsService.getCollectionItems(collectionGuid).subscribe({
      next: (items) => {
        this.collectionItems = items;
        this.loadingItems = false;
      },
      error: (error) => {
        console.error("Error loading collection items:", error);
        this.showErrorPopup(this.translationService.translate('errorLoadingData'));
        this.loadingItems = false;
      }
    });
  }

  cancelEdit(): void {
    this.editingCollection = null;
    this.viewingCollection = null;
    this.isNewCollection = false;
    this.collectionTitle = "";
    this.collectionLabel = "";
    this.collectionYear = "";
    this.collectionPublisher = "";
    this.collectionSource = "";
    this.collectionItems = [];
    this.loadData();
  }

  backToCollectionList(): void {
    this.viewingCollection = null;
    this.editingCollection = null;
    this.collectionItems = [];
  }

  saveCollection(): void {
    if (!this.collectionTitle.trim()) {
      this.showErrorPopup(this.translationService.translate('nameRequired'));
      return;
    }

    const collectionData: Partial<Collection> = {
      title: this.collectionTitle.trim(),
      label: this.collectionLabel.trim() || undefined,
      year: this.collectionYear.trim() ? parseInt(this.collectionYear.trim(), 10) : undefined,
      publisher: this.collectionPublisher.trim() || undefined,
      source: this.collectionSource.trim() || undefined
    };

    if (this.isNewCollection) {
      this.collectionsService.createCollection(collectionData).subscribe({
        next: (newCollection) => {
          this.showSuccessToast(this.translationService.translate('collectionSaved'));
          this.cancelEdit();
        },
        error: (error: HttpErrorResponse) => {
          console.error("Error creating collection:", error);
          const errorMessage = error.error?.message || this.translationService.translate('errorSavingCollection');
          this.showErrorPopup(errorMessage);
        }
      });
    } else if (this.editingCollection) {
      this.collectionsService.updateCollection(this.editingCollection.guid, collectionData).subscribe({
        next: (updatedCollection) => {
          this.showSuccessToast(this.translationService.translate('collectionSaved'));
          this.loadData();
          // If we were viewing this collection, update it
          if (this.viewingCollection && this.viewingCollection.guid === updatedCollection.guid) {
            this.viewingCollection = { ...updatedCollection, itemCount: this.viewingCollection.itemCount };
          }
          this.cancelEdit();
        },
        error: (error: HttpErrorResponse) => {
          console.error("Error updating collection:", error);
          const errorMessage = error.error?.message || this.translationService.translate('errorSavingCollection');
          this.showErrorPopup(errorMessage);
        }
      });
    }
  }

  deleteCollection(collection: Collection): void {
    this.collectionToDeleteGuid = collection.guid;
    this.confirmDialogTitle = this.translationService.translate('deleteCollection');
    this.confirmDialogMessage = `${this.translationService.translate('deleteCollectionConfirm')} "${collection.title}"? ${this.translationService.translate('thisActionCannotBeUndone')}`;
    this.showConfirmDialog = true;
  }

  onConfirmDelete(): void {
    if (this.collectionToDeleteGuid !== null) {
      this.collectionsService.deleteCollection(this.collectionToDeleteGuid).subscribe({
        next: () => {
          this.showSuccessToast(this.translationService.translate('collectionDeleted') || 'Collection deleted');
          this.closeConfirmDialog();
          // Clear viewing collection if it was the deleted one
          if (this.viewingCollection && this.viewingCollection.guid === this.collectionToDeleteGuid) {
            this.viewingCollection = null;
            this.collectionItems = [];
          }
          this.cancelEdit(); // This will also clear editingCollection
          this.loadData(); // Refresh collection list
        },
        error: (error: HttpErrorResponse) => {
          console.error("Error deleting collection:", error);
          const errorMessage = error.error?.message || this.translationService.translate('errorDeletingCollection');
          this.showErrorPopup(errorMessage);
          this.closeConfirmDialog();
        }
      });
    }
  }

  onConfirmDialogAction(): void {
    if (this.itemToRemoveGuid !== null) {
      this.onConfirmRemoveItem();
    } else if (this.collectionToDeleteGuid !== null) {
      this.onConfirmDelete();
    }
  }

  closeConfirmDialog(): void {
    this.showConfirmDialog = false;
    this.collectionToDeleteGuid = null;
    this.itemToRemoveGuid = null;
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

  openAddItemModal(): void {
    this.showAddItemModal = true;
    // Note: SearchComponent doesn't have focusInput method, so we skip auto-focus
  }

  closeAddItemModal(): void {
    this.showAddItemModal = false;
  }

  onLibraryItemSelected(event: { item: LibraryItem; page: number }): void {
    const item = event.item;
    if (this.viewingCollection) {
      this.collectionsService.addItemToCollection(this.viewingCollection.guid, item.guid, {}).subscribe({
        next: () => {
          this.showSuccessToast(this.translationService.translate('libraryItemAdded'));
          this.loadCollectionItems(this.viewingCollection!.guid);
          this.loadData(); // Refresh collection list to update count
          this.closeAddItemModal();
        },
        error: (error: HttpErrorResponse) => {
          console.error("Error adding item to collection:", error);
          const errorMessage = error.error?.message || this.translationService.translate('errorSavingCollection');
          this.showErrorPopup(errorMessage);
        }
      });
    }
  }

  removeItemFromCollection(item: CollectionItem): void {
    this.itemToRemoveGuid = item.guid;
    this.confirmDialogTitle = this.translationService.translate('removeItemFromCollection');
    this.confirmDialogMessage = `${this.translationService.translate('removeItemFromCollection')} "${item.name}"?`;
    this.showConfirmDialog = true;
  }

  onConfirmRemoveItem(): void {
    if (this.itemToRemoveGuid !== null && this.viewingCollection) {
      this.collectionsService.removeItemFromCollection(this.viewingCollection.guid, this.itemToRemoveGuid).subscribe({
        next: () => {
          this.showSuccessToast(this.translationService.translate('collectionSaved'));
          this.loadCollectionItems(this.viewingCollection!.guid);
          this.loadData(); // Refresh collection list to update count
          this.closeConfirmDialog();
        },
        error: (error: HttpErrorResponse) => {
          console.error("Error removing item from collection:", error);
          const errorMessage = error.error?.message || this.translationService.translate('errorDeletingCollection');
          this.showErrorPopup(errorMessage);
          this.closeConfirmDialog();
        }
      });
    }
  }

  getExcludedGuids(): number[] {
    return this.collectionItems.map(item => item.guid);
  }
}

