import api from './axios';

export type WbsStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'ON_HOLD';

export interface WbsItem {
  id: string;
  title: string;
  assignee?: string;
  startDate?: string;
  endDate?: string;
  progress: number;
  status: WbsStatus;
  note?: string;
  order: number;
  depth: number;
  parentId?: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export const wbsApi = {
  getAll: (projectId: string) =>
    api.get(`/projects/${projectId}/wbs`).then((r) => r.data as WbsItem[]),
  create: (projectId: string, data: Partial<WbsItem>) =>
    api.post(`/projects/${projectId}/wbs`, data).then((r) => r.data as WbsItem),
  update: (projectId: string, id: string, data: Partial<WbsItem>) =>
    api.patch(`/projects/${projectId}/wbs/${id}`, data).then((r) => r.data as WbsItem),
  remove: (projectId: string, id: string) =>
    api.delete(`/projects/${projectId}/wbs/${id}`).then((r) => r.data),
  reorder: (projectId: string, items: { id: string; order: number; parentId: string | null; depth: number }[]) =>
    api.patch(`/projects/${projectId}/wbs/reorder`, { items }).then((r) => r.data as WbsItem[]),
  bulkCreate: (projectId: string, items: Partial<WbsItem>[]) =>
    api.post(`/projects/${projectId}/wbs/bulk`, { items }).then((r) => r.data as { count: number }),
};
