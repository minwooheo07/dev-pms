import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, memo } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, X, Check, Table2, Bold, Italic, AlignLeft, AlignCenter, AlignRight, ChevronDown, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { sheetsApi } from '../../api/sheets';
import { cn } from '../../lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
type CellStyle = {
  bg?: string; color?: string; fontSize?: number;
  bold?: boolean; italic?: boolean; align?: 'left' | 'center' | 'right';
};
type CellData = { v?: string; s?: CellStyle };
type MergeInfo = { rows: number; cols: number };
type SheetData = {
  cells: Record<string, CellData>;
  rows: number; cols: number;
  colWidths: Record<number, number>;
  merges: Record<string, MergeInfo>;
};
type Rng = { r1: number; c1: number; r2: number; c2: number };

// ── Constants ─────────────────────────────────────────────────────────────────
const DROWS = 100, DCOLS = 26, CHW = 52, DCW = 120, RH = 26;
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36];
const BG_COLORS = [
  '#ffffff','#f8fafc','#f1f5f9','#e2e8f0','#cbd5e1','#94a3b8','#64748b','#475569','#334155','#1e293b','#0f172a','#000000',
  '#fff5f5','#fed7d7','#fc8181','#f56565','#e53e3e','#c53030','#9b2c2c',
  '#fff7ed','#fed7aa','#fb923c','#f97316','#ea580c','#c2410c','#9a3412',
  '#fefce8','#fef9c3','#fde047','#facc15','#eab308','#ca8a04','#a16207',
  '#f0fdf4','#d1fae5','#6ee7b7','#34d399','#10b981','#059669','#047857',
  '#ecfdf5','#ccfbf1','#5eead4','#2dd4bf','#14b8a6','#0d9488','#0f766e',
  '#eff6ff','#dbeafe','#93c5fd','#60a5fa','#3b82f6','#2563eb','#1d4ed8',
  '#fff0f0','#ffe0e0','#ff9090','#ff5050','#e60012','#cc000f','#a8000c',
  '#faf5ff','#f3e8ff','#d8b4fe','#c084fc','#a855f7','#9333ea','#7e22ce',
  '#fdf2f8','#fce7f3','#f9a8d4','#f472b6','#ec4899','#db2777','#be185d',
];
const TEXT_COLORS = [
  '#000000','#1e293b','#334155','#475569','#64748b','#94a3b8','#cbd5e1','#e2e8f0','#f1f5f9','#ffffff',
  '#9b2c2c','#c53030','#e53e3e','#f56565','#fc8181',
  '#9a3412','#c2410c','#ea580c','#f97316','#fb923c',
  '#a16207','#ca8a04','#eab308','#facc15','#fde047',
  '#047857','#059669','#10b981','#34d399','#6ee7b7',
  '#0f766e','#0d9488','#14b8a6','#2dd4bf','#5eead4',
  '#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd',
  '#a8000c','#cc000f','#e60012','#ff5050','#ff9090',
  '#7e22ce','#9333ea','#a855f7','#c084fc','#d8b4fe',
  '#be185d','#db2777','#ec4899','#f472b6','#f9a8d4',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const colLabel = (i: number) => {
  let s = '', n = i;
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
};
const ck = (r: number, c: number) => `${r},${c}`;
const norm = (v: any): CellData => !v ? {} : typeof v === 'string' ? { v } : v;
const emptyData = (): SheetData => ({ cells: {}, rows: DROWS, cols: DCOLS, colWidths: {}, merges: {} });
const getRange = (s: [number,number]|null, e: [number,number]|null): Rng|null => {
  if (!s) return null;
  const ee = e ?? s;
  return { r1: Math.min(s[0],ee[0]), c1: Math.min(s[1],ee[1]), r2: Math.max(s[0],ee[0]), c2: Math.max(s[1],ee[1]) };
};
const inRng = (r: number, c: number, rng: Rng|null) =>
  !!rng && r >= rng.r1 && r <= rng.r2 && c >= rng.c1 && c <= rng.c2;
const removeOverlap = (merges: Record<string,MergeInfo>, rng: Rng) => {
  const res = { ...merges };
  for (const [k, m] of Object.entries(merges)) {
    const [mr, mc] = k.split(',').map(Number);
    if (mr <= rng.r2 && mr+m.rows-1 >= rng.r1 && mc <= rng.c2 && mc+m.cols-1 >= rng.c1) delete res[k];
  }
  return res;
};

// ── Portal Dropdown ────────────────────────────────────────────────────────────
function usePortalPos(anchorRef: React.RefObject<HTMLElement | null>, open: boolean) {
  const [pos, setPos] = useState<{ top: number; left: number; ready: boolean }>({ top: 0, left: 0, ready: false });
  useLayoutEffect(() => {
    if (open && anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, ready: true });
    } else {
      setPos(p => ({ ...p, ready: false }));
    }
  }, [open]);
  return pos;
}

