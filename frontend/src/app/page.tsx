"use client";

import { useState, useEffect, useCallback } from "react";

interface MindMapNode {
  id: string;
  label: string;
  content: string;
  position: { x: number; y: number };
}

// ---- API functions (proxied through Next.js API routes) ----
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

async function apiCreateNode(): Promise<MindMapNode> {
  const position = {
    x: 100 + Math.random() * 400,
    y: 100 + Math.random() * 300,
  };
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

async function apiUpdateNode(id: string, label: string, content: string): Promise<void> {
  await fetch(`/api/nodes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, content }),
  });
}
// ------------------------------------------------------------

export default function Home() {
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadNodes = useCallback(async () => {
    try {
      const fetched = await apiFetchNodes();
      setNodes(fetched);
    } catch (err) {
      console.error("Failed to fetch nodes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  async function addNode() {
    try {
      const created = await apiCreateNode();
      setNodes((prev) => [...prev, created]);
      setEditingId(created.id);
    } catch (err) {
      console.error("Failed to create node:", err);
    }
  }

  async function deleteSelected() {
    const toDelete = Array.from(selectedIds);
    setNodes((prev) => prev.filter((n) => !selectedIds.has(n.id)));
    setSelectedIds(new Set());
    try {
      await Promise.all(toDelete.map((id) => apiDeleteNode(id)));
    } catch (err) {
      console.error("Failed to delete nodes:", err);
      loadNodes();
    }
  }

  function updateNodeText(id: string, label: string) {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, label } : n))
    );
  }

  function finishEditing(id: string) {
    setEditingId(null);
    const node = nodes.find((n) => n.id === id);
    if (node) {
      apiUpdateNode(id, node.label, node.content).catch((err) =>
        console.error("Failed to update node:", err)
      );
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
          onClick={deleteSelected}
          disabled={selectedIds.size === 0}
          className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Delete ({selectedIds.size})
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-8">
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-400 dark:text-zinc-600 text-lg">
            Click &quot;+ Add Node&quot; to get started
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {nodes.map((node) => {
              const isSelected = selectedIds.has(node.id);
              const isEditing = editingId === node.id;

              return (
                <div
                  key={node.id}
                  onClick={() => toggleSelect(node.id)}
                  className={`
                    relative min-w-[160px] max-w-[280px] p-4 rounded-xl border-2 cursor-pointer
                    bg-white dark:bg-zinc-900 shadow-sm transition-all
                    ${isSelected
                      ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                    }
                  `}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      className="w-full bg-transparent outline-none text-zinc-900 dark:text-zinc-100 text-sm"
                      placeholder="Type here..."
                      value={node.label}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateNodeText(node.id, e.target.value)}
                      onBlur={() => finishEditing(node.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") finishEditing(node.id);
                      }}
                    />
                  ) : (
                    <div
                      className="text-sm text-zinc-900 dark:text-zinc-100 min-h-[1.5em]"
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
