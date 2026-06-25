import api from './axios';
import type { Task, KanbanColumn, Label } from '../types';

export const tasksApi = {
  getAll: (projectId: string, params?: Record<string, string>) =>
    api.get<Task[]>(`/projects/${projectId}/tasks`, { params }).then((r) => r.data),
  getKanban: (projectId: string) =>
    api.get<KanbanColumn[]>(`/projects/${projectId}/tasks/kanban`).then((r) => r.data),
  getGantt: (projectId: string) =>
    api.get<Task[]>(`/projects/${projectId}/tasks/gantt`).then((r) => r.data),
  getOne: (projectId: string, taskId: string) =>
    api.get<Task>(`/projects/${projectId}/tasks/${taskId}`).then((r) => r.data),
  getById: (taskId: string) =>
    api.get<Task>(`/tasks/${taskId}`).then((r) => r.data),
  create: (projectId: string, data: Partial<Task> & { assigneeIds?: string[]; labelIds?: string[] }) =>
    api.post<Task>(`/projects/${projectId}/tasks`, data).then((r) => r.data),
  update: (projectId: string, taskId: string, data: Partial<Task> & { assigneeIds?: string[]; labelIds?: string[] }) =>
    api.patch<Task>(`/projects/${projectId}/tasks/${taskId}`, data).then((r) => r.data),
  move: (projectId: string, taskId: string, stepId: string | null, order: number) =>
    api.patch<Task>(`/projects/${projectId}/tasks/${taskId}/move`, { stepId, order }).then((r) => r.data),
  reorderGantt: (projectId: string, taskIds: string[]) =>
    api.patch(`/projects/${projectId}/tasks/reorder`, { taskIds }).then((r) => r.data),
  delete: (projectId: string, taskId: string) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}`).then((r) => r.data),
  bulkCreate: (projectId: string, rows: BulkTaskRow[]) =>
    api.post<{ parentCount: number; childCount: number; standaloneCount: number; total: number }>(
      `/projects/${projectId}/tasks/bulk`, { rows },
    ).then((r) => r.data),
};

export interface BulkTaskRow {
  category?: string;
  title?: string;
  description?: string;
  assigneeName?: string;
  priority?: string;
  startDate?: string;
  dueDate?: string;
  part?: string;
}

export const commentsApi = {
  create: (taskId: string, content: string, parentId?: string) =>
    api.post(`/tasks/${taskId}/comments`, { content, parentId }).then((r) => r.data),
  update: (taskId: string, commentId: string, content: string) =>
    api.patch(`/tasks/${taskId}/comments/${commentId}`, { content }).then((r) => r.data),
  delete: (taskId: string, commentId: string) =>
    api.delete(`/tasks/${taskId}/comments/${commentId}`).then((r) => r.data),
};

export const labelsApi = {
  getAll: (projectId: string) =>
    api.get<Label[]>(`/projects/${projectId}/labels`).then((r) => r.data),
  create: (projectId: string, name: string, color: string) =>
    api.post<Label>(`/projects/${projectId}/labels`, { name, color }).then((r) => r.data),
  update: (projectId: string, labelId: string, data: { name?: string; color?: string }) =>
    api.patch<Label>(`/projects/${projectId}/labels/${labelId}`, data).then((r) => r.data),
  delete: (projectId: string, labelId: string) =>
    api.delete(`/projects/${projectId}/labels/${labelId}`).then((r) => r.data),
};

export const attachmentsApi = {
  upload: (taskId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/tasks/${taskId}/attachments`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  delete: (taskId: string, attachmentId: string) =>
    api.delete(`/tasks/${taskId}/attachments/${attachmentId}`).then((r) => r.data),
};
