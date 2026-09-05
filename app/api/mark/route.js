import { createClient } from 'redis';

const MOSCOW_TZ = 'Europe/Moscow';

let clientPromise;

function getRedisClient() {
  if (!clientPromise) {
    const client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => console.error('Redis Client Error', err));
    clientPromise = client.connect().then(() => client);
  }
  return clientPromise;
}

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

  if (!process.env.REDIS_URL) {
    return Response.json(
      { ok: false, error: 'storage not configured (REDIS_URL missing)' },
      { status: 500 }
    );
  }

  try {
    const redis = await getRedisClient();
    await redis.hSet(`sport:${monthKey}`, day, done);
  } catch (e) {
    return Response.json(
      { ok: false, error: 'failed to write to storage' },
      { status: 502 }
    );
  }

  return Response.json({ ok: true, date, done: done === '1' });
}
