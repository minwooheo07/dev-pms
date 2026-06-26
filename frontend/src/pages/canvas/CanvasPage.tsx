import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { canvasApi } from '../../api/canvas';
import { getAccessToken } from '../../utils/token';
import { usersApi } from '../../api/users';
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, reconnectEdge, useNodesState, useEdgesState,
  BaseEdge, EdgeLabelRenderer, getBezierPath, getStraightPath, getSmoothStepPath,
  type Connection, type Edge, type EdgeProps, type EdgeTypes, type NodeTypes, type Node,
  Panel, BackgroundVariant, MarkerType, NodeResizer,
  Handle, Position, useReactFlow, SelectionMode, PanOnScrollMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Square, Circle, Diamond, Type, Smile, Minus,
  Trash2, MousePointer2, Hand, ZoomIn, ZoomOut, ChevronLeft, Save,
  MessageSquare, Send, X, Undo2, Redo2,
  ImageIcon, Lock, Unlock, MagnetIcon, Tag, UserPlus,
  Table2, Plus as PlusIcon, Trash, Cylinder, Frame, Slash, BringToFront, SendToBack,
  Rows3, Columns3, CircleDot, CircleStop, Split,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

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

// ── 커스텀 노드: 원통(실린더) ─────────────────────
function CylinderNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label ?? '');
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing && taRef.current) { taRef.current.focus(); taRef.current.select(); } }, [editing]);
  const commit = () => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, label: draft } } : n));
    setEditing(false);
  };
  const bg = data.bg ?? '#e0f2fe';
  const border = data.border ?? '#0ea5e9';
  return (
    <>
      <NodeResizer isVisible={selected && !editing && !data.locked} minWidth={60} minHeight={70} handleStyle={{ width: 8, height: 8, borderRadius: 2 }} lineStyle={RESIZER_STYLE} />
      {!editing && <NodeHandles />}
      <NodeOverlay data={data} selected={selected} />
      <div className="w-full h-full flex items-center justify-center"
        onDoubleClick={(e) => { if (data.locked) return; e.stopPropagation(); setDraft(data.label ?? ''); setEditing(true); }}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none"
          style={{ filter: selected && !editing ? 'drop-shadow(0 0 0 2px #ff9090)' : undefined }}>
          {/* 몸통 + 바닥 곡선 */}
          <path d="M2,14 L2,86 A48,12 0 0 0 98,86 L98,14" fill={bg} stroke={border} strokeWidth="3" />
          {/* 윗면 타원 */}
          <ellipse cx="50" cy="14" rx="48" ry="12" fill={bg} stroke={border} strokeWidth="3" />
        </svg>
        {editing ? (
          <textarea ref={taRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && e.metaKey) commit(); }}
            className="nodrag nopan relative z-10 w-3/4 h-1/2 bg-transparent resize-none outline-none text-center text-sm font-medium"
            style={{ color: data.color ?? '#0c4a6e', fontSize: data.fontSize ?? 12 }} />
        ) : (
          <span className="relative z-10 font-medium text-center px-2 break-words whitespace-pre-wrap leading-tight cursor-default select-none"
            style={{ color: data.color ?? '#0c4a6e', fontSize: data.fontSize ?? 12 }}>
            {data.label}
          </span>
        )}
      </div>
    </>
  );
}

// ── 커스텀 노드: 프레임(그룹 컨테이너) ────────────
// 이동 시 내부에 담긴 도형들이 함께 따라온다(master-slave). 도형을 안으로 드래그하면 자식으로 편입.
function FrameNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label ?? '');
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing && titleRef.current) { titleRef.current.focus(); titleRef.current.select(); } }, [editing]);
  const commit = () => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, label: draft } } : n));
    setEditing(false);
  };
  const border = data.border ?? '#6366f1';
  const bg = data.bg ?? 'rgba(99,102,241,0.06)';
  return (
    <>
      <NodeResizer isVisible={selected && !data.locked} minWidth={180} minHeight={130} handleStyle={{ width: 9, height: 9, borderRadius: 2 }} lineStyle={{ borderColor: border, borderWidth: 1 }} />
      {!editing && <NodeHandles />}
      <NodeOverlay data={data} selected={selected} />
      <div className={cn('w-full h-full rounded-xl border-2 border-dashed flex flex-col', selected && 'ring-2 ring-indigo-400/60 ring-offset-1')}
        style={{ borderColor: border, background: bg }}>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-xl flex-shrink-0" style={{ background: 'rgba(255,255,255,0.65)' }}
          onDoubleClick={(e) => { if (data.locked) return; e.stopPropagation(); setDraft(data.label ?? ''); setEditing(true); }}>
          <Frame size={12} style={{ color: border }} className="flex-shrink-0" />
          {editing ? (
            <input ref={titleRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
              className="nodrag nopan flex-1 min-w-0 bg-white/80 text-xs font-bold outline-none rounded px-1 py-0.5"
              style={{ color: border }} />
          ) : (
            <span className="text-xs font-bold truncate cursor-default select-none" style={{ color: border }}>
              {data.label || '그룹'}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

// ── 커스텀 노드: 선(독립 라인) ────────────────────
// 양 끝점(p1,p2)을 자유롭게 드래그해 어떤 각도로도 그릴 수 있다. 좌표는 노드 기준 로컬 픽셀.
function LineNode({ id, data, selected }: any) {
  const { setNodes, getZoom } = useReactFlow();
  const stroke = data.border ?? '#e60012';
  const sw = data.strokeWidth ?? 3;
  const x1 = data.x1 ?? 0, y1 = data.y1 ?? 0, x2 = data.x2 ?? 140, y2 = data.y2 ?? 0;

  const startDragEnd = (which: 1 | 2) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const ox = which === 1 ? x1 : x2;
    const oy = which === 1 ? y1 : y2;
    const zoom = getZoom() || 1;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture?.(e.pointerId);
    const kx = which === 1 ? 'x1' : 'x2';
    const ky = which === 1 ? 'y1' : 'y2';
    const move = (mv: PointerEvent) => {
      const nx = ox + (mv.clientX - sx) / zoom;
      const ny = oy + (mv.clientY - sy) / zoom;
      setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, [kx]: nx, [ky]: ny } } : n));
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      try { target.releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  const dot = (x: number, y: number): React.CSSProperties => ({
    position: 'absolute', left: x - 6, top: y - 6, width: 12, height: 12, borderRadius: '50%',
    background: '#fff', border: `2px solid ${stroke}`, boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
    cursor: 'move', zIndex: 20, pointerEvents: 'auto',
  });

  // 음수 좌표(끝점을 위/왼쪽으로 이동)도 안전하게 그리기 위해 큰 SVG 영역에 오프셋 적용
  const PAD = 4000;
  return (
    <div style={{ position: 'relative', width: 1, height: 1 }}>
      <svg style={{ position: 'absolute', left: -PAD, top: -PAD, width: PAD * 2, height: PAD * 2, pointerEvents: 'none' }}>
        {/* 히트 영역(투명, 두껍게) — 선 위 클릭/드래그로 노드 이동 */}
        <line x1={x1 + PAD} y1={y1 + PAD} x2={x2 + PAD} y2={y2 + PAD} stroke="transparent" strokeWidth={Math.max(16, sw + 12)} strokeLinecap="round" style={{ pointerEvents: 'stroke' }} />
        <line x1={x1 + PAD} y1={y1 + PAD} x2={x2 + PAD} y2={y2 + PAD} stroke={stroke} strokeWidth={sw} strokeLinecap="round"
          style={{ filter: selected ? 'drop-shadow(0 0 1px #ff9090)' : undefined }} />
      </svg>
      {selected && !data.locked && (
        <>
          <span className="nodrag nopan" style={dot(x1, y1)} onPointerDown={startDragEnd(1)} />
          <span className="nodrag nopan" style={dot(x2, y2)} onPointerDown={startDragEnd(2)} />
        </>
      )}
    </div>
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
      return { ...n, data: { ...n.data, columns: [...((n.data.columns as ErdColumn[]) ?? []), newCol] } };
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
                className="nodrag flex-shrink-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto text-gray-300 hover:text-rose-400 transition-all"
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
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const src = canvas.toDataURL('image/jpeg', 0.8);
      setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, src } } : n));
    };
    img.src = objectUrl;
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

