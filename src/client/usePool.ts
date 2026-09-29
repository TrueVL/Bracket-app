import { useParams } from 'react-router-dom';
import { getTemplate } from '../shared/templates';
import { api } from './api';
import { useAsync } from './hooks';

export function usePool() {
  const { id = '' } = useParams();
  const state = useAsync(() => api.pool(id).then((r) => r.pool), [id]);
  const template = state.data ? getTemplate(state.data.templateId) : undefined;
  return { id, ...state, pool: state.data, template };
}

export function inviteUrl(code: string): string {
  return `${window.location.origin}/join/${code}`;
}
