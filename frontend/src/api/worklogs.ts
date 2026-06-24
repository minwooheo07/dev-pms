import api from './axios';

export type WorkLogStage = 'RECEIVED' | 'DEVELOPMENT' | 'COMPLETED' | 'USER_CONFIRMED' | 'DEPLOYED';

export const STAGE_CONFIG: Record<WorkLogStage, { label: string; color: string; bg: string; border: string }> = {
  RECEIVED:       { label: '접수',     color: 'text-gray-600',   bg: 'bg-gray-100',    border: 'border-gray-300' },
  DEVELOPMENT:    { label: '개발',     color: 'text-blue-700',   bg: 'bg-blue-50',     border: 'border-blue-300' },
  COMPLETED:      { label: '완료',     color: 'text-emerald-700',bg: 'bg-emerald-50',  border: 'border-emerald-300' },
  USER_CONFIRMED: { label: '사용자확인', color: 'text-gray-800', bg: 'bg-primary-50',   border: 'border-primary-300' },
  DEPLOYED:       { label: '배포',     color: 'text-orange-700', bg: 'bg-orange-50',   border: 'border-orange-300' },
};

export const STAGE_ORDER: WorkLogStage[] = ['RECEIVED', 'DEVELOPMENT', 'COMPLETED', 'USER_CONFIRMED', 'DEPLOYED'];

export interface WorkLogCreateData {
  taskId: string;
  userId?: string;
  hours?: number;
  description?: string;
  requester?: string;
  requestDate?: string;
  startDate?: string;
  endDate?: string;
}

export const worklogsApi = {
  getAll: (params?: { userId?: string; projectId?: string; taskId?: string; stage?: string; startDate?: string; endDate?: string }) =>
    api.get('/worklogs', { params }).then((r) => r.data),
  getSummary: () =>
    api.get('/worklogs/summary').then((r) => r.data),
  create: (data: WorkLogCreateData) =>
    api.post('/worklogs', data).then((r) => r.data),
  update: (id: string, data: { hours?: number; description?: string; requester?: string; requestDate?: string; startDate?: string; endDate?: string; userId?: string; stage?: WorkLogStage }) =>
    api.patch(`/worklogs/${id}`, data).then((r) => r.data),
  acknowledge: (id: string) =>
    api.patch(`/worklogs/${id}/acknowledge`, {}).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/worklogs/${id}`).then((r) => r.data),
};