// ── 커스텀 노드: 스윔레인(가로/세로 레인 풀) ────────
function SwimlaneNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const lanes: { id: string; label: string }[] = data.lanes ?? [{ id: 'l1', label: '레인 1' }];
  const headerColor = data.headerColor ?? '#475569';
  const vertical = data.orientation === 'vertical';
  const [edit, setEdit] = useState<{ kind: 'pool' | 'lane'; laneId?: string } | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (edit && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [edit]);

  const begin = (kind: 'pool' | 'lane', laneId: string | undefined, cur: string) => { setDraft(cur); setEdit({ kind, laneId }); };
  const commit = () => {
    setNodes((ns) => ns.map((n) => {
      if (n.id !== id) return n;
      if (edit?.kind === 'pool') return { ...n, data: { ...n.data, label: draft } };
      return { ...n, data: { ...n.data, lanes: (n.data.lanes as any[]).map((l) => l.id === edit?.laneId ? { ...l, label: draft } : l) } };
    }));
    setEdit(null);
  };
  // 레인 추가/삭제 — 세로는 너비, 가로는 높이를 조절
  const sizeKey = vertical ? 'width' : 'height';
  const step = vertical ? 140 : 90;
  const minSize = vertical ? 280 : 120;
  const curSize = (n: any) => n[sizeKey] ?? n.measured?.[sizeKey] ?? (typeof n.style?.[sizeKey] === 'number' ? n.style[sizeKey] : (vertical ? 280 : 240));
  const addLane = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((ns) => ns.map((n) => {
      if (n.id !== id) return n;
      const cur = (n.data.lanes as any[]) ?? [];
      return { ...n, data: { ...n.data, lanes: [...cur, { id: `l${Date.now()}`, label: `레인 ${cur.length + 1}` }] }, style: { ...n.style, [sizeKey]: curSize(n) + step } };
    }));
  };
  const removeLane = (laneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((ns) => ns.map((n) => {
      if (n.id !== id) return n;
      const cur = (n.data.lanes as any[]) ?? [];
      if (cur.length <= 1) return n;
      return { ...n, data: { ...n.data, lanes: cur.filter((l) => l.id !== laneId) }, style: { ...n.style, [sizeKey]: Math.max(minSize, curSize(n) - step) } };
    }));
  };

  // 세로 모드: 제목/라벨 텍스트는 가로(일반), 가로 모드: 세로쓰기(위→아래로 읽힘)
  const vText: React.CSSProperties = vertical ? {} : { writingMode: 'vertical-rl' };
  const vInput: React.CSSProperties = vertical ? {} : { writingMode: 'vertical-rl' };

  return (
    <>
      <NodeResizer isVisible={selected && !data.locked} minWidth={vertical ? 200 : 280} minHeight={vertical ? 220 : 120} handleStyle={{ width: 9, height: 9, borderRadius: 2 }} lineStyle={{ borderColor: headerColor, borderWidth: 1 }} />
      <NodeHandles />
      <NodeOverlay data={data} selected={selected} />
      <div className={cn('w-full h-full flex rounded-lg overflow-hidden border-2 bg-white', vertical && 'flex-col')} style={{ borderColor: headerColor }}>
        {/* 풀 제목 */}
        <div className={cn('flex-shrink-0 flex items-center justify-center cursor-text', vertical ? 'h-7 w-full' : 'w-7 h-full')} style={{ background: headerColor }}
          onDoubleClick={(e) => { if (data.locked) return; e.stopPropagation(); begin('pool', undefined, data.label ?? ''); }}>
          {edit?.kind === 'pool' ? (
            <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEdit(null); }}
              className={cn('nodrag nopan text-xs text-center bg-white/90 rounded outline-none', vertical ? 'w-40' : 'h-24')} style={vInput} />
          ) : (
            <span className="text-white text-xs font-bold select-none" style={vText}>{data.label || 'Pool'}</span>
          )}
        </div>
        {/* 레인들 */}
        <div className={cn('flex-1 flex', vertical ? 'flex-row' : 'flex-col')}>
          {lanes.map((lane, i) => (
            <div key={lane.id} className={cn('flex-1 flex', vertical ? 'flex-col min-w-[80px]' : 'min-h-[60px]', i > 0 && (vertical ? 'border-l-2' : 'border-t-2'))} style={{ borderColor: headerColor }}>
              <div className={cn('flex-shrink-0 flex items-center justify-center bg-gray-50 relative group/lane cursor-text', vertical ? 'h-6 w-full border-b' : 'w-6 h-full border-r')} style={{ borderColor: headerColor }}
                onDoubleClick={(e) => { if (data.locked) return; e.stopPropagation(); begin('lane', lane.id, lane.label); }}>
                {edit?.kind === 'lane' && edit.laneId === lane.id ? (
                  <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
                    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEdit(null); }}
                    className={cn('nodrag nopan text-[11px] text-center bg-white rounded outline-none border', vertical ? 'w-24' : 'h-16')} style={vInput} />
                ) : (
                  <span className="text-[11px] font-semibold text-gray-600 select-none" style={vText}>{lane.label}</span>
                )}
                {selected && lanes.length > 1 && (
                  <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => removeLane(lane.id, e)}
                    className="nodrag absolute top-0.5 right-0.5 opacity-0 group-hover/lane:opacity-100 text-gray-300 hover:text-red-500 transition-opacity" title="레인 삭제">
                    <X size={10} />
                  </button>
                )}
              </div>
              <div className="flex-1" />
            </div>
          ))}
        </div>
      </div>
      {selected && !data.locked && (
        <button onMouseDown={(e) => e.stopPropagation()} onClick={addLane}
          className={cn('nodrag absolute z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border shadow-sm text-[11px] text-gray-600 hover:text-primary-600',
            vertical ? '-right-3 top-1/2 -translate-y-1/2' : '-bottom-3 left-1/2 -translate-x-1/2')}
          style={{ borderColor: headerColor }} title="레인 추가">
          <PlusIcon size={11} /> 레인
        </button>
      )}
    </>
  );
}

