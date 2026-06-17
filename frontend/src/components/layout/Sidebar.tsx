import { useEffect } from 'react';
import { NavLink, useNavigate, useMatch } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, FolderKanban, Bell, ChevronLeft, ChevronRight,
  LogOut, Zap, Building2, Settings, Users, CalendarDays, ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { useUiStore } from '../../store/ui.store';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../ui/Avatar';
import { projectsApi } from '../../api/projects';
import { authApi } from '../../api/auth';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '대시보드' },
  { to: '/projects', icon: FolderKanban, label: '프로젝트' },
  { to: '/meeting-calendar', icon: CalendarDays, label: '회의관리' },
  { to: '/partners', icon: Building2, label: '파트너사 관리' },
  { to: '/notifications', icon: Bell, label: '알림' },
];

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const { user, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';
  const projectMatch = useMatch('/projects/:projectId/*');
  const activeProjectId = projectMatch?.params.projectId;

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getAll,
  });

  // 현재 프로젝트 안에 있으면 마지막 본 프로젝트로 기억해 둔다
  useEffect(() => {
    if (activeProjectId) localStorage.setItem('lastProjectId', activeProjectId);
  }, [activeProjectId]);

  // 권한설정이 연결될 프로젝트: 현재 → 마지막 본 (유효한 경우) → 첫 프로젝트
  const storedLast = localStorage.getItem('lastProjectId') ?? undefined;
  const validLast = projects?.some((p) => p.id === storedLast) ? storedLast : undefined;
  const permissionsTargetId = activeProjectId ?? validLast ?? projects?.[0]?.id;

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } finally {
      logout();
      navigate('/login');
      toast.success('로그아웃 되었습니다.');
    }
  };

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
            <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">L.PMS</span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center mx-auto">
            <Zap size={14} className="text-white" />
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
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800',
                collapsed && 'justify-center px-0',
              )
            }
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
        {/* 사용자 관리 (관리자만) */}
        {isAdmin && (
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800',
                collapsed && 'justify-center px-0',
              )
            }
            title={collapsed ? '사용자 관리' : undefined}
          >
            <Users size={18} className="flex-shrink-0" />
            {!collapsed && <span>사용자 관리</span>}
          </NavLink>
        )}

        {/* 권한설정 (항상 표시, 프로젝트가 있으면 해당 프로젝트로 연결) */}
        {permissionsTargetId ? (
          <NavLink
            to={`/projects/${permissionsTargetId}/permissions`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800',
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
            onClick={() => {
              toast('먼저 프로젝트를 선택하세요.');
              navigate('/projects');
            }}
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

        {/* 프로필 설정 */}
        <NavLink
          to="/settings/profile"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800',
              collapsed && 'justify-center px-0',
            )
          }
          title={collapsed ? '프로필 설정' : undefined}
        >
          <Settings size={18} className="flex-shrink-0" />
          {!collapsed && <span>프로필 설정</span>}
        </NavLink>

        {/* User info + logout */}
        <div className={cn('flex items-center gap-2 px-2 py-1.5 mt-1', collapsed && 'justify-center')}>
          {collapsed ? (
            <button onClick={handleLogout} title="로그아웃">
              <Avatar name={user?.name ?? ''} avatar={user?.avatar} size="sm" />
            </button>
          ) : (
            <>
              <Avatar name={user?.name ?? ''} avatar={user?.avatar} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{user?.name}</p>
                <p className="text-[10px] text-gray-500 truncate">
                  {user?.position ? `${user.position}${user.department ? ' · ' + user.department : ''}` : user?.email}
                </p>
              </div>
              <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition-colors p-1" title="로그아웃">
                <LogOut size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
