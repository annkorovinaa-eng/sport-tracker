import { ImageResponse } from 'next/og';
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

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function moscowNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

async function loadGoogleFont(text, weight) {
  const url = `https://fonts.googleapis.com/css2?family=Noto+Sans:wght@${weight}&text=${encodeURIComponent(
    text
  )}`;
  const cssRes = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36',
    },
  });
  const css = await cssRes.text();
  const match = css.match(/src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/);
  if (!match) throw new Error('Could not find font URL in Google Fonts CSS');
  const fontRes = await fetch(match[1]);
  return fontRes.arrayBuffer();
}

async function readMonthData(monthKey) {
  if (!process.env.REDIS_URL) return {};
  try {
    const redis = await getRedisClient();
    return await redis.hGetAll(`sport:${monthKey}`);
  } catch (e) {
    console.error('Redis read error', e);
    return {};
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const secret = process.env.API_SECRET;
  if (secret && searchParams.get('key') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const width = Number(searchParams.get('width')) || 1320;
  const height = Number(searchParams.get('height')) || 2868;
  const habit = (searchParams.get('habit') || 'Спорт / йога').slice(0, 40);

  const { year, month, day: today } = moscowNow();
  const monthParam = searchParams.get('month');
  const targetYear = /^\d{4}-\d{2}$/.test(monthParam || '')
    ? Number(monthParam.slice(0, 4))
    : year;
  const targetMonth = /^\d{4}-\d{2}$/.test(monthParam || '')
    ? Number(monthParam.slice(5, 7))
    : month;
  const isCurrentMonth = targetYear === year && targetMonth === month;

  const monthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  const dayMap = await readMonthData(monthKey);

  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const firstWeekday = (new Date(targetYear, targetMonth - 1, 1).getDay() + 6) % 7;

  let doneCount = 0;
  let trackedCount = 0;
  const flatCells = [];
  for (let i = 0; i < firstWeekday; i++) flatCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = String(d).padStart(2, '0');
    const status = dayMap[key];
    const isFuture = isCurrentMonth && d > today;
    const isToday = isCurrentMonth && d === today;
    if (!isFuture) {
      trackedCount += 1;
      if (status === '1') doneCount += 1;
    }
    flatCells.push({ day: d, status, isFuture, isToday });
  }
  while (flatCells.length % 7 !== 0) flatCells.push(null);

  const weeks = [];
  for (let i = 0; i < flatCells.length; i += 7) {
    weeks.push(flatCells.slice(i, i + 7));
  }

  const headerText = `${habit.toUpperCase()} ${MONTH_NAMES[targetMonth - 1]} ${targetYear} ${WEEKDAY_LABELS.join(
    ' '
  )} ${doneCount} / ${trackedCount} дней 0123456789`;

  const [fontRegular, fontBold] = await Promise.all([
    loadGoogleFont(headerText, 400),
    loadGoogleFont(headerText, 700),
  ]);

  const cellSize = Math.floor(width * 0.108);
  const gap = Math.floor(width * 0.022);
  const gridWidth = cellSize * 7 + gap * 6;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          background: '#000000',
          paddingBottom: Math.floor(height * 0.15),
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              color: '#8E8E93',
              fontSize: Math.floor(width * 0.042),
              fontFamily: 'Noto Sans',
              letterSpacing: 2,
              marginBottom: 8,
            }}
          >
            {habit.toUpperCase()}
          </div>
          <div
            style={{
              display: 'flex',
              color: '#FFFFFF',
              fontSize: Math.floor(width * 0.072),
              fontFamily: 'Noto Sans',
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            {MONTH_NAMES[targetMonth - 1]} {targetYear}
          </div>
          <div
            style={{
              display: 'flex',
              color: '#8E8E93',
              fontSize: Math.floor(width * 0.038),
              fontFamily: 'Noto Sans',
              marginBottom: Math.floor(height * 0.03),
            }}
          >
            {doneCount} / {trackedCount} дней
          </div>

          <div style={{ display: 'flex', flexDirection: 'row', width: gridWidth, marginBottom: 10 }}>
            {WEEKDAY_LABELS.map((wd, i) => (
              <div
                key={wd}
                style={{
                  display: 'flex',
                  width: cellSize,
                  marginRight: i === 6 ? 0 : gap,
                  justifyContent: 'center',
                  color: '#636366',
                  fontSize: Math.floor(width * 0.028),
                  fontFamily: 'Noto Sans',
                }}
              >
                {wd}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {weeks.map((week, wi) => (
              <div
                key={wi}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  marginBottom: wi === weeks.length - 1 ? 0 : gap,
                }}
              >
                {week.map((cell, ci) => {
                  const marginRight = ci === 6 ? 0 : gap;
                  if (!cell) {
                    return (
                      <div
                        key={ci}
                        style={{ display: 'flex', width: cellSize, height: cellSize, marginRight }}
                      />
                    );
                  }

                  let bg = '#2C2C2E';
                  let border = '2px solid #2C2C2E';
                  let textColor = '#8E8E93';

                  if (cell.isFuture) {
                    bg = 'transparent';
                    border = '2px solid #2C2C2E';
                    textColor = '#48484A';
                  } else if (cell.status === '1') {
                    bg = '#30D158';
                    border = '2px solid #30D158';
                    textColor = '#04240D';
                  } else if (cell.status === '0') {
                    bg = '#FF453A';
                    border = '2px solid #FF453A';
                    textColor = '#380705';
                  }

                  if (cell.isToday) {
                    border = '2px solid #FFFFFF';
                  }

                  return (
                    <div
                      key={ci}
                      style={{
                        display: 'flex',
                        width: cellSize,
                        height: cellSize,
                        marginRight,
                        borderRadius: Math.floor(cellSize * 0.28),
                        background: bg,
                        border,
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'Noto Sans',
                        fontWeight: cell.isToday ? 700 : 400,
                        fontSize: Math.floor(width * 0.032),
                        color: textColor,
                      }}
                    >
                      {cell.day}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts: [
        { name: 'Noto Sans', data: fontRegular, weight: 400, style: 'normal' },
        { name: 'Noto Sans', data: fontBold, weight: 700, style: 'normal' },
      ],
    }
  );
}
