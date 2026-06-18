import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, UseGuards, Sse, MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TasksService } from './tasks.service';
import { TasksSseService } from './tasks-sse.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(
    private tasksService: TasksService,
    private sseService: TasksSseService,
  ) {}

  @Sse('events')
  events(@Param('projectId') projectId: string, @Req() req: any): Observable<MessageEvent> {
    return this.sseService.stream(projectId, req.user.id) as Observable<MessageEvent>;
  }

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: { stepId?: string; status?: string; priority?: string; assigneeId?: string },
  ) {
    return this.tasksService.findAll(projectId, query);
  }

  @Get('kanban')
  findKanban(@Param('projectId') projectId: string) {
    return this.tasksService.findKanban(projectId);
  }

  @Get('gantt')
  findGantt(@Param('projectId') projectId: string) {
    return this.tasksService.findGantt(projectId);
  }

  @Get(':taskId')
  findOne(@Param('taskId') taskId: string) {
    return this.tasksService.findOne(taskId);
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() dto: CreateTaskDto,
  ) {
    const result = await this.tasksService.create(projectId, req.user.id, dto);
    this.sseService.emit({ projectId, type: 'create', actorId: req.user.id });
    return result;
  }

  @Patch(':taskId')
  async update(
    @Param('taskId') taskId: string,
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() dto: UpdateTaskDto,
  ) {
    const result = await this.tasksService.update(taskId, req.user.id, req.user.role, dto);
    this.sseService.emit({ projectId, type: 'update', actorId: req.user.id });
    return result;
  }

  @Patch(':taskId/move')
  async moveTask(
    @Param('taskId') taskId: string,
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() body: { stepId: string | null; order: number },
  ) {
    const result = await this.tasksService.moveTask(taskId, req.user.id, body.stepId, body.order);
    this.sseService.emit({ projectId, type: 'move', actorId: req.user.id });
    return result;
  }

  @Delete(':taskId')
  async remove(
    @Param('taskId') taskId: string,
    @Param('projectId') projectId: string,
    @Req() req: any,
  ) {
    const result = await this.tasksService.remove(taskId, req.user.id, req.user.role);
    this.sseService.emit({ projectId, type: 'delete', actorId: req.user.id });
    return result;
  }
}
