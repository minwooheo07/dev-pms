export type Role = 'ADMIN' | 'MEMBER';
export type ProjectRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' | 'ON_HOLD';
export type Priority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';
export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_UPDATED'
  | 'COMMENT_ADDED'
  | 'MENTION'
  | 'DUE_DATE_APPROACHING'
  | 'PROJECT_INVITATION';
export type ActivityAction =
  | 'CREATED' | 'UPDATED' | 'DELETED' | 'ASSIGNED' | 'UNASSIGNED'
  | 'COMMENTED' | 'UPLOADED' | 'STATUS_CHANGED' | 'PRIORITY_CHANGED' | 'MOVED';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: Role;
  position?: string;
  department?: string;
  phone?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProjectMember {
  id: string;
  role: ProjectRole;
  joinedAt: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'avatar'>;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  color: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: Pick<User, 'id' | 'name' | 'avatar'>;
  members: ProjectMember[];
  steps?: Step[];
  _count: { tasks: number };
}

export interface Step {
  id: string;
  name: string;
  order: number;
  color: string;
  isDone: boolean;
  projectId: string;
  createdAt: string;
  _count?: { tasks: number };
}

export interface Label {
  id: string;
  name: string;
  color: string;
  projectId: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: TaskStatus;
  startDate?: string;
  dueDate?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  stepId?: string;
  parentId?: string;
  step?: Pick<Step, 'id' | 'name' | 'color'>;
  createdBy: Pick<User, 'id' | 'name' | 'avatar'>;
  assignees: { user: Pick<User, 'id' | 'name' | 'avatar' | 'email'> }[];
  labels: { label: Label }[];
  personnel?: { personnel: Personnel }[];
  subTasks?: Task[];
  comments?: Comment[];
  attachments?: Attachment[];
  _count: { comments: number; attachments: number; subTasks: number };
}

export interface KanbanColumn extends Step {
  tasks: Task[];
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  parentId?: string;
  author: Pick<User, 'id' | 'name' | 'avatar'>;
  replies?: Comment[];
}

export interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  createdAt: string;
  uploadedBy: Pick<User, 'id' | 'name'>;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  entityName: string;
  metadata?: Record<string, any>;
  createdAt: string;
  user: Pick<User, 'id' | 'name' | 'avatar'>;
}

export interface Partner {
  id: string;
  name: string;
  description?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
  personnel?: Personnel[];
  _count?: { personnel: number };
}

export interface Personnel {
  id: string;
  name: string;
  position?: string;
  email?: string;
  phone?: string;
  partnerId: string;
  partner?: Pick<Partner, 'id' | 'name'>;
  _count?: { tasks: number };
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  project: Pick<Project, 'id' | 'name' | 'color'>;
  createdBy: Pick<User, 'id' | 'name' | 'avatar'>;
}

export type IssueRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IssueStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'ON_HOLD';

export interface Issue {
  id: string;
  title: string;
  description?: string;
  riskLevel: IssueRisk;
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  createdBy: Pick<User, 'id' | 'name' | 'avatar'>;
  assignee?: Pick<User, 'id' | 'name' | 'avatar'> | null;
}

export interface ProjectStats {
  total: number;
  byStatus: { status: TaskStatus; _count: number }[];
  byPriority: { priority: Priority; _count: number }[];
  overdue: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
