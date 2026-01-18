import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class KeyboardCommandService {
  private numberKeyReceivedSubject = new Subject<void>();
  public numberKeyReceived$ = this.numberKeyReceivedSubject.asObservable();
  
  private numberKeyQueueSubject = new Subject<string>();
  public numberKeyQueue$ = this.numberKeyQueueSubject.asObservable();

  notifyNumberKeyReceived(): void {
    this.numberKeyReceivedSubject.next();
  }

  queueNumberKey(key: string): void {
    this.numberKeyQueueSubject.next(key);
  }
}

