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
npx prisma migrate deploy     # применить миграции
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
