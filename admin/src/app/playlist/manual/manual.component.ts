import { Component, Output, EventEmitter, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PlaylistService, LibraryItem, LibraryContent } from "../../playlist.service";
import { WebSocketService } from "../../websocket.service";
import { UserService } from "../../user.service";
import { TranslatePipe } from "../../translation.pipe";

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

  constructor(
    private playlistService: PlaylistService,
    private websocketService: WebSocketService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
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

    // Clear the GUID input field for next entry
    this.enteredGuid = "";

    // Use the shared loadLibraryItem method
    this.loadLibraryItem(guid);
  }

  onPageClick(page: number): void {
    if (this.libraryItem && this.libraryItem.guid) {
      this.itemClick.emit({ item: this.libraryItem, page: page });
      
      const user = this.userService.getUser();
      const changeMessage: any = {
        type: "Change",
        guid: this.libraryItem.guid,
        page: page
      };
      if (user?.locationId) {
        changeMessage.locationId = user.locationId;
      }
      this.websocketService.send(JSON.stringify(changeMessage));
      
      // Send selection sync message
      const selectMessage: any = {
        type: "SelectLibraryItem",
        guid: this.libraryItem.guid,
        page: page
      };
      if (user?.locationId) {
        selectMessage.locationId = user.locationId;
      }
      this.websocketService.send(JSON.stringify(selectMessage));
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

  getDisplayGuid(): string {
    // Show enteredGuid if typing, otherwise show searchedGuid if exists, otherwise show '0'
    if (this.enteredGuid && this.enteredGuid.length > 0) {
      return this.enteredGuid;
    } else if (this.searchedGuid) {
      return this.searchedGuid;
    } else {
      return '0';
    }
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
                
                const user = this.userService.getUser();
                const changeMessage: any = {
                  type: "Change",
                  guid: item.guid,
                  page: 1
                };
                if (user?.locationId) {
                  changeMessage.locationId = user.locationId;
                }
                this.websocketService.send(JSON.stringify(changeMessage));
                
                // Send selection sync message
                const selectMessage: any = {
                  type: "SelectLibraryItem",
                  guid: item.guid,
                  page: 1
                };
                if (user?.locationId) {
                  selectMessage.locationId = user.locationId;
                }
                this.websocketService.send(JSON.stringify(selectMessage));
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

