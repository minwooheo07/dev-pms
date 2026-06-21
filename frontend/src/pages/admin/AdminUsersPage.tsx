import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Shield, ShieldOff, Search, Phone, Briefcase, Building, Clock, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '../../api/users';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate, cn } from '../../lib/utils';
import type { User } from '../../types';

type UserWithCount = User & { _count: { projectMembers: number; createdTasks: number } };
type Tab = 'active' | 'pending';

export function AdminUsersPage() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('active');

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: usersApi.getAll,
  });

  const { data: pendingUsers, isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-users'],
    queryFn: usersApi.getPending,
    refetchInterval: 30_000,
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

  const approve = useMutation({
    mutationFn: (id: string) => usersApi.approveUser(id),
    onSuccess: (user: any) => {
      qc.invalidateQueries({ queryKey: ['pending-users'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(`${user.name}님의 가입을 승인했습니다.`);
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '승인에 실패했습니다.'),
  });

  const reject = useMutation({
    mutationFn: (id: string) => usersApi.rejectUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-users'] });
      toast.success('가입 요청을 거절했습니다.');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '거절에 실패했습니다.'),
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
  const pendingCount = pendingUsers?.length ?? 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="사용자 관리" description="시스템 사용자 권한 및 정보를 관리합니다" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* 통계 */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08)] ring-1 ring-gray-900/5 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users size={18} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-600">{users?.length ?? 0}</p>
                  <p className="text-xs text-gray-500">전체 사용자</p>
                </div>
              </div>
            </div>
            <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08)] ring-1 ring-gray-900/5 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield size={18} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-600">{adminCount}</p>
                  <p className="text-xs text-gray-500">관리자</p>
                </div>
              </div>
            </div>
            <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08)] ring-1 ring-gray-900/5 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShieldOff size={18} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-600">{memberCount}</p>
                  <p className="text-xs text-gray-500">일반 사용자</p>
                </div>
              </div>
            </div>
            <div className="bg-white/85 backdrop-blur-md rounded-xl border border-amber-200/60 shadow-[0_4px_16px_rgba(0,0,0,0.08)] ring-1 ring-gray-900/5 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock size={18} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                  <p className="text-xs text-gray-500">승인 대기</p>
                </div>
              </div>
            </div>
          </div>

          {/* 탭 */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setTab('active')}
              className={cn('px-4 py-2 text-sm font-semibold rounded-lg transition-all', tab === 'active' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
            >
              활성 사용자
            </button>
            <button
              onClick={() => setTab('pending')}
              className={cn('flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all', tab === 'pending' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
            >
              승인 대기
              {pendingCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>

          {/* 활성 사용자 탭 */}
          {tab === 'active' && (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="이름, 이메일, 부서로 검색..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                />
              </div>

              <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08)] ring-1 ring-gray-900/5 overflow-hidden">
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
                        <div className="col-span-4 flex items-center gap-3 min-w-0">
                          <Avatar name={u.name} avatar={u.avatar} size="sm" className="flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-gray-600 truncate">{u.name}</p>
                              {u.id === currentUser?.id && (
                                <span className="text-[10px] font-bold text-gray-600 bg-primary-50 px-1 py-0.5 rounded">나</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                          </div>
                        </div>
                        <div className="col-span-3 min-w-0 space-y-0.5">
                          {(u.position || u.department) && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              {u.position && <span className="flex items-center gap-0.5"><Briefcase size={11} className="text-gray-400" /> {u.position}</span>}
                              {u.position && u.department && <span className="text-gray-300">·</span>}
                              {u.department && <span className="flex items-center gap-0.5"><Building size={11} className="text-gray-400" /> {u.department}</span>}
                            </div>
                          )}
                          {u.phone && <div className="flex items-center gap-1 text-xs text-gray-400"><Phone size={11} /> {u.phone}</div>}
                          {!u.position && !u.department && !u.phone && <span className="text-xs text-gray-300">-</span>}
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs text-gray-600">{(u as any)._count?.projectMembers ?? 0}개</span>
                        </div>
                        <div className="col-span-1">
                          <span className="text-xs text-gray-400">{formatDate(u.createdAt)}</span>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          {u.id === currentUser?.id ? (
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${u.role === 'ADMIN' ? 'bg-primary-100 text-gray-800' : 'bg-gray-100 text-gray-600'}`}>
                              {u.role === 'ADMIN' ? '관리자' : '일반'}
                            </span>
                          ) : (
                            <button
                              onClick={() => toggleRole.mutate({ id: u.id, role: u.role === 'ADMIN' ? 'MEMBER' : 'ADMIN' })}
                              disabled={toggleRole.isPending}
                              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors cursor-pointer disabled:opacity-50 ${u.role === 'ADMIN' ? 'bg-primary-50 text-gray-800 border-gray-200 hover:bg-primary-100' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                            >
                              {u.role === 'ADMIN' ? <><Shield size={11} /> 관리자</> : <><ShieldOff size={11} /> 일반</>}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* 승인 대기 탭 */}
          {tab === 'pending' && (
            <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08)] ring-1 ring-gray-900/5 overflow-hidden">
              {pendingLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
                </div>
              ) : !pendingUsers?.length ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
                    <Clock size={24} className="text-amber-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-500 mb-1">승인 대기 중인 요청이 없습니다</p>
                  <p className="text-xs text-gray-400">새 회원가입 요청이 생기면 여기에 표시됩니다</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {pendingUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-amber-50/30 transition-colors">
                      <Avatar name={u.name} avatar={u.avatar} size="md" className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-gray-800">{u.name}</p>
                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Clock size={9} /> 승인 대기
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{u.email}</p>
                        {(u.position || u.department) && (
                          <p className="text-xs text-gray-400 mt-0.5">{[u.position, u.department].filter(Boolean).join(' · ')}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 mr-2">
                        <p className="text-[11px] text-gray-400">{formatDate(u.createdAt)} 가입 신청</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => { if (confirm(`${u.name}님의 가입을 승인하시겠습니까?`)) approve.mutate(u.id); }}
                          disabled={approve.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Check size={12} /> 승인
                        </button>
                        <button
                          onClick={() => { if (confirm(`${u.name}님의 가입 요청을 거절하시겠습니까?\n계정이 삭제됩니다.`)) reject.mutate(u.id); }}
                          disabled={reject.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <X size={12} /> 거절
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
