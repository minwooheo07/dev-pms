import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Download, FileSpreadsheet, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { tasksApi, type BulkTaskRow } from '../../api/tasks';
import { Button } from '../ui/Button';

interface BulkImportModalProps {
  projectId: string;
  onClose: () => void;
}

// 엑셀 헤더 → 내부 필드 매핑 (한글 헤더 허용 — 실제 태스크 필드명 기준)
const HEADER_MAP: Record<string, keyof BulkTaskRow> = {
  '업무구분': 'category',
  '제목': 'title',
  '요구사항': 'title', // 구버전 양식 호환
  '업무파트': 'part',
  '파트': 'part',
  '설명': 'description',
  '담당자': 'assigneeName',
  '우선순위': 'priority',
  '시작일': 'startDate',
  '마감일': 'dueDate',
};

export function BulkImportModal({ projectId, onClose }: BulkImportModalProps) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<BulkTaskRow[]>([]);
  const [fileName, setFileName] = useState('');

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
        const parsed: BulkTaskRow[] = raw.map((r) => {
          const row: any = {};
          for (const [header, value] of Object.entries(r)) {
            const field = HEADER_MAP[header.trim()];
            if (field) row[field] = String(value ?? '').trim();
          }
          return row as BulkTaskRow;
        }).filter((r) => r.title?.trim() || r.category?.trim());
        if (parsed.length === 0) {
          toast.error('유효한 데이터가 없습니다. 양식을 확인하세요.');
          return;
        }
        setRows(parsed);
        setFileName(file.name);
      } catch {
        toast.error('엑셀 파일을 읽을 수 없습니다.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const sample = [
      { 업무구분: '회원관리', 제목: '로그인 SSO 연동', 업무파트: '백엔드', 설명: '사내 SSO 연동', 담당자: '', 우선순위: 'HIGH', 시작일: '2026-07-01', 마감일: '2026-07-10' },
      { 업무구분: '회원관리', 제목: '비밀번호 정책 적용', 업무파트: '백엔드', 설명: '', 담당자: '', 우선순위: 'MEDIUM', 시작일: '', 마감일: '' },
      { 업무구분: '주문관리', 제목: '주문 취소 기능', 업무파트: '프론트', 설명: '', 담당자: '', 우선순위: 'URGENT', 시작일: '', 마감일: '' },
      { 업무구분: '', 제목: '단독 처리 건 (업무구분 비우면 단일 태스크)', 업무파트: '', 설명: '', 담당자: '', 우선순위: 'MEDIUM', 시작일: '', 마감일: '' },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '요구사항');
    XLSX.writeFile(wb, 'task_bulk_template.xlsx');
  };

  const importMutation = useMutation({
    mutationFn: () => tasksApi.bulkCreate(projectId, rows),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] });
      const parts: string[] = [];
      if (res.parentCount) parts.push(`상위 ${res.parentCount}개`);
      if (res.childCount) parts.push(`하위 ${res.childCount}개`);
      if (res.standaloneCount) parts.push(`단일 ${res.standaloneCount}개`);
      toast.success(`${parts.join(' · ') || '0개'} 등록 완료`);
      onClose();
    },
    onError: () => toast.error('일괄 등록에 실패했습니다.'),
  });

  // 업무구분별 그룹 요약 (미리보기) — 업무구분이 있는 행만 집계
  const groupCount = new Map<string, number>();
  rows.forEach((r) => { if (r.category?.trim()) groupCount.set(r.category, (groupCount.get(r.category) ?? 0) + 1); });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">엑셀 일괄 등록</h2>
              <p className="text-[11px] text-gray-500">여러 태스크를 한번에 생성 · 업무구분으로 묶으면 상위-하위 구조로 생성</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
          {/* 양식 다운로드 */}
          <div className="flex items-center justify-between rounded-xl border border-dashed border-gray-300 px-4 py-3 bg-gray-50">
            <div className="text-xs text-gray-600">
              <p className="font-semibold mb-0.5">1. 양식을 받아 내용을 채우세요</p>
              <p className="text-gray-400">필수: 제목 / 선택: 업무구분(같은 값끼리 상위 태스크로 묶음), 업무파트, 설명, 담당자, 우선순위, 시작일, 마감일</p>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download size={14} className="mr-1" /> 양식 다운로드
            </Button>
          </div>

          {/* 파일 업로드 */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">2. 작성한 엑셀 업로드</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ''; }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50/30 py-8 transition-colors"
            >
              <Upload size={24} className="text-gray-400" />
              <span className="text-sm text-gray-500">{fileName || '엑셀 파일 선택 (.xlsx)'}</span>
            </button>
          </div>

          {/* 미리보기 */}
          {rows.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">
                3. 미리보기 — 업무구분 <b className="text-primary-600">{groupCount.size}</b>개 · 태스크 <b className="text-primary-600">{rows.length}</b>개
              </p>
              <div className="rounded-xl border border-gray-200 overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">업무구분</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">제목</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">업무파트</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">담당자</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">우선순위</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 text-gray-600">{r.category || '-'}</td>
                        <td className="px-3 py-1.5 text-gray-800 max-w-[220px] truncate">{r.title}</td>
                        <td className="px-3 py-1.5 text-gray-500">{r.part || '-'}</td>
                        <td className="px-3 py-1.5 text-gray-500">{r.assigneeName || '-'}</td>
                        <td className="px-3 py-1.5 text-gray-500">{r.priority || 'MEDIUM'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 100 && <p className="text-[11px] text-gray-400 mt-1">...외 {rows.length - 100}개 (전체 등록됨)</p>}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button
            variant="primary"
            onClick={() => importMutation.mutate()}
            disabled={rows.length === 0 || importMutation.isPending}
            loading={importMutation.isPending}
          >
            {rows.length > 0 ? `${rows.length}개 등록` : '등록'}
          </Button>
        </div>
      </div>
    </div>
  );
}
