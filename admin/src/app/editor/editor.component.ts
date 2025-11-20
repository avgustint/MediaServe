import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-editor",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./editor.component.html",
  styleUrls: ["./editor.component.scss"]
})
export class EditorComponent {
  constructor() {}
}

