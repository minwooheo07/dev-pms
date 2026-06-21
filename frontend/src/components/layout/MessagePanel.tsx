import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Send, Search, Plus, MessageSquare, ChevronLeft, Trash2, Users, LogOut, UserPlus, User, Pencil, Eye } from 'lucide-react';
import { EmojiPickerButton } from '../ui/EmojiPicker';
import toast from 'react-hot-toast';
import { messagesApi } from '../../api/messages';
import { roomsApi } from '../../api/rooms';
import { usersApi } from '../../api/users';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../ui/Avatar';
import { formatRelativeTime, formatMessageTime, cn } from '../../lib/utils';
import { getAccessToken } from '../../utils/token';

const EMOJI_ONLY_RE = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|️|‍)+$/u;
const isEmojiOnly = (text: string) => EMOJI_ONLY_RE.test(text.trim());

interface Props {
  open: boolean;
  onClose: () => void;
  initialUserId?: string | null;
}

type Tab = 'dm' | 'group';
type View = 'list' | 'chat' | 'new' | 'room' | 'new-room';

export function MessagePanel({ open, onClose, initialUserId }: Props) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const [tab, setTab] = useState<Tab>('dm');
  const [view, setView] = useState<View>(initialUserId ? 'chat' : 'list');
  const [activeUserId, setActiveUserId] = useState<string | null>(initialUserId ?? null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [profilePopup, setProfilePopup] = useState<any | null>(null);
  const [confirmHideId, setConfirmHideId] = useState<string | null>(null);
  const [pendingCutoffIso, setPendingCutoffIso] = useState<string>('');

  // 그룹채팅 생성
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomMembers, setNewRoomMembers] = useState<string[]>([]);
  const [roomMemberSearch, setRoomMemberSearch] = useState('');

  // 멤버 추가 (룸 안에서)
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');

  // 그룹채팅 컨텍스트 메뉴
  const [ctxMenu, setCtxMenu] = useState<{ room: any; x: number; y: number } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const ctxRef = useRef<HTMLDivElement>(null);
  const [memberPopup, setMemberPopup] = useState<any | null>(null);

  // DM 컨텍스트 메뉴
  const [dmCtxMenu, setDmCtxMenu] = useState<{ conv: any; x: number; y: number } | null>(null);
  const dmCtxRef = useRef<HTMLDivElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialUserId) { setActiveUserId(initialUserId); setView('chat'); setTab('dm'); }
  }, [initialUserId]);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        if (!initialUserId) { setView('list'); setActiveUserId(null); setActiveRoomId(null); }
      }, 300);
    }
  }, [open]);

  // ── localStorage: 숨긴 DM 관리 ──
  const hiddenKey = `hidden_convs_${me?.id}`;
  const cutoffKey = `conv_cutoff_v2_${me?.id}`;
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`hidden_convs_${me?.id ?? ''}`) ?? '[]')); } catch { return new Set(); }
  });
  const [cutoffs, setCutoffs] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(`conv_cutoff_v2_${me?.id ?? ''}`) ?? '{}'); } catch { return {}; }
  });

  const hideConversation = (userId: string, cutoffIso: string) => {
    setHiddenIds(prev => { const n = new Set(prev); n.add(userId); localStorage.setItem(hiddenKey, JSON.stringify([...n])); return n; });
    setCutoffs(prev => { const n = { ...prev, [userId]: cutoffIso }; localStorage.setItem(cutoffKey, JSON.stringify(n)); return n; });
    if (activeUserId === userId) { setView('list'); setActiveUserId(null); }
  };
  const unhide = (userId: string) => {
    setHiddenIds(prev => { if (!prev.has(userId)) return prev; const n = new Set(prev); n.delete(userId); localStorage.setItem(`hidden_convs_${me?.id}`, JSON.stringify([...n])); return n; });
  };

  // ── Queries ──
  const { data: conversations } = useQuery({ queryKey: ['conversations'], queryFn: messagesApi.conversations, enabled: open, refetchInterval: 30_000 });
  const { data: thread } = useQuery({ queryKey: ['thread', activeUserId], queryFn: () => messagesApi.thread(activeUserId!), enabled: !!activeUserId, refetchInterval: false });
  const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: roomsApi.list, enabled: open, refetchInterval: 30_000 });
  const { data: roomData } = useQuery({ queryKey: ['room-messages', activeRoomId], queryFn: () => roomsApi.messages(activeRoomId!), enabled: !!activeRoomId, refetchInterval: false });
  const { data: allUsers } = useQuery({ queryKey: ['users'], queryFn: usersApi.getAll, enabled: view === 'new' || view === 'new-room' || showAddMember });
  const { data: onlineIds } = useQuery({ queryKey: ['online-users'], queryFn: usersApi.getOnlineIds, enabled: open, refetchInterval: 30_000 });
  const onlineSet = new Set(onlineIds ?? []);

  // ── SSE: DM ──
  useEffect(() => {
    if (!me) return;
    const token = getAccessToken();
    const es = new EventSource(`/api/messages/events${token ? `?token=${token}` : ''}`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data ?? '{}');
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['messages', 'unread'] });
      if (data.senderId) { unhide(data.senderId); qc.invalidateQueries({ queryKey: ['thread', data.senderId] }); }
    };
    es.onerror = () => {};
    return () => es.close();
  }, [me, qc]);

  // ── SSE: 그룹채팅 ──
  useEffect(() => {
    if (!me) return;
    const token = getAccessToken();
    const es = new EventSource(`/api/rooms/events${token ? `?token=${token}` : ''}`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data ?? '{}');
      qc.invalidateQueries({ queryKey: ['rooms'] });
      if (data.roomId) qc.invalidateQueries({ queryKey: ['room-messages', data.roomId] });
      // 내가 보낸 메시지는 토스트 제외, 패널이 닫혔거나 다른 방/뷰 보는 중이면 토스트
      if (data.senderId && data.senderId !== me.id) {
        const isViewingThisRoom = open && view === 'room' && activeRoomId === data.roomId;
        if (!isViewingThisRoom) {
          toast(`💬 ${data.senderName}: ${data.content?.slice(0, 40) ?? ''}${(data.content?.length ?? 0) > 40 ? '…' : ''}`, { duration: 4000 });
        }
      }
    };
    es.onerror = () => {};
    return () => es.close();
  }, [me, qc, open, view, activeRoomId]);

  // ── Mutations ──
  const sendDm = useMutation({
    mutationFn: () => messagesApi.send(activeUserId!, draft.trim()),
    onSuccess: () => { setDraft(''); qc.invalidateQueries({ queryKey: ['thread', activeUserId] }); qc.invalidateQueries({ queryKey: ['conversations'] }); qc.invalidateQueries({ queryKey: ['messages', 'unread'] }); },
    onError: () => toast.error('전송에 실패했습니다.'),
  });

  const sendRoomMsg = useMutation({
    mutationFn: () => roomsApi.send(activeRoomId!, draft.trim()),
    onSuccess: () => { setDraft(''); qc.invalidateQueries({ queryKey: ['room-messages', activeRoomId] }); qc.invalidateQueries({ queryKey: ['rooms'] }); },
    onError: () => toast.error('전송에 실패했습니다.'),
  });

  const createRoom = useMutation({
    mutationFn: () => roomsApi.create(newRoomName.trim() || '새 그룹채팅', newRoomMembers),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['rooms'] });
      setNewRoomName(''); setNewRoomMembers([]); setRoomMemberSearch('');
      setActiveRoomId(data.id); setView('room'); setTab('group');
      toast.success('그룹채팅방이 생성되었습니다.');
    },
    onError: () => toast.error('생성에 실패했습니다.'),
  });

  const addMember = useMutation({
    mutationFn: (userId: string) => roomsApi.addMember(activeRoomId!, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-messages', activeRoomId] }); setShowAddMember(false); toast.success('멤버가 추가되었습니다.'); },
    onError: () => toast.error('추가에 실패했습니다.'),
  });

  const leaveRoom = useMutation({
    mutationFn: () => roomsApi.leave(activeRoomId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); setActiveRoomId(null); setView('list'); toast.success('채팅방을 나갔습니다.'); },
    onError: () => toast.error('실패했습니다.'),
  });

  const leaveRoomById = useMutation({
    mutationFn: (roomId: string) => roomsApi.leave(roomId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); toast.success('채팅방을 나갔습니다.'); },
    onError: () => toast.error('실패했습니다.'),
  });

  const renameRoom = useMutation({
    mutationFn: ({ roomId, name }: { roomId: string; name: string }) => roomsApi.rename(roomId, name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); setRenameTarget(null); toast.success('채팅방 이름이 변경되었습니다.'); },
    onError: () => toast.error('변경에 실패했습니다.'),
  });

  // 컨텍스트 메뉴 외부 클릭 닫기
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ctxMenu]);

  useEffect(() => {
    if (!dmCtxMenu) return;
    const handler = (e: MouseEvent) => {
      if (dmCtxRef.current && !dmCtxRef.current.contains(e.target as Node)) setDmCtxMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dmCtxMenu]);

  // ── 자동 스크롤 ──
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread?.messages?.length, roomData?.messages?.length, activeUserId, activeRoomId]);

  useEffect(() => {
    if ((view === 'chat' || view === 'room') && open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [view, open]);

  const handleSend = () => {
    if (!draft.trim()) return;
    if (view === 'chat' && activeUserId && !sendDm.isPending) sendDm.mutate();
    if (view === 'room' && activeRoomId && !sendRoomMsg.isPending) sendRoomMsg.mutate();
  };

  const openChat = (userId: string) => {
    setActiveUserId(userId); setView('chat'); setTab('dm'); setPickerSearch('');
    setTimeout(() => { qc.invalidateQueries({ queryKey: ['messages', 'unread'] }); qc.invalidateQueries({ queryKey: ['conversations'] }); }, 500);
  };
  const openRoom = (roomId: string) => { setActiveRoomId(roomId); setView('room'); };

  const visibleConvs = (conversations ?? []).filter((c: any) => !hiddenIds.has(c.user.id));
  const activeConv = conversations?.find((c: any) => c.user.id === activeUserId);
  const activeUser = activeConv?.user ?? thread?.user;
  const activeRoom = roomData?.room;
  const activeRoomMembers: any[] = (roomData?.room?.members ?? []).map((m: any) => m.user ?? m);

  const pickerUsers = (allUsers ?? []).filter((u: any) => u.id !== me?.id && (!pickerSearch || u.name.toLowerCase().includes(pickerSearch.toLowerCase())));
  const newRoomPickerUsers = (allUsers ?? []).filter((u: any) => u.id !== me?.id && (!roomMemberSearch || u.name.toLowerCase().includes(roomMemberSearch.toLowerCase())));
  const addMemberPickerUsers = (allUsers ?? []).filter((u: any) => u.id !== me?.id && !activeRoomMembers.some((m: any) => m.id === u.id) && (!addMemberSearch || u.name.toLowerCase().includes(addMemberSearch.toLowerCase())));

  // ── 헤더 타이틀 ──
  const headerTitle =
    view === 'room' && activeRoom ? activeRoom.name :
    view === 'new' ? '새 채팅' :
    view === 'new-room' ? '그룹채팅 만들기' :
    tab === 'dm' ? '채팅' : '그룹채팅';
  const showBack = ['chat', 'new', 'room', 'new-room'].includes(view);

  const goBack = () => {
    if (view === 'chat') { setView('list'); setActiveUserId(null); }
    else if (view === 'room') { setView('list'); setActiveRoomId(null); }
    else { setView('list'); }
  };

  return createPortal(
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />}

      <div className={cn(
        'fixed top-3 right-3 bottom-3 z-50 w-[420px] flex flex-col bg-white shadow-2xl rounded-2xl overflow-hidden transition-transform duration-300 ease-in-out',
        open ? 'translate-x-0' : 'translate-x-[calc(100%+12px)]',
      )}>
        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between px-4 py-3.5 flex-shrink-0 z-10 relative"
          style={{ background: 'linear-gradient(135deg, #f85032, #e73827)', boxShadow: '0 4px 12px rgba(231,56,39,0.3)' }}>
          <div className="flex items-center gap-2">
            {showBack && (
              <button onClick={goBack} className="p-1 rounded-lg hover:bg-white/20 text-white/80 transition-colors">
                <ChevronLeft size={18} />
              </button>
            )}
            {view === 'room' ? <Users size={17} className="text-white/80" /> : <MessageSquare size={17} className="text-white/80" />}
            <h2 className="text-base font-bold text-white truncate max-w-[180px]">{headerTitle}</h2>
            {view === 'room' && activeRoomMembers.length > 0 && (
              <span className="text-white/60 text-xs">{activeRoomMembers.length}명</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {view === 'list' && tab === 'dm' && (
              <button onClick={() => setView('new')}
                className="flex items-center gap-1 text-[11px] font-bold text-[#e73827] bg-white hover:bg-white/90 px-2.5 py-1 rounded-full shadow-sm transition-colors">
                <Plus size={11} strokeWidth={2.5} /> 새 채팅
              </button>
            )}
            {view === 'list' && tab === 'group' && (
              <button onClick={() => setView('new-room')}
                className="flex items-center gap-1 text-[11px] font-bold text-[#e73827] bg-white hover:bg-white/90 px-2.5 py-1 rounded-full shadow-sm transition-colors">
                <Plus size={11} strokeWidth={2.5} /> 새 그룹
              </button>
            )}
            {view === 'room' && (
              <>
                <button onClick={() => setShowAddMember(true)}
                  className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 transition-colors" title="멤버 초대">
                  <UserPlus size={15} />
                </button>
                <button onClick={() => { if (confirm('채팅방을 나가시겠습니까?')) leaveRoom.mutate(); }}
                  className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 transition-colors" title="채팅방 나가기">
                  <LogOut size={15} />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── 탭 (목록 뷰에서만) ── */}
        {view === 'list' && (
          <div className="flex border-b border-gray-100 flex-shrink-0">
            {([['dm', '채팅', MessageSquare], ['group', '그룹채팅', Users]] as const).map(([t, label, Icon]) => (
              <button key={t} onClick={() => setTab(t as Tab)}
                className={cn('flex-1 flex items-center justify-center gap-1.5 py-4 text-sm font-semibold transition-colors border-b-2',
                  tab === t ? 'text-[#e73827] border-[#e73827]' : 'text-gray-400 border-transparent hover:text-gray-600')}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
        )}

        {/* ══ DM 목록 ══ */}
        {view === 'list' && tab === 'dm' && (
          <div className="flex-1 overflow-y-auto">
            {!visibleConvs.length ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mb-3">
                  <MessageSquare size={24} className="text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-1">대화가 없습니다</p>
                <p className="text-xs text-gray-400 mb-4">새 채팅을 보내 대화를 시작해보세요</p>
                <button onClick={() => setView('new')}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-orange-50 hover:bg-orange-100 px-4 py-2 rounded-lg transition-colors">
                  <Plus size={13} /> 새 채팅 보내기
                </button>
              </div>
            ) : (
              visibleConvs.map((c: any) => (
                <div key={c.user.id}
                  className={cn('group flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer', c.unread > 0 && 'bg-orange-50/40')}
                  onClick={() => openChat(c.user.id)}
                  onContextMenu={(e) => { e.preventDefault(); setDmCtxMenu({ conv: c, x: e.clientX, y: e.clientY }); }}>
                  <div className="relative flex-shrink-0">
                    <Avatar name={c.user.name} avatar={c.user.avatar} size="md" />
                    {c.unread > 0 ? (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                        {c.unread > 9 ? '9+' : c.unread}
                      </span>
                    ) : (
                      <span className={cn(
                        'absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full',
                        onlineSet.has(c.user.id) ? 'bg-green-400' : 'bg-gray-300',
                      )} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-semibold truncate text-gray-600">{c.user.name}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelativeTime(c.lastMessage.createdAt)}</span>
                    </div>
                    <p className={cn('text-xs truncate', c.unread > 0 ? 'text-gray-600 font-medium' : 'text-gray-400')}>
                      {c.lastMessage.senderId === me?.id && <span className="text-gray-300">나: </span>}
                      {c.lastMessage.content}
                    </p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setPendingCutoffIso(c.lastMessage?.createdAt ?? ''); setConfirmHideId(c.user.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all flex-shrink-0" title="대화 삭제">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ══ 그룹채팅 목록 ══ */}
        {view === 'list' && tab === 'group' && (
          <div className="flex-1 overflow-y-auto">
            {!(rooms ?? []).length ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mb-3">
                  <Users size={24} className="text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-1">그룹채팅방이 없습니다</p>
                <p className="text-xs text-gray-400 mb-4">새 그룹채팅방을 만들어 팀과 소통하세요</p>
                <button onClick={() => setView('new-room')}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-orange-50 hover:bg-orange-100 px-4 py-2 rounded-lg transition-colors">
                  <Plus size={13} /> 그룹채팅 만들기
                </button>
              </div>
            ) : (
              (rooms ?? []).map((r: any) => (
                <div key={r.id}
                  className="group flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openRoom(r.id)}
                  onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ room: r, x: e.clientX, y: e.clientY }); }}>
                  {/* 룸 아이콘 — 멤버 아바타 2개 겹쳐서 */}
                  <div className="relative flex-shrink-0 w-10 h-10">
                    {r.members.slice(0, 2).map((m: any, i: number) => (
                      <div key={m.id} className={cn('absolute', i === 0 ? 'top-0 left-0' : 'bottom-0 right-0')}>
                        <Avatar name={m.name} avatar={m.avatar} size="xs" className="ring-2 ring-white w-6 h-6 text-[9px]" />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-semibold truncate text-gray-600">{r.name}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {r.lastMessage ? formatRelativeTime(r.lastMessage.createdAt) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {r.lastMessage
                        ? <>{r.lastMessage.senderId === me?.id ? <span className="text-gray-300">나: </span> : <span className="text-gray-500">{r.lastMessage.sender?.name}: </span>}{r.lastMessage.content}</>
                        : <span className="italic">멤버 {r.members.length}명</span>
                      }
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ══ DM 채팅 뷰 ══ */}
        {view === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0">
            {activeUser && (() => {
              const isOnline = onlineSet.has(activeUser.id);
              return (
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
                  <div className="relative flex-shrink-0">
                    <Avatar name={activeUser.name} avatar={activeUser.avatar} size="sm" />
                    <span className={cn(
                      'absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full',
                      isOnline ? 'bg-green-400' : 'bg-gray-300',
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-700 truncate">{activeUser.name}</p>
                      <span className={cn(
                        'flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
                        isOnline
                          ? 'text-green-600 bg-green-50 border-green-200'
                          : 'text-gray-400 bg-gray-50 border-gray-200',
                      )}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', isOnline ? 'bg-green-500' : 'bg-gray-400')} />
                        {isOnline ? '온라인' : '오프라인'}
                      </span>
                    </div>
                    {(activeUser.position || activeUser.department) && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{[activeUser.position, activeUser.department].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                </div>
              );
            })()}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {(() => {
                const allMsgs: any[] = thread?.messages ?? [];
                const cutoffIso = activeUserId ? (cutoffs[activeUserId] ?? '') : '';
                const cutoffMs = cutoffIso ? new Date(cutoffIso).getTime() : NaN;
                const messages = Number.isFinite(cutoffMs) ? allMsgs.filter((m) => new Date(m.createdAt).getTime() > cutoffMs) : allMsgs;
                if (!messages.length) return (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageSquare size={28} className="text-gray-200 mb-2" />
                    <p className="text-sm text-gray-400">첫 채팅을 보내보세요</p>
                  </div>
                );
                return messages.map((m: any, i: number) => {
                  const isMine = m.senderId === me?.id;
                  const prev = messages[i - 1];
                  const showDate = !prev || new Date(m.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
                  return (
                    <div key={m.id}>
                      {showDate && (
                        <div className="flex items-center gap-2 my-4">
                          <div className="flex-1 h-px bg-gray-100" />
                          <span className="text-[10px] text-gray-400 px-2">{new Date(m.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
                          <div className="flex-1 h-px bg-gray-100" />
                        </div>
                      )}
                      <div className={cn('flex items-end gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}>
                        {!isMine && <Avatar name={activeUser?.name ?? ''} avatar={activeUser?.avatar} size="xs" className="flex-shrink-0 mb-0.5" />}
                        <div className={cn('max-w-[78%] flex flex-col gap-0.5', isMine ? 'items-end' : 'items-start')}>
                          {isEmojiOnly(m.content) ? (
                            <div className="text-4xl leading-none px-1 py-0.5 select-none">{m.content}</div>
                          ) : (
                            <div className={cn('px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words', isMine ? 'text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm')}
                              style={isMine ? { background: 'linear-gradient(135deg, #f85032, #e73827)' } : undefined}>
                              {m.content}
                            </div>
                          )}
                          <span className="text-[10px] text-gray-400 px-1 whitespace-nowrap">{formatMessageTime(m.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-[#f85032] focus-within:bg-white transition-colors">
                <EmojiPickerButton open={emojiOpen} onToggle={() => setEmojiOpen(v => !v)} onSelect={(e) => { setDraft(d => d + e); setTimeout(() => inputRef.current?.focus(), 0); }} placement="top-right" />
                <input ref={inputRef} type="text" value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="메시지를 입력하세요..." className="flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder-gray-400" />
                <button onClick={handleSend} disabled={!draft.trim() || sendDm.isPending}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-white disabled:opacity-40 transition-opacity flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}>
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ 그룹채팅 룸 뷰 ══ */}
        {view === 'room' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* 멤버 아바타 스트립 */}
            {activeRoomMembers.length > 0 && (
              <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-100 bg-gray-50/50 flex-shrink-0 overflow-x-auto no-scrollbar">
                <div className="flex -space-x-1.5 flex-shrink-0">
                  {activeRoomMembers.slice(0, 8).map((m: any) => (
                    <Avatar key={m.id} name={m.name} avatar={m.avatar} size="xs" className="ring-2 ring-white" />
                  ))}
                </div>
                {activeRoomMembers.length > 8 && <span className="text-[10px] text-gray-400">+{activeRoomMembers.length - 8}</span>}
                <span className="text-[11px] text-gray-400 ml-1">{activeRoomMembers.map((m: any) => m.name).join(', ')}</span>
              </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {!(roomData?.messages ?? []).length ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Users size={28} className="text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">첫 메시지를 보내보세요</p>
                </div>
              ) : (
                (roomData?.messages ?? []).map((m: any, i: number) => {
                  const isMine = m.senderId === me?.id;
                  const prev = (roomData?.messages ?? [])[i - 1];
                  const showDate = !prev || new Date(m.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
                  const showSender = !isMine && (!prev || prev.senderId !== m.senderId);
                  return (
                    <div key={m.id}>
                      {showDate && (
                        <div className="flex items-center gap-2 my-4">
                          <div className="flex-1 h-px bg-gray-100" />
                          <span className="text-[10px] text-gray-400 px-2">{new Date(m.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
                          <div className="flex-1 h-px bg-gray-100" />
                        </div>
                      )}
                      <div className={cn('flex items-end gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}>
                        {!isMine && (
                          <div className="flex-shrink-0 mb-0.5">
                            {showSender ? <Avatar name={m.sender?.name ?? ''} avatar={m.sender?.avatar} size="xs" /> : <div className="w-6" />}
                          </div>
                        )}
                        <div className={cn('max-w-[78%] flex flex-col gap-0.5', isMine ? 'items-end' : 'items-start')}>
                          {showSender && !isMine && <span className="text-[10px] text-gray-500 font-semibold px-1">{m.sender?.name}</span>}
                          {isEmojiOnly(m.content) ? (
                            <div className="text-4xl leading-none px-1 py-0.5 select-none">{m.content}</div>
                          ) : (
                            <div className={cn('px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words', isMine ? 'text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm')}
                              style={isMine ? { background: 'linear-gradient(135deg, #f85032, #e73827)' } : undefined}>
                              {m.content}
                            </div>
                          )}
                          <span className="text-[10px] text-gray-400 px-1 whitespace-nowrap">{formatMessageTime(m.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-[#f85032] focus-within:bg-white transition-colors">
                <EmojiPickerButton open={emojiOpen} onToggle={() => setEmojiOpen(v => !v)} onSelect={(e) => { setDraft(d => d + e); setTimeout(() => inputRef.current?.focus(), 0); }} placement="top-right" />
                <input ref={inputRef} type="text" value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="메시지를 입력하세요..." className="flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder-gray-400" />
                <button onClick={handleSend} disabled={!draft.trim() || sendRoomMsg.isPending}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-white disabled:opacity-40 transition-opacity flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}>
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ 새 채팅 DM ══ */}
        {view === 'new' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input autoFocus type="text" value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="이름으로 검색..." className="flex-1 text-sm bg-transparent outline-none text-gray-900" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {pickerUsers.map((u: any) => (
                <div key={u.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50">
                  <button onClick={() => openChat(u.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <Avatar name={u.name} avatar={u.avatar} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-600">{u.name}</p>
                      {u.statusText
                        ? <p className="text-[11px] text-gray-400 truncate">{u.statusText}</p>
                        : (u.position || u.department) && <p className="text-[11px] text-gray-400">{[u.position, u.department].filter(Boolean).join(' · ')}</p>
                      }
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setProfilePopup(u); }}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg"
                  >
                    <User size={11} />
                    프로필
                  </button>
                </div>
              ))}
              {!pickerUsers.length && <p className="text-sm text-gray-400 text-center py-10">검색 결과가 없습니다</p>}
            </div>
          </div>
        )}

        {/* ══ 새 그룹채팅 생성 ══ */}
        {view === 'new-room' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-gray-100 flex-shrink-0 space-y-3">
              {/* 채팅방 이름 */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">채팅방 이름</label>
                <input autoFocus type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="그룹채팅방 이름 입력"
                  className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#f85032]/30 focus:border-[#f85032]" />
              </div>
              {/* 선택된 멤버 */}
              {newRoomMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {newRoomMembers.map((id) => {
                    const u = (allUsers ?? []).find((u: any) => u.id === id);
                    return u ? (
                      <span key={id} className="flex items-center gap-1 text-[11px] bg-orange-50 text-[#e73827] px-2 py-1 rounded-full border border-orange-200">
                        {u.name}
                        <button onClick={() => setNewRoomMembers(p => p.filter(i => i !== id))} className="hover:text-red-600"><X size={10} /></button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
              {/* 멤버 검색 */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">멤버 추가</label>
                <div className="mt-1.5 flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                  <Search size={13} className="text-gray-400 flex-shrink-0" />
                  <input type="text" value={roomMemberSearch} onChange={(e) => setRoomMemberSearch(e.target.value)}
                    placeholder="이름으로 검색..." className="flex-1 text-sm bg-transparent outline-none text-gray-900" />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {newRoomPickerUsers.map((u: any) => {
                const checked = newRoomMembers.includes(u.id);
                return (
                  <button key={u.id} onClick={() => setNewRoomMembers(p => checked ? p.filter(i => i !== u.id) : [...p, u.id])}
                    className={cn('w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left border-b border-gray-50', checked ? 'bg-orange-50' : 'hover:bg-gray-50')}>
                    <Avatar name={u.name} avatar={u.avatar} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-600">{u.name}</p>
                      {u.statusText ? <p className="text-[11px] text-gray-400 truncate">{u.statusText}</p>
                        : (u.position || u.department) && <p className="text-[11px] text-gray-400">{[u.position, u.department].filter(Boolean).join(' · ')}</p>}
                    </div>
                    {checked && (
                      <div className="w-5 h-5 rounded-full bg-[#e73827] flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 12 12" className="w-3 h-3 text-white fill-current"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => createRoom.mutate()}
                disabled={newRoomMembers.length === 0 || createRoom.isPending}
                className="w-full py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-40 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}>
                {createRoom.isPending ? '생성 중...' : `채팅방 만들기 ${newRoomMembers.length > 0 ? `(${newRoomMembers.length + 1}명)` : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* ══ DM 삭제 확인 팝업 ══ */}
        {confirmHideId && (() => {
          const target = (conversations ?? []).find((c: any) => c.user.id === confirmHideId);
          return (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
              <div className="bg-white rounded-2xl shadow-2xl w-72 overflow-hidden mx-4">
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-600">대화 삭제</p>
                  <p className="text-xs text-gray-500 mt-1.5"><span className="font-semibold text-gray-600">{target?.user.name ?? ''}</span>님과의 대화를 목록에서 삭제할까요?</p>
                  <p className="text-[11px] text-gray-400 mt-1">새 메시지를 받으면 다시 나타납니다.</p>
                </div>
                <div className="flex gap-2 px-5 py-3">
                  <button onClick={() => setConfirmHideId(null)} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">취소</button>
                  <button onClick={() => { hideConversation(confirmHideId, pendingCutoffIso); setConfirmHideId(null); }} className="flex-1 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">삭제</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══ 멤버 추가 팝업 (룸 뷰에서) ══ */}
        {showAddMember && (
          <div className="absolute inset-0 z-10 flex flex-col bg-white">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100 flex-shrink-0">
              <button onClick={() => { setShowAddMember(false); setAddMemberSearch(''); }} className="p-1 text-gray-400 hover:text-gray-600"><ChevronLeft size={18} /></button>
              <span className="text-sm font-bold text-gray-700">멤버 초대</span>
            </div>
            <div className="p-4 flex-shrink-0">
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                <Search size={13} className="text-gray-400" />
                <input autoFocus type="text" value={addMemberSearch} onChange={(e) => setAddMemberSearch(e.target.value)}
                  placeholder="이름으로 검색..." className="flex-1 text-sm bg-transparent outline-none" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {addMemberPickerUsers.map((u: any) => (
                <button key={u.id} onClick={() => addMember.mutate(u.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-50">
                  <Avatar name={u.name} avatar={u.avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-600">{u.name}</p>
                    {u.statusText ? <p className="text-[11px] text-gray-400 truncate">{u.statusText}</p>
                      : u.position && <p className="text-[11px] text-gray-400">{u.position}</p>}
                  </div>
                  <UserPlus size={14} className="text-gray-300" />
                </button>
              ))}
              {!addMemberPickerUsers.length && <p className="text-sm text-gray-400 text-center py-10">초대할 수 있는 멤버가 없습니다</p>}
            </div>
          </div>
        )}
      </div>

      {/* 프로필 팝업 */}
      {profilePopup && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]" onClick={() => setProfilePopup(null)} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden pointer-events-auto">
              {/* 헤더 */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}>
                    <User size={13} className="text-white" />
                  </div>
                  <span className="text-sm font-bold text-gray-800">프로필 정보</span>
                </div>
                <button onClick={() => setProfilePopup(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <X size={14} />
                </button>
              </div>
              {/* 아바타 */}
              <div className="flex justify-center mt-5 mb-3">
                <Avatar name={profilePopup.name} avatar={profilePopup.avatar} size="lg" />
              </div>
              {/* 정보 */}
              <div className="text-center px-6 pb-5 space-y-1">
                <p className="text-base font-bold text-gray-800">{profilePopup.name}</p>
                {(profilePopup.statusEmoji || profilePopup.statusText) && (
                  <p className="text-xs text-gray-400">{profilePopup.statusEmoji} {profilePopup.statusText}</p>
                )}
                {(profilePopup.position || profilePopup.department) && (
                  <p className="text-xs text-gray-500">{[profilePopup.position, profilePopup.department].filter(Boolean).join(' · ')}</p>
                )}
                {profilePopup.email && (
                  <p className="text-xs text-gray-400">{profilePopup.email}</p>
                )}
                {profilePopup.phone && (
                  <p className="text-xs text-gray-400">{profilePopup.phone}</p>
                )}
                <div className="pt-3">
                  <button
                    onClick={() => { openChat(profilePopup.id); setProfilePopup(null); }}
                    className="w-full py-2 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}
                  >
                    메시지 보내기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 그룹채팅 멤버 확인 팝업 */}
      {memberPopup && (
        <>
          <div className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-[2px]" onClick={() => setMemberPopup(null)} />
          <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl w-72 overflow-hidden pointer-events-auto animate-slide-up">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}>
                    <Users size={12} className="text-white" />
                  </div>
                  <span className="text-sm font-bold text-gray-800">{memberPopup.name}</span>
                  <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{memberPopup.members.length}명</span>
                </div>
                <button onClick={() => setMemberPopup(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto py-2">
                {memberPopup.members.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="relative flex-shrink-0">
                      <Avatar name={m.name} avatar={m.avatar} size="sm" />
                      <span className={cn(
                        'absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full',
                        onlineSet.has(m.id) ? 'bg-green-400' : 'bg-gray-300',
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-700 truncate">{m.name}</p>
                      {m.position && <p className="text-[11px] text-gray-400 truncate">{m.position}</p>}
                    </div>
                    {m.id !== me?.id && (
                      <button
                        onClick={() => { openChat(m.id); setMemberPopup(null); }}
                        className="flex-shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-[#e73827] hover:bg-red-50 transition-colors"
                        title="채팅 보내기"
                      >
                        <MessageSquare size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* DM 우클릭 컨텍스트 메뉴 */}
      {dmCtxMenu && (
        <div
          ref={dmCtxRef}
          className="fixed z-[9999] w-44 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden py-1 animate-slide-up"
          style={{ top: dmCtxMenu.y, left: dmCtxMenu.x }}
        >
          <button
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            onClick={() => {
              if (confirm(`"${dmCtxMenu.conv.user.name}"과의 대화를 삭제하시겠습니까?`)) {
                hideConversation(dmCtxMenu.conv.user.id, dmCtxMenu.conv.lastMessage?.createdAt ?? '');
              }
              setDmCtxMenu(null);
            }}
          >
            <LogOut size={14} /> 채팅방 나가기
          </button>
        </div>
      )}

      {/* 그룹채팅 우클릭 컨텍스트 메뉴 */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed z-[9999] w-48 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden py-1 animate-slide-up"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          <button
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => {
              setRenameTarget({ id: ctxMenu.room.id, name: ctxMenu.room.name });
              setRenameDraft(ctxMenu.room.name);
              setCtxMenu(null);
            }}
          >
            <Pencil size={14} className="text-gray-400" /> 채팅방 이름 수정
          </button>
          <button
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => { setMemberPopup(ctxMenu.room); setCtxMenu(null); }}
          >
            <Eye size={14} className="text-gray-400" /> 멤버 확인
          </button>
          <div className="h-px bg-gray-100 mx-2 my-1" />
          <button
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            onClick={() => {
              if (confirm(`"${ctxMenu.room.name}" 채팅방을 나가시겠습니까?`)) {
                leaveRoomById.mutate(ctxMenu.room.id);
              }
              setCtxMenu(null);
            }}
          >
            <LogOut size={14} /> 채팅방 나가기
          </button>
        </div>
      )}

      {/* 이름 변경 모달 */}
      {renameTarget && (
        <>
          <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-[2px]" onClick={() => setRenameTarget(null)} />
          <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden pointer-events-auto animate-slide-up">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-bold text-gray-800">채팅방 이름 수정</span>
                <button onClick={() => setRenameTarget(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="px-4 py-4 space-y-3">
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && renameDraft.trim()) renameRoom.mutate({ roomId: renameTarget.id, name: renameDraft.trim() });
                    if (e.key === 'Escape') setRenameTarget(null);
                  }}
                  placeholder="채팅방 이름"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#e73827] focus:ring-1 focus:ring-[#e73827]/30 transition-colors"
                />
                <div className="flex gap-2">
                  <button onClick={() => setRenameTarget(null)}
                    className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                    취소
                  </button>
                  <button
                    disabled={!renameDraft.trim() || renameRoom.isPending}
                    onClick={() => renameRoom.mutate({ roomId: renameTarget.id, name: renameDraft.trim() })}
                    className="flex-1 py-2 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}
                  >
                    변경
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>,
    document.body,
  );
}
