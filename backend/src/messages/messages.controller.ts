import {
  Controller, Get, Post, Body, Param, Req, UseGuards,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get('conversations')
  conversations(@Req() req: any) {
    return this.messagesService.conversations(req.user.id);
  }

  @Get('unread-count')
  unreadCount(@Req() req: any) {
    return this.messagesService.unreadCount(req.user.id);
  }

  @Get('thread/:userId')
  thread(@Req() req: any, @Param('userId') userId: string) {
    return this.messagesService.thread(req.user.id, userId);
  }

  @Post()
  send(@Req() req: any, @Body() dto: SendMessageDto) {
    return this.messagesService.send(req.user.id, dto);
  }
}
