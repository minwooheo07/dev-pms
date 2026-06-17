import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { StepsModule } from './steps/steps.module';
import { TasksModule } from './tasks/tasks.module';
import { CommentsModule } from './comments/comments.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { LabelsModule } from './labels/labels.module';
import { PartnersModule } from './partners/partners.module';
import { WorkLogsModule } from './worklogs/worklogs.module';
import { MeetingsModule } from './meetings/meetings.module';
import { IssuesModule } from './issues/issues.module';
import { NoticesModule } from './notices/notices.module';
import { SearchModule } from './search/search.module';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    StepsModule,
    TasksModule,
    CommentsModule,
    AttachmentsModule,
    NotificationsModule,
    ActivityLogsModule,
    LabelsModule,
    PartnersModule,
    WorkLogsModule,
    MeetingsModule,
    IssuesModule,
    NoticesModule,
    SearchModule,
    MessagesModule,
  ],
})
export class AppModule {}
