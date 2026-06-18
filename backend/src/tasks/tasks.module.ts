import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksSseService } from './tasks-sse.service';
import { TasksController } from './tasks.controller';
import { SingleTaskController } from './single-task.controller';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ActivityLogsModule, NotificationsModule],
  providers: [TasksService, TasksSseService],
  controllers: [TasksController, SingleTaskController],
  exports: [TasksService],
})
export class TasksModule {}
