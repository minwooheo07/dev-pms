import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, Briefcase, Trash2, X, Pencil, CheckCircle2, Check, Filter, Download, BarChart2, ChevronLeft, ChevronRight, FlaskConical } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { worklogsApi, STAGE_CONFIG, STAGE_ORDER, type WorkLogStage } from '../../api/worklogs';
import { qaApi, QA_STATUS_CONFIG, QA_RESULT_CONFIG } from '../../api/qa';
import { getAccessToken } from '../../utils/token';
import { projectsApi } from '../../api/projects';
import { tasksApi } from '../../api/tasks';
import { usersApi } from '../../api/users';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { PageHeader } from '../../components/ui/PageHeader';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { formatDate, cn } from '../../lib/utils';

interface AddWorkLogForm {
  projectId: string;
  taskId: string;
  userId: string;
  hours: number;
  description: string;
  requester: string;
  requestDate: string;
  startDate: string;
  endDate: string;
  srNumber: string;
}

export function WorkloadPage() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isGlobalAdmin = currentUser?.role === 'ADMIN';
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!routeProjectId) return;
    const token = getAccessToken();
    const url = `/api/projects/${routeProjectId}/tasks/events${token ? `?token=${token}` : ''}`;
    const es = new EventSource(url);
    es.onmessage = () => {
      qc.invalidateQueries({ queryKey: ['worklogs'] });
      qc.invalidateQueries({ queryKey: ['worklogs-summary'] });
      qc.invalidateQueries({ queryKey: ['project-stats', routeProjectId] });
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [routeProjectId, qc]);

  // ── 조회 필터 ──────────────────────────────────────────
  const [filterProject, setFilterProject] = useState(routeProjectId ?? '');
  const [filterTask, setFilterTask] = useState('');
  const [filterUser, setFilterUser] = useState(searchParams.get('user') ?? '');
  const [filterStage, setFilterStage] = useState<WorkLogStage | ''>('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  // ── 등록 폼 ────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<AddWorkLogForm>({
    projectId: routeProjectId ?? '',
    taskId: '',
    userId: currentUser?.id ?? '',
    hours: 1,
    description: '',
    requester: '',
    requestDate: today,
    startDate: today,
    endDate: today,
    srNumber: '',
  });

  // ── 상세 보기 ───────────────────────────────────────────
  const [viewLog, setViewLog] = useState<any>(null);

  // ── 커스텀 확인 다이얼로그 ──────────────────────────────
  const [confirmState, setConfirmState] = useState<{
    title: string; message: React.ReactNode; confirmText: string; tone: 'primary' | 'danger'; infoOnly?: boolean; onConfirm: () => void;
  } | null>(null);

  // ── 수정 모달 ───────────────────────────────────────────
  const [editLog, setEditLog] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    hours: 1, description: '', startDate: '', endDate: '', userId: '', stage: '' as WorkLogStage | '', requester: '', requestDate: '', taskId: '',
  });

  // ── 담당자 카드 선택 필터 ─────────────────────────────
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const toggleUser = (uid: string) =>
    setSelectedUserId((prev) => (prev === uid ? null : uid));

  // ── 그래프 팝업 ─────────────────────────────────────
  const [graphOpen, setGraphOpen] = useState(false);
  const [graphTab, setGraphTab] = useState<'count' | 'hours'>('count');
  const [graphWinStart, setGraphWinStart] = useState(0);

  // ── Queries ─────────────────────────────────────────────
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.getAll });
  const { data: allUsers } = useQuery({ queryKey: ['users'], queryFn: usersApi.getAll });

  // 상세 팝업이 열린 일감의 QA 이력 (workLogId 기준, createdAt desc)
  const { data: qaHistory } = useQuery({
    queryKey: ['qa-by-worklog', viewLog?.id],
    queryFn: () => qaApi.getByWorkLog(viewLog.id),
    enabled: !!viewLog?.id && !!viewLog?.srNumber,
  });

  // 그리드 QA 상태 표시용 — 전체 QA 목록을 가져와 workLogId로 맵핑
  const { data: allQaTests } = useQuery({
    queryKey: ['qa-tests'],
    queryFn: () => qaApi.getAll(),
    staleTime: 30_000,
  });
  const qaByWorklog = useMemo(() => {
    const map = new Map<string, (typeof allQaTests extends (infer T)[] | undefined ? T : never)>();
    allQaTests?.forEach((qa: any) => {
      if (!qa.workLogId) return;
      const cur = map.get(qa.workLogId);
      if (!cur || qa.createdAt > (cur as any).createdAt) map.set(qa.workLogId, qa);
    });
    return map;
  }, [allQaTests]);
  const { data: formTasks } = useQuery({
    queryKey: ['tasks', form.projectId],
    queryFn: () => tasksApi.getAll(form.projectId),
    enabled: !!form.projectId,
  });

  const editProjectId = editLog?.task?.project?.id ?? editLog?.projectId ?? routeProjectId;
  const { data: editTasks } = useQuery({
    queryKey: ['tasks', editProjectId],
    queryFn: () => tasksApi.getAll(editProjectId!),
    enabled: !!editProjectId && !!editLog,
  });

  // 조회 필터용 태스크 목록 (선택된 프로젝트 기준)
  const filterProjectId = filterProject || routeProjectId || '';
  const { data: filterTasks } = useQuery({
    queryKey: ['tasks', filterProjectId],
    queryFn: () => tasksApi.getAll(filterProjectId),
    enabled: !!filterProjectId,
  });

  const queryParams = {
    ...(filterProject && { projectId: filterProject }),
    ...(filterTask && { taskId: filterTask }),
    ...(filterUser && { userId: filterUser }),
    ...(filterStage && { stage: filterStage }),
    ...(filterStart && { startDate: filterStart }),
    ...(filterEnd && { endDate: filterEnd }),
  };
  const queryKey = ['worklogs', filterProject, filterTask, filterUser, filterStage, filterStart, filterEnd];

  const { data: worklogs, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => worklogsApi.getAll(queryParams),
  });

  const { data: summary } = useQuery({
    queryKey: ['worklogs-summary'],
    queryFn: worklogsApi.getSummary,
  });

  // ── Mutations ────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['worklogs'] });
    qc.invalidateQueries({ queryKey: ['worklogs-summary'] });
  };

  const createWorklog = useMutation({
    mutationFn: () => worklogsApi.create({
      taskId: form.taskId, userId: form.userId, hours: form.hours,
      description: form.description, requester: form.requester || undefined,
      requestDate: form.requestDate || undefined,
      startDate: form.startDate, endDate: form.endDate,
    }),
    onSuccess: () => {
      invalidate();
      setShowAddModal(false);
      setForm({ projectId: routeProjectId ?? '', taskId: '', userId: currentUser?.id ?? '', hours: 1, description: '', requester: '', requestDate: today, startDate: today, endDate: today, srNumber: '' });
      toast.success('일감이 등록되었습니다.');
    },
    onError: () => toast.error('등록에 실패했습니다.'),
  });

  const updateWorklog = useMutation({
    mutationFn: (data: { id: string; patch: any }) => worklogsApi.update(data.id, data.patch),
    onSuccess: () => { invalidate(); setEditLog(null); toast.success('일감이 수정되었습니다.'); },
    onError: () => toast.error('수정에 실패했습니다.'),
  });


  const deleteWorklog = useMutation({
    mutationFn: (id: string) => worklogsApi.delete(id),
    onSuccess: () => { invalidate(); toast.success('일감이 삭제되었습니다.'); },
  });

  const acknowledgeWorklog = useMutation({
    mutationFn: (id: string) => worklogsApi.acknowledge(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['worklogs'] }); toast.success('일감을 확인했습니다.'); },
    onError: () => toast.error('확인 처리에 실패했습니다.'),
  });

  // QA요청 등록 실행
  const submitQaRequest = (log: any) => {
    qaApi.create({
      srNumber: log.srNumber,
      title: log.taskTitle ?? log.description ?? log.srNumber,
      workLogId: log.id,
    }).then(() => {
      qc.invalidateQueries({ queryKey: ['qa-by-worklog', log.id] });
      qc.invalidateQueries({ queryKey: ['qa-tests'] });
      toast.success('QA요청이 등록되었습니다.');
    }).catch(() => toast.error('QA요청 등록에 실패했습니다.'));
  };

  // QA요청 버튼 클릭 → 기존 QA 상태에 따라 분기
  const handleQaRequest = (log: any) => {
    const latest = qaHistory?.[0]; // createdAt desc → 가장 최근 QA

    // 진행 중(요청/접수) → 블로킹
    if (latest && (latest.status === 'PENDING' || latest.status === 'IN_PROGRESS')) {
      setConfirmState({
        title: 'QA요청 불가', tone: 'danger', confirmText: '확인', infoOnly: true,
        message: <>이미 <b className="font-mono text-primary-600">{latest.qaNumber ?? '요청'}</b> 으로 QA가 진행 중입니다.<br/>완료 후 다시 시도하세요.</>,
        onConfirm: () => {},
      });
      return;
    }
    // 완료(확인) → 블로킹
    if (latest && latest.status === 'COMPLETED' && latest.result === 'PASS') {
      setConfirmState({
        title: 'QA요청 불가', tone: 'danger', confirmText: '확인', infoOnly: true,
        message: <>이미 QA가 <b className="text-emerald-600">확인 완료</b>된 일감입니다.</>,
        onConfirm: () => {},
      });
      return;
    }
    // 반려됨 → 재요청 가능 + 히스토리 표시
    if (latest && latest.status === 'COMPLETED' && latest.result === 'REJECTED') {
      setConfirmState({
        title: 'QA 재요청', tone: 'primary', confirmText: 'QA 재요청',
        message: (
          <div className="space-y-3">
            <p>이전 QA가 <b className="text-red-600">반려</b>되었습니다. 다시 QA요청을 하시겠습니까?</p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-1.5 max-h-40 overflow-auto">
              <p className="text-[11px] font-semibold text-gray-400 uppercase">이전 QA 이력</p>
              {qaHistory!.map((q) => (
                <div key={q.id} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-gray-600">{q.qaNumber ?? '미발급'}</span>
                  <span className={cn('font-medium', QA_STATUS_CONFIG[q.status].color)}>
                    {QA_STATUS_CONFIG[q.status].label}
                    {q.result ? ` · ${QA_RESULT_CONFIG[q.result].label}` : ''}
                  </span>
                  <span className="text-gray-400">{formatDate(q.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        ),
        onConfirm: () => submitQaRequest(log),
      });
      return;
    }
    // 취소됨 또는 이력 없음 → 일반 요청 (히스토리 불필요)
    setConfirmState({
      title: 'QA요청', tone: 'primary', confirmText: 'QA요청',
      message: <>SR번호 <b className="font-mono text-primary-600">[{log.srNumber}]</b> 로 QA요청을 하시겠습니까?</>,
      onConfirm: () => submitQaRequest(log),
    });
  };

  // ── 미확인 + 테이블 필터 ──────────────────────────────
  const pendingAck = (worklogs ?? []).filter(
    (log: any) => log.user.id === currentUser?.id && !log.isAcknowledged,
  );

  const filteredLogs = selectedUserId
    ? (worklogs ?? []).filter((log: any) => log.user.id === selectedUserId)
    : (worklogs ?? []);

  // ── 페이지네이션 (프론트, 50개씩) ──
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  // 필터/담당자 변경 시 1페이지로, 범위 벗어나면 보정
  useEffect(() => { setPage(1); }, [filterProject, filterTask, filterUser, filterStage, filterStart, filterEnd, selectedUserId]);
  // 프로젝트 변경 시 이전 프로젝트의 태스크 선택값 초기화
  useEffect(() => { setFilterTask(''); }, [filterProject]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pagedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const displayDate = (log: any) => {
    if (log.startDate && log.endDate) {
      const s = formatDate(log.startDate);
      const e = formatDate(log.endDate);
      return s === e ? s : `${s} ~ ${e}`;
    }
    return formatDate(log.workDate);
  };

  const activeFilters = [filterTask, filterUser, filterStage, filterStart, filterEnd].filter(Boolean).length;

  const downloadExcel = () => {
    const rows = filteredLogs.map((log: any) => ({
      '날짜': displayDate(log),
      '담당자': log.user.name,
      '태스크': log.task?.title ?? log.taskTitle ?? '-',
      '프로젝트': log.task?.project?.name ?? log.projectName ?? '-',
      '요청일자': log.requestDate ? formatDate(log.requestDate) : '-',
      '요청자': log.requester || '-',
      '업무 내용': log.description || '-',
      '공수(h)': log.hours,
      '단계': STAGE_CONFIG[log.stage as WorkLogStage]?.label ?? log.stage,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '워크로드');
    const filename = `워크로드_${filterStart || '전체'}_${filterEnd || '전체'}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // ── 그래프 데이터 계산 ──────────────────────────────
  const graphData = useMemo(() => {
    const logs: any[] = worklogs ?? [];
    // 날짜 목록 수집 (startDate 기준)
    const dateSet = new Set<string>();
    logs.forEach((log) => {
      const d = (log.startDate ?? log.workDate ?? '').slice(0, 10);
      if (d) dateSet.add(d);
    });
    const dates = [...dateSet].sort();

    // 담당자 목록
    const userMap: Record<string, { name: string; color: string }> = {};
    const PALETTE = ['#f85032','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16'];
    let ci = 0;
    logs.forEach((log) => {
      if (!userMap[log.user.id]) {
        userMap[log.user.id] = { name: log.user.name, color: PALETTE[ci++ % PALETTE.length] };
      }
    });
    const users = Object.entries(userMap).map(([id, v]) => ({ id, ...v }));

    // 날짜×담당자 집계
    const countMap: Record<string, Record<string, number>> = {};
    const hoursMap: Record<string, Record<string, number>> = {};
    dates.forEach((d) => { countMap[d] = {}; hoursMap[d] = {}; });
    logs.forEach((log) => {
      const d = (log.startDate ?? log.workDate ?? '').slice(0, 10);
      if (!d) return;
      const uid = log.user.id;
      countMap[d][uid] = (countMap[d][uid] ?? 0) + 1;
      hoursMap[d][uid] = (hoursMap[d][uid] ?? 0) + (log.hours ?? 0);
    });

    return { dates, users, countMap, hoursMap };
  }, [worklogs]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <PageHeader
        title="워크로드"
        description="담당자별 일감 등록 및 공수 현황"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => { setGraphWinStart(Math.max(0, graphData.dates.length - 14)); setGraphOpen(true); }}>
              <BarChart2 size={15} /> 그래프 보기
            </Button>
            <Button variant="primary" onClick={() => { setForm({ projectId: routeProjectId ?? '', taskId: '', userId: currentUser?.id ?? '', hours: 1, description: '', requester: '', requestDate: today, startDate: today, endDate: today, srNumber: '' }); setShowAddModal(true); }}>
              <Plus size={15} /> 일감 등록
            </Button>
          </div>
        }
      />

      {/* ── 조회 필터 바 ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
            <Filter size={12} /> 조회 조건
          </div>

          {/* 기간 */}
          <div className="flex items-center gap-1.5">
            <input
              type="date" value={filterStart}
              onChange={(e) => setFilterStart(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
            <span className="text-gray-300 text-xs">~</span>
            <input
              type="date" value={filterEnd} min={filterStart}
              onChange={(e) => setFilterEnd(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>

          {/* 담당자 */}
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">전체 담당자</option>
            {allUsers?.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          {/* 상태 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterStage('')}
              className={cn(
                'text-xs px-2.5 py-1.5 rounded-lg border transition-colors',
                filterStage === ''
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
              )}
            >
              전체
            </button>
            {STAGE_ORDER.map((s) => {
              const cfg = STAGE_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => setFilterStage(filterStage === s ? '' : s)}
                  className={cn(
                    'text-xs px-2.5 py-1.5 rounded-lg border transition-colors',
                    filterStage === s
                      ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                  )}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* 프로젝트 (독립 페이지만) */}
          {!routeProjectId && (
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">전체 프로젝트</option>
              {projects?.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          {/* 태스크 (프로젝트가 선택된 경우에만) */}
          <select
            value={filterTask}
            onChange={(e) => setFilterTask(e.target.value)}
            disabled={!filterProjectId}
            title={!filterProjectId ? '먼저 프로젝트를 선택하세요' : undefined}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white disabled:bg-gray-50 disabled:text-gray-300 max-w-[180px]"
          >
            <option value="">전체 태스크</option>
            {filterTasks?.map((t: any) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>

          {/* 초기화 */}
          {activeFilters > 0 && (
            <button
              onClick={() => { setFilterTask(''); setFilterUser(''); setFilterStage(''); setFilterStart(''); setFilterEnd(''); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline ml-1"
            >
              초기화
            </button>
          )}

          <button
            onClick={downloadExcel}
            disabled={!filteredLogs.length}
            className="ml-auto flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-primary-600 bg-white hover:bg-primary-50 border border-gray-200 hover:border-primary-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={13} />
            엑셀 다운로드
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 미확인 일감 인박스 */}
        {pendingAck.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                </span>
                <span className="text-sm font-semibold text-gray-600">확인 대기 중인 일감</span>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-[11px] font-bold">
                  {pendingAck.length}
                </span>
              </div>
              <span className="text-xs text-gray-400">담당자로 지정된 일감을 확인해 주세요</span>
            </div>
            <div className="divide-y divide-gray-50">
              {pendingAck.map((log: any) => (
                <div key={log.id} className="group flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/70 transition-colors">
                  <button
                    onClick={() => acknowledgeWorklog.mutate(log.id)}
                    disabled={acknowledgeWorklog.isPending}
                    className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-emerald-400 hover:bg-emerald-50 transition-all flex items-center justify-center"
                  >
                    <Check size={11} className="text-gray-300 group-hover:text-emerald-500 transition-colors" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {log.task?.title ?? log.taskTitle ?? '(삭제된 태스크)'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {log.task?.project?.name && <span className="text-[11px] text-gray-400">{log.task.project.name}</span>}
                      {log.task?.project?.name && <span className="text-gray-200">·</span>}
                      <span className="text-[11px] text-gray-400">{displayDate(log)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={11} /><span>{log.hours}h</span>
                  </div>
                  <button
                    onClick={() => acknowledgeWorklog.mutate(log.id)}
                    disabled={acknowledgeWorklog.isPending}
                    className="flex-shrink-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full transition-all"
                  >
                    <CheckCircle2 size={12} /> 확인했어요
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 담당자별 공수 요약 카드 */}
        {summary && summary.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">담당자별 공수 요약</h2>
              <button
                onClick={() => toggleUser(currentUser?.id ?? '')}
                className={cn(
                  'text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors',
                  selectedUserId === currentUser?.id
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-primary-400 hover:text-red-600',
                )}
              >
                내 일감만
              </button>
              {selectedUserId && (
                <button
                  onClick={() => setSelectedUserId(null)}
                  className="text-[11px] text-gray-600 hover:text-red-600 font-medium bg-primary-50 hover:bg-primary-100 px-2 py-0.5 rounded-full transition-colors"
                >
                  전체 보기 ✕
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.map((s: any) => {
                const uid = s.user?.id ?? 'unknown';
                const isSelected = selectedUserId === uid;
                const isDimmed = selectedUserId !== null && !isSelected;
                return (
                  <button
                    key={uid}
                    onClick={() => s.user?.id && toggleUser(s.user.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-150',
                      isSelected
                        ? 'bg-primary-50 border-gray-300 ring-2 ring-primary-200 shadow-sm'
                        : isDimmed
                          ? 'bg-white border-gray-200 opacity-40 hover:opacity-70'
                          : 'bg-white border-gray-200 hover:border-gray-200 hover:shadow-sm',
                    )}
                  >
                    <Avatar name={s.user?.name ?? '?'} avatar={s.user?.avatar} size="xs" />
                    <span className={cn('text-xs font-bold truncate flex-1 text-left', isSelected ? 'text-gray-800' : 'text-gray-800')}>
                      {s.user?.name ?? '—'}
                    </span>
                    <span className={cn(
                      'flex-shrink-0 text-xs font-extrabold',
                      isSelected ? 'text-gray-600' : 'text-gray-600',
                    )}>
                      {s.count}건
                    </span>
                    <span className={cn('flex-shrink-0 text-[11px] font-semibold', isSelected ? 'text-gray-500' : 'text-gray-400')}>
                      {s.totalHours}h
                    </span>
                    {isSelected && (
                      <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-primary-500 flex items-center justify-center">
                        <Check size={8} className="text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}


        <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">기간</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">태스크</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">SR번호</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">상태</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">작업 내용</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">담당자</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">요청자</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">사용자확인일</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">QA</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-14">확인</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {[...Array(11)].map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr><td colSpan={12}><ErrorState onRetry={refetch} /></td></tr>
              ) : !filteredLogs.length ? (
                <tr>
                  <td colSpan={12}>
                    <EmptyState
                      icon={<Briefcase size={36} />}
                      title={selectedUserId ? '해당 담당자의 일감이 없습니다' : '등록된 일감이 없습니다'}
                      description={selectedUserId ? undefined : '작업한 일감을 등록해 공수를 기록하세요.'}
                      action={!selectedUserId ? (
                        <Button variant="primary" onClick={() => { setForm({ projectId: routeProjectId ?? '', taskId: '', userId: currentUser?.id ?? '', hours: 1, description: '', requester: '', requestDate: today, startDate: today, endDate: today, srNumber: '' }); setShowAddModal(true); }}>
                          <Plus size={15} /> 일감 등록
                        </Button>
                      ) : undefined}
                    />
                  </td>
                </tr>
              ) : (
                pagedLogs.map((log: any) => {
                  const stageCfg = STAGE_CONFIG[log.stage as WorkLogStage] ?? STAGE_CONFIG.RECEIVED;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setViewLog(log)}
                      className="border-b border-gray-100 last:border-0 hover:bg-primary-50/40 cursor-pointer group transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{displayDate(log)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium truncate max-w-[120px] block ${log.task ? 'text-gray-600' : 'text-gray-400 line-through'}`}>
                          {log.task?.title ?? log.taskTitle ?? '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-primary-600 truncate max-w-[100px]">
                        {log.srNumber || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', stageCfg.bg, stageCfg.color, stageCfg.border)}>
                          {stageCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate">{log.description || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Avatar name={log.user.name} avatar={log.user.avatar} size="xs" />
                          <span className="text-xs text-gray-600 truncate">{log.user.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[80px]">
                        {log.requester || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-[11px] text-gray-400">
                        {log.userConfirmedAt ? formatDate(log.userConfirmedAt) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const qa: any = qaByWorklog.get(log.id);
                          if (!qa) return <span className="text-[10px] text-gray-300">-</span>;
                          const isCompleted = qa.status === 'COMPLETED';
                          const label = isCompleted && qa.result
                            ? (qa.result === 'PASS' ? '확인' : '반려')
                            : QA_STATUS_CONFIG[qa.status as keyof typeof QA_STATUS_CONFIG]?.label ?? qa.status;
                          const cls = isCompleted
                            ? qa.result === 'PASS'
                              ? 'text-emerald-700 bg-emerald-50'
                              : 'text-red-700 bg-red-50'
                            : qa.status === 'PENDING'
                              ? 'text-amber-700 bg-amber-50'
                              : qa.status === 'IN_PROGRESS'
                                ? 'text-blue-700 bg-blue-50'
                                : 'text-gray-500 bg-gray-100';
                          return (
                            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', cls)}>
                              {label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {log.isAcknowledged ? (
                          <span title={log.acknowledgedAt ? `${formatDate(log.acknowledgedAt)} 확인` : '확인됨'}>
                            <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
                          </span>
                        ) : log.user.id === currentUser?.id ? (
                          <button
                            onClick={() => acknowledgeWorklog.mutate(log.id)}
                            className="text-xs text-amber-600 hover:text-amber-800 font-medium px-1.5 py-0.5 rounded hover:bg-amber-50 transition-colors mx-auto block"
                          >
                            확인
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">미확인</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] text-gray-300 group-hover:text-red-600 transition-colors font-medium">상세 →</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── 페이지네이션 ── */}
        {!isLoading && !isError && filteredLogs.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredLogs.length)} / 총 {filteredLogs.length}건
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                이전
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .map((p, idx, arr) => (
                  <span key={p} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-300">…</span>}
                    <button
                      onClick={() => setPage(p)}
                      className={cn(
                        'min-w-[28px] px-2 py-1 text-xs font-semibold rounded-lg border transition-colors',
                        p === page ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                      )}
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 상세 보기 모달 ── */}
      {viewLog && (() => {
        const stageCfg = STAGE_CONFIG[viewLog.stage as WorkLogStage] ?? STAGE_CONFIG.RECEIVED;
        const canEdit = isGlobalAdmin || viewLog.user.id === currentUser?.id;
        const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
          <div className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
            <span className="w-24 flex-shrink-0 text-[11px] font-semibold text-gray-400 uppercase tracking-wider pt-0.5">{label}</span>
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        );
        // 2열 배치용 셀 (라벨 위 / 값 아래)
        const Cell = ({ label, children }: { label: string; children: React.ReactNode }) => (
          <div className="min-w-0">
            <span className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</span>
            <div className="min-w-0">{children}</div>
          </div>
        );
        const PairRow = ({ children }: { children: React.ReactNode }) => (
          <div className="grid grid-cols-2 gap-x-4 py-3 border-b border-gray-100">{children}</div>
        );
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setViewLog(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

              {/* 헤더 */}
              <div className="px-6 py-5 bg-gray-50 border-b border-gray-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      {viewLog.task?.project?.name ?? viewLog.projectName ?? '프로젝트 없음'}
                    </p>
                    <h2 className="text-base font-bold text-gray-700 leading-snug">
                      {viewLog.task?.title ?? viewLog.taskTitle ?? '(삭제된 태스크)'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {canEdit && (
                      <>
                        <button
                          onClick={() => {
                            setViewLog(null);
                            setEditLog(viewLog);
                            setEditForm({
                              hours: viewLog.hours,
                              description: viewLog.description ?? '',
                              startDate: viewLog.startDate ? viewLog.startDate.slice(0, 10) : viewLog.workDate?.slice(0, 10) ?? '',
                              endDate: viewLog.endDate ? viewLog.endDate.slice(0, 10) : viewLog.workDate?.slice(0, 10) ?? '',
                              userId: viewLog.user.id,
                              stage: viewLog.stage ?? '',
                              requester: viewLog.requester ?? '',
                              requestDate: viewLog.requestDate ? viewLog.requestDate.slice(0, 10) : '',
                              taskId: viewLog.task?.id ?? '',
                            });
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="수정"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmState({
                            title: '일감 삭제',
                            message: '이 일감을 삭제하시겠습니까? 되돌릴 수 없습니다.',
                            confirmText: '삭제',
                            tone: 'danger',
                            onConfirm: () => { deleteWorklog.mutate(viewLog.id); setViewLog(null); },
                          })}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    <button onClick={() => setViewLog(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg ml-0.5 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* QA요청 액션 바 */}
              {viewLog.srNumber && (() => {
                const latestQa = qaHistory?.[0];
                const isBlocked = latestQa && (
                  latestQa.status === 'PENDING' ||
                  latestQa.status === 'IN_PROGRESS' ||
                  (latestQa.status === 'COMPLETED' && latestQa.result === 'PASS')
                );
                const qaStatusLabel = latestQa
                  ? latestQa.status === 'COMPLETED' && latestQa.result
                    ? (latestQa.result === 'PASS' ? '확인 완료' : '반려됨')
                    : QA_STATUS_CONFIG[latestQa.status]?.label
                  : null;
                const qaStatusCls = latestQa
                  ? latestQa.status === 'COMPLETED'
                    ? latestQa.result === 'PASS'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-red-700 bg-red-50 border-red-200'
                    : latestQa.status === 'PENDING'
                      ? 'text-amber-700 bg-amber-50 border-amber-200'
                      : latestQa.status === 'IN_PROGRESS'
                        ? 'text-blue-700 bg-blue-50 border-blue-200'
                        : 'text-gray-500 bg-gray-100 border-gray-200'
                  : '';
                const fmtDt = (iso?: string) => iso
                  ? new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                  : '—';
                return (
                  <div className="flex items-center justify-between px-6 pt-3">
                    {/* QA 현재 상태 + 날짜 */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        {latestQa ? (
                          <>
                            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', qaStatusCls)}>
                              {qaStatusLabel}
                            </span>
                            {latestQa.qaNumber && (
                              <span className="text-[11px] font-mono text-gray-400">{latestQa.qaNumber}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-gray-400">QA 없음</span>
                        )}
                      </div>
                      {latestQa && (
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-gray-400">접수일시: <span className="font-mono">{fmtDt(latestQa.acceptedAt)}</span></p>
                          <p className="text-[10px] text-gray-400">완료일시: <span className="font-mono">{fmtDt(latestQa.completedAt)}</span></p>
                        </div>
                      )}
                    </div>
                    {/* QA 요청 버튼 */}
                    <button
                      onClick={() => !isBlocked && handleQaRequest(viewLog)}
                      disabled={!!isBlocked}
                      title={isBlocked ? 'QA가 진행 중이거나 완료된 일감입니다' : 'QA 테스트를 요청합니다'}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg shadow-sm transition-all',
                        isBlocked
                          ? 'text-gray-400 bg-gray-100 cursor-not-allowed shadow-none'
                          : 'text-white bg-violet-600 hover:bg-violet-700 hover:shadow active:scale-95',
                      )}
                    >
                      <FlaskConical size={14} />
                      QA요청
                    </button>
                  </div>
                );
              })()}

              {/* 상세 항목 */}
              <div className="px-6 py-2">
                {/* SR번호 */}
                <Row label="SR번호">
                  <span className="text-sm font-mono text-primary-600">{viewLog.srNumber ?? '—'}</span>
                </Row>

                {/* 요청일자 · 요청자 */}
                <PairRow>
                  <Cell label="요청일자">
                    <span className="text-sm text-gray-600">{viewLog.requestDate ? formatDate(viewLog.requestDate) : '—'}</span>
                  </Cell>
                  <Cell label="요청자">
                    <span className="text-sm text-gray-600">{viewLog.requester || '—'}</span>
                  </Cell>
                </PairRow>

                {/* 기간 · 공수 */}
                <PairRow>
                  <Cell label="기간">
                    <span className="text-sm text-gray-800">{displayDate(viewLog)}</span>
                  </Cell>
                  <Cell label="공수">
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} className="text-gray-500" />
                      <span className="text-sm font-bold text-gray-600">{viewLog.hours}h</span>
                      <span className="text-xs text-gray-400">({viewLog.hours * 60}분)</span>
                    </div>
                  </Cell>
                </PairRow>

                {/* 담당자 · 확인여부 */}
                <PairRow>
                  <Cell label="담당자">
                    <div className="flex items-center gap-2">
                      <Avatar name={viewLog.user.name} avatar={viewLog.user.avatar} size="xs" />
                      <span className="text-sm font-medium text-gray-800">{viewLog.user.name}</span>
                    </div>
                  </Cell>
                  <Cell label="확인 여부">
                    {viewLog.isAcknowledged ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        <span className="text-sm font-medium text-emerald-600">
                          확인됨{viewLog.acknowledgedAt ? ` · ${formatDate(viewLog.acknowledgedAt)}` : ''}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">미확인</span>
                        {viewLog.user.id === currentUser?.id && (
                          <button
                            onClick={() => { acknowledgeWorklog.mutate(viewLog.id); setViewLog(null); }}
                            className="text-[11px] font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-full transition-colors"
                          >
                            확인하기
                          </button>
                        )}
                      </div>
                    )}
                  </Cell>
                </PairRow>

                {/* 진행 상태 */}
                <Row label="진행 상태">
                  <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', stageCfg.bg, stageCfg.color, stageCfg.border)}>
                    {stageCfg.label}
                  </span>
                </Row>

                {/* 작업 내용 */}
                <Row label="작업 내용">
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {viewLog.description || '—'}
                  </p>
                </Row>

                {/* 사용자확인일 */}
                <Row label="사용자확인일">
                  <span className={cn('text-sm', viewLog.userConfirmedAt ? 'text-gray-600 font-medium' : 'text-gray-400')}>
                    {viewLog.userConfirmedAt ? formatDate(viewLog.userConfirmedAt) : '—'}
                  </span>
                </Row>
              </div>

              {/* 닫기 버튼 */}
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                <Button variant="ghost" onClick={() => setViewLog(null)}>닫기</Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 등록 모달 ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-800">일감 등록</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {!routeProjectId && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">프로젝트 *</label>
                  <select
                    value={form.projectId}
                    onChange={(e) => setForm({ ...form, projectId: e.target.value, taskId: '' })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">프로젝트 선택</option>
                    {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">태스크 *</label>
                <select
                  value={form.taskId}
                  onChange={(e) => setForm({ ...form, taskId: e.target.value })}
                  disabled={!form.projectId}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                >
                  <option value="">{form.projectId ? '태스크 선택' : '먼저 프로젝트를 선택하세요'}</option>
                  {formTasks?.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">담당자</label>
                <select
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {allUsers?.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="w-40 flex-shrink-0">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">요청일자</label>
                  <input type="date" value={form.requestDate}
                    onChange={(e) => setForm({ ...form, requestDate: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">요청자</label>
                  <input type="text" value={form.requester}
                    onChange={(e) => setForm({ ...form, requester: e.target.value })}
                    placeholder="요청자를 입력하세요 (선택)"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">공수 (시간) *</label>
                <input type="number" min={0.5} step={0.5} value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: parseFloat(e.target.value) || 0 })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">시작일</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">종료일</label>
                  <input type="date" value={form.endDate} min={form.startDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">작업 내용</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="어떤 작업을 했는지 간략히 입력하세요..." rows={3}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>취소</Button>
              <Button
                variant="primary"
                onClick={() => createWorklog.mutate()}
                disabled={!form.taskId || form.hours <= 0}
                loading={createWorklog.isPending}
              >
                등록
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 수정 모달 ── */}
      {editLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditLog(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-800">일감 수정</h2>
              <button onClick={() => setEditLog(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* 태스크 선택 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">태스크</label>
                <select
                  value={editForm.taskId}
                  onChange={(e) => setEditForm({ ...editForm, taskId: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {!editForm.taskId && <option value="">태스크 선택</option>}
                  {editTasks?.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                  {/* 현재 연결된 태스크가 목록에 없는 경우(삭제된 태스크)를 대비 */}
                  {editForm.taskId && !editTasks?.find((t: any) => t.id === editForm.taskId) && (
                    <option value={editForm.taskId} disabled>
                      {editLog.task?.title ?? editLog.taskTitle ?? '(삭제된 태스크)'}
                    </option>
                  )}
                </select>
              </div>

              {/* 단계 플래그 버튼 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">진행 단계</label>
                <div className="flex gap-1.5 flex-wrap">
                  {STAGE_ORDER.map((s, idx) => {
                    const cfg = STAGE_CONFIG[s];
                    const currentStage = editForm.stage || editLog.stage;
                    const isSelected = currentStage === s;
                    const isPast = STAGE_ORDER.indexOf(currentStage) > idx;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, stage: s })}
                        className={cn(
                          'flex-1 min-w-0 py-2 px-2 rounded-xl border-2 text-xs font-semibold transition-all',
                          isSelected
                            ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-current shadow-sm scale-105`
                            : isPast
                              ? 'bg-gray-50 text-gray-400 border-gray-200'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                        )}
                      >
                        <span className="block text-center leading-tight">{cfg.label}</span>
                        {isSelected && <span className="block text-center text-[9px] mt-0.5 opacity-70">선택됨</span>}
                      </button>
                    );
                  })}
                </div>
                {editLog.userConfirmedAt && (
                  <p className="text-[11px] text-gray-600 mt-1.5">
                    사용자확인일: {formatDate(editLog.userConfirmedAt)}
                  </p>
                )}
              </div>

              {/* 담당자 + 공수 */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">담당자</label>
                  <select
                    value={editForm.userId}
                    onChange={(e) => setEditForm({ ...editForm, userId: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {allUsers?.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="w-36 flex-shrink-0">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">공수 (시간) *</label>
                  <input type="number" min={0.5} step={0.5} value={editForm.hours}
                    onChange={(e) => setEditForm({ ...editForm, hours: parseFloat(e.target.value) || 0 })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* 요청일자 + 요청자 */}
              <div className="flex gap-3">
                <div className="w-40 flex-shrink-0">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">요청일자</label>
                  <input
                    type="date"
                    value={editForm.requestDate}
                    onChange={(e) => setEditForm({ ...editForm, requestDate: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">요청자</label>
                  <input
                    type="text"
                    value={editForm.requester}
                    onChange={(e) => setEditForm({ ...editForm, requester: e.target.value })}
                    placeholder="요청자를 입력하세요 (선택)"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* 기간 */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">시작일</label>
                  <input type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">종료일</label>
                  <input type="date" value={editForm.endDate} min={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* 작업 내용 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">작업 내용</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>

            {/* 저장 */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setEditLog(null)}>닫기</Button>
              <Button
                variant="primary"
                onClick={() => {
                  updateWorklog.mutate({
                    id: editLog.id,
                    patch: {
                      ...(editForm.taskId && editForm.taskId !== (editLog.task?.id ?? '') && { taskId: editForm.taskId }),
                      hours: editForm.hours,
                      description: editForm.description,
                      startDate: editForm.startDate,
                      endDate: editForm.endDate,
                      userId: editForm.userId,
                      requester: editForm.requester || undefined,
                      requestDate: editForm.requestDate || undefined,
                      ...(editForm.stage && { stage: editForm.stage }),
                    },
                  });
                }}
                disabled={editForm.hours <= 0}
                loading={updateWorklog.isPending}
              >
                저장
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 그래프 팝업 ── */}
      {graphOpen && (() => {
        const { dates, users, countMap, hoursMap } = graphData;
        const map = graphTab === 'count' ? countMap : hoursMap;
        const label = graphTab === 'count' ? '일감 건수' : '공수 (h)';

        // 날짜 슬라이딩 윈도우 (최대 14일 표시)
        const WIN = 14;
        const winStart = graphWinStart;
        const setWinStart = setGraphWinStart;
        const visibleDates = dates.slice(winStart, winStart + WIN);
        const canPrev = winStart > 0;
        const canNext = winStart + WIN < dates.length;

        // 막대 그래프 계산
        const maxVal = Math.max(1, ...visibleDates.flatMap((d) => users.map((u) => map[d]?.[u.id] ?? 0)));
        const BAR_H = 180;
        const BAR_W = Math.max(24, Math.min(40, Math.floor((680 - 48) / Math.max(visibleDates.length, 1)) - 8));
        const GROUP_W = BAR_W * users.length + 4;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]" onClick={() => setGraphOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-[780px] max-w-[95vw] overflow-x-hidden" onClick={(e) => e.stopPropagation()}>
              {/* 헤더 */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f85032,#e73827)' }}>
                    <BarChart2 size={16} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-800">워크로드 그래프</h2>
                    <p className="text-xs text-gray-400">{filterStart || '전체'} {filterEnd ? `~ ${filterEnd}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* 탭 */}
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    {(['count', 'hours'] as const).map((t) => (
                      <button key={t} onClick={() => setGraphTab(t)}
                        className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition-colors', graphTab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                        {t === 'count' ? '일감 건수' : '공수 (h)'}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setGraphOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="px-6 py-5">
                {!dates.length ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <BarChart2 size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">조회된 데이터가 없습니다</p>
                  </div>
                ) : (() => {
                    const LANE_H = 52;        // 레인 높이
                    const NAME_W = 88;        // 담당자 이름 열 너비
                    const TOTAL_W = 56;       // 합계 열 너비
                    const CHART_W = 580;      // 꺾은선 영역 너비 (780 모달 - px-6*2 - NAME_W - TOTAL_W)
                    const PAD = 12;           // 상하 여백
                    const n = visibleDates.length;
                    const step = n > 1 ? (CHART_W - PAD * 2) / (n - 1) : CHART_W / 2;

                    const xOf = (i: number) => PAD + i * step;
                    const yOf = (val: number, maxV: number) =>
                      maxV === 0 ? LANE_H / 2 : PAD + (1 - val / maxV) * (LANE_H - PAD * 2);

                    return (
                      <>
                        {/* 날짜 헤더 + 담당자 레인: 같은 컨테이너에서 세로만 스크롤 */}
                        <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: 400 }}>
                          {/* 날짜 축 헤더 — sticky로 위에 고정 */}
                          <div className="flex border-b border-gray-100 sticky top-0 bg-white z-10" style={{ paddingLeft: NAME_W }}>
                            <svg width={CHART_W} height={22}>
                              {visibleDates.map((d, i) => (
                                <text key={d} x={xOf(i)} y={14} textAnchor="middle"
                                  fontSize={9} fill="#9ca3af">{d.slice(5)}</text>
                              ))}
                            </svg>
                            <div style={{ width: TOTAL_W }} className="text-[10px] text-right text-gray-400 pr-2 self-end pb-1">합계</div>
                          </div>

                        {/* 담당자 레인 */}
                          {users.map((u) => {
                            const vals = visibleDates.map((d) => map[d]?.[u.id] ?? 0);
                            const maxV = Math.max(1, ...vals);
                            const total = vals.reduce((s, v) => s + v, 0);
                            const points = vals.map((v, i) => `${xOf(i)},${yOf(v, maxV)}`).join(' ');
                            const areaPoints = [
                              `${xOf(0)},${LANE_H}`,
                              ...vals.map((v, i) => `${xOf(i)},${yOf(v, maxV)}`),
                              `${xOf(n - 1)},${LANE_H}`,
                            ].join(' ');

                            return (
                              <div key={u.id} className="flex items-center border-b border-gray-50 hover:bg-gray-50/60 transition-colors group">
                                {/* 담당자 이름 */}
                                <div className="flex items-center gap-2 flex-shrink-0 px-3" style={{ width: NAME_W }}>
                                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: u.color }} />
                                  <span className="text-xs font-medium text-gray-700 truncate">{u.name}</span>
                                </div>

                                {/* 꺾은선 SVG */}
                                <svg width={CHART_W} height={LANE_H} className="flex-shrink-0">
                                  {/* 가이드라인 */}
                                  <line x1={PAD} y1={LANE_H / 2} x2={CHART_W - PAD} y2={LANE_H / 2}
                                    stroke="#f3f4f6" strokeWidth={1} />
                                  {total === 0 ? (
                                    <line x1={PAD} y1={LANE_H / 2} x2={CHART_W - PAD} y2={LANE_H / 2}
                                      stroke="#e5e7eb" strokeWidth={1.5} strokeDasharray="4 3" />
                                  ) : (
                                    <>
                                      {/* 면적 */}
                                      <polygon points={areaPoints} fill={u.color} fillOpacity={0.08} />
                                      {/* 꺾은선 */}
                                      <polyline points={points} fill="none" stroke={u.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                                      {/* 점 + 툴팁 */}
                                      {vals.map((v, i) => v > 0 && (
                                        <g key={i} className="group/dot">
                                          <circle cx={xOf(i)} cy={yOf(v, maxV)} r={6} fill="transparent" />
                                          <circle cx={xOf(i)} cy={yOf(v, maxV)} r={3} fill={u.color} stroke="white" strokeWidth={1.5} />
                                          <g className="opacity-0 group-hover/dot:opacity-100" style={{ transition: 'opacity .15s' }}>
                                            <rect x={xOf(i) - 18} y={yOf(v, maxV) - 22} width={36} height={16} rx={4} fill="#1f2937" />
                                            <text x={xOf(i)} y={yOf(v, maxV) - 11} textAnchor="middle" fontSize={9} fill="white">
                                              {v}{graphTab === 'hours' ? 'h' : '건'}
                                            </text>
                                          </g>
                                        </g>
                                      ))}
                                    </>
                                  )}
                                </svg>

                                {/* 합계 */}
                                <div className="text-right pr-3 text-xs font-bold flex-shrink-0"
                                  style={{ width: TOTAL_W, color: total > 0 ? u.color : '#d1d5db' }}>
                                  {total > 0 ? `${total}${graphTab === 'hours' ? 'h' : '건'}` : '—'}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* 페이지 네비게이션 */}
                        {dates.length > WIN && (
                          <div className="flex items-center justify-center gap-3 mt-4">
                            <button onClick={() => setWinStart(Math.max(0, winStart - WIN))} disabled={!canPrev}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors">
                              <ChevronLeft size={16} />
                            </button>
                            <span className="text-xs text-gray-500">
                              {dates[winStart]?.slice(5)} ~ {dates[Math.min(winStart + WIN - 1, dates.length - 1)]?.slice(5)}
                              <span className="ml-2 text-gray-300">({dates.length}일)</span>
                            </span>
                            <button onClick={() => setWinStart(Math.min(dates.length - WIN, winStart + WIN))} disabled={!canNext}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors">
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 커스텀 확인 다이얼로그 ── */}
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title ?? ''}
        message={confirmState?.message}
        confirmText={confirmState?.confirmText}
        tone={confirmState?.tone}
        infoOnly={confirmState?.infoOnly}
        onConfirm={() => { confirmState?.onConfirm(); setConfirmState(null); }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
