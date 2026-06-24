import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, FlaskConical, RefreshCw, RotateCcw, Trash2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { qaApi, QA_STATUS_CONFIG, QA_RESULT_CONFIG, type QATest } from '../../api/qa';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { formatDate, cn } from '../../lib/utils';

interface ConfirmState {
  title: string;
  message: React.ReactNode;
  confirmText: string;
  tone: 'primary' | 'danger';
  onConfirm: () => void;
}

const SR_NUMBER_PATTERN = /^SR-\d{2}-\d{4}$/;

interface QAForm {
  srNumber: string;
  title: string;
  content: string;
  tester: string;
}

const defaultForm: QAForm = { srNumber: '', title: '', content: '', tester: '' };

export function QATestPage() {
  const qc = useQueryClient();
  const [filterSR, setFilterSR] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<QAForm>(defaultForm);

  // 상세 팝업
  const [viewItem, setViewItem] = useState<QATest | null>(null);
  const [detailForm, setDetailForm] = useState({ title: '', content: '', tester: '' });

  // 커스텀 확인 다이얼로그
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  useEffect(() => {
    if (viewItem) {
      setDetailForm({ title: viewItem.title, content: viewItem.content ?? '', tester: viewItem.tester ?? '' });
    }
  }, [viewItem]);

  const { data: tests, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['qa-tests', filterSR],
    queryFn: () => qaApi.getAll(filterSR || undefined),
  });

  // 같은 SR번호의 QA 요청 이력 (반려 후 재요청 시 누적) — createdAt desc
  const { data: srHistory } = useQuery({
    queryKey: ['qa-sr-history', viewItem?.srNumber],
    queryFn: () => qaApi.getAll(viewItem!.srNumber),
    enabled: !!viewItem?.srNumber,
  });
  const hasHistory = (srHistory?.length ?? 0) > 1;

  const invalidate = (workLogId?: string | null) => {
    qc.invalidateQueries({ queryKey: ['qa-tests'] });
    qc.invalidateQueries({ queryKey: ['qa-sr-history'] });
    if (workLogId) qc.invalidateQueries({ queryKey: ['qa-by-worklog', workLogId] });
  };

  const createMutation = useMutation({
    mutationFn: () => qaApi.create({
      srNumber: form.srNumber,
      title: form.title,
      content: form.content || undefined,
      tester: form.tester || undefined,
    }),
    onSuccess: () => { invalidate(); setShowAddModal(false); setForm(defaultForm); toast.success('QA요청이 등록되었습니다.'); },
    onError: () => toast.error('등록에 실패했습니다.'),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => qaApi.accept(id),
    onSuccess: (data) => { invalidate(data.workLogId); setViewItem(data); toast.success('QA 접수되었습니다. QA번호가 발급되었습니다.'); },
    onError: () => toast.error('접수에 실패했습니다.'),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => qaApi.confirm(id),
    onSuccess: (data) => { invalidate(data.workLogId); setViewItem(data); toast.success('QA 확인 처리되었습니다.'); },
    onError: () => toast.error('처리에 실패했습니다.'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => qaApi.reject(id),
    onSuccess: (data) => { invalidate(data.workLogId); setViewItem(data); toast.success('QA 반려 처리되었습니다.'); },
    onError: () => toast.error('처리에 실패했습니다.'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => qaApi.cancel(id),
    onSuccess: (data) => { invalidate(data.workLogId); setViewItem(data); toast.success('QA 취소 처리되었습니다.'); },
    onError: () => toast.error('처리에 실패했습니다.'),
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => qaApi.reopen(id),
    onSuccess: (data) => { invalidate(data.workLogId); setViewItem(data); toast.success('접수 상태로 되돌렸습니다.'); },
    onError: () => toast.error('처리에 실패했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => qaApi.remove(id),
    onSuccess: () => { invalidate(); setViewItem(null); toast.success('QA가 삭제되었습니다.'); },
    onError: () => toast.error('삭제에 실패했습니다.'),
  });

  const updateMutation = useMutation({
    mutationFn: () => qaApi.update(viewItem!.id, {
      title: detailForm.title || undefined,
      content: detailForm.content || undefined,
      tester: detailForm.tester || undefined,
    }),
    onSuccess: (data) => { invalidate(); setViewItem(data); toast.success('수정되었습니다.'); },
    onError: () => toast.error('수정에 실패했습니다.'),
  });

  const isValidSR = SR_NUMBER_PATTERN.test(form.srNumber);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="QA 테스트"
        description="SR번호와 QA번호를 매핑하여 테스트를 관리합니다."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching} title="새로고침">
              <RefreshCw size={15} className={cn('mr-1', isFetching && 'animate-spin')} /> 새로고침
            </Button>
            <Button variant="primary" onClick={() => { setForm(defaultForm); setShowAddModal(true); }}>
              <Plus size={16} className="mr-1" /> QA 등록
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {/* 필터 */}
        <div className="mb-4 flex gap-3">
          <input
            type="text"
            placeholder="SR번호 검색 (예: SR-26-0001)"
            value={filterSR}
            onChange={(e) => setFilterSR(e.target.value)}
            className="w-64 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {filterSR && (
            <Button variant="ghost" onClick={() => setFilterSR('')}>
              <X size={14} /> 초기화
            </Button>
          )}
        </div>

        {/* 목록 */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">로딩 중...</div>
        ) : !tests || tests.length === 0 ? (
          <EmptyState icon={<FlaskConical size={32} />} title="QA 테스트가 없습니다." description="워크로드 상세에서 QA요청 버튼을 눌러 등록하세요." />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">QA번호</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">SR번호</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">제목</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">테스터</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">결과</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">등록일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tests.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setViewItem(t)}
                    className="hover:bg-primary-50/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium text-primary-600">
                      {t.qaNumber ?? <span className="text-gray-300">미발급</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{t.srNumber}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        {t.workLogDeleted && (
                          <span className="text-[10px] font-semibold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">삭제된 일감</span>
                        )}
                        <span className="truncate">{t.title}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{t.tester || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', QA_STATUS_CONFIG[t.status].bg, QA_STATUS_CONFIG[t.status].color)}>
                        {QA_STATUS_CONFIG[t.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.result ? (
                        <span className={cn('font-semibold text-xs', QA_RESULT_CONFIG[t.result].color)}>
                          {QA_RESULT_CONFIG[t.result].label}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 등록 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold">QA 테스트 등록</h2>
              <button onClick={() => setShowAddModal(false)}><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">SR번호 *</label>
                <input
                  type="text"
                  value={form.srNumber}
                  onChange={(e) => setForm({ ...form, srNumber: e.target.value })}
                  placeholder="SR-26-0001"
                  className={cn(
                    'w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500',
                    form.srNumber && !isValidSR ? 'border-red-400' : 'border-gray-300',
                  )}
                />
                {form.srNumber && !isValidSR && (
                  <p className="text-xs text-red-500 mt-1">형식: SR-년도뒷2자리-시퀀스4자리 (예: SR-26-0001)</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">제목 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="테스트 항목 제목"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">테스터</label>
                <input
                  type="text"
                  value={form.tester}
                  onChange={(e) => setForm({ ...form, tester: e.target.value })}
                  placeholder="담당자 이름"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">내용</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="테스트 내용 또는 시나리오"
                  rows={3}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>취소</Button>
              <Button
                variant="primary"
                onClick={() => createMutation.mutate()}
                disabled={!form.srNumber || !isValidSR || !form.title || createMutation.isPending}
              >
                등록
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 상세 팝업 (행 클릭) */}
      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setViewItem(null)} />
          <div className={cn('relative bg-white rounded-2xl shadow-2xl w-full overflow-hidden flex max-h-[88vh]', hasHistory ? 'max-w-4xl' : 'max-w-2xl')}>
            {/* 좌측 요청 이력 패널 (같은 SR번호로 재요청된 경우) */}
            {hasHistory && (
              <aside className="w-48 flex-shrink-0 border-r border-gray-200 bg-gray-50/70 overflow-y-auto">
                <div className="px-3 py-3 border-b border-gray-200 sticky top-0 bg-gray-50/95 backdrop-blur-sm">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">요청 이력</p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">{viewItem.srNumber}</p>
                </div>
                <div className="py-1">
                  {srHistory!.map((h, idx) => {
                    const active = h.id === viewItem.id;
                    return (
                      <button
                        key={h.id}
                        onClick={() => setViewItem(h)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 border-l-2 transition-colors',
                          active ? 'border-primary-500 bg-white' : 'border-transparent hover:bg-white/70',
                        )}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className={cn('text-[11px] font-semibold', h.qaNumber ? 'font-mono text-primary-600' : 'text-gray-400')}>
                            {h.qaNumber ?? '미발급'}
                          </span>
                          <span className="text-[9px] text-gray-300 font-medium">#{srHistory!.length - idx}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className={cn('text-[10px] font-medium', QA_STATUS_CONFIG[h.status].color)}>
                            {QA_STATUS_CONFIG[h.status].label}
                          </span>
                          {h.result && (
                            <span className={cn('text-[10px] font-bold', QA_RESULT_CONFIG[h.result].color)}>
                              · {QA_RESULT_CONFIG[h.result].label}
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-gray-400 mt-0.5">{formatDate(h.createdAt)}</p>
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}

            {/* 본문 (헤더 + 스테퍼 + 액션 + 폼 + 푸터) */}
            <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
            {/* 헤더 */}
            <div className="px-6 py-5 bg-gray-50 border-b border-gray-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn('text-xs font-semibold text-primary-600', viewItem.qaNumber ? 'font-mono' : '')}>
                    {viewItem.qaNumber ?? '미발급'}
                  </span>
                  <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', QA_STATUS_CONFIG[viewItem.status].bg, QA_STATUS_CONFIG[viewItem.status].color)}>
                    {QA_STATUS_CONFIG[viewItem.status].label}
                  </span>
                  {viewItem.result && (
                    <span className={cn('text-[11px] font-bold', QA_RESULT_CONFIG[viewItem.result].color)}>
                      {QA_RESULT_CONFIG[viewItem.result].label}
                    </span>
                  )}
                  {viewItem.workLogDeleted && (
                    <span className="text-[10px] font-semibold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">삭제된 일감</span>
                  )}
                </div>
                <h2 className="text-base font-bold text-gray-700 leading-snug truncate">{viewItem.title}</h2>
                <p className="text-[11px] text-gray-400 font-mono mt-0.5">SR: {viewItem.srNumber}</p>
              </div>
              <button onClick={() => setViewItem(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg flex-shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* 진행 단계 스테퍼 */}
            <div className="px-6 pt-4">
              <div className="flex items-center">
                {([
                  { key: 'PENDING', label: '요청' },
                  { key: 'IN_PROGRESS', label: '접수' },
                  { key: 'COMPLETED', label: '완료' },
                ] as const).map((step, i, arr) => {
                  const order = { PENDING: 0, IN_PROGRESS: 1, COMPLETED: 2, CANCELLED: -1 };
                  const cur = order[viewItem.status];
                  const done = viewItem.status !== 'CANCELLED' && cur >= i;
                  return (
                    <div key={step.key} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors',
                          done ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400',
                        )}>
                          {i + 1}
                        </div>
                        <span className={cn('text-[10px] mt-1 font-medium', done ? 'text-primary-600' : 'text-gray-400')}>{step.label}</span>
                      </div>
                      {i < arr.length - 1 && (
                        <div className={cn('flex-1 h-0.5 mx-1 -mt-4', cur > i && viewItem.status !== 'CANCELLED' ? 'bg-primary-600' : 'bg-gray-200')} />
                      )}
                    </div>
                  );
                })}
              </div>
              {viewItem.status === 'CANCELLED' && (
                <p className="text-center text-xs font-semibold text-gray-400 mt-2">취소된 항목입니다.</p>
              )}
            </div>

            {/* 상태 변경 액션 바 */}
            <div className="px-6 py-3 mt-2 border-b border-gray-100">
              {viewItem.status === 'PENDING' && (
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setConfirmState({
                      title: 'QA 접수 취소', message: 'QA 요청을 취소 처리하시겠습니까?', confirmText: '취소 처리', tone: 'danger',
                      onConfirm: () => cancelMutation.mutate(viewItem.id),
                    })}
                    className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    접수 취소
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">접수하면 QA번호가 발급됩니다.</span>
                    <button
                      onClick={() => acceptMutation.mutate(viewItem.id)}
                      disabled={acceptMutation.isPending}
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                    >
                      접수하기
                    </button>
                  </div>
                </div>
              )}
              {viewItem.status === 'IN_PROGRESS' && (
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setConfirmState({
                      title: 'QA 취소', message: '이 QA 항목을 취소 처리하시겠습니까?', confirmText: '취소 처리', tone: 'danger',
                      onConfirm: () => cancelMutation.mutate(viewItem.id),
                    })}
                    className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    취소
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmState({
                        title: 'QA 반려', message: '이 QA 항목을 반려 처리하시겠습니까?', confirmText: '반려', tone: 'danger',
                        onConfirm: () => rejectMutation.mutate(viewItem.id),
                      })}
                      className="px-4 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      반려
                    </button>
                    <button
                      onClick={() => setConfirmState({
                        title: 'QA 확인', message: '이 QA 항목을 확인 처리하시겠습니까?', confirmText: '확인', tone: 'primary',
                        onConfirm: () => confirmMutation.mutate(viewItem.id),
                      })}
                      className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
                    >
                      확인
                    </button>
                  </div>
                </div>
              )}
              {(viewItem.status === 'COMPLETED' || viewItem.status === 'CANCELLED') && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-500">
                    {viewItem.status === 'COMPLETED'
                      ? (viewItem.result === 'PASS' ? '확인 완료된 항목입니다.' : '반려된 항목입니다.')
                      : '취소된 항목입니다.'}
                  </span>
                  <button
                    onClick={() => setConfirmState({
                      title: 'QA 되돌리기', message: '접수(진행중) 상태로 되돌리시겠습니까?', confirmText: '되돌리기', tone: 'primary',
                      onConfirm: () => reopenMutation.mutate(viewItem.id),
                    })}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <RotateCcw size={13} /> 되돌리기
                  </button>
                </div>
              )}
            </div>

            {/* 수정 가능한 본문 */}
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">제목</label>
                <input
                  type="text"
                  value={detailForm.title}
                  onChange={(e) => setDetailForm({ ...detailForm, title: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">테스터</label>
                <input
                  type="text"
                  value={detailForm.tester}
                  onChange={(e) => setDetailForm({ ...detailForm, tester: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">내용</label>
                <textarea
                  value={detailForm.content}
                  onChange={(e) => setDetailForm({ ...detailForm, content: e.target.value })}
                  rows={3}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
              <p className="text-[11px] text-gray-400">등록일: {formatDate(viewItem.createdAt)}</p>
            </div>

            {/* 푸터 */}
            <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100">
              {viewItem.workLogDeleted ? (
                <button
                  onClick={() => setConfirmState({
                    title: 'QA 삭제', message: '연결된 일감이 삭제된 QA입니다. 삭제하시겠습니까?', confirmText: '삭제', tone: 'danger',
                    onConfirm: () => deleteMutation.mutate(viewItem.id),
                  })}
                  className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 size={14} /> 삭제
                </button>
              ) : <span />}
              <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setViewItem(null)}>닫기</Button>
              <Button variant="primary" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                저장
              </Button>
              </div>
            </div>
            </div>

            {/* 우측 SR 정보 패널 */}
            {viewItem.workLog && !viewItem.workLogDeleted && (
              <aside className="w-56 flex-shrink-0 border-l border-gray-200 bg-gray-50/60 overflow-y-auto">
                <div className="px-4 py-3 border-b border-gray-200 sticky top-0 bg-gray-50/95 backdrop-blur-sm flex items-center gap-1.5">
                  <FileText size={13} className="text-gray-400" />
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">SR 정보</p>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {/* SR번호 */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 mb-0.5">SR번호</p>
                    <p className="text-xs font-mono font-bold text-primary-600">{viewItem.workLog.srNumber ?? viewItem.srNumber}</p>
                  </div>
                  {/* 일감 제목 */}
                  {viewItem.workLog.taskTitle && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 mb-0.5">일감명</p>
                      <p className="text-xs text-gray-700 leading-snug">{viewItem.workLog.taskTitle}</p>
                    </div>
                  )}
                  {/* 프로젝트명 */}
                  {viewItem.workLog.projectName && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 mb-0.5">프로젝트</p>
                      <p className="text-xs text-gray-700">{viewItem.workLog.projectName}</p>
                    </div>
                  )}
                  {/* 요청자 */}
                  {viewItem.workLog.requester && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 mb-0.5">요청자</p>
                      <p className="text-xs text-gray-700">{viewItem.workLog.requester}</p>
                    </div>
                  )}
                  {/* 담당자 */}
                  {viewItem.workLog.user && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 mb-0.5">담당자</p>
                      <p className="text-xs text-gray-700">{viewItem.workLog.user.name}</p>
                    </div>
                  )}
                  {/* 요청일 */}
                  {viewItem.workLog.requestDate && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 mb-0.5">요청일</p>
                      <p className="text-xs text-gray-700">{formatDate(viewItem.workLog.requestDate)}</p>
                    </div>
                  )}
                  {/* 개발 기간 */}
                  {(viewItem.workLog.startDate || viewItem.workLog.endDate) && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 mb-0.5">개발 기간</p>
                      <p className="text-xs text-gray-700">
                        {viewItem.workLog.startDate ? formatDate(viewItem.workLog.startDate) : '?'}
                        {' ~ '}
                        {viewItem.workLog.endDate ? formatDate(viewItem.workLog.endDate) : '?'}
                      </p>
                    </div>
                  )}
                  {/* 단계 */}
                  {viewItem.workLog.stage && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 mb-0.5">단계</p>
                      <p className="text-xs text-gray-700">
                        {{ RECEIVED: '접수', DEVELOPMENT: '개발중', COMPLETED: '개발완료', USER_CONFIRMED: '사용자확인', DEPLOYED: '배포완료' }[viewItem.workLog.stage] ?? viewItem.workLog.stage}
                      </p>
                    </div>
                  )}
                  {/* 공수 */}
                  {viewItem.workLog.hours != null && viewItem.workLog.hours > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 mb-0.5">공수</p>
                      <p className="text-xs text-gray-700">{viewItem.workLog.hours}h</p>
                    </div>
                  )}
                  {/* 설명 */}
                  {viewItem.workLog.description && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 mb-0.5">설명</p>
                      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{viewItem.workLog.description}</p>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>
      )}

      {/* 커스텀 확인 다이얼로그 */}
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title ?? ''}
        message={confirmState?.message}
        confirmText={confirmState?.confirmText}
        tone={confirmState?.tone}
        onConfirm={() => { confirmState?.onConfirm(); setConfirmState(null); }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
