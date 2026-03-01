import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, HostListener } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TranslatePipe } from "../../../shared/pipes/translation.pipe";
import { TranslationService } from "../../../core/services/translation.service";
import { ListsService, List } from "../services/lists.service";
import { forkJoin, of } from "rxjs";
import { switchMap, catchError } from "rxjs/operators";
import { InputTextModule } from "primeng/inputtext";

@Component({
  selector: "app-list-actions",
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, InputTextModule],
  templateUrl: "./list-actions.component.html",
  styleUrls: ["./list-actions.component.scss"]
})
export class ListActionsComponent implements OnInit, OnDestroy, OnChanges {
  @Input() currentItemGuid?: number;
  @Output() listItemAdded = new EventEmitter<void>();
  @Output() listItemRemoved = new EventEmitter<void>();

  dropdownOpen = false;
  showListSelector = false;
  showNewListForm = false;
  newListName = "";
  newListError = "";

  lists: List[] = [];
  favoritesList: List | null = null;
  lastUsedList: List | null = null;
  isInFavorites = false;
  isInLastList = false;

  loading = false;

  constructor(
    private listsService: ListsService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.loadLists();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["currentItemGuid"] && this.currentItemGuid) {
      this.checkItemInLists();
    }
  }

  ngOnDestroy(): void {
    this.dropdownOpen = false;
    this.closeOverlays();
  }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest(".list-actions-container")) {
      this.dropdownOpen = false;
    }
  }

  loadLists(): void {
    this.listsService.getFavorites().subscribe({
      next: (res) => {
        this.favoritesList = res.list;
        this.listsService.getAllLists().subscribe({
          next: (lists) => {
            this.lists = lists;
            const lastGuid = this.listsService.getLastUsedListGuid();
            this.lastUsedList = lastGuid ? lists.find(l => l.guid === lastGuid && l.is_favorites === 0) || null : null;
            if (this.currentItemGuid) {
              this.checkItemInLists();
            }
          }
        });
      }
    });
  }

  checkItemInLists(): void {
    if (!this.currentItemGuid) return;
    const checks: Array<{ list: List; obs: import("rxjs").Observable<{ inList: boolean }> }> = [];
    if (this.favoritesList) {
      checks.push({ list: this.favoritesList, obs: this.listsService.isItemInList(this.favoritesList.guid, this.currentItemGuid) });
    }
    if (this.lastUsedList && this.lastUsedList.guid !== this.favoritesList?.guid) {
      checks.push({ list: this.lastUsedList, obs: this.listsService.isItemInList(this.lastUsedList.guid, this.currentItemGuid) });
    }
    if (checks.length === 0) {
      this.isInFavorites = false;
      this.isInLastList = false;
      return;
    }
    forkJoin(checks.map(c => c.obs.pipe(catchError(() => of({ inList: false })))))
      .subscribe(results => {
        if (this.favoritesList) {
          const idx = checks.findIndex(c => c.list.guid === this.favoritesList!.guid);
          this.isInFavorites = idx >= 0 ? results[idx].inList : false;
        }
        if (this.lastUsedList) {
          const idx = checks.findIndex(c => c.list.guid === this.lastUsedList!.guid);
          this.isInLastList = idx >= 0 ? results[idx].inList : false;
        }
      });
  }

  get addToLastListLabel(): string {
    if (!this.lastUsedList) return "";
    const key = this.isInLastList ? "removeFromList" : "addToList";
    return this.translationService.translate(key).replace("{{name}}", this.lastUsedList.name);
  }

  openDropdown(): void {
    if (!this.currentItemGuid) return;
    this.dropdownOpen = !this.dropdownOpen;
    if (this.dropdownOpen) {
      this.loadLists();
    }
  }

  closeOverlays(): void {
    this.showListSelector = false;
    this.showNewListForm = false;
    this.newListName = "";
    this.newListError = "";
  }

  onAddToFavorites(): void {
    const guid = this.currentItemGuid;
    if (!guid) return;
    const doAdd = () => {
      if (!this.favoritesList) return;
      if (this.isInFavorites) {
      this.listsService.removeItemFromList(this.favoritesList.guid, guid).subscribe({
        next: () => {
          this.isInFavorites = false;
          this.listItemRemoved.emit();
        }
      });
    } else {
      this.listsService.addItemToList(this.favoritesList.guid, guid).subscribe({
        next: () => {
          this.isInFavorites = true;
          this.listItemAdded.emit();
        }
      });
    }
    this.dropdownOpen = false;
    };
    if (this.favoritesList) {
      doAdd();
    } else {
      this.listsService.getFavorites().subscribe({
        next: (res) => {
          this.favoritesList = res.list;
          this.listsService.isItemInList(res.list.guid, guid).subscribe({
            next: (r) => {
              this.isInFavorites = r.inList;
              doAdd();
            }
          });
        },
        error: () => { this.dropdownOpen = false; }
      });
    }
  }

  onAddToLastList(): void {
    if (!this.currentItemGuid || !this.lastUsedList) return;
    if (this.isInLastList) {
      this.listsService.removeItemFromList(this.lastUsedList.guid, this.currentItemGuid).subscribe({
        next: () => {
          this.isInLastList = false;
          this.listItemRemoved.emit();
        }
      });
    } else {
      this.listsService.addItemToList(this.lastUsedList.guid, this.currentItemGuid).subscribe({
        next: () => {
          this.isInLastList = true;
          this.listItemAdded.emit();
        }
      });
    }
    this.dropdownOpen = false;
  }

  onSelectList(): void {
    this.dropdownOpen = false;
    this.showListSelector = true;
  }

  onAddNewList(): void {
    this.dropdownOpen = false;
    this.showNewListForm = true;
  }

  onListSelectorSelect(list: List): void {
    if (!this.currentItemGuid) return;
    this.loading = true;
    this.listsService.addItemToList(list.guid, this.currentItemGuid).subscribe({
      next: () => {
        this.listsService.setLastUsedListGuid(list.guid);
        this.loadLists();
        this.listItemAdded.emit();
        this.showListSelector = false;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  onListSelectorClose(): void {
    this.showListSelector = false;
  }

  onCreateNewList(): void {
    const name = this.newListName.trim();
    if (!name) {
      this.newListError = this.translationService.translate("fieldRequired");
      return;
    }
    const nameLower = name.toLowerCase();
    if (this.lists.some(l => l.name.toLowerCase() === nameLower)) {
      this.newListError = this.translationService.translate("listNameExists");
      return;
    }
    this.loading = true;
    this.listsService.createList(name).pipe(
      switchMap(list => {
        if (!this.currentItemGuid) return of(list);
        return this.listsService.addItemToList(list.guid, this.currentItemGuid).pipe(
          switchMap(() => {
            this.listsService.setLastUsedListGuid(list.guid);
            this.listItemAdded.emit();
            return of(list);
          })
        );
      })
    ).subscribe({
      next: () => {
        this.loadLists();
        this.showNewListForm = false;
        this.newListName = "";
        this.newListError = "";
        this.loading = false;
      },
      error: (err) => {
        this.newListError = err.error?.message || this.translationService.translate("errorOccurred");
        this.loading = false;
      }
    });
  }

  onNewListCancel(): void {
    this.showNewListForm = false;
    this.newListName = "";
    this.newListError = "";
  }

  customLists(): List[] {
    return this.lists.filter(l => l.is_favorites === 0);
  }
}
