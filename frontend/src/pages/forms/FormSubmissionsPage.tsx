import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Pencil, Plus, Trash2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { formsApi, type FormField } from '../../api/forms';
import { FormRenderer } from '../../components/forms/FormRenderer';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useAuthStore } from '../../store/auth.store';
import { formatDate } from '../../lib/utils';

function validate(fields: FormField[], values: Record<string, any>) {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (!f.required) continue;
    const v = values[f.id];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) errors[f.id] = '필수 입력 항목입니다.';
  }
  return errors;
}

export function FormSubmissionsPage() {
  const { projectId, formId } = useParams<{ projectId: string; formId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const [fillOpen, setFillOpen] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [viewSubmission, setViewSubmission] = useState<any>(null);

  const { data: form, isLoading: formLoading } = useQuery({
    queryKey: ['form', projectId, formId],
    queryFn: () => formsApi.get(projectId!, formId!),
    enabled: !!projectId && !!formId,
  });

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['form-submissions', projectId, formId],
    queryFn: () => formsApi.listSubmissions(projectId!, formId!),
    enabled: !!projectId && !!formId,
  });

  const submitMutation = useMutation({
    mutationFn: (data: Record<string, any>) => formsApi.submit(projectId!, formId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-submissions', projectId, formId] });
      qc.invalidateQueries({ queryKey: ['forms', projectId] });
      setFillOpen(false);
      setValues({});
      setErrors({});
      toast.success('제출되었습니다.');
    },
    onError: () => toast.error('제출에 실패했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => formsApi.removeSubmission(projectId!, formId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-submissions', projectId, formId] });
      qc.invalidateQueries({ queryKey: ['forms', projectId] });
      toast.success('삭제되었습니다.');
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  });

  const fields: FormField[] = form?.schema ?? [];

  const handleSubmit = () => {
    const errs = validate(fields, values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error('필수 항목을 입력해주세요.'); return; }
    submitMutation.mutate(values);
  };

  if (formLoading) return <div className="h-full flex items-center justify-center"><LoadingSpinner /></div>;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-200 flex-shrink-0 shadow-sm">
        <button onClick={() => navigate(`/forms?project=${projectId}`)} className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold text-gray-700">{form?.name}</span>
        <span className="text-xs text-gray-400">제출 {submissions.length}건</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => navigate(`/projects/${projectId}/forms/${formId}/builder`)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-600 transition-colors"
          >
            <Pencil size={14} /> 양식 편집
          </button>
          <button
            onClick={() => { setValues({}); setErrors({}); setFillOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus size={14} /> 새로 작성
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <LoadingSpinner />
        ) : submissions.length === 0 ? (
          <EmptyState
            icon={<FileText size={32} />}
            title="제출된 데이터가 없습니다"
            description="새로 작성 버튼으로 양식을 작성해보세요."
          />
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {submissions.map((s: any) => (
              <div
                key={s.id}
                onClick={() => setViewSubmission(s)}
                className="group flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm cursor-pointer transition-all"
              >
                <FileText size={16} className="text-gray-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">
                    {fields.find((f) => !['title', 'body'].includes(f.type)) ?
                      String(s.data?.[fields.find((f) => !['title', 'body'].includes(f.type))!.id] ?? '(내용 없음)').slice(0, 60)
                      : '제출 데이터'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.submittedBy?.name} · {formatDate(s.createdAt)}</p>
                </div>
                {(me?.role === 'ADMIN' || s.submittedBy?.id === me?.id) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm('이 제출 데이터를 삭제하시겠습니까?')) deleteMutation.mutate(s.id); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 작성 모달 */}
      <Modal open={fillOpen} onClose={() => setFillOpen(false)} title={form?.name} size="lg">
        <div className="p-6">
          <FormRenderer fields={fields} values={values} errors={errors} onChange={(id, v) => setValues((p) => ({ ...p, [id]: v }))} />
          <div className="flex justify-end gap-2 pt-6 mt-2 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setFillOpen(false)}>취소</Button>
            <Button variant="primary" onClick={handleSubmit} loading={submitMutation.isPending}>제출</Button>
          </div>
        </div>
      </Modal>

      {/* 상세 보기 모달 (읽기 전용) */}
      <Modal open={!!viewSubmission} onClose={() => setViewSubmission(null)} title="제출 내용" size="lg">
        {viewSubmission && (
          <div className="p-6">
            <p className="text-xs text-gray-400 mb-4">{viewSubmission.submittedBy?.name} · {formatDate(viewSubmission.createdAt)}</p>
            <FormRenderer fields={fields} values={viewSubmission.data ?? {}} readOnly />
          </div>
        )}
      </Modal>
    </div>
  );
}
