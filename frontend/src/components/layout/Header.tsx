import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, Mail } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../api/notifications';
import { messagesApi } from '../../api/messages';
import { searchApi } from '../../api/search';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../../store/auth.store';
import { useUiStore } from '../../store/ui.store';
import { formatRelativeTime, cn } from '../../lib/utils';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../lib/utils';
import { MessagePanel } from './MessagePanel';
import type { TaskStatus, Priority } from '../../types';

export function Header() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const openTaskModal = useUiStore((s) => s.openTaskModal);

  const [notifOpen, setNotifOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 검색 (300ms 디바운스)
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: searchResult, isFetching: searching } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () => searchApi.search(debouncedQ),
    enabled: debouncedQ.trim().length >= 1,
    staleTime: 10_000,
  });

  const hasResults =
    (searchResult?.tasks?.length ?? 0) > 0 ||
    (searchResult?.projects?.length ?? 0) > 0;

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 30_000,
  });

  const { data: msgUnread } = useQuery({
    queryKey: ['messages', 'unread'],
    queryFn: messagesApi.unreadCount,
    refetchInterval: 30_000,
  });

  // SSE: 새 메시지 도착 시 즉시 unread count 갱신
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('accessToken');
    const url = `/api/messages/events${token ? `?token=${token}` : ''}`;
    const es = new EventSource(url);
    es.onmessage = () => {
      qc.invalidateQueries({ queryKey: ['messages', 'unread'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [user, qc]);

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getAll,
    enabled: notifOpen,
  });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'count'] });
    },
  });

  const handleSelectTask = (task: any) => {
    setSearchOpen(false);
    setSearchQuery('');
    openTaskModal(task.id);
  };

  const handleSelectProject = (project: any) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(`/projects/${project.id}`);
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 flex-shrink-0">
      {/* Search */}
      <div className="flex-1 max-w-md relative" ref={searchRef}>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="태스크, 프로젝트 검색..."
            className="w-full h-8 pl-9 pr-3 text-sm bg-gray-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchOpen(false); inputRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* 검색 결과 드롭다운 */}
        {searchOpen && debouncedQ.trim().length >= 1 && (
          <div className="absolute top-10 left-0 w-full min-w-[420px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
            {searching && !hasResults ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">검색 중...</div>
            ) : !hasResults ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                <Search size={20} className="mx-auto mb-2 opacity-30" />
                <p>"{debouncedQ}"에 대한 결과가 없습니다.</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {/* 프로젝트 결과 */}
                {(searchResult?.projects?.length ?? 0) > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">프로젝트</p>
                    {searchResult!.projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectProject(p)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                      >
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                          style={{ backgroundColor: p.color + '20', border: `1.5px solid ${p.color}40` }}
                        >
                          {p.icon ?? '📁'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                          <p className="text-[11px] text-gray-400">태스크 {p._count.tasks}개</p>
                        </div>
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: p.color + '15', color: p.color }}
                        >
                          프로젝트
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* 태스크 결과 */}
                {(searchResult?.tasks?.length ?? 0) > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">태스크</p>
                    {searchResult!.tasks.map((t) => {
                      const statusCfg = STATUS_CONFIG[t.status as TaskStatus];
                      const priorityCfg = PRIORITY_CONFIG[t.priority as Priority];
                      return (
                        <button
                          key={t.id}
                          onClick={() => handleSelectTask(t)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: t.project.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                            <p className="text-[11px] text-gray-400 truncate">{t.project.name}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', priorityCfg?.bg, priorityCfg?.color)}>
                              {priorityCfg?.label}
                            </span>
                            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', statusCfg?.bg, statusCfg?.color)}>
                              {statusCfg?.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="border-t border-gray-100 px-4 py-2">
                  <p className="text-[10px] text-gray-400">Enter 키 또는 항목을 클릭하여 이동</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Messages */}
        <button
          onClick={() => { setMsgOpen(!msgOpen); setNotifOpen(false); }}
          className="relative h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Mail size={18} className={(msgUnread?.count ?? 0) > 0 ? 'mail-blink' : ''} />
          {(msgUnread?.count ?? 0) > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
              {msgUnread!.count > 9 ? '9+' : msgUnread!.count}
            </span>
          )}
        </button>
        <MessagePanel open={msgOpen} onClose={() => setMsgOpen(false)} />

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setMsgOpen(false); }}
            className="relative h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Bell size={18} />
            {(unread?.count ?? 0) > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                {unread!.count > 9 ? '9+' : unread!.count}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-10 z-40 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-sm text-gray-900">알림</h3>
                  {(unread?.count ?? 0) > 0 && (
                    <button
                      onClick={() => markAll.mutate()}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      모두 읽음
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {!notifications?.length ? (
                    <p className="text-sm text-gray-400 text-center py-8">알림이 없습니다.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          'px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors',
                          !n.isRead && 'bg-indigo-50/50',
                        )}
                        onClick={() => {
                          if (n.link) navigate(n.link);
                          setNotifOpen(false);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          {!n.isRead && <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0" />}
                          <div className={cn('flex-1', n.isRead && 'ml-4')}>
                            <p className="text-xs font-medium text-gray-900">{n.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                            <p className="text-[11px] text-gray-400 mt-1">{formatRelativeTime(n.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <Avatar name={user?.name ?? ''} avatar={user?.avatar} size="sm" />
      </div>
    </header>
  );
}
