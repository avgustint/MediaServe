import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "../../../core/services/api.service";

export interface Page {
  guid: number | string;
  content: string;
  type?: 'text' | 'image' | 'url' | 'video' | 'iframe';
  css?: string | { [key: string]: string };
  duration?: number | null;
  isTemporal?: boolean;
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

  createPage(content: string = '', type: 'text' | 'image' | 'url' | 'video' | 'iframe' = 'text', css?: string | object | null, duration?: number | null): Observable<Page> {
    return this.apiService.post<Page>('/pages', { content, type, css: css ?? undefined, duration: duration ?? undefined });
  }

  updatePage(guid: number, content: string, type?: 'text' | 'image' | 'url' | 'video' | 'iframe', css?: string | object | null, duration?: number | null): Observable<Page> {
    const body: { content: string; type?: string; css?: string | object; duration?: number | null } = { content };
    if (type != null) {
      body.type = type;
    }
    if (css !== undefined) {
      body.css = css ?? undefined;
    }
    if (duration !== undefined) {
      body.duration = duration ?? undefined;
    }
    return this.apiService.put<Page>(`/pages/${guid}`, body);
  }

  deletePage(guid: number): Observable<void> {
    return this.apiService.delete<void>(`/pages/${guid}`);
  }
}
