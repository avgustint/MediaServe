import { Routes } from "@angular/router";
import { LoginComponent } from "./login/login.component";
import { PlaylistComponent } from "./playlist/playlist/playlist.component";
import { EditorComponent } from "./editor/editor.component";
import { SettingsComponent } from "./settings/settings.component";
import { RedirectComponent } from "./redirect/redirect.component";
import { authGuard } from "./auth.guard";

export const routes: Routes = [
  {
    path: "login",
    component: LoginComponent
  },
  {
    path: "playlist",
    component: PlaylistComponent,
    canActivate: [authGuard]
  },
  {
    path: "editor",
    component: EditorComponent,
    canActivate: [authGuard]
  },
  {
    path: "settings",
    component: SettingsComponent,
    canActivate: [authGuard]
  },
  {
    path: "",
    component: RedirectComponent,
    pathMatch: "full"
  }
];
