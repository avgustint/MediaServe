import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-redirect',
  standalone: true,
  imports: [CommonModule],
  template: '<div></div>'
})
export class RedirectComponent implements OnInit {
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Redirect based on authentication status
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/playlist']);
    } else {
      this.router.navigate(['/login']);
    }
  }
}



