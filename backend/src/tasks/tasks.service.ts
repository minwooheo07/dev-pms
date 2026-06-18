import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';

const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  startDate: true,
  dueDate: true,
  order: true,
  createdAt: true,
  updatedAt: true,
  projectId: true,
  stepId: true,
  parentId: true,
  step: { select: { id: true, name: true, color: true } },
  createdBy: { select: { id: true, name: true, avatar: true } },
  assignees: {
    select: { user: { select: { id: true, name: true, avatar: true, email: true } } },
  },
  labels: {
    select: { label: { select: { id: true, name: true, color: true } } },
  },
  personnel: {
    select: {
      personnel: {
        select: {
          id: true,
          name: true,
          position: true,
          partner: { select: { id: true, name: true } },
        },
      },
    },
  },
  _count: { select: { comments: true, attachments: true, subTasks: true } },
};

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
    private notifications: NotificationsService,
  ) {}

  async findAll(projectId: string, query?: { stepId?: string; status?: string; priority?: string; assigneeId?: string }) {
    const where: any = { projectId, parentId: null };
    if (query?.stepId) where.stepId = query.stepId;
    if (query?.status) where.status = query.status;
    if (query?.priority) where.priority = query.priority;
    if (query?.assigneeId) {
      where.assignees = { some: { userId: query.assigneeId } };
    }

    return this.prisma.task.findMany({
      where,
      select: TASK_SELECT,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findKanban(projectId: string) {
    const [steps, tasks] = await Promise.all([
      this.prisma.step.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
      }),
      this.prisma.task.findMany({
        where: { projectId, parentId: null },
        select: TASK_SELECT,
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      }),
    ]);

    return steps.map((step, idx) => ({
      ...step,
      // 단계 미지정(orphan) 태스크는 첫 컬럼에 함께 표시
      tasks: tasks.filter((t) => t.stepId === step.id || (idx === 0 && !t.stepId)),
    }));
  }

  async findGantt(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId, parentId: null },
      select: {
        ...TASK_SELECT,
        subTasks: { select: TASK_SELECT },
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        ...TASK_SELECT,
        comments: {
          where: { parentId: null },
          select: {
            id: true,
            content: true,
            createdAt: true,
            updatedAt: true,
            author: { select: { id: true, name: true, avatar: true } },
            replies: {
              select: {
                id: true,
                content: true,
                createdAt: true,
                author: { select: { id: true, name: true, avatar: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          select: {
            id: true, filename: true, originalName: true,
            mimetype: true, size: true, url: true, createdAt: true,
            uploadedBy: { select: { id: true, name: true } },
          },
        },
        subTasks: { select: TASK_SELECT },
      },
    });
    if (!task) throw new NotFoundException('태스크를 찾을 수 없습니다.');
    return task;
  }

  async create(projectId: string, userId: string, dto: CreateTaskDto) {
    const { assigneeIds, labelIds, personnelIds, ...raw } = dto;

    const task = await this.prisma.task.create({
      data: {
        title: raw.title,
        description: raw.description || undefined,
        priority: raw.priority,
        status: raw.status,
        stepId: raw.stepId || undefined,
        startDate: raw.startDate ? new Date(raw.startDate) : undefined,
        dueDate: raw.dueDate ? new Date(raw.dueDate) : undefined,
        order: raw.order,
        parentId: raw.parentId || undefined,
        projectId,
        createdById: userId,
        assignees: assigneeIds?.length
          ? { createMany: { data: assigneeIds.map((id) => ({ userId: id })) } }
          : undefined,
        labels: labelIds?.length
          ? { createMany: { data: labelIds.map((id) => ({ labelId: id })) } }
          : undefined,
        personnel: personnelIds?.length
          ? { createMany: { data: personnelIds.map((id) => ({ personnelId: id })) } }
          : undefined,
      },
      select: TASK_SELECT,
    });

    await this.activityLogs.log({
      userId,
      action: 'CREATED',
      entityType: 'TASK',
      entityId: task.id,
      entityName: task.title,
      projectId,
      taskId: task.id,
    });

    if (assigneeIds?.length) {
      await Promise.all(
        assigneeIds
          .filter((id) => id !== userId)
          .map((id) =>
            this.notifications.create({
              userId: id,
              type: 'TASK_ASSIGNED',
              title: '새 태스크가 할당되었습니다',
              message: `"${task.title}" 태스크가 할당되었습니다.`,
              link: `/tasks/${task.id}`,
            }),
          ),
      );
    }

    return task;
  }

  async update(taskId: string, userId: string, userRole: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!existing) throw new NotFoundException();

    if (userRole !== 'ADMIN' && existing.createdById !== userId) {
      const member = await this.prisma.projectMember.findUnique({
        where: { userId_projectId: { userId, projectId: existing.projectId } },
      });
      if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
        throw new ForbiddenException('태스크 수정은 작성자 또는 관리자만 가능합니다.');
      }
    }

    const { assigneeIds, labelIds, personnelIds, startDate, dueDate, ...data } = dto;

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...data,
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(assigneeIds !== undefined && {
          assignees: {
            deleteMany: {},
            createMany: { data: assigneeIds.map((id) => ({ userId: id })) },
          },
        }),
        ...(labelIds !== undefined && {
          labels: {
            deleteMany: {},
            createMany: { data: labelIds.map((id) => ({ labelId: id })) },
          },
        }),
        ...(personnelIds !== undefined && {
          personnel: {
            deleteMany: {},
            createMany: { data: personnelIds.map((id) => ({ personnelId: id })) },
          },
        }),
      },
      select: TASK_SELECT,
    });

    const action = dto.status && dto.status !== existing.status
      ? 'STATUS_CHANGED'
      : dto.priority && dto.priority !== existing.priority
      ? 'PRIORITY_CHANGED'
      : 'UPDATED';

    await this.activityLogs.log({
      userId,
      action,
      entityType: 'TASK',
      entityId: task.id,
      entityName: task.title,
      projectId: existing.projectId,
      taskId: task.id,
      metadata: dto.status ? { from: existing.status, to: dto.status } : undefined,
    });

    return task;
  }

  async moveTask(taskId: string, userId: string, stepId: string | null, order: number) {
    let statusUpdate: { status?: string } = {};
    if (stepId) {
      const step = await this.prisma.step.findUnique({ where: { id: stepId } });
      if (step?.isDone) statusUpdate.status = 'DONE';
      else {
        const currentTask = await this.prisma.task.findUnique({ where: { id: taskId }, select: { status: true, stepId: true } });
        const prevStep = currentTask?.stepId ? await this.prisma.step.findUnique({ where: { id: currentTask.stepId } }) : null;
        if (prevStep?.isDone && currentTask?.status === 'DONE') statusUpdate.status = 'IN_PROGRESS';
      }
    }

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { stepId, order, ...statusUpdate },
      select: TASK_SELECT,
    });

    await this.activityLogs.log({
      userId,
      action: 'MOVED',
      entityType: 'TASK',
      entityId: task.id,
      entityName: task.title,
      projectId: task.projectId,
      taskId: task.id,
    });

    return task;
  }

  async remove(taskId: string, userId: string, userRole: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException();

    if (userRole !== 'ADMIN' && task.createdById !== userId) {
      const member = await this.prisma.projectMember.findUnique({
        where: { userId_projectId: { userId, projectId: task.projectId } },
      });
      if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
        throw new ForbiddenException('태스크 삭제는 작성자 또는 관리자만 가능합니다.');
      }
    }

    await this.prisma.task.delete({ where: { id: taskId } });

    await this.activityLogs.log({
      userId,
      action: 'DELETED',
      entityType: 'TASK',
      entityId: taskId,
      entityName: task.title,
      projectId: task.projectId,
    });

    return { message: '태스크가 삭제되었습니다.' };
  }
}
