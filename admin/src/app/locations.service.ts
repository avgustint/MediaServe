import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "./api.service";

export interface Location {
  guid: number;
  name: string;
  description?: string;
}

@Injectable({
  providedIn: "root"
})
export class LocationsService {
  constructor(private apiService: ApiService) {}

  getAllLocations(): Observable<Location[]> {
    return this.apiService.get<Location[]>('/locations');
  }

  getLocation(guid: number): Observable<Location | null> {
    return this.apiService.get<Location | null>(`/locations/${guid}`);
  }

  createLocation(location: Partial<Location>): Observable<Location> {
    return this.apiService.post<Location>('/locations', location);
  }

  updateLocation(guid: number, location: Partial<Location>): Observable<Location> {
    return this.apiService.put<Location>(`/locations/${guid}`, location);
  }

  deleteLocation(guid: number): Observable<void> {
    return this.apiService.delete<void>(`/locations/${guid}`);
  }
}

