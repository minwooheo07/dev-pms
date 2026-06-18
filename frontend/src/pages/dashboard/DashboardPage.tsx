import { useQuery, useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FolderKanban, CheckCircle2, AlertCircle,
  TrendingUp, ArrowRight, Clock, CalendarDays, MapPin, Users as UsersIcon,
} from 'lucide-react';
import { projectsApi } from '../../api/projects';
import { worklogsApi } from '../../api/worklogs';
import { meetingsApi } from '../../api/meetings';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { PROJECT_STATUS_CONFIG, STATUS_CONFIG, formatDate } from '../../lib/utils';
import { cn } from '../../lib/utils';
import type { Project, TaskStatus, ProjectStats } from '../../types';

// 상태별 차트 색상 (hex)
const STATUS_HEX: Record<TaskStatus, string> = {
  TODO: '#9ca3af',
  IN_PROGRESS: '#3b82f6',
  IN_REVIEW: '#eab308',
  DONE: '#22c55e',
  CANCELLED: '#ef4444',
};
const STATUS_ORDER: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shadow-sm', color)}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function ProjectCard({ project, progress }: { project: Project; progress: number }) {
  const cfg = PROJECT_STATUS_CONFIG[project.status];

  return (
    <Link
      to={`/projects/${project.id}`}
      className="block bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-indigo-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: project.color + '20' }}>
            <span className="w-full h-full flex items-center justify-center text-base">
              {project.icon ?? '📁'}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors truncate max-w-40">
              {project.name}
            </h3>
            <span className={cn('text-xs font-medium', cfg.color)}>{cfg.label}</span>
          </div>
        </div>
        <ArrowRight size={14} className="text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-1" />
      </div>

      {project.description && (
        <p className="text-xs text-gray-500 mb-3 overflow-hidden" style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{project.description}</p>
      )}

      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{project._count.tasks} 태스크</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, backgroundColor: project.color }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex -space-x-1">
          {project.members.slice(0, 4).map((m) => (
            <Avatar key={m.id} name={m.user.name} avatar={m.user.avatar} size="xs" className="ring-2 ring-white" />
          ))}
          {project.members.length > 4 && (
            <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[10px] font-medium flex items-center justify-center ring-2 ring-white">
              +{project.members.length - 4}
            </div>
          )}
        </div>
        {project.endDate && (
          <span className="text-[11px] text-gray-400">
            {formatDate(project.endDate, 'MM/dd')} 마감
          </span>
        )}
      </div>
    </Link>
  );
}

