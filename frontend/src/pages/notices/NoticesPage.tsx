import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pin, Pencil, Trash2, X, Megaphone, PinOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { noticesApi } from '../../api/notices';
import { useAuthStore } from '../../store/auth.store';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatRelativeTime, formatDate, cn } from '../../lib/utils';

interface NoticeForm {
  title: string;
  content: string;
  isPinned: boolean;
}

const empty = (): NoticeForm => ({ title: '', content: '', isPinned: false });

export function NoticesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [showModal, setShowModal] = useState(false);
  const [editNotice, setEditNotice] = useState<any>(null);
  const [form, setForm] = useState<NoticeForm>(empty());
  const [viewNotice, setViewNotice] = useState<any>(null);

  const { data: notices, isLoading } = useQuery({
    queryKey: ['notices', projectId],
    queryFn: () => noticesApi.getAll(projectId!),
    enabled: !!projectId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['notices', projectId] });

  const createNotice = useMutation({
    mutationFn: () => noticesApi.create({ ...form, projectId: projectId! }),
    onSuccess: () => { invalidate(); setShowModal(false); setForm(empty()); toast.success('공지사항이 등록되었습니다.'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '등록에 실패했습니다.'),
  });

  const updateNotice = useMutation({
    mutationFn: () => noticesApi.update(editNotice.id, { title: form.title, content: form.content, isPinned: form.isPinned }),
    onSuccess: () => { invalidate(); setEditNotice(null); toast.success('공지사항이 수정되었습니다.'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '수정에 실패했습니다.'),
  });

  const deleteNotice = useMutation({
    mutationFn: (id: string) => noticesApi.delete(id),
    onSuccess: () => { invalidate(); toast.success('공지사항이 삭제되었습니다.'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '삭제에 실패했습니다.'),
  });

  const openEdit = (n: any) => {
    setEditNotice(n);
    setForm({ title: n.title, content: n.content, isPinned: n.isPinned });
    setViewNotice(null);
  };

  const openCreate = () => {
    setForm(empty());
    setShowModal(true);
  };

  const pinnedNotices = notices?.filter((n: any) => n.isPinned) ?? [];
  const regularNotices = notices?.filter((n: any) => !n.isPinned) ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Megaphone size={18} className="text-indigo-500" />
          <h1 className="text-lg font-bold text-gray-900">공지사항</h1>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">
            {notices?.length ?? 0}건
          </span>
        </div>
        {isAdmin && (
          <Button variant="primary" onClick={openCreate}>
            <Plus size={15} /> 공지사항 등록
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !notices?.length ? (
          <EmptyState
            icon={<Megaphone size={36} />}
            title="등록된 공지사항이 없습니다"
            description={isAdmin ? '팀에 공유할 공지사항을 등록해 보세요.' : undefined}
            action={isAdmin ? (
              <Button variant="primary" onClick={openCreate}>
                <Plus size={15} /> 공지사항 등록
              </Button>
            ) : undefined}
          />
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* 고정 공지 */}
            {pinnedNotices.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Pin size={11} /> 고정 공지
                </p>
                <div className="space-y-3">
                  {pinnedNotices.map((n: any) => (
                    <NoticeCard
                      key={n.id}
                      notice={n}
                      isAdmin={isAdmin}
                      onView={() => setViewNotice(n)}
                      onEdit={() => openEdit(n)}
                      onDelete={() => { if (confirm('삭제하시겠습니까?')) deleteNotice.mutate(n.id); }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 일반 공지 */}
            {regularNotices.length > 0 && (
              <div>
                {pinnedNotices.length > 0 && (
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">일반 공지</p>
                )}
                <div className="space-y-3">
                  {regularNotices.map((n: any) => (
                    <NoticeCard
                      key={n.id}
                      notice={n}
                      isAdmin={isAdmin}
                      onView={() => setViewNotice(n)}
                      onEdit={() => openEdit(n)}
                      onDelete={() => { if (confirm('삭제하시겠습니까?')) deleteNotice.mutate(n.id); }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 등록 모달 */}
      {showModal && (
        <NoticeModal
          title="공지사항 등록"
          form={form}
          setForm={setForm}
          onClose={() => setShowModal(false)}
          onSubmit={() => createNotice.mutate()}
          isPending={createNotice.isPending}
          submitLabel="등록"
        />
      )}

      {/* 수정 모달 */}
      {editNotice && (
        <NoticeModal
          title="공지사항 수정"
          form={form}
          setForm={setForm}
          onClose={() => setEditNotice(null)}
          onSubmit={() => updateNotice.mutate()}
          isPending={updateNotice.isPending}
          submitLabel="저장"
        />
      )}

      {/* 보기 모달 */}
      {viewNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setViewNotice(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {viewNotice.isPinned && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">
                      <Pin size={9} /> 고정
                    </span>
                  )}
                  <h2 className="text-base font-bold text-gray-900">{viewNotice.title}</h2>
                </div>
                <p className="text-xs text-gray-400">
                  {viewNotice.createdBy.name} · {formatDate(viewNotice.createdAt)} 작성
                  {viewNotice.updatedAt !== viewNotice.createdAt && ` · ${formatRelativeTime(viewNotice.updatedAt)} 수정`}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {isAdmin && (
                  <>
                    <button
                      onClick={() => openEdit(viewNotice)}
                      className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('삭제하시겠습니까?')) {
                          deleteNotice.mutate(viewNotice.id);
                          setViewNotice(null);
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                <button onClick={() => setViewNotice(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{viewNotice.content}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NoticeCard({ notice, isAdmin, onView, onEdit, onDelete }: {
  notice: any; isAdmin: boolean;
  onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'group bg-white rounded-xl border p-4 hover:shadow-sm transition-all cursor-pointer',
        notice.isPinned ? 'border-indigo-100 bg-indigo-50/30' : 'border-gray-200',
      )}
      onClick={onView}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {notice.isPinned && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                <Pin size={9} /> 고정
              </span>
            )}
            <h3 className="text-sm font-semibold text-gray-900 truncate">{notice.title}</h3>
          </div>
          <p className="text-xs text-gray-500 line-clamp-2 whitespace-pre-wrap">{notice.content}</p>
          <p className="text-xs text-gray-400 mt-2">
            {notice.createdBy.name} · {formatRelativeTime(notice.createdAt)}
          </p>
        </div>
        {isAdmin && (
          <div
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onEdit}
              className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NoticeModal({ title, form, setForm, onClose, onSubmit, isPending, submitLabel }: {
  title: string; form: NoticeForm; setForm: (f: NoticeForm) => void;
  onClose: () => void; onSubmit: () => void; isPending: boolean; submitLabel: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-br from-indigo-50 via-white to-violet-50 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">제목 *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="공지사항 제목"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">내용 *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="공지 내용을 입력하세요..."
              rows={6}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div
              onClick={() => setForm({ ...form, isPinned: !form.isPinned })}
              className={cn(
                'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
                form.isPinned ? 'bg-indigo-600' : 'bg-gray-200',
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                form.isPinned ? 'translate-x-4' : 'translate-x-0.5',
              )} />
            </div>
            <span className="text-sm text-gray-700 flex items-center gap-1.5">
              {form.isPinned ? <Pin size={13} className="text-indigo-500" /> : <PinOff size={13} className="text-gray-400" />}
              상단 고정
            </span>
          </label>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={!form.title.trim() || !form.content.trim()}
            loading={isPending}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
