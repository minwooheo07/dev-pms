import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Send, Search, Plus, MessageSquare, ChevronLeft, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { messagesApi } from '../../api/messages';
import { usersApi } from '../../api/users';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../ui/Avatar';
import { formatRelativeTime, cn } from '../../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  initialUserId?: string | null;
}

// 뷰 단계: 목록 → 채팅 | 새 멘션
type View = 'list' | 'chat' | 'new';

export function MessagePanel({ open, onClose, initialUserId }: Props) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const [view, setView] = useState<View>(initialUserId ? 'chat' : 'list');
  const [activeUserId, setActiveUserId] = useState<string | null>(initialUserId ?? null);
  const [draft, setDraft] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');
  const [confirmHideId, setConfirmHideId] = useState<string | null>(null);
  const [pendingCutoffIso, setPendingCutoffIso] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 외부에서 특정 상대 지정 시 바로 채팅 뷰로
  useEffect(() => {
    if (initialUserId) {
      setActiveUserId(initialUserId);
      setView('chat');
    }
  }, [initialUserId]);

  // 패널 닫힐 때 목록으로 리셋
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        if (!initialUserId) { setView('list'); setActiveUserId(null); }
      }, 300);
    }
  }, [open]);

  // 숨긴 대화 (localStorage, 유저별)
  const hiddenKey = `hidden_convs_${me?.id}`;
  // 삭제 기준 시각: { [userId]: lastMessage.createdAt(ISO) } — 서버 타임스탬프 기준
  // v2 키: 이전 테스트로 남은 stale 값(숫자/UUID) 무시
  const cutoffKey = `conv_cutoff_v2_${me?.id}`;

  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`hidden_convs_${me?.id ?? ''}`);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  // cutoffs: { [userId]: ISO createdAt at deletion time }
  const [cutoffs, setCutoffs] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(`conv_cutoff_v2_${me?.id ?? ''}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  // cutoffIso: 휴지통 클릭 시점에 캡처한 lastMessage.createdAt (confirm 대기 중 SSE 갱신 영향 차단)
  const hideConversation = (userId: string, cutoffIso: string) => {
    setHiddenIds(prev => {
      const next = new Set(prev);
      next.add(userId);
      localStorage.setItem(hiddenKey, JSON.stringify([...next]));
      return next;
    });
    setCutoffs(prev => {
      const next = { ...prev, [userId]: cutoffIso };
      localStorage.setItem(cutoffKey, JSON.stringify(next));
      return next;
    });
    if (activeUserId === userId) { setView('list'); setActiveUserId(null); }
  };

  const unhide = (userId: string) => {
    setHiddenIds(prev => {
      if (!prev.has(userId)) return prev;
      const next = new Set(prev);
      next.delete(userId);
      localStorage.setItem(`hidden_convs_${me?.id}`, JSON.stringify([...next]));
      return next;
    });
    // cutoffs는 그대로 유지 — 메시지 필터에 계속 사용
  };

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: messagesApi.conversations,
    enabled: open,
    refetchInterval: 30_000,
  });

  const { data: thread } = useQuery({
    queryKey: ['thread', activeUserId],
    queryFn: () => messagesApi.thread(activeUserId!),
    enabled: !!activeUserId,
    refetchInterval: false,
  });

  const { data: allUsers } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
    enabled: view === 'new',
  });

  // SSE: 새 메시지 실시간 갱신
  useEffect(() => {
    if (!me) return;
    const token = localStorage.getItem('accessToken');
    const url = `/api/messages/events${token ? `?token=${token}` : ''}`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data ?? '{}');
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['messages', 'unread'] });
      if (data.senderId) unhide(data.senderId);
      if (activeUserId && data.senderId === activeUserId) {
        qc.invalidateQueries({ queryKey: ['thread', activeUserId] });
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [me, qc, activeUserId]);

  const sendMsg = useMutation({
    mutationFn: () => messagesApi.send(activeUserId!, draft.trim()),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['thread', activeUserId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['messages', 'unread'] });
    },
    onError: () => toast.error('전송에 실패했습니다.'),
  });

  const openChat = (userId: string) => {
    setActiveUserId(userId);
    setView('chat');
    setPickerSearch('');
    setTimeout(() => {
      qc.invalidateQueries({ queryKey: ['messages', 'unread'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    }, 500);
  };

  // 새 메시지/대화 변경 시 스크롤 맨 아래
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread?.messages?.length, activeUserId]);

  useEffect(() => {
    if (view === 'chat' && open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [view, open]);

  const handleSend = () => {
    if (draft.trim() && activeUserId && !sendMsg.isPending) sendMsg.mutate();
  };

  const visibleConvs = (conversations ?? []).filter((c: any) => !hiddenIds.has(c.user.id));
  const activeConv = conversations?.find((c: any) => c.user.id === activeUserId);
  const activeUser = activeConv?.user ?? thread?.user;
  const pickerUsers = (allUsers ?? []).filter(
    (u: any) => u.id !== me?.id && (!pickerSearch || u.name.toLowerCase().includes(pickerSearch.toLowerCase())),
  );

  // 헤더 타이틀 & 백 버튼
  const headerTitle =
    view === 'chat' && activeUser ? activeUser.name :
    view === 'new' ? '새 멘션' : '멘션';
  const showBack = view === 'chat' || view === 'new';

  return (
    <>
      {/* 백드롭 */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* 슬라이드 패널 */}
      <div
        className={cn(
          'fixed top-0 right-0 bottom-0 z-50 w-[420px] flex flex-col bg-white shadow-2xl border-l border-gray-200 transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                onClick={() => { setView('list'); setActiveUserId(null); }}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <MessageSquare size={15} className="text-indigo-500" />
            <h2 className="text-sm font-bold text-gray-900">{headerTitle}</h2>
          </div>
          <div className="flex items-center gap-1">
            {view === 'list' && (
              <button
                onClick={() => setView('new')}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={13} /> 새 멘션
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── 목록 뷰 ── */}
        {view === 'list' && (
          <div className="flex-1 overflow-y-auto">
            {!visibleConvs.length ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
                  <MessageSquare size={24} className="text-indigo-300" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-1">대화가 없습니다</p>
                <p className="text-xs text-gray-400 mb-4">새 멘션을 보내 대화를 시작해보세요</p>
                <button
                  onClick={() => setView('new')}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors"
                >
                  <Plus size={13} /> 새 멘션 보내기
                </button>
              </div>
            ) : (
              visibleConvs.map((c: any) => (
                <div
                  key={c.user.id}
                  className={cn(
                    'group flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer',
                    c.unread > 0 && 'bg-indigo-50/40',
                  )}
                  onClick={() => openChat(c.user.id)}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar name={c.user.name} avatar={c.user.avatar} size="md" />
                    {c.unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                        {c.unread > 9 ? '9+' : c.unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={cn('text-sm font-semibold truncate', c.unread > 0 ? 'text-gray-900' : 'text-gray-700')}>
                        {c.user.name}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {formatRelativeTime(c.lastMessage.createdAt)}
                      </span>
                    </div>
                    <p className={cn('text-xs truncate', c.unread > 0 ? 'text-gray-600 font-medium' : 'text-gray-400')}>
                      {c.lastMessage.senderId === me?.id && <span className="text-gray-300">나: </span>}
                      {c.lastMessage.content}
                    </p>
                  </div>
                  {/* 삭제 버튼 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // 클릭 시점의 lastMessage.createdAt 캡처 — confirm 대기 중 SSE 갱신 영향 차단
                      setPendingCutoffIso(c.lastMessage?.createdAt ?? '');
                      setConfirmHideId(c.user.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all flex-shrink-0"
                    title="대화 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── 채팅 뷰 ── */}
        {view === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* 상대방 정보 */}
            {activeUser && (
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
                <Avatar name={activeUser.name} avatar={activeUser.avatar} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{activeUser.name}</p>
                  {(activeUser.position || activeUser.department) && (
                    <p className="text-[11px] text-gray-400">
                      {[activeUser.position, activeUser.department].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 메시지 목록 */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {(() => {
                const allMsgs: any[] = thread?.messages ?? [];
                const cutoffIso = activeUserId ? (cutoffs[activeUserId] ?? '') : '';
                const cutoffMs = cutoffIso ? new Date(cutoffIso).getTime() : NaN;
                // 유효한 cutoff면 그 시각 이후 메시지만, 아니면 전체
                const messages = Number.isFinite(cutoffMs)
                  ? allMsgs.filter((m) => new Date(m.createdAt).getTime() > cutoffMs)
                  : allMsgs;
                if (!messages.length) return (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageSquare size={28} className="text-gray-200 mb-2" />
                    <p className="text-sm text-gray-400">첫 멘션을 보내보세요</p>
                  </div>
                );
                return messages.map((m: any, i: number) => {
                  const isMine = m.senderId === me?.id;
                  const prev = messages[i - 1];
                  const showDate = !prev ||
                    new Date(m.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
                  return (
                    <div key={m.id}>
                      {showDate && (
                        <div className="flex items-center gap-2 my-4">
                          <div className="flex-1 h-px bg-gray-100" />
                          <span className="text-[10px] text-gray-400 px-2">
                            {new Date(m.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                          </span>
                          <div className="flex-1 h-px bg-gray-100" />
                        </div>
                      )}
                      <div className={cn('flex items-end gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}>
                        {!isMine && (
                          <Avatar name={activeUser?.name ?? ''} avatar={activeUser?.avatar} size="xs" className="flex-shrink-0 mb-0.5" />
                        )}
                        <div className={cn('max-w-[78%] group flex flex-col gap-0.5', isMine ? 'items-end' : 'items-start')}>
                          <div className={cn(
                            'px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words',
                            isMine ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm',
                          )}>
                            {m.content}
                          </div>
                          <span className="text-[10px] text-gray-400 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {new Date(m.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* 입력창 */}
            <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-indigo-400 focus-within:bg-white transition-colors">
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder-gray-400"
                />
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sendMsg.isPending}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 새 멘션 뷰 ── */}
        {view === 'new' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="이름으로 검색..."
                  className="flex-1 text-sm bg-transparent outline-none text-gray-900"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {pickerUsers.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => openChat(u.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50"
                >
                  <Avatar name={u.name} avatar={u.avatar} size="md" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{u.name}</p>
                    {(u.position || u.department) && (
                      <p className="text-[11px] text-gray-400">{[u.position, u.department].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                </button>
              ))}
              {pickerUsers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-10">검색 결과가 없습니다</p>
              )}
            </div>
          </div>
        )}

        {/* 삭제 확인 팝업 (패널 내부 오버레이) */}
        {confirmHideId && (() => {
          const target = (conversations ?? []).find((c: any) => c.user.id === confirmHideId);
          return (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
              <div className="bg-white rounded-2xl shadow-2xl w-72 overflow-hidden mx-4">
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900">대화 삭제</p>
                  <p className="text-xs text-gray-500 mt-1.5">
                    <span className="font-semibold text-gray-700">{target?.user.name ?? ''}</span>님과의 대화를 목록에서 삭제할까요?
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">새 메시지를 받으면 다시 나타납니다.</p>
                </div>
                <div className="flex gap-2 px-5 py-3">
                  <button
                    onClick={() => setConfirmHideId(null)}
                    className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => { hideConversation(confirmHideId, pendingCutoffIso); setConfirmHideId(null); }}
                    className="flex-1 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}
