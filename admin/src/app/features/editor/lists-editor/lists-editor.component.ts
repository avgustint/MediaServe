import { Component, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ListsService, List } from "../../playlist/services/lists.service";
import { LibraryItem } from "../../playlist/services/playlist.service";
import { UserService } from "../../../core/services/user.service";
import { ErrorPopupComponent } from "../../../shared/feedback/error-popup/error-popup.component";
import { ConfirmDialogComponent } from "../../../shared/feedback/confirm-dialog/confirm-dialog.component";
import { SearchComponent } from "../../playlist/search/search.component";
import { ToastComponent } from "../../../shared/feedback/toast/toast.component";
import { TranslatePipe } from "../../../shared/pipes/translation.pipe";
import { TranslationService } from "../../../core/services/translation.service";
import { HttpErrorResponse } from "@angular/common/http";
import { InputTextModule } from "primeng/inputtext";

@Component({
  selector: "app-lists-editor",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ErrorPopupComponent,
    ConfirmDialogComponent,
    SearchComponent,
    ToastComponent,
    TranslatePipe,
    InputTextModule
  ],
  templateUrl: "./lists-editor.component.html",
  styleUrls: ["./lists-editor.component.scss"]
})
export class ListsEditorComponent implements OnInit {
  @ViewChild("libraryItemSearch") libraryItemSearchComponent?: SearchComponent;

  allLists: List[] = [];
  displayedLists: List[] = []; // Favorites first, then others

  editingList: List | null = null;
  viewingList: List | null = null;
  isNewList: boolean = false;
  listItems: LibraryItem[] = [];
  loadingItems: boolean = false;

  listName: string = "";
  listDescription: string = "";

  showError: boolean = false;
  errorMessage: string = "";

  showToast: boolean = false;
  toastMessage: string = "";
  toastType: "success" | "error" | "info" | "warning" = "success";

  showConfirmDialog: boolean = false;
  confirmDialogTitle: string = "";
  confirmDialogMessage: string = "";
  listToDeleteGuid: number | null = null;
  itemToRemoveGuid: number | null = null;

  showAddItemModal: boolean = false;

  hasManageListsPermission: boolean = false;

  constructor(
    private listsService: ListsService,
    private userService: UserService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.hasManageListsPermission = this.userService.hasPermission("ManageLists");
    this.loadLists();
  }

  loadLists(): void {
    this.listsService.getAllLists().subscribe({
      next: (lists) => {
        this.allLists = lists;
        // Favorites first, then others
        const favorites = lists.filter((l) => l.is_favorites === 1);
        const others = lists.filter((l) => l.is_favorites === 0);
        this.displayedLists = [...favorites, ...others];
      },
      error: (error) => {
        console.error("Error loading lists:", error);
        this.showErrorPopup(this.translationService.translate("errorLoadingData"));
      }
    });
  }

  selectList(list: List): void {
    this.viewingList = { ...list };
    this.editingList = null;
    this.isNewList = false;
    this.loadListItems(list.guid);
  }

  editListDetails(): void {
    if (this.viewingList) {
      this.isNewList = false;
      this.editingList = { ...this.viewingList };
      this.listName = this.viewingList.name;
      this.listDescription = this.viewingList.description || "";
      this.viewingList = null;
    }
  }

  loadListItems(listGuid: number): void {
    this.loadingItems = true;
    this.listItems = [];
    this.listsService.getListItems(listGuid).subscribe({
      next: (items) => {
        this.listItems = items;
        this.loadingItems = false;
      },
      error: (error) => {
        console.error("Error loading list items:", error);
        this.showErrorPopup(this.translationService.translate("errorLoadingData"));
        this.loadingItems = false;
      }
    });
  }

  addNewList(): void {
    this.isNewList = true;
    this.editingList = null;
    this.listName = "";
    this.listDescription = "";
  }

  backToListList(): void {
    this.viewingList = null;
    this.editingList = null;
    this.listItems = [];
  }

  cancelEdit(): void {
    this.editingList = null;
    this.viewingList = null;
    this.isNewList = false;
    this.listName = "";
    this.listDescription = "";
    this.listItems = [];
    this.loadLists();
  }