// ── 커스텀 노드: BPMN 이벤트(시작/종료/중간) ───────
function BpmnEventNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label ?? '');
  const taRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing && taRef.current) { taRef.current.focus(); taRef.current.select(); } }, [editing]);
  const commit = () => { setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, label: draft } } : n)); setEditing(false); };
  const kind = data.kind ?? 'start';
  const color = data.border ?? (kind === 'end' ? '#dc2626' : kind === 'intermediate' ? '#d97706' : '#16a34a');
  const bg = data.bg ?? (kind === 'end' ? '#fee2e2' : kind === 'intermediate' ? '#fef3c7' : '#dcfce7');
  const ring = kind === 'end' ? '4px' : '2px';
  return (
    <>
      <NodeResizer isVisible={selected && !editing && !data.locked} keepAspectRatio minWidth={44} minHeight={44} handleStyle={{ width: 8, height: 8, borderRadius: 2 }} lineStyle={RESIZER_STYLE} />
      {!editing && <NodeHandles />}
      <NodeOverlay data={data} selected={selected} />
      <div className={cn('w-full h-full rounded-full flex items-center justify-center', selected && !editing && 'ring-2 ring-primary-400 ring-offset-1')}
        style={{ background: bg, border: `${ring} solid ${color}`, boxShadow: kind === 'intermediate' ? `inset 0 0 0 3px ${bg}, inset 0 0 0 5px ${color}` : undefined }}
        onDoubleClick={(e) => { if (data.locked) return; e.stopPropagation(); setDraft(data.label ?? ''); setEditing(true); }}>
        {editing ? (
          <input ref={taRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            className="nodrag nopan w-[80%] text-[10px] text-center bg-transparent outline-none" />
        ) : data.label ? (
          <span className="text-[10px] font-medium text-gray-700 text-center px-1 leading-tight select-none break-words">{data.label}</span>
        ) : null}
      </div>
    </>
  );
}

// ── 커스텀 노드: 게이트웨이(마름모 + 기호) ──────────
function GatewayNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label ?? '');
  const taRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing && taRef.current) { taRef.current.focus(); taRef.current.select(); } }, [editing]);
  const commit = () => { setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, label: draft } } : n)); setEditing(false); };
  const kind = data.kind ?? 'exclusive';
  const sym = kind === 'parallel' ? '+' : kind === 'inclusive' ? '○' : '✕';
  const bg = data.bg ?? '#fef9c3'; const border = data.border ?? '#ca8a04';
  return (
    <>
      <NodeResizer isVisible={selected && !editing && !data.locked} keepAspectRatio minWidth={50} minHeight={50} handleStyle={{ width: 8, height: 8, borderRadius: 2 }} lineStyle={RESIZER_STYLE} />
      {!editing && <NodeHandles />}
      <NodeOverlay data={data} selected={selected} />
      <div className="w-full h-full flex items-center justify-center" onDoubleClick={(e) => { if (data.locked) return; e.stopPropagation(); setDraft(data.label ?? ''); setEditing(true); }}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ filter: selected && !editing ? 'drop-shadow(0 0 0 2px #ff9090)' : undefined }}>
          <polygon points="50,2 98,50 50,98 2,50" fill={bg} stroke={border} strokeWidth="3" />
        </svg>
        <span className="relative z-10 font-bold select-none" style={{ color: border, fontSize: 22 }}>{sym}</span>
        {editing ? (
          <input ref={taRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            className="nodrag nopan absolute -bottom-5 w-24 text-[10px] text-center bg-white/90 rounded outline-none border" />
        ) : data.label ? (
          <span className="absolute -bottom-5 text-[10px] text-gray-600 whitespace-nowrap select-none">{data.label}</span>
        ) : null}
      </div>
    </>
  );
}

