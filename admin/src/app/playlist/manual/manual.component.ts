import { Component, Output, EventEmitter, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PlaylistService, LibraryItem, LibraryContent } from "../../playlist.service";
import { WebSocketService } from "../../websocket.service";
import { TranslatePipe } from "../../translation.pipe";
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, of } from "rxjs";

@Component({
  selector: "app-manual",
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: "./manual.component.html",
  styleUrls: ["./manual.component.scss"]
})
export class ManualComponent implements OnInit, OnDestroy {
  @Output() itemClick = new EventEmitter<any>();
  @Output() clearClick = new EventEmitter<void>();

  enteredGuid: string = "";
  libraryItem: LibraryItem | null = null;
  pages: LibraryContent[] = [];
  searchedGuid: string = ""; // Track the GUID that was searched to show error message

  // Search functionality
  searchTerm: string = "";
  searchResults: LibraryItem[] = [];
  showSearchResults: boolean = false;
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  constructor(
    private playlistService: PlaylistService,
    private websocketService: WebSocketService
  ) {}

  ngOnInit(): void {
    // Setup search with debounce
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((searchTerm) => {
        if (searchTerm.trim().length === 0) {
          this.searchResults = [];
          this.showSearchResults = false;
          return of([]);
        }
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

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  onNumberClick(number: string): void {
    this.enteredGuid += number;
    this.searchedGuid = ""; // Clear error message when new input starts
  }

  onBackspaceClick(): void {
    if (this.enteredGuid.length > 0) {
      this.enteredGuid = this.enteredGuid.slice(0, -1);
      this.searchedGuid = ""; // Clear error message when editing
    }
  }

  onEnterClick(): void {
    if (this.enteredGuid.trim().length === 0) {
      return;
    }

    const guid = parseInt(this.enteredGuid.trim(), 10);
    if (isNaN(guid)) {
      this.enteredGuid = "";
      this.searchedGuid = "";
      return;
    }

    // Store the searched GUID before clearing
    this.searchedGuid = this.enteredGuid.trim();

    // Clear the GUID display immediately after pressing Enter
    this.enteredGuid = "";

    // Use the shared loadLibraryItem method
    this.loadLibraryItem(guid);
  }

  onPageClick(page: number): void {
    if (this.libraryItem && this.libraryItem.guid) {
      this.itemClick.emit({ item: this.libraryItem, page: page });
      
      const changeMessage = {
        type: "Change",
        guid: this.libraryItem.guid,
        page: page
      };
      this.websocketService.send(JSON.stringify(changeMessage));
      console.log("Sent Change message for GUID:", this.libraryItem.guid, " and page:", page);
    }
  }

  onClearClick(): void {
    this.clearClick.emit();
  }

  onClearGuid(): void {
    this.enteredGuid = "";
    this.libraryItem = null;
    this.pages = [];
    this.searchedGuid = "";
  }

  // Search functionality
  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onSearchResultSelect(item: LibraryItem): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    
    // Load the selected item
    this.loadLibraryItem(item.guid);
  }

  clearSearch(): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.searchSubject.next("");
  }

  loadLibraryItem(guid: number): void {
    this.playlistService.getLibraryItemByGuid(guid).subscribe({
      next: (item) => {
        if (item) {
          this.libraryItem = item;
          this.searchedGuid = ""; // Clear searched GUID when item is found
          
          // Extract pages if type is text
          if (item.type === "text" && Array.isArray(item.content)) {
            this.pages = item.content;
          } else {
            this.pages = [];
          }

          // Automatically trigger Change event with first page
                this.itemClick.emit({ item: item, page: 1 });
                
                const changeMessage = {
                  type: "Change",
                  guid: item.guid,
                  page: 1
                };
                this.websocketService.send(JSON.stringify(changeMessage));
                console.log("Sent Change message for GUID:", item.guid, " and page: 1");
        } else {
          this.libraryItem = null;
          this.pages = [];
          // Keep searchedGuid so error message can be displayed
        }
      },
      error: (error) => {
        console.error("Error loading library item:", error);
        this.libraryItem = null;
        this.pages = [];
        // Keep searchedGuid so error message can be displayed
      }
    });
  }
}

