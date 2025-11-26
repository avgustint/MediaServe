import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "./api.service";

export interface Page {
  guid: number | string; // Negative numbers or strings for temporal/unsaved pages
  content: string;
  isTemporal?: boolean; // Flag to indicate if page is not yet saved to database
}

@Injectable({
  providedIn: "root"
})
export class PagesService {
  constructor(private apiService: ApiService) {}

  getAllPages(): Observable<Page[]> {
    return this.apiService.get<Page[]>('/pages');
  }

  getPagesForLibraryItem(libraryItemGuid: number): Observable<Page[]> {
    return this.apiService.get<Page[]>(`/pages/library-item/${libraryItemGuid}`);
  }

  getPage(guid: number): Observable<Page | null> {
    return this.apiService.get<Page | null>(`/pages/${guid}`);
  }

  createPage(content: string = ''): Observable<Page> {
    return this.apiService.post<Page>('/pages', { content });
  }

  updatePage(guid: number, content: string): Observable<Page> {
    return this.apiService.put<Page>(`/pages/${guid}`, { content });
  }

  deletePage(guid: number): Observable<void> {
    return this.apiService.delete<void>(`/pages/${guid}`);
  }
}