// ── Color Picker ──────────────────────────────────────────────────────────────
function ColorSwatch({ colors, value, onChange, label, preview }: {
  colors: string[]; value?: string; onChange: (c?: string) => void; label: string; preview: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef  = useRef<HTMLDivElement>(null);
  const dropRef    = useRef<HTMLDivElement>(null);
  const pos        = usePortalPos(anchorRef, open);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (anchorRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={anchorRef} className="relative flex-shrink-0">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-0.5 px-1 py-1 rounded hover:bg-gray-100" title={label}>
        <div className="flex flex-col items-center">{preview}</div>
        <ChevronDown size={9} className="text-gray-400" />
      </button>
      {open && createPortal(
        <div ref={dropRef} className="fixed z-[9999] p-2 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[140px]"
          style={{ top: pos.top, left: pos.left, visibility: pos.ready ? 'visible' : 'hidden' }}>
          <p className="text-[10px] text-gray-400 mb-1.5 font-medium">{label}</p>
          <div className="grid grid-cols-6 gap-1">
            {colors.map(c => (
              <button key={c} onClick={() => { onChange(c); setOpen(false); }}
                className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: c }} title={c} />
            ))}
          </div>
          <button onClick={() => { onChange(undefined); setOpen(false); }}
            className="mt-1.5 w-full text-[10px] text-gray-400 hover:text-gray-600 text-center">초기화</button>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Memo Cell ─────────────────────────────────────────────────────────────────
interface MemoCellProps {
  r: number; c: number;
  cell: CellData;
  span: { rowSpan: number; colSpan: number };
  isAnchor: boolean;
  isEditing: boolean;
  editKey: number;
  editInitVal: string;
  isCopy: boolean;
  copyBorderTop?: string; copyBorderRight?: string; copyBorderBottom?: string; copyBorderLeft?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  rows: number; cols: number;
  onCommit: () => void;
  onEscape: () => void;
  onMoveAfterEdit: (r: number, c: number, dr: number, dc: number) => void;
}

const MemoCell = memo(function Cell({
  r, c, cell, span, isAnchor, isEditing, editKey, editInitVal,
  isCopy, copyBorderTop, copyBorderRight, copyBorderBottom, copyBorderLeft,
  inputRef, rows, cols, onCommit, onEscape, onMoveAfterEdit,
}: MemoCellProps) {
  const s = cell.s ?? {};
  return (
    <td
      data-row={r} data-col={c}
      rowSpan={span.rowSpan} colSpan={span.colSpan}
      className={cn(
        'border border-gray-200 p-0 relative cursor-cell text-sm',
        isAnchor && !isEditing && 'outline outline-2 outline-primary-500 outline-offset-[-1px] z-10',
        (isAnchor && isEditing || isCopy) && 'z-10',
      )}
      style={{
        height: RH,
        backgroundColor: s.bg,
        borderTop:    copyBorderTop,
        borderRight:  copyBorderRight,
        borderBottom: copyBorderBottom,
        borderLeft:   copyBorderLeft,
        fontWeight: s.bold ? 'bold' : undefined,
        fontStyle: s.italic ? 'italic' : undefined,
        color: s.color,
        fontSize: s.fontSize ? `${s.fontSize}px` : undefined,
      }}
    >
      {isAnchor && isEditing ? (
        <input
          key={editKey}
          ref={inputRef}
          defaultValue={editInitVal}
          onFocus={e => { const len = e.target.value.length; e.target.setSelectionRange(len, len); }}
          onKeyDown={e => {
            if (e.key === 'Enter') { if (e.isComposing) return; e.preventDefault(); onCommit(); onMoveAfterEdit(r, c, 1, 0); }
            else if (e.key === 'Escape') { onEscape(); }
            else if (e.key === 'Tab') { e.preventDefault(); onCommit(); onMoveAfterEdit(r, c, 0, 1); }
            e.stopPropagation();
          }}
          onBlur={onCommit}
          className="absolute inset-0 w-full h-full px-1.5 text-sm border-none outline-none bg-white z-10"
          style={{ fontWeight: s.bold?'bold':undefined, fontStyle: s.italic?'italic':undefined, fontSize: s.fontSize?`${s.fontSize}px`:undefined, color: s.color, textAlign: s.align }}
        />
      ) : (
        <span className="block px-1.5 truncate overflow-hidden" style={{ lineHeight:`${RH}px`, textAlign: s.align ?? 'left' }}>
          {cell.v ?? ''}
        </span>
      )}
    </td>
  );
}, (prev, next) => {
  if (prev.isAnchor !== next.isAnchor) return false;
  if (prev.isAnchor && prev.isEditing !== next.isEditing) return false;
  if (prev.isAnchor && next.isEditing && prev.editKey !== next.editKey) return false;
  if (prev.isCopy !== next.isCopy) return false;
  if (prev.copyBorderTop !== next.copyBorderTop) return false;
  if (prev.copyBorderRight !== next.copyBorderRight) return false;
  if (prev.copyBorderBottom !== next.copyBorderBottom) return false;
  if (prev.copyBorderLeft !== next.copyBorderLeft) return false;
  if (prev.cell !== next.cell) return false;
  if (prev.span !== next.span) return false;
  return true;
});

// ── Spreadsheet Grid ──────────────────────────────────────────────────────────
export function SpreadsheetGrid({ data, onChange }: { data: SheetData; onChange: (d: SheetData) => void }) {
  const { rows, cols, colWidths, merges } = data;

  const [selStart, setSelStart] = useState<[number,number]|null>(null);
  const [selEnd, setSelEnd]     = useState<[number,number]|null>(null);
  const [editing, setEditing]   = useState(false);
  // editVal을 state에서 제거 → uncontrolled input으로 타이핑 시 재렌더 없앰
  const [editKey, setEditKey]   = useState(0);
  const editInitVal             = useRef('');

  const [fsSizeOpen, setFsSizeOpen]   = useState(false);
  const [fsSizeInput, setFsSizeInput] = useState('13');
  const fsDropRef = useRef<HTMLDivElement>(null);

  const [copyRange, setCopyRange] = useState<Rng|null>(null);

  const containerRef   = useRef<HTMLDivElement>(null);
  const tableRef       = useRef<HTMLTableElement>(null);
  // 선택 하이라이트 DOM 직접 관리 (React 재렌더 없이)
  const cellElMap      = useRef<Map<string, HTMLTableCellElement>>(new Map());
  const prevDragRange  = useRef<Rng | null>(null);
  const selEndDragRef  = useRef<[number,number] | null>(null);
  const rafDragId      = useRef<number>(0);
  const inputRef       = useRef<HTMLInputElement>(null);
  const dragging       = useRef(false);
  const fsRef          = useRef<HTMLDivElement>(null);
  const clipboardRef   = useRef<{
    rows: number; cols: number;
    cells: Record<string, CellData>;
    merges: Record<string, MergeInfo>;
  } | null>(null);

  // Stable refs for use inside callbacks
  const selStartRef = useRef(selStart);
  const selEndRef   = useRef(selEnd);
  const editingRef  = useRef(editing);
  const dataRef     = useRef(data);
  const onChangeRef = useRef(onChange);
  useEffect(() => { selStartRef.current = selStart; }, [selStart]);
  useEffect(() => { selEndRef.current = selEnd; }, [selEnd]);
  useEffect(() => { editingRef.current = editing; }, [editing]);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Undo / Redo history
  const historyRef    = useRef<SheetData[]>([]);
  const historyIdxRef = useRef(-1);

  const recordChange = useCallback((newData: SheetData) => {
    if (historyIdxRef.current === -1) {
      historyRef.current = [JSON.parse(JSON.stringify(dataRef.current))];
      historyIdxRef.current = 0;
    }
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(JSON.parse(JSON.stringify(newData)));
    if (historyRef.current.length > 100) historyRef.current.shift();
    else historyIdxRef.current++;
    onChangeRef.current(newData);
  }, []);

  const range = getRange(selStart, selEnd);
  const colW = (c: number) => colWidths[c] ?? DCW;

  // Merge maps
  const { hidden, spanMap } = useMemo(() => {
    const hidden: Record<string, string> = {};
    const spanMap: Record<string, { rowSpan: number; colSpan: number }> = {};
    for (const [k, m] of Object.entries(merges)) {
      const [r, c] = k.split(',').map(Number);
      spanMap[k] = { rowSpan: m.rows, colSpan: m.cols };
      for (let dr = 0; dr < m.rows; dr++)
        for (let dc = 0; dc < m.cols; dc++)
          if (dr || dc) hidden[ck(r+dr, c+dc)] = k;
    }
    return { hidden, spanMap };
  }, [merges]);

  const hiddenRef = useRef(hidden);
  useEffect(() => { hiddenRef.current = hidden; }, [hidden]);

  // Active style (from selStart cell)
  const activeStyle = useMemo((): CellStyle => {
    if (!selStart) return {};
    const k = ck(selStart[0], selStart[1]);
    const parentKey = hidden[k] ?? k;
    return norm(data.cells[parentKey]).s ?? {};
  }, [selStart, hidden, data.cells]);

  useEffect(() => { setFsSizeInput(String(activeStyle.fontSize ?? 13)); }, [activeStyle.fontSize]);

  // commitEdit reads from inputRef (uncontrolled)
  const commitEdit = useCallback(() => {
    if (!editingRef.current || !selStartRef.current) return;
    const [r, c] = selStartRef.current;
    const k = ck(r, c);
    const d = dataRef.current;
    const cell = norm(d.cells[k]);
    const val = inputRef.current?.value ?? '';
    const newCells = { ...d.cells };
    if (!val && !cell.s) delete newCells[k];
    else newCells[k] = { ...cell, v: val || undefined };
    recordChange({ ...d, cells: newCells });
    setEditing(false);
    editingRef.current = false;
    containerRef.current?.focus({ preventScroll: true });
  }, [recordChange]);

  const handleEscape = useCallback(() => {
    setEditing(false);
    editingRef.current = false;
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  const handleMoveAfterEdit = useCallback((r: number, c: number, dr: number, dc: number) => {
    const d = dataRef.current;
    const nr = Math.min(r + dr, d.rows - 1);
    const nc = Math.min(c + dc, d.cols - 1);
    setSelStart([nr, nc]);
    setSelEnd(null);
    // 다음 셀에서 바로 편집 모드 진입 → IME 한국어 모드 유지
    editInitVal.current = norm(d.cells[ck(nr, nc)]).v ?? '';
    setEditKey(k => k + 1);
    flushSync(() => { setEditing(true); editingRef.current = true; });
    inputRef.current?.focus();
  }, []);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  // 언마운트 시 진행 중인 셀 편집을 강제 커밋
  useEffect(() => {
    return () => {
      if (editingRef.current && selStartRef.current) {
        const [r, c] = selStartRef.current;
        const k = ck(r, c);
        const d = dataRef.current;
        const cell = norm(d.cells[k]);
        const val = inputRef.current?.value ?? '';
        const newCells = { ...d.cells };
        if (!val && !cell.s) delete newCells[k];
        else newCells[k] = { ...cell, v: val || undefined };
        onChangeRef.current({ ...d, cells: newCells });
      }
    };
  }, []);

  // Apply style to selection
  const applyStyle = useCallback((style: Partial<CellStyle>) => {
    const rng = getRange(selStartRef.current, selEndRef.current);
    if (!rng) return;
    const d = dataRef.current;
    const newCells = { ...d.cells };
    for (let r = rng.r1; r <= rng.r2; r++) {
      for (let c = rng.c1; c <= rng.c2; c++) {
        if (hiddenRef.current[ck(r, c)]) continue;
        const k = ck(r, c);
        const cell = norm(newCells[k]);
        const ns: CellStyle = { ...cell.s, ...style };
        (Object.keys(ns) as (keyof CellStyle)[]).forEach(key => { if (ns[key] === undefined) delete ns[key]; });
        newCells[k] = { ...cell, s: Object.keys(ns).length ? ns : undefined };
      }
    }
    recordChange({ ...d, cells: newCells });
  }, [recordChange]);

  // Merge
  const mergeCells = useCallback(() => {
    const rng = getRange(selStartRef.current, selEndRef.current);
    if (!rng || (rng.r1 === rng.r2 && rng.c1 === rng.c2)) return;
    const d = dataRef.current;
    const vals: string[] = [];
    for (let r = rng.r1; r <= rng.r2; r++)
      for (let c = rng.c1; c <= rng.c2; c++) { const v = norm(d.cells[ck(r,c)]).v; if (v) vals.push(v); }
    const newMerges = removeOverlap(d.merges, rng);
    newMerges[ck(rng.r1, rng.c1)] = { rows: rng.r2-rng.r1+1, cols: rng.c2-rng.c1+1 };
    const newCells = { ...d.cells };
    for (let r = rng.r1; r <= rng.r2; r++)
      for (let c = rng.c1; c <= rng.c2; c++) {
        const k = ck(r, c);
        if (r === rng.r1 && c === rng.c1) { const cell = norm(newCells[k]); newCells[k] = { ...cell, v: vals[0] ?? cell.v }; }
        else delete newCells[k];
      }
    recordChange({ ...d, cells: newCells, merges: newMerges });
    setSelEnd(null);
  }, [recordChange]);

  // Unmerge
  const unmergeCells = useCallback(() => {
    if (!selStartRef.current) return;
    const k = ck(selStartRef.current[0], selStartRef.current[1]);
    const d = dataRef.current;
    const parentKey = d.merges[k] ? k : hiddenRef.current[k];
    if (!parentKey) return;
    const newMerges = { ...d.merges };
    delete newMerges[parentKey];
    recordChange({ ...d, merges: newMerges });
  }, [recordChange]);

  const canMerge = !!(range && (range.r1 !== range.r2 || range.c1 !== range.c2));
  const canUnmerge = !!(selStart && (merges[ck(selStart[0], selStart[1])] || hidden[ck(selStart[0], selStart[1])]));

  // Cell address for formula bar
  const cellAddress = useMemo(() => {
    if (!selStart) return '';
    const [r, c] = selStart;
    const k = ck(r, c);
    const pk = hidden[k] ?? k;
    const m = merges[pk];
    if (m) {
      const [pr, pc] = pk.split(',').map(Number);
      return `${colLabel(pc)}${pr+1}:${colLabel(pc+m.cols-1)}${pr+m.rows}`;
    }
    return `${colLabel(c)}${r+1}`;
  }, [selStart, hidden, merges]);

  const cellValue = selStart ? (norm(data.cells[hidden[ck(selStart[0],selStart[1])] ?? ck(selStart[0],selStart[1])]).v ?? '') : '';

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const s = selStartRef.current;
    if (!s) return;
    const [r, c] = s;
    const d = dataRef.current;

    if ((e.ctrlKey || e.metaKey) && !editingRef.current) {
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (historyIdxRef.current > 0) {
          historyIdxRef.current--;
          onChangeRef.current(JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current])));
        }
        return;
      }
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        if (historyIdxRef.current < historyRef.current.length - 1) {
          historyIdxRef.current++;
          onChangeRef.current(JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current])));
        }
        return;
      }
      if (e.key === 'b' || e.key === 'B') { e.preventDefault(); applyStyle({ bold: !activeStyle.bold }); return; }
      if (e.key === 'i' || e.key === 'I') { e.preventDefault(); applyStyle({ italic: !activeStyle.italic }); return; }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        const rng = getRange(selStartRef.current, selEndRef.current);
        if (!rng) return;
        const copyCells: Record<string, CellData> = {};
        const copyMerges: Record<string, MergeInfo> = {};
        for (let rr = rng.r1; rr <= rng.r2; rr++)
          for (let cc = rng.c1; cc <= rng.c2; cc++) {
            const src = ck(rr, cc);
            if (d.cells[src]) copyCells[ck(rr - rng.r1, cc - rng.c1)] = { ...d.cells[src] };
          }
        for (const [k, m] of Object.entries(d.merges)) {
          const [mr, mc] = k.split(',').map(Number);
          if (mr >= rng.r1 && mr <= rng.r2 && mc >= rng.c1 && mc <= rng.c2)
            copyMerges[ck(mr - rng.r1, mc - rng.c1)] = { ...m };
        }
        clipboardRef.current = { rows: rng.r2-rng.r1+1, cols: rng.c2-rng.c1+1, cells: copyCells, merges: copyMerges };
        setCopyRange(rng);
        const lines: string[] = [];
        for (let rr = 0; rr < rng.r2-rng.r1+1; rr++)
          lines.push(Array.from({ length: rng.c2-rng.c1+1 }, (_, cc) => norm(copyCells[ck(rr,cc)]).v ?? '').join('\t'));
        navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
        return;
      }

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        const origin = selStartRef.current;
        if (!origin) return;
        const [pr, pc] = origin;

        if (clipboardRef.current) {
          const { rows: cbRows, cols: cbCols, cells: cbCells, merges: cbMerges } = clipboardRef.current;
          const newCells = { ...d.cells };
          const newMerges = removeOverlap(d.merges, { r1: pr, c1: pc, r2: pr+cbRows-1, c2: pc+cbCols-1 });
          for (let dr = 0; dr < cbRows; dr++)
            for (let dc = 0; dc < cbCols; dc++) {
              if (pr+dr >= d.rows || pc+dc >= d.cols) continue;
              const dst = ck(pr+dr, pc+dc);
              const src = ck(dr, dc);
              if (cbCells[src]) newCells[dst] = { ...cbCells[src] };
              else delete newCells[dst];
            }
          for (const [k, m] of Object.entries(cbMerges)) {
            const [mr, mc] = k.split(',').map(Number);
            if (pr+mr < d.rows && pc+mc < d.cols)
              newMerges[ck(pr+mr, pc+mc)] = { ...m };
          }
          recordChange({ ...d, cells: newCells, merges: newMerges });
          setCopyRange(null);
        } else {
          navigator.clipboard.readText().then(text => {
            if (!text) return;
            const lines = text.split('\n').map(l => l.split('\t'));
            const nd = dataRef.current;
            const newCells = { ...nd.cells };
            lines.forEach((row, dr) => row.forEach((val, dc) => {
              if (pr+dr >= nd.rows || pc+dc >= nd.cols) return;
              const dst = ck(pr+dr, pc+dc);
              const existing = norm(newCells[dst]);
              if (val) newCells[dst] = { ...existing, v: val };
              else if (existing.s) newCells[dst] = { s: existing.s };
              else delete newCells[dst];
            }));
            recordChange({ ...nd, cells: newCells });
          }).catch(() => {});
        }
        return;
      }
    }

    if (editingRef.current) {
      if (e.key === 'Enter') { if (e.isComposing) return; e.preventDefault(); commitEdit(); setSelStart([Math.min(r+1, rows-1), c]); setSelEnd(null); }
      else if (e.key === 'Escape') { setEditing(false); editingRef.current = false; setCopyRange(null); clipboardRef.current = null; }
      else if (e.key === 'Tab') { e.preventDefault(); commitEdit(); setSelStart([r, Math.min(c+1, cols-1)]); setSelEnd(null); }
      return;
    }

    if (e.key === 'Escape') { setCopyRange(null); clipboardRef.current = null; return; }

    const move = (nr: number, nc: number) => { setSelStart([nr, nc]); setSelEnd(null); };
    const extend = (dr: number, dc: number) => {
      const cur = selEndRef.current ?? s;
      setSelEnd([Math.max(0, Math.min(rows-1, cur[0]+dr)), Math.max(0, Math.min(cols-1, cur[1]+dc))]);
    };

    if (e.key === 'ArrowUp')    { e.preventDefault(); e.shiftKey ? extend(-1,0) : move(Math.max(r-1,0), c); }
    else if (e.key === 'ArrowDown')  { e.preventDefault(); e.shiftKey ? extend(1,0) : move(Math.min(r+1,rows-1), c); }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); e.shiftKey ? extend(0,-1) : move(r, Math.max(c-1,0)); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.shiftKey ? extend(0,1) : move(r, Math.min(c+1,cols-1)); }
    else if (e.key === 'Tab')        { e.preventDefault(); move(r, Math.min(c+1, cols-1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      editInitVal.current = norm(dataRef.current.cells[ck(r,c)]).v ?? '';
      setEditKey(k => k + 1);
      setEditing(true); editingRef.current = true;
    }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const rng = getRange(s, selEndRef.current);
      if (!rng) return;
      const newCells = { ...d.cells };
      for (let rr = rng.r1; rr <= rng.r2; rr++)
        for (let cc = rng.c1; cc <= rng.c2; cc++) {
          const k = ck(rr, cc);
          if (hiddenRef.current[k]) continue;
          const cell = norm(newCells[k]);
          if (cell.s) newCells[k] = { s: cell.s };
          else delete newCells[k];
        }
      recordChange({ ...d, cells: newCells });
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.isComposing) {
      e.preventDefault();
      editInitVal.current = e.key;
      setEditKey(k => k + 1);
      setSelEnd(null);
      flushSync(() => { setEditing(true); });
      inputRef.current?.focus();
    }
  }, [activeStyle, applyStyle, commitEdit, rows, cols, recordChange]);

  // 이벤트 위임 — tbody 하나의 핸들러로 모든 셀 이벤트 처리 (셀별 콜백 2600개 생성 방지)
  const onTbodyMouseDown = useCallback((e: React.MouseEvent<HTMLTableSectionElement>) => {
    const td = (e.target as Element).closest('td[data-row]') as HTMLElement | null;
    if (!td) return;
    const r = Number(td.dataset.row);
    const c = Number(td.dataset.col);
    e.preventDefault();
    if (editingRef.current) commitEdit();
    containerRef.current?.focus({ preventScroll: true });
    if (e.shiftKey && selStartRef.current) { setSelEnd([r, c]); return; }
    setSelStart([r, c]); setSelEnd(null); setEditing(false); editingRef.current = false;
    dragging.current = true;
  }, [commitEdit]);

  const onTbodyDblClick = useCallback((e: React.MouseEvent<HTMLTableSectionElement>) => {
    const td = (e.target as Element).closest('td[data-row]') as HTMLElement | null;
    if (!td) return;
    const r = Number(td.dataset.row);
    const c = Number(td.dataset.col);
    const k = ck(r, c);
    if (hiddenRef.current[k]) return;
    setSelStart([r, c]); setSelEnd(null);
    editInitVal.current = norm(dataRef.current.cells[k]).v ?? '';
    setEditKey(prev => prev + 1);
    setEditing(true); editingRef.current = true;
  }, []);

  // 테이블 초기 렌더 후 td 요소 맵 구축 (O(1) 선택 DOM 접근용)
  useEffect(() => {
    const tbody = tableRef.current?.querySelector('tbody');
    if (!tbody) return;
    cellElMap.current.clear();
    (tbody.querySelectorAll('td[data-row]') as NodeListOf<HTMLTableCellElement>).forEach(td => {
      cellElMap.current.set(`${td.dataset.row},${td.dataset.col}`, td);
    });
  }, [rows, cols]);

  // 선택 범위 하이라이트 DOM 직접 적용 (React 재렌더 없음)
  const applySelDOM = useCallback((rng: Rng | null, start: [number,number] | null, prev: Rng | null) => {
    const map = cellElMap.current;
    if (prev) {
      for (let r = prev.r1; r <= prev.r2; r++)
        for (let c = prev.c1; c <= prev.c2; c++)
          (map.get(`${r},${c}`) ?? null)?.style.setProperty('box-shadow', '');
    }
    if (rng) {
      for (let r = rng.r1; r <= rng.r2; r++)
        for (let c = rng.c1; c <= rng.c2; c++) {
          if (start?.[0] === r && start?.[1] === c) continue;
          (map.get(`${r},${c}`) ?? null)?.style.setProperty('box-shadow', 'inset 0 0 0 9999px rgba(219,234,254,0.55)');
        }
    }
  }, []);

  const onTbodyMouseOver = useCallback((e: React.MouseEvent<HTMLTableSectionElement>) => {
    if (!dragging.current) return;
    const td = (e.target as Element).closest('td[data-row]') as HTMLElement | null;
    if (!td) return;
    const nr = Number(td.dataset.row);
    const nc = Number(td.dataset.col);
    const cur = selEndDragRef.current;
    if (cur && cur[0] === nr && cur[1] === nc) return;
    selEndDragRef.current = [nr, nc];
    cancelAnimationFrame(rafDragId.current);
    rafDragId.current = requestAnimationFrame(() => {
      const rng = getRange(selStartRef.current, selEndDragRef.current);
      applySelDOM(rng, selStartRef.current, prevDragRange.current);
      prevDragRange.current = rng;
    });
  }, [applySelDOM]);

  // 비드래그 선택 변경(클릭, Shift+화살표) → useEffect로 DOM 반영
  useEffect(() => {
    const map = cellElMap.current;
    map.forEach(td => td.style.setProperty('box-shadow', ''));
    if (range) {
      for (let r = range.r1; r <= range.r2; r++)
        for (let c = range.c1; c <= range.c2; c++) {
          if (selStart?.[0] === r && selStart?.[1] === c) continue;
          (map.get(`${r},${c}`) ?? null)?.style.setProperty('box-shadow', 'inset 0 0 0 9999px rgba(219,234,254,0.55)');
        }
    }
    prevDragRange.current = range;
  }, [range, selStart]);

  useEffect(() => {
    const up = () => {
      dragging.current = false;
      if (selEndDragRef.current) {
        setSelEnd(selEndDragRef.current);
        selEndDragRef.current = null;
        prevDragRange.current = null;
      }
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // Font size dropdown close
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (fsRef.current?.contains(e.target as Node)) return;
      if (fsDropRef.current?.contains(e.target as Node)) return;
      setFsSizeOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Column resize — 드래그 중 DOM 직접 조작, mouseup 시에만 state 반영
  const onResizeStart = (e: React.MouseEvent, col: number) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = colW(col);
    // colgroup의 col 요소: 0번은 행 헤더, 1번부터 데이터 열
    const colEl = tableRef.current?.querySelectorAll('col')[col + 1] as HTMLElement | undefined;
    const onMove = (mv: MouseEvent) => {
      const nw = Math.max(40, startW + mv.clientX - startX);
      if (colEl) colEl.style.width = `${nw}px`;
    };
    const onUp = (mv: MouseEvent) => {
      const nw = Math.max(40, startW + mv.clientX - startX);
      onChangeRef.current({ ...dataRef.current, colWidths: { ...dataRef.current.colWidths, [col]: nw } });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const sep = <div className="w-px h-5 bg-gray-200 mx-0.5 flex-shrink-0" />;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 flex items-center gap-0.5 px-3 h-10 border-b border-gray-200 bg-white overflow-x-auto">
        <button onClick={() => applyStyle({ bold: !activeStyle.bold })}
          className={cn('px-1.5 py-1 rounded text-sm font-bold hover:bg-gray-100 flex-shrink-0', activeStyle.bold && 'bg-primary-100 text-gray-800')}
          title="굵게 (Ctrl+B)"><Bold size={14} /></button>
        <button onClick={() => applyStyle({ italic: !activeStyle.italic })}
          className={cn('px-1.5 py-1 rounded text-sm italic hover:bg-gray-100 flex-shrink-0', activeStyle.italic && 'bg-primary-100 text-gray-800')}
          title="기울임 (Ctrl+I)"><Italic size={14} /></button>

        {sep}

        <div ref={fsRef} className="relative flex-shrink-0">
          <div className="flex items-center border border-gray-200 rounded overflow-hidden h-7">
            <input value={fsSizeInput} onChange={e => setFsSizeInput(e.target.value)}
              onBlur={() => { const n = parseInt(fsSizeInput); if (n >= 6 && n <= 96) applyStyle({ fontSize: n }); else setFsSizeInput(String(activeStyle.fontSize ?? 13)); }}
              onKeyDown={e => { if (e.key === 'Enter') { const n = parseInt(fsSizeInput); if (n >= 6 && n <= 96) applyStyle({ fontSize: n }); (e.target as HTMLInputElement).blur(); } }}
              className="w-10 text-xs text-center outline-none" />
            <button onClick={() => setFsSizeOpen(v => !v)} className="px-0.5 border-l border-gray-200 hover:bg-gray-100 h-full flex items-center">
              <ChevronDown size={10} /></button>
          </div>
          {fsSizeOpen && fsRef.current && createPortal(
            <div ref={fsDropRef}
              className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-[56px]"
              style={{ top: fsRef.current.getBoundingClientRect().bottom + 4, left: fsRef.current.getBoundingClientRect().left }}>
              {FONT_SIZES.map(sz => (
                <button key={sz} onClick={() => { applyStyle({ fontSize: sz }); setFsSizeOpen(false); }}
                  className={cn('w-full px-3 py-1 text-xs text-left hover:bg-gray-50', activeStyle.fontSize === sz && 'bg-primary-50 text-gray-800')}>{sz}</button>
              ))}
            </div>,
            document.body
          )}
        </div>

        {sep}

        <ColorSwatch colors={TEXT_COLORS} value={activeStyle.color} onChange={c => applyStyle({ color: c })} label="글자 색상"
          preview={<span className="text-xs font-bold leading-none" style={{ color: activeStyle.color ?? '#0f172a', borderBottom: `2px solid ${activeStyle.color ?? '#0f172a'}` }}>A</span>} />

        <ColorSwatch colors={BG_COLORS} value={activeStyle.bg} onChange={c => applyStyle({ bg: c })} label="배경 색상"
          preview={
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs leading-none">🎨</span>
              <div className="w-4 h-1 rounded-sm border border-gray-200" style={{ backgroundColor: activeStyle.bg ?? '#ffffff' }} />
            </div>
          } />

        {sep}

        <button onClick={() => applyStyle({ align: 'left' })}
          className={cn('p-1.5 rounded hover:bg-gray-100 flex-shrink-0', activeStyle.align === 'left' && 'bg-primary-100 text-gray-800')}
          title="왼쪽 정렬"><AlignLeft size={14} /></button>
        <button onClick={() => applyStyle({ align: 'center' })}
          className={cn('p-1.5 rounded hover:bg-gray-100 flex-shrink-0', activeStyle.align === 'center' && 'bg-primary-100 text-gray-800')}
          title="가운데 정렬"><AlignCenter size={14} /></button>
        <button onClick={() => applyStyle({ align: 'right' })}
          className={cn('p-1.5 rounded hover:bg-gray-100 flex-shrink-0', activeStyle.align === 'right' && 'bg-primary-100 text-gray-800')}
          title="오른쪽 정렬"><AlignRight size={14} /></button>

        {sep}

        <button onClick={mergeCells} disabled={!canMerge}
          className="px-2 py-1 text-xs rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 font-medium whitespace-nowrap flex-shrink-0"
          title="선택 범위 병합">셀 병합</button>
        <button onClick={unmergeCells} disabled={!canUnmerge}
          className="px-2 py-1 text-xs rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 font-medium whitespace-nowrap flex-shrink-0"
          title="병합 해제">병합 해제</button>
      </div>

      {/* ── Formula bar ── */}
      <div className="flex-shrink-0 flex items-center h-7 border-b border-gray-200 bg-gray-50 px-2 gap-2">
        <span className="text-[11px] text-gray-500 font-mono w-16 text-center border-r border-gray-200 pr-2 flex-shrink-0">{cellAddress}</span>
        <span className="text-sm text-gray-600 truncate">{cellValue}</span>
      </div>

      {/* ── Grid ── */}
      <div
        ref={containerRef}
        tabIndex={0}
        className="flex-1 overflow-auto outline-none"
        onKeyDown={handleKeyDown}
      >
        <table ref={tableRef} className="border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: CHW }} />
            {Array.from({ length: cols }, (_, c) => <col key={c} style={{ width: colW(c) }} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 bg-gray-50 border border-gray-200 text-xs text-gray-400"
                style={{ width: CHW, height: RH }} />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c}
                  className={cn('sticky top-0 z-20 bg-gray-50 border border-gray-200 text-xs font-medium text-gray-500 relative select-none',
                    range && c >= range.c1 && c <= range.c2 && 'bg-primary-50 text-gray-800')}
                  style={{ height: RH }}>
                  {colLabel(c)}
                  <span className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary-400 opacity-0 hover:opacity-100 z-10"
                    onMouseDown={e => onResizeStart(e, c)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody onMouseDown={onTbodyMouseDown} onMouseOver={onTbodyMouseOver} onDoubleClick={onTbodyDblClick}>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <td className={cn('sticky left-0 z-10 bg-gray-50 border border-gray-200 text-xs text-gray-400 font-medium text-center select-none',
                  range && r >= range.r1 && r <= range.r2 && 'bg-primary-50 text-gray-800')}
                  style={{ width: CHW, height: RH }}>{r + 1}</td>

                {Array.from({ length: cols }, (_, c) => {
                  const k = ck(r, c);
                  if (hidden[k]) return null;
                  const isAnchor = selStart?.[0] === r && selStart?.[1] === c;
                  const isCopy   = inRng(r, c, copyRange);
                  const cell     = norm(data.cells[k]);
                  const span     = spanMap[k] ?? { rowSpan: 1, colSpan: 1 };
                  return (
                    <MemoCell
                      key={c}
                      r={r} c={c}
                      cell={cell}
                      span={span}
                      isAnchor={!!isAnchor}
                      isEditing={!!isAnchor && editing}
                      editKey={editKey}
                      editInitVal={editInitVal.current}
                      isCopy={isCopy}
                      copyBorderTop={isCopy && r === copyRange!.r1 ? '2px dashed #3b82f6' : undefined}
                      copyBorderRight={isCopy && c === copyRange!.c2 ? '2px dashed #3b82f6' : undefined}
                      copyBorderBottom={isCopy && r === copyRange!.r2 ? '2px dashed #3b82f6' : undefined}
                      copyBorderLeft={isCopy && c === copyRange!.c1 ? '2px dashed #3b82f6' : undefined}
                      inputRef={inputRef}
                      rows={rows} cols={cols}
                      onCommit={commitEdit}
                      onEscape={handleEscape}
                      onMoveAfterEdit={handleMoveAfterEdit}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sheet Editor Page ─────────────────────────────────────────────────────────
export function SheetEditorPage() {
  const { projectId, sheetId } = useParams<{ projectId: string; sheetId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [sheetData, setSheetData] = useState<SheetData>(emptyData());
  const [showNewSheet, setShowNewSheet] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');
  const [renamingId, setRenamingId] = useState<string|null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const sheetDataRef = useRef<SheetData>(emptyData());
  const dataLoadedRef = useRef(false);

  const { data: sheets = [] } = useQuery({
    queryKey: ['sheets', projectId],
    queryFn: () => sheetsApi.list(projectId!),
    enabled: !!projectId,
  });

  const { data: rawSheet } = useQuery({
    queryKey: ['sheet', projectId, sheetId],
    queryFn: () => sheetsApi.get(projectId!, sheetId!),
    enabled: !!projectId && !!sheetId,
    staleTime: 10_000,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (rawSheet?.data) {
      const d = rawSheet.data as any;
      const parsed: SheetData = {
        cells: d.cells ?? {},
        rows: d.rows ?? DROWS,
        cols: d.cols ?? DCOLS,
        colWidths: d.colWidths ?? {},
        merges: d.merges ?? {},
      };
      setSheetData(parsed);
      sheetDataRef.current = parsed;
      dataLoadedRef.current = true;
    } else if (rawSheet) {
      setSheetData(emptyData());
    }
  }, [rawSheet]);

  const saveMutation = useMutation({
    mutationFn: (d: SheetData) => sheetsApi.save(projectId!, sheetId!, d),
    onMutate: () => setSaving(true),
    onSettled: () => setSaving(false),
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const handleChange = useCallback((d: SheetData) => {
    setSheetData(d);
    sheetDataRef.current = d;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveMutation.mutate(d), 500);
  }, [sheetId]);

  const flushSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    if (!dataLoadedRef.current || !projectId || !sheetId) return;
    const latest = sheetDataRef.current;
    qc.setQueryData(['sheet', projectId, sheetId], (old: any) =>
      old ? { ...old, data: latest } : old);
    sheetsApi.save(projectId, sheetId, latest).catch((e) => console.error('시트 저장 실패', e));
  }, [projectId, sheetId, qc]);

  useEffect(() => {
    return () => { flushSave(); };
  }, [flushSave]);

  useEffect(() => {
    const onHide = () => {
      clearTimeout(saveTimer.current);
      if (!dataLoadedRef.current || !projectId || !sheetId) return;
      const token = localStorage.getItem('accessToken');
      try {
        fetch(`/api/projects/${projectId}/sheets/${sheetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ data: sheetDataRef.current }),
          keepalive: true,
        });
      } catch { /* noop */ }
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [projectId, sheetId]);

  const switchSheet = (id: string) => {
    if (id === sheetId) return;
    flushSave();
    navigate(`/projects/${projectId}/sheet/${id}`);
  };

  const createSheet = useMutation({
    mutationFn: (name: string) => sheetsApi.create(projectId!, name),
    onSuccess: (sheet) => {
      qc.invalidateQueries({ queryKey: ['sheets', projectId] });
      setShowNewSheet(false); setNewSheetName('');
      navigate(`/projects/${projectId}/sheet/${sheet.id}`);
    },
    onError: () => toast.error('시트 생성에 실패했습니다.'),
  });

  const deleteSheet = useMutation({
    mutationFn: (id: string) => sheetsApi.remove(projectId!, id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['sheets', projectId] });
      if (id === sheetId) {
        const rem = sheets.filter((s: any) => s.id !== id);
        navigate(rem.length > 0 ? `/projects/${projectId}/sheet/${rem[0].id}` : '/sheets');
      }
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  });

  const renameSheet = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => sheetsApi.rename(projectId!, id, name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sheets', projectId] }); setRenamingId(null); },
    onError: () => toast.error('이름 변경에 실패했습니다.'),
  });

  const currentSheet = sheets.find((s: any) => s.id === sheetId);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    for (const sheet of sheets) {
      const isActive = sheet.id === sheetId;
      const d: SheetData = isActive ? sheetData : emptyData();

      const keys = Object.keys(d.cells);
      if (keys.length === 0 && !isActive) {
        const ws = XLSX.utils.aoa_to_sheet([[]]);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
        continue;
      }

      let maxR = 0, maxC = 0;
      keys.forEach(k => {
        const [r, c] = k.split(',').map(Number);
        if (r > maxR) maxR = r;
        if (c > maxC) maxC = c;
      });

      const aoa: any[][] = Array.from({ length: maxR + 1 }, () => Array(maxC + 1).fill(''));
      keys.forEach(k => {
        const [r, c] = k.split(',').map(Number);
        aoa[r][c] = norm(d.cells[k]).v ?? '';
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      ws['!cols'] = Array.from({ length: maxC + 1 }, (_, c) => ({
        wch: Math.round((d.colWidths[c] ?? DCW) / 7),
      }));

      ws['!merges'] = Object.entries(d.merges).map(([k, m]) => {
        const [r, c] = k.split(',').map(Number);
        return { s: { r, c }, e: { r: r + m.rows - 1, c: c + m.cols - 1 } };
      });

      keys.forEach(k => {
        const [r, c] = k.split(',').map(Number);
        const cell = norm(d.cells[k]);
        const s = cell.s;
        if (!s) return;
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) return;
        const hexToArgb = (hex?: string) => hex ? 'FF' + hex.replace('#', '').toUpperCase().padStart(6, '0') : undefined;
        ws[addr].s = {
          fill: s.bg ? { patternType: 'solid', fgColor: { rgb: hexToArgb(s.bg) } } : undefined,
          font: {
            bold: s.bold ?? false,
            italic: s.italic ?? false,
            color: s.color ? { rgb: hexToArgb(s.color) } : undefined,
            sz: s.fontSize ?? 11,
          },
          alignment: {
            horizontal: s.align ?? 'left',
            vertical: 'center',
            wrapText: false,
          },
        };
      });

      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }

    const filename = `${currentSheet?.name ?? '시트'}.xlsx`;
    XLSX.writeFile(wb, filename, { bookType: 'xlsx', cellStyles: true });
    toast.success(`${filename} 다운로드 완료`);
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 h-11 border-b border-gray-200 bg-white">
        <button onClick={() => navigate('/sheets')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors flex-shrink-0">
          <ArrowLeft size={15} /><span className="text-xs">시트 목록</span>
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <Table2 size={14} className="text-emerald-500 flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-800 truncate">{currentSheet?.name ?? '...'}</span>
        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          <span className="text-[11px] text-gray-400">{saving ? '저장 중...' : '자동 저장'}</span>
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-primary-600 bg-white hover:bg-primary-50 border border-gray-200 hover:border-primary-300 px-3 py-1.5 rounded-lg transition-colors"
            title="Excel 파일로 다운로드"
          >
            <Download size={13} />
            엑셀 다운로드
          </button>
        </div>
      </div>

      <SpreadsheetGrid data={sheetData} onChange={handleChange} />

      <div className="flex-shrink-0 flex items-center border-t border-gray-200 bg-gray-50 h-9 px-2 gap-0.5 overflow-x-auto">
        {sheets.map((sheet: any) => (
          <div key={sheet.id}
            className={cn('group relative flex items-center gap-1 px-3 h-7 rounded-t text-xs font-medium cursor-pointer whitespace-nowrap border border-b-0 transition-colors',
              sheet.id === sheetId ? 'bg-white text-emerald-700 border-gray-300 shadow-sm' : 'bg-transparent text-gray-500 border-transparent hover:bg-white hover:text-gray-600')}
            onClick={() => switchSheet(sheet.id)}
            onDoubleClick={() => { setRenamingId(sheet.id); setRenameVal(sheet.name); }}>
            {renamingId === sheet.id ? (
              <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter') renameSheet.mutate({id:sheet.id,name:renameVal||sheet.name}); if (e.key==='Escape') setRenamingId(null); e.stopPropagation(); }}
                onBlur={() => renameSheet.mutate({id:sheet.id,name:renameVal||sheet.name})}
                onClick={e => e.stopPropagation()}
                className="w-24 text-xs border border-emerald-400 rounded px-1 outline-none bg-white" />
            ) : <span>{sheet.name}</span>}
            {sheets.length > 1 && (
              <button onClick={e => { e.stopPropagation(); if (confirm(`"${sheet.name}"을 삭제하시겠습니까?`)) deleteSheet.mutate(sheet.id); }}
                className="hidden group-hover:flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-red-100 hover:text-red-500 text-gray-400">
                <X size={9} />
              </button>
            )}
          </div>
        ))}

        {showNewSheet ? (
          <div className="flex items-center gap-1 ml-1">
            <input autoFocus value={newSheetName} onChange={e => setNewSheetName(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter'&&newSheetName.trim()) createSheet.mutate(newSheetName.trim()); if (e.key==='Escape') {setShowNewSheet(false);setNewSheetName('');} }}
              placeholder="시트 이름" className="w-24 h-6 text-xs border border-emerald-400 rounded px-2 outline-none" />
            <button onClick={() => newSheetName.trim() && createSheet.mutate(newSheetName.trim())}
              className="flex items-center justify-center w-6 h-6 rounded bg-emerald-600 text-white hover:bg-emerald-700"><Check size={11} /></button>
            <button onClick={() => {setShowNewSheet(false);setNewSheetName('');}}
              className="flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:bg-gray-200"><X size={11} /></button>
          </div>
        ) : (
          <button onClick={() => setShowNewSheet(true)}
            className="flex items-center justify-center w-7 h-7 ml-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0"
            title="새 시트 추가"><Plus size={14} /></button>
        )}
      </div>
    </div>
  );
}
