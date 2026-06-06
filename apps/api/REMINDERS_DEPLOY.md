# Деплой push-напоминаний (Fly)

Серверные push-напоминания о кормлении работают как in-process BullMQ-воркер
внутри Fly-машины API. Это требует long-running процесса и Redis.

## Жёсткий инвариант рантайма

`VITE_API_URL` (веб-клиент) ОБЯЗАН указывать на **Fly-origin** API, НИКОГДА на
Vercel-деплой API. Только Fly-рантайм запускает воркер (`main.ts` →
`startReminderWorker()`) и имеет `REDIS_URL`. Если веб бьёт в Vercel-API, hook
reschedule выполнится там, где нет воркера/Redis — задача либо упадёт (молча
проглотится try/catch), либо ляжет в Redis, который никто не дренит. Защита:
громкий лог в hook (`feedings.ts`) + boot-ping (`scheduler/queue.ts`).

## fly.toml (уже настроено)

- `auto_stop_machines = "off"` — спящая машина не тикает напоминания.
- `min_machines_running = 1` — хотя бы одна машина всегда жива.
- Память 256mb: BullMQ Worker + ioredis для one-user ОК; при OOM поднять до 512mb.

Dockerfile менять НЕ нужно: `CMD ["node", "dist/main.js"]` уже стартует воркер,
а `web-push`/`bullmq`/`ioredis` лежат в `dependencies` → попадают в
`pnpm deploy --prod`.

## Шаги деплоя

1. **Создать Fly Redis** (Upstash под капотом) в том же регионе `fra`:
   ```sh
   fly redis create        # выбрать регион fra; получить REDIS_URL (приватный)
   ```

2. **Прописать секреты** (НЕ коммитить — это прод-значения, отдельные от
   локальных `.env.local`):
   ```sh
   fly secrets set \
     REDIS_URL='redis://…' \
     VAPID_PUBLIC_KEY='…' \
     VAPID_PRIVATE_KEY='…' \
     VAPID_SUBJECT='mailto:you@example.com' \
     PUSH_DEBUG_SECRET='…' \
     -a leon-api
   ```
   VAPID-пара генерится один раз (`node -e "console.log(require('web-push').generateVAPIDKeys())"`)
   и должна СОВПАДАТЬ с тем, что отдаёт `GET /api/push/vapid-public-key` (клиент
   всегда берёт public-ключ оттуда — не хардкодить).

3. **Задеплоить** (контекст = корень репо):
   ```sh
   fly deploy . -a leon-api --config apps/api/fly.toml
   ```

4. **Проверить** после деплоя:
   ```sh
   fly secrets list -a leon-api          # REDIS_URL + VAPID_* присутствуют
   fly logs -a leon-api | grep reminders  # "[reminders] Redis reachable" + "worker started"
   ```

## Vercel-статика (web)

Service worker и манифест отдаются из `apps/web/public/` как статика. Проверить
после деплоя web, что content-type корректен:
- `/sw.js` → `text/javascript` (или `application/javascript`)
- `/manifest.webmanifest` → `application/manifest+json`

Если Vercel отдаёт неверный content-type — добавить `vercel.json` headers.

## iOS

Web Push на iOS работает ТОЛЬКО из установленной PWA (Safari 16.4+):
«Поделиться → На экран „Домой“», затем открыть с домашнего экрана. В обычной
вкладке Safari `PushManager` отсутствует — UI показывает инструкцию вместо
кнопки «Включить».
