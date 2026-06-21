import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Activity, Calendar, Pencil, Megaphone, Pin, ChevronLeft, ChevronRight, ChevronDown, UserPlus, X, Crown, ShieldCheck, Eye, Search, ArrowRight, Trash2, MessageSquare, BarChart2, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { NavLink } from 'react-router-dom';
import { projectsApi } from '../../api/projects';
import { tasksApi } from '../../api/tasks';
import { noticesApi } from '../../api/notices';
import { activityApi } from '../../api/notifications';
import { usersApi } from '../../api/users';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ErrorState } from '../../components/ui/ErrorState';
import { MessagePanel } from '../../components/layout/MessagePanel';
import { PROJECT_STATUS_CONFIG, formatDate, formatRelativeTime, cn } from '../../lib/utils';
import type { ActivityLog, ProjectRole, ProjectStatus } from '../../types';

const PROJECT_COLORS = [
  '#e60012', '#e60012', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4', '#0ea5e9',
];

const PROJECT_ICONS = ['📁', '🚀', '💡', '📊', '🎯', '⚙️', '🛠️', '📱', '💻', '🌐', '📦', '🔬'];

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'ACTIVE', label: '진행 중' },
  { value: 'COMPLETED', label: '완료' },
  { value: 'ON_HOLD', label: '보류' },
  { value: 'ARCHIVED', label: '보관됨' },
];

