import api from './axios';

export const sheetsApi = {
  list: (projectId: string) =>
    api.get(`/projects/${projectId}/sheets`).then((r) => r.data),

  create: (projectId: string, name: string) =>
    api.post(`/projects/${projectId}/sheets`, { name }).then((r) => r.data),

  get: (projectId: string, sheetId: string) =>
    api.get(`/projects/${projectId}/sheets/${sheetId}`).then((r) => r.data),

  save: (projectId: string, sheetId: string, data: any, baseUpdatedAt?: string) =>
    api.put(`/projects/${projectId}/sheets/${sheetId}`, { data, baseUpdatedAt }).then((r) => r.data),

  rename: (projectId: string, sheetId: string, name: string) =>
    api.put(`/projects/${projectId}/sheets/${sheetId}/rename`, { name }).then((r) => r.data),

  remove: (projectId: string, sheetId: string) =>
    api.delete(`/projects/${projectId}/sheets/${sheetId}`).then((r) => r.data),
};
