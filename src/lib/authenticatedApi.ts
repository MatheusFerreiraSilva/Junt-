import { auth } from './firebase';

export async function authenticatedApi<T>(path: string, body: unknown = {}, signal?: AbortSignal): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login para continuar.');
  const token = await user.getIdToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body), signal,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação. Tente novamente.');
  if (auth.currentUser?.uid !== user.uid) throw new Error('A sessão mudou. Repita a operação.');
  return result as T;
}
