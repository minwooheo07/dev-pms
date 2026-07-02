import api from './axios';

export type FormFieldType =
  | 'title' | 'body'
  | 'text' | 'multitext' | 'number' | 'currency'
  | 'singleSelect' | 'dropdown' | 'checkbox' | 'date';

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[]; // singleSelect / dropdown / checkbox
  content?: string; // title / body 표시용 텍스트
}

export interface FormTemplate {
  id: string;
  name: string;
  description?: string | null;
  schema: FormField[];
  projectId: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string; avatar?: string };
  _count?: { submissions: number };
}

export interface FormSubmission {
  id: string;
  data: Record<string, any>;
  createdAt: string;
  submittedBy?: { id: string; name: string; avatar?: string };
}

export const formsApi = {
  list: (projectId: string) =>
    api.get<FormTemplate[]>(`/projects/${projectId}/forms`).then((r) => r.data),

  create: (projectId: string, name: string) =>
    api.post<FormTemplate>(`/projects/${projectId}/forms`, { name }).then((r) => r.data),

  get: (projectId: string, formId: string) =>
    api.get<FormTemplate>(`/projects/${projectId}/forms/${formId}`).then((r) => r.data),

  update: (projectId: string, formId: string, data: Partial<Pick<FormTemplate, 'name' | 'description' | 'schema'>>) =>
    api.put<FormTemplate>(`/projects/${projectId}/forms/${formId}`, data).then((r) => r.data),

  remove: (projectId: string, formId: string) =>
    api.delete(`/projects/${projectId}/forms/${formId}`).then((r) => r.data),

  submit: (projectId: string, formId: string, data: Record<string, any>) =>
    api.post<FormSubmission>(`/projects/${projectId}/forms/${formId}/submissions`, { data }).then((r) => r.data),

  listSubmissions: (projectId: string, formId: string) =>
    api.get<FormSubmission[]>(`/projects/${projectId}/forms/${formId}/submissions`).then((r) => r.data),

  removeSubmission: (projectId: string, formId: string, submissionId: string) =>
    api.delete(`/projects/${projectId}/forms/${formId}/submissions/${submissionId}`).then((r) => r.data),
};
