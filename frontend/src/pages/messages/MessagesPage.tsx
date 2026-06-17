import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Plus, X, Search, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { messagesApi } from '../../api/messages';
import { usersApi } from '../../api/users';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatRelativeTime, cn } from '../../lib/utils';

export function MessagesPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeUserId, setActiveUserId] = useState<string | null>(searchParams.get('to'));

  // URL ?to= 파라미터가 바뀔 때 (헤더 드롭다운 → 내비게이션) activeUserId 동기화
  useEffect(() => {
    const to = searchParams.get('to');
    if (to) setActiveUserId(to);
  }, [searchParams]);
  const [draft, setDraft] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: messagesApi.conversations,
    refetchInterval: 15_000,
  });

  const { data: thread } = useQuery({
    queryKey: ['thread', activeUserId],
    queryFn: () => messagesApi.thread(activeUserId!),
    enabled: !!activeUserId,
    refetchInterval: activeUserId ? 8_000 : false,
  });

  const { data: allUsers } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
    enabled: showPicker,
  });

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

  // 대화 선택 시 읽음 처리 → 안읽음 카운트 갱신
  useEffect(() => {
    if (activeUserId) {
      setSearchParams((prev) => { prev.set('to', activeUserId); return prev; }, { replace: true });
      qc.invalidateQueries({ queryKey: ['messages', 'unread'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    }
  }, [activeUserId]);

  // 새 메시지 도착/전송 시 스크롤 맨 아래로
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread?.messages?.length, activeUserId]);

  const handleSend = () => {
    if (draft.trim() && activeUserId && !sendMsg.isPending) sendMsg.mutate();
  };

  const pickerUsers = (allUsers ?? []).filter(
    (u: any) => u.id !== me?.id &&
      (!pickerSearch || u.name.toLowerCase().includes(pickerSearch.toLowerCase())),
  );

  return (
    <div className="flex h-full">
      {/* 좌: 대화 목록 */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 flex-shrink-0">
          <h1 className="text-base font-bold text-gray-900">쪽지</h1>
          <button
            onClick={() => { setShowPicker(true); setPickerSearch(''); }}
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors"
          >
            <Plus size={13} /> 새 쪽지
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!conversations?.length ? (
            <div className="p-4 text-center text-xs text-gray-400 mt-8">
              아직 대화가 없습니다.<br />"새 쪽지"로 시작하세요.
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.user.id}
                onClick={() => setActiveUserId(c.user.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50',
                  activeUserId === c.user.id && 'bg-indigo-50/60',
                )}
              >
                <Avatar name={c.user.name} avatar={c.user.avatar} size="sm" className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">{c.user.name}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelativeTime(c.lastMessage.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className={cn('text-xs truncate', c.unread > 0 ? 'text-gray-800 font-medium' : 'text-gray-400')}>
                      {c.lastMessage.senderId === me?.id && '나: '}{c.lastMessage.content}
                    </span>
                    {c.unread > 0 && (
                      <span className="flex-shrink-0 min-w-[18px] h-[18px] bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {c.unread > 9 ? '9+' : c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 우: 스레드 */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {!activeUserId ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<MessageSquare size={36} />}
              title="대화를 선택하세요"
              description="왼쪽에서 대화를 고르거나 새 쪽지를 보내보세요."
            />
          </div>
        ) : (
          <>
            {/* 스레드 헤더 */}
            <div className="flex items-center gap-3 px-6 h-14 border-b border-gray-200 bg-white flex-shrink-0">
              <Avatar name={thread?.user?.name ?? ''} avatar={thread?.user?.avatar} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{thread?.user?.name ?? '...'}</p>
                {(thread?.user?.position || thread?.user?.department) && (
                  <p className="text-[11px] text-gray-400 truncate">
                    {[thread?.user?.position, thread?.user?.department].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>

            {/* 메시지 목록 */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {!thread?.messages?.length ? (
                <div className="text-center text-xs text-gray-400 mt-10">
                  첫 쪽지를 보내보세요.
                </div>
              ) : (
                thread.messages.map((m) => {
                  const mine = m.senderId === me?.id;
                  return (
                    <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cn('flex items-end gap-2 max-w-[70%]', mine && 'flex-row-reverse')}>
                        <div
                          className={cn(
                            'px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words',
                            mine
                              ? 'bg-indigo-600 text-white rounded-br-md'
                              : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md',
                          )}
                        >
                          {m.content}
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 mb-0.5">
                          {formatRelativeTime(m.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 입력 */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-white p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  placeholder="메시지를 입력하세요... (Enter 전송, Shift+Enter 줄바꿈)"
                  rows={1}
                  className="flex-1 resize-none text-sm border border-gray-300 rounded-xl px-3.5 py-2.5 max-h-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sendMsg.isPending}
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 새 쪽지 — 사용자 선택 모달 */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPicker(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">새 쪽지 보내기</h2>
              <button onClick={() => setShowPicker(false)} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
            </div>
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="이름으로 검색..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {pickerUsers.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-6">사용자가 없습니다.</p>
              ) : (
                pickerUsers.map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => { setActiveUserId(u.id); setShowPicker(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <Avatar name={u.name} avatar={u.avatar} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {[u.position, u.department].filter(Boolean).join(' · ') || u.email}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
