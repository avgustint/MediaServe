import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { forkJoin, map, Observable, switchMap, of } from "rxjs";

export interface PlaylistItem {
  name: string;
  type: "text" | "image" | "url";
  content: string;
  guid: number;
  page?: number;
}

export interface LibraryContent {
  page: number;
  content: string;
}

export interface LibraryItem {
  name: string;
  type: "text" | "image" | "url";
  content: string | LibraryContent[];
  guid: number;
  description?: string;
}

export interface Playlist {
  name: string;
  description: string;
  guid: number;
  updated?: string;
  items: Array<{
    guid: number;
    page?: number;
    description?: string;
  }>;
}

export interface PlaylistSearchResult {
  guid: number;
  name: string;
  description: string;
}

@Injectable({
  providedIn: "root"
})
export class PlaylistService {
  private readonly API_URL = "http://localhost:8080";

  constructor(private http: HttpClient) {}

  getPlaylist(guid?: number): Observable<LibraryItem[]> {
    // Build URL with optional guid parameter
    let url = `${this.API_URL}/playlist.json`;
    if (guid) {
      url += `?guid=${guid}`;
    }
    
    // Load playlist.json first
    return forkJoin([
      this.http.get<Playlist>(url),
      this.http.get<LibraryItem[]>(`${this.API_URL}/library.json`)
    ]).pipe(
      map(([playlistData, library]) => {
        // Compose playlist array by matching playlist items guids to items from the library.
        return playlistData.items
          .map((playlistItem) => {
            const libItem = library.find((lib) => lib.guid === playlistItem.guid);
            // fallback in case a library item doesn't exist for guid
            const baseItem = libItem || {
              name: "",
              type: "text",
              content: "",
              guid: playlistItem.guid,
            };
            // Preserve description from playlist.json if it exists, otherwise use library item description
            return {
              ...baseItem,
              description: playlistItem.description !== undefined ? playlistItem.description : baseItem.description
            };
          });
      })
    );
  }

  searchPlaylists(searchTerm: string): Observable<PlaylistSearchResult[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      // Return empty array if no search term
      return of([]);
    }
    
    const encodedSearchTerm = encodeURIComponent(searchTerm.trim());
    return this.http.get<PlaylistSearchResult[]>(
      `${this.API_URL}/playlists/search?q=${encodedSearchTerm}`
    );
  }
}
