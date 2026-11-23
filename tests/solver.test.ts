import { describe, expect, it } from 'vitest';
import { calculatePricing, solvePrice } from '../src/engine';
import { catalog, rule, sale } from './helpers';

describe('preços mínimos por busca em centavos', () => {
  it('resolve lucro-alvo e verifica o centavo anterior', () => {
    const input = sale({ packagingPerOrder: '2' });
    const rates = catalog([rule({ formula: { kind: 'percentage', rate: '20' } })]);
    const result = solvePrice(input, () => rates, { kind: 'profit', amount: '3' }, { min: '1', max: '10' });
    expect(result).toMatchObject({ status: 'found', unitPrice: '6.25', result: { operatingProfit: '3.00' } });
    expect(calculatePricing({ ...input, unitPrice: '6.24' }, rates).operatingProfit).toBe('2.99');
  });
  it('resolve margem com comparação exata antes de arredondar o percentual', () => {
    const result = solvePrice(sale({ packagingPerOrder: '2' }), () => catalog(), { kind: 'margin', ratio: '0.5' }, { min: '3', max: '5' });
    expect(result).toMatchObject({ status: 'found', unitPrice: '4.00', result: { margin: '0.500000000000' } });
  });
  it('não presume monotonicidade em faixas com saltos', () => {
    const rates = catalog([rule({ formula: { kind: 'tiered', bands: [
      { from: '0', to: '5', formula: { kind: 'fixed', amount: '0' } },
      { from: '5', to: null, formula: { kind: 'fixed', amount: '100' } },
    ] } })]);
    expect(solvePrice(sale(), () => rates, { kind: 'profit', amount: '4.50' }, { min: '4', max: '6' })).toMatchObject({ status: 'found', unitPrice: '4.50' });
  });
  it('não pula uma região desconhecida para prometer mínimo', () => {
    expect(solvePrice(sale(), () => catalog([rule({ formula: null })]), { kind: 'profit', amount: '1' }, { min: '1', max: '2' }).status).toBe('partial');
  });
  it('sinaliza meta inviável dentro do intervalo', () => {
    expect(solvePrice(sale(), () => catalog(), { kind: 'profit', amount: '100' }, { min: '0.01', max: '1' })).toMatchObject({ status: 'not-found', examined: 100 });
  });
  it('respeita quantidade e descontos fixos', () => {
    const result = solvePrice(sale({ quantity: 2, sellerDiscount: '2' }), () => catalog(), { kind: 'profit', amount: '2' }, { min: '0', max: '3' });
    expect(result).toMatchObject({ status: 'found', unitPrice: '2.00' });
  });
  it('rejeita busca ilimitada e margem impossível', () => {
    expect(() => solvePrice(sale(), () => catalog(), { kind: 'profit', amount: '1' }, { min: '0', max: '2000' })).toThrow('intervalo');
    expect(() => solvePrice(sale(), () => catalog(), { kind: 'margin', ratio: '1' })).toThrow('Margem');
  });
});
