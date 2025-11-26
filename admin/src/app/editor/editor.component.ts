import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LibraryEditorComponent } from "./library-editor/library-editor.component";
import { PlaylistEditorComponent } from "./playlist-editor/playlist-editor.component";
import { TagsEditorComponent } from "./tags-editor/tags-editor.component";
import { CollectionsEditorComponent } from "./collections-editor/collections-editor.component";
import { TranslatePipe } from "../translation.pipe";
import { UserService } from "../user.service";

@Component({
  selector: "app-editor",
  standalone: true,
  imports: [CommonModule, LibraryEditorComponent, PlaylistEditorComponent, TagsEditorComponent, CollectionsEditorComponent, TranslatePipe],
  templateUrl: "./editor.component.html",
  styleUrls: ["./editor.component.scss"]
})
export class EditorComponent implements OnInit {
  activeTab: "library" | "playlist" | "tags" | "collections" | null = null;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    // Set default active tab based on available permissions
    if (this.hasLibraryEditorPermission()) {
      this.activeTab = "library";
    } else if (this.hasPlaylistEditorPermission()) {
      this.activeTab = "playlist";
    } else if (this.hasTagsEditorPermission()) {
      this.activeTab = "tags";
    } else if (this.hasCollectionsEditorPermission()) {
      this.activeTab = "collections";
    }
  }

  hasLibraryEditorPermission(): boolean {
    // Check for ViewLibrary permission (new) or ViewLibraryEditor (legacy)
    return this.userService.hasPermission('ViewLibrary') || this.userService.hasPermission('ViewLibraryEditor');
  }

  hasPlaylistEditorPermission(): boolean {
    // Check for ViewPlaylists permission (new) or ViewPlaylistEditor (legacy)
    return this.userService.hasPermission('ViewPlaylists') || this.userService.hasPermission('ViewPlaylistEditor');
  }

  hasTagsEditorPermission(): boolean {
    // Check for ViewTags permission (view-only) or ManageTags (edit)
    return this.userService.hasPermission('ViewTags') || this.userService.hasPermission('ManageTags');
  }

  hasCollectionsEditorPermission(): boolean {
    // Check for ViewCollections permission (view-only) or ManageCollections (edit)
    return this.userService.hasPermission('ViewCollections') || this.userService.hasPermission('ManageCollections');
  }

  switchTab(tab: "library" | "playlist" | "tags" | "collections"): void {
    this.activeTab = tab;
  }
}

