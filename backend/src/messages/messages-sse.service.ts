import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface MessageEvent {
  recipientId: string;
  senderId: string;
  senderName: string;
}

@Injectable()
export class MessagesSseService {
  private subject = new Subject<MessageEvent>();

  emit(event: MessageEvent) {
    this.subject.next(event);
  }

  stream(userId: string) {
    return this.subject.pipe(
      filter((e) => e.recipientId === userId),
      map((e) => ({ data: { senderId: e.senderId, senderName: e.senderName } })),
    );
  }
}
