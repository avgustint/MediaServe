import { Injectable } from "@angular/core";

const CHORD_DISPLAY_STATE_KEY = 'admin_chordDisplayState';

@Injectable({
  providedIn: 'root'
})
export class ChordSettingsService {
  private chordTransposition: number = 0;
  private chordDisplayState: 'local' | 'everywhere' | 'hidden' = this.loadChordDisplayState();

  private loadChordDisplayState(): 'local' | 'everywhere' | 'hidden' {
    const stored = localStorage.getItem(CHORD_DISPLAY_STATE_KEY);
    if (stored === 'local' || stored === 'everywhere' || stored === 'hidden') {
      return stored;
    }
    return 'hidden';
  }

  /**
   * Get the current chord transposition value
   */
  getChordTransposition(): number {
    return this.chordTransposition;
  }

  /**
   * Set the chord transposition value
   */
  setChordTransposition(value: number): void {
    this.chordTransposition = value;
  }

  /**
   * Get the current chord display state
   */
  getChordDisplayState(): 'local' | 'everywhere' | 'hidden' {
    return this.chordDisplayState;
  }

  /**
   * Set the chord display state
   */
  setChordDisplayState(state: 'local' | 'everywhere' | 'hidden'): void {
    this.chordDisplayState = state;
    localStorage.setItem(CHORD_DISPLAY_STATE_KEY, state);
  }

  /**
   * Reset chord transposition to 0
   */
  resetChordTransposition(): void {
    this.chordTransposition = 0;
  }
}

