import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TagsService, Tag } from "../../tags.service";
import { UserService } from "../../user.service";
import { ErrorPopupComponent } from "../../shared/error-popup/error-popup.component";
import { ConfirmDialogComponent } from "../../shared/confirm-dialog/confirm-dialog.component";
import { TranslatePipe } from "../../translation.pipe";
import { TranslationService } from "../../translation.service";
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, of } from "rxjs";
import { HttpErrorResponse } from "@angular/common/http";

import { InputTextModule } from "primeng/inputtext";
import { TextareaModule } from "primeng/textarea";

@Component({
  selector: "app-tags-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, ErrorPopupComponent, ConfirmDialogComponent, TranslatePipe, InputTextModule, TextareaModule],
  templateUrl: "./tags-editor.component.html",
  styleUrls: ["./tags-editor.component.scss"]
})
export class TagsEditorComponent implements OnInit, OnDestroy {
  searchTerm: string = "";
  allTags: Tag[] = [];
  filteredTags: Tag[] = [];
  
  editingTag: Tag | null = null;
  isNewTag: boolean = false;

  // Form fields
  tagName: string = "";
  tagDescription: string = "";

  // Error popup
  showError: boolean = false;
  errorMessage: string = "";

  // Confirm dialog
  showConfirmDialog: boolean = false;
  confirmDialogTitle: string = "";
  confirmDialogMessage: string = "";
  tagToDeleteGuid: number | null = null;
  
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  hasManageTagsPermission: boolean = false;

  constructor(
    private tagsService: TagsService,
    private userService: UserService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.hasManageTagsPermission = this.userService.hasPermission("ManageTags");
    this.loadData();
    
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((searchTerm) => {
        return of(this.filterTags(searchTerm));
      })
    ).subscribe({
      next: (filtered) => {
        this.filteredTags = filtered;
      }
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  loadData(): void {
    this.tagsService.getAllTags().subscribe({
      next: (tags) => {
        this.allTags = tags;
        this.filteredTags = tags;
      },
      error: (error) => {
        console.error("Error loading tags:", error);
        this.showErrorPopup(this.translationService.translate('errorLoadingData'));
      }
    });
  }

  filterTags(searchTerm: string): Tag[] {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return this.allTags;
    }
    const term = searchTerm.toLowerCase().trim();
    return this.allTags.filter(tag => 
      tag.name.toLowerCase().includes(term) ||
      (tag.description && tag.description.toLowerCase().includes(term))
    );
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  clearSearch(): void {
    this.searchTerm = "";
    this.searchSubject.next("");
  }

  addNewTag(): void {
    this.isNewTag = true;
    this.editingTag = null;
    this.tagName = "";
    this.tagDescription = "";
  }

  selectTag(tag: Tag): void {
    this.isNewTag = false;
    this.editingTag = { ...tag };
    this.tagName = tag.name;
    this.tagDescription = tag.description || "";
  }

  cancelEdit(): void {
    this.editingTag = null;
    this.isNewTag = false;
    this.tagName = "";
    this.tagDescription = "";
    this.loadData();
  }

  saveTag(): void {
    if (!this.tagName.trim()) {
      this.showErrorPopup(this.translationService.translate('nameRequired'));
      return;
    }

    const tagData: Partial<Tag> = {
      name: this.tagName.trim(),
      description: this.tagDescription.trim() || undefined
    };

    if (this.isNewTag) {
      this.tagsService.createTag(tagData).subscribe({
        next: (newTag) => {
          this.showErrorPopup(this.translationService.translate('tagSaved'));
          this.cancelEdit();
        },
        error: (error: HttpErrorResponse) => {
          console.error("Error creating tag:", error);
          const errorMessage = error.error?.message || this.translationService.translate('errorSavingTag');
          this.showErrorPopup(errorMessage);
        }
      });
    } else if (this.editingTag) {
      this.tagsService.updateTag(this.editingTag.guid, tagData).subscribe({
        next: (updatedTag) => {
          this.showErrorPopup(this.translationService.translate('tagSaved'));
          this.cancelEdit();
        },
        error: (error: HttpErrorResponse) => {
          console.error("Error updating tag:", error);
          const errorMessage = error.error?.message || this.translationService.translate('errorSavingTag');
          this.showErrorPopup(errorMessage);
        }
      });
    }
  }

  deleteTag(tag: Tag): void {
    this.tagsService.checkTagUsage(tag.guid).subscribe({
      next: (usageInfo) => {
        if (usageInfo.isUsed) {
          this.showErrorPopup(`${this.translationService.translate('tagUsedByItems')}: ${usageInfo.itemCount}`);
          return;
        }

        this.tagToDeleteGuid = tag.guid;
        this.confirmDialogTitle = this.translationService.translate('deleteTag');
        this.confirmDialogMessage = `${this.translationService.translate('deleteTagConfirm')} "${tag.name}"? ${this.translationService.translate('thisActionCannotBeUndone')}`;
        this.showConfirmDialog = true;
      },
      error: (error) => {
        console.error("Error checking tag usage:", error);
        this.showErrorPopup(this.translationService.translate('errorLoadingData'));
      }
    });
  }

  onConfirmDelete(): void {
    if (this.tagToDeleteGuid !== null) {
      this.tagsService.deleteTag(this.tagToDeleteGuid).subscribe({
        next: () => {
          this.showErrorPopup(this.translationService.translate('tagSaved'));
          this.closeConfirmDialog();
          this.loadData();
        },
        error: (error: HttpErrorResponse) => {
          console.error("Error deleting tag:", error);
          const errorMessage = error.error?.message || this.translationService.translate('errorDeletingTag');
          this.showErrorPopup(errorMessage);
          this.closeConfirmDialog();
        }
      });
    }
  }

  closeConfirmDialog(): void {
    this.showConfirmDialog = false;
    this.tagToDeleteGuid = null;
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

