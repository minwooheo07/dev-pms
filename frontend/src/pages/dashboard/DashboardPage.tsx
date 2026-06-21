import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Clock, CalendarDays, MapPin, Users as UsersIcon,
  X, Calendar, Users, AlertTriangle, ChevronRight, ArrowUpRight,
} from 'lucide-react';
import { projectsApi } from '../../api/projects';
import { worklogsApi } from '../../api/worklogs';
import { meetingsApi } from '../../api/meetings';
import { usersApi } from '../../api/users';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { formatDate, STATUS_CONFIG } from '../../lib/utils';
import { cn } from '../../lib/utils';
import type { TaskStatus, ProjectStats, Project } from '../../types';
import toast from 'react-hot-toast';

const STATUS_PRESETS = [
  { emoji: '🟢', text: '업무 중' },
  { emoji: '🟡', text: '자리 비움' },
  { emoji: '🎯', text: '집중 중' },
  { emoji: '📅', text: '미팅 중' },
  { emoji: '🏠', text: '재택 근무' },
  { emoji: '🌴', text: '휴가 중' },
  { emoji: '🤒', text: '병가' },
  { emoji: '⛔', text: '오프라인' },
  { emoji: '☕', text: '잠깐 자리 비움' },
];

const STATUS_HEX: Record<TaskStatus, string> = {
  TODO: '#9ca3af', IN_PROGRESS: '#3b82f6', IN_REVIEW: '#eab308', DONE: '#22c55e', ON_HOLD: '#8b5cf6', CANCELLED: '#ef4444',
};
const STATUS_ORDER: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'ON_HOLD', 'CANCELLED'];

