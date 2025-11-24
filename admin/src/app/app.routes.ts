import { Routes } from "@angular/router";
import { LoginComponent } from "./login/login.component";
import { PlaylistComponent } from "./playlist/playlist/playlist.component";
import { EditorComponent } from "./editor/editor.component";
import { SettingsComponent } from "./settings/settings.component";
import { DisplayComponent } from "./display/display.component";
import { UserProfileComponent } from "./user-profile/user-profile.component";
import { RedirectComponent } from "./redirect/redirect.component";
import { authGuard } from "./auth.guard";
import { permissionGuard } from "./permission.guard";

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
    path: "display",
    component: DisplayComponent,
    canActivate: [authGuard, permissionGuard('ViewDisplay')]
  },
  {
    path: "user",
    component: UserProfileComponent,
    canActivate: [authGuard]
  },
  {
    path: "",
    component: RedirectComponent,
    pathMatch: "full"
  }
];
