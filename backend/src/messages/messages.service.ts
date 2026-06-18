import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MessagesSseService } from './messages-sse.service';
import { SendMessageDto } from './dto/message.dto';

const USER_MINI = { select: { id: true, name: true, avatar: true } };
const MESSAGE_SELECT = {
  id: true,
  content: true,
  isRead: true,
  createdAt: true,
  senderId: true,
  recipientId: true,
  sender: USER_MINI,
  recipient: USER_MINI,
};

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private sseService: MessagesSseService,
  ) {}

  // 상대별 대화 목록 (최근 메시지 + 안읽음 수)
  async conversations(userId: string) {
    const msgs = await this.prisma.message.findMany({
      where: { OR: [{ senderId: userId }, { recipientId: userId }] },
      orderBy: { createdAt: 'desc' },
      select: MESSAGE_SELECT,
    });

    const map = new Map<string, any>();
    for (const m of msgs) {
      const isMine = m.senderId === userId;
      const otherId = isMine ? m.recipientId : m.senderId;
      const other = isMine ? m.recipient : m.sender;
      if (!map.has(otherId)) {
        map.set(otherId, { user: other, lastMessage: m, unread: 0 });
      }
      if (m.recipientId === userId && !m.isRead) {
        map.get(otherId).unread += 1;
      }
    }
    return Array.from(map.values());
  }

  // 특정 상대와의 대화 스레드 (조회 시 받은 메시지 읽음 처리)
  async thread(userId: string, otherId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: otherId },
      select: { id: true, name: true, avatar: true, position: true, department: true },
    });

    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, recipientId: otherId },
          { senderId: otherId, recipientId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: MESSAGE_SELECT,
    });

    await this.prisma.message.updateMany({
      where: { senderId: otherId, recipientId: userId, isRead: false },
      data: { isRead: true },
    });

    return { user, messages };
  }

  async send(senderId: string, dto: SendMessageDto) {
    if (dto.recipientId === senderId) {
      throw new BadRequestException('자기 자신에게는 보낼 수 없습니다.');
    }

    const message = await this.prisma.message.create({
      data: {
        content: dto.content,
        senderId,
        recipientId: dto.recipientId,
      },
      select: MESSAGE_SELECT,
    });

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { name: true },
    });

    this.sseService.emit({
      recipientId: dto.recipientId,
      senderId,
      senderName: sender?.name ?? '누군가',
    });

    await this.notifications.create({
      userId: dto.recipientId,
      type: 'MENTION',
      title: '새 멘션',
      message: `${sender?.name ?? '누군가'}님이 멘션을 보냈습니다.`,
      link: `/messages?to=${senderId}`,
    });

    return message;
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.message.count({
      where: { recipientId: userId, isRead: false },
    });
    return { count };
  }
}
