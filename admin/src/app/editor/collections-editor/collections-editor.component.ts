import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { CollectionsService, Collection } from "../../collections.service";
import { UserService } from "../../user.service";
import { ErrorPopupComponent } from "../../shared/error-popup/error-popup.component";
import { ConfirmDialogComponent } from "../../shared/confirm-dialog/confirm-dialog.component";
import { TranslatePipe } from "../../translation.pipe";
import { TranslationService } from "../../translation.service";
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, of } from "rxjs";
import { HttpErrorResponse } from "@angular/common/http";

import { InputTextModule } from "primeng/inputtext";
import { InputNumberModule } from "primeng/inputnumber";

@Component({
  selector: "app-collections-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, ErrorPopupComponent, ConfirmDialogComponent, TranslatePipe, InputTextModule, InputNumberModule],
  templateUrl: "./collections-editor.component.html",
  styleUrls: ["./collections-editor.component.scss"]
})
export class CollectionsEditorComponent implements OnInit, OnDestroy {
  searchTerm: string = "";
  allCollections: Collection[] = [];
  filteredCollections: Collection[] = [];
  
  editingCollection: Collection | null = null;
  isNewCollection: boolean = false;

  // Form fields
  collectionTitle: string = "";
  collectionLabel: string = "";
  collectionYear: string = "";
  collectionPublisher: string = "";
  collectionSource: string = "";

  // Error popup
  showError: boolean = false;
  errorMessage: string = "";

  // Confirm dialog
  showConfirmDialog: boolean = false;
  confirmDialogTitle: string = "";
  confirmDialogMessage: string = "";
  collectionToDeleteGuid: number | null = null;
  
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
    this.isNewCollection = false;
    this.editingCollection = { ...collection };
    this.collectionTitle = collection.title;
    this.collectionLabel = collection.label || "";
    this.collectionYear = collection.year ? collection.year.toString() : "";
    this.collectionPublisher = collection.publisher || "";
    this.collectionSource = collection.source || "";
  }

  cancelEdit(): void {
    this.editingCollection = null;
    this.isNewCollection = false;
    this.collectionTitle = "";
    this.collectionLabel = "";
    this.collectionYear = "";
    this.collectionPublisher = "";
    this.collectionSource = "";
    this.loadData();
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
          this.showErrorPopup(this.translationService.translate('collectionSaved'));
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
          this.showErrorPopup(this.translationService.translate('collectionSaved'));
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
          this.showErrorPopup(this.translationService.translate('collectionSaved'));
          this.closeConfirmDialog();
          this.loadData();
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

  closeConfirmDialog(): void {
    this.showConfirmDialog = false;
    this.collectionToDeleteGuid = null;
  }

  showErrorPopup(message: string): void {
    this.errorMessage = message;
    this.showError = true;
  }

  closeErrorPopup(): void {
    this.showError = false;
    this.errorMessage = "";
  }
}

