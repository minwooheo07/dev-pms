import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Connection, type NodeTypes, type Node,
  Panel, BackgroundVariant, MarkerType, NodeResizer,
  Handle, Position, useReactFlow, SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Square, Circle, Type, Smile, Minus,
  Trash2, MousePointer2, Hand, ZoomIn, ZoomOut,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const RESIZER_STYLE = { borderColor: '#6366f1', borderWidth: 1 };
const HANDLE_STYLE = {
  width: 10, height: 10, background: '#6366f1', border: '2px solid #fff',
  borderRadius: '50%', boxShadow: '0 0 0 1px #6366f1',
};

function NodeHandles() {
  return (
    <>
      <Handle id="t" type="target" position={Position.Top}    style={HANDLE_STYLE} />
      <Handle id="b" type="target" position={Position.Bottom} style={HANDLE_STYLE} />
      <Handle id="l" type="target" position={Position.Left}   style={HANDLE_STYLE} />
      <Handle id="r" type="target" position={Position.Right}  style={HANDLE_STYLE} />
      <Handle id="st" type="source" position={Position.Top}    style={{ ...HANDLE_STYLE, background: '#a5b4fc' }} />
      <Handle id="sb" type="source" position={Position.Bottom} style={{ ...HANDLE_STYLE, background: '#a5b4fc' }} />
      <Handle id="sl" type="source" position={Position.Left}   style={{ ...HANDLE_STYLE, background: '#a5b4fc' }} />
      <Handle id="sr" type="source" position={Position.Right}  style={{ ...HANDLE_STYLE, background: '#a5b4fc' }} />
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
      <NodeResizer isVisible={selected && !editing} minWidth={60} minHeight={40} handleStyle={{ width: 8, height: 8, borderRadius: 2 }} lineStyle={RESIZER_STYLE} />
      {!editing && <NodeHandles />}
      <div
        style={{ backgroundColor: data.bg ?? '#e0e7ff', borderColor: data.border ?? '#6366f1' }}
        className={cn('w-full h-full rounded-lg border-2 flex items-center justify-center shadow-sm', selected && !editing && 'ring-2 ring-indigo-400 ring-offset-1')}
        onDoubleClick={(e) => { e.stopPropagation(); setDraft(data.label ?? ''); setEditing(true); }}
      >
        {editing ? (
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && e.metaKey) commit(); }}
            className="nodrag nopan w-full h-full bg-transparent resize-none outline-none text-center p-2 text-sm font-medium"
            style={{ color: data.color ?? '#3730a3', fontSize: data.fontSize ?? 13 }}
          />
        ) : (
          <span style={{ color: data.color ?? '#3730a3', fontSize: data.fontSize ?? 13 }} className="font-medium text-center px-2 break-words w-full text-center leading-tight cursor-default select-none">
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
      <NodeResizer isVisible={selected && !editing} minWidth={50} minHeight={50} handleStyle={{ width: 8, height: 8, borderRadius: 2 }} lineStyle={RESIZER_STYLE} />
      {!editing && <NodeHandles />}
      <div
        style={{ backgroundColor: data.bg ?? '#d1fae5', borderColor: data.border ?? '#10b981' }}
        className={cn('w-full h-full rounded-full border-2 flex items-center justify-center shadow-sm overflow-hidden', selected && !editing && 'ring-2 ring-emerald-400 ring-offset-1')}
        onDoubleClick={(e) => { e.stopPropagation(); setDraft(data.label ?? ''); setEditing(true); }}
      >
        {editing ? (
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && e.metaKey) commit(); }}
            className="nodrag nopan w-full h-full bg-transparent resize-none outline-none text-center p-4 text-sm font-medium"
            style={{ color: data.color ?? '#065f46', fontSize: data.fontSize ?? 12 }}
          />
        ) : (
          <span style={{ color: data.color ?? '#065f46', fontSize: data.fontSize ?? 12 }} className="font-medium text-center px-2 break-words w-full text-center leading-tight cursor-default select-none">
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

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.select();
    }
  }, [editing]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(data.label ?? '');
    setEditing(true);
  };

  const commit = (e?: React.FocusEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, label: draft } } : n));
    setEditing(false);
  };

  return (
    <>
      <NodeResizer isVisible={selected && !editing} minWidth={40} minHeight={20} handleStyle={{ width: 8, height: 8, borderRadius: 2 }} lineStyle={RESIZER_STYLE} />
      {!editing && <NodeHandles />}
      <div className={cn('w-full h-full flex items-start px-2 py-1', selected && !editing && 'outline outline-2 outline-indigo-400 outline-offset-1 rounded')}>
        {editing ? (
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') { setEditing(false); }
              if (e.key === 'Enter' && e.metaKey) commit();
            }}
            className="nodrag nopan w-full h-full resize-none bg-transparent outline-none font-medium leading-relaxed"
            style={{ color: data.color ?? '#111827', fontSize: data.fontSize ?? 16, border: 'none' }}
          />
        ) : (
          <span
            onDoubleClick={startEdit}
            style={{ color: data.color ?? '#111827', fontSize: data.fontSize ?? 16 }}
            className="font-medium whitespace-pre-wrap break-words w-full cursor-text leading-relaxed"
          >
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
      <div className={cn('cursor-default select-none', selected && 'outline outline-2 outline-indigo-400 rounded-full')}>
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

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, label: draft } } : n));
    setEditing(false);
  };

  return (
    <>
      <NodeResizer isVisible={selected && !editing} minWidth={100} minHeight={60} handleStyle={{ width: 8, height: 8, borderRadius: 2 }} lineStyle={{ borderColor: '#eab308', borderWidth: 1 }} />
      {!editing && <NodeHandles />}
      <div
        style={{ backgroundColor: data.bg ?? '#fef08a' }}
        className={cn(
          'w-full h-full rounded shadow-md p-2 border border-yellow-300 overflow-hidden',
          selected && !editing && 'ring-2 ring-yellow-500 ring-offset-1',
        )}
        onDoubleClick={(e) => { e.stopPropagation(); setDraft(data.label ?? ''); setEditing(true); }}
      >
        {editing ? (
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="nodrag nopan w-full h-full resize-none bg-transparent outline-none leading-relaxed"
            style={{ color: '#713f12', fontSize: data.fontSize ?? 12, border: 'none' }}
          />
        ) : (
          <p style={{ color: '#713f12', fontSize: data.fontSize ?? 12 }} className="whitespace-pre-wrap leading-relaxed cursor-text">
            {data.label || <span className="text-yellow-400 italic text-xs">더블클릭해서 편집</span>}
          </p>
        )}
      </div>
    </>
  );
}

