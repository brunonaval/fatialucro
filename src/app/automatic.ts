export type AutomaticState<T> = { signature: string; phase: 'waiting' | 'processing' | 'ready' | 'invalid'; output?: T; error?: string };
export class AutomaticCalculation<I, O> {
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stop: (() => void) | undefined;
  constructor(private readonly launch: (input: I, done: (value: O) => void, fail: (message: string) => void) => () => void,
    private readonly changed: (state: AutomaticState<O>) => void, private readonly delay = 450) {}
  cancel() { this.generation++; if (this.timer !== undefined) clearTimeout(this.timer); this.timer = undefined; this.stop?.(); this.stop = undefined; }
  schedule(signature: string, input: I, immediate = false) {
    this.cancel(); const current = this.generation; this.changed({ signature, phase: 'waiting' });
    this.timer = setTimeout(() => {
      this.timer = undefined; if (current !== this.generation) return;
      this.changed({ signature, phase: 'processing' });
      try { this.stop = this.launch(input, output => { if (current === this.generation) this.changed({ signature, phase: 'ready', output }); }, error => { if (current === this.generation) this.changed({ signature, phase: 'invalid', error }); }); }
      catch (error) { if (current === this.generation) this.changed({ signature, phase: 'invalid', error: error instanceof Error ? error.message : 'Confira os dados informados.' }); }
    }, immediate ? 0 : this.delay);
  }
}
