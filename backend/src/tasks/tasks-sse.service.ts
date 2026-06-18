import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface TaskChangeEvent {
  projectId: string;
  type: 'move' | 'update' | 'create' | 'delete';
  actorId: string;
}

@Injectable()
export class TasksSseService {
  private subject = new Subject<TaskChangeEvent>();

  emit(event: TaskChangeEvent) {
    this.subject.next(event);
  }

  stream(projectId: string, userId: string) {
    return this.subject.pipe(
      filter((e) => e.projectId === projectId && e.actorId !== userId),
      map((e) => ({ data: { type: e.type } })),
    );
  }
}
