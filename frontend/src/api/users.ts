import api from './axios';
import type { User } from '../types';

export const usersApi = {
  getAll: () =>
    api.get<(User & { _count: { projectMembers: number; createdTasks: number } })[]>('/users').then((r) => r.data),

  getOne: (id: string) =>
    api.get<User>(`/users/${id}`).then((r) => r.data),

  updateProfile: (data: {
    name?: string;
    position?: string;
    department?: string;
    phone?: string;
    avatar?: string;
    statusEmoji?: string;
    statusText?: string;
  }) =>
    api.patch<User>('/users/profile', data).then((r) => r.data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post<{ message: string }>('/users/profile/password', data).then((r) => r.data),

  adminUpdate: (id: string, data: { role?: string; name?: string }) =>
    api.patch<User>(`/users/${id}/admin`, data).then((r) => r.data),

  ping: () =>
    api.post<void>('/users/me/ping').then((r) => r.data),

  getOnlineIds: () =>
    api.get<string[]>('/users/online').then((r) => r.data),

  getPending: () =>
    api.get<User[]>('/users/pending').then((r) => r.data),

  approveUser: (id: string) =>
    api.patch<User>(`/users/${id}/approve`).then((r) => r.data),

  rejectUser: (id: string) =>
    api.delete(`/users/${id}/reject`).then((r) => r.data),
};
