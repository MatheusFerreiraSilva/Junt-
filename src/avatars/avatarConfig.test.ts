import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, parseStoredAvatarConfig } from './avatarConfig';

const { gender: _gender, ...legacy } = {
  ...DEFAULT_AVATAR,
  hair: 'braids' as const,
  outfit: 'hoodie' as const,
  outfitColor: 'sage' as const,
  accessory: 'earrings' as const,
};

describe('stored avatar compatibility', () => {
  it('reads current recipes without changing their choices', () => {
    const current = { ...DEFAULT_AVATAR, gender: 'masculine' as const, outfit: 'jacket' as const };
    expect(parseStoredAvatarConfig(current)).toEqual(current);
  });

  it('reads an exact pre-gender version-one recipe without resetting its choices', () => {
    expect(parseStoredAvatarConfig(legacy)).toEqual({ ...legacy, gender: DEFAULT_AVATAR.gender });
    expect(legacy).not.toHaveProperty('gender');
  });

  it.each([
    null,
    [],
    {},
    { ...legacy, version: 2 },
    { ...legacy, html: '<script>alert(1)</script>' },
    { ...legacy, gender: 'unknown' },
    { ...legacy, hair: '<svg onload=alert(1)>' },
    { ...legacy, outfit: 'unrecognized' },
    { ...legacy, mouth: undefined },
    Object.fromEntries(Object.entries(legacy).filter(([key]) => key !== 'skin')),
    Object.fromEntries(Object.entries(legacy).filter(([key]) => key !== 'version')),
  ])('rejects unsupported or incomplete stored input %#', (input) => {
    expect(parseStoredAvatarConfig(input)).toBeNull();
  });
});
