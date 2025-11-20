import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { forkJoin, map, Observable, switchMap } from "rxjs";

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
}

@Injectable({
  providedIn: "root"
})
export class PlaylistService {
  private readonly API_URL = "http://localhost:8080";

  constructor(private http: HttpClient) {}

  getPlaylist(): Observable<PlaylistItem[]> {
    // Load playlist.json first
    return forkJoin([
      this.http.get<{ guid: number; page?: number }[]>(`${this.API_URL}/playlist.json`),
      this.http.get<LibraryItem[]>(`${this.API_URL}/library.json`)
    ]).pipe(
      map(([playlist, library]) => {
        const playlistItems: PlaylistItem[] = playlist.map((item) => {
          const libraryItem: LibraryItem = library.find((libItem) => libItem.guid === item.guid) || {
            name: "",
            type: "text",
            content: "",
            guid: item.guid
          };
          let content = libraryItem?.content as string | LibraryContent[];
          if (libraryItem?.type === "text" && item.page !== undefined) {
            content =
              (content as LibraryContent[]).find((contentItem) => contentItem.page === item.page)?.content || "";
          }
          return {
            name: libraryItem.name,
            type: libraryItem.type,
            content: content as string,
            guid: item.guid,
            page: item.page
          };
        });
        return playlistItems;
      })
    );
  }
}
