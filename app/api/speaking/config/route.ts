import { NextResponse } from 'next/server';

// Tells the client whether the server has its own OpenAI key configured as a
// fallback for Speaking scoring. Returns a boolean only — never the key.
export async function GET() {
  return NextResponse.json({ hasServerKey: !!process.env.OPENAI_API_KEY });
}
