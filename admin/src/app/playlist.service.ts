import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
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
  content?: string | LibraryContent[]; // Optional - not returned for playlist items
  guid: number;
  description?: string;
  pages?: number[]; // For text items in playlists - array of page numbers to display
  modified?: string; // ISO datetime string when item was created or last modified
}

export interface Playlist {
  name: string;
  description: string;
  guid: number;
  updated?: string;
  items: Array<{
    guid: number;
    page?: number; // Legacy field for backward compatibility
    pages?: number[]; // Array of pages to use, or undefined for all pages
    description?: string;
  }>;
}

export interface PlaylistSearchResult {
  guid: number;
  name: string;
  description: string;
  updated?: string;
}

@Injectable({
  providedIn: "root"
})
export class PlaylistService {
  private readonly API_URL = "http://localhost:8080";

  constructor(private http: HttpClient) {}

  getPlaylist(guid?: number): Observable<LibraryItem[]> {
    // Build URL with optional guid parameter - use optimized endpoint
    let url = `${this.API_URL}/playlist/items`;
    if (guid) {
      url += `?guid=${guid}`;
    }
    
    // Use optimized endpoint that does JOIN query on server
    return this.http.get<LibraryItem[]>(url);
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

  getPlaylistMetadata(guid?: number): Observable<Playlist> {
    // Build URL with optional guid parameter
    let url = `${this.API_URL}/playlist`;
    if (guid) {
      url += `?guid=${guid}`;
    }
    
    return this.http.get<Playlist>(url);
  }

  getLibraryItems(): Observable<LibraryItem[]> {
    return this.http.get<LibraryItem[]>(`${this.API_URL}/library`);
  }

  getLibraryItemByGuid(guid: number): Observable<LibraryItem | null> {
    return this.http.get<LibraryItem | null>(`${this.API_URL}/library/${guid}`);
  }

  getRecentlyModifiedLibraryItems(): Observable<LibraryItem[]> {
    return this.http.get<LibraryItem[]>(`${this.API_URL}/library/recent`);
  }

  getRecentlyModifiedPlaylists(): Observable<PlaylistSearchResult[]> {
    return this.http.get<PlaylistSearchResult[]>(`${this.API_URL}/playlists/recent`);
  }

  // Editor methods for library items
  searchLibraryItems(searchTerm: string): Observable<LibraryItem[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return of([]);
    }
    
    const encodedSearchTerm = encodeURIComponent(searchTerm.trim());
    return this.http.get<LibraryItem[]>(
      `${this.API_URL}/library/search?q=${encodedSearchTerm}`
    );
  }

  createLibraryItem(item: Partial<LibraryItem>): Observable<LibraryItem> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<LibraryItem>(
      `${this.API_URL}/library`,
      item,
      { headers }
    );
  }

  updateLibraryItem(item: LibraryItem): Observable<LibraryItem> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.put<LibraryItem>(
      `${this.API_URL}/library/${item.guid}`,
      item,
      { headers }
    );
  }

  // Editor methods for playlists
  createPlaylist(playlist: Partial<Playlist>): Observable<Playlist> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<Playlist>(
      `${this.API_URL}/playlists`,
      playlist,
      { headers }
    );
  }

  updatePlaylist(playlist: Playlist): Observable<Playlist> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.put<Playlist>(
      `${this.API_URL}/playlists/${playlist.guid}`,
      playlist,
      { headers }
    );
  }

  deletePlaylist(guid: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/playlists/${guid}`);
  }

  // Check if library item is used in any playlist
  checkLibraryItemUsage(guid: number): Observable<{ isUsed: boolean; playlists: Array<{ guid: number; name: string }> }> {
    return this.http.get<{ isUsed: boolean; playlists: Array<{ guid: number; name: string }> }>(
      `${this.API_URL}/library/${guid}/usage`
    );
  }

  deleteLibraryItem(guid: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/library/${guid}`);
  }
}
