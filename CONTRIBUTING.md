# Contributing

Руководство по локальной разработке и участию в проекте.

## Подготовка окружения

### Требования

- Node.js 24.x LTS — точная версия в `.nvmrc`; сначала `nvm install`, затем `nvm use`
- Docker Desktop
- Git

Границы версий описаны в `engines` (`package.json`) и проверяются строго: в `.npmrc` включён
`engine-strict=true`, поэтому `npm install` на Node 22 или 25 завершится ошибкой, а не предупреждением.

### Первый запуск

```bash
git clone https://github.com/Grinder21/fakegram-api.git
cd fakegram-api

# macOS/Linux, если nvm уже установлен
nvm install
nvm use

cp .env.example .env
# заполни .env (см. README.md → «Запуск проекта локально»)

docker compose up -d          # поднять PostgreSQL
npm install                   # установить зависимости
npm run prisma:deploy         # применить готовые миграции
npm run start:dev             # запустить сервер
```

Для Windows используй шаг с nvm-windows из
[README](README.md#1-клонировать-репозиторий). Если PowerShell блокирует
`npm.ps1`/`npx.ps1`, запускай `npm.cmd`/`npx.cmd`.

### Ошибка DATABASE_URL при установке зависимостей

`npm install` запускает `postinstall` → `prisma generate`. Конфигурация
`prisma.config.ts` загружает `.env` и читает `DATABASE_URL` уже при генерации
клиента; соединение с PostgreSQL для самой генерации не требуется.

Если установка заканчивается сообщением
`PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`,
проверь, что в корне проекта есть файл `.env`, а в нём — непустой `DATABASE_URL`.
Если файла нет, скопируй `.env.example` и заполни JWT-секрет по README.

Самопроверка разбора `.env` (значения секретов не выводятся):

```bash
node -e "const env = require('dotenv').parse(require('node:fs').readFileSync('.env')); if (!env.DATABASE_URL) throw new Error('DATABASE_URL is missing or empty'); const url = new URL(env.DATABASE_URL); console.log({ postgresUrl: ['postgres:', 'postgresql:'].includes(url.protocol), hasHost: Boolean(url.hostname), hasDatabase: url.pathname.length > 1, missing: ['NODE_ENV', 'JWT_ACCESS_SECRET', 'ACCESS_TOKEN_TTL', 'REFRESH_TOKEN_TTL_DAYS'].filter(key => !env[key]) });"
```

После заполнения `.env` ожидаются три значения `true` и пустой список
`missing`. `ENOENT` означает, что файла `.env` нет; ошибка URL или `false` —
что строка подключения повреждена. Каждая переменная должна быть на отдельной
строке: потерянный перенос может приклеить `NODE_ENV` или другой ключ к URL,
и этот ключ попадёт в список `missing`.

Также проверь переменную `DATABASE_URL` в окружении терминала: она имеет
приоритет над `.env`. После исправления повтори `npm install`. Если зависимости
уже установлены и упал только `postinstall`, достаточно `npm run postinstall`.

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

| Email                      | Username     | Демонстрационный пароль |
| -------------------------- | ------------ | ----------------------- |
| `seed.alice@fakegram.test` | `seed_alice` | `FakegramDemo9!`        |
| `seed.bob@fakegram.test`   | `seed_bob`   | `FakegramDemo9!`        |

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

## Сборка и отладка

Source map (`.js.map`) связывает строки собранного JavaScript со строками
исходного TypeScript. Она помогает отладчику показывать исходные `.ts`-файлы
и ставить в них точки остановки, а Node.js с поддержкой source maps —
указывать исходные строки в стеке ошибки.

`npm start`, `npm run start:dev` и `npm run start:debug` явно используют
`tsconfig.json`, где `sourceMap: true`. Nest CLI включает поддержку source
maps при запуске Node.js. Для отладки с подключением IDE используй
`npm run start:debug`.

`npm run build` использует `tsconfig.build.json`, который переопределяет
`sourceMap` в `false`. Nest CLI очищает `dist` перед сборкой, поэтому карты
от предыдущего dev-запуска также удаляются. Готовая production-сборка
запускается командой `npm run start:prod`.

В проекте сборкой занимается SWC. Установленная версия Nest CLI передаёт
ему настройку `sourceMap` из выбранного TypeScript-конфига. В `.swcrc`
не задано отдельное переопределение `sourceMaps`.

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
