# Fakegram API

Бэкенд мини-Instagram на NestJS. Реализует аутентификацию через JWT + refresh-токены, управление пользователями, альбомами, фотографиями и комментариями.

## Стек

| Слой           | Технология                               |
| -------------- | ---------------------------------------- |
| Фреймворк      | NestJS (Node.js + TypeScript)            |
| База данных    | PostgreSQL 18                            |
| ORM            | Prisma                                   |
| Аутентификация | JWT (access) + httpOnly cookie (refresh) |
| Валидация      | class-validator / class-transformer      |
| Запуск БД      | Docker Compose                           |

---

## Запуск проекта локально

### Предварительные требования

- [Node.js](https://nodejs.org/) 24.x LTS. Точная версия — в `.nvmrc`, так что `nvm use` подхватит её сам
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (для PostgreSQL)
- npm

> Диапазон допустимых версий Node и npm задан в `engines` (`package.json`), а `engine-strict=true`
> в `.npmrc` заставляет `npm install` падать с внятной ошибкой на чужом мажоре вместо тихого warning.

### 1. Клонировать репозиторий

```bash
git clone <repo-url>
cd fakegram-api
```

### 2. Создать файл `.env`

```bash
cp .env.example .env
```

Значения из `.env.example` подходят для локальной разработки. Заполнить нужно только `JWT_ACCESS_SECRET` —
сгенерировать случайную строку минимум из 32 символов:

```bash
openssl rand -base64 32
```

На Windows без OpenSSL то же самое делает Node:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Переменные окружения проверяются при старте (`src/common/env.validation.ts`): если обязательная переменная
не задана или значение некорректно, приложение не запустится и назовёт переменную в сообщении об ошибке.
Описание всех переменных — в [CONTRIBUTING.md](CONTRIBUTING.md#переменные-окружения).

### 3. Поднять базу данных

```bash
docker compose up -d
```

Проверить что контейнер запустился:

```bash
docker compose ps
```

### 4. Установить зависимости и применить миграции

```bash
npm install
npx prisma migrate deploy
```

### 5. Запустить сервер

```bash
# dev-режим с hot reload
npm run start:dev

# или обычный запуск
npm run start
```

API доступен на `http://localhost:3000`.

---

## Эндпоинты

### Auth

| Метод | Путь             | Доступ     | Описание                |
| ----- | ---------------- | ---------- | ----------------------- |
| POST  | `/auth/register` | Публичный  | Регистрация             |
| POST  | `/auth/login`    | Публичный  | Вход                    |
| POST  | `/auth/refresh`  | Публичный  | Обновить access-токен   |
| POST  | `/auth/logout`   | Bearer JWT | Выход со всех устройств |
| GET   | `/auth/me`       | Bearer JWT | Текущий пользователь    |

### Остальные ресурсы (в разработке)

| Метод        | Путь        | Доступ | Описание     |
| ------------ | ----------- | ------ | ------------ |
| GET/POST/... | `/users`    | —      | Пользователи |
| GET/POST/... | `/albums`   | —      | Альбомы      |
| GET/POST/... | `/photos`   | —      | Фотографии   |
| GET/POST/... | `/comments` | —      | Комментарии  |

### Пример: регистрация

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "secret123",
  "displayName": "John Doe"
}
```

Ответ `201`:

```json
{
  "accessToken": "eyJhbGci...",
  "user": { "id": "...", "username": "johndoe", "email": "user@example.com" }
}
```

Refresh-токен устанавливается в httpOnly cookie `refreshToken`. В ответе тела его **нет**.

### Пример: использование access-токена

```http
GET /auth/me
Authorization: Bearer eyJhbGci...
```

### Пример: обновление токенов

```http
POST /auth/refresh
Cookie: refreshToken=<uuid>:<hex>
```

Ответ `200` — новый `accessToken` в теле, новый `refreshToken` в cookie (старый инвалидируется).

---

## Как устроена аутентификация

```
Клиент                          Сервер
  │                               │
  │── POST /auth/login ──────────►│
  │                               │ 1. Проверяет пароль (bcrypt)
  │                               │ 2. Создаёт запись RefreshToken в БД (хранит bcrypt-хэш)
  │                               │ 3. Выдаёт accessToken (JWT, 15 мин)
  │◄─ 200 + Set-Cookie ──────────│    refreshToken в httpOnly cookie (30 дней)
  │
  │ ... через 15 минут accessToken истёк ...
  │
  │── POST /auth/refresh ────────►│
  │   Cookie: refreshToken=id:raw │ 1. Ищет запись по id
  │                               │ 2. Сверяет raw с хэшем в БД (bcrypt.compare)
  │                               │ 3. УДАЛЯЕТ старую запись (rotation!)
  │                               │ 4. Создаёт новую запись
  │◄─ 200 + Set-Cookie ──────────│ 5. Выдаёт новый accessToken + новый refreshToken
```

**Ключевые решения:**

- Refresh-токен хранится в БД как bcrypt-хэш — утечка таблицы не даёт рабочих токенов
- Формат cookie: `<uuid-записи>:<40-байт-hex>` — быстрый поиск по id, проверка по хэшу
- Rotation: старый refresh удаляется при каждом `/refresh` — replay attack невозможен
- Один пользователь может иметь **несколько** refresh-токенов (multi-device)
- `/auth/logout` удаляет **все** refresh-токены пользователя — выход завершает
  сессии на всех устройствах сразу
