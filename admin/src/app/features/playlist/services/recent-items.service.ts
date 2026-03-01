import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

export interface RecentItem {
  guid: number;
  name: string;
  type: string;
  description?: string;
  tags?: Array<{ guid: number; name: string }>;
  selectedAt: number;
}

const STORAGE_KEY = "recentlySelectedItems";
const MAX_ITEMS = 20;

@Injectable({ providedIn: "root" })
export class RecentItemsService {
  private recentItemsSubject = new BehaviorSubject<RecentItem[]>(this.loadFromStorage());
  public recentItems$ = this.recentItemsSubject.asObservable();

  addItem(item: { guid: number; name: string; type: string; description?: string; tags?: Array<{ guid: number; name: string; description?: string }> }): void {
    let items = this.recentItemsSubject.value.filter(i => i.guid !== item.guid);
    const tags = item.tags?.map(t => ({ guid: t.guid, name: t.name }));
    items.unshift({
      guid: item.guid,
      name: item.name,
      type: item.type,
      description: item.description,
      tags,
      selectedAt: Date.now()
    });
    if (items.length > MAX_ITEMS) {
      items = items.slice(0, MAX_ITEMS);
    }
    this.saveToStorage(items);
    this.recentItemsSubject.next(items);
  }

  getItems(): RecentItem[] {
    return this.recentItemsSubject.value;
  }

  private loadFromStorage(): RecentItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveToStorage(items: RecentItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // localStorage full or unavailable
    }
  }
}
