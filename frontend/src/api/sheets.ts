import api from './axios';

export const sheetsApi = {
  list: (projectId: string) =>
    api.get(`/projects/${projectId}/sheets`).then((r) => r.data),

  // 해당 문서(root)의 페이지 목록 (root + 자식)
  pages: (projectId: string, sheetId: string) =>
    api.get(`/projects/${projectId}/sheets/${sheetId}/pages`).then((r) => r.data),

  create: (projectId: string, name: string, parentId?: string) =>
    api.post(`/projects/${projectId}/sheets`, { name, parentId }).then((r) => r.data),

  get: (projectId: string, sheetId: string) =>
    api.get(`/projects/${projectId}/sheets/${sheetId}`).then((r) => r.data),

  save: (projectId: string, sheetId: string, data: any, baseUpdatedAt?: string) =>
    api.put(`/projects/${projectId}/sheets/${sheetId}`, { data, baseUpdatedAt }).then((r) => r.data),

  rename: (projectId: string, sheetId: string, name: string) =>
    api.put(`/projects/${projectId}/sheets/${sheetId}/rename`, { name }).then((r) => r.data),

  remove: (projectId: string, sheetId: string) =>
    api.delete(`/projects/${projectId}/sheets/${sheetId}`).then((r) => r.data),
};
