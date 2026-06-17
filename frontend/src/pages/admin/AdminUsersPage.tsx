import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Shield, ShieldOff, Search, Phone, Briefcase, Building } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '../../api/users';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../lib/utils';
import type { User } from '../../types';

type UserWithCount = User & { _count: { projectMembers: number; createdTasks: number } };

export function AdminUsersPage() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: usersApi.getAll,
  });

  const toggleRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      usersApi.adminUpdate(id, { role }),
    onSuccess: (updated) => {
      qc.setQueryData<UserWithCount[]>(['admin-users'], (old) =>
        old?.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)) ?? [],
      );
      toast.success(`${updated.name}님의 권한이 변경되었습니다.`);
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '변경에 실패했습니다.'),
  });

  const filtered = (users ?? []).filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.department ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const adminCount = users?.filter((u) => u.role === 'ADMIN').length ?? 0;
  const memberCount = users?.filter((u) => u.role === 'MEMBER').length ?? 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="사용자 관리" description="시스템 사용자 권한 및 정보를 관리합니다" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* 통계 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users size={18} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{users?.length ?? 0}</p>
                  <p className="text-xs text-gray-500">전체 사용자</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield size={18} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{adminCount}</p>
                  <p className="text-xs text-gray-500">관리자</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShieldOff size={18} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{memberCount}</p>
                  <p className="text-xs text-gray-500">일반 사용자</p>
                </div>
              </div>
            </div>
          </div>

          {/* 검색 */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 이메일, 부서로 검색..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>

          {/* 사용자 목록 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-4">사용자</div>
              <div className="col-span-3">소속 / 연락처</div>
              <div className="col-span-2">프로젝트</div>
              <div className="col-span-1">가입일</div>
              <div className="col-span-2 text-center">권한</div>
            </div>

            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Users size={36} />}
                title={search ? '검색 결과가 없습니다' : '사용자가 없습니다'}
                description={search ? '다른 검색어로 다시 시도해 보세요.' : undefined}
              />
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map((u) => (
                  <div key={u.id} className="grid grid-cols-12 gap-3 px-4 py-3.5 items-center hover:bg-gray-50/60 transition-colors">
                    {/* 사용자 */}
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <Avatar name={u.name} avatar={u.avatar} size="sm" className="flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                          {u.id === currentUser?.id && (
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">나</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                    </div>

                    {/* 소속 / 연락처 */}
                    <div className="col-span-3 min-w-0 space-y-0.5">
                      {(u.position || u.department) && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          {u.position && (
                            <span className="flex items-center gap-0.5">
                              <Briefcase size={11} className="text-gray-400" /> {u.position}
                            </span>
                          )}
                          {u.position && u.department && <span className="text-gray-300">·</span>}
                          {u.department && (
                            <span className="flex items-center gap-0.5">
                              <Building size={11} className="text-gray-400" /> {u.department}
                            </span>
                          )}
                        </div>
                      )}
                      {u.phone && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Phone size={11} /> {u.phone}
                        </div>
                      )}
                      {!u.position && !u.department && !u.phone && (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </div>

                    {/* 프로젝트 수 */}
                    <div className="col-span-2">
                      <span className="text-xs text-gray-600">{(u as any)._count?.projectMembers ?? 0}개</span>
                    </div>

                    {/* 가입일 */}
                    <div className="col-span-1">
                      <span className="text-xs text-gray-400">{formatDate(u.createdAt)}</span>
                    </div>

                    {/* 권한 토글 */}
                    <div className="col-span-2 flex justify-center">
                      {u.id === currentUser?.id ? (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          u.role === 'ADMIN'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {u.role === 'ADMIN' ? '관리자' : '일반'}
                        </span>
                      ) : (
                        <button
                          onClick={() =>
                            toggleRole.mutate({
                              id: u.id,
                              role: u.role === 'ADMIN' ? 'MEMBER' : 'ADMIN',
                            })
                          }
                          disabled={toggleRole.isPending}
                          title={u.role === 'ADMIN' ? '일반 사용자로 변경' : '관리자로 승급'}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors cursor-pointer disabled:opacity-50 ${
                            u.role === 'ADMIN'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {u.role === 'ADMIN' ? (
                            <><Shield size={11} /> 관리자</>
                          ) : (
                            <><ShieldOff size={11} /> 일반</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
