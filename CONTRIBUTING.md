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
