# Contributing

Руководство по локальной разработке и участию в проекте.

## Подготовка окружения

### Требования

- Node.js 24.x LTS — точная версия в `.nvmrc` (`nvm use`)
- Docker Desktop
- Git

Границы версий описаны в `engines` (`package.json`) и проверяются строго: в `.npmrc` включён
`engine-strict=true`, поэтому `npm install` на Node 22 или 25 завершится ошибкой, а не предупреждением.

### Первый запуск

```bash
git clone <repo-url>
cd fakegram-api

cp .env.example .env
# заполни .env (см. README.md → «Запуск проекта локально»)

docker compose up -d          # поднять PostgreSQL
npm install                   # установить зависимости
npx prisma migrate deploy     # применить миграции
npm run start:dev             # запустить сервер
```

## Переменные окружения

Переменные проверяются при старте схемой в `src/common/env.validation.ts`: приложение не запустится,
если обязательная переменная не задана или значение некорректно. Примеры значений — в `.env.example`.

| Переменная               | Описание                                                            | По умолчанию            |
| ------------------------ | ------------------------------------------------------------------- | ----------------------- |
| `DATABASE_URL`           | Строка подключения к PostgreSQL (`postgres://` или `postgresql://`) | обязательна             |
| `JWT_ACCESS_SECRET`      | Секрет для подписи access-токенов, минимум 32 символа               | обязательна             |
| `ACCESS_TOKEN_TTL`       | Срок жизни access-токена: число и единица `s`/`m`/`h`/`d`           | обязательна             |
| `REFRESH_TOKEN_TTL_DAYS` | Срок жизни refresh-токена в днях, целое число от 1                  | обязательна             |
| `NODE_ENV`               | Окружение: `development`, `production` или `test`                   | обязательна             |
| `PORT`                   | Порт HTTP-сервера, 1–65535                                          | `3000`                  |
| `COOKIE_SECURE`          | Форсировать Secure у refresh-cookie вне production: `true`/`false`  | `false`                 |
| `CLIENT_ORIGIN`          | Origin фронтенда (CORS)                                             | `http://localhost:5173` |
