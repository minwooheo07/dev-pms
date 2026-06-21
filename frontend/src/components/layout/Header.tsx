import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, Mail, Settings, LogOut, ChevronDown, Lock, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../api/notifications';
import { messagesApi } from '../../api/messages';
import { searchApi } from '../../api/search';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../../store/auth.store';
import { authApi } from '../../api/auth';
import { useUiStore } from '../../store/ui.store';
import { formatRelativeTime, cn } from '../../lib/utils';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../lib/utils';
import { MessagePanel } from './MessagePanel';
import type { TaskStatus, Priority } from '../../types';
import type { Notification } from '../../types';

export function Header() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const openTaskModal = useUiStore((s) => s.openTaskModal);
  const openMessagePanel = useUiStore((s) => s.openMessagePanel);
  const messagePanelUserId = useUiStore((s) => s.messagePanelUserId);
  const closeMessagePanel = useUiStore((s) => s.closeMessagePanel);

  const { logout, refreshToken } = useAuthStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // 스토어에서 패널 오픈 요청 감지
  useEffect(() => {
    if (messagePanelUserId) {
      setMsgOpen(true);
      setNotifOpen(false);
    }
  }, [messagePanelUserId]);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } finally {
      logout();
      navigate('/login');
    }
  };
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

  const mentionAlarm = useUiStore((s) => s.mentionAlarm);
  const showMentionPopup = useUiStore((s) => s.showMentionPopup);
  const seenMentionIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 15_000,
  });

  // 멘션 감지: 알림 목록을 주기적으로 폴링해서 새 MENTION 감지
  const { data: allNotifs } = useQuery<Notification[]>({
    queryKey: ['notifications', 'mention-watch'],
    queryFn: notificationsApi.getAll,
    refetchInterval: mentionAlarm ? 15_000 : false,
    enabled: !!user && mentionAlarm,
  });

  useEffect(() => {
    if (!allNotifs) return;
    if (!initialized.current) {
      // 첫 로드 시 기존 알림 ID를 모두 seen 처리 (팝업 없이)
      allNotifs.forEach((n) => seenMentionIds.current.add(n.id));
      initialized.current = true;
      return;
    }
    allNotifs.forEach((n) => {
      if (n.type === 'MENTION' && !seenMentionIds.current.has(n.id)) {
        seenMentionIds.current.add(n.id);
        // 멘션 패널이 열려있으면 팝업 불필요
        if (!msgOpen) {
          showMentionPopup({ id: n.id, title: n.title, message: n.message, link: n.link });
        }
      }
    });
  }, [allNotifs, showMentionPopup]);

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
    es.onmessage = (e) => {
      const data = e.data ? JSON.parse(e.data) : {};
      qc.invalidateQueries({ queryKey: ['messages', 'unread'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      if (data.senderId) {
        qc.invalidateQueries({ queryKey: ['thread', data.senderId] });
      }
      // 메시지 도착 시 멘션 알림도 즉시 체크
      qc.invalidateQueries({ queryKey: ['notifications', 'mention-watch'] });
    };
    // 연결이 끊겨도 닫지 않음 → EventSource 자동 재연결 유지 (배포/일시 끊김 후에도 실시간 복구)
    es.onerror = () => {};
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

  const markOne = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
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
    <header className="relative z-10 h-14 bg-white/80 backdrop-blur-md border-b border-white/60 shadow-[0_1px_0_rgba(0,0,0,0.04)] flex items-center px-6 gap-4 flex-shrink-0">
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
            className="w-full h-8 pl-9 pr-3 text-sm bg-gray-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
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
          className="group relative h-8 flex items-center gap-1 px-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Mail size={16} className={(msgUnread?.count ?? 0) > 0 ? 'mail-blink flex-shrink-0' : 'flex-shrink-0'} />
          <span className="max-w-0 group-hover:max-w-[2.5rem] overflow-hidden whitespace-nowrap text-xs transition-all duration-200">멘션</span>
          {(msgUnread?.count ?? 0) > 0 && (
            <span className="min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 flex-shrink-0">
              {msgUnread!.count > 9 ? '9+' : msgUnread!.count}
            </span>
          )}
        </button>
        <MessagePanel
          open={msgOpen}
          onClose={() => { setMsgOpen(false); closeMessagePanel(); }}
          initialUserId={messagePanelUserId ?? undefined}
        />

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen(!notifOpen); setMsgOpen(false); }}
            className="group relative h-8 flex items-center gap-1 px-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Bell size={16} className="flex-shrink-0" />
            <span className="max-w-0 group-hover:max-w-[2.5rem] overflow-hidden whitespace-nowrap text-xs transition-all duration-200">알림</span>
            {(unread?.count ?? 0) > 0 && (
              <span className="min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 flex-shrink-0">
                {unread!.count > 9 ? '9+' : unread!.count}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-10 z-40 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-gray-800">알림</h3>
                    {(unread?.count ?? 0) > 0 && (
                      <span className="min-w-[18px] h-[18px] bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {unread!.count > 9 ? '9+' : unread!.count}
                      </span>
                    )}
                  </div>
                  {(unread?.count ?? 0) > 0 && (
                    <button
                      onClick={() => markAll.mutate()}
                      disabled={markAll.isPending}
                      className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {markAll.isPending ? '처리 중...' : '모두 읽음'}
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
                          !n.isRead && 'bg-primary-50/50',
                        )}
                        onClick={() => {
                          setNotifOpen(false);
                          if (!n.isRead) markOne.mutate(n.id);
                          if (n.type === 'MENTION' && n.link) {
                            const userId = new URL(n.link, 'http://x').searchParams.get('to');
                            if (userId) { openMessagePanel(userId); setMsgOpen(true); return; }
                          }
                          if (n.link) navigate(n.link);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          {!n.isRead && <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mt-1.5 flex-shrink-0" />}
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
          )}
        </div>

        {/* 프로필 드롭다운 */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); setMsgOpen(false); }}
            className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-gray-100 transition-colors"
          >
            <Avatar name={user?.name ?? ''} avatar={user?.avatar} size="sm" />
            <span className="text-sm font-medium text-gray-600 max-w-[80px] truncate">{user?.name}님</span>
            <ChevronDown size={13} className={cn('text-gray-400 transition-transform', profileOpen && 'rotate-180')} />
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-11 z-40 w-56 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                {/* 유저 정보 */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-600 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {user?.position ? `${user.position}${user.department ? ' · ' + user.department : ''}` : user?.email}
                  </p>
                </div>
                {/* 메뉴 */}
                <div className="py-1">
                  <button
                    onClick={() => { navigate('/settings/profile'); setProfileOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Settings size={15} className="text-gray-400" />
                    프로필 설정
                  </button>
                  <button
                    onClick={() => { navigate('/settings/password'); setProfileOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Lock size={15} className="text-gray-400" />
                    비밀번호 변경
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} />
                    로그아웃
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
