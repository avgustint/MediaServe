import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LibraryItem } from "../../playlist.service";

@Component({
  selector: "app-playlist-item",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./playlist-item.component.html",
  styleUrls: ["./playlist-item.component.scss"]
})
export class PlaylistItemComponent {
  @Input() item!: LibraryItem;
  @Input() index!: number;
  @Output() itemClick = new EventEmitter<LibraryItem>();
  @Output() pageClick = new EventEmitter<{ item: LibraryItem; page: number }>();

  onItemClick(event: Event): void {
    event.stopPropagation();
    this.itemClick.emit(this.item);
  }

  onPageClick(event: Event, page: number): void {
    event.stopPropagation();
    this.pageClick.emit({ item: this.item, page });
  }
}

