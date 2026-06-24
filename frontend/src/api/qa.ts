import api from './axios';

export type QATestStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type QATestResult = 'PASS' | 'REJECTED';

export interface QATest {
  id: string;
  qaNumber?: string;
  srNumber: string;
  title: string;
  content?: string;
  status: QATestStatus;
  result?: QATestResult;
  tester?: string;
  testDate?: string;
  acceptedAt?: string;
  completedAt?: string;
  workLogId?: string;
  workLogDeleted?: boolean;
  workLog?: {
    id: string;
    taskTitle?: string;
    srNumber?: string;
    projectName?: string;
    requester?: string;
    requestDate?: string;
    startDate?: string;
    endDate?: string;
    stage?: string;
    hours?: number;
    description?: string;
    user?: { id: string; name: string };
  };
  createdAt: string;
  updatedAt: string;
}

export const QA_STATUS_CONFIG: Record<QATestStatus, { label: string; color: string; bg: string }> = {
  PENDING:     { label: '요청',   color: 'text-amber-700',   bg: 'bg-amber-50' },
  IN_PROGRESS: { label: '접수',   color: 'text-blue-700',    bg: 'bg-blue-50' },
  COMPLETED:   { label: '완료',   color: 'text-emerald-700', bg: 'bg-emerald-50' },
  CANCELLED:   { label: '취소',   color: 'text-gray-500',    bg: 'bg-gray-100' },
};

export const QA_RESULT_CONFIG: Record<QATestResult, { label: string; color: string }> = {
  PASS:     { label: '확인',  color: 'text-emerald-600' },
  REJECTED: { label: '반려',  color: 'text-red-600' },
};

export const qaApi = {
  getAll: (srNumber?: string) =>
    api.get('/qa', { params: srNumber ? { srNumber } : undefined }).then((r) => r.data as QATest[]),
  getByWorkLog: (workLogId: string) =>
    api.get('/qa', { params: { workLogId } }).then((r) => r.data as QATest[]),
  getOne: (id: string) =>
    api.get(`/qa/${id}`).then((r) => r.data as QATest),
  create: (data: { srNumber: string; title: string; content?: string; tester?: string; workLogId?: string }) =>
    api.post('/qa', data).then((r) => r.data as QATest),
  accept:  (id: string) => api.patch(`/qa/${id}/accept`, {}).then((r) => r.data as QATest),
  confirm: (id: string) => api.patch(`/qa/${id}/confirm`, {}).then((r) => r.data as QATest),
  reject:  (id: string) => api.patch(`/qa/${id}/reject`, {}).then((r) => r.data as QATest),
  cancel:  (id: string) => api.patch(`/qa/${id}/cancel`, {}).then((r) => r.data as QATest),
  reopen:  (id: string) => api.patch(`/qa/${id}/reopen`, {}).then((r) => r.data as QATest),
  update: (id: string, data: { title?: string; content?: string; tester?: string }) =>
    api.patch(`/qa/${id}`, data).then((r) => r.data as QATest),
  remove: (id: string) =>
    api.delete(`/qa/${id}`).then((r) => r.data),
};
