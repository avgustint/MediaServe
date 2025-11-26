import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { LocationsService, Location } from "../../locations.service";
import { UserService } from "../../user.service";
import { ErrorPopupComponent } from "../../shared/error-popup/error-popup.component";
import { ConfirmDialogComponent } from "../../shared/confirm-dialog/confirm-dialog.component";
import { TranslatePipe } from "../../translation.pipe";
import { TranslationService } from "../../translation.service";
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, of } from "rxjs";
import { HttpErrorResponse } from "@angular/common/http";

import { InputTextModule } from "primeng/inputtext";
import { TextareaModule } from "primeng/textarea";

@Component({
  selector: "app-locations-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, ErrorPopupComponent, ConfirmDialogComponent, TranslatePipe, InputTextModule, TextareaModule],
  templateUrl: "./locations-editor.component.html",
  styleUrls: ["./locations-editor.component.scss"]
})
export class LocationsEditorComponent implements OnInit, OnDestroy {
  searchTerm: string = "";
  allLocations: Location[] = [];
  filteredLocations: Location[] = [];
  
  editingLocation: Location | null = null;
  isNewLocation: boolean = false;

  // Form fields
  locationName: string = "";
  locationDescription: string = "";

  // Error popup
  showError: boolean = false;
  errorMessage: string = "";

  // Confirm dialog
  showConfirmDialog: boolean = false;
  confirmDialogTitle: string = "";
  confirmDialogMessage: string = "";
  locationToDeleteGuid: number | null = null;
  
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  hasManageLocationsPermission: boolean = false;

  constructor(
    private locationsService: LocationsService,
    private userService: UserService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.hasManageLocationsPermission = this.userService.hasPermission("ManageLocations");
    this.loadData();
    
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((searchTerm) => {
        return of(this.filterLocations(searchTerm));
      })
    ).subscribe({
      next: (filtered) => {
        this.filteredLocations = filtered;
      }
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  loadData(): void {
    this.locationsService.getAllLocations().subscribe({
      next: (locations) => {
        this.allLocations = locations;
        this.filteredLocations = locations;
      },
      error: (error) => {
        console.error("Error loading locations:", error);
        this.showErrorPopup(this.translationService.translate('errorLoadingData'));
      }
    });
  }

  filterLocations(searchTerm: string): Location[] {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return this.allLocations;
    }
    const term = searchTerm.toLowerCase().trim();
    return this.allLocations.filter(location => 
      location.name.toLowerCase().includes(term) ||
      (location.description && location.description.toLowerCase().includes(term))
    );
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  clearSearch(): void {
    this.searchTerm = "";
    this.searchSubject.next("");
  }

  addNewLocation(): void {
    this.isNewLocation = true;
    this.editingLocation = null;
    this.locationName = "";
    this.locationDescription = "";
  }

  selectLocation(location: Location): void {
    this.isNewLocation = false;
    this.editingLocation = { ...location };
    this.locationName = location.name;
    this.locationDescription = location.description || "";
  }

  cancelEdit(): void {
    this.editingLocation = null;
    this.isNewLocation = false;
    this.locationName = "";
    this.locationDescription = "";
    this.loadData();
  }

  saveLocation(): void {
    if (!this.locationName.trim()) {
      this.showErrorPopup(this.translationService.translate('nameRequired'));
      return;
    }

    const locationData: Partial<Location> = {
      name: this.locationName.trim(),
      description: this.locationDescription.trim() || undefined
    };

    if (this.isNewLocation) {
      this.locationsService.createLocation(locationData).subscribe({
        next: (newLocation) => {
          this.showErrorPopup(this.translationService.translate('locationSaved'));
          this.cancelEdit();
        },
        error: (error: HttpErrorResponse) => {
          console.error("Error creating location:", error);
          const errorMessage = error.error?.message || this.translationService.translate('errorSavingLocation');
          this.showErrorPopup(errorMessage);
        }
      });
    } else if (this.editingLocation) {
      this.locationsService.updateLocation(this.editingLocation.guid, locationData).subscribe({
        next: (updatedLocation) => {
          this.showErrorPopup(this.translationService.translate('locationSaved'));
          this.cancelEdit();
        },
        error: (error: HttpErrorResponse) => {
          console.error("Error updating location:", error);
          const errorMessage = error.error?.message || this.translationService.translate('errorSavingLocation');
          this.showErrorPopup(errorMessage);
        }
      });
    }
  }

  deleteLocation(location: Location): void {
    this.locationToDeleteGuid = location.guid;
    this.confirmDialogTitle = this.translationService.translate('deleteLocation');
    this.confirmDialogMessage = `${this.translationService.translate('deleteLocationConfirm')} "${location.name}"? ${this.translationService.translate('thisActionCannotBeUndone')}`;
    this.showConfirmDialog = true;
  }

  onConfirmDelete(): void {
    if (this.locationToDeleteGuid !== null) {
      this.locationsService.deleteLocation(this.locationToDeleteGuid).subscribe({
        next: () => {
          this.showErrorPopup(this.translationService.translate('locationDeleted'));
          this.closeConfirmDialog();
          this.loadData();
        },
        error: (error: HttpErrorResponse) => {
          console.error("Error deleting location:", error);
          const errorMessage = error.error?.message || this.translationService.translate('errorDeletingLocation');
          this.showErrorPopup(errorMessage);
          this.closeConfirmDialog();
        }
      });
    }
  }

  closeConfirmDialog(): void {
    this.showConfirmDialog = false;
    this.locationToDeleteGuid = null;
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

