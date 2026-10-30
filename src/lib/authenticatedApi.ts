import { auth } from './firebase';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly details: unknown
  ) {
    const body = details && typeof details === 'object' ? (details as { error?: unknown }) : {};
    super(
      typeof body.error === 'string'
        ? body.error
        : 'Não foi possível concluir a operação. Tente novamente.'
    );
    this.name = 'ApiError';
  }
}

export async function authenticatedApi<T>(
  path: string,
  body: unknown = {},
  signal?: AbortSignal
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login para continuar.');
  const token = await user.getIdToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
    signal,
  });
  const result = await response.json().catch(() => ({}));
  if (auth.currentUser?.uid !== user.uid) throw new Error('A sessão mudou. Repita a operação.');
  if (!response.ok) throw new ApiError(response.status, result);
  return result as T;
}
