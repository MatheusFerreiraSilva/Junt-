// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], applicationDefault: vi.fn(), initializeApp: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: vi.fn(() => ({})) }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: async (token: string) => { if (token !== 'valid-token') throw new Error('invalid'); return { uid: 'verified-user', email: 'user@example.test' }; } }) }));
import { requireAuth } from './security';

describe('API authentication', () => {
  it.each([undefined, 'Bearer invalid', 'Basic credentials'])('returns 401 for %s', async authorization => {
    const json = vi.fn(); const status = vi.fn(() => ({ json })); const next = vi.fn();
    await requireAuth({ headers: { authorization } } as Request, { status, locals: {} } as unknown as Response, next);
    expect(status).toHaveBeenCalledWith(401); expect(next).not.toHaveBeenCalled();
  });
  it('derives identity only from a verified ID token', async () => {
    const res = { locals: {}, status: vi.fn() };
    const next = vi.fn(); await requireAuth({ headers: { authorization: 'Bearer valid-token' } } as Request, res as unknown as Response, next);
    expect(res.locals).toEqual({ uid: 'verified-user', email: 'user@example.test' }); expect(next).toHaveBeenCalledOnce();
  });
});
