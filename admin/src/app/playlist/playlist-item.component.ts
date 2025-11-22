import { Component, Input, Output, EventEmitter, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LibraryContent, LibraryItem, PlaylistService } from "../playlist.service";

@Component({
  selector: "app-playlist-item",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./playlist-item.component.html",
  styleUrls: ["./playlist-item.component.scss"]
})
export class PlaylistItemComponent implements OnInit{
  @Input() item!: LibraryItem;
  @Input() index!: number;
  @Output() itemClick = new EventEmitter<LibraryItem>();
  @Output() pageClick = new EventEmitter<{ item: LibraryItem; page: number }>();

  pages: LibraryContent[] = [];

  constructor(private playlistService: PlaylistService) {}

  ngOnInit(): void {
    if (this.item.type === 'text' && this.item.content) {
      this.pages = this.item.content as LibraryContent[];
    }
  }

  onItemClick(event: Event): void {
    event.stopPropagation();
    this.itemClick.emit(this.item);
  }

  onPageClick(event: Event, page: number): void {
    event.stopPropagation();
    this.pageClick.emit({ item: this.item, page });
  }
}

