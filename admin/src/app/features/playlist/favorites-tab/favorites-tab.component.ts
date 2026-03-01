import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TranslatePipe } from "../../../shared/pipes/translation.pipe";
import { ListsService } from "../services/lists.service";
import { PlaylistService, LibraryItem } from "../services/playlist.service";
import { TranslationService } from "../../../core/services/translation.service";
import { Subject, of } from "rxjs";
import { debounceTime, distinctUntilChanged, switchMap } from "rxjs/operators";
import { InputTextModule } from "primeng/inputtext";

@Component({
  selector: "app-favorites-tab",
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, InputTextModule],
  templateUrl: "./favorites-tab.component.html",
  styleUrls: ["./favorites-tab.component.scss"]
})
export class FavoritesTabComponent implements OnInit, OnDestroy {
  @Input() refresh$?: Subject<void>;
  @Output() itemClick = new EventEmitter<{ item: LibraryItem; page: number }>();

  items: LibraryItem[] = [];
  filteredItems: LibraryItem[] = [];
  searchTerm = "";
  loading = true;
  private searchSubject = new Subject<string>();
  private refreshSub?: import("rxjs").Subscription;

  constructor(
    private listsService: ListsService,
    private playlistService: PlaylistService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.loadFavorites();
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => {
        if (!term.trim()) return of(this.items);
        const t = term.toLowerCase().trim();
        return of(this.items.filter(item =>
          item.name.toLowerCase().includes(t) ||
          (item.description && item.description.toLowerCase().includes(t)) ||
          String(item.guid).includes(t)
        ));
      })
    ).subscribe(filtered => {
      this.filteredItems = filtered;
    });
    if (this.refresh$) {
      this.refreshSub = this.refresh$.subscribe(() => this.loadFavorites());
    }
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  loadFavorites(): void {
    this.loading = true;
    this.listsService.getFavorites().subscribe({
      next: (res) => {
        this.items = res.items;
        this.applyFilter();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  private applyFilter(): void {
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
