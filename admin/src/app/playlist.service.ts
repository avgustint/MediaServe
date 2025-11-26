import { Injectable } from "@angular/core";
import { forkJoin, map, Observable, switchMap, of } from "rxjs";
import { ApiService } from "./api.service";

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
  background_color?: string; // Background color for display
  font_color?: string; // Font color for display
  author?: string; // Author of the library item
  tags?: Array<{ guid: number; name: string; description?: string }>; // Tags associated with this library item
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
  constructor(
    private apiService: ApiService
  ) {}

  getPlaylist(guid?: number): Observable<LibraryItem[]> {
    // Use optimized endpoint that does JOIN query on server
    return this.apiService.get<LibraryItem[]>('/playlist/items', guid ? { guid: guid.toString() } : undefined);
  }

  searchPlaylists(searchTerm: string): Observable<PlaylistSearchResult[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      // Return empty array if no search term
      return of([]);
    }
    
    return this.apiService.get<PlaylistSearchResult[]>(
      '/playlists/search',
      { q: searchTerm.trim() }
    );
  }

  getPlaylistMetadata(guid?: number): Observable<Playlist> {
    return this.apiService.get<Playlist>('/playlist', guid ? { guid: guid.toString() } : undefined);
  }

  getLibraryItems(): Observable<LibraryItem[]> {
    return this.apiService.get<LibraryItem[]>('/library');
  }

  getLibraryItemByGuid(guid: number): Observable<LibraryItem | null> {
    return this.apiService.get<LibraryItem | null>(`/library/${guid}`);
  }

  getRecentlyModifiedLibraryItems(): Observable<LibraryItem[]> {
    return this.apiService.get<LibraryItem[]>('/library/recent');
  }

  getRecentlyModifiedPlaylists(): Observable<PlaylistSearchResult[]> {
    return this.apiService.get<PlaylistSearchResult[]>('/playlists/recent');
  }

  // Editor methods for library items
  searchLibraryItems(searchTerm: string): Observable<LibraryItem[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return of([]);
    }
    
    return this.apiService.get<LibraryItem[]>(
      '/library/search',
      { q: searchTerm.trim() }
    );
  }

  createLibraryItem(item: Partial<LibraryItem & { pageGuids?: number[]; tagGuids?: number[] }>): Observable<LibraryItem> {
    return this.apiService.post<LibraryItem>('/library', item);
  }

  updateLibraryItem(item: LibraryItem & { pageGuids?: number[]; tagGuids?: number[] }): Observable<LibraryItem> {
    return this.apiService.put<LibraryItem>(`/library/${item.guid}`, item);
  }

  // Editor methods for playlists
  createPlaylist(playlist: Partial<Playlist>): Observable<Playlist> {
    return this.apiService.post<Playlist>('/playlists', playlist);
  }

  updatePlaylist(playlist: Playlist): Observable<Playlist> {
    return this.apiService.put<Playlist>(`/playlists/${playlist.guid}`, playlist);
  }

  deletePlaylist(guid: number): Observable<void> {
    return this.apiService.delete<void>(`/playlists/${guid}`);
  }

  // Check if library item is used in any playlist
  checkLibraryItemUsage(guid: number): Observable<{ isUsed: boolean; playlists: Array<{ guid: number; name: string }> }> {
    return this.apiService.get<{ isUsed: boolean; playlists: Array<{ guid: number; name: string }> }>(
      `/library/${guid}/usage`
    );
  }

  deleteLibraryItem(guid: number): Observable<void> {
    return this.apiService.delete<void>(`/library/${guid}`);
  }
}
