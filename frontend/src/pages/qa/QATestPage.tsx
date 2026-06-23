import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Pencil, Trash2, FlaskConical } from 'lucide-react';
import toast from 'react-hot-toast';
import { qaApi, QA_STATUS_CONFIG, QA_RESULT_CONFIG, type QATestStatus, type QATestResult } from '../../api/qa';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate, cn } from '../../lib/utils';

const SR_NUMBER_PATTERN = /^SR-\d{2}-\d{4}$/;

interface QAForm {
  srNumber: string;
  title: string;
  content: string;
  tester: string;
  testDate: string;
}

const defaultForm: QAForm = { srNumber: '', title: '', content: '', tester: '', testDate: '' };

export function QATestPage() {
  const qc = useQueryClient();
  const [filterSR, setFilterSR] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<QAForm>(defaultForm);
  const [editItem, setEditItem] = useState<any>(null);
  const [editForm, setEditForm] = useState<{ title: string; content: string; tester: string; testDate: string; status: QATestStatus; result: string }>({
    title: '', content: '', tester: '', testDate: '', status: 'PENDING', result: '',
  });

  const { data: tests, isLoading } = useQuery({
    queryKey: ['qa-tests', filterSR],
    queryFn: () => qaApi.getAll(filterSR || undefined),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['qa-tests'] });

  const createMutation = useMutation({
    mutationFn: () => qaApi.create({
      srNumber: form.srNumber,
      title: form.title,
      content: form.content || undefined,
      tester: form.tester || undefined,
      testDate: form.testDate || undefined,
    }),
    onSuccess: () => {
      invalidate();
      setShowAddModal(false);
      setForm(defaultForm);
      toast.success('QA 테스트가 등록되었습니다.');
    },
    onError: () => toast.error('등록에 실패했습니다.'),
  });

  const updateMutation = useMutation({
    mutationFn: () => qaApi.update(editItem.id, {
      title: editForm.title || undefined,
      content: editForm.content || undefined,
      status: editForm.status,
      result: (editForm.result as QATestResult) || undefined,
      tester: editForm.tester || undefined,
      testDate: editForm.testDate || undefined,
    }),
    onSuccess: () => {
      invalidate();
      setEditItem(null);
      toast.success('수정되었습니다.');
    },
    onError: () => toast.error('수정에 실패했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => qaApi.remove(id),
    onSuccess: () => { invalidate(); toast.success('삭제되었습니다.'); },
  });

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditForm({
      title: item.title,
      content: item.content ?? '',
      tester: item.tester ?? '',
      testDate: item.testDate ? item.testDate.slice(0, 10) : '',
      status: item.status,
      result: item.result ?? '',
    });
  };

  const isValidSR = SR_NUMBER_PATTERN.test(form.srNumber);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="QA 테스트"
        description="SR번호와 QA번호를 매핑하여 테스트를 관리합니다."
        actions={
          <Button variant="primary" onClick={() => { setForm(defaultForm); setShowAddModal(true); }}>
            <Plus size={16} className="mr-1" /> QA 등록
          </Button>
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
          <EmptyState icon={<FlaskConical size={32} />} title="QA 테스트가 없습니다." description="QA 등록 버튼을 눌러 첫 번째 테스트를 추가하세요." />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['QA번호', 'SR번호', '제목', '테스터', '상태', '결과', '테스트일', '등록일', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tests.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-primary-600">{t.qaNumber}</td>
                    <td className="px-4 py-3 font-mono text-xs">{t.srNumber}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{t.title}</td>
                    <td className="px-4 py-3 text-gray-600">{t.tester || '-'}</td>
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
                    <td className="px-4 py-3 text-gray-500">{t.testDate ? formatDate(t.testDate) : '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(t)} className="p-1 text-gray-400 hover:text-primary-600 rounded">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(t.id); }} className="p-1 text-gray-400 hover:text-red-500 rounded">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
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
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">테스터</label>
                  <input
                    type="text"
                    value={form.tester}
                    onChange={(e) => setForm({ ...form, tester: e.target.value })}
                    placeholder="담당자 이름"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">테스트일</label>
                  <input
                    type="date"
                    value={form.testDate}
                    onChange={(e) => setForm({ ...form, testDate: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
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

      {/* 수정 모달 */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold">QA 테스트 수정</h2>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{editItem.qaNumber} / {editItem.srNumber}</p>
              </div>
              <button onClick={() => setEditItem(null)}><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">제목</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">상태</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as QATestStatus })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {Object.entries(QA_STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">결과</label>
                  <select
                    value={editForm.result}
                    onChange={(e) => setEditForm({ ...editForm, result: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">-</option>
                    {Object.entries(QA_RESULT_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">테스터</label>
                  <input
                    type="text"
                    value={editForm.tester}
                    onChange={(e) => setEditForm({ ...editForm, tester: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">테스트일</label>
                  <input
                    type="date"
                    value={editForm.testDate}
                    onChange={(e) => setEditForm({ ...editForm, testDate: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">내용</label>
                <textarea
                  value={editForm.content}
                  onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                  rows={3}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setEditItem(null)}>취소</Button>
              <Button variant="primary" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                저장
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
