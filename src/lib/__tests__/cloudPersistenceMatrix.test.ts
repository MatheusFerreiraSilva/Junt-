import { describe, expect, it } from 'vitest';
import { CLOUD_PERSISTENCE_MATRIX } from '../../types/sync';
import { ENTITY_FIELDS } from '../entitySync';

describe('cloud persistence matrix verification', () => {
  it('covers all entity fields in the canonical matrix', () => {
    const coupleEntityMatrixFields = CLOUD_PERSISTENCE_MATRIX
      .filter(entry => entry.owner === 'couple' && entry.readPath.includes('/entities/'))
      .map(entry => entry.field);

    for (const requiredField of ['expenses', 'incomes', 'installments', 'piggyBanks', 'coupleGoals', 'medicalShifts', 'monthlyBudgetPlans']) {
      expect(coupleEntityMatrixFields).toContain(requiredField);
      expect(ENTITY_FIELDS).toContain(requiredField as any);
    }
  });

  it('explicitly inventories previously missing header fields', () => {
    const headerFields = CLOUD_PERSISTENCE_MATRIX
      .filter(entry => entry.owner === 'couple' && entry.readPath === 'couples/{coupleId}')
      .map(entry => entry.field);

    expect(headerFields).toContain('emergencyReserveMonthsTarget');
    expect(headerFields).toContain('expectedYieldAnnual');
    expect(headerFields).toContain('protectionYieldAccumulated');
    expect(headerFields).toContain('freedomYieldAccumulated');
    expect(headerFields).toContain('categoryLocks');
  });

  it('strictly isolates personal account data from couple finances', () => {
    const personalEntries = CLOUD_PERSISTENCE_MATRIX.filter(entry => entry.owner === 'personal');
    for (const entry of personalEntries) {
      expect(entry.readPath).not.toContain('couples/');
      expect(entry.writePath).not.toContain('couples/');
    }

    const avatarEntry = personalEntries.find(e => e.field === 'avatars');
    expect(avatarEntry?.readPath).toBe('avatars/{uid}');

    const prefEntry = personalEntries.find(e => e.field === 'accountPreferences');
    expect(prefEntry?.readPath).toBe('accountPreferences/{uid}');
  });

  it('maintains strict rule that client cache is not server confirmation', () => {
    const cacheEntry = CLOUD_PERSISTENCE_MATRIX.find(e => e.owner === 'client_cache');
    expect(cacheEntry).toBeDefined();
    expect(cacheEntry?.rule).toContain('Nunca reporta isCloudSynced = true');
  });

  it('keeps simulation drafts strictly local and isolated from real accounts', () => {
    const draftEntry = CLOUD_PERSISTENCE_MATRIX.find(e => e.owner === 'simulation_draft');
    expect(draftEntry).toBeDefined();
    expect(draftEntry?.writePath).toContain('Não persiste');
  });
});
