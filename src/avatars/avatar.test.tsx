import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  AVATAR_OPTIONS,
  DEFAULT_AVATAR,
  isAvatarConfig,
  normalizeAvatar,
  randomAvatar,
} from './avatarConfig';
import { Avatar } from './Avatar';

describe('local avatar recipes', () => {
  it('accepts only a complete known version and catalog values', () => {
    expect(isAvatarConfig(DEFAULT_AVATAR)).toBe(true);
    expect(isAvatarConfig({ ...DEFAULT_AVATAR, version: 2 })).toBe(false);
    expect(isAvatarConfig({ ...DEFAULT_AVATAR, hair: '<script>' })).toBe(false);
    expect(isAvatarConfig({ ...DEFAULT_AVATAR, svg: '<svg/>' })).toBe(false);
    const { skin, ...incomplete } = DEFAULT_AVATAR;
    expect(isAvatarConfig(incomplete)).toBe(false);
    expect(AVATAR_OPTIONS.skin.some((item) => item.id === skin)).toBe(true);
    expect(isAvatarConfig(null)).toBe(false);
  });

  it('recovers partial/invalid persisted data without injecting markup or changing valid choices', () => {
    expect(normalizeAvatar({ skin: 'espresso', hair: 'unknown' })).toEqual({
      ...DEFAULT_AVATAR,
      skin: 'espresso',
    });
    expect(normalizeAvatar({ ...DEFAULT_AVATAR, version: 99 })).toEqual(DEFAULT_AVATAR);
    const source = { ...DEFAULT_AVATAR };
    const safe = normalizeAvatar(source);
    safe.skin = 'espresso';
    expect(source.skin).toBe(DEFAULT_AVATAR.skin);
  });

  it('returns valid random combinations across all catalog options', () => {
    for (let i = 0; i < 30; i++) expect(isAvatarConfig(randomAvatar())).toBe(true);
  });

  it('renders descriptive images only when a label is provided and isolates SVG IDs', () => {
    const { container } = render(
      <>
        <Avatar label="Avatar de Ana" />
        <Avatar
          variant="body"
          config={{ ...DEFAULT_AVATAR, hair: 'bald', accessory: 'beard', outfit: 'shirt' }}
        />
      </>
    );
    expect(screen.getByRole('img', { name: 'Avatar de Ana' })).toBeInTheDocument();
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(1);
    const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(container.querySelectorAll('script,foreignObject,image')).toHaveLength(0);
  });

  it('supports every catalog style in both render crops', () => {
    const { rerender, container } = render(<Avatar />);
    for (const item of AVATAR_OPTIONS.hair) {
      rerender(<Avatar config={{ ...DEFAULT_AVATAR, hair: item.id }} variant="body" />);
      expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 200 268');
    }
    rerender(<Avatar config={normalizeAvatar({ skin: '<script>' })} variant="face" />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('25 12 150 150');
  });
});
