"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface MindMapNode {
  id: string;
  label: string;
  content: string;
  position: { x: number; y: number };
}

interface Edge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
}

// ---- Node API ----
async function apiFetchNodes(): Promise<MindMapNode[]> {
  const res = await fetch("/api/nodes");
  const json = await res.json();
  return json.data.nodes.map((n: Record<string, unknown>) => ({
    id: n._id as string,
    label: n.label as string,
    content: n.content as string,
    position: n.position as { x: number; y: number },
  }));
}

async function apiCreateNode(position: { x: number; y: number }): Promise<MindMapNode> {
  const res = await fetch("/api/nodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label: "New Node", content: "", position }),
  });
  const json = await res.json();
  const n = json.data.node;
  return { id: n._id, label: n.label, content: n.content, position: n.position };
}

async function apiDeleteNode(id: string): Promise<void> {
  await fetch(`/api/nodes/${id}`, { method: "DELETE" });
}

async function apiUpdateNode(
  id: string,
  data: { label?: string; content?: string; position?: { x: number; y: number } }
): Promise<void> {
  await fetch(`/api/nodes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ---- Edge API ----
async function apiFetchEdges(): Promise<Edge[]> {
  const res = await fetch("/api/edges");
  const json = await res.json();
  return json.data.edges.map((e: Record<string, unknown>) => ({
    id: e._id as string,
    sourceNodeId: e.sourceNodeId as string,
    targetNodeId: e.targetNodeId as string,
  }));
}

async function apiCreateEdge(sourceNodeId: string, targetNodeId: string): Promise<Edge> {
  const res = await fetch("/api/edges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceNodeId, targetNodeId }),
  });
  const json = await res.json();
  const e = json.data.edge;
  return { id: e._id, sourceNodeId: e.sourceNodeId, targetNodeId: e.targetNodeId };
}

async function apiDeleteEdge(id: string): Promise<void> {
  await fetch(`/api/edges/${id}`, { method: "DELETE" });
}

// ---- Constants ----
const NODE_W = 160;
const NODE_H = 48;

export default function Home() {
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Edge-drawing state
  const [edgeMode, setEdgeMode] = useState(false);
  const [edgeSource, setEdgeSource] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [fetchedNodes, fetchedEdges] = await Promise.all([
        apiFetchNodes(),
        apiFetchEdges(),
      ]);
      setNodes(fetchedNodes);
      setEdges(fetchedEdges);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- Drag handlers ----
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (edgeMode && edgeSource && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left + canvasRef.current.scrollLeft,
          y: e.clientY - rect.top + canvasRef.current.scrollTop,
        });
      }
      if (!draggingId) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left + canvas.scrollLeft - dragOffset.current.x;
      const y = e.clientY - rect.top + canvas.scrollTop - dragOffset.current.y;
      setNodes((prev) =>
        prev.map((n) => (n.id === draggingId ? { ...n, position: { x, y } } : n))
      );
    },
    [draggingId, edgeMode, edgeSource]
  );

  const handleMouseUp = useCallback(() => {
    if (draggingId) {
      const node = nodes.find((n) => n.id === draggingId);
      if (node) {
        apiUpdateNode(draggingId, { position: node.position }).catch(console.error);
      }
      setDraggingId(null);
    }
  }, [draggingId, nodes]);

  // ---- Actions ----
  async function addNode() {
    const canvas = canvasRef.current;
    const x = canvas ? canvas.scrollLeft + canvas.clientWidth / 2 - NODE_W / 2 : 200;
    const y = canvas ? canvas.scrollTop + canvas.clientHeight / 2 - NODE_H / 2 : 200;
    try {
      const created = await apiCreateNode({ x, y });
      setNodes((prev) => [...prev, created]);
      setEditingId(created.id);
    } catch (err) {
      console.error("Failed to create node:", err);
    }
  }

  async function deleteSelected() {
    const toDeleteNodes = Array.from(selectedIds);
    // Also delete edges connected to deleted nodes
    const edgesToDelete = edges.filter(
      (e) => selectedIds.has(e.sourceNodeId) || selectedIds.has(e.targetNodeId)
    );
    setNodes((prev) => prev.filter((n) => !selectedIds.has(n.id)));
    setEdges((prev) =>
      prev.filter(
        (e) => !selectedIds.has(e.sourceNodeId) && !selectedIds.has(e.targetNodeId)
      )
    );
    setSelectedIds(new Set());
    try {
      await Promise.all([
        ...toDeleteNodes.map((id) => apiDeleteNode(id)),
        ...edgesToDelete.map((e) => apiDeleteEdge(e.id)),
      ]);
    } catch (err) {
      console.error("Failed to delete:", err);
      loadData();
    }
  }

  function updateNodeText(id: string, label: string) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, label } : n)));
  }

  function finishEditing(id: string) {
    setEditingId(null);
    const node = nodes.find((n) => n.id === id);
    if (node) {
      apiUpdateNode(id, { label: node.label, content: node.content }).catch(console.error);
    }
  }

  function handleNodeClick(id: string) {
    if (edgeMode) {
      if (!edgeSource) {
        setEdgeSource(id);
      } else if (edgeSource !== id) {
        // Check if edge already exists
        const exists = edges.some(
          (e) =>
            (e.sourceNodeId === edgeSource && e.targetNodeId === id) ||
            (e.sourceNodeId === id && e.targetNodeId === edgeSource)
        );
        if (!exists) {
          apiCreateEdge(edgeSource, id)
            .then((edge) => setEdges((prev) => [...prev, edge]))
            .catch(console.error);
        }
        setEdgeSource(null);
      }
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }

  function getNodeCenter(node: MindMapNode) {
    return {
      x: node.position.x + NODE_W / 2,
      y: node.position.y + NODE_H / 2,
    };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mr-auto">
          MindMaps
        </h1>
        <button
          onClick={addNode}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Add Node
        </button>
        <button
          onClick={() => {
            setEdgeMode((prev) => !prev);
            setEdgeSource(null);
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            edgeMode
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-600"
          }`}
        >
          {edgeMode ? "Drawing Edges..." : "Add Edge"}
        </button>
        <button
          onClick={deleteSelected}
          disabled={selectedIds.size === 0}
          className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Delete ({selectedIds.size})
        </button>
      </div>

      {/* Edge mode hint */}
      {edgeMode && (
        <div className="bg-green-50 dark:bg-green-950 border-b border-green-200 dark:border-green-800 px-6 py-2 text-sm text-green-700 dark:text-green-300">
          {edgeSource
            ? "Now click a second node to connect them."
            : "Click a node to start an edge."}
        </div>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`flex-1 overflow-auto relative ${
          edgeMode ? "cursor-crosshair" : ""
        }`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {nodes.length === 0 && edges.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-400 dark:text-zinc-600 text-lg">
            Click &quot;+ Add Node&quot; to get started
          </div>
        ) : (
          <div className="relative" style={{ minWidth: 2000, minHeight: 2000 }}>
            {/* SVG layer for edges */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ width: "100%", height: "100%", zIndex: 0 }}
            >
              {edges.map((edge) => {
                const source = nodes.find((n) => n.id === edge.sourceNodeId);
                const target = nodes.find((n) => n.id === edge.targetNodeId);
                if (!source || !target) return null;
                const s = getNodeCenter(source);
                const t = getNodeCenter(target);
                return (
                  <line
                    key={edge.id}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke="#6b7280"
                    strokeWidth={2}
                    className="pointer-events-auto cursor-pointer hover:stroke-red-500"
                    onClick={() => {
                      if (confirm("Delete this edge?")) {
                        setEdges((prev) => prev.filter((e) => e.id !== edge.id));
                        apiDeleteEdge(edge.id).catch(console.error);
                      }
                    }}
                  />
                );
              })}
              {/* In-progress edge line */}
              {edgeMode && edgeSource && (() => {
                const source = nodes.find((n) => n.id === edgeSource);
                if (!source) return null;
                const s = getNodeCenter(source);
                return (
                  <line
                    x1={s.x}
                    y1={s.y}
                    x2={mousePos.x}
                    y2={mousePos.y}
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />
                );
              })()}
            </svg>

            {/* Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedIds.has(node.id);
              const isEditing = editingId === node.id;
              const isEdgeHighlight =
                edgeMode && (edgeSource === node.id);

              return (
                <div
                  key={node.id}
                  style={{
                    position: "absolute",
                    left: node.position.x,
                    top: node.position.y,
                    width: NODE_W,
                    zIndex: draggingId === node.id ? 10 : 1,
                  }}
                  className={`
                    p-3 rounded-xl border-2 select-none
                    bg-white dark:bg-zinc-900 shadow-sm transition-colors
                    ${isEdgeHighlight
                      ? "border-green-500 ring-2 ring-green-200 dark:ring-green-800"
                      : isSelected
                        ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                    }
                    ${edgeMode ? "cursor-pointer" : "cursor-grab"}
                    ${draggingId === node.id ? "cursor-grabbing opacity-90" : ""}
                  `}
                  onMouseDown={(e) => {
                    if (edgeMode || isEditing) return;
                    e.preventDefault();
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const rect = canvas.getBoundingClientRect();
                    dragOffset.current = {
                      x: e.clientX - rect.left + canvas.scrollLeft - node.position.x,
                      y: e.clientY - rect.top + canvas.scrollTop - node.position.y,
                    };
                    setDraggingId(node.id);
                  }}
                  onClick={(e) => {
                    if (draggingId) return;
                    e.stopPropagation();
                    handleNodeClick(node.id);
                  }}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      className="w-full bg-transparent outline-none text-zinc-900 dark:text-zinc-100 text-sm"
                      placeholder="Type here..."
                      value={node.label}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onChange={(e) => updateNodeText(node.id, e.target.value)}
                      onBlur={() => finishEditing(node.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") finishEditing(node.id);
                      }}
                    />
                  ) : (
                    <div
                      className="text-sm text-zinc-900 dark:text-zinc-100 min-h-[1.5em] truncate"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingId(node.id);
                      }}
                    >
                      {node.label || (
                        <span className="text-zinc-400 italic">
                          Double-click to edit
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