// 도넛 차트 (SVG)
function StatusDonut({ counts, total }: { counts: Record<TaskStatus, number>; total: number }) {
  const radius = 52;
  const stroke = 16;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative flex-shrink-0">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
          {total > 0 && STATUS_ORDER.map((s) => {
            const value = counts[s] ?? 0;
            if (value === 0) return null;
            const fraction = value / total;
            const dash = fraction * circumference;
            const seg = (
              <circle
                key={s}
                cx="70" cy="70" r={radius}
                fill="none"
                stroke={STATUS_HEX[s]}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += dash;
            return seg;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{total}</span>
          <span className="text-[11px] text-gray-400">전체 태스크</span>
        </div>
      </div>

      <div className="flex-1 space-y-1.5">
        {STATUS_ORDER.map((s) => {
          const value = counts[s] ?? 0;
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <div key={s} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_HEX[s] }} />
              <span className="text-gray-600 flex-1">{STATUS_CONFIG[s].label}</span>
              <span className="font-semibold text-gray-900">{value}</span>
              <span className="text-gray-400 w-9 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getAll,
  });

  // ④ 내 워크로드 (이번 주)
  const { data: myWorklogs } = useQuery({
    queryKey: ['worklogs', 'me', user?.id],
    queryFn: () => worklogsApi.getAll({ userId: user!.id }),
    enabled: !!user?.id,
  });

  // ⑥ 회의 목록
  const { data: meetings } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => meetingsApi.getAll(),
  });

  // ⑤ 프로젝트별 통계 → 전체 태스크 상태 분포 + 실제 진행률
  const statsQueries = useQueries({
    queries: (projects ?? []).map((p) => ({
      queryKey: ['project-stats', p.id],
      queryFn: () => projectsApi.getStats(p.id),
      enabled: !!projects,
    })),
  });

  // 프로젝트별 진행률 (완료/전체) 맵
  const progressByProject: Record<string, number> = {};
  const statusCounts: Record<TaskStatus, number> = {
    TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0, CANCELLED: 0,
  };
  (projects ?? []).forEach((p, idx) => {
    const stats = statsQueries[idx]?.data as ProjectStats | undefined;
    if (stats) {
      stats.byStatus.forEach((b) => { statusCounts[b.status] += b._count; });
      const done = stats.byStatus.find((b) => b.status === 'DONE')?._count ?? 0;
      progressByProject[p.id] = stats.total > 0 ? Math.round((done / stats.total) * 100) : 0;
    }
  });
  const totalTasksByStatus = STATUS_ORDER.reduce((s, k) => s + statusCounts[k], 0);

  // 이번 주 (월~일) 범위
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // 이번 주 월요일
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7); // 다음 주 월요일 (미포함)

  const weekLogs = (myWorklogs ?? []).filter((l: any) => {
    const d = new Date(l.startDate ?? l.workDate);
    return d >= weekStart && d < weekEnd;
  });
  const weekHours = weekLogs.reduce((s: number, l: any) => s + (l.hours ?? 0), 0);

  // ⑥ 다가오는 회의 (오늘 이후, 가까운 순 5개)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingMeetings = (meetings ?? [])
    .filter((m: any) => new Date(m.meetingDate) >= today)
    .sort((a: any, b: any) => +new Date(a.meetingDate) - +new Date(b.meetingDate))
    .slice(0, 5);

  const activeProjects = projects?.filter((p) => p.status === 'ACTIVE') ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          안녕하세요, {user?.name}님 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">오늘도 팀과 함께 목표를 향해 나아가세요.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={FolderKanban} label="전체 프로젝트" value={projects?.length ?? 0} color="bg-indigo-500" />
        <StatCard icon={TrendingUp} label="진행 중 프로젝트" value={activeProjects.length} color="bg-blue-500" />
        <StatCard icon={CheckCircle2} label="전체 태스크" value={totalTasksByStatus} color="bg-emerald-500" />
        <StatCard icon={Clock} label="내 이번 주 공수" value={`${weekHours}h`} color="bg-violet-500" />
      </div>

      {/* Widgets: 워크로드 / 상태분포 / 다가오는 회의 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* ④ 이번 주 워크로드 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
              <Clock size={15} className="text-violet-500" /> 내 이번 주 일감
            </h2>
            <Link
              to={projects?.[0]?.id ? `/projects/${projects[0].id}/workload` : '/projects'}
              className="text-xs text-indigo-600 hover:underline"
            >전체</Link>
          </div>
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="text-3xl font-bold text-gray-900">{weekHours}</span>
            <span className="text-sm text-gray-400">시간 / {weekLogs.length}건</span>
          </div>
          {weekLogs.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">이번 주 등록된 일감이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {weekLogs.slice(0, 4).map((l: any) => (
                <div key={l.id} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-700 flex-1 truncate">{l.taskTitle ?? l.task?.title ?? l.description ?? '일감'}</span>
                  <span className="font-semibold text-gray-500 flex-shrink-0">{l.hours}h</span>
                </div>
              ))}
              {weekLogs.length > 4 && (
                <p className="text-[11px] text-gray-400 pt-1">외 {weekLogs.length - 4}건…</p>
              )}
            </div>
          )}
        </div>

        {/* ⑤ 태스크 상태 분포 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-500" /> 태스크 상태 분포
          </h2>
          {totalTasksByStatus === 0 ? (
            <p className="text-xs text-gray-400 py-10 text-center">태스크가 없습니다.</p>
          ) : (
            <StatusDonut counts={statusCounts} total={totalTasksByStatus} />
          )}
        </div>

        {/* ⑥ 다가오는 회의 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
              <CalendarDays size={15} className="text-indigo-500" /> 다가오는 회의
            </h2>
            <Link to="/meeting-calendar" className="text-xs text-indigo-600 hover:underline">달력</Link>
          </div>
          {upcomingMeetings.length === 0 ? (
            <p className="text-xs text-gray-400 py-10 text-center">예정된 회의가 없습니다.</p>
          ) : (
            <div className="space-y-2.5">
              {upcomingMeetings.map((m: any) => (
                <div key={m.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center justify-center w-11 flex-shrink-0 bg-indigo-50 rounded-lg py-1">
                    <span className="text-[10px] text-indigo-400 font-medium leading-none">{formatDate(m.meetingDate, 'MM월')}</span>
                    <span className="text-base font-bold text-indigo-600 leading-tight">{formatDate(m.meetingDate, 'dd')}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 truncate">{m.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                      {m.startTime && <span className="flex items-center gap-0.5"><Clock size={9} /> {m.startTime}</span>}
                      {m.location && <span className="flex items-center gap-0.5 truncate"><MapPin size={9} /> {m.location}</span>}
                      {m.participants?.length > 0 && (
                        <span className="flex items-center gap-0.5"><UsersIcon size={9} /> {m.participants.length}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">내 프로젝트</h2>
          <Link to="/projects" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
            전체보기 <ArrowRight size={14} />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : projects?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.slice(0, 6).map((p) => (
              <ProjectCard key={p.id} project={p} progress={progressByProject[p.id] ?? 0} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <FolderKanban size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">프로젝트가 없습니다.</p>
            <Link to="/projects" className="text-indigo-600 text-sm font-medium mt-2 inline-block hover:underline">
              첫 프로젝트 만들기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
