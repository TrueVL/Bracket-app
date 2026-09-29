import type { BracketDTO, BracketView, InvitePreview, PoolDetail, PoolSummary, UserDTO } from '../shared/api';
import type { Field, Picks, Scoring } from '../shared/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'bracket-app',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  me: () => call<{ user: UserDTO | null }>('GET', '/auth/me'),
  signup: (body: { username: string; displayName: string; password: string }) => call<{ user: UserDTO }>('POST', '/auth/signup', body),
  login: (body: { username: string; password: string }) => call<{ user: UserDTO }>('POST', '/auth/login', body),
  logout: () => call<{ ok: true }>('POST', '/auth/logout'),
  updateMe: (body: { displayName?: string; currentPassword?: string; newPassword?: string }) =>
    call<{ user: UserDTO }>('PATCH', '/auth/me', body),

  pools: () => call<{ pools: PoolSummary[] }>('GET', '/pools'),
  pool: (id: string) => call<{ pool: PoolDetail }>('GET', `/pools/${id}`),
  createPool: (body: { name: string; templateId: string; season: string; lockAt: number | null; scoring: Scoring }) =>
    call<{ pool: PoolDetail }>('POST', '/pools', body),
  updatePool: (
    id: string,
    body: Partial<{ name: string; season: string; lockAt: number | null; scoring: Scoring; field: Field; tiebreakerActual: number | null }>,
  ) => call<{ pool: PoolDetail }>('PATCH', `/pools/${id}`, body),
  saveResults: (id: string, results: Picks, tiebreakerActual: number | null) =>
    call<{ pool: PoolDetail }>('PUT', `/pools/${id}/results`, { results, tiebreakerActual }),
  resetInvite: (id: string) => call<{ pool: PoolDetail }>('POST', `/pools/${id}/invite`),
  deletePool: (id: string) => call<{ ok: true }>('DELETE', `/pools/${id}`),
  removeMember: (id: string, userId: string) => call<{ ok: true }>('DELETE', `/pools/${id}/members/${userId}`),

  saveBracket: (poolId: string, body: { name: string; picks: Picks; tiebreaker: number | null }) =>
    call<{ bracket: BracketDTO }>('PUT', `/pools/${poolId}/bracket`, body),
  bracket: (id: string) => call<BracketView>('GET', `/brackets/${id}`),

  invite: (code: string) => call<InvitePreview>('GET', `/invites/${code}`),
  join: (code: string) => call<{ poolId: string }>('POST', `/invites/${code}/join`),
};
