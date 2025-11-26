import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "./api.service";

export interface Collection {
  guid: number;
  title: string;
  label?: string;
  year?: number;
  publisher?: string;
  source?: string;
}

export interface CollectionItem {
  guid: number;
  name: string;
  type: string;
  collection_number?: number;
  collection_page?: number;
  author?: string;
}

@Injectable({
  providedIn: "root"
})
export class CollectionsService {
  constructor(private apiService: ApiService) {}

  getAllCollections(): Observable<Collection[]> {
    return this.apiService.get<Collection[]>('/collections');
  }

  getCollection(guid: number): Observable<Collection | null> {
    return this.apiService.get<Collection | null>(`/collections/${guid}`);
  }

  getCollectionItems(guid: number): Observable<CollectionItem[]> {
    return this.apiService.get<CollectionItem[]>(`/collections/${guid}/items`);
  }

  createCollection(collection: Partial<Collection>): Observable<Collection> {
    return this.apiService.post<Collection>('/collections', collection);
  }

  updateCollection(guid: number, collection: Partial<Collection>): Observable<Collection> {
    return this.apiService.put<Collection>(`/collections/${guid}`, collection);
  }

  deleteCollection(guid: number): Observable<void> {
    return this.apiService.delete<void>(`/collections/${guid}`);
  }

  addItemToCollection(collectionGuid: number, libraryItemGuid: number, itemData: {
    collection_number?: number;
    collection_page?: number;
    author?: string;
  }): Observable<any> {
    return this.apiService.post(
      `/collections/${collectionGuid}/items`,
      { library_item_guid: libraryItemGuid, ...itemData }
    );
  }

  removeItemFromCollection(collectionGuid: number, libraryItemGuid: number): Observable<void> {
    return this.apiService.delete<void>(`/collections/${collectionGuid}/items/${libraryItemGuid}`);
  }
}

