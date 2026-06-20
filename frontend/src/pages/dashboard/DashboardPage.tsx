import { useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Clock, CalendarDays, MapPin, Users as UsersIcon,
  X, Calendar, Users, AlertTriangle, ChevronRight, ArrowUpRight,
} from 'lucide-react';
import { projectsApi } from '../../api/projects';
import { worklogsApi } from '../../api/worklogs';
import { meetingsApi } from '../../api/meetings';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { formatDate, STATUS_CONFIG } from '../../lib/utils';
import { cn } from '../../lib/utils';
import type { TaskStatus, ProjectStats, Project } from '../../types';

const STATUS_HEX: Record<TaskStatus, string> = {
  TODO: '#9ca3af', IN_PROGRESS: '#3b82f6', IN_REVIEW: '#eab308', DONE: '#22c55e', CANCELLED: '#ef4444',
};
const STATUS_ORDER: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];

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

// 프로젝트 카드
function ProjectCard({ project, stats }: { project: Project; stats: ProjectStats | undefined }) {
  const total = stats?.total ?? 0;
  const done = stats?.byStatus.find(b => b.status === 'DONE')?._count ?? 0;
  const inProgress = stats?.byStatus.find(b => b.status === 'IN_PROGRESS')?._count ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Link to={`/projects/${project.id}`}
      className="group relative block bg-white/90 backdrop-blur-md rounded-2xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.13)] hover:-translate-y-1.5 transition-all duration-300 overflow-hidden">
      {/* 호버 글로우 */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(ellipse at top left, ${project.color}0a 0%, transparent 60%)` }} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-110"
              style={{ backgroundColor: `${project.color}15`, border: `1.5px solid ${project.color}30` }}>
              {project.icon ?? '📁'}
            </div>
            <div>
              <p className="font-bold text-sm text-gray-900 group-hover:text-primary-600 transition-colors truncate max-w-[140px]">
                {project.name}
              </p>
              <span className={cn(
                'text-[11px] font-medium',
                project.status === 'ACTIVE' ? 'text-emerald-500' :
                project.status === 'COMPLETED' ? 'text-gray-400' : 'text-amber-500'
              )}>
                {project.status === 'ACTIVE' ? '● 진행 중' : project.status === 'COMPLETED' ? '완료' : project.status}
              </span>
            </div>
          </div>
          <ArrowUpRight size={15} className="text-gray-200 group-hover:text-primary-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0 mt-0.5" />
        </div>

        {/* 진행률 */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-gray-400">완료율</span>
            <span className="font-bold text-gray-900">{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
              style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${project.color}cc, ${project.color})` }}>
              {/* shimmer */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </div>
          </div>
        </div>

        {/* 하단 */}
        <div className="flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {project.members.slice(0, 4).map(m => (
              <Avatar key={m.id} name={m.user.name} avatar={m.user.avatar} size="xs" className="ring-2 ring-white" />
            ))}
            {project.members.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-gray-100 ring-2 ring-white flex items-center justify-center text-[10px] text-gray-500 font-medium">
                +{project.members.length - 4}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_HEX['IN_PROGRESS'] }} />
            {inProgress}개 진행 중
          </div>
        </div>
      </div>
    </Link>
  );
}