const nodeTypes: NodeTypes = {
  rect: RectNode,
  circle: CircleNode,
  text: TextNode,
  emoji: EmojiNode,
  sticky: StickyNode,
};

// ── 초기 샘플 ─────────────────────────────────────
const initNodes: Node[] = [
  { id: '1', type: 'rect', position: { x: 100, y: 120 }, data: { label: '시작' }, style: { width: 180, height: 90 } },
  { id: '2', type: 'circle', position: { x: 360, y: 100 }, data: { label: '처리' }, style: { width: 130, height: 130 } },
  { id: '3', type: 'rect', position: { x: 580, y: 120 }, data: { label: '완료', bg: '#dcfce7', border: '#16a34a', color: '#15803d' }, style: { width: 180, height: 90 } },
  { id: '4', type: 'emoji', position: { x: 410, y: 290 }, data: { label: '🎉', fontSize: 48 } },
  { id: '5', type: 'sticky', position: { x: 100, y: 290 }, data: { label: '여기에 메모를\n자유롭게 작성하세요' }, style: { width: 200, height: 140 } },
];
const initEdges = [
  { id: 'e1-2', source: '1', target: '2', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#6366f1' } },
  { id: 'e2-3', source: '2', target: '3', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#6366f1' } },
];

// ── 이모지 팔레트 ─────────────────────────────────
const EMOJIS = ['😀','😎','🎉','🔥','✅','❌','⚠️','💡','🚀','❤️','⭐','🎯','📌','🔑','💬','🏆','👍','🤔','📊','🛠️'];

// ── 색상 팔레트 ───────────────────────────────────
const BG_COLORS = [
  { bg: '#e0e7ff', border: '#6366f1', color: '#3730a3' },
  { bg: '#d1fae5', border: '#10b981', color: '#065f46' },
  { bg: '#fee2e2', border: '#ef4444', color: '#991b1b' },
  { bg: '#fef3c7', border: '#f59e0b', color: '#92400e' },
  { bg: '#f3e8ff', border: '#a855f7', color: '#6b21a8' },
  { bg: '#e0f2fe', border: '#0ea5e9', color: '#0c4a6e' },
  { bg: '#f1f5f9', border: '#94a3b8', color: '#1e293b' },
  { bg: '#ffffff', border: '#d1d5db', color: '#111827' },
];
const STICKY_COLORS = ['#fef08a','#bbf7d0','#fde68a','#bfdbfe','#f5d0fe','#fed7aa'];

type Tool = 'pan' | 'select' | 'rect' | 'circle' | 'text' | 'emoji' | 'sticky';

let idCounter = 100;
const uid = () => `node-${++idCounter}`;

export function CanvasPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);
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
  const selectedCount = nodes.filter((n) => n.selected).length + edges.filter((e) => e.selected).length;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selected = nodes.filter((n) => n.selected);
        if (selected.length > 0) setClipboard(selected);
      }
      if (!e.ctrlKey && !e.metaKey && e.key === 'h') { setTool('pan'); return; }
      if (!e.ctrlKey && !e.metaKey && e.key === 'v') { setTool('select'); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboard.length === 0) return;
        const offset = 24;
        const pasted = clipboard.map((n) => ({
          ...n,
          id: uid(),
          position: { x: n.position.x + offset, y: n.position.y + offset },
          selected: true,
          data: { ...n.data },
        }));
        setNodes((ns) => ns.map((n) => ({ ...n, selected: false })).concat(pasted));
        setClipboard(pasted);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, clipboard, setNodes]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({
      ...params,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#6366f1', strokeWidth: 2 },
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
    } else if (tool === 'text') {
      newNode = { id: uid(), type: 'text', position: pos, data: { label, color: '#111827', fontSize: 16 }, style: { width: 160, height: 40 } };
    } else if (tool === 'sticky') {
      newNode = { id: uid(), type: 'sticky', position: pos, data: { label, bg: stickyBg }, style: { width: 200, height: 140 } };
    } else {
      return;
    }
    setNodes((ns) => [...ns, newNode]);
    setTool('pan');
  }, [tool, selectedColor, selectedSticky, setNodes]);

  const onCanvasClick = useCallback((e: React.MouseEvent) => {
    if (tool === 'pan' || tool === 'select') return;
    const pos = getCanvasPosition(e);
    if (tool === 'rect' || tool === 'circle' || tool === 'text' || tool === 'sticky') {
      setPendingNode(pos);
      setLabelInput('');
      setShowLabelModal(true);
    }
  }, [tool, getCanvasPosition]);

  const addEmoji = useCallback((emoji: string, pos?: { x: number; y: number }) => {
    const position = pos ?? { x: 300 + Math.random() * 200, y: 200 + Math.random() * 100 };
    setNodes((ns) => [...ns, { id: uid(), type: 'emoji', position, data: { label: emoji, fontSize: 40 }, style: { width: 56, height: 56 } }]);
    setShowEmoji(false);
    setTool('pan');
  }, [setNodes]);

  const deleteSelected = useCallback(() => {
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
    if (contextMenu?.nodeId) setNodes((ns) => ns.filter((n) => n.id !== contextMenu.nodeId));
    if (contextMenu?.edgeId) setEdges((es) => es.filter((e) => e.id !== contextMenu.edgeId));
    setContextMenu(null);
  }, [contextMenu, setNodes, setEdges]);

  const changeFontSize = useCallback((delta: number) => {
    if (!contextMenu?.nodeId) return;
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
    setNodes((ns) => ns.map((n) => {
      if (n.id !== contextMenu.nodeId) return n;
      if (n.type === 'sticky') return { ...n, data: { ...n.data, bg: colorObj } };
      return { ...n, data: { ...n.data, bg: colorObj.bg, border: colorObj.border, color: colorObj.color } };
    }));
    setContextMenu(null);
  }, [contextMenu, setNodes]);

  const tools: { id: Tool; icon: any; label: string }[] = [
    { id: 'pan', icon: Hand, label: '이동' },
    { id: 'select', icon: MousePointer2, label: '선택' },
    { id: 'rect', icon: Square, label: '사각형' },
    { id: 'circle', icon: Circle, label: '원' },
    { id: 'text', icon: Type, label: '텍스트' },
    { id: 'sticky', icon: Minus, label: '포스트잇' },
  ];

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
        <span className="text-sm font-bold text-gray-700 mr-2">캔버스</span>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {tools.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => { setTool(id); setShowEmoji(false); }}
              title={label}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                tool === id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700',
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
          <span className="text-xs text-gray-400 border border-gray-200 px-2 py-1.5 rounded-lg">
            {tool === 'pan' ? '드래그로 화면 이동' : tool === 'select' ? '드래그로 영역 선택 · Delete로 삭제' : '캔버스를 클릭해 추가'}
          </span>
        </div>
      </div>

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
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onSelectionChange={onSelectionChange}
          onPaneClick={(e) => { closeContextMenu(); }}
          fitView
          className="bg-gray-50"
          deleteKeyCode="Delete"
          multiSelectionKeyCode="Shift"
          selectionOnDrag={tool === 'select'}
          panOnDrag={tool === 'select' ? [1, 2] : true}
          selectionMode={SelectionMode.Full}
          connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2 }}
          defaultEdgeOptions={{
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#6366f1', strokeWidth: 2 },
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowLabelModal(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">취소</button>
              <button
                onClick={() => { addNode(pendingNode, labelInput); setShowLabelModal(false); }}
                className="px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
