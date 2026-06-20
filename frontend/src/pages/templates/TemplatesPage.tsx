import { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, FileText, Pencil, Trash2, X, Paperclip, Download, Layers, Search, ChevronDown, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { templatesApi, type TemplateInput } from '../../api/templates';
import type { Template } from '../../types';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatDate, formatFileSize, cn } from '../../lib/utils';

// 기본 단계 프리셋 (사용자가 자유롭게 새 단계 추가 가능)
const PRESET_PHASES = ['기획', '설계', '개발', '테스트', '배포', '운영'];

const emptyForm = (): TemplateInput => ({ title: '', phase: '', description: '', content: '' });

// 단계 선택 콤보박스 — 기존/프리셋 단계 목록 + 새 단계 직접 입력
function PhaseSelect({ value, phases, onChange }: {
  value: string;
  phases: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const q = value.trim().toLowerCase();
  const matches = phases.filter((p) => p.toLowerCase().includes(q));
  const isNew = value.trim() !== '' && !phases.some((p) => p.toLowerCase() === q);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="단계 선택 또는 입력"
          className="w-full text-sm border border-gray-300 rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <ChevronDown size={15} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open && (matches.length > 0 || isNew) && (
        <div className="absolute z-10 mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-200 py-1 max-h-56 overflow-y-auto">
          {matches.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { onChange(p); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Layers size={13} className="text-indigo-400" /> {p}
              </span>
              {value.trim().toLowerCase() === p.toLowerCase() && <Check size={14} className="text-indigo-600" />}
            </button>
          ))}
          {isNew && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors border-t border-gray-100"
            >
              <Plus size={13} /> 새 단계 "<span className="font-semibold">{value.trim()}</span>" 추가
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TemplatesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<TemplateInput>(emptyForm());
  const [phaseFilter, setPhaseFilter] = useState<string>('전체');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.getAll(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['templates'] });

  const createTemplate = useMutation({
    mutationFn: () => templatesApi.create(form),
    onSuccess: () => {
      invalidate();
      closeModal();
      toast.success('템플릿이 저장되었습니다. 파일은 수정에서 첨부할 수 있어요.');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '저장에 실패했습니다.'),
  });

  const updateTemplate = useMutation({
    mutationFn: () => templatesApi.update(editing!.id, form),
    onSuccess: () => { invalidate(); closeModal(); toast.success('템플릿이 수정되었습니다.'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '수정에 실패했습니다.'),
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => { invalidate(); toast.success('템플릿이 삭제되었습니다.'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '삭제에 실패했습니다.'),
  });

  const uploadFile = useMutation({
    mutationFn: (file: File) => templatesApi.uploadFile(editing!.id, file),
    onSuccess: async () => {
      await invalidate();
      // editing 객체의 files도 갱신
      const fresh = (await templatesApi.getAll()).find((t) => t.id === editing!.id);
      if (fresh) setEditing(fresh);
      toast.success('파일이 첨부되었습니다.');
    },
    onError: () => toast.error('파일 업로드에 실패했습니다.'),
  });

  const deleteFile = useMutation({
    mutationFn: (fileId: string) => templatesApi.deleteFile(fileId),
    onSuccess: async () => {
      await invalidate();
      const fresh = (await templatesApi.getAll()).find((t) => t.id === editing!.id);
      if (fresh) setEditing(fresh);
      toast.success('파일이 삭제되었습니다.');
    },
    onError: () => toast.error('파일 삭제에 실패했습니다.'),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setShowModal(true); };
  const openEdit = (t: Template) => {
    setEditing(t);
    setForm({ title: t.title, phase: t.phase, description: t.description ?? '', content: t.content ?? '' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(emptyForm()); };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.phase.trim()) return;
    if (editing) updateTemplate.mutate();
    else createTemplate.mutate();
  };

  const handleFilePick = async (files: FileList | null) => {
    if (!files || !editing) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      await uploadFile.mutateAsync(f);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 모든 단계 목록 (프리셋 + 실제 데이터) — 필터칩 & datalist용
  const allPhases = useMemo(() => {
    const set = new Set<string>(PRESET_PHASES);
    (templates ?? []).forEach((t) => set.add(t.phase));
    return Array.from(set);
  }, [templates]);

  const filtered = (templates ?? []).filter((t) => {
    if (phaseFilter !== '전체' && t.phase !== phaseFilter) return false;
    if (search && !`${t.title} ${t.description ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // 단계별 그룹화 (단계 표시 순서: 프리셋 우선, 그 뒤 사용자 단계)
  const grouped = useMemo(() => {
    const map = new Map<string, Template[]>();
    filtered.forEach((t) => {
      if (!map.has(t.phase)) map.set(t.phase, []);
      map.get(t.phase)!.push(t);
    });
    const order = (p: string) => {
      const i = PRESET_PHASES.indexOf(p);
      return i === -1 ? PRESET_PHASES.length + 1 : i;
    };
    return Array.from(map.entries()).sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 헤더 + 단계 필터 (캔버스/시트와 동일 레이아웃) */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-700">템플릿</h1>
            <p className="text-sm text-gray-400 mt-0.5">프로젝트 단계별로 사용할 양식을 관리하세요</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={15} /> 새 템플릿
          </button>
        </div>

        {/* 단계 필터 + 검색 */}
        <div className="flex items-center gap-2 flex-wrap">
          {['전체', ...allPhases].map((p) => (
            <button
              key={p}
              onClick={() => setPhaseFilter(p)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
                phaseFilter === p
                  ? 'bg-primary-600 text-white border-transparent'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-600',
              )}
            >
              {p}
            </button>
          ))}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2.5 py-1.5 ml-auto w-56">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="템플릿 검색..."
              className="flex-1 text-xs bg-transparent outline-none text-gray-700"
            />
          </div>
        </div>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <LoadingSpinner />
        ) : !filtered.length ? (
          <EmptyState
            icon={<FileText size={32} />}
            title="템플릿이 없습니다"
            description="프로젝트 단계별로 사용할 양식을 등록해 보세요."
            action={
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus size={15} /> 새 템플릿 만들기
              </button>
            }
          />
        ) : (
          <div className="space-y-8">
            {grouped.map(([phase, items]) => (
              <div key={phase}>
                <div className="flex items-center gap-2 mb-3">
                  <Layers size={14} className="text-indigo-500" />
                  <h2 className="text-sm font-bold text-gray-700">{phase}</h2>
                  <span className="text-[11px] text-gray-400">{items.length}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {items.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => openEdit(t)}
                      className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 hover:shadow-md transition-all cursor-pointer"
                    >
                      {/* 썸네일 */}
                      <div className="h-16 bg-gradient-to-br from-indigo-50 via-indigo-50 to-white flex items-center justify-center">
                        <FileText size={22} className="text-indigo-300" />
                      </div>
                      {/* 정보 */}
                      <div className="px-3 py-2 border-t border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                        {t.description
                          ? <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{t.description}</p>
                          : <p className="text-xs text-gray-300 mt-0.5">설명 없음</p>}
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400">
                          {t.files.length > 0 && (
                            <span className="inline-flex items-center gap-1"><Paperclip size={11} /> {t.files.length}</span>
                          )}
                          <span className="ml-auto">{formatDate(t.updatedAt)}</span>
                        </div>
                      </div>
                      {/* 액션 */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEdit(t)}
                          className="w-7 h-7 flex items-center justify-center bg-white rounded-lg shadow border border-gray-200 text-gray-500 hover:text-indigo-600 transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => { if (confirm('이 템플릿을 삭제하시겠습니까?')) deleteTemplate.mutate(t.id); }}
                          className="w-7 h-7 flex items-center justify-center bg-white rounded-lg shadow border border-gray-200 text-gray-500 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 생성/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-base font-bold text-gray-800">{editing ? '템플릿 수정' : '새 템플릿'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">제목 *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="예: 요구사항 정의서"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">단계 *</label>
                  <PhaseSelect
                    value={form.phase}
                    phases={allPhases}
                    onChange={(v) => setForm({ ...form, phase: v })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">설명</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="템플릿에 대한 간단한 설명"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">본문</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="템플릿 양식 본문을 입력하세요 (마크다운/텍스트)..."
                  rows={8}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
                />
              </div>

              {/* 첨부파일 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">첨부파일</label>
                {!editing ? (
                  <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2.5">
                    템플릿을 먼저 저장하면 파일을 첨부할 수 있습니다.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {editing.files.map((f) => (
                      <div key={f.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <Paperclip size={13} className="text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-700 truncate flex-1">{f.originalName}</span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{formatFileSize(f.size)}</span>
                        <a
                          href={f.url} target="_blank" rel="noreferrer" download
                          className="p-1 text-gray-400 hover:text-indigo-600 rounded transition-colors"
                          title="다운로드"
                        >
                          <Download size={13} />
                        </a>
                        <button
                          onClick={() => deleteFile.mutate(f.id)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600 border border-dashed border-gray-300 rounded-lg py-2.5 hover:border-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                    >
                      <Paperclip size={13} /> {uploading ? '업로드 중...' : '파일 추가'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFilePick(e.target.files)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <Button variant="ghost" onClick={closeModal}>닫기</Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!form.title.trim() || !form.phase.trim()}
                loading={createTemplate.isPending || updateTemplate.isPending}
              >
                {editing ? '저장' : '저장'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
