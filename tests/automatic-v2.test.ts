import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutomaticCalculation } from '../src/app/automatic';
import type { AutomaticState } from '../src/app/automatic';

afterEach(() => vi.useRealTimers());
describe('recálculo automático sem resultados antigos', () => {
  function harness() {
    vi.useFakeTimers(); const states: AutomaticState<number>[] = [];
    const jobs: { input: number; done: (value: number) => void; fail: (message: string) => void; stop: ReturnType<typeof vi.fn> }[] = [];
    const automatic = new AutomaticCalculation<number, number>((input, done, fail) => { const stop = vi.fn(); jobs.push({ input, done, fail, stop }); return stop; }, state => states.push(state));
    return { automatic, jobs, states };
  }
  it('aguarda uma pausa e executa somente a última edição', () => {
    const { automatic, jobs, states } = harness();
    automatic.schedule('preço1', 1); vi.advanceTimersByTime(300); automatic.schedule('preço2', 2);
    vi.advanceTimersByTime(449); expect(jobs).toHaveLength(0); expect(states.at(-1)).toEqual({ signature: 'preço2', phase: 'waiting' });
    vi.advanceTimersByTime(1); expect(jobs.map(job => job.input)).toEqual([2]); jobs[0]!.done(4);
    expect(states.at(-1)).toEqual({ signature: 'preço2', phase: 'ready', output: 4 }); automatic.cancel();
  });
  it('oculta o resultado imediatamente e cancela/ignora respostas de uma operação antiga', () => {
    const { automatic, jobs, states } = harness(); automatic.schedule('a', 1, true); vi.advanceTimersByTime(0); jobs[0]!.done(2);
    automatic.schedule('b', 3); expect(jobs[0]!.stop).toHaveBeenCalledOnce();
    expect(states.at(-1)).toEqual({ signature: 'b', phase: 'waiting' });
    jobs[0]!.done(100); jobs[0]!.fail('erro antigo'); expect(states.at(-1)?.signature).toBe('b'); expect(states.at(-1)?.output).toBeUndefined();
    vi.advanceTimersByTime(450); jobs[1]!.fail('Peso ausente'); expect(states.at(-1)).toEqual({ signature: 'b', phase: 'invalid', error: 'Peso ausente' }); automatic.cancel();
  });
  it('cancelar ao sair impede inicialização pendente e respostas posteriores', () => {
    const { automatic, jobs, states } = harness(); automatic.schedule('a', 1); automatic.cancel(); vi.runAllTimers(); expect(jobs).toHaveLength(0);
    automatic.schedule('b', 2, true); vi.advanceTimersByTime(0); automatic.cancel(); const count = states.length; jobs[0]!.done(5); expect(states).toHaveLength(count);
  });
  it('transforma falha síncrona em erro de entrada, sem recuperar resultado anterior', () => {
    vi.useFakeTimers(); const states: AutomaticState<number>[] = [];
    const automatic = new AutomaticCalculation<number, number>(() => { throw new Error('Quantidade inválida'); }, state => states.push(state));
    automatic.schedule('invalid', 0, true); vi.advanceTimersByTime(0);
    expect(states.at(-1)).toEqual({ signature: 'invalid', phase: 'invalid', error: 'Quantidade inválida' }); automatic.cancel();
  });
});
