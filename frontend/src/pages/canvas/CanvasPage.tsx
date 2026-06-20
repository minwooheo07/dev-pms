import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { canvasApi } from '../../api/canvas';
import { usersApi } from '../../api/users';
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Connection, type NodeTypes, type Node,
  Panel, BackgroundVariant, MarkerType, NodeResizer,
  Handle, Position, useReactFlow, SelectionMode, PanOnScrollMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Square, Circle, Diamond, Type, Smile, Minus,
  Trash2, MousePointer2, Hand, ZoomIn, ZoomOut, ChevronLeft, Save,
  MessageSquare, Send, X, Undo2, Redo2,
  ImageIcon, Lock, Unlock, MagnetIcon, Tag, UserPlus,
  Table2, Plus as PlusIcon, Trash,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { cn } from '../../lib/utils';

const RESIZER_STYLE = { borderColor: '#e60012', borderWidth: 1 };

// ── 노드 공통 오버레이: 잠금·담당자 ──────────────────
function NodeOverlay({ data, selected }: { data: any; selected: boolean }) {
  const assignees: any[] = data.assignees ?? [];
  return (
    <>
      {data.locked && (
        <div className="absolute top-1 right-1 z-10 bg-white/80 rounded-full p-0.5 shadow-sm">
          <Lock size={9} className="text-gray-500" />
        </div>
      )}
      {assignees.length > 0 && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex -space-x-1 z-10">
          {assignees.slice(0, 3).map((u: any) => (
            <Avatar key={u.id} name={u.name} avatar={u.avatar} size="xs"
              className="ring-1 ring-white w-5 h-5 text-[8px]" />
          ))}
          {assignees.length > 3 && (
            <span className="w-5 h-5 rounded-full bg-gray-200 ring-1 ring-white text-[8px] font-bold text-gray-600 flex items-center justify-center">
              +{assignees.length - 3}
            </span>
          )}
        </div>
      )}
    </>
  );
}
const HANDLE_STYLE = {
  width: 10, height: 10, background: '#e60012', border: '2px solid #fff',
  borderRadius: '50%', boxShadow: '0 0 0 1px #e60012',
};

function NodeHandles() {
  return (
    <>
      <Handle id="t" type="target" position={Position.Top}    style={HANDLE_STYLE} />
      <Handle id="b" type="target" position={Position.Bottom} style={HANDLE_STYLE} />
      <Handle id="l" type="target" position={Position.Left}   style={HANDLE_STYLE} />
      <Handle id="r" type="target" position={Position.Right}  style={HANDLE_STYLE} />
      <Handle id="st" type="source" position={Position.Top}    style={{ ...HANDLE_STYLE, background: '#ff9090' }} />
      <Handle id="sb" type="source" position={Position.Bottom} style={{ ...HANDLE_STYLE, background: '#ff9090' }} />
      <Handle id="sl" type="source" position={Position.Left}   style={{ ...HANDLE_STYLE, background: '#ff9090' }} />
      <Handle id="sr" type="source" position={Position.Right}  style={{ ...HANDLE_STYLE, background: '#ff9090' }} />
    </>
  );
}

// ── 커스텀 노드: 사각형 ────────────────────────────
function RectNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label ?? '');
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing && taRef.current) { taRef.current.focus(); taRef.current.select(); } }, [editing]);
  const commit = () => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, label: draft } } : n));
    setEditing(false);
  };
  return (
    <>
      <NodeResizer isVisible={selected && !editing && !data.locked} minWidth={60} minHeight={40} handleStyle={{ width: 8, height: 8, borderRadius: 2 }} lineStyle={RESIZER_STYLE} />
      {!editing && <NodeHandles />}
      <NodeOverlay data={data} selected={selected} />
      <div
        style={{ backgroundColor: data.bg ?? '#ffe0e0', borderColor: data.border ?? '#e60012' }}
        className={cn('w-full h-full rounded-lg border-2 flex items-center justify-center shadow-sm', selected && !editing && 'ring-2 ring-primary-400 ring-offset-1')}
        onDoubleClick={(e) => { if (data.locked) return; e.stopPropagation(); setDraft(data.label ?? ''); setEditing(true); }}
      >
        {editing ? (
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && e.metaKey) commit(); }}
            className="nodrag nopan w-full h-full bg-transparent resize-none outline-none text-center p-2 text-sm font-medium"
            style={{ color: data.color ?? '#620007', fontSize: data.fontSize ?? 13 }}
          />
        ) : (
          <span style={{ color: data.color ?? '#620007', fontSize: data.fontSize ?? 13 }} className="font-medium text-center px-2 break-words whitespace-pre-wrap w-full text-center leading-tight cursor-default select-none">
            {data.label}
          </span>
        )}
      </div>
    </>
  );
}

// ── 커스텀 노드: 원 ────────────────────────────────
function CircleNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label ?? '');
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing && taRef.current) { taRef.current.focus(); taRef.current.select(); } }, [editing]);
  const commit = () => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, label: draft } } : n));
    setEditing(false);
  };
  return (
    <>
      <NodeResizer isVisible={selected && !editing && !data.locked} minWidth={50} minHeight={50} handleStyle={{ width: 8, height: 8, borderRadius: 2 }} lineStyle={RESIZER_STYLE} />
      {!editing && <NodeHandles />}
      <NodeOverlay data={data} selected={selected} />
      <div
        style={{ backgroundColor: data.bg ?? '#d1fae5', borderColor: data.border ?? '#10b981' }}
        className={cn('w-full h-full rounded-full border-2 flex items-center justify-center shadow-sm overflow-hidden', selected && !editing && 'ring-2 ring-emerald-400 ring-offset-1')}
        onDoubleClick={(e) => { if (data.locked) return; e.stopPropagation(); setDraft(data.label ?? ''); setEditing(true); }}
      >
        {editing ? (
          <textarea ref={taRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && e.metaKey) commit(); }}
            className="nodrag nopan w-full h-full bg-transparent resize-none outline-none text-center p-4 text-sm font-medium"
            style={{ color: data.color ?? '#065f46', fontSize: data.fontSize ?? 12 }} />
        ) : (
          <span style={{ color: data.color ?? '#065f46', fontSize: data.fontSize ?? 12 }} className="font-medium text-center px-2 break-words whitespace-pre-wrap w-full leading-tight cursor-default select-none">
            {data.label}
          </span>
        )}
      </div>
    </>
  );
}