  saveList(): void {
    if (!this.listName.trim()) {
      this.showErrorPopup(this.translationService.translate("nameRequired"));
      return;
    }

    if (this.isNewList) {
      this.listsService.createList(this.listName.trim(), this.listDescription.trim() || undefined).subscribe({
        next: () => {
          this.showSuccessToast(this.translationService.translate("listSaved"));
          this.cancelEdit();
        },
        error: (error: HttpErrorResponse) => {
          const msg = error.error?.message || this.translationService.translate("errorSavingPlaylist");
          this.showErrorPopup(msg);
        }
      });
    } else if (this.editingList) {
      this.listsService.updateList(this.editingList.guid, { name: this.listName.trim(), description: this.listDescription.trim() || null }).subscribe({
        next: () => {
          this.showSuccessToast(this.translationService.translate("listSaved"));
          this.loadLists();
          this.cancelEdit();
        },
        error: (error: HttpErrorResponse) => {
          const msg = error.error?.message || this.translationService.translate("errorSavingPlaylist");
          this.showErrorPopup(msg);
        }
      });
    }
  }

  deleteList(list: List): void {
    this.listToDeleteGuid = list.guid;
    this.confirmDialogTitle = this.translationService.translate("deleteList");
    this.confirmDialogMessage = `${this.translationService.translate("deleteListConfirm")} "${list.name}"? ${this.translationService.translate("thisActionCannotBeUndone")}`;
    this.showConfirmDialog = true;
  }

  onConfirmDelete(): void {
    if (this.listToDeleteGuid !== null) {
      this.listsService.deleteList(this.listToDeleteGuid).subscribe({
        next: () => {
          this.showSuccessToast(this.translationService.translate("listDeleted"));
          this.closeConfirmDialog();
          if (this.viewingList && this.viewingList.guid === this.listToDeleteGuid) {
            this.viewingList = null;
            this.listItems = [];
          }
          this.loadLists();
        },
        error: (error: HttpErrorResponse) => {
          const msg = error.error?.message || this.translationService.translate("errorDeletingPlaylist");
          this.showErrorPopup(msg);
          this.closeConfirmDialog();
        }
      });
    }
  }

  openAddItemModal(): void {
    this.showAddItemModal = true;
  }

  closeAddItemModal(): void {
    this.showAddItemModal = false;
  }

  onLibraryItemSelected(event: { item: LibraryItem; page: number }): void {
    const item = event.item;
    if (this.viewingList) {
      this.listsService.addItemToList(this.viewingList.guid, item.guid).subscribe({
        next: () => {
          this.showSuccessToast(this.translationService.translate("libraryItemAdded"));
          this.loadListItems(this.viewingList!.guid);
          this.closeAddItemModal();
        },
        error: (error: HttpErrorResponse) => {
          console.error("Error adding item to list:", error);
          const msg = error.error?.message || this.translationService.translate("errorSavingPlaylist");
          this.showErrorPopup(msg);
        }
      });
    }
  }

  removeItemFromList(item: LibraryItem): void {
    this.itemToRemoveGuid = item.guid;
    this.confirmDialogTitle = this.translationService.translate("removeItemFromList");
    this.confirmDialogMessage = `${this.translationService.translate("removeItemFromList")} "${item.name}"?`;
    this.showConfirmDialog = true;
  }

  onConfirmRemoveItem(): void {
    if (this.itemToRemoveGuid !== null && this.viewingList) {
      this.listsService.removeItemFromList(this.viewingList.guid, this.itemToRemoveGuid).subscribe({
        next: () => {
          this.showSuccessToast(this.translationService.translate("listSaved"));
          this.loadListItems(this.viewingList!.guid);
          this.closeConfirmDialog();
        },
        error: (error: HttpErrorResponse) => {
          const msg = error.error?.message || this.translationService.translate("errorDeletingPlaylist");
          this.showErrorPopup(msg);
          this.closeConfirmDialog();
        }
      });
    }
  }

  onConfirmDialogAction(): void {
    if (this.itemToRemoveGuid !== null) {
      this.onConfirmRemoveItem();
    } else if (this.listToDeleteGuid !== null) {
      this.onConfirmDelete();
    }
  }

  closeConfirmDialog(): void {
    this.showConfirmDialog = false;
    this.listToDeleteGuid = null;
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
    this.toastType = "success";
    this.showToast = true;
  }

  closeToast(): void {
    this.showToast = false;
    this.toastMessage = "";
  }

  getExcludedGuids(): number[] {
    return this.listItems.map((item) => item.guid);
  }
}
