import api from './axios';

export const canvasApi = {
  list: (projectId: string) =>
    api.get(`/projects/${projectId}/canvases`).then((r) => r.data),

  create: (projectId: string, name: string) =>
    api.post(`/projects/${projectId}/canvases`, { name }).then((r) => r.data),

  get: (projectId: string, canvasId: string) =>
    api.get(`/projects/${projectId}/canvases/${canvasId}`).then((r) => r.data),

  save: (projectId: string, canvasId: string, data: any, baseUpdatedAt?: string) =>
    api.put(`/projects/${projectId}/canvases/${canvasId}`, { data, baseUpdatedAt }).then((r) => r.data),

  rename: (projectId: string, canvasId: string, name: string) =>
    api.put(`/projects/${projectId}/canvases/${canvasId}/rename`, { name }).then((r) => r.data),

  remove: (projectId: string, canvasId: string) =>
    api.delete(`/projects/${projectId}/canvases/${canvasId}`).then((r) => r.data),

  listComments: (projectId: string, canvasId: string) =>
    api.get(`/projects/${projectId}/canvases/${canvasId}/comments`).then((r) => r.data),

  addComment: (projectId: string, canvasId: string, content: string) =>
    api.post(`/projects/${projectId}/canvases/${canvasId}/comments`, { content }).then((r) => r.data),

  deleteComment: (projectId: string, canvasId: string, commentId: string) =>
    api.delete(`/projects/${projectId}/canvases/${canvasId}/comments/${commentId}`).then((r) => r.data),
};
