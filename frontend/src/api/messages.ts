import api from './axios';

export interface MessageUser {
  id: string;
  name: string;
  avatar?: string;
  position?: string;
  department?: string;
}

export interface Message {
  id: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderId: string;
  recipientId: string;
  sender: MessageUser;
  recipient: MessageUser;
}

export interface Conversation {
  user: MessageUser;
  lastMessage: Message;
  unread: number;
}

export const messagesApi = {
  conversations: () =>
    api.get<Conversation[]>('/messages/conversations').then((r) => r.data),
  unreadCount: () =>
    api.get<{ count: number }>('/messages/unread-count').then((r) => r.data),
  thread: (userId: string) =>
    api.get<{ user: MessageUser; messages: Message[] }>(`/messages/thread/${userId}`).then((r) => r.data),
  send: (recipientId: string, content: string) =>
    api.post<Message>('/messages', { recipientId, content }).then((r) => r.data),
};
