import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://mind-mapping-woad.vercel.app/api";
const API_KEY = "HttBTShDj3t7TxeJDFq8Cgm7YEptxxsV";
const MAP_ID = "69c1925cf4d4a7271cc89a26";

const headers = {
  "x-api-key": API_KEY,
  "Content-Type": "application/json",
};

// GET /api/edges — fetch all edges
export async function GET() {
  const res = await fetch(`${API_BASE}/mindmaps/${MAP_ID}/edges`, { headers });
  const json = await res.json();
  return NextResponse.json(json);
}

// POST /api/edges — create an edge
export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${API_BASE}/mindmaps/${MAP_ID}/edges`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return NextResponse.json(json);
}