// 도넛 차트
function StatusDonut({ counts, total }: { counts: Record<TaskStatus, number>; total: number }) {
  const radius = 48, stroke = 14, circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <div className="relative flex-shrink-0">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
          {total > 0 && STATUS_ORDER.map((s) => {
            const v = counts[s] ?? 0;
            if (!v) return null;
            const dash = (v / total) * circumference;
            const seg = (
              <circle key={s} cx="60" cy="60" r={radius} fill="none"
                stroke={STATUS_HEX[s]} strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset} transform="rotate(-90 60 60)" />
            );
            offset += dash;
            return seg;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{total}</span>
          <span className="text-[10px] text-gray-400 font-medium">전체</span>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        {STATUS_ORDER.map((s) => {
          const v = counts[s] ?? 0;
          const pct = total > 0 ? Math.round((v / total) * 100) : 0;
          return (
            <div key={s} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_HEX[s] }} />
              <span className="text-gray-500 flex-1">{STATUS_CONFIG[s].label}</span>
              <span className="font-bold text-gray-800">{v}</span>
              <span className="text-gray-300 w-8 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 프로젝트 D-day 계산
function calcProjectDday(endDate: string | null | undefined, status: string) {
  if (!endDate) return null;
  if (status === 'COMPLETED') return { label: '완료', tier: 'done' as const };
  if (status === 'CANCELLED') return { label: '취소', tier: 'cancelled' as const };
  const diff = Math.ceil((new Date(endDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
  if (diff < 0)  return { label: `D+${Math.abs(diff)}`, tier: 'overdue' as const, diff };
  if (diff === 0) return { label: 'D-Day', tier: 'today' as const, diff };
  if (diff <= 7)  return { label: `D-${diff}`, tier: 'soon' as const, diff };
  if (diff <= 30) return { label: `D-${diff}`, tier: 'normal' as const, diff };
  return { label: `D-${diff}`, tier: 'far' as const, diff };
}

// 프로젝트 카드 — 가로로 넓은 레이아웃
function ProjectCardWide({ project, stats }: { project: Project; stats: ProjectStats | undefined }) {
  const total = stats?.total ?? 0;
  const done = stats?.byStatus.find(b => b.status === 'DONE')?._count ?? 0;
  const inProgress = stats?.byStatus.find(b => b.status === 'IN_PROGRESS')?._count ?? 0;
  const todo = stats?.byStatus.find(b => b.status === 'TODO')?._count ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const dday = calcProjectDday(project.endDate, project.status);

  const ddayStyle: Record<string, { bg: string; text: string; border: string; glow?: string; pulse?: boolean; shimmer?: boolean }> = {
    overdue: { bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-400', glow: 'shadow-[0_0_12px_rgba(244,63,94,0.5)]', pulse: true },
    today:   { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-400', glow: 'shadow-[0_0_10px_rgba(249,115,22,0.45)]', pulse: true },
    soon:    { bg: 'bg-amber-400', text: 'text-white', border: 'border-amber-300', glow: 'shadow-[0_0_8px_rgba(251,191,36,0.4)]', shimmer: true },
    normal:  { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    far:     { bg: 'bg-gray-100', text: 'text-gray-400', border: 'border-gray-200' },
    done:    { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-400', border: 'border-gray-200' },
  };
  const ds = dday ? ddayStyle[dday.tier] : null;

  const metrics = [
    { label: '전체 태스크', value: total, color: '#64748b' },
    { label: '진행 중', value: inProgress, color: STATUS_HEX['IN_PROGRESS'] },
    { label: '할 일', value: todo, color: STATUS_HEX['TODO'] ?? '#94a3b8' },
    { label: '완료', value: done, color: STATUS_HEX['DONE'] ?? '#10b981' },
  ];

  return (
    <Link to={`/projects/${project.id}`}
      className={cn(
        'group relative block bg-white/90 backdrop-blur-md rounded-2xl border shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.13)] hover:-translate-y-1 transition-all duration-300 overflow-hidden',
        dday?.tier === 'overdue' ? 'border-rose-200/80' : dday?.tier === 'today' ? 'border-orange-200/80' : 'border-white/80',
      )}>

      {/* 마감 임박 상단 글로우 바 */}
      {(dday?.tier === 'overdue' || dday?.tier === 'today' || dday?.tier === 'soon') && (
        <div className={cn(
          'absolute inset-x-0 top-0 h-0.5',
          dday.tier === 'overdue' ? 'bg-gradient-to-r from-rose-400 via-rose-500 to-rose-400' :
          dday.tier === 'today'   ? 'bg-gradient-to-r from-orange-400 via-orange-500 to-orange-400' :
                                    'bg-gradient-to_r from-amber-300 via-amber-400 to-amber-300',
        )} />
      )}

      {/* 호버 글로우 */}
      <div className="absolute inset-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top left, ${project.color}0a 0%, transparent 55%)` }} />

      <div className="flex flex-col lg:flex-row">
        {/* 좌측: 프로젝트 정보 */}
        <div className="flex-1 p-6 lg:p-7 lg:border-r border-gray-100">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-110"
                style={{ backgroundColor: `${project.color}15`, border: `1.5px solid ${project.color}30` }}>
                {project.icon ?? '📁'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <p className="font-bold text-lg text-gray-900 group-hover:text-primary-600 transition-colors truncate">
                    {project.name}
                  </p>
                  <span className={cn(
                    'text-xs font-medium flex-shrink-0',
                    project.status === 'ACTIVE' ? 'text-emerald-500' :
                    project.status === 'COMPLETED' ? 'text-gray-400' : 'text-amber-500'
                  )}>
                    {project.status === 'ACTIVE' ? '● 진행 중' : project.status === 'COMPLETED' ? '완료' : project.status}
                  </span>
                </div>
                {(project.startDate || project.endDate) && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                    <Calendar size={13} className="flex-shrink-0" />
                    <span className="tabular-nums">
                      {project.startDate ? formatDate(project.startDate) : '미정'}
                      <span className="text-gray-300 mx-1">~</span>
                      {project.endDate ? formatDate(project.endDate) : '미정'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {/* D-day 뱃지 */}
            {dday && ds && (
              <div className={cn(
                'relative flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all',
                ds.bg, ds.text, ds.border, ds.glow,
              )}>
                {ds.pulse && (
                  <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                    <span className={cn(
                      'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                      dday.tier === 'overdue' ? 'bg-white' : 'bg-white',
                    )} />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                  </span>
                )}
                <span className="tabular-nums tracking-tight">{dday.label}</span>
                {ds.shimmer && (
                  <span className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full animate-[shimmer_2s_ease-in-out_infinite]" />
                  </span>
                )}
              </div>
            )}
          </div>

          {project.description && (
            <p className="text-sm text-gray-500 leading-relaxed mb-5 line-clamp-2">{project.description}</p>
          )}

          {/* 진행률 */}
          <div className="mb-5">
            <div className="flex justify-between items-end text-xs mb-2">
              <span className="text-gray-400">완료율</span>
              <span className="font-bold text-2xl text-gray-900 leading-none">{pct}<span className="text-sm text-gray-400">%</span></span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${project.color}cc, ${project.color})` }}>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </div>
            </div>
          </div>

          {/* 멤버 */}
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {project.members.slice(0, 6).map(m => (
                <Avatar key={m.id} name={m.user.name} avatar={m.user.avatar} size="xs" className="ring-2 ring-white" />
              ))}
              {project.members.length > 6 && (
                <div className="w-6 h-6 rounded-full bg-gray-100 ring-2 ring-white flex items-center justify-center text-[10px] text-gray-500 font-medium">
                  +{project.members.length - 6}
                </div>
              )}
            </div>
            <span className="text-xs text-gray-400">멤버 {project.members.length}명</span>
          </div>
        </div>

        {/* 우측: 통계 패널 */}
        <div className="lg:w-72 flex-shrink-0 p-6 lg:p-7 bg-gray-50/50 grid grid-cols-2 gap-3 content-center">
          {metrics.map(m => (
            <div key={m.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color }} />
                <span className="text-[11px] text-gray-400">{m.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{m.value}</p>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

// D-day 뱃지
function getDdayConfig(endDate: string, status: string) {
  if (status === 'DONE') return { label: '완료', bg: 'bg-emerald-50', text: 'text-emerald-600' };
  if (status === 'CANCELLED') return { label: '취소', bg: 'bg-gray-100', text: 'text-gray-400' };
  const diff = Math.ceil((new Date(endDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
  if (diff < 0)  return { label: `D+${Math.abs(diff)}`, bg: 'bg-rose-50', text: 'text-rose-600' };
  if (diff === 0) return { label: 'D-day', bg: 'bg-orange-50', text: 'text-orange-600' };
  if (diff <= 3)  return { label: `D-${diff}`, bg: 'bg-amber-50', text: 'text-amber-600' };
  if (diff <= 7)  return { label: `D-${diff}`, bg: 'bg-blue-50', text: 'text-blue-600' };
  return { label: `D-${diff}`, bg: 'bg-gray-100', text: 'text-gray-400' };
}

// 마감 임박 일감 테이블
function DeadlineTable({ taskRows }: { taskRows: any[] }) {
  const rows = taskRows
    .filter(r => r.endDate)
    .sort((a, b) => {
      const aDone = a.status === 'DONE' || a.status === 'CANCELLED';
      const bDone = b.status === 'DONE' || b.status === 'CANCELLED';
      if (aDone !== bDone) return aDone ? 1 : -1;
      return +new Date(a.endDate) - +new Date(b.endDate);
    });

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-gray-300">마감일이 설정된 일감이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {['일감명', '프로젝트', '상태', '마감일', 'D-day'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-gray-300 tracking-widest uppercase first:pl-6 last:pr-6 last:text-right">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => {
            const dday = getDdayConfig(row.endDate, row.status);
            const isDimmed = row.status === 'DONE' || row.status === 'CANCELLED';
            const isUrgent = !isDimmed && (() => {
              const diff = Math.ceil((new Date(row.endDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
              return diff <= 0;
            })();

            return (
              <tr key={row.id} className={cn(
                'group transition-colors hover:bg-gray-50/60',
                isDimmed && 'opacity-40',
                isUrgent && 'bg-rose-50/30'
              )}>
                <td className="pl-6 pr-4 py-3.5 relative">
                  {isUrgent && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-rose-400" />
                  )}
                  <p className="text-sm font-semibold text-gray-800 truncate max-w-[220px]">{row.title}</p>
                  {row.description && (
                    <p className="text-[11px] text-gray-400 truncate max-w-[220px] mt-0.5">{row.description}</p>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-xs text-gray-400 truncate max-w-[100px] block">{row.project}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={cn(
                    'inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md',
                    row.status === 'DONE' ? 'bg-emerald-50 text-emerald-600' :
                    row.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600' :
                    row.status === 'IN_REVIEW' ? 'bg-amber-50 text-amber-600' :
                    row.status === 'CANCELLED' ? 'bg-gray-100 text-gray-400' :
                    'bg-gray-100 text-gray-500'
                  )}>
                    {STATUS_CONFIG[row.status as TaskStatus]?.label ?? row.status}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-xs text-gray-500 tabular-nums">{formatDate(row.endDate)}</span>
                </td>
                <td className="pl-4 pr-6 py-3.5 text-right">
                  <span className={cn(
                    'inline-flex items-center justify-center min-w-[52px] px-2.5 py-1 rounded-lg text-xs font-bold',
                    dday.bg, dday.text
                  )}>
                    {dday.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const qc = useQueryClient();
  const [viewingMeeting, setViewingMeeting] = useState<any>(null);

  // 상태 모달
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusForm, setStatusForm] = useState({ emoji: user?.statusEmoji ?? '🟢', text: user?.statusText ?? '' });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const statusModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (statusOpen) setStatusForm({ emoji: user?.statusEmoji ?? '🟢', text: user?.statusText ?? '' });
  }, [statusOpen]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (statusModalRef.current && !statusModalRef.current.contains(e.target as Node) &&
          statusBtnRef.current && !statusBtnRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
        setShowEmojiPicker(false);
      }
    }
    if (statusOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusOpen]);

  const saveStatus = useMutation({
    mutationFn: () => usersApi.updateProfile({ statusEmoji: statusForm.emoji, statusText: statusForm.text }),
    onSuccess: (updated) => {
      if (user) updateUser({ ...user, statusEmoji: updated.statusEmoji, statusText: updated.statusText });
      setStatusOpen(false);
      toast.success('상태가 업데이트됐습니다.');
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.getAll, refetchInterval: 60_000 });
  const { data: myWorklogs } = useQuery({
    queryKey: ['worklogs', 'me', user?.id],
    queryFn: () => worklogsApi.getAll({ userId: user!.id }),
    enabled: !!user?.id,
  });
  const { data: meetings } = useQuery({ queryKey: ['meetings'], queryFn: () => meetingsApi.getAll() });

  const statsQueries = useQueries({
    queries: (projects ?? []).map((p) => ({
      queryKey: ['project-stats', p.id],
      queryFn: () => projectsApi.getStats(p.id),
      enabled: !!projects,
    })),
  });

  const statusCounts: Record<TaskStatus, number> = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0, ON_HOLD: 0, CANCELLED: 0 };
  (projects ?? []).forEach((p, idx) => {
    const stats = statsQueries[idx]?.data as ProjectStats | undefined;
    if (stats) stats.byStatus.forEach((b) => { statusCounts[b.status] += b._count; });
  });
  const totalTasks = STATUS_ORDER.reduce((s, k) => s + statusCounts[k], 0);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const weekLogs = (myWorklogs ?? []).filter((l: any) => {
    const d = new Date(l.startDate ?? l.workDate);
    return d >= weekStart && d < weekEnd;
  });
  const weekHours = weekLogs.reduce((s: number, l: any) => s + (l.hours ?? 0), 0);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcomingMeetings = (meetings ?? [])
    .filter((m: any) => new Date(m.meetingDate) >= today)
    .sort((a: any, b: any) => +new Date(a.meetingDate) - +new Date(b.meetingDate))
    .slice(0, 5);

  const allLogs = myWorklogs ?? [];
  const taskMap = new Map<string, any>();
  allLogs.forEach((l: any) => {
    const taskId = l.taskId ?? l.task?.id ?? l.id;
    const endDate = l.endDate ?? l.task?.dueDate ?? l.task?.endDate ?? null;
    if (!taskMap.has(taskId)) {
      taskMap.set(taskId, {
        id: taskId,
        title: l.taskTitle ?? l.task?.title ?? l.description ?? '일감',
        endDate,
        hours: l.hours ?? 0,
        status: l.task?.status ?? l.status ?? 'TODO',
        project: l.task?.project?.name ?? l.projectName ?? '-',
      });
    } else {
      taskMap.get(taskId).hours += l.hours ?? 0;
    }
  });
  const taskRows = [...taskMap.values()];
  // 잔여 일감: 워크로그 중 완료·사용자확인·배포 단계가 아닌(=접수·개발) 건수
  const DONE_STAGES = ['COMPLETED', 'USER_CONFIRMED', 'DEPLOYED'];
  const remainingLogs = (myWorklogs ?? []).filter((l: any) => !DONE_STAGES.includes(l.stage)).length;

  return (
    <div className="min-h-full relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #f1f5f9 0%, #ffffff 55%, #f8fafc 100%)' }}>
      {/* 커튼 배경 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* 상단 색 워시 (커튼 윗단) — 다홍 톤 */}
        <div className="absolute inset-x-0 top-0 h-72"
          style={{ background: 'linear-gradient(180deg, rgba(248,80,50,0.09) 0%, rgba(230,0,18,0.04) 45%, transparent 100%)' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-8 py-10 space-y-12">

        {/* ── Welcome ── */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-primary-500 mb-1">
              {now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-3 flex-wrap">
              안녕하세요, {user?.name}님
              {/* 상태 뱃지 */}
              <div className="relative">
                <button
                  ref={statusBtnRef}
                  onClick={() => setStatusOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: 'rgba(255,255,255,0.55)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.75)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
                    color: '#374151',
                  }}
                >
                  <span>{user?.statusEmoji || '🟢'}</span>
                  <span>{user?.statusText || '상태 설정'}</span>
                </button>

                {/* 상태 편집 팝오버 */}
                {statusOpen && (
                  <div
                    ref={statusModalRef}
                    className="absolute left-0 top-full mt-2 z-50 w-76 rounded-2xl overflow-hidden"
                    style={{
                      width: 288,
                      background: 'rgba(255,255,255,0.82)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,255,255,0.8)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
                    }}
                  >
                    {/* 헤더 */}
                    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <p className="text-xs font-bold text-gray-700 tracking-wide">내 상태</p>
                      <button onClick={() => setStatusOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={14} /></button>
                    </div>

                    {/* 프리셋 */}
                    <div className="p-3 space-y-0.5">
                      {STATUS_PRESETS.map((p) => (
                        <button
                          key={p.emoji + p.text}
                          onClick={() => setStatusForm({ emoji: p.emoji, text: p.text })}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium transition-all ${
                            statusForm.emoji === p.emoji && statusForm.text === p.text
                              ? 'bg-white/80 text-gray-800 shadow-sm'
                              : 'hover:bg-white/60 text-gray-600'
                          }`}
                        >
                          <span className="text-base leading-none flex-shrink-0">{p.emoji}</span>
                          {p.text}
                        </button>
                      ))}
                    </div>

                    {/* 직접 입력 */}
                    <div className="px-3 pb-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 10 }}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">직접 입력</p>
                      <div className="flex gap-2">
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={() => setShowEmojiPicker((v) => !v)}
                            className="w-9 h-9 flex items-center justify-center text-lg rounded-lg transition-colors"
                            style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.1)' }}
                          >
                            {statusForm.emoji || '🟢'}
                          </button>
                          {showEmojiPicker && (
                            <div className="absolute left-0 bottom-full mb-2 z-50 rounded-xl p-2 grid grid-cols-6 gap-1"
                              style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                              {['🟢','🟡','🔴','⛔','🎯','📅','🏠','🌴','🤒','💼','☕','🎉','✈️','💤','🔕','🤫'].map((e) => (
                                <button key={e} onClick={() => { setStatusForm(f => ({ ...f, emoji: e })); setShowEmojiPicker(false); }}
                                  className="w-7 h-7 flex items-center justify-center text-base hover:bg-gray-100 rounded transition-colors">
                                  {e}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input
                          type="text"
                          value={statusForm.text}
                          onChange={(e) => setStatusForm(f => ({ ...f, text: e.target.value }))}
                          maxLength={80}
                          placeholder="상태 메시지"
                          className="flex-1 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                          style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.1)' }}
                        />
                      </div>
                    </div>

                    {/* 저장 */}
                    <div className="px-3 pb-3">
                      <button
                        onClick={() => saveStatus.mutate()}
                        disabled={saveStatus.isPending}
                        className="w-full py-2 text-xs font-bold text-white rounded-xl disabled:opacity-40 transition-opacity"
                        style={{ background: 'linear-gradient(135deg, #f85032, #e73827)', boxShadow: '0 2px 8px rgba(248,80,50,0.35)' }}
                      >
                        {saveStatus.isPending ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </h1>
            <p className="text-gray-400 mt-1.5">오늘도 팀과 함께 목표를 향해 나아가세요.</p>
          </div>
          {/* 스탯 칩 3개 */}
          <div className="hidden lg:flex items-center gap-3">
            {[
              { label: '이번 주 일감', value: weekLogs.length, unit: '건', from: '#6366f1', to: '#818cf8' },
              { label: '이번 주 공수', value: weekHours, unit: 'h', from: '#0ea5e9', to: '#38bdf8' },
              { label: '잔여 일감', value: remainingLogs, unit: '건', from: '#10b981', to: '#34d399' },
            ].map(({ label, value, unit, from, to }) => (
              <div key={label} className="flex flex-col items-center px-5 py-3.5 rounded-2xl text-white shadow-lg"
                style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
                <p className="text-2xl font-extrabold leading-none">
                  {value}<span className="text-sm font-normal opacity-80 ml-0.5">{unit}</span>
                </p>
                <p className="text-[11px] font-bold text-white mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 프로젝트 현황 ── */}
        {(projects ?? []).length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900">프로젝트 현황</h2>
              <Link to="/projects" className="flex items-center gap-1 text-sm text-gray-400 hover:text-primary-500 transition-colors font-medium">
                전체 보기 <ChevronRight size={14} />
              </Link>
            </div>
            <div className={cn(
              'grid grid-cols-1 gap-4',
              (projects ?? []).length > 1 && 'xl:grid-cols-2',
            )}>
              {(projects ?? []).map((p, idx) => (
                <ProjectCardWide key={p.id} project={p} stats={statsQueries[idx]?.data as ProjectStats | undefined} />
              ))}
            </div>
          </section>
        )}

        {/* ── 이번 주 일감 + 사이드 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* 이번 주 일감 */}
          <div className="lg:col-span-2 bg-white/88 backdrop-blur-md rounded-2xl border border-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.07)] ring-1 ring-gray-900/5 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">이번 주 일감</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {weekStart.getMonth() + 1}/{weekStart.getDate()} – {new Date(weekEnd.getTime() - 1).getMonth() + 1}/{new Date(weekEnd.getTime() - 1).getDate()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-900">{weekLogs.length}건</span>
                <Link to={user?.id ? `/workload?user=${user.id}` : '/workload'}
                  className="text-xs text-gray-400 hover:text-primary-500 transition-colors flex items-center gap-0.5">
                  전체 <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
            {weekLogs.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-gray-300">이번 주 등록된 일감이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {weekLogs.map((l: any) => (
                  <div key={l.id} className="flex items-start gap-4 px-6 py-3.5 hover:bg-gray-50/60 transition-colors">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: l.task?.status ? STATUS_HEX[l.task.status as TaskStatus] : '#cbd5e1' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{l.taskTitle ?? l.task?.title ?? '일감'}</p>
                      {l.description && <p className="text-xs text-gray-400 truncate mt-0.5">{l.description}</p>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-400">
                      {l.task?.project?.name && (
                        <span className="hidden sm:block truncate max-w-[80px]">{l.task.project.name}</span>
                      )}
                      <span className="font-bold text-gray-700 tabular-nums">{l.hours}h</span>
                      <span className="tabular-nums">{formatDate(l.startDate ?? l.workDate, 'MM/dd')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 우측 */}
          <div className="flex flex-col gap-6">
            {/* 태스크 상태 */}
            <div className="bg-white/88 backdrop-blur-md rounded-2xl border border-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.07)] ring-1 ring-gray-900/5 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-900">태스크 현황</h3>
              </div>
              <div className="p-6">
                {totalTasks === 0 ? (
                  <p className="text-xs text-gray-300 py-4 text-center">태스크가 없습니다.</p>
                ) : (
                  <StatusDonut counts={statusCounts} total={totalTasks} />
                )}
              </div>
            </div>

            {/* 다가오는 일정 */}
            <div className="bg-white/88 backdrop-blur-md rounded-2xl border border-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.07)] ring-1 ring-gray-900/5 overflow-hidden flex flex-col flex-1">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-900">다가오는 일정</h3>
                <Link to="/meeting-calendar" className="text-xs text-gray-400 hover:text-primary-500 transition-colors flex items-center gap-0.5">
                  달력 <ArrowUpRight size={12} />
                </Link>
              </div>
              {upcomingMeetings.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-gray-300">예정된 일정이 없습니다.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {upcomingMeetings.map((m: any) => (
                    <button key={m.id} onClick={() => setViewingMeeting(m)}
                      className="w-full flex items-start gap-4 px-6 py-3.5 hover:bg-gray-50/60 transition-colors text-left">
                      <div className="flex flex-col items-center w-8 flex-shrink-0 pt-0.5">
                        <span className="text-[10px] text-gray-400 font-medium">{formatDate(m.meetingDate, 'MM')}월</span>
                        <span className="text-base font-bold text-gray-900 leading-tight">{formatDate(m.meetingDate, 'dd')}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{m.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                          {m.startTime && <span className="flex items-center gap-0.5"><Clock size={9} /> {m.startTime}</span>}
                          {m.location && <span className="flex items-center gap-0.5 truncate"><MapPin size={9} /> {m.location}</span>}
                          {m.participants?.length > 0 && <span className="flex items-center gap-0.5"><UsersIcon size={9} /> {m.participants.length}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 마감 임박 일감 ── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">마감 임박 일감</h2>
              <p className="text-sm text-gray-400 mt-0.5">마감일 기준 오름차순 · 완료 건 하단 표시</p>
            </div>
            <div className="flex items-center gap-3">
              {taskRows.filter(r => r.endDate && r.status !== 'DONE' && r.status !== 'CANCELLED' && new Date(r.endDate) < new Date()).length > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-50 text-rose-600">
                  <AlertTriangle size={11} />
                  초과 {taskRows.filter(r => r.endDate && r.status !== 'DONE' && r.status !== 'CANCELLED' && new Date(r.endDate) < new Date()).length}건
                </span>
              )}
              <span className="text-sm text-gray-400">{taskRows.filter(r => r.endDate).length}건</span>
            </div>
          </div>
          <div className="bg-white/88 backdrop-blur-md rounded-2xl border border-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.07)] ring-1 ring-gray-900/5 overflow-hidden">
            <DeadlineTable taskRows={taskRows} />
          </div>
        </section>

      </div>

      {/* ── 일정 상세 모달 ── */}
      {viewingMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewingMeeting(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-gray-800">{viewingMeeting.title}</h2>
                {viewingMeeting.project && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {viewingMeeting.project.name}
                  </span>
                )}
              </div>
              <button onClick={() => setViewingMeeting(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-1.5">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex flex-wrap items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                {viewingMeeting.meetingDate && (
                  <span className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Calendar size={14} className="text-gray-400" />{formatDate(viewingMeeting.meetingDate)}
                  </span>
                )}
                {(viewingMeeting.startTime || viewingMeeting.endTime) && (
                  <span className="flex items-center gap-1 text-sm text-gray-600">
                    <Clock size={14} className="text-gray-400" />
                    {viewingMeeting.startTime ?? '?'}{viewingMeeting.endTime && <> ~ {viewingMeeting.endTime}</>}
                  </span>
                )}
                {viewingMeeting.location && (
                  <span className="flex items-center gap-1.5 text-sm text-gray-600">
                    <MapPin size={14} className="text-gray-400" />{viewingMeeting.location}
                  </span>
                )}
                {viewingMeeting.attendees && (
                  <span className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Users size={14} className="text-gray-400" />{viewingMeeting.attendees}
                  </span>
                )}
              </div>
              {viewingMeeting.content ? (
                <div className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{viewingMeeting.content}</div>
              ) : (
                <p className="text-sm text-gray-400">내용이 없습니다.</p>
              )}
            </div>
            {viewingMeeting.createdBy && (
              <div className="px-6 py-3 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
                <Avatar name={viewingMeeting.createdBy.name ?? '?'} avatar={viewingMeeting.createdBy.avatar} size="xs" />
                <span className="text-xs text-gray-400">{viewingMeeting.createdBy.name}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
