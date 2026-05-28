/**
 * Tiny promise-based mutex. Used to serialize matchmaking critical
 * sections + showcase staging — same role Python's `threading.Lock`
 * plays in the Flask app.
 *
 * Usage:
 *   const m = new Mutex();
 *   await m.runExclusive(async () => { ... });
 */
export class Mutex {
  private _last: Promise<void> = Promise.resolve();

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this._last;
    this._last = next;
    await previous;
    try {
      return await fn();
    } finally {
      release!();
    }
  }
}
