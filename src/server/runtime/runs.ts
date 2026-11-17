// The scripts running now, by the window that started them: Stop in a
// window stops its runs, a window closing or the project turning Widgets
// off stops theirs, and while any runs the part stays up (idle, the server
// would stop it, and the run with it).

export class Runs {
  readonly #byWindow = new Map<string, Set<AbortController>>();

  #key(project: string, window: number) {
    return `${project}\u0000${window}`;
  }

  /** A run starting: its controller, and the end to call when it's over. */
  start(project: string, window: number): { signal: AbortSignal; end(): void } {
    const key = this.#key(project, window);
    const ctrl = new AbortController();
    let set = this.#byWindow.get(key);
    if (!set) {
      set = new Set();
      this.#byWindow.set(key, set);
    }
    set.add(ctrl);
    return {
      signal: ctrl.signal,
      end: () => {
        set.delete(ctrl);
        if (!set.size && this.#byWindow.get(key) === set) this.#byWindow.delete(key);
      },
    };
  }

  /** Stops a window's runs; how many there were. */
  stop(project: string, window: number): number {
    const set = this.#byWindow.get(this.#key(project, window));
    if (!set) return 0;
    const n = set.size;
    for (const c of set) c.abort();
    return n;
  }

  /** Stops every run in a project (every run, without one). */
  stopAll(project?: string) {
    for (const [key, set] of this.#byWindow) if (!project || key.startsWith(`${project}\u0000`)) for (const c of set) c.abort();
  }

  get busy(): boolean {
    return this.#byWindow.size > 0;
  }
}
