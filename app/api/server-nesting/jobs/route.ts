import { NextResponse } from "next/server";

const NESTING_SERVICE_URL = process.env.NESTING_SERVICE_URL ?? "http://localhost:8010";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const upstream = await fetch(`${NESTING_SERVICE_URL}/nest/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return NextResponse.json(
      {
        detail:
          e instanceof Error
            ? e.message
            : "Failed to connect to nesting service",
      },
      { status: 502 }
    );
  }
}
