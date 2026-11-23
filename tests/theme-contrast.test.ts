import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');
const light = css.match(/^:root\s*\{([\s\S]*?)^\}/m)?.[1] ?? '';
const dark = css.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\}/)?.[1] ?? '';

function color(name: string): string {
  const result = light.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})\\s*;'));
  if (!result?.[1]) throw new Error('Cor ausente no tema claro: ' + name);
  return result[1];
}
function brightness(hex: string): number {
  const channels = [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}
function contrast(a: string, b: string): number {
  const lightness = [brightness(a), brightness(b)].sort((x, y) => y - x);
  return (lightness[0]! + 0.05) / (lightness[1]! + 0.05);
}

describe('tema claro inspirado no verde da impressão 3D e acessibilidade', () => {
  it('mantém ações, texto principal, links e textos secundários legíveis', () => {
    expect(contrast(color('accent'), color('on-accent'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color('accent-hover'), color('on-accent'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color('accent'), color('surface'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color('accent'), color('accent-soft'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color('text'), color('surface'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color('muted'), color('surface'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color('muted'), color('bg'))).toBeGreaterThanOrEqual(4.5);
  });
  it('mantém avisos, erros e confirmação com texto legível', () => {
    expect(contrast(color('warning-text'), color('warning-bg'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color('error'), color('error-bg'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color('success-text'), color('success-bg'))).toBeGreaterThanOrEqual(4.5);
  });
  it('mantém contorno de inputs e indicador de foco distintos das superfícies', () => {
    expect(contrast(color('input-border'), color('surface'))).toBeGreaterThanOrEqual(3);
    expect(contrast(color('ring'), color('surface'))).toBeGreaterThanOrEqual(3);
    expect(css).toContain('input:focus-visible');
    expect(css).toContain('button:focus-visible');
  });
  it('o verde vibrante é decorativo: texto de botão usa um verde mais escuro', () => {
    expect(color('brand-signal')).toBe('#00AE42');
    expect(color('accent')).not.toBe(color('brand-signal'));
    expect(contrast(color('brand-signal'), color('on-accent'))).toBeLessThan(4.5);
    expect(css).toContain('border-top: 3px solid var(--brand-signal)');
  });
  it('não altera as cores existentes do tema escuro e mantém modo sistema', () => {
    expect(dark).toContain('--accent: #8ad8b9;');
    expect(dark).toContain('--bg: #10181f;');
    expect(dark).toContain('--brand-signal: var(--accent);');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(':root:not([data-theme="light"]):not([data-theme="dark"])');
  });
});
