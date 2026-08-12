import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.FIGMA_TOKEN;
  const fileKey = process.env.FIGMA_FILE_KEY;
  if (!token || !fileKey) {
    return NextResponse.json({ error: 'Missing FIGMA_TOKEN or FIGMA_FILE_KEY' }, { status: 500 });
  }

  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
    headers: { 'X-Figma-Token': token },
  });

  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: text }, { status: res.status });
  }
}
