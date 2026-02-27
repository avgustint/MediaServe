import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { SettingsService } from "../services/settings.service";
import { PlaylistService, LibraryItem } from "../../playlist/services/playlist.service";
import { UserService } from "../../../core/services/user.service";
import { AuthService } from "../../../core/services/auth.service";
import { TranslationService } from "../../../core/services/translation.service";
import { TranslatePipe } from "../../../shared/pipes/translation.pipe";
import { ErrorPopupComponent } from "../../../shared/feedback/error-popup/error-popup.component";
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from "rxjs";

export interface GeneralSettings {
  defaultBackgroundColor: string;
  defaultFontColor: string;
  defaultChordFontColor: string;
  defaultBlankPage: string | null;
  autoplayHideDelaySeconds: number;
}

@Component({
  selector: "app-general-settings",
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, ErrorPopupComponent],
  templateUrl: "./general-settings.component.html",
  styleUrls: ["./general-settings.component.scss"]
})
export class GeneralSettingsComponent implements OnInit {
  settings: GeneralSettings = {
    defaultBackgroundColor: "#000000",
    defaultFontColor: "#FFFFFF",
    defaultChordFontColor: "#FFD700",
    defaultBlankPage: null,
    autoplayHideDelaySeconds: 5
  };

  libraryItems: LibraryItem[] = [];
  loading: boolean = false;
  saving: boolean = false;

  // Search for blank page
  blankPageSearchTerm: string = "";
  blankPageSearchResults: LibraryItem[] = [];
  showBlankPageSearchResults: boolean = false;
  selectedBlankPageItem: LibraryItem | null = null;
  private blankPageSearchSubject = new Subject<string>();

  // Error popup
  showError: boolean = false;
  errorMessage: string = "";

  constructor(
    private settingsService: SettingsService,
    private playlistService: PlaylistService,
    private userService: UserService,
    private authService: AuthService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    
    // Setup search with debounce
    this.blankPageSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((searchTerm) => {
        if (searchTerm.trim().length === 0) {
          this.blankPageSearchResults = [];
          this.showBlankPageSearchResults = false;
          return of([]);
        }
        return this.playlistService.searchLibraryItems(searchTerm);
      })
    ).subscribe({
      next: (results) => {
        this.blankPageSearchResults = results;
        this.showBlankPageSearchResults = results.length > 0 || this.blankPageSearchTerm.trim().length > 0;
      },
      error: (error) => {
        console.error("Error searching library items:", error);
        this.blankPageSearchResults = [];
        this.showBlankPageSearchResults = false;
      }
    });
  }

  hasViewPermission(): boolean {
    return this.userService.hasPermission("ViewGeneralSettings");
  }

  hasEditPermission(): boolean {
    return this.userService.hasPermission("EditGeneralSettings");
  }

  loadSettings(): void {
    if (!this.hasViewPermission()) {
      return;
    }

    this.loading = true;
    const username = this.authService.getStoredUsername();
    if (!username) {
      this.showErrorPopup(this.translationService.translate('notAuthenticated'));
      this.loading = false;
      return;
    }

    this.settingsService.getGeneralSettings(username).subscribe({
      next: (settings) => {
        this.settings = {
          defaultBackgroundColor: settings.defaultBackgroundColor || "#000000",
          defaultFontColor: settings.defaultFontColor || "#FFFFFF",
          defaultChordFontColor: settings.defaultChordFontColor || "#FFD700",
          defaultBlankPage: settings.defaultBlankPage || null,
          autoplayHideDelaySeconds: parseInt(settings.autoplayHideDelaySeconds || '5', 10) || 5
        };
        this.loadSelectedBlankPageItem();
        this.loading = false;
      },
      error: (error) => {
        console.error("Error loading settings:", error);
        this.showErrorPopup(this.translationService.translate('errorLoadingSettings'));
        this.loading = false;
      }
    });
  }

  onBlankPageSearchChange(): void {
    this.blankPageSearchSubject.next(this.blankPageSearchTerm);
  }

  onBlankPageSearchResultSelect(item: LibraryItem): void {
    this.selectedBlankPageItem = item;
    this.settings.defaultBlankPage = item.guid.toString();
    this.blankPageSearchTerm = "";
    this.showBlankPageSearchResults = false;
    this.blankPageSearchResults = [];
  }

  loadSelectedBlankPageItem(): void {
    if (this.settings.defaultBlankPage) {
      const guid = parseInt(this.settings.defaultBlankPage, 10);
      if (!isNaN(guid)) {
        this.playlistService.getLibraryItemByGuid(guid).subscribe({
          next: (item) => {
            if (item) {
              this.selectedBlankPageItem = item;
            }
          },
          error: (error) => {
            console.error("Error loading selected blank page item:", error);
          }
        });
      }
    }
  }

  saveSettings(): void {
    if (!this.hasEditPermission()) {
      this.showErrorPopup(this.translationService.translate('noPermissionToEditSettings'));
      return;
    }

    this.saving = true;
    const username = this.authService.getStoredUsername();
    if (!username) {
      this.showErrorPopup(this.translationService.translate('notAuthenticated'));
      this.saving = false;
      return;
    }

    this.settingsService.updateGeneralSettings(username, this.settings).subscribe({
      next: (updatedSettings) => {
        this.settings = {
          defaultBackgroundColor: updatedSettings.defaultBackgroundColor || "#000000",
          defaultFontColor: updatedSettings.defaultFontColor || "#FFFFFF",
          defaultChordFontColor: updatedSettings.defaultChordFontColor || "#FFD700",
          defaultBlankPage: updatedSettings.defaultBlankPage || null,
          autoplayHideDelaySeconds: parseInt(updatedSettings.autoplayHideDelaySeconds || '5', 10) || 5
        };
        this.saving = false;
        // Show success message (you can add a success popup if needed)
      },
      error: (error) => {
        console.error("Error saving settings:", error);
        this.showErrorPopup(this.translationService.translate('errorSavingSettings'));
        this.saving = false;
      }
    });
  }

  clearBlankPage(): void {
    this.settings.defaultBlankPage = null;
    this.selectedBlankPageItem = null;
    this.blankPageSearchTerm = "";
    this.showBlankPageSearchResults = false;
  }

  changeBlankPage(): void {
    this.selectedBlankPageItem = null;
    this.blankPageSearchTerm = "";
    this.showBlankPageSearchResults = false;
  }

  clearBlankPageSearch(): void {
    this.blankPageSearchTerm = "";
    this.showBlankPageSearchResults = false;
    this.blankPageSearchResults = [];
    this.blankPageSearchSubject.next("");
  }

  showErrorPopup(message: string): void {
    this.errorMessage = message;
    this.showError = true;
  }

  closeErrorPopup(): void {
    this.showError = false;
    this.errorMessage = "";
  }
}