// 프로젝트가 1개일 때 — 가로로 넓은 대표 카드
function ProjectCardWide({ project, stats }: { project: Project; stats: ProjectStats | undefined }) {
  const total = stats?.total ?? 0;
  const done = stats?.byStatus.find(b => b.status === 'DONE')?._count ?? 0;
  const inProgress = stats?.byStatus.find(b => b.status === 'IN_PROGRESS')?._count ?? 0;
  const todo = stats?.byStatus.find(b => b.status === 'TODO')?._count ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const metrics = [
    { label: '전체 일감', value: total, color: '#64748b' },
    { label: '진행 중', value: inProgress, color: STATUS_HEX['IN_PROGRESS'] },
    { label: '할 일', value: todo, color: STATUS_HEX['TODO'] ?? '#94a3b8' },
    { label: '완료', value: done, color: STATUS_HEX['DONE'] ?? '#10b981' },
  ];

  return (
    <Link to={`/projects/${project.id}`}
      className="group relative block bg-white/90 backdrop-blur-md rounded-2xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.13)] hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      {/* 호버 글로우 */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
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
              <div>
                <p className="font-bold text-lg text-gray-900 group-hover:text-primary-600 transition-colors">
                  {project.name}
                </p>
                <span className={cn(
                  'text-xs font-medium',
                  project.status === 'ACTIVE' ? 'text-emerald-500' :
                  project.status === 'COMPLETED' ? 'text-gray-400' : 'text-amber-500'
                )}>
                  {project.status === 'ACTIVE' ? '● 진행 중' : project.status === 'COMPLETED' ? '완료' : project.status}
                </span>
              </div>
            </div>
            <ArrowUpRight size={18} className="text-gray-200 group-hover:text-primary-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0 mt-1" />
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
  const [viewingMeeting, setViewingMeeting] = useState<any>(null);

  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.getAll });
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

  const statusCounts: Record<TaskStatus, number> = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0, CANCELLED: 0 };
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

  return (
    <div className="min-h-full relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 40%, #fff1f2 100%)' }}>
      {/* 배경 블롭 — 애니메이션 */}
      <style>{`
        @keyframes blob-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(24px, -18px) scale(1.05); }
          66% { transform: translate(-16px, 12px) scale(0.97); }
        }
        @keyframes blob-drift2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-20px, 16px) scale(1.04); }
          66% { transform: translate(18px, -10px) scale(0.98); }
        }
        .dash-blob1 { animation: blob-drift 12s ease-in-out infinite; }
        .dash-blob2 { animation: blob-drift2 15s ease-in-out infinite; }
        .dash-blob3 { animation: blob-drift 18s ease-in-out infinite reverse; }
        @keyframes shimmer-slide {
          from { transform: translateX(-100%); }
          to   { transform: translateX(200%); }
        }
        .shimmer-bar::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent);
          animation: shimmer-slide 2.2s ease-in-out infinite;
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="dash-blob1 absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-primary-300/20 blur-3xl" />
        <div className="dash-blob2 absolute top-1/3 -right-40 w-[360px] h-[360px] rounded-full bg-rose-300/18 blur-3xl" />
        <div className="dash-blob3 absolute bottom-10 left-1/3 w-[320px] h-[320px] rounded-full bg-violet-200/15 blur-3xl" />
        {/* 미세 그리드 패턴 */}
        <div className="absolute inset-0 opacity-[0.018]"
          style={{ backgroundImage: 'linear-gradient(#64748b 1px, transparent 1px), linear-gradient(90deg, #64748b 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-8 py-10 space-y-12">

        {/* ── Welcome ── */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-primary-500 mb-1">
              {now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight"
              style={{ background: 'linear-gradient(135deg, #111827 0%, #374151 60%, #be123c 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              안녕하세요, {user?.name}님
            </h1>
            <p className="text-gray-400 mt-1.5">오늘도 팀과 함께 목표를 향해 나아가세요.</p>
          </div>
          {/* 스탯 칩 3개 */}
          <div className="hidden lg:flex items-center gap-3">
            {[
              { label: '이번 주 일감', value: weekLogs.length, unit: '건', from: '#6366f1', to: '#818cf8' },
              { label: '이번 주 공수', value: weekHours, unit: 'h', from: '#0ea5e9', to: '#38bdf8' },
              { label: '진행 중 태스크', value: statusCounts['IN_PROGRESS'], unit: '건', from: '#10b981', to: '#34d399' },
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
            {(projects ?? []).length === 1 ? (
              <ProjectCardWide project={projects![0]} stats={statsQueries[0]?.data as ProjectStats | undefined} />
            ) : (
              <div className={cn(
                'grid grid-cols-1 gap-4',
                (projects ?? []).length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3',
              )}>
                {(projects ?? []).map((p, idx) => (
                  <ProjectCard key={p.id} project={p} stats={statsQueries[idx]?.data as ProjectStats | undefined} />
                ))}
              </div>
            )}
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
