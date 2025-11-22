import { Component, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { PlaylistService, LibraryItem, LibraryContent } from "../../playlist.service";
import { WebSocketService } from "../../websocket.service";

@Component({
  selector: "app-manual",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./manual.component.html",
  styleUrls: ["./manual.component.scss"]
})
export class ManualComponent {
  @Output() itemClick = new EventEmitter<any>();
  @Output() clearClick = new EventEmitter<void>();

  enteredGuid: string = "";
  libraryItem: LibraryItem | null = null;
  pages: LibraryContent[] = [];

  constructor(
    private playlistService: PlaylistService,
    private websocketService: WebSocketService
  ) {}

  onNumberClick(number: string): void {
    this.enteredGuid += number;
  }

  onEnterClick(): void {
    if (this.enteredGuid.trim().length === 0) {
      return;
    }

    const guid = parseInt(this.enteredGuid.trim(), 10);
    if (isNaN(guid)) {
      this.enteredGuid = "";
      return;
    }

    // Clear the GUID display immediately after pressing Enter
    this.enteredGuid = "";

    this.playlistService.getLibraryItemByGuid(guid).subscribe({
      next: (item) => {
        if (item) {
          this.libraryItem = item;
          
          // Extract pages if type is text
          if (item.type === "text" && Array.isArray(item.content)) {
            this.pages = item.content;
          } else {
            this.pages = [];
          }

          // Automatically trigger Change event with first page
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
        }
      },
      error: (error) => {
        console.error("Error loading library item:", error);
        this.libraryItem = null;
        this.pages = [];
      }
    });
  }

  onPageClick(page: number): void {
    if (this.libraryItem && this.libraryItem.guid) {
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
  }
}

