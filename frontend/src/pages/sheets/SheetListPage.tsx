import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Table2, Trash2, Pencil, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { sheetsApi } from '../../api/sheets';
import { projectsApi } from '../../api/projects';
import { formatDate } from '../../lib/utils';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';

export function SheetListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getAll,
  });

  const projectId = searchParams.get('project') ?? projects?.[0]?.id ?? null;

  const { data: sheets, isLoading } = useQuery({
    queryKey: ['sheets', projectId],
    queryFn: () => sheetsApi.list(projectId!),
    enabled: !!projectId,
  });

  const createSheet = useMutation({
    mutationFn: (name: string) => sheetsApi.create(projectId!, name),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['sheets', projectId] });
      setCreating(false);
      setNewName('');
      navigate(`/projects/${projectId}/sheet/${data.id}`);
    },
    onError: () => toast.error('시트 생성에 실패했습니다.'),
  });

  const renameSheet = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      sheetsApi.rename(projectId!, id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sheets', projectId] });
      setRenamingId(null);
    },
  });

  const deleteSheet = useMutation({
    mutationFn: (id: string) => sheetsApi.remove(projectId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sheets', projectId] });
      toast.success('시트가 삭제되었습니다.');
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  });

  const handleCreate = () => {
    const name = newName.trim() || '새 시트';
    createSheet.mutate(name);
  };

  const selectedProject = projects?.find((p: any) => p.id === projectId);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 헤더 + 프로젝트 선택 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-700">시트</h1>
            <p className="text-sm text-gray-400 mt-0.5">엑셀처럼 데이터를 정리하고 관리하세요</p>
          </div>
          {projectId && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus size={15} /> 새 시트
            </button>
          )}
        </div>

        {/* 프로젝트 선택 */}
        {projects && projects.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {projects.map((p: any) => (
              <button
                key={p.id}
                onClick={() => setSearchParams({ project: p.id })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  projectId === p.id
                    ? 'text-white border-transparent'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                }`}
                style={projectId === p.id ? { backgroundColor: p.color, borderColor: p.color } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: projectId === p.id ? 'rgba(255,255,255,0.7)' : p.color }}
                />
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 시트 목록 */}
      <div className="flex-1 overflow-auto p-6">
        {/* 새 시트 이름 입력 */}
        {creating && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-primary-50 border border-gray-200 rounded-xl">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setCreating(false); setNewName(''); }
              }}
              placeholder="시트 이름 (Enter로 생성)"
              className="flex-1 text-sm bg-transparent outline-none placeholder-primary-300 text-gray-900"
            />
            <button onClick={handleCreate} className="text-xs font-medium text-gray-600 hover:text-red-600 px-2">생성</button>
            <button onClick={() => { setCreating(false); setNewName(''); }} className="text-xs text-gray-400 hover:text-gray-600 px-2">취소</button>
          </div>
        )}

        {!projectId ? (
          <EmptyState
            icon={<Table2 size={32} />}
            title="프로젝트를 선택하세요"
            description="상단에서 프로젝트를 선택하면 시트 목록을 볼 수 있습니다."
          />
        ) : isLoading ? (
          <LoadingSpinner />
        ) : !sheets?.length ? (
          <EmptyState
            icon={<Table2 size={32} />}
            title={`${selectedProject?.name ?? ''} 시트가 없습니다`}
            description="새 시트를 만들어 데이터를 정리해보세요."
            action={
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus size={15} /> 새 시트 만들기
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {sheets.map((sheet: any) => (
              <div
                key={sheet.id}
                className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => navigate(`/projects/${projectId}/sheet/${sheet.id}`)}
              >
                {/* 썸네일 */}
                <div className="h-20 bg-gradient-to-br from-emerald-50 via-teal-50 to-white flex items-center justify-center">
                  <Table2 size={24} className="text-emerald-300" />
                </div>

                <div className="px-3 py-2 border-t border-gray-100">
                  {renamingId === sheet.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') renameSheet.mutate({ id: sheet.id, name: renameValue });
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onBlur={() => renameSheet.mutate({ id: sheet.id, name: renameValue })}
                      className="w-full text-sm font-medium text-gray-900 outline-none border-b border-primary-400 bg-transparent"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900 truncate">{sheet.name}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(sheet.updatedAt)} 수정</p>
                </div>

                {/* 액션 버튼 */}
                <div
                  className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => { setRenamingId(sheet.id); setRenameValue(sheet.name); }}
                    className="w-7 h-7 flex items-center justify-center bg-white rounded-lg shadow border border-gray-200 text-gray-500 hover:text-red-600 transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`"${sheet.name}"을 삭제하시겠습니까?`)) deleteSheet.mutate(sheet.id); }}
                    className="w-7 h-7 flex items-center justify-center bg-white rounded-lg shadow border border-gray-200 text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
