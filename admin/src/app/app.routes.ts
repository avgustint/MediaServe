import { Routes } from "@angular/router";
import { authGuard } from "./core/guards/auth.guard";

export const routes: Routes = [
  {
    path: "login",
    loadComponent: () => import("./features/auth/login/login.component").then(m => m.LoginComponent)
  },
  {
    path: "playlist",
    loadComponent: () => import("./features/playlist/playlist-view/playlist-view.component").then(m => m.PlaylistViewComponent),
    canActivate: [authGuard]
  },
  {
    path: "editor",
    loadComponent: () => import("./features/editor/editor.component").then(m => m.EditorComponent),
    canActivate: [authGuard]
  },
  {
    path: "settings",
    loadComponent: () => import("./features/settings/settings.component").then(m => m.SettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: "display",
    loadComponent: () => import("./features/display/display.component").then(m => m.DisplayComponent),
    canActivate: [authGuard]
  },
  {
    path: "user",
    loadComponent: () => import("./features/user-profile/user-profile.component").then(m => m.UserProfileComponent),
    canActivate: [authGuard]
  },
  {
    path: "",
    redirectTo: "/playlist",
    pathMatch: "full"
  }
];
