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

| Переменная               | Описание                          | Пример                                     |
| ------------------------ | --------------------------------- | ------------------------------------------ |
| `DATABASE_URL`           | Строка подключения к PostgreSQL   | `postgresql://user:pass@localhost:5432/db` |
| `JWT_ACCESS_SECRET`      | Секрет для подписи access-токенов | случайная строка 32+ символа               |
| `ACCESS_TOKEN_TTL`       | Срок жизни access-токена          | `15m`                                      |
| `REFRESH_TOKEN_TTL_DAYS` | Срок жизни refresh-токена в днях  | `30`                                       |
| `COOKIE_SECURE`          | Форсировать Secure у cookie       | `false`                                    |
| `CLIENT_ORIGIN`          | Origin фронтенда (CORS)           | `http://localhost:3000`                    |
| `NODE_ENV`               | Окружение                         | `development`                              |
| `PORT`                   | Порт                              | `3000`                                     |
