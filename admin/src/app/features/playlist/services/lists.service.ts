import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { ApiService } from "../../../core/services/api.service";
import { LibraryItem } from "./playlist.service";

export interface List {
  guid: number;
  name: string;
  description: string | null;
  created_at: string;
  created_by_user_guid: number;
  is_favorites: number;
}

export interface FavoritesResponse {
  list: List;
  items: LibraryItem[];
}

@Injectable({
  providedIn: "root"
})
export class ListsService {
  private readonly LAST_LIST_KEY = 'mediaserver_last_used_list_guid';

  constructor(private apiService: ApiService) {}

  getAllLists(): Observable<List[]> {
    return this.apiService.get<List[]>('/lists');
  }

  getFavorites(): Observable<FavoritesResponse> {
    return this.apiService.get<FavoritesResponse>('/lists/favorites');
  }

  getListItems(listGuid: number): Observable<LibraryItem[]> {
    return this.apiService.get<LibraryItem[]>(`/lists/${listGuid}/items`);
  }

  isItemInList(listGuid: number, libraryItemGuid: number): Observable<{ inList: boolean }> {
    return this.apiService.get<{ inList: boolean }>(`/lists/check/${listGuid}/${libraryItemGuid}`);
  }

  createList(name: string, description?: string): Observable<List> {
    return this.apiService.post<List>('/lists', { name, description: description || '' });
  }

  updateList(guid: number, data: { name: string; description?: string | null }): Observable<List> {
    return this.apiService.put<List>(`/lists/${guid}`, data);
  }

  addItemToList(listGuid: number, libraryItemGuid: number): Observable<{ success: boolean; alreadyInList?: boolean }> {
    return this.apiService.post<{ success: boolean; alreadyInList?: boolean }>(
      `/lists/${listGuid}/items`,
      { libraryItemGuid }
    );
  }

  removeItemFromList(listGuid: number, libraryItemGuid: number): Observable<{ success: boolean }> {
    return this.apiService.delete<{ success: boolean }>(`/lists/${listGuid}/items/${libraryItemGuid}`);
  }

  deleteList(listGuid: number): Observable<{ success: boolean }> {
    return this.apiService.delete<{ success: boolean }>(`/lists/${listGuid}`);
  }

  getLastUsedListGuid(): number | null {
    const stored = localStorage.getItem(this.LAST_LIST_KEY);
    return stored ? parseInt(stored, 10) : null;
  }

  setLastUsedListGuid(guid: number): void {
    localStorage.setItem(this.LAST_LIST_KEY, String(guid));
  }
}
