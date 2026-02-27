import { Injectable } from "@angular/core";
import { forkJoin, map, Observable, switchMap, of } from "rxjs";
import { ApiService } from "../../../core/services/api.service";

export interface PlaylistItem {
  name: string;
  type: "text" | "image" | "url" | "video" | "iframe";
  content: string;
  guid: number;
  page?: number;
}

export interface LibraryContent {
  page: number;
  type?: 'text' | 'image' | 'url' | 'video' | 'iframe';
  content: string;
  duration?: number | null;
}

export interface LibraryItem {
  name: string;
  type: "text" | "image" | "url" | "video" | "iframe";
  content?: string | LibraryContent[];
  guid: number;
  description?: string;
  pages?: number[];
  duration?: number | null;
  modified?: string;
  background_color?: string;
  font_color?: string;
  css?: { [key: string]: string }; // CSS custom properties object
  author?: string;
  tags?: Array<{ guid: number; name: string; description?: string }>;
}

export interface Playlist {
  name: string;
  description: string;
  guid: number;
  updated?: string;
  items: Array<{
    guid: number;
    page?: number;
    pages?: number[];
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
    return this.apiService.get<LibraryItem[]>('/playlist/items', guid ? { guid: guid.toString() } : undefined);
  }

  searchPlaylists(searchTerm: string): Observable<PlaylistSearchResult[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
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

  createPlaylist(playlist: Partial<Playlist>): Observable<Playlist> {
    return this.apiService.post<Playlist>('/playlists', playlist);
  }

  updatePlaylist(playlist: Playlist): Observable<Playlist> {
    return this.apiService.put<Playlist>(`/playlists/${playlist.guid}`, playlist);
  }

  deletePlaylist(guid: number): Observable<void> {
    return this.apiService.delete<void>(`/playlists/${guid}`);
  }

  checkLibraryItemUsage(guid: number): Observable<{ isUsed: boolean; playlists: Array<{ guid: number; name: string }> }> {
    return this.apiService.get<{ isUsed: boolean; playlists: Array<{ guid: number; name: string }> }>(
      `/library/${guid}/usage`
    );
  }

  deleteLibraryItem(guid: number): Observable<void> {
    return this.apiService.delete<void>(`/library/${guid}`);
  }
}
