export const runtime = 'edge';

const MOSCOW_TZ = 'Europe/Moscow';

function moscowToday() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const secret = process.env.API_SECRET;
  if (secret && searchParams.get('key') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const doneParam = searchParams.get('done');
  if (doneParam === null) {
    return Response.json(
      { ok: false, error: 'missing "done" param (use done=1 or done=0)' },
      { status: 400 }
    );
  }
  const done = ['1', 'true', 'yes', 'да'].includes(doneParam.toLowerCase())
    ? '1'
    : '0';

  const dateParam = searchParams.get('date');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam || '')
    ? dateParam
    : moscowToday();

  const [year, month, day] = date.split('-');
  const monthKey = `${year}-${month}`;

  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) {
    return Response.json(
      { ok: false, error: 'storage not configured (Upstash env vars missing)' },
      { status: 500 }
    );
  }

  const res = await fetch(
    `${base}/hset/sport:${monthKey}/${day}/${done}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    return Response.json(
      { ok: false, error: 'failed to write to storage' },
      { status: 502 }
    );
  }

  return Response.json({ ok: true, date, done: done === '1' });
}