const nodeTypes: NodeTypes = {
  swimlane: SwimlaneNode,
  bpmnEvent: BpmnEventNode,
  gateway: GatewayNode,
  frame: FrameNode,
  line: LineNode,
  rect: RectNode,
  circle: CircleNode,
  diamond: DiamondNode,
  cylinder: CylinderNode,
  text: TextNode,
  emoji: EmojiNode,
  sticky: StickyNode,
  erd: ErdTableNode,
  image: ImageNode,
};

// ── 커스텀 엣지: 곡선/직선/계단 + 중간 꺾기(waypoint) + 라벨 ──
function EditableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, label, selected, markerEnd, style }: EdgeProps) {
  const { setEdges, screenToFlowPosition } = useReactFlow();
  const hasWp = (data as any)?.mx != null && (data as any)?.my != null;
  let path: string, lx: number, ly: number;
  if (hasWp) {
    const mx = (data as any).mx as number, my = (data as any).my as number;
    path = `M ${sourceX},${sourceY} L ${mx},${my} L ${targetX},${targetY}`;
    lx = mx; ly = my;
  } else {
    const shape = (data as any)?.shape ?? 'curve';
    const args = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
    const [p, labelX, labelY] =
      shape === 'straight' ? getStraightPath({ sourceX, sourceY, targetX, targetY })
      : shape === 'step' ? getSmoothStepPath(args)
      : getBezierPath(args);
    path = p; lx = labelX; ly = labelY;
  }

  const startDrag = (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    const move = (mv: PointerEvent) => {
      const p = screenToFlowPosition({ x: mv.clientX, y: mv.clientY });
      setEdges((es) => es.map((ed) => ed.id === id ? { ...ed, data: { ...(ed.data || {}), mx: p.x, my: p.y } } : ed));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const resetBend = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges((es) => es.map((ed) => ed.id === id ? { ...ed, data: { ...(ed.data || {}), mx: undefined, my: undefined } } : ed));
  };

  const stroke = (style as any)?.stroke ?? '#e60012';
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={22} />
      <EdgeLabelRenderer>
        {label != null && label !== '' && (
          <div className="nodrag nopan"
            style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${lx}px,${ly - 14}px)`, pointerEvents: 'none' }}>
            <span className="px-1.5 py-0.5 rounded bg-white/90 border border-gray-200 text-[11px] text-gray-600 shadow-sm">{label}</span>
          </div>
        )}
        {selected && (
          <div className="nodrag nopan" onPointerDown={startDrag} onDoubleClick={resetBend} title="드래그: 꺾기 · 더블클릭: 펴기"
            style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)`, pointerEvents: 'all', cursor: 'move' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', border: `2px solid ${stroke}`, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes: EdgeTypes = { editable: EditableEdge };

const EMPTY_NODES: Node[] = [];
const EMPTY_EDGES: any[] = [];

// ── 이모지 팔레트 ─────────────────────────────────
const EMOJIS = [
  '😀','😄','😅','😂','🙂','😉','😎','🤔','😴','😭','😡','😱','🥳','🎉',
  '👍','👎','👏','🙏','💪','🙌','👀',
  '❤️','🧡','💛','💚','💙','💜','🤍','⭐','✨','🔥',
  '✅','❌','⚠️','❓','❗','💯','🚫','🔒','🔓','⏰',
  '💡','🚀','🎯','📌','🔑','💬','🏆','📊','📈','📉','🛠️','📅','📁','📎','🔔',
  '➡️','⬅️','⬆️','⬇️','🔄',
];

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
const EDGE_COLORS = ['#e60012','#0ea5e9','#10b981','#f59e0b','#a855f7','#ec4899','#64748b','#111827'];

type Tool = 'pan' | 'select' | 'frame' | 'swimlane' | 'swimlaneV' | 'bpmnStart' | 'bpmnEnd' | 'gateway' | 'line' | 'rect' | 'circle' | 'diamond' | 'cylinder' | 'text' | 'emoji' | 'sticky' | 'erd' | 'image';

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
    // 마지막으로 본 서버 버전(baseUpdatedAt)을 함께 보내 낙관적 락 검증
    mutationFn: (data: any) => canvasApi.save(projectId!, canvasId!, data, lastServerUpdatedAt.current || undefined),
    onSuccess: (updated: any) => {
      // 저장한 내용으로 캐시 동기화 — 전역 staleTime(30s) 동안 다른 페이지 갔다 복귀 시
      // 옛 캐시가 화면을 덮어쓰는 문제 방지. updatedAt도 기록해 로드 effect의 재적용(선택 초기화) 방지
      if (updated) {
        qc.setQueryData(['canvas', projectId, canvasId], updated);
        if (updated.updatedAt) lastServerUpdatedAt.current = updated.updatedAt;
      }
      // 저장 완료 후 pending 원격 변경이 있을 때만 refetch (무조건 invalidate 시 selected 상태 초기화됨)
      if (pendingRemoteUpdate.current) {
        pendingRemoteUpdate.current = false;
        qc.invalidateQueries({ queryKey: ['canvas', projectId, canvasId] });
      }
    },
    onError: (err: any) => {
      // 낙관적 락 충돌(409): 다른 사용자가 먼저 저장함 → 내 변경을 덮어쓰지 않고 최신으로 갱신 + 경고
      if (err?.response?.status === 409) {
        isDirty.current = false;   // 최신 데이터를 받아들이도록 (로드 effect가 반영)
        lastSavedRef.current = ''; // 기준선 리셋 — refetch된 내용이 새 기준이 됨
        toast('다른 사용자가 먼저 수정해 최신 내용으로 갱신합니다.', { icon: '⚠️', id: 'canvas-conflict' });
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
  const lastSavedRef = useRef<string>(''); // 마지막으로 저장된 내용(직렬화) — 내용 변경 감지로 저장 판단
  const savingRef = useRef(false); // 저장 in-flight 여부 (중복 저장·경쟁 방지)

  // 직렬화: 선택/드래그 등 일시적 상태 제거 (저장/히스토리 비교 공용)
  const serialize = useCallback((ns: Node[], es: any[]) => {
    const cleanN = ns.map(({ selected: _s, dragging: _d, width: _w, height: _h,
      positionAbsolute: _pa, measured: _m, ...n }: any) => n);
    const cleanE = es.map(({ selected: _s, ...e }: any) => e);
    return JSON.stringify({ nodes: cleanN, edges: cleanE });
  }, []);

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
        // 기존 엣지도 편집 가능(꺾기/모양/reconnect) 커스텀 타입으로 통일 (외형은 동일)
        const migratedEdges = (saved?.edges ?? []).map((e: any) => ({ ...e, type: 'editable' }));
        if (saved?.nodes) setNodes(saved.nodes);
        if (saved?.edges) setEdges(migratedEdges);
        lastSavedRef.current = serialize(saved?.nodes ?? [], migratedEdges);
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

  // 자동 저장 - React Flow 스토어를 직접 폴링해 내용 변경 감지 시 저장.
  // 노드 내부 setNodes(라벨/ERD 편집 등)는 페이지 nodes state/onNodesChange를 거치지 않으므로
  // [nodes] 의존 effect로는 못 잡는다. 스토어(getNodes/getEdges) 기준으로 비교하면 모든 편집 경로를 포착.
  useEffect(() => {
    if (!initialized || !projectId || !canvasId) return;
    const tick = () => {
      if (isRestoringRef.current) return;
      if (savingRef.current) return; // 직전 저장이 아직 진행 중이면 건너뜀 (중복·경쟁 방지)
      const inst = rfInstanceRef.current;
      const ns: Node[] = inst?.getNodes ? inst.getNodes() : nodesRef.current;
      const es: any[] = inst?.getEdges ? inst.getEdges() : edgesRef.current;
      const cur = serialize(ns, es);
      if (cur === lastSavedRef.current) { isDirty.current = false; return; }
      isDirty.current = true; // 미저장 변경 존재 → SSE 원격 갱신이 덮어쓰지 않도록
      const cleanNodes = ns.map(({ selected: _s, ...n }: any) => n);
      const cleanEdges = es.map(({ selected: _s, ...e }: any) => e);
      savingRef.current = true;
      saveCanvas.mutate(
        { nodes: cleanNodes, edges: cleanEdges },
        {
          // 저장 성공 시에만 기준선 갱신 → 실패하면 다음 tick에서 자동 재시도(데이터 유실 방지).
          // isDirty도 저장 완료까지 true로 유지해 in-flight 중 원격 갱신이 덮어쓰지 못하게 함.
          onSuccess: () => { lastSavedRef.current = cur; isDirty.current = false; },
          onSettled: () => { savingRef.current = false; },
        },
      );
    };
    const id = setInterval(tick, 1200);
    return () => clearInterval(id);
  }, [initialized, projectId, canvasId, serialize]);

  // SSE: 다른 사람 변경 시 refetch
  useEffect(() => {
    if (!projectId || !canvasId) return;
    const token = getAccessToken();
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
  const rfInstanceRef = useRef<any>(null); // 언마운트 flush 시 스토어에서 최신값 직접 읽기용
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { rfInstanceRef.current = rfInstance; }, [rfInstance]);
  useEffect(() => { clipboardRef.current = clipboard; }, [clipboard]);
  useEffect(() => { initializedRef.current = initialized; }, [initialized]);

  // ── Undo / Redo 히스토리 ──────────────────────────
  const historyRef = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] });
  const lastSnapRef = useRef<string>('');
  const isRestoringRef = useRef(false);

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

  // 변경 기록 — React Flow 스토어를 주기적으로 폴링해 직전 상태를 past에 기록.
  // 노드 내부 setNodes(라벨/ERD 편집 등)는 페이지 nodes state/onNodesChange를 거치지 않아
  // [nodes] 의존 effect로는 스냅샷이 누락됨 → 스토어(getNodes) 기준으로 모든 편집을 개별 기록.
  useEffect(() => {
    if (!initialized) return;
    const id = setInterval(() => {
      if (isRestoringRef.current) return;
      const inst = rfInstanceRef.current;
      const ns = inst?.getNodes ? inst.getNodes() : nodesRef.current;
      const es = inst?.getEdges ? inst.getEdges() : edgesRef.current;
      if (ns.some((n: any) => n.dragging)) return; // 드래그 진행 중엔 기록 보류
      const snap = serialize(ns, es);
      if (snap === lastSnapRef.current) return;
      historyRef.current.past.push(lastSnapRef.current);
      if (historyRef.current.past.length > 100) historyRef.current.past.shift();
      historyRef.current.future = [];
      lastSnapRef.current = snap;
      syncHistFlags();
    }, 500);
    return () => clearInterval(id);
  }, [initialized, serialize, syncHistFlags]);

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

  // 페이지 이탈 시 미저장 변경사항 즉시 flush (내용이 마지막 저장본과 다르면 저장)
  useEffect(() => {
    return () => {
      if (!initializedRef.current || !projectId || !canvasId) return;
      // 노드 내부 편집(onBlur commit 등)은 React Flow 스토어를 동기적으로 갱신하지만
      // nodesRef(React state 미러)는 언마운트 전에 동기화되지 못할 수 있어 스토어에서 최신값을 직접 읽음
      const inst = rfInstanceRef.current;
      const latestNodes: Node[] = inst?.getNodes ? inst.getNodes() : nodesRef.current;
      const latestEdges: any[] = inst?.getEdges ? inst.getEdges() : edgesRef.current;
      const cur = serialize(latestNodes, latestEdges);
      if (cur === lastSavedRef.current) return;
      lastSavedRef.current = cur;
      const cleanNodes = latestNodes.map(({ selected: _, ...n }) => n);
      const cleanEdges = latestEdges.map(({ selected: _, ...e }) => e);
      const token = getAccessToken();
      fetch(`/api/projects/${projectId}/canvases/${canvasId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        // baseUpdatedAt은 마지막으로 본 "실제 서버 버전"을 보낸다. (이전엔 클라가 만든 nowIso를 보내
        //  서버 버전과 항상 어긋나 409가 났고, 재진입 시 옛 서버본으로 롤백되며 '다른 사람이 수정함'
        //  토스트 + 도형 위치가 되돌아가는 버그가 있었음)
        body: JSON.stringify({ data: { nodes: cleanNodes, edges: cleanEdges }, baseUpdatedAt: lastServerUpdatedAt.current || undefined }),
        keepalive: true,
      });
      // keepalive 응답으로 새 버전을 받을 수 없으므로, 다음 진입 시 서버에서 최신을 다시 받아
      // 버전(updatedAt)을 정확히 동기화하도록 stale 처리한다.
      qc.invalidateQueries({ queryKey: ['canvas', projectId, canvasId] });
    };
  }, [projectId, canvasId]);

  // ── 도구 단축키 (독립 effect, capture 단계) ───────────
  useEffect(() => {
    const TOOL_MAP: Record<string, Tool> = {
      h: 'pan', v: 'select', f: 'frame', s: 'swimlane', g: 'gateway', r: 'rect', c: 'circle',
      d: 'diamond', y: 'cylinder', l: 'line', t: 'text', n: 'sticky', e: 'erd', i: 'image',
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
        const pasted: any[] = cb.map((n) => {
          const newId = uid();
          idMap.set(n.id, newId);
          // id/선택/드래그/절대좌표만 제거하고 크기(width/height/measured/style)는 보존해 동일 크기로 복제
          const { id: _id, selected: _sel, dragging: _drag, positionAbsolute: _pa, ...clean } = n as any;
          return {
            ...clean,
            id: newId,
            _origParent: (n as any).parentId,
            position: { x: n.position.x, y: n.position.y },
            selected: true,
            data: { ...n.data },
          };
        });
        // 부모-자식 관계 재매핑: 부모도 함께 복사됐으면 새 id로 연결(상대좌표 유지), 아니면 최상위로 분리 후 오프셋
        pasted.forEach((p) => {
          const parentCopied = p._origParent && idMap.has(p._origParent);
          if (p.parentId) {
            if (parentCopied) p.parentId = idMap.get(p._origParent);
            else { delete p.parentId; delete p.extent; }
          }
          if (!parentCopied) p.position = { x: p.position.x + offset, y: p.position.y + offset };
          delete p._origParent;
        });
        // 부모가 자식보다 앞서도록 정렬
        pasted.sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0));
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
      type: 'editable',
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#e60012', strokeWidth: 2 },
      interactionWidth: 20,
    }, eds));
  }, [setEdges]);

  // 화살표 끝을 다른 도형/핸들로 끌어 연결 변경(reconnect) — 길이·경로 조절
  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    isDirty.current = true;
    setEdges((els) => reconnectEdge(oldEdge, newConnection, els));
  }, [setEdges]);

  // 엣지 경로 모양 변경 (curve=곡선 / straight=직선 / step=계단) — 꺾기(waypoint) 있으면 해제
  const changeEdgeShape = useCallback((shape: 'curve' | 'straight' | 'step') => {
    if (!contextMenu?.edgeId) return;
    isDirty.current = true;
    setEdges((es) => es.map((e) => e.id === contextMenu.edgeId
      ? { ...e, data: { ...(e.data || {}), shape, mx: undefined, my: undefined } }
      : e));
    setContextMenu(null);
  }, [contextMenu, setEdges]);

  // 프레임 편입/이탈 — 드래그 종료 시 도형 중심이 어느 프레임 안에 있으면 그 프레임의 자식으로 편입
  const onNodeDragStop = useCallback((_e: any, node: Node) => {
    if (node.type === 'frame' || node.type === 'swimlane') return; // 컨테이너 자체는 중첩 비허용
    const all = nodesRef.current as any[];
    const isContainer = (t?: string) => t === 'frame' || t === 'swimlane';
    const dim = (nd: any, key: 'width' | 'height') =>
      nd[key] ?? nd.measured?.[key] ?? (typeof nd.style?.[key] === 'number' ? nd.style[key] : 0) ?? 0;
    const getAbs = (nd: any) => {
      if (nd.parentId) {
        const p = all.find((x) => x.id === nd.parentId);
        if (p) return { x: p.position.x + nd.position.x, y: p.position.y + nd.position.y };
      }
      return { x: nd.position.x, y: nd.position.y };
    };
    const abs = getAbs(node);
    const cx = abs.x + dim(node, 'width') / 2;
    const cy = abs.y + dim(node, 'height') / 2;
    const target = all.find((f) => {
      if (!isContainer(f.type) || f.id === node.id) return false;
      const fw = dim(f, 'width'), fh = dim(f, 'height');
      return cx >= f.position.x && cx <= f.position.x + fw && cy >= f.position.y && cy <= f.position.y + fh;
    });
    if (target && node.parentId !== target.id) {
      // 편입: 좌표를 프레임 기준 상대좌표로 변환 + 부모가 자식보다 앞서도록 정렬
      const rel = { x: abs.x - target.position.x, y: abs.y - target.position.y };
      isDirty.current = true;
      setNodes((ns) => {
        // extent:'parent'는 주지 않음 — 프레임 밖으로 드래그해 이탈할 수 있어야 하므로 parentId만 설정
        const upd = ns.map((n) => n.id === node.id
          ? ({ ...n, parentId: target.id, position: rel } as any)
          : n);
        return [...upd].sort((a: any, b: any) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0));
      });
    } else if (!target && node.parentId) {
      // 이탈: 절대좌표로 복원
      isDirty.current = true;
      setNodes((ns) => ns.map((n) => n.id === node.id
        ? ({ ...n, parentId: undefined, extent: undefined, position: abs } as any)
        : n));
    }
  }, [setNodes]);

  const getCanvasPosition = useCallback((e: React.MouseEvent) => {
    if (!rfInstance || !reactFlowWrapper.current) return { x: 200, y: 200 };
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    return rfInstance.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
  }, [rfInstance]);

  const addNode = useCallback((pos: { x: number; y: number }, label: string) => {
    const color = BG_COLORS[selectedColor];
    const stickyBg = STICKY_COLORS[selectedSticky];
    let newNode: Node;
    if (tool === 'frame') {
      newNode = { id: uid(), type: 'frame', position: pos, data: { label: label || '그룹', border: '#6366f1', bg: 'rgba(99,102,241,0.06)' }, style: { width: 320, height: 220 } };
    } else if (tool === 'swimlane') {
      newNode = { id: uid(), type: 'swimlane', position: pos, data: { label: 'Pool', headerColor: '#475569', orientation: 'horizontal', lanes: [{ id: 'l1', label: '레인 1' }, { id: 'l2', label: '레인 2' }] }, style: { width: 560, height: 240 } };
    } else if (tool === 'swimlaneV') {
      newNode = { id: uid(), type: 'swimlane', position: pos, data: { label: 'Pool', headerColor: '#475569', orientation: 'vertical', lanes: [{ id: 'l1', label: '레인 1' }, { id: 'l2', label: '레인 2' }] }, style: { width: 300, height: 360 } };
    } else if (tool === 'bpmnStart') {
      newNode = { id: uid(), type: 'bpmnEvent', position: pos, data: { kind: 'start', label }, style: { width: 54, height: 54 } };
    } else if (tool === 'bpmnEnd') {
      newNode = { id: uid(), type: 'bpmnEvent', position: pos, data: { kind: 'end', label }, style: { width: 54, height: 54 } };
    } else if (tool === 'gateway') {
      newNode = { id: uid(), type: 'gateway', position: pos, data: { kind: 'exclusive', label }, style: { width: 64, height: 64 } };
    } else if (tool === 'rect') {
      newNode = { id: uid(), type: 'rect', position: pos, data: { label, ...color }, style: { width: 180, height: 90 } };
    } else if (tool === 'circle') {
      newNode = { id: uid(), type: 'circle', position: pos, data: { label, ...color }, style: { width: 130, height: 130 } };
    } else if (tool === 'diamond') {
      newNode = { id: uid(), type: 'diamond', position: pos, data: { label, bg: '#fef3c7', border: '#f59e0b', color: '#92400e' }, style: { width: 140, height: 140 } };
    } else if (tool === 'cylinder') {
      newNode = { id: uid(), type: 'cylinder', position: pos, data: { label, bg: '#e0f2fe', border: '#0ea5e9', color: '#0c4a6e' }, style: { width: 120, height: 140 } };
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
    } else if (tool === 'line') {
      // 기본 수평선(끝점은 LineNode에서 드래그로 자유 조절)
      newNode = { id: uid(), type: 'line', position: pos, data: { border: color.border, strokeWidth: 3, x1: 0, y1: 0, x2: 140, y2: 0 } };
    } else if (tool === 'image') {
      newNode = { id: uid(), type: 'image', position: pos, data: { label: '' }, style: { width: 200, height: 150 } };
    } else {
      return;
    }
    isDirty.current = true;
    // 컨테이너(프레임/스윔레인)는 배열 앞에 둬서 자식 도형들보다 뒤(아래)에 렌더되도록
    const isContainer = newNode.type === 'frame' || newNode.type === 'swimlane';
    setNodes((ns) => isContainer ? [newNode, ...ns] : [...ns, newNode]);
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
    if (tool === 'image' || tool === 'line' || tool === 'swimlane' || tool === 'swimlaneV' || tool === 'bpmnStart' || tool === 'bpmnEnd' || tool === 'gateway') {
      addNode(pos, '');
      setTool('pan');
      return;
    }
    if (tool === 'frame' || tool === 'rect' || tool === 'circle' || tool === 'diamond' || tool === 'cylinder' || tool === 'text' || tool === 'sticky' || tool === 'erd') {
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
    setNodes((ns) => {
      // 삭제되는 프레임의 자식은 절대좌표로 분리(부모 참조 끊김 방지)
      const removedFrames = new Map(
        ns.filter((n) => n.selected && (n.type === 'frame' || n.type === 'swimlane')).map((n) => [n.id, n.position]),
      );
      return ns.filter((n) => !n.selected).map((n) => {
        const fp = n.parentId ? removedFrames.get(n.parentId) : undefined;
        if (fp) return { ...n, parentId: undefined, extent: undefined, position: { x: fp.x + n.position.x, y: fp.y + n.position.y } } as any;
        return n;
      });
    });
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
    if (contextMenu?.nodeId) setNodes((ns) => {
      const del = ns.find((n) => n.id === contextMenu.nodeId);
      const framePos = (del?.type === 'frame' || del?.type === 'swimlane') ? del.position : undefined;
      return ns.filter((n) => n.id !== contextMenu.nodeId).map((n) => {
        if (framePos && n.parentId === contextMenu.nodeId) {
          return { ...n, parentId: undefined, extent: undefined, position: { x: framePos.x + n.position.x, y: framePos.y + n.position.y } } as any;
        }
        return n;
      });
    });
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

  // ── 쌓임 순서(z-index) ─────────────────────────────
  const bringToFront = useCallback((nodeId: string) => {
    isDirty.current = true;
    setNodes((ns) => {
      const maxZ = ns.reduce((m, n) => Math.max(m, (n as any).zIndex ?? 0), 0);
      return ns.map((n) => n.id === nodeId ? ({ ...n, zIndex: maxZ + 1 } as any) : n);
    });
    setContextMenu(null);
  }, [setNodes]);

  const sendToBack = useCallback((nodeId: string) => {
    isDirty.current = true;
    setNodes((ns) => {
      const minZ = ns.reduce((m, n) => Math.min(m, (n as any).zIndex ?? 0), 0);
      return ns.map((n) => n.id === nodeId ? ({ ...n, zIndex: minZ - 1 } as any) : n);
    });
    setContextMenu(null);
  }, [setNodes]);

  // ── 엣지 라벨 저장 ─────────────────────────────────
  const commitEdgeLabel = useCallback((edgeId: string, label: string) => {
    isDirty.current = true;
    setEdges((es) => es.map((e) => e.id === edgeId ? { ...e, label: label.trim() || undefined } : e));
    setEdgeLabelEdit(null);
    setContextMenu(null);
  }, [setEdges]);

  // ── 연결선 색상 변경 (선 + 화살표 머리 동일 색) ─────
  const changeEdgeColor = useCallback((color: string) => {
    if (!contextMenu?.edgeId) return;
    isDirty.current = true;
    setEdges((es) => es.map((e) => e.id === contextMenu.edgeId
      ? {
          ...e,
          style: { ...(e.style as any), stroke: color },
          markerEnd: { ...(typeof e.markerEnd === 'object' ? e.markerEnd : {}), type: MarkerType.ArrowClosed, color },
        }
      : e));
    setContextMenu(null);
  }, [contextMenu, setEdges]);

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
    { id: 'frame',     icon: Frame,      label: '그룹틀',     shortcut: 'F' },
    { id: 'swimlane',  icon: Rows3,      label: '스윔레인(가로)', shortcut: 'S' },
    { id: 'swimlaneV', icon: Columns3,   label: '스윔레인(세로)', shortcut: '' },
    { id: 'bpmnStart', icon: CircleDot,  label: '시작이벤트',  shortcut: '' },
    { id: 'bpmnEnd',   icon: CircleStop, label: '종료이벤트',  shortcut: '' },
    { id: 'gateway',   icon: Split,      label: '게이트웨이',  shortcut: 'G' },
    { id: 'rect',    icon: Square,    label: '사각형',  shortcut: 'R' },
    { id: 'circle',  icon: Circle,    label: '원',      shortcut: 'C' },
    { id: 'diamond', icon: Diamond,   label: '마름모',  shortcut: 'D' },
    { id: 'cylinder',icon: Cylinder,  label: '원통',    shortcut: 'Y' },
    { id: 'line',    icon: Slash,     label: '선',      shortcut: 'L' },
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
      {/* 툴바 (2행: 탐색·액션 / 도형 도구) */}
      <div className="flex flex-col gap-1.5 px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0 shadow-sm">
        {/* 1행: 탐색 · 우측 액션 */}
        <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/canvas')}
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
              <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
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
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
              스냅 — 도형을 격자(16px)에 맞춤
            </span>
          </button>
        </div>

        {/* 우측 액션 (1행) */}
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
        </div>{/* 1행 끝 */}

        {/* 2행: 도형 도구 */}
        <div className="flex items-center gap-2 flex-wrap">
        {/* 프로세스(프레임·스윔레인·BPMN) */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {shapeTools.filter((t) => ['frame','swimlane','swimlaneV','bpmnStart','bpmnEnd','gateway'].includes(t.id)).map(({ id, icon: Icon, label, shortcut }) => (
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
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-gray-200" />

        {/* 일반 도형 · 콘텐츠 */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {shapeTools.filter((t) => !['frame','swimlane','swimlaneV','bpmnStart','bpmnEnd','gateway'].includes(t.id)).map(({ id, icon: Icon, label, shortcut }) => (
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
            <div className="absolute top-10 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-64 max-h-72 overflow-y-auto">
              <div className="grid grid-cols-6 gap-1">
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

        </div>{/* 2행 끝 */}
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
          onReconnect={onReconnect}
          edgesReconnectable
          onInit={setRfInstance}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={() => {
            if (!['pan', 'select'].includes(tool)) setTool('select');
          }}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onNodeDragStop={onNodeDragStop}
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
            type: 'editable',
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
                      className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto text-gray-300 hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
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

                {/* 쌓임 순서 */}
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => bringToFront(contextMenu.nodeId!)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  <BringToFront size={14} /> 맨 앞으로
                </button>
                <button onClick={() => sendToBack(contextMenu.nodeId!)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  <SendToBack size={14} /> 맨 뒤로
                </button>

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
            {/* 엣지 색상 + 라벨 편집 */}
            {contextMenu.edgeId && (
              <>
                <div className="px-3 py-2">
                  <p className="text-[11px] text-gray-400 mb-1.5">선 색상</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {EDGE_COLORS.map((c) => (
                      <button key={c} onClick={() => changeEdgeColor(c)}
                        className="w-5 h-5 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                        style={{ backgroundColor: c }} title={c} />
                    ))}
                  </div>
                </div>
                <div className="border-t border-gray-100 my-1" />
                <div className="px-3 py-2">
                  <p className="text-[11px] text-gray-400 mb-1.5">선 모양</p>
                  <div className="flex items-center gap-1">
                    {([['curve','곡선'],['straight','직선'],['step','계단']] as const).map(([t, label]) => (
                      <button key={t} onClick={() => changeEdgeShape(t)}
                        className="flex-1 text-[11px] px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-gray-100 my-1" />
                <p className="px-3 pb-1 text-[11px] text-gray-400 leading-relaxed">선택 후 가운데 점을 끌면 꺾이고(더블클릭=펴기), 끝점을 끌면 다른 도형에 다시 연결돼요</p>
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
