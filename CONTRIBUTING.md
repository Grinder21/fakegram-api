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
npm run prisma:deploy         # применить готовые миграции
npm run start:dev             # запустить сервер
```

## Работа с базой данных

Команды используют подключение `DATABASE_URL` из окружения или `.env`.
Перед запуском PostgreSQL должен быть доступен.

После изменения `prisma/schema.prisma` создай миграцию с понятным названием
и обнови сгенерированный клиент:

```bash
npm run prisma:migrate -- --name add_feature
npm run prisma:generate
```

Часть после `--` передаётся Prisma CLI. В этом примере Prisma получает
`migrate dev --name add_feature`. Команда предназначена для разработки
и может предложить сброс при расхождении схемы БД с историей миграций.

После получения чужих миграций из репозитория достаточно:

```bash
npm run prisma:deploy
npm run prisma:generate
```

`prisma:deploy` применяет готовые миграции, а `prisma:migrate` также умеет
создавать новые. Состояние миграций покажет `npm run prisma:status`.
Для просмотра и редактирования данных запусти `npm run prisma:studio`.

### Демонстрационные данные

После применения миграций выполни:

```bash
npm run db:seed
```

Prisma запускает `prisma/seed.ts` через `tsx`. Команда прописана в
`migrations.seed` файла `prisma.config.ts`. Seed создаёт пользователей Alice
и Bob, альбом Alice с фотографией и комментарий Bob к этой фотографии.

| Email | Username | Демонстрационный пароль |
| --- | --- | --- |
| `seed.alice@fakegram.test` | `seed_alice` | `FakegramDemo9!` |
| `seed.bob@fakegram.test` | `seed_bob` | `FakegramDemo9!` |

Пароли сохраняются как bcrypt-хеши, как при обычной регистрации. Эти аккаунты
предназначены для локальной разработки; при `NODE_ENV=production` seed
завершится ошибкой до подключения к БД.

Записи создаются одной транзакцией. Повторный запуск использует `upsert`:
пользователи находятся по email, остальные записи — по постоянным UUID.
Существующие записи сохраняются без перезаписи полей, поэтому изменённый
вручную пароль или подпись фотографии не сбросятся. Новые экземпляры данных
при повторном запуске не создаются.

### Сброс локальной базы

`npm run prisma:reset` удаляет все данные в базе из `DATABASE_URL`
и заново применяет миграции. Команда требует подтверждения. После сброса
демонстрационные данные нужно добавить явно:

```bash
npm run prisma:reset
npm run prisma:generate
npm run db:seed
```

В Prisma 7 `migrate dev` и `migrate reset` не запускают seed автоматически.

## Тестирование

Unit-тесты запускаются через `npm test`. Перед pull request также выполни
`npm run typecheck`, `npm run lint`, `npm run test:cov` и `npm run build`.
Подробности настройки и учебный пример — в [docs/testing.md](docs/testing.md).

HTTP E2E-тесты запускаются отдельно: `npm run test:e2e`. Они используют настоящие
сервисы и отдельную базу `fakegram_e2e` на существующем PostgreSQL.

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
