import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Crown, Eye, Users, Check, X, Info } from 'lucide-react';
import { projectsApi } from '../../api/projects';
import { useAuthStore } from '../../store/auth.store';
import { cn } from '../../lib/utils';

const ROLES = [
  { key: 'OWNER', label: '소유자', icon: Crown, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { key: 'ADMIN', label: '관리자', icon: ShieldCheck, color: 'text-gray-600', bg: 'bg-primary-50', border: 'border-gray-200' },
  { key: 'MEMBER', label: '멤버', icon: Users, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
  { key: 'VIEWER', label: '뷰어', icon: Eye, color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200' },
] as const;

type RoleKey = typeof ROLES[number]['key'];

const PERMISSIONS: {
  section: string;
  items: { label: string; desc?: string; allowed: RoleKey[] }[];
}[] = [
  {
    section: '프로젝트 관리',
    items: [
      { label: '프로젝트 정보 수정', desc: '이름, 설명, 색상, 기간 변경', allowed: ['OWNER', 'ADMIN'] },
      { label: '프로젝트 삭제', desc: '프로젝트 완전 삭제', allowed: ['OWNER'] },
      { label: '팀 멤버 추가/제거', desc: '멤버 초대 및 역할 변경', allowed: ['OWNER', 'ADMIN'] },
      { label: '공지사항 등록/수정/삭제', desc: '프로젝트 공지 관리', allowed: ['OWNER', 'ADMIN'] },
    ],
  },
  {
    section: '태스크',
    items: [
      { label: '태스크 생성', desc: '새 태스크 등록', allowed: ['OWNER', 'ADMIN', 'MEMBER'] },
      { label: '태스크 보기', desc: '칸반보드, 태스크 목록 조회', allowed: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] },
      { label: '태스크 수정', desc: '본인이 작성한 태스크 또는 관리자', allowed: ['OWNER', 'ADMIN', 'MEMBER'] },
      { label: '태스크 삭제', desc: '본인이 작성한 태스크 또는 관리자', allowed: ['OWNER', 'ADMIN', 'MEMBER'] },
      { label: '댓글 작성', desc: '태스크에 댓글 남기기', allowed: ['OWNER', 'ADMIN', 'MEMBER'] },
    ],
  },
  {
    section: '회의록',
    items: [
      { label: '회의록 생성', desc: '새 회의록 등록', allowed: ['OWNER', 'ADMIN', 'MEMBER'] },
      { label: '회의록 보기', desc: '회의록 목록 및 내용 조회', allowed: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] },
      { label: '회의록 수정/삭제', desc: '본인이 작성한 회의록 또는 관리자', allowed: ['OWNER', 'ADMIN', 'MEMBER'] },
    ],
  },
  {
    section: '일감 관리',
    items: [
      { label: '일감 등록', desc: '일감 등록', allowed: ['OWNER', 'ADMIN', 'MEMBER'] },
      { label: '일감 조회', desc: '일감 현황 조회', allowed: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] },
      { label: '일감 수정/삭제', desc: '본인 일감 또는 관리자', allowed: ['OWNER', 'ADMIN', 'MEMBER'] },
    ],
  },
  {
    section: '이슈',
    items: [
      { label: '이슈 생성', desc: '새 이슈 등록', allowed: ['OWNER', 'ADMIN', 'MEMBER'] },
      { label: '이슈 보기', desc: '이슈 목록 및 내용 조회', allowed: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] },
    ],
  },
];

const NOTE_MAP: Record<string, string> = {
  '태스크 수정': '* 멤버는 본인이 작성한 태스크만 수정 가능',
  '태스크 삭제': '* 멤버는 본인이 작성한 태스크만 삭제 가능',
  '회의록 수정/삭제': '* 멤버는 본인이 작성한 회의록만 수정/삭제 가능',
  '일감 수정/삭제': '* 멤버는 본인에게 할당된 일감만 수정/삭제 가능',
};