// ── 커스텀 노드: 마름모 ───────────────────────────
function DiamondNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label ?? '');
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing && taRef.current) { taRef.current.focus(); taRef.current.select(); } }, [editing]);
  const commit = () => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, label: draft } } : n));
    setEditing(false);
  };
  return (
    <>
      <NodeResizer isVisible={selected && !editing && !data.locked} minWidth={80} minHeight={80} handleStyle={{ width: 8, height: 8, borderRadius: 2 }} lineStyle={RESIZER_STYLE} />
      {!editing && <NodeHandles />}
      <NodeOverlay data={data} selected={selected} />
      <div className="w-full h-full flex items-center justify-center"
        onDoubleClick={(e) => { if (data.locked) return; e.stopPropagation(); setDraft(data.label ?? ''); setEditing(true); }}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none"
          style={{ filter: selected && !editing ? 'drop-shadow(0 0 0 2px #ff9090)' : undefined }}>
          <polygon points="50,2 98,50 50,98 2,50" fill={data.bg ?? '#fef3c7'} stroke={data.border ?? '#f59e0b'} strokeWidth="3" />
        </svg>
        {editing ? (
          <textarea ref={taRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && e.metaKey) commit(); }}
            className="nodrag nopan relative z-10 w-1/2 h-1/2 bg-transparent resize-none outline-none text-center text-sm font-medium"
            style={{ color: data.color ?? '#92400e', fontSize: data.fontSize ?? 12 }} />
        ) : (
          <span className="relative z-10 font-medium text-center px-2 break-words whitespace-pre-wrap leading-tight cursor-default select-none"
            style={{ color: data.color ?? '#92400e', fontSize: data.fontSize ?? 12 }}>
            {data.label}
          </span>
        )}
      </div>
    </>
  );
}

// ── 커스텀 노드: 텍스트 ───────────────────────────
function TextNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label ?? '');
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing && taRef.current) { taRef.current.focus(); taRef.current.select(); } }, [editing]);
  const commit = (e?: React.FocusEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, label: draft } } : n));
    setEditing(false);
  };
  return (
    <>
      <NodeResizer isVisible={selected && !editing && !data.locked} minWidth={40} minHeight={20} handleStyle={{ width: 8, height: 8, borderRadius: 2 }} lineStyle={RESIZER_STYLE} />
      {!editing && <NodeHandles />}
      <NodeOverlay data={data} selected={selected} />
      <div className={cn('w-full h-full flex items-start px-2 py-1', selected && !editing && 'outline outline-2 outline-primary-400 outline-offset-1 rounded')}>
        {editing ? (
          <textarea ref={taRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && e.metaKey) commit(); }}
            className="nodrag nopan w-full h-full resize-none bg-transparent outline-none font-medium leading-relaxed"
            style={{ color: data.color ?? '#111827', fontSize: data.fontSize ?? 16, border: 'none' }} />
        ) : (
          <span onDoubleClick={(e) => { if (data.locked) return; e.stopPropagation(); setDraft(data.label ?? ''); setEditing(true); }}
            style={{ color: data.color ?? '#111827', fontSize: data.fontSize ?? 16 }}
            className="font-medium whitespace-pre-wrap break-words w-full cursor-text leading-relaxed">
            {data.label || <span className="text-gray-300 text-sm italic font-normal">더블클릭해서 편집</span>}
          </span>
        )}
      </div>
    </>
  );
}

// ── 커스텀 노드: 이모지 ───────────────────────────
function EmojiNode({ data, selected }: any) {
  return (
    <>
      <NodeHandles />
      <NodeOverlay data={data} selected={selected} />
      <div className={cn('cursor-default select-none', selected && 'outline outline-2 outline-primary-400 rounded-full')}>
        <span style={{ fontSize: data.fontSize ?? 40 }}>{data.label}</span>
      </div>
    </>
  );
}

// ── 커스텀 노드: 포스트잇 ─────────────────────────
function StickyNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label ?? '');
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing && taRef.current) { taRef.current.focus(); taRef.current.select(); } }, [editing]);
  const commit = () => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, label: draft } } : n));
    setEditing(false);
  };
  return (
    <>
      <NodeResizer isVisible={selected && !editing && !data.locked} minWidth={100} minHeight={60} handleStyle={{ width: 8, height: 8, borderRadius: 2 }} lineStyle={{ borderColor: '#eab308', borderWidth: 1 }} />
      {!editing && <NodeHandles />}
      <NodeOverlay data={data} selected={selected} />
      <div style={{ backgroundColor: data.bg ?? '#fef08a' }}
        className={cn('w-full h-full rounded shadow-md p-2 border border-yellow-300 overflow-hidden', selected && !editing && 'ring-2 ring-yellow-500 ring-offset-1')}
        onDoubleClick={(e) => { if (data.locked) return; e.stopPropagation(); setDraft(data.label ?? ''); setEditing(true); }}>
        {editing ? (
          <textarea ref={taRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditing(false); }}
            className="nodrag nopan w-full h-full resize-none bg-transparent outline-none leading-relaxed"
            style={{ color: '#713f12', fontSize: data.fontSize ?? 12, border: 'none' }} />
        ) : (
          <p style={{ color: '#713f12', fontSize: data.fontSize ?? 12 }} className="whitespace-pre-wrap leading-relaxed cursor-text">
            {data.label || <span className="text-yellow-400 italic text-xs">더블클릭해서 편집</span>}
          </p>
        )}
      </div>
    </>
  );
}

