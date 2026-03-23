import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://mind-mapping-woad.vercel.app/api";
const API_KEY = "HttBTShDj3t7TxeJDFq8Cgm7YEptxxsV";
const MAP_ID = "69c1925cf4d4a7271cc89a26";

const headers = {
  "x-api-key": API_KEY,
  "Content-Type": "application/json",
};

// PUT /api/nodes/[id] — update a node
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const res = await fetch(`${API_BASE}/mindmaps/${MAP_ID}/nodes/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return NextResponse.json(json);
}

// DELETE /api/nodes/[id] — delete a node
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await fetch(`${API_BASE}/mindmaps/${MAP_ID}/nodes/${id}`, {
    method: "DELETE",
    headers,
  });
  const json = await res.json();
  return NextResponse.json(json);
}
