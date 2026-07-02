import { useEffect } from 'react';
import { NavLink, useNavigate, useMatch } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, FolderKanban, Bell, ChevronLeft, ChevronRight,
  Building2, Users, CalendarDays, ShieldCheck, PenTool, Table2, FileText, FlaskConical,
} from 'lucide-react';

function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width={size} height={size}>
      <defs>
        <linearGradient id="sl-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff2828"/>
          <stop offset="100%" stopColor="#a8000c"/>
        </linearGradient>
        <linearGradient id="sl-face" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="100%" stopColor="#e8e8e8"/>
        </linearGradient>
        <linearGradient id="sl-top" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="100%" stopColor="#cccccc"/>
        </linearGradient>
        <linearGradient id="sl-side" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#bbbbbb"/>
          <stop offset="100%" stopColor="#888888"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="url(#sl-bg)"/>
      <rect x="8" y="6" width="5.5" height="19" rx="0.5" fill="url(#sl-face)"/>
      <rect x="8" y="19.5" width="14" height="5.5" rx="0.5" fill="url(#sl-face)"/>
      <rect x="8" y="6" width="5.5" height="1.5" rx="0.5" fill="url(#sl-top)" opacity="0.9"/>
      <rect x="13.5" y="19.5" width="8.5" height="1.5" fill="url(#sl-top)" opacity="0.7"/>
      <rect x="13" y="7.5" width="1.5" height="12" fill="url(#sl-side)" opacity="0.85"/>
      <rect x="21.5" y="21" width="1.5" height="4" rx="0.5" fill="url(#sl-side)" opacity="0.85"/>
      <rect x="13" y="19.5" width="1.5" height="1.5" fill="#999999"/>
    </svg>
  );
}
import { cn } from '../../lib/utils';
import { useUiStore } from '../../store/ui.store';
import { useAuthStore } from '../../store/auth.store';
import { projectsApi } from '../../api/projects';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '대시보드' },
  { to: '/projects', icon: FolderKanban, label: '프로젝트' },
  { to: '/meeting-calendar', icon: CalendarDays, label: '일정관리' },
  { to: '/canvas', icon: PenTool, label: '캔버스' },
  { to: '/sheets', icon: Table2, label: '시트' },
  { to: '/templates', icon: FileText, label: '템플릿' },
  { to: '/partners', icon: Building2, label: '파트너사 관리' },
  { to: '/qa', icon: FlaskConical, label: 'QA 테스트' },
  { to: '/notifications', icon: Bell, label: '알림' },
];

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';
  const projectMatch = useMatch('/projects/:projectId/*');
  const activeProjectId = projectMatch?.params.projectId;
  const canvasDrawMatch = useMatch('/projects/:projectId/canvas/:canvasId');

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getAll,
  });

  useEffect(() => {
    if (activeProjectId) localStorage.setItem('lastProjectId', activeProjectId);
  }, [activeProjectId]);

  const storedLast = localStorage.getItem('lastProjectId') ?? undefined;
  const validLast = projects?.some((p) => p.id === storedLast) ? storedLast : undefined;
  const permissionsTargetId = activeProjectId ?? validLast ?? projects?.[0]?.id;

  return (
    <aside
      className={cn(
        'h-full flex flex-col bg-gray-950 text-white transition-all duration-200 flex-shrink-0',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-3 h-14 border-b border-gray-800">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-bold text-base tracking-tight">L.PMS</span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto">
            <Logo size={28} />
          </div>
        )}
        {!collapsed && (
          <button onClick={toggle} className="text-gray-400 hover:text-white p-1 rounded">
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/projects'}
            className={({ isActive }) => {
              // 캔버스 그리기 화면(/projects/:id/canvas/:id)에서는 캔버스 메뉴를 활성화
              const active = to === '/canvas' ? (isActive || !!canvasDrawMatch) : isActive;
              return cn(
                'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800',
                collapsed && 'justify-center px-0',
              );
            }}
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {/* Projects section */}
        {!collapsed && projects && projects.length > 0 && (
          <div className="pt-4">
            <p className="px-2 pb-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">프로젝트</p>
            {projects.slice(0, 8).map((p) => (
              <NavLink
                key={p.id}
                to={`/projects/${p.id}`}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors truncate',
                    isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800',
                  )
                }
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="truncate">{p.name}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Collapse toggle (when collapsed) */}
      {collapsed && (
        <button
          onClick={toggle}
          className="mx-auto mb-2 text-gray-400 hover:text-white p-1.5 rounded"
        >
          <ChevronRight size={16} />
        </button>
      )}

      {/* Bottom: Admin + Profile + Logout */}
      <div className="border-t border-gray-800 px-2 py-2 space-y-0.5">
        {isAdmin && (
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800',
                collapsed && 'justify-center px-0',
              )
            }
            title={collapsed ? '사용자 관리' : undefined}
          >
            <Users size={18} className="flex-shrink-0" />
            {!collapsed && <span>사용자 관리</span>}
          </NavLink>
        )}

        {permissionsTargetId ? (
          <NavLink
            to={`/projects/${permissionsTargetId}/permissions`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800',
                collapsed && 'justify-center px-0',
              )
            }
            title={collapsed ? '권한설정' : undefined}
          >
            <ShieldCheck size={18} className="flex-shrink-0" />
            {!collapsed && <span>권한설정</span>}
          </NavLink>
        ) : (
          <button
            onClick={() => navigate('/projects')}
            className={cn(
              'w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-gray-800',
              collapsed && 'justify-center px-0',
            )}
            title={collapsed ? '권한설정' : undefined}
          >
            <ShieldCheck size={18} className="flex-shrink-0" />
            {!collapsed && <span>권한설정</span>}
          </button>
        )}

      </div>
    </aside>
  );
}
