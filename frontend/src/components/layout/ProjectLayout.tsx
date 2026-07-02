import { NavLink, Outlet, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, LayoutDashboard, Kanban, BarChart2, FileText, BarChart3, AlertTriangle, Megaphone, ListTree } from 'lucide-react';
import { projectsApi } from '../../api/projects';
import { cn } from '../../lib/utils';

const tabs = [
  { to: '', label: '개요', icon: LayoutDashboard, end: true },
  { to: 'wbs', label: 'WBS', icon: ListTree, end: false },
  { to: 'kanban', label: '칸반보드', icon: Kanban, end: false },
  { to: 'gantt', label: '간트차트', icon: BarChart3, end: false },
  { to: 'workload', label: '일감 관리', icon: BarChart2, end: false },
  { to: 'meetings', label: '회의록', icon: FileText, end: false },
  { to: 'issues', label: '이슈관리', icon: AlertTriangle, end: false },
  { to: 'notices', label: '공지사항', icon: Megaphone, end: false },
];

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getOne(projectId!),
    enabled: !!projectId,
  });

  const projectColor = project?.color ?? '#e60012';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 bg-white/80 backdrop-blur-md border-b border-white/60 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        {/* Breadcrumb */}
        <div className="px-6 pt-3 pb-0 flex items-center gap-1.5 text-xs text-gray-400">
          <Link to="/projects" className="hover:text-gray-600 transition-colors">프로젝트</Link>
          <ChevronRight size={12} />
          <span className="text-gray-600 font-medium">{project?.name ?? '...'}</span>
        </div>

        {/* Project identity + tab bar */}
        <div className="px-6 pt-3 flex items-end gap-6">
          {/* Project icon + name */}
          <div className="flex items-center gap-2.5 pb-3 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 shadow-sm"
              style={{ backgroundColor: projectColor + '20', border: `1.5px solid ${projectColor}40` }}
            >
              <span>{project?.icon ?? '📁'}</span>
            </div>
            <span className="text-sm font-semibold text-gray-600 leading-none">{project?.name ?? '...'}</span>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-200 mb-3 flex-shrink-0" />

          {/* Tabs */}
          <div className="flex items-end gap-0.5 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                relative="route"
                className={({ isActive }) => cn(
                  'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap border border-b-0',
                  isActive
                    ? 'text-gray-900 bg-gray-50 border-gray-200 shadow-[0_-1px_0_0_#f9fafb]'
                    : 'text-gray-500 border-transparent hover:text-gray-600 hover:bg-gray-50',
                )}
                style={({ isActive }) => isActive
                  ? { borderTopColor: projectColor, borderTopWidth: '2px' }
                  : {}}
              >
                <tab.icon size={13} />
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
