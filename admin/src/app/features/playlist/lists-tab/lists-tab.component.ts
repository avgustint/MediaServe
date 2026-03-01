import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TranslatePipe } from "../../../shared/pipes/translation.pipe";
import { ListsService, List } from "../services/lists.service";
import { PlaylistService, LibraryItem } from "../services/playlist.service";
import { TranslationService } from "../../../core/services/translation.service";
import { Subject } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { InputTextModule } from "primeng/inputtext";
import { SelectModule } from "primeng/select";

@Component({
  selector: "app-lists-tab",
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, InputTextModule, SelectModule],
  templateUrl: "./lists-tab.component.html",
  styleUrls: ["./lists-tab.component.scss"]
})
export class ListsTabComponent implements OnInit, OnDestroy {
  @Input() refresh$?: Subject<void>;
  @Output() itemClick = new EventEmitter<{ item: LibraryItem; page: number }>();

  lists: List[] = [];
  selectedList: List | null = null;
  listItems: LibraryItem[] = [];
  filteredItems: LibraryItem[] = [];
  searchTerm = "";
  loading = true;
  private searchSubject = new Subject<string>();
  private refreshSub?: import("rxjs").Subscription;
  private loadingListGuid: number | null = null;

  constructor(
    private listsService: ListsService,
    private playlistService: PlaylistService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.loadLists();
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.applyFilter();
    });
    if (this.refresh$) {
      this.refreshSub = this.refresh$.subscribe(() => {
        this.loadLists();
        if (this.selectedList) this.loadListItems(this.selectedList.guid);
      });
    }
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  loadLists(): void {
    this.listsService.getAllLists().subscribe({
      next: (lists) => {
        this.lists = lists.filter(l => l.is_favorites === 0);
        if (this.lists.length === 0) {
          this.selectedList = null;
          this.listItems = [];
          this.filteredItems = [];
          this.loading = false;
          return;
        }
        const lastGuid = this.listsService.getLastUsedListGuid();
        const toSelect = lastGuid && this.lists.some(l => l.guid === lastGuid)
          ? this.lists.find(l => l.guid === lastGuid)!
          : this.lists[0];
        this.selectedList = toSelect;
        this.loadListItems(toSelect.guid);
      }
    });
  }

  loadListItems(listGuid: number): void {
    this.loadingListGuid = listGuid;
    this.loading = true;
    this.listItems = [];
    this.filteredItems = [];
    this.listsService.getListItems(listGuid).subscribe({
      next: (items) => {
        if (this.loadingListGuid === listGuid) {
          this.listItems = items;
          this.applyFilter();
        }
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  private applyFilter(): void {
    if (!this.searchTerm.trim()) {
      this.filteredItems = [...this.listItems];
    } else {
      const t = this.searchTerm.toLowerCase().trim();
      this.filteredItems = this.listItems.filter(item =>
        item.name.toLowerCase().includes(t) ||
        (item.description && item.description.toLowerCase().includes(t)) ||
        String(item.guid).includes(t)
      );
    }
  }

  onListChange(event?: { value?: List | null }): void {
    const list = event?.value !== undefined ? event.value : this.selectedList;
    if (list) {
      this.selectedList = list;
      this.listsService.setLastUsedListGuid(list.guid);
      this.loadListItems(list.guid);
    } else {
      this.listItems = [];
      this.filteredItems = [];
    }
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onItemClick(item: LibraryItem): void {
    this.playlistService.getLibraryItemByGuid(item.guid).subscribe({
      next: (fullItem) => {
        if (fullItem) {
          const page = (fullItem.pages && fullItem.pages.length > 0) ? fullItem.pages[0] : 1;
          this.itemClick.emit({ item: fullItem, page });
        }
      }
    });
  }

  getTranslatedType(type: string): string {
    return this.translationService.translate(type as any);
  }
}