// ── 커스텀 노드: ERD 테이블 ───────────────────────
interface ErdColumn { id: string; name: string; type: string; pk: boolean; fk: boolean; notNull: boolean; }
function ErdTableNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(data.label ?? 'Table');
  const titleRef = useRef<HTMLInputElement>(null);
  const cols: ErdColumn[] = data.columns ?? [];

  useEffect(() => { if (editingTitle && titleRef.current) { titleRef.current.focus(); titleRef.current.select(); } }, [editingTitle]);

  const commitTitle = () => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, label: titleDraft } } : n));
    setEditingTitle(false);
  };

  const updateCol = (colId: string, patch: Partial<ErdColumn>) => {
    setNodes((ns) => ns.map((n) => {
      if (n.id !== id) return n;
      const next = (n.data.columns as ErdColumn[]).map((c) => c.id === colId ? { ...c, ...patch } : c);
      return { ...n, data: { ...n.data, columns: next } };
    }));
  };

  const addCol = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newCol: ErdColumn = { id: `col-${Date.now()}`, name: 'column', type: 'VARCHAR', pk: false, fk: false, notNull: false };
    setNodes((ns) => ns.map((n) => {
      if (n.id !== id) return n;
      return { ...n, data: { ...n.data, columns: [...(n.data.columns ?? []), newCol] } };
    }));
  };

  const removeCol = (colId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((ns) => ns.map((n) => {
      if (n.id !== id) return n;
      return { ...n, data: { ...n.data, columns: (n.data.columns as ErdColumn[]).filter((c) => c.id !== colId) } };
    }));
  };

  const headerColor = data.headerColor ?? '#1e293b';
  const borderColor = data.borderColor ?? '#334155';

  return (
    <>
      <NodeResizer isVisible={selected && !data.locked} minWidth={200} minHeight={80} handleStyle={{ width: 8, height: 8, borderRadius: 2 }} lineStyle={{ borderColor: '#6366f1', borderWidth: 1 }} />
      <NodeHandles />
      <div
        className={`w-full h-full flex flex-col rounded-xl overflow-hidden shadow-lg ${selected ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
        style={{ border: `2px solid ${borderColor}`, background: '#ffffff', minHeight: 80 }}
      >
        {/* 테이블 헤더 */}
        <div
          className="flex items-center justify-between px-3 py-2 flex-shrink-0"
          style={{ background: headerColor }}
          onDoubleClick={(e) => { if (data.locked) return; e.stopPropagation(); setTitleDraft(data.label ?? ''); setEditingTitle(true); }}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Table2 size={12} className="text-white/70 flex-shrink-0" />
            {editingTitle ? (
              <input
                ref={titleRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                className="nodrag nopan flex-1 min-w-0 bg-white/20 text-white text-xs font-bold outline-none rounded px-1 py-0.5"
              />
            ) : (
              <span className="text-white text-xs font-bold truncate cursor-default">{data.label ?? 'Table'}</span>
            )}
          </div>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={addCol}
            className="nodrag ml-1 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-white/20 hover:bg-white/30 text-white transition-colors"
            title="컬럼 추가"
          >
            <PlusIcon size={11} />
          </button>
        </div>

        {/* 컬럼 행들 */}
        <div className="flex-1 overflow-auto bg-white">
          {cols.length === 0 && (
            <div className="px-3 py-2 text-[10px] text-gray-300 italic text-center">컬럼 없음 — + 버튼으로 추가</div>
          )}
          {cols.map((col, idx) => (
            <div
              key={col.id}
              className={`group flex items-center gap-1.5 px-2 py-1 border-b border-gray-100 last:border-0 hover:bg-indigo-50/40 ${col.pk ? 'bg-amber-50/60' : col.fk ? 'bg-blue-50/40' : ''}`}
            >
              {/* PK/FK 뱃지 */}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); updateCol(col.id, { pk: !col.pk, fk: col.pk ? col.fk : false }); }}
                className={`nodrag flex-shrink-0 w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center transition-colors ${col.pk ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400 hover:bg-amber-200'}`}
                title="PK 토글"
              >PK</button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); updateCol(col.id, { fk: !col.fk }); }}
                className={`nodrag flex-shrink-0 w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center transition-colors ${col.fk ? 'bg-blue-400 text-white' : 'bg-gray-100 text-gray-400 hover:bg-blue-200'}`}
                title="FK 토글"
              >FK</button>

              {/* 컬럼명 */}
              <input
                value={col.name}
                onChange={(e) => updateCol(col.id, { name: e.target.value })}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className={`nodrag nopan flex-1 min-w-0 text-[11px] bg-transparent outline-none border-b border-transparent focus:border-indigo-300 truncate ${col.pk ? 'font-bold text-amber-700' : col.fk ? 'font-semibold text-blue-700' : 'text-gray-700'}`}
                placeholder={`col_${idx + 1}`}
              />

              {/* 타입 */}
              <select
                value={col.type}
                onChange={(e) => updateCol(col.id, { type: e.target.value })}
                onMouseDown={(e) => e.stopPropagation()}
                className="nodrag nopan text-[10px] text-gray-400 bg-transparent outline-none border-0 cursor-pointer pr-0"
                style={{ maxWidth: 70 }}
              >
                {['INT','BIGINT','VARCHAR','TEXT','BOOLEAN','DATE','DATETIME','FLOAT','JSON','UUID'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {/* NN 표시 */}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); updateCol(col.id, { notNull: !col.notNull }); }}
                className={`nodrag flex-shrink-0 text-[9px] font-bold transition-colors ${col.notNull ? 'text-rose-500' : 'text-gray-200 hover:text-gray-400'}`}
                title="NOT NULL 토글"
              >NN</button>

              {/* 삭제 */}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => removeCol(col.id, e)}
                className="nodrag flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-rose-400 transition-all"
              >
                <Trash size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── 커스텀 노드: 이미지 ───────────────────────────
function ImageNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, src: reader.result as string } } : n));
    };
    reader.readAsDataURL(file);
  };
  return (
    <>
      <NodeResizer isVisible={selected && !data.locked} minWidth={80} minHeight={60} handleStyle={{ width: 8, height: 8, borderRadius: 2 }} lineStyle={RESIZER_STYLE} />
      <NodeHandles />
      <NodeOverlay data={data} selected={selected} />
      <div className={cn('w-full h-full rounded-lg overflow-hidden border-2 flex items-center justify-center bg-gray-50',
        selected ? 'border-primary-400 ring-2 ring-primary-200' : 'border-gray-200')}>
        {data.src ? (
          <img src={data.src} alt={data.label ?? ''} className="w-full h-full object-contain" />
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="nodrag flex flex-col items-center gap-1 text-gray-400 hover:text-red-600 transition-colors p-4">
            <ImageIcon size={28} />
            <span className="text-xs">이미지 선택</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </>
  );
}

const nodeTypes: NodeTypes = {
  rect: RectNode,
  circle: CircleNode,
  diamond: DiamondNode,
  text: TextNode,
  emoji: EmojiNode,
  sticky: StickyNode,
  erd: ErdTableNode,
  image: ImageNode,
};

const EMPTY_NODES: Node[] = [];
const EMPTY_EDGES: any[] = [];

// ── 이모지 팔레트 ─────────────────────────────────
const EMOJIS = ['😀','😎','🎉','🔥','✅','❌','⚠️','💡','🚀','❤️','⭐','🎯','📌','🔑','💬','🏆','👍','🤔','📊','🛠️'];

// ── 색상 팔레트 ───────────────────────────────────
const BG_COLORS = [
  { bg: '#ffe0e0', border: '#e60012', color: '#620007' },
  { bg: '#d1fae5', border: '#10b981', color: '#065f46' },
  { bg: '#fee2e2', border: '#ef4444', color: '#991b1b' },
  { bg: '#fef3c7', border: '#f59e0b', color: '#92400e' },
  { bg: '#f3e8ff', border: '#a855f7', color: '#6b21a8' },
  { bg: '#e0f2fe', border: '#0ea5e9', color: '#0c4a6e' },
  { bg: '#f1f5f9', border: '#94a3b8', color: '#1e293b' },
  { bg: '#ffffff', border: '#d1d5db', color: '#111827' },
];
const STICKY_COLORS = ['#fef08a','#bbf7d0','#fde68a','#bfdbfe','#f5d0fe','#fed7aa'];

type Tool = 'pan' | 'select' | 'rect' | 'circle' | 'diamond' | 'text' | 'emoji' | 'sticky' | 'erd' | 'image';

const uid = () => `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function CanvasPage() {
  const { projectId, canvasId } = useParams<{ projectId: string; canvasId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const commentBottomRef = useRef<HTMLDivElement>(null);

  const { data: canvasData, isLoading: dataLoading } = useQuery({
    queryKey: ['canvas', projectId, canvasId],
    queryFn: () => canvasApi.get(projectId!, canvasId!),
    enabled: !!projectId && !!canvasId,
  });

  const saveCanvas = useMutation({
    mutationFn: (data: any) => canvasApi.save(projectId!, canvasId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canvas', projectId, canvasId] });
      // 저장 완료 후 pending 원격 변경이 있으면 최신 데이터 요청
      if (pendingRemoteUpdate.current) {
        pendingRemoteUpdate.current = false;
        qc.invalidateQueries({ queryKey: ['canvas', projectId, canvasId] });
      }
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['canvas-comments', projectId, canvasId],
    queryFn: () => canvasApi.listComments(projectId!, canvasId!),
    enabled: !!projectId && !!canvasId,
  });

  const addComment = useMutation({
    mutationFn: (content: string) => canvasApi.addComment(projectId!, canvasId!, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canvas-comments', projectId, canvasId] });
      setCommentInput('');
      setTimeout(() => commentBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    },
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => canvasApi.deleteComment(projectId!, canvasId!, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['canvas-comments', projectId, canvasId] }),
  });

  const [nodes, setNodes, onNodesChangeBase] = useNodesState(EMPTY_NODES);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState(EMPTY_EDGES);
  const [initialized, setInitialized] = useState(false);
  const isDirty = useRef(false); // 유저가 직접 조작했을 때만 true
  const pendingRemoteUpdate = useRef(false); // 원격 변경이 왔는데 dirty라 바로 못 받았을 때
  const lastServerUpdatedAt = useRef<string>(''); // 마지막으로 로드한 서버 updatedAt (중복 로드 방지)

  // 유저 상호작용 시에만 dirty 표시 (select 변경 제외)
  const onNodesChange = useCallback((changes: any[]) => {
    const meaningful = changes.some((c: any) => c.type !== 'select');
    if (meaningful) isDirty.current = true;
    onNodesChangeBase(changes);
  }, [onNodesChangeBase]);

  const onEdgesChange = useCallback((changes: any[]) => {
    const meaningful = changes.some((c: any) => c.type !== 'select');
    if (meaningful) isDirty.current = true;
    onEdgesChangeBase(changes);
  }, [onEdgesChangeBase]);

  // 서버에서 데이터 로드되면 노드/엣지 초기화
  useEffect(() => {
    if (!canvasData) return;
    const serverTime = canvasData.updatedAt ?? '';

    const applyServerData = () => {
      try {
        const saved = typeof canvasData.data === 'string' ? JSON.parse(canvasData.data) : canvasData.data;
        if (saved?.nodes) setNodes(saved.nodes);
        if (saved?.edges) setEdges(saved.edges);
      } catch {}
      isDirty.current = false;
      lastServerUpdatedAt.current = serverTime;
    };

    // 초기 로드
    if (!initialized) {
      applyServerData();
      setInitialized(true);
      return;
    }
    // 원격 변경 반영: idle 상태 + 서버 타임스탬프가 달라졌을 때
    if (!isDirty.current && serverTime !== lastServerUpdatedAt.current) {
      applyServerData();
    }
  }, [canvasData, initialized, setNodes, setEdges]);
  const [tool, setTool] = useState<Tool>('pan');
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedSticky, setSelectedSticky] = useState(0);
  const [labelInput, setLabelInput] = useState('');
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [pendingNode, setPendingNode] = useState<any>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string; edgeId?: string; nodeType?: string } | null>(null);
  const [clipboard, setClipboard] = useState<Node[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [edgeLabelEdit, setEdgeLabelEdit] = useState<{ edgeId: string; label: string } | null>(null);
  const [assigneeNodeId, setAssigneeNodeId] = useState<string | null>(null);
  const selectedCount = nodes.filter((n) => n.selected).length + edges.filter((e) => e.selected).length;

  // 자동 저장 - 유저가 직접 조작했을 때만 (isDirty)
  useEffect(() => {
    if (!initialized || !projectId || !canvasId) return;
    if (!isDirty.current) return;
    const timer = setTimeout(() => {
      if (!isDirty.current) return;
      const cleanNodes = nodes.map(({ selected: _, ...n }) => n);
      const cleanEdges = edges.map(({ selected: _, ...e }) => e);
      saveCanvas.mutate({ nodes: cleanNodes, edges: cleanEdges });
      isDirty.current = false;
    }, 500);
    return () => clearTimeout(timer);
  }, [nodes, edges, initialized, projectId, canvasId]);

  // SSE: 다른 사람 변경 시 refetch
  useEffect(() => {
    if (!projectId || !canvasId) return;
    const token = localStorage.getItem('accessToken');
    const url = `/api/projects/${projectId}/canvases/${canvasId}/events${token ? `?token=${token}` : ''}`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      const payload = e.data ? JSON.parse(e.data) : {};
      if (payload.type === 'comment') {
        qc.invalidateQueries({ queryKey: ['canvas-comments', projectId, canvasId] });
      } else if (!isDirty.current) {
        // idle 상태: 즉시 최신 데이터 요청 (로드 effect가 변경 감지 후 반영)
        qc.invalidateQueries({ queryKey: ['canvas', projectId, canvasId] });
      } else {
        // 작업 중: 저장 완료 후 반영 예약
        pendingRemoteUpdate.current = true;
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [projectId, canvasId, qc]);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const clipboardRef = useRef(clipboard);
  const initializedRef = useRef(false);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { clipboardRef.current = clipboard; }, [clipboard]);
  useEffect(() => { initializedRef.current = initialized; }, [initialized]);

  // ── Undo / Redo 히스토리 ──────────────────────────
  const historyRef = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] });
  const lastSnapRef = useRef<string>('');
  const isRestoringRef = useRef(false);

  // 직렬화: 선택/드래그 등 일시적 상태 제거
  const serialize = useCallback((ns: Node[], es: any[]) => {
    const cleanN = ns.map(({ selected: _s, dragging: _d, width: _w, height: _h,
      positionAbsolute: _pa, measured: _m, ...n }: any) => n);
    const cleanE = es.map(({ selected: _s, ...e }: any) => e);
    return JSON.stringify({ nodes: cleanN, edges: cleanE });
  }, []);

  const syncHistFlags = useCallback(() => {
    setCanUndo(historyRef.current.past.length > 0);
    setCanRedo(historyRef.current.future.length > 0);
  }, []);

  // 로드 완료 시 기준 스냅샷 설정
  useEffect(() => {
    if (!initialized) return;
    lastSnapRef.current = serialize(nodesRef.current, edgesRef.current);
    historyRef.current = { past: [], future: [] };
    syncHistFlags();
  }, [initialized, serialize, syncHistFlags]);

  // 변경이 멈추면(400ms) 직전 상태를 past에 기록
  useEffect(() => {
    if (!initialized || isRestoringRef.current) return;
    const t = setTimeout(() => {
      const snap = serialize(nodesRef.current, edgesRef.current);
      if (snap === lastSnapRef.current) return;
      historyRef.current.past.push(lastSnapRef.current);
      if (historyRef.current.past.length > 100) historyRef.current.past.shift();
      historyRef.current.future = [];
      lastSnapRef.current = snap;
      syncHistFlags();
    }, 400);
    return () => clearTimeout(t);
  }, [nodes, edges, initialized, serialize, syncHistFlags]);

  const applySnapshot = useCallback((snap: string) => {
    const parsed = JSON.parse(snap);
    isRestoringRef.current = true;
    setNodes(parsed.nodes ?? []);
    setEdges(parsed.edges ?? []);
    lastSnapRef.current = snap;
    isDirty.current = true; // 복원 결과를 저장
    setTimeout(() => { isRestoringRef.current = false; }, 60);
  }, [setNodes, setEdges]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const prev = h.past.pop()!;
    h.future.push(lastSnapRef.current);
    applySnapshot(prev);
    syncHistFlags();
  }, [applySnapshot, syncHistFlags]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const next = h.future.pop()!;
    h.past.push(lastSnapRef.current);
    applySnapshot(next);
    syncHistFlags();
  }, [applySnapshot, syncHistFlags]);

  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  useEffect(() => { undoRef.current = undo; }, [undo]);
  useEffect(() => { redoRef.current = redo; }, [redo]);

  // 페이지 이탈 시 미저장 변경사항 즉시 flush (isDirty 여부와 무관하게 초기화된 상태면 저장)
  useEffect(() => {
    return () => {
      if (!initializedRef.current || !projectId || !canvasId) return;
      if (!isDirty.current) return;
      const cleanNodes = nodesRef.current.map(({ selected: _, ...n }) => n);
      const cleanEdges = edgesRef.current.map(({ selected: _, ...e }) => e);
      const token = localStorage.getItem('accessToken');
      fetch(`/api/projects/${projectId}/canvases/${canvasId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ data: { nodes: cleanNodes, edges: cleanEdges } }),
        keepalive: true,
      });
    };
  }, [projectId, canvasId]);

  // ── 도구 단축키 (독립 effect, capture 단계) ───────────
  useEffect(() => {
    const TOOL_MAP: Record<string, Tool> = {
      h: 'pan', v: 'select', r: 'rect', c: 'circle',
      d: 'diamond', t: 'text', n: 'sticky', e: 'erd', i: 'image',
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;
      const mapped = TOOL_MAP[e.key.toLowerCase()];
      if (mapped) { e.preventDefault(); setTool(mapped); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoRef.current(); else undoRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redoRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selected = nodesRef.current.filter((n) => n.selected);
        if (selected.length > 0) {
          clipboardRef.current = selected; // ref 즉시 갱신 (붙여넣기 시 stale 방지)
          setClipboard(selected);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const cb = clipboardRef.current;
        if (cb.length === 0) return;
        const offset = 48;
        // 원본 id → 새 id 매핑 (엣지 재연결용)
        const idMap = new Map<string, string>();
        const pasted = cb.map((n) => {
          const newId = uid();
          idMap.set(n.id, newId);
          // React Flow 내부 측정 필드 제거 후 복제
          const { id: _id, selected: _sel, dragging: _drag, width: _w, height: _h,
                  positionAbsolute: _pa, measured: _m, ...clean } = n as any;
          return {
            ...clean,
            id: newId,
            position: { x: n.position.x + offset, y: n.position.y + offset },
            selected: true,
            data: { ...n.data },
          };
        });
        // 복사된 노드들 사이에 연결된 엣지만 새 id로 함께 복제
        const copiedEdges = edgesRef.current
          .filter((ed) => idMap.has(ed.source) && idMap.has(ed.target))
          .map((ed) => {
            const { selected: _s, ...cleanEdge } = ed as any;
            return {
              ...cleanEdge,
              id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              source: idMap.get(ed.source)!,
              target: idMap.get(ed.target)!,
            };
          });
        isDirty.current = true;
        setNodes((ns) => ns.map((n) => ({ ...n, selected: false })).concat(pasted));
        if (copiedEdges.length > 0) setEdges((es) => es.concat(copiedEdges));
        setClipboard(pasted);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [setNodes]);

  const onConnect = useCallback((params: Connection) => {
    isDirty.current = true;
    setEdges((eds) => addEdge({
      ...params,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#e60012', strokeWidth: 2 },
      interactionWidth: 20,
    }, eds));
  }, [setEdges]);

  const getCanvasPosition = useCallback((e: React.MouseEvent) => {
    if (!rfInstance || !reactFlowWrapper.current) return { x: 200, y: 200 };
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    return rfInstance.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
  }, [rfInstance]);

  const addNode = useCallback((pos: { x: number; y: number }, label: string) => {
    const color = BG_COLORS[selectedColor];
    const stickyBg = STICKY_COLORS[selectedSticky];
    let newNode: Node;
    if (tool === 'rect') {
      newNode = { id: uid(), type: 'rect', position: pos, data: { label, ...color }, style: { width: 180, height: 90 } };
    } else if (tool === 'circle') {
      newNode = { id: uid(), type: 'circle', position: pos, data: { label, ...color }, style: { width: 130, height: 130 } };
    } else if (tool === 'diamond') {
      newNode = { id: uid(), type: 'diamond', position: pos, data: { label, bg: '#fef3c7', border: '#f59e0b', color: '#92400e' }, style: { width: 140, height: 140 } };
    } else if (tool === 'text') {
      newNode = { id: uid(), type: 'text', position: pos, data: { label, color: '#111827', fontSize: 16 }, style: { width: 160, height: 40 } };
    } else if (tool === 'sticky') {
      newNode = { id: uid(), type: 'sticky', position: pos, data: { label, bg: stickyBg }, style: { width: 200, height: 140 } };
    } else if (tool === 'erd') {
      const erdColors = [
        { header: '#1e293b', border: '#334155' },
        { header: '#1d4ed8', border: '#1e40af' },
        { header: '#7c3aed', border: '#6d28d9' },
        { header: '#059669', border: '#047857' },
        { header: '#dc2626', border: '#b91c1c' },
        { header: '#d97706', border: '#b45309' },
      ];
      const ec = erdColors[selectedColor] ?? erdColors[0];
      newNode = {
        id: uid(), type: 'erd', position: pos,
        data: {
          label: label || 'Table',
          headerColor: ec.header,
          borderColor: ec.border,
          columns: [
            { id: `col-${Date.now()}-1`, name: 'id', type: 'INT', pk: true, fk: false, notNull: true },
          ],
        },
        style: { width: 260, height: 'auto' },
      };
    } else if (tool === 'image') {
      newNode = { id: uid(), type: 'image', position: pos, data: { label: '' }, style: { width: 200, height: 150 } };
    } else {
      return;
    }
    isDirty.current = true;
    setNodes((ns) => [...ns, newNode]);
    setTool('pan');
  }, [tool, selectedColor, selectedSticky, setNodes]);

  const onCanvasClick = useCallback((e: React.MouseEvent) => {
    if (tool === 'pan' || tool === 'select') return;
    // 노드/엣지 위를 클릭한 경우 새 도형 생성하지 않음
    const target = e.target as HTMLElement;
    const isPane = target.classList.contains('react-flow__pane') ||
      target.classList.contains('react-flow__background') ||
      target === e.currentTarget;
    if (!isPane) { setTool('select'); return; }
    const pos = getCanvasPosition(e);
    if (tool === 'image') {
      addNode(pos, '');
      setTool('pan');
      return;
    }
    if (tool === 'rect' || tool === 'circle' || tool === 'diamond' || tool === 'text' || tool === 'sticky' || tool === 'erd') {
      setPendingNode(pos);
      setLabelInput('');
      setShowLabelModal(true);
    }
  }, [tool, getCanvasPosition, addNode]);

  const addEmoji = useCallback((emoji: string, pos?: { x: number; y: number }) => {
    const position = pos ?? { x: 300 + Math.random() * 200, y: 200 + Math.random() * 100 };
    isDirty.current = true;
    setNodes((ns) => [...ns, { id: uid(), type: 'emoji', position, data: { label: emoji, fontSize: 40 }, style: { width: 56, height: 56 } }]);
    setShowEmoji(false);
    setTool('pan');
  }, [setNodes]);

  const deleteSelected = useCallback(() => {
    isDirty.current = true;
    setNodes((ns) => ns.filter((n) => !n.selected));
    setEdges((es) => es.filter((e) => !e.selected));
  }, [setNodes, setEdges]);

  const onSelectionChange = useCallback(({ nodes: selNodes }: { nodes: Node[]; edges: any[] }) => {
    if (selNodes.length === 0) return;
    const selIds = new Set(selNodes.map((n) => n.id));
    setEdges((es) => es.map((e) => ({
      ...e,
      selected: selIds.has(e.source) && selIds.has(e.target),
    })));
  }, [setEdges]);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, nodeType: node.type });
  }, []);

  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: any) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, edgeId: edge.id });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const contextDelete = useCallback(() => {
    isDirty.current = true;
    if (contextMenu?.nodeId) setNodes((ns) => ns.filter((n) => n.id !== contextMenu.nodeId));
    if (contextMenu?.edgeId) setEdges((es) => es.filter((e) => e.id !== contextMenu.edgeId));
    setContextMenu(null);
  }, [contextMenu, setNodes, setEdges]);

  const changeFontSize = useCallback((delta: number) => {
    if (!contextMenu?.nodeId) return;
    isDirty.current = true;
    setNodes((ns) => ns.map((n) => {
      if (n.id !== contextMenu.nodeId) return n;
      const cur = (n.data as any).fontSize ?? (n.type === 'emoji' ? 40 : 13);
      const next = Math.max(8, Math.min(120, cur + delta));
      if (n.type === 'emoji') {
        const pad = 16;
        return { ...n, data: { ...n.data, fontSize: next }, style: { width: next + pad, height: next + pad } };
      }
      return { ...n, data: { ...n.data, fontSize: next } };
    }));
  }, [contextMenu, setNodes]);

  const changeColor = useCallback((colorObj: any) => {
    if (!contextMenu?.nodeId) return;
    isDirty.current = true;
    setNodes((ns) => ns.map((n) => {
      if (n.id !== contextMenu.nodeId) return n;
      if (n.type === 'sticky') return { ...n, data: { ...n.data, bg: colorObj } };
      return { ...n, data: { ...n.data, bg: colorObj.bg, border: colorObj.border, color: colorObj.color } };
    }));
    setContextMenu(null);
  }, [contextMenu, setNodes]);

  // ── 담당자 목록 (assignee picker 열릴 때만 fetch) ──
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
    enabled: !!assigneeNodeId,
  });

  // ── 잠금 토글 ──────────────────────────────────────
  const toggleLock = useCallback((nodeId: string) => {
    isDirty.current = true;
    setNodes((ns) => ns.map((n) => n.id === nodeId
      ? { ...n, draggable: !!n.data.locked, data: { ...n.data, locked: !n.data.locked } }
      : n));
    setContextMenu(null);
  }, [setNodes]);

  // ── 엣지 라벨 저장 ─────────────────────────────────
  const commitEdgeLabel = useCallback((edgeId: string, label: string) => {
    isDirty.current = true;
    setEdges((es) => es.map((e) => e.id === edgeId ? { ...e, label: label.trim() || undefined } : e));
    setEdgeLabelEdit(null);
    setContextMenu(null);
  }, [setEdges]);

  // ── 담당자 토글 ────────────────────────────────────
  const toggleAssignee = useCallback((nodeId: string, u: any) => {
    isDirty.current = true;
    setNodes((ns) => ns.map((n) => {
      if (n.id !== nodeId) return n;
      const cur: any[] = (n.data.assignees as any[]) ?? [];
      const exists = cur.some((a) => a.id === u.id);
      const next = exists ? cur.filter((a) => a.id !== u.id) : [...cur, { id: u.id, name: u.name, avatar: u.avatar }];
      return { ...n, data: { ...n.data, assignees: next } };
    }));
  }, [setNodes]);

  const navTools: { id: Tool; icon: any; label: string; shortcut: string }[] = [
    { id: 'pan',    icon: Hand,          label: '이동',   shortcut: 'H' },
    { id: 'select', icon: MousePointer2, label: '선택',   shortcut: 'V' },
  ];
  const shapeTools: { id: Tool; icon: any; label: string; shortcut: string }[] = [
    { id: 'rect',    icon: Square,    label: '사각형',  shortcut: 'R' },
    { id: 'circle',  icon: Circle,    label: '원',      shortcut: 'C' },
    { id: 'diamond', icon: Diamond,   label: '마름모',  shortcut: 'D' },
    { id: 'text',    icon: Type,      label: '텍스트',  shortcut: 'T' },
    { id: 'sticky',  icon: Minus,     label: '포스트잇',shortcut: 'N' },
    { id: 'erd',     icon: Table2,    label: 'ERD',     shortcut: 'E' },
    { id: 'image',   icon: ImageIcon, label: '이미지',  shortcut: 'I' },
  ];

  if (dataLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <style>{`
        .react-flow__handle { opacity: 0; transition: opacity 0.15s; }
        .react-flow__node:hover .react-flow__handle { opacity: 1; }
        .react-flow__node.selected .react-flow__handle { opacity: 1; }
        [data-selectmode="true"] .react-flow__pane { cursor: default !important; }
        .react-flow__edge.selected .react-flow__edge-path { stroke: #f59e0b !important; stroke-width: 3px !important; }
        .react-flow__edge.selected marker path { fill: #f59e0b !important; }
      `}</style>
      {/* 툴바 */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0 shadow-sm">
        <button
          onClick={() => navigate(`/projects/${projectId}/canvas`)}
          className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors mr-1"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold text-gray-600 truncate max-w-[140px]" title={canvasData?.name}>
          {canvasData?.name ?? '캔버스'}
        </span>
        <Save size={12} className={cn('ml-1 transition-opacity duration-200', saveCanvas.isPending ? 'text-gray-400 animate-pulse opacity-100' : 'opacity-0')} />
        <div className="w-px h-4 bg-gray-200 mx-1" />

        {/* 실행 취소 / 다시 실행 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="실행 취소 (Ctrl+Z)"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="다시 실행 (Ctrl+Shift+Z)"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Redo2 size={15} />
          </button>
        </div>
        <div className="w-px h-4 bg-gray-200 mx-1" />

        {/* 이동 · 선택 · 스냅 */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {navTools.map(({ id, icon: Icon, label, shortcut }) => (
            <button
              key={id}
              onClick={() => { setTool(id); setShowEmoji(false); }}
              title={`${label} (${shortcut})`}
              className={cn(
                'group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                tool === id ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-500 hover:text-gray-600',
              )}
            >
              <Icon size={14} /> {label}
              <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
                {label} <kbd className="ml-1 font-mono opacity-70">{shortcut}</kbd>
              </span>
            </button>
          ))}
          <div className="w-px h-4 bg-gray-300 mx-0.5" />
          <button
            onClick={() => setSnapToGrid((v) => !v)}
            title="격자 스냅 (16px 단위로 정렬)"
            className={cn(
              'group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              snapToGrid ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-500 hover:text-gray-600',
            )}
          >
            <MagnetIcon size={14} /> 스냅
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
              스냅 — 도형을 격자(16px)에 맞춤
            </span>
          </button>
        </div>

        <div className="w-px h-4 bg-gray-200" />

        {/* 도형 · 콘텐츠 */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {shapeTools.map(({ id, icon: Icon, label, shortcut }) => (
            <button
              key={id}
              onClick={() => { setTool(id); setShowEmoji(false); }}
              title={`${label} (${shortcut})`}
              className={cn(
                'group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                tool === id ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-500 hover:text-gray-600',
              )}
            >
              <Icon size={14} /> {label}
              <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
                {label} <kbd className="ml-1 font-mono opacity-70">{shortcut}</kbd>
              </span>
            </button>
          ))}
        </div>

        {/* 이모지 */}
        <div className="relative">
          <button
            onClick={() => { setShowEmoji((v) => !v); setTool('pan'); }}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              showEmoji ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-gray-300',
            )}
          >
            <Smile size={14} /> 이모지
          </button>
          {showEmoji && (
            <div className="absolute top-10 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-56">
              <div className="grid grid-cols-5 gap-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => addEmoji(e)}
                    className="text-2xl hover:bg-gray-100 rounded-lg p-1 transition-colors"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 색상 선택 (도형용) */}
        {(tool === 'rect' || tool === 'circle') && (
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-gray-400">색상:</span>
            {BG_COLORS.map((c, i) => (
              <button
                key={i}
                onClick={() => setSelectedColor(i)}
                style={{ backgroundColor: c.bg, borderColor: c.border }}
                className={cn('w-5 h-5 rounded border-2 transition-transform', selectedColor === i && 'scale-125 shadow')}
              />
            ))}
          </div>
        )}

        {/* ERD 헤더 색상 */}
        {tool === 'erd' && (
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-gray-400">헤더:</span>
            {[
              { header: '#1e293b', border: '#334155' },
              { header: '#1d4ed8', border: '#1e40af' },
              { header: '#7c3aed', border: '#6d28d9' },
              { header: '#059669', border: '#047857' },
              { header: '#dc2626', border: '#b91c1c' },
              { header: '#d97706', border: '#b45309' },
            ].map((c, i) => (
              <button
                key={i}
                onClick={() => setSelectedColor(i)}
                style={{ backgroundColor: c.header, borderColor: c.border }}
                className={cn('w-5 h-5 rounded border-2 transition-transform', selectedColor === i && 'scale-125 shadow')}
              />
            ))}
          </div>
        )}

        {/* 포스트잇 색상 */}
        {tool === 'sticky' && (
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-gray-400">색상:</span>
            {STICKY_COLORS.map((c, i) => (
              <button
                key={i}
                onClick={() => setSelectedSticky(i)}
                style={{ backgroundColor: c }}
                className={cn('w-5 h-5 rounded border border-gray-300 transition-transform', selectedSticky === i && 'scale-125 shadow')}
              />
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {selectedCount > 0 ? (
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm"
            >
              <Trash2 size={13} /> {selectedCount}개 삭제
            </button>
          ) : (
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors"
            >
              <Trash2 size={13} /> 삭제
            </button>
          )}
          <button
            onClick={() => setCommentOpen((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              commentOpen ? 'bg-primary-50 border-gray-300 text-gray-600' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-600',
            )}
          >
            <MessageSquare size={14} />
            댓글
            {comments.length > 0 && (
              <span className="bg-primary-100 text-gray-600 rounded-full px-1.5 py-0.5 text-[10px] font-bold">{comments.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* 캔버스 + 댓글 패널 */}
      <div className="flex-1 flex overflow-hidden">

      {/* 캔버스 */}
      <div ref={reactFlowWrapper} className="flex-1" data-selectmode={tool === 'select'} onClick={onCanvasClick} onContextMenu={(e) => e.preventDefault()}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          nodeTypes={nodeTypes}
          onNodeClick={() => {
            if (!['pan', 'select'].includes(tool)) setTool('select');
          }}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onSelectionChange={onSelectionChange}
          onPaneClick={() => { closeContextMenu(); }}
          fitView
          className="bg-gray-50"
          deleteKeyCode="Delete"
          multiSelectionKeyCode="Shift"
          selectionOnDrag={tool === 'select'}
          panOnDrag={tool === 'select' ? [1, 2] : true}
          panOnScroll
          panOnScrollMode={PanOnScrollMode.Free}
          zoomOnScroll={false}
          zoomOnPinch
          zoomActivationKeyCode="Control"
          selectionMode={SelectionMode.Full}
          snapToGrid={snapToGrid}
          snapGrid={[16, 16]}
          connectionLineStyle={{ stroke: '#e60012', strokeWidth: 2 }}
          defaultEdgeOptions={{
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#e60012', strokeWidth: 2 },
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
          <Controls />
          <MiniMap nodeStrokeWidth={3} zoomable pannable className="!bottom-14" />
          <Panel position="bottom-center">
            <div className="bg-white/80 backdrop-blur-sm text-xs text-gray-400 px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
              노드 핸들(●)을 드래그하면 화살표로 연결 · Delete키로 삭제 · Shift+클릭 다중선택
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* 댓글 패널 */}
      {commentOpen && (
        <div className="w-72 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">댓글 <span className="text-gray-400 font-normal">{comments.length}</span></span>
            <button onClick={() => setCommentOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* 댓글 목록 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {comments.length === 0 ? (
              <p className="text-xs text-gray-400 text-center mt-8">첫 댓글을 남겨보세요</p>
            ) : (
              comments.map((c: any) => (
                <div key={c.id} className="group flex gap-2.5">
                  <Avatar name={c.user.name} avatar={c.user.avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 mb-0.5">
                      <span className="text-xs font-semibold text-gray-800">{c.user.name}</span>
                      <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-gray-600 whitespace-pre-wrap break-words leading-relaxed">{c.content}</p>
                  </div>
                  {user?.id === c.user.id && (
                    <button
                      onClick={() => deleteComment.mutate(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))
            )}
            <div ref={commentBottomRef} />
          </div>

          {/* 입력창 */}
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex gap-2 items-end">
              <textarea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (commentInput.trim()) addComment.mutate(commentInput.trim());
                  }
                }}
                placeholder="댓글 입력... (Enter로 전송)"
                rows={2}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
              />
              <button
                onClick={() => { if (commentInput.trim()) addComment.mutate(commentInput.trim()); }}
                disabled={!commentInput.trim() || addComment.isPending}
                className="w-8 h-8 flex items-center justify-center bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors flex-shrink-0"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      </div>{/* flex row 종료 */}

      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={closeContextMenu} />
          <div
            className="fixed z-[100] bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 min-w-[150px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.nodeId && (
              <>
                {/* 글자 크기 */}
                <div className="flex items-center gap-1 px-3 py-1.5">
                  <span className="text-xs text-gray-500 flex-1">글자 크기</span>
                  <button onClick={() => changeFontSize(-2)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors" title="작게">
                    <ZoomOut size={13} />
                  </button>
                  <button onClick={() => changeFontSize(2)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors" title="크게">
                    <ZoomIn size={13} />
                  </button>
                </div>

                {/* 색상 변경 — 이모지/텍스트 제외 */}
                {contextMenu.nodeType !== 'emoji' && contextMenu.nodeType !== 'text' && (
                  <>
                    <div className="border-t border-gray-100 my-1" />
                    <div className="px-3 py-1.5">
                      <span className="text-xs text-gray-500 block mb-1.5">색상</span>
                      <div className="flex flex-wrap gap-1">
                        {contextMenu.nodeType === 'sticky'
                          ? STICKY_COLORS.map((c) => (
                              <button key={c} onClick={() => changeColor(c)}
                                style={{ backgroundColor: c }}
                                className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform" />
                            ))
                          : BG_COLORS.map((c, i) => (
                              <button key={i} onClick={() => changeColor(c)}
                                style={{ backgroundColor: c.bg, borderColor: c.border }}
                                className="w-6 h-6 rounded border-2 hover:scale-110 transition-transform" />
                            ))
                        }
                      </div>
                    </div>
                  </>
                )}

                {/* 잠금 / 담당자 */}
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => toggleLock(contextMenu.nodeId!)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  {nodes.find((n) => n.id === contextMenu.nodeId)?.data?.locked
                    ? <><Unlock size={14} /> 잠금 해제</>
                    : <><Lock size={14} /> 잠금</>}
                </button>
                <button onClick={() => { setAssigneeNodeId(contextMenu.nodeId!); setContextMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  <UserPlus size={14} /> 담당자 지정
                </button>
                <div className="border-t border-gray-100 my-1" />
              </>
            )}
            {/* 엣지 라벨 편집 */}
            {contextMenu.edgeId && (
              <>
                <button onClick={() => {
                  const edge = edges.find((e) => e.id === contextMenu.edgeId);
                  setEdgeLabelEdit({ edgeId: contextMenu.edgeId!, label: String(edge?.label ?? '') });
                  setContextMenu(null);
                }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  <Tag size={14} /> 라벨 편집
                </button>
                <div className="border-t border-gray-100 my-1" />
              </>
            )}
            <button
              onClick={contextDelete}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} /> 삭제
            </button>
          </div>
        </>
      )}

      {/* 텍스트 입력 모달 */}
      {showLabelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowLabelModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-5 w-80">
            <p className="text-sm font-semibold text-gray-800 mb-3">
              {tool === 'sticky' ? '포스트잇 내용' : tool === 'text' ? '텍스트 입력' : '도형 레이블'}
            </p>
            {tool === 'sticky' ? (
              <textarea
                autoFocus
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="내용을 입력하세요..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            ) : (
              <input
                autoFocus
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { addNode(pendingNode, labelInput); setShowLabelModal(false); }
                  if (e.key === 'Escape') setShowLabelModal(false);
                }}
                placeholder="레이블 입력 (비워도 됩니다)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            )}
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowLabelModal(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-600">취소</button>
              <button
                onClick={() => { addNode(pendingNode, labelInput); setShowLabelModal(false); }}
                className="px-4 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 엣지 라벨 편집 모달 */}
      {edgeLabelEdit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEdgeLabelEdit(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-5 w-72">
            <p className="text-sm font-semibold text-gray-800 mb-3">연결선 라벨</p>
            <input
              autoFocus
              value={edgeLabelEdit.label}
              onChange={(e) => setEdgeLabelEdit({ ...edgeLabelEdit, label: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdgeLabel(edgeLabelEdit.edgeId, edgeLabelEdit.label);
                if (e.key === 'Escape') setEdgeLabelEdit(null);
              }}
              placeholder="라벨 입력 (비우면 제거)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setEdgeLabelEdit(null)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-600">취소</button>
              <button onClick={() => commitEdgeLabel(edgeLabelEdit.edgeId, edgeLabelEdit.label)}
                className="px-4 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700">확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 담당자 지정 모달 */}
      {assigneeNodeId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setAssigneeNodeId(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-72 max-h-[70vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">담당자 지정</p>
              <button onClick={() => setAssigneeNodeId(null)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {allUsers.map((u: any) => {
                const assigned = (nodes.find((n) => n.id === assigneeNodeId)?.data?.assignees ?? []) as any[];
                const checked = assigned.some((a) => a.id === u.id);
                return (
                  <button key={u.id} onClick={() => toggleAssignee(assigneeNodeId, u)}
                    className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                      checked ? 'bg-primary-50' : 'hover:bg-gray-50')}>
                    <Avatar name={u.name} avatar={u.avatar} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                      <p className="text-xs text-gray-400 truncate">{u.position || u.email}</p>
                    </div>
                    {checked && <div className="w-4 h-4 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white fill-current"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
                    </div>}
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-gray-100">
              <button onClick={() => setAssigneeNodeId(null)}
                className="w-full py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700">완료</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