const ACTION_LABELS: Record<string, string> = {
  CREATED: '생성했습니다',
  UPDATED: '수정했습니다',
  DELETED: '삭제했습니다',
  ASSIGNED: '담당자를 지정했습니다',
  UNASSIGNED: '담당자를 해제했습니다',
  COMMENTED: '댓글을 작성했습니다',
  UPLOADED: '파일을 업로드했습니다',
  STATUS_CHANGED: '상태를 변경했습니다',
  PRIORITY_CHANGED: '우선순위를 변경했습니다',
  MOVED: '이동했습니다',
};

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', status: 'ACTIVE' as ProjectStatus,
    color: '#e60012', icon: '📁', startDate: '', endDate: '', openDate: '',
  });

  const navigate = useNavigate();
  const { data: project, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getOne(projectId!),
    enabled: !!projectId,
    retry: (count, err: any) => err?.response?.status === 404 ? false : count < 1,
  });

  // 삭제된 프로젝트(404) 감지 시 목록 캐시도 최신화 (사이드바/대시보드 반영)
  useEffect(() => {
    if (isError && (error as any)?.response?.status === 404) {
      qc.invalidateQueries({ queryKey: ['projects'] });
    }
  }, [isError, error, qc]);

  const updateProject = useMutation({
    mutationFn: (data: any) => projectsApi.update(projectId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setEditOpen(false);
      toast.success('프로젝트 정보가 수정되었습니다.');
    },
    onError: () => toast.error('수정에 실패했습니다.'),
  });

  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  // 온라인 상태
  const { data: onlineIds } = useQuery({ queryKey: ['online-users'], queryFn: usersApi.getOnlineIds, refetchInterval: 30_000 });
  const onlineSet = new Set(onlineIds ?? []);

  // 메시지 패널
  const [msgPanelOpen, setMsgPanelOpen] = useState(false);
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);
  const [msgTargetId, setMsgTargetId] = useState<string | null>(null);

  const openChat = (userId: string) => {
    setMsgTargetId(userId);
    setMsgPanelOpen(true);
  };

  // 프로필 팝업
  const [profilePopup, setProfilePopup] = useState<any | null>(null);

  // 멤버 관리
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [addingRole, setAddingRole] = useState<ProjectRole>('MEMBER');

  const { data: allUsers } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
    enabled: memberOpen,
  });

  const addMember = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      projectsApi.addMember(projectId!, userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('멤버가 추가되었습니다.');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '추가에 실패했습니다.'),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => projectsApi.removeMember(projectId!, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('멤버가 제거되었습니다.');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '제거에 실패했습니다.'),
  });

  const myRole = project?.members.find((m) => m.user.id === user?.id)?.role;
  const canManageProject = myRole === 'OWNER' || myRole === 'ADMIN' || isAdmin;
  const canManageMembers = canManageProject;

  // 캘린더 상태
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // 오픈예정일 달력 팝업
  const [openDatePopup, setOpenDatePopup] = useState(false);
  const [openDateMonth, setOpenDateMonth] = useState(() => new Date());
  const openDatePopupDays = useMemo(() => {
    const year = openDateMonth.getFullYear();
    const month = openDateMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= lastDate; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [openDateMonth]);

  const { data: tasks } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => tasksApi.getAll(projectId!),
    enabled: !!projectId,
  });

  const { data: notices } = useQuery({
    queryKey: ['notices', projectId],
    queryFn: () => noticesApi.getAll(projectId!),
    enabled: !!projectId,
  });

  // 캘린더 계산
  const calendarDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= lastDate; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [calMonth]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, { title: string; priority: string }[]> = {};
    tasks?.forEach((t) => {
      if (!t.dueDate) return;
      const d = new Date(t.dueDate);
      if (d.getFullYear() === calMonth.getFullYear() && d.getMonth() === calMonth.getMonth()) {
        const key = d.getDate().toString();
        if (!map[key]) map[key] = [];
        map[key].push({ title: t.title, priority: t.priority });
      }
    });
    return map;
  }, [tasks, calMonth]);

  const PRIORITY_DOT: Record<string, string> = {
    URGENT: 'bg-red-500', HIGH: 'bg-orange-400', MEDIUM: 'bg-yellow-400', LOW: 'bg-green-400',
  };

  const openEdit = () => {
    if (!project) return;
    setForm({
      name: project.name,
      description: project.description ?? '',
      status: project.status,
      color: project.color,
      icon: project.icon ?? '📁',
      startDate: project.startDate ? project.startDate.slice(0, 10) : '',
      endDate: project.endDate ? project.endDate.slice(0, 10) : '',
      openDate: project.openDate ? project.openDate.slice(0, 10) : '',
    });
    setEditOpen(true);
  };

  const { data: stats } = useQuery({
    queryKey: ['project-stats', projectId],
    queryFn: () => projectsApi.getStats(projectId!),
    enabled: !!projectId,
  });

  const { data: activity } = useQuery({
    queryKey: ['activity', projectId],
    queryFn: () => activityApi.getByProject(projectId!, 20),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 bg-gray-100 rounded w-48 animate-pulse mb-4" />
        <div className="h-4 bg-gray-100 rounded w-80 animate-pulse" />
      </div>
    );
  }

  // 삭제됐거나 접근 권한이 없는 프로젝트
  if (isError && (error as any)?.response?.status === 404) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <X size={28} className="text-gray-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-1.5">프로젝트를 찾을 수 없습니다</h2>
        <p className="text-sm text-gray-400 mb-6 max-w-sm">
          삭제되었거나 접근 권한이 없는 프로젝트입니다.
        </p>
        <button
          onClick={() => navigate('/projects')}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          프로젝트 목록으로
        </button>
      </div>
    );
  }
  if (isError) return <ErrorState className="p-12" onRetry={refetch} />;
  if (!project) return null;

  const cfg = PROJECT_STATUS_CONFIG[project.status];
  const doneCount = stats?.byStatus?.find((s) => s.status === 'DONE')?._count ?? 0;
  const completionRate = stats?.total ? Math.round((doneCount / stats.total) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ backgroundColor: project.color + '20' }}
        >
          {project.icon ?? '📁'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-gray-700">{project.name}</h1>
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>
              {cfg.label}
            </span>
          </div>
          {project.description && (
            <p className="text-sm text-gray-500">{project.description}</p>
          )}
          {(project.startDate || project.endDate) && (
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
              <Calendar size={12} />
              {project.startDate && formatDate(project.startDate)}
              {project.startDate && project.endDate && ' ~ '}
              {project.endDate && formatDate(project.endDate)}
            </div>
          )}
        </div>
        {canManageProject && (
          <button
            onClick={openEdit}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-red-600 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
          >
            <Pencil size={14} /> 정보 수정
          </button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: '전체 태스크', value: stats?.total ?? 0, color: 'text-gray-900' },
          { label: '완료율', value: `${completionRate}%`, color: 'text-emerald-600' },
          { label: '기한 초과', value: stats?.overdue ?? 0, color: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 p-4">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
        {/* 오픈예정일 카드 — 그래디언트 */}
        {(() => {
          const dday = project.openDate ? (() => {
            const today = new Date(); today.setHours(0,0,0,0);
            const open  = new Date(project.openDate); open.setHours(0,0,0,0);
            return Math.round((open.getTime() - today.getTime()) / 86400000);
          })() : null;
          const ddayLabel = dday === null ? null : dday === 0 ? 'D-Day' : dday > 0 ? `D-${dday}` : `D+${Math.abs(dday)}`;
          const openDateObj = project.openDate ? new Date(project.openDate) : null;
          return (
            <div className="relative">
              <div
                className="rounded-xl p-4 text-white cursor-pointer hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #f85032, #e73827)', boxShadow: '0 4px 16px rgba(248,80,50,0.35)' }}
                onClick={() => {
                  setOpenDateMonth(openDateObj ? new Date(openDateObj.getFullYear(), openDateObj.getMonth(), 1) : new Date());
                  setOpenDatePopup(v => !v);
                }}
              >
                <div className="flex items-center justify-between h-full">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-2xl font-bold">{project.openDate ? formatDate(project.openDate) : '-'}</p>
                      {project.openDate && (
                        <span className="text-sm font-medium text-white/80">
                          {['일', '월', '화', '수', '목', '금', '토'][new Date(project.openDate).getDay()]}요일
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 text-white/70">오픈예정일</p>
                  </div>
                  {ddayLabel && (
                    <div className={`px-3 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${dday === 0 ? 'bg-white text-orange-500' : dday! < 0 ? 'bg-white/20 text-white' : 'bg-white/25 text-white'}`}>
                      {ddayLabel}
                    </div>
                  )}
                </div>
              </div>

              {/* 달력 팝업 */}
              {openDatePopup && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpenDatePopup(false)} />
                  <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                    {/* 팝업 헤더 */}
                    <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}>
                      <button onClick={(e) => { e.stopPropagation(); setOpenDateMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 text-white transition-colors">
                        <ChevronLeft size={15} />
                      </button>
                      <span className="text-sm font-bold text-white">
                        {openDateMonth.getFullYear()}년 {openDateMonth.getMonth() + 1}월
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); setOpenDateMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 text-white transition-colors">
                        <ChevronRight size={15} />
                      </button>
                    </div>
                    {/* 요일 헤더 */}
                    <div className="grid grid-cols-7 px-3 pt-3 pb-1">
                      {['일','월','화','수','목','금','토'].map((d, i) => (
                        <div key={d} className={cn('text-center text-[10px] font-semibold pb-1', i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400')}>{d}</div>
                      ))}
                    </div>
                    {/* 날짜 그리드 */}
                    <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
                      {openDatePopupDays.map((day, idx) => {
                        if (!day) return <div key={idx} />;
                        const isOpenDate = openDateObj &&
                          openDateObj.getFullYear() === openDateMonth.getFullYear() &&
                          openDateObj.getMonth() === openDateMonth.getMonth() &&
                          openDateObj.getDate() === day;
                        const col = idx % 7;
                        return (
                          <div key={idx} className="flex items-center justify-center py-0.5">
                            <div className={cn(
                              'w-8 h-8 flex items-center justify-center rounded-full text-xs font-medium',
                              isOpenDate ? 'text-white font-bold shadow-md' : col === 0 ? 'text-red-400' : col === 6 ? 'text-blue-400' : 'text-gray-700',
                            )}
                            style={isOpenDate ? { background: 'linear-gradient(135deg, #f85032, #e73827)' } : undefined}>
                              {day}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* 오픈예정일 표시 하단 */}
                    {openDateObj && (
                      <div className="mx-3 mb-3 px-3 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}>
                        <Calendar size={12} />
                        오픈예정일: {formatDate(project.openDate!)}
                        {ddayLabel && <span className="ml-auto bg-white/25 px-2 py-0.5 rounded-full">{ddayLabel}</span>}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* 메인 3열 레이아웃: 왼쪽 2열(콘텐츠) + 오른쪽 1열(팀 멤버) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ── 왼쪽 2열 영역 ── */}
        <div className="lg:col-span-3 flex flex-col gap-6">

          {/* 공지사항 */}
          <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center shadow-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}>
                  <Megaphone size={12} className="text-white" />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-800">공지사항</span>
                  {notices && notices.length > 0 && (
                    <span className="ml-2 text-[10px] font-bold text-[#e73827] bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full">{notices.length}</span>
                  )}
                </div>
              </div>
              <NavLink to="notices" relative="route" className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-[#e73827] transition-colors group">
                전체보기 <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
              </NavLink>
            </div>

            {!notices?.length ? (
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, #fff0f0, #ffe0e0)' }}>
                  <Megaphone size={20} className="text-red-300" />
                </div>
                <p className="text-sm font-semibold text-gray-400 mb-1">등록된 공지사항이 없습니다</p>
                {canManageProject && (
                  <NavLink to="notices" relative="route" className="mt-1 text-xs text-[#e73827] hover:underline font-medium">
                    공지사항 작성하기 →
                  </NavLink>
                )}
              </div>
            ) : (
              <div className="px-4 pb-4 space-y-2">
                {/* 고정 공지 */}
                {notices.filter((n) => n.isPinned).slice(0, 1).map((n) => {
                  const isOpen = expandedNoticeId === n.id;
                  return (
                    <div key={n.id} className="rounded-xl overflow-hidden border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/40">
                      <button
                        onClick={() => setExpandedNoticeId(isOpen ? null : n.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50/60 transition-colors text-left"
                      >
                        <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Pin size={11} className="text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-amber-600 mb-0.5">고정 공지</p>
                          <p className="text-sm font-semibold text-gray-800 truncate leading-snug">{n.title}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatRelativeTime(n.createdAt)}</span>
                          <ChevronDown size={13} className={cn('text-amber-400 transition-transform duration-200', isOpen && 'rotate-180')} />
                        </div>
                      </button>
                      {isOpen && n.content && (
                        <div className="border-t border-amber-200 px-4 py-3 bg-white">
                          <p className="text-[10px] text-gray-400 mb-2 font-medium">{n.createdBy.name} · {formatDate(n.createdAt)}</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{n.content}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* 일반 공지 */}
                {notices.filter((n) => !n.isPinned).slice(0, 3).map((n) => {
                  const isOpen = expandedNoticeId === n.id;
                  return (
                    <div key={n.id} className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50/60 hover:border-gray-200 transition-colors">
                      <button
                        onClick={() => setExpandedNoticeId(isOpen ? null : n.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100/50 transition-colors text-left"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-[#e73827]/40 flex-shrink-0 mt-0.5" />
                        <p className="flex-1 text-sm font-medium text-gray-700 truncate">{n.title}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-gray-400 hidden sm:block">{n.createdBy.name}</span>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatRelativeTime(n.createdAt)}</span>
                          <ChevronDown size={13} className={cn('text-gray-300 transition-transform duration-200', isOpen && 'rotate-180')} />
                        </div>
                      </button>
                      {isOpen && n.content && (
                        <div className="border-t border-gray-100 px-4 py-3 bg-white/80">
                          <p className="text-[10px] text-gray-400 mb-2 font-medium">{n.createdBy.name} · {formatDate(n.createdAt)}</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{n.content}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
                {notices.length > 4 && (
                  <NavLink to="notices" relative="route"
                    className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-gray-400 hover:text-[#e73827] transition-colors rounded-xl hover:bg-red-50">
                    +{notices.length - 4}개 더 보기 <ArrowRight size={11} />
                  </NavLink>
                )}
              </div>
            )}
          </div>

          {/* 상태별 태스크 */}
          <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-200/70 flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md flex items-center justify-center shadow-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}>
                <BarChart2 size={12} className="text-white" />
              </div>
              <span className="text-xs font-semibold text-gray-600">상태별 태스크</span>
            </div>
            <div className="p-5">
            {stats?.byStatus?.length ? (
              <div className="space-y-2.5">
                {stats.byStatus.map((s) => {
                  const pct = stats.total ? Math.round((s._count / stats.total) * 100) : 0;
                  const statusColors: Record<string, string> = {
                    TODO: 'bg-gray-300', IN_PROGRESS: 'bg-blue-500',
                    IN_REVIEW: 'bg-yellow-500', DONE: 'bg-emerald-500', CANCELLED: 'bg-red-400',
                  };
                  const statusLabels: Record<string, string> = {
                    TODO: '할 일', IN_PROGRESS: '진행 중', IN_REVIEW: '검토 중',
                    DONE: '완료', CANCELLED: '취소',
                  };
                  return (
                    <div key={s.status}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{statusLabels[s.status]}</span>
                        <span className="text-gray-500">{s._count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', statusColors[s.status])} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">태스크가 없습니다.</p>
            )}
            </div>
          </div>

          {/* 캘린더 */}
          <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200/70">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md flex items-center justify-center shadow-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}>
                  <Calendar size={12} className="text-white" />
                </div>
                <span className="text-xs font-semibold text-gray-600">{calMonth.getFullYear()}년 {calMonth.getMonth() + 1}월</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-600 transition-colors"><ChevronLeft size={15} /></button>
                <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-600 transition-colors"><ChevronRight size={15} /></button>
              </div>
            </div>
            <div className="p-5">
            <div className="grid grid-cols-7 mb-1">
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                <div key={d} className={cn('text-center text-[11px] font-medium py-1', i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400')}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-lg overflow-hidden">
              {calendarDays.map((day, idx) => {
                const isToday = day !== null &&
                  new Date().getFullYear() === calMonth.getFullYear() &&
                  new Date().getMonth() === calMonth.getMonth() &&
                  new Date().getDate() === day;
                const dayTasks = day !== null ? (tasksByDate[day.toString()] ?? []) : [];
                const col = idx % 7;
                return (
                  <div key={idx} className={cn('bg-white min-h-[52px] p-1', !day && 'bg-gray-50')}>
                    {day && (
                      <>
                        <span className={cn('inline-flex w-5 h-5 items-center justify-center text-[11px] font-medium rounded-full mb-0.5',
                          isToday ? 'bg-primary-600 text-white' : col === 0 ? 'text-red-400' : col === 6 ? 'text-blue-400' : 'text-gray-600')}>
                          {day}
                        </span>
                        <div className="space-y-0.5">
                          {dayTasks.slice(0, 2).map((t, ti) => (
                            <div key={ti} className="flex items-center gap-0.5">
                              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', PRIORITY_DOT[t.priority])} />
                              <span className="text-[9px] text-gray-600 truncate leading-tight">{t.title}</span>
                            </div>
                          ))}
                          {dayTasks.length > 2 && <span className="text-[9px] text-gray-400">+{dayTasks.length - 2}개</span>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {Object.entries(PRIORITY_DOT).map(([k, cls]) => (
                <div key={k} className="flex items-center gap-1">
                  <span className={cn('w-2 h-2 rounded-full', cls)} />
                  <span className="text-[10px] text-gray-500">{{ URGENT: '긴급', HIGH: '높음', MEDIUM: '보통', LOW: '낮음' }[k]}</span>
                </div>
              ))}
            </div>
            </div>
          </div>

          {/* Activity Feed */}
          {activity && activity.length > 0 && (
            <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-200/70 flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md flex items-center justify-center shadow-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}>
                  <Activity size={12} className="text-white" />
                </div>
                <span className="text-xs font-semibold text-gray-600">최근 활동</span>
              </div>
              <div className="p-5">
              <div className="space-y-3">
                {(activity as ActivityLog[]).map((log) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <Avatar name={log.user.name} avatar={log.user.avatar} size="xs" className="mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600">
                        <span className="font-medium text-gray-900">{log.user.name}</span>
                        {' '}이(가) <span className="font-medium">{log.entityName}</span>을(를) {ACTION_LABELS[log.action] ?? log.action}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{formatRelativeTime(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
          )}
        </div>

        {/* ── 오른쪽 1열: 팀 멤버 (전체 높이) ── */}
        <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 flex flex-col">
          {/* 멤버 헤더 */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200/70 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md flex items-center justify-center shadow-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}>
                <Users size={12} className="text-white" />
              </div>
              <span className="text-xs font-semibold text-gray-600">팀 멤버</span>
              <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{project.members.length}명</span>
            </div>
            {canManageMembers && (
              <button
                onClick={() => setMemberOpen(true)}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-600 hover:bg-primary-50 px-2 py-1 rounded-lg transition-colors font-medium"
              >
                <UserPlus size={13} /> 관리
              </button>
            )}
          </div>

          {/* 멤버 목록 */}
          <div className="flex-1 overflow-y-auto p-3">
            {project.members.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">등록된 멤버가 없습니다.</p>
            ) : (
              <div className="space-y-1.5">
                {project.members.map((m) => {
                  const roleIcon =
                    m.role === 'OWNER' ? <Crown size={10} className="text-amber-500" /> :
                    m.role === 'ADMIN' ? <ShieldCheck size={10} className="text-gray-600" /> :
                    m.role === 'VIEWER' ? <Eye size={10} className="text-gray-400" /> : null;
                  const roleLabel: Record<string, string> = { OWNER: '소유자', ADMIN: '관리자', MEMBER: '멤버', VIEWER: '뷰어' };
                  const isSelf = m.user.id === user?.id;
                  return (
                    <div
                      key={m.id}
                      className="group flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className="relative flex-shrink-0 cursor-pointer"
                        onClick={() => setProfilePopup(m.user)}
                      >
                        <Avatar name={m.user.name} avatar={m.user.avatar} size="sm" />
                        <span className={cn(
                          'absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full',
                          onlineSet.has(m.user.id) ? 'bg-green-400' : 'bg-gray-300',
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <p className={cn('text-xs font-semibold truncate', isSelf ? 'text-gray-600' : 'text-gray-600')}>{m.user.name}</p>
                          <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                            {roleIcon}{roleLabel[m.role] ?? m.role}
                          </span>
                        </div>
                        {m.user.position && (
                          <p className="text-[10px] text-gray-300 mt-0.5">{m.user.position}</p>
                        )}
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{m.user.email}</p>
                      </div>
                      {/* 채팅 버튼 — 본인 제외 */}
                      {!isSelf && (
                        <button
                          onClick={() => openChat(m.user.id)}
                          className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 flex items-center gap-1 text-[10px] font-bold text-white px-2.5 py-1 rounded-full shadow-sm hover:shadow-md hover:brightness-105 transition-all duration-200 flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}
                          title="채팅 보내기"
                        >
                          <MessageSquare size={11} strokeWidth={2.5} /> 채팅
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 멘션 패널 */}
      <MessagePanel
        open={msgPanelOpen}
        onClose={() => { setMsgPanelOpen(false); setMsgTargetId(null); }}
        initialUserId={msgTargetId}
      />

      {/* 프로필 팝업 */}
      {profilePopup && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]" onClick={() => setProfilePopup(null)} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden pointer-events-auto">
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
              <div className="flex justify-center mt-5 mb-3">
                <Avatar name={profilePopup.name} avatar={profilePopup.avatar} size="lg" />
              </div>
              <div className="text-center px-6 pb-5 space-y-1">
                <p className="text-base font-bold text-gray-800">{profilePopup.name}</p>
                {(profilePopup.statusEmoji || profilePopup.statusText) && (
                  <p className="text-xs text-gray-400">{profilePopup.statusEmoji} {profilePopup.statusText}</p>
                )}
                {(profilePopup.position || profilePopup.department) && (
                  <p className="text-xs text-gray-500">{[profilePopup.position, profilePopup.department].filter(Boolean).join(' · ')}</p>
                )}
                {profilePopup.email && <p className="text-xs text-gray-400">{profilePopup.email}</p>}
                {profilePopup.phone && <p className="text-xs text-gray-400">{profilePopup.phone}</p>}
                {profilePopup.id !== user?.id && (
                  <div className="pt-3">
                    <button
                      onClick={() => { openChat(profilePopup.id); setProfilePopup(null); }}
                      className="w-full py-2 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}
                    >
                      메시지 보내기
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Member Management Modal */}
      {memberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMemberOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-700">팀 멤버 관리</h2>
                <p className="text-xs text-gray-400 mt-0.5">멤버를 추가하거나 역할을 변경할 수 있습니다</p>
              </div>
              <button onClick={() => setMemberOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* 현재 멤버 목록 */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-3 border-b border-gray-50">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">현재 멤버 ({project.members.length}명)</p>
                <div className="space-y-1">
                  {project.members.map((m) => {
                    const roleLabel: Record<string, string> = { OWNER: '소유자', ADMIN: '관리자', MEMBER: '멤버', VIEWER: '뷰어' };
                    const isOwner = m.role === 'OWNER';
                    const isSelf = m.user.id === user?.id;
                    return (
                      <div key={m.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 group transition-colors">
                        <Avatar name={m.user.name} avatar={m.user.avatar} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {m.user.name}
                            {isSelf && <span className="ml-1.5 text-[10px] text-gray-600 font-semibold">나</span>}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">{m.user.email}</p>
                        </div>
                        {/* 역할 변경 select */}
                        {!isOwner && !isSelf ? (
                          <select
                            value={m.role}
                            onChange={(e) => addMember.mutate({ userId: m.user.id, role: e.target.value })}
                            className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400 text-gray-600 bg-white"
                          >
                            <option value="ADMIN">관리자</option>
                            <option value="MEMBER">멤버</option>
                            <option value="VIEWER">뷰어</option>
                          </select>
                        ) : (
                          <span className="text-[11px] text-gray-400 px-2">{roleLabel[m.role]}</span>
                        )}
                        {/* 제거 버튼 */}
                        {!isOwner && !isSelf && (
                          <button
                            onClick={() => removeMember.mutate(m.user.id)}
                            disabled={removeMember.isPending}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="멤버 제거"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 멤버 추가 */}
              <div className="px-6 py-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">멤버 추가</p>
                {/* 검색 */}
                <div className="relative mb-3">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="이름 또는 이메일 검색..."
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                {/* 역할 선택 */}
                <div className="flex gap-2 mb-3">
                  {(['ADMIN', 'MEMBER', 'VIEWER'] as ProjectRole[]).map((r) => {
                    const labels: Record<string, string> = { ADMIN: '관리자', MEMBER: '멤버', VIEWER: '뷰어' };
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setAddingRole(r)}
                        className={cn(
                          'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                          addingRole === r
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                        )}
                      >
                        {labels[r]}
                      </button>
                    );
                  })}
                </div>
                {/* 사용자 목록 */}
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {allUsers
                    ?.filter((u) => {
                      const already = project.members.some((m) => m.user.id === u.id);
                      if (already) return false;
                      if (!memberSearch.trim()) return true;
                      const q = memberSearch.toLowerCase();
                      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                    })
                    .map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => addMember.mutate({ userId: u.id, role: addingRole })}
                        disabled={addMember.isPending}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-primary-50 transition-colors text-left group"
                      >
                        <Avatar name={u.name} avatar={u.avatar} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                          <p className="text-[11px] text-gray-400 truncate">{u.email}</p>
                        </div>
                        <span className="opacity-0 group-hover:opacity-100 text-[11px] text-gray-600 font-medium flex items-center gap-0.5 transition-opacity flex-shrink-0">
                          <UserPlus size={12} /> 추가
                        </span>
                      </button>
                    ))}
                  {allUsers && allUsers.filter((u) => !project.members.some((m) => m.user.id === u.id)).length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">추가할 수 있는 사용자가 없습니다.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end flex-shrink-0">
              <button
                onClick={() => setMemberOpen(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors"
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="프로젝트 정보 수정">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) return;
            updateProject.mutate({
              name: form.name,
              description: form.description || undefined,
              status: form.status,
              color: form.color,
              icon: form.icon,
              startDate: form.startDate || undefined,
              endDate: form.endDate || undefined,
              openDate: form.openDate || undefined,
            });
          }}
          className="p-6 space-y-4"
        >
          {/* 아이콘 선택 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">아이콘</label>
            <div className="flex gap-1.5 flex-wrap">
              {PROJECT_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setForm({ ...form, icon: ic })}
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all',
                    form.icon === ic ? 'bg-primary-100 ring-2 ring-primary-400' : 'bg-gray-50 hover:bg-gray-100',
                  )}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="프로젝트 이름 *"
            placeholder="프로젝트 명칭을 입력하세요."
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">설명</label>
            <textarea
              placeholder="프로젝트 설명을 입력하세요."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">상태</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                label="시작일"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="flex-1">
              <Input
                label="종료일"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
          <Input
            label="오픈예정일"
            type="date"
            value={form.openDate}
            onChange={(e) => setForm({ ...form, openDate: e.target.value })}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">색상</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={cn(
                    'w-7 h-7 rounded-full transition-transform',
                    form.color === c && 'ring-2 ring-offset-2 ring-gray-400 scale-110',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>취소</Button>
            <Button type="submit" variant="primary" loading={updateProject.isPending}>
              저장
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
