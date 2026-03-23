import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://mind-mapping-woad.vercel.app/api";
const API_KEY = "HttBTShDj3t7TxeJDFq8Cgm7YEptxxsV";
const MAP_ID = "69c1925cf4d4a7271cc89a26";

const headers = {
  "x-api-key": API_KEY,
  "Content-Type": "application/json",
};

// DELETE /api/edges/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await fetch(`${API_BASE}/mindmaps/${MAP_ID}/edges/${id}`, {
    method: "DELETE",
    headers,
  });
  const json = await res.json();
  return NextResponse.json(json);
}
