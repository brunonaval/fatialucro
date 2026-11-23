import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormContext } from '../src/ui/Fields';
import { ExperienceContext } from '../src/ui/ExperienceContext';
import { FilamentFields } from '../src/ui/CostFields';
import { strToU8, zipSync } from 'fflate';
import { applyImportedPlate, calculateExperience, newCalculationDraft } from '../src/app/experience';
import { filamentProfileDraft, matchingFilamentProfiles, reuseUniqueFilamentProfile } from '../src/app/filament-reuse';
import { parseThreeMf } from '../src/importers/three-mf';
import type { SavedEntry } from '../src/app/storage';

const archive = (files: Record<string, string>) => zipSync(Object.fromEntries(
  Object.entries(files).map(([key, value]) => [key, strToU8(value)]),
));
function importedPlate(filaments: string) {
  const parsed = parseThreeMf(archive({
    'Metadata/project_settings.config': JSON.stringify({ filament_type: ['PLA', 'PLA', 'PLA', 'PLA'] }),
    'Metadata/slice_info.config': `<config><plate><metadata key="index" value="1"/><metadata key="prediction" value="3600"/><metadata key="object_count" value="2"/>${filaments}</plate></config>`,
  }));
  return applyImportedPlate(newCalculationDraft(), parsed, parsed.plates[0]!);
}
function profile(name = 'PLA', amount = '125', id = 'saved-pla'): SavedEntry {
  const draft = newCalculationDraft();
  draft.fields.materialName = name;
  draft.ux!.filament = { mode: 'spool', amount, netGrams: '1000' };
  return { id, kind: 'filament', name, updatedAt: '2026-11-23T12:00:00Z', draft: filamentProfileDraft(draft) };
}
const oneUsed = '<filament id="1" type="PLA" used_g="22.31"/><filament id="2" type="PLA" used_g="0"/><filament id="3" type="PLA" used_g="0"/><filament id="4" type="PLA" used_g="0"/>';

describe('reutilização segura de custos de filamento após importar 3MF', () => {
  it('reaproveita o perfil salvo único de PLA e mantém peso, tempo, peças e demais campos', () => {
    const imported = importedPlate(oneUsed);
    imported.fields.price = '29.90'; imported.fields.seller = 'CPF';
    expect(imported.materials).toHaveLength(0);
    const reused = reuseUniqueFilamentProfile(imported, [profile(' PLA  ')]);
    expect(reused).toMatchObject({ matched: 1, applied: ' PLA  ' });
    expect(reused.draft.ux?.filament).toMatchObject({ amount: '125', netGrams: '1000' });
    expect(reused.draft.fields).toMatchObject({ grams: '22.31', hours: '1', pieces: '2', price: '29.90', seller: 'CPF' });
    expect(reused.draft.ux?.profileOrigins?.filament?.name).toBe(' PLA  ');
    const cost = calculateExperience(reused.draft);
    if (cost.kind !== 'cost') throw new Error('Custo deveria ser calculável após importar.');
    expect(cost.cost.total).toBe('2.79');
  });

  it('não escolhe automaticamente quando há dois perfis PLA com preços distintos', () => {
    const imported = importedPlate(oneUsed);
    const result = reuseUniqueFilamentProfile(imported, [profile('PLA', '90', 'a'), profile('PLA', '125', 'b')]);
    expect(result.matched).toBe(2);
    expect(result.applied).toBeNull();
    expect(result.draft).toBe(imported);
    expect(result.draft.ux?.filament.amount).toBe('');
  });

  it('não equipara dois filamentos PLA efetivamente consumidos a uma única bobina', () => {
    const imported = importedPlate('<filament id="1" type="PLA" used_g="15"/><filament id="2" type="PLA" used_g="7.31"/>');
    expect(imported.materials).toHaveLength(2);
    expect(matchingFilamentProfiles(imported, [profile()])).toEqual([]);
    expect(reuseUniqueFilamentProfile(imported, [profile()]).applied).toBeNull();
  });

  it('não aplica perfil de material diferente, inválido, gratuito ou excluído', () => {
    const imported = importedPlate(oneUsed);
    const deleted = { ...profile(), deletedAt: '2026-11-23T12:01:00Z' };
    const bad = profile('PLA', '125', 'bad');
    bad.draft.ux!.filament.amount = ''; // Simulate a previously saved but now invalid legacy profile.
    expect(matchingFilamentProfiles(imported, [profile('PETG'), deleted, bad, profile('PLA', '0', 'zero')])).toEqual([]);
  });

  it('salva somente os dados reutilizáveis do filamento, não produto, Shopee ou importação', () => {
    const draft = importedPlate(oneUsed);
    draft.fields.materialName = 'PLA';
    draft.fields.price = '999.99'; draft.fields.seller = 'CPF'; draft.fields.quantity = '7';
    draft.ux!.filament = { mode: 'spool', amount: '130', netGrams: '750' };
    const saved = filamentProfileDraft(draft);
    expect(saved.fields).toMatchObject({ materialName: 'PLA', price: '', seller: '', quantity: '' });
    expect(saved.ux?.origin).toBeUndefined();
    expect(saved.ux?.filament).toEqual({ mode: 'spool', amount: '130', netGrams: '750' });
    expect(saved.materials).toEqual([]);
  });

  it('trocar a placa para outro material não deixa um perfil antigo indicado ou com preço aplicado', () => {
    const first = reuseUniqueFilamentProfile(importedPlate(oneUsed), [profile()]);
    const petg = parseThreeMf(archive({
      'Metadata/slice_info.config': '<config><plate><metadata key="index" value="1"/><filament id="1" type="PETG" used_g="33"/></plate></config>',
    }));
    const changed = applyImportedPlate(first.draft, petg, petg.plates[0]!);
    expect(changed.ux?.profileOrigins?.filament).toBeUndefined();
    expect(changed.ux?.filament.amount).toBe('');
    expect(changed.fields.filament).toBe('');
    expect(reuseUniqueFilamentProfile(changed, [profile()]).applied).toBeNull();
  });

  it('a etapa de custos permite salvar o preço da bobina sem abrir configurações', () => {
    const draft = importedPlate(oneUsed);
    draft.fields.materialName = 'PLA'; draft.ux!.filament = { mode: 'spool', amount: '125', netGrams: '1000' };
    const html = renderToStaticMarkup(
      <FormContext value={{ draft, setField: () => {} }}>
        <ExperienceContext value={{ draft, update: () => {} }}>
          <FilamentFields entries={[]} onProfile={() => {}} onSave={async () => {}} />
        </ExperienceContext>
      </FormContext>,
    );
    expect(html).toContain('Salvar este filamento para próximas impressões');
    expect(html).toContain('name="materialName"');
  });

  it('não inventa um custo se ainda não houve cadastro ou se o tipo é desconhecido', () => {
    const imported = importedPlate('<filament id="1" type="PETG" used_g="22.31"/>');
    expect(reuseUniqueFilamentProfile(imported, [profile()]).applied).toBeNull();
    expect(reuseUniqueFilamentProfile(imported, []).draft.ux?.filament.amount).toBe('');
  });
});