export function PermissionsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const user = useAuthStore((s) => s.user);
  const isGlobalAdmin = user?.role === 'ADMIN';

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getOne(projectId!),
    enabled: !!projectId,
  });

  const myMember = project?.members.find((m: any) => m.user.id === user?.id);
  const myRole: RoleKey | undefined = isGlobalAdmin ? 'ADMIN' : (myMember?.role as RoleKey | undefined);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
        <ShieldCheck size={18} className="text-gray-600" />
        <h1 className="text-lg font-bold text-gray-700">권한 설정</h1>
        <span className="text-xs text-gray-400 ml-1">역할별 권한 정책</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 현재 내 역할 */}
          <div className="bg-primary-50 border border-gray-100 rounded-xl p-4 flex items-center gap-3">
            <Info size={16} className="text-gray-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-600">
                내 역할:
                {myRole ? (
                  <span className="ml-1">
                    {ROLES.find((r) => r.key === myRole)?.label ?? myRole}
                    {isGlobalAdmin && <span className="text-xs text-gray-600 ml-1">(시스템 관리자)</span>}
                  </span>
                ) : (
                  <span className="ml-1 text-gray-500">프로젝트 멤버 아님</span>
                )}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">시스템 관리자(ADMIN)는 모든 프로젝트에서 관리자 권한을 가집니다.</p>
            </div>
          </div>

          {/* 역할 설명 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ROLES.map(({ key, label, icon: Icon, color, bg, border }) => (
              <div
                key={key}
                className={cn(
                  'rounded-xl border p-4',
                  bg, border,
                  myRole === key ? 'ring-2 ring-offset-1 ring-primary-400' : '',
                )}
              >
                <div className={cn('flex items-center gap-2 mb-2', color)}>
                  <Icon size={15} />
                  <span className="text-sm font-semibold">{label}</span>
                  {myRole === key && (
                    <span className="ml-auto text-[10px] bg-primary-600 text-white px-1.5 py-0.5 rounded-full font-bold">나</span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  {key === 'OWNER' && '프로젝트 생성자. 모든 권한 보유 및 프로젝트 삭제 가능'}
                  {key === 'ADMIN' && '프로젝트 관리자. 정보 수정, 멤버 관리, 공지사항 관리 가능'}
                  {key === 'MEMBER' && '일반 멤버. 태스크, 회의록, 일감 등록 및 본인 항목 수정 가능'}
                  {key === 'VIEWER' && '읽기 전용. 모든 콘텐츠 조회만 가능, 수정 불가'}
                </p>
              </div>
            ))}
          </div>

          {/* 권한 매트릭스 */}
          {PERMISSIONS.map((section) => (
            <div key={section.section} className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">{section.section}</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-64">기능</th>
                    {ROLES.map(({ key, label, icon: Icon, color }) => (
                      <th key={key} className="text-center px-4 py-2.5 w-20">
                        <div className={cn('flex flex-col items-center gap-0.5', color)}>
                          <Icon size={13} />
                          <span className="text-[10px] font-semibold">{label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item) => (
                    <tr key={item.label} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-gray-800">{item.label}</p>
                        {item.desc && <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>}
                        {NOTE_MAP[item.label] && (
                          <p className="text-[10px] text-amber-600 mt-0.5">{NOTE_MAP[item.label]}</p>
                        )}
                      </td>
                      {ROLES.map(({ key }) => (
                        <td key={key} className="text-center px-4 py-3">
                          {item.allowed.includes(key) ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100">
                              <Check size={11} className="text-emerald-600 font-bold" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100">
                              <X size={11} className="text-gray-300" />
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* 멤버 목록 */}
          {project && (
            <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">현재 멤버 역할 현황</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {project.members.map((m: any) => {
                  const roleCfg = ROLES.find((r) => r.key === m.role);
                  const Icon = roleCfg?.icon ?? Users;
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-gray-800 flex-shrink-0">
                        {m.user.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.user.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{m.user.email}</p>
                      </div>
                      <div className={cn('flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border', roleCfg?.color, roleCfg?.bg, roleCfg?.border)}>
                        <Icon size={11} />
                        <span>{roleCfg?.label ?? m.role}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
