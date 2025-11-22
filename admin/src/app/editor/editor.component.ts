import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LibraryEditorComponent } from "./library-editor/library-editor.component";
import { PlaylistEditorComponent } from "./playlist-editor/playlist-editor.component";
import { UserService } from "../user.service";

@Component({
  selector: "app-editor",
  standalone: true,
  imports: [CommonModule, LibraryEditorComponent, PlaylistEditorComponent],
  templateUrl: "./editor.component.html",
  styleUrls: ["./editor.component.scss"]
})
export class EditorComponent implements OnInit {
  activeTab: "library" | "playlist" | null = null;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    // Set default active tab based on available permissions
    if (this.hasLibraryEditorPermission()) {
      this.activeTab = "library";
    } else if (this.hasPlaylistEditorPermission()) {
      this.activeTab = "playlist";
    }
  }

  hasLibraryEditorPermission(): boolean {
    return this.userService.hasPermission('ViewLibraryEditor');
  }

  hasPlaylistEditorPermission(): boolean {
    return this.userService.hasPermission('ViewPlaylistEditor');
  }

  switchTab(tab: "library" | "playlist"): void {
    this.activeTab = tab;
  }
}

