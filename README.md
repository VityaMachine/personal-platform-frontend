# personal-platform-frontend

Frontend таскменеджера на Next.js, React і TypeScript.

## Локальний запуск

1. Встановіть залежності: `npm install`.
2. Скопіюйте `.env.example` у `.env.local`. За замовчуванням `NEXT_PUBLIC_API_URL=http://localhost:4000/api`.
3. Запустіть backend. Його CORS має дозволяти адресу frontend (локально `http://localhost:3000`).
4. Запустіть `npm run dev` та відкрийте `http://localhost:3000`.

Після зміни `NEXT_PUBLIC_API_URL` перезапустіть dev-сервер; для production виконайте нову збірку, оскільки Next.js вбудовує публічні змінні у клієнтський код.

## API

- `GET /tasks` — масив `{ id, title, description?, isCompleted }`.
- `POST /tasks` — `{ title, description? }`.
- `PATCH /tasks/:id` — `{ isCompleted: boolean }`.
- `DELETE /tasks/:id` — видалення задачі.

Після створення, зміни статусу або видалення список завантажується повторно. Якщо оновлення списку не вдалося, доступна кнопка повторного завантаження.

Перевірки: `npm run lint`, `npm run typecheck`, `npm run build`.
