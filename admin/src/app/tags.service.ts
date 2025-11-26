import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "./api.service";

export interface Tag {
  guid: number;
  name: string;
  description?: string;
}

export interface TagUsageInfo {
  isUsed: boolean;
  itemCount: number;
}

@Injectable({
  providedIn: "root"
})
export class TagsService {
  constructor(private apiService: ApiService) {}

  getAllTags(): Observable<Tag[]> {
    return this.apiService.get<Tag[]>('/tags');
  }

  getTag(guid: number): Observable<Tag | null> {
    return this.apiService.get<Tag | null>(`/tags/${guid}`);
  }

  createTag(tag: Partial<Tag>): Observable<Tag> {
    return this.apiService.post<Tag>('/tags', tag);
  }

  updateTag(guid: number, tag: Partial<Tag>): Observable<Tag> {
    return this.apiService.put<Tag>(`/tags/${guid}`, tag);
  }

  deleteTag(guid: number): Observable<void> {
    return this.apiService.delete<void>(`/tags/${guid}`);
  }

  checkTagUsage(guid: number): Observable<TagUsageInfo> {
    return this.apiService.get<TagUsageInfo>(`/tags/${guid}/usage`);
  }
}

