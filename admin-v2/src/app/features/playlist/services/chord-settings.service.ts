import { Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class ChordSettingsService {
  private chordTransposition: number = 0;
  private chordDisplayState: 'local' | 'everywhere' | 'hidden' = 'hidden';

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
  }

  /**
   * Reset chord transposition to 0
   */
  resetChordTransposition(): void {
    this.chordTransposition = 0;
  }
}

