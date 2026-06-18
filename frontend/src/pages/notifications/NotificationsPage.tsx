import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { notificationsApi } from '../../api/notifications';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { MessagePanel } from '../../components/layout/MessagePanel';
import { formatRelativeTime, cn } from '../../lib/utils';
import type { Notification, NotificationType } from '../../types';

const TYPE_LABEL: Record<NotificationType, { label: string; color: string }> = {
  TASK_ASSIGNED: { label: '태스크 할당', color: 'bg-indigo-100 text-indigo-600' },
  TASK_UPDATED: { label: '태스크 변경', color: 'bg-blue-100 text-blue-600' },
  COMMENT_ADDED: { label: '댓글', color: 'bg-emerald-100 text-emerald-600' },
  MENTION: { label: '멘션', color: 'bg-purple-100 text-purple-600' },
  DUE_DATE_APPROACHING: { label: '마감 임박', color: 'bg-red-100 text-red-600' },
  PROJECT_INVITATION: { label: '프로젝트 초대', color: 'bg-orange-100 text-orange-600' },
};

export function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [msgPanelOpen, setMsgPanelOpen] = useState(false);
  const [msgTargetId, setMsgTargetId] = useState<string | undefined>();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getAll,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'count'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'count'] });
    },
  });

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">알림</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : '모든 알림을 확인했습니다.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
            <CheckCheck size={14} /> 모두 읽음
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !notifications?.length ? (
        <EmptyState
          icon={<Bell size={48} />}
          title="알림이 없습니다"
          description="새로운 활동이 생기면 여기에 표시됩니다."
        />
      ) : (
        <div className="space-y-2">
          {(notifications as Notification[]).map((n) => {
            const t = TYPE_LABEL[n.type];
            return (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.isRead) markRead.mutate(n.id);
                  if (!n.link) return;
                  const url = new URL(n.link, window.location.origin);
                  if (url.pathname === '/messages') {
                    const to = url.searchParams.get('to');
                    setMsgTargetId(to ?? undefined);
                    setMsgPanelOpen(true);
                  } else {
                    navigate(n.link);
                  }
                }}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors',
                  n.isRead ? 'bg-white border-gray-200 hover:bg-gray-50' : 'bg-indigo-50/50 border-indigo-100 hover:bg-indigo-50',
                )}
              >
                {!n.isRead && <span className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0" />}
                <div className={cn('flex-1', n.isRead && 'ml-5')}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', t.color)}>{t.label}</span>
                    <span className="text-xs text-gray-400">{formatRelativeTime(n.createdAt)}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                </div>
                {!n.isRead && (
                  <button
                    onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id); }}
                    className="text-gray-400 hover:text-indigo-600 p-1 transition-colors cursor-pointer"
                    title="읽음 처리"
                  >
                    <Check size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <MessagePanel
        open={msgPanelOpen}
        onClose={() => setMsgPanelOpen(false)}
        initialUserId={msgTargetId}
      />
    </div>
  );
}
