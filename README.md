# wakeupcall

Local-first nudge bot with two processes:

1. Discord ingest bot (Gateway, DM-only, allowlist-gated)
2. Nudge runner (single-shot, cron-friendly, no OpenAI calls)
3. Optional Trello sync (runner-driven)

## Architecture

- `src/bot`: Discord ingest + command routing
- `src/runner`: nudgable task scanner/sender
- `src/services/trelloSyncService.js`: DB <-> Trello sync logic
- `src/providers`: swappable inbox/notifier interfaces + Discord implementations
- `src/db`: Sequelize init, models, migrations
- `src/compiler`: OpenAI TaskCompiler with strict JSON schema + zod validation
- `src/utils`: command parsing and time/quiet-hours helpers

## Command UX

Processed commands (case-insensitive):

- `help`
- `list`
- `nudge: <free text>` (AI-backed)
- `snooze: <taskId> <free text>` (AI-backed)
- `done: <taskId>`
- `explain: <taskId>` (no AI): return stored `memoryContext` notes for that task
- `config: <free text>` (AI-backed)

All other messages are ignored.

Nudge interpretation rule:

- By default, one message creates one top-level task.
- Use explicit split words like `also`, `another task`, or `separately` to create multiple top-level tasks.
- Follow-up/prep actions are treated as subtasks by default.
- The compiler may also infer a short task `category` label.

### DM-only allowlist gate

- Bot processes only DM messages from users in `DISCORD_ALLOWED_USER_IDS`.
- If `DISCORD_ALLOWED_USER_IDS` is empty, `DISCORD_OWNER_ID` is used as fallback allowlist.
- Messages from other users are ignored.
- Guild/server messages are ignored.

## Data model

### `settings`

- `key` varchar(64) PK
- `value` text

Seeded defaults:

- `max_subtasks` = `3`
- `default_nudge_window_minutes` = `120`
- `default_repeat_minutes` = `60`
- `nudge_mode` = `single` (`single|all`)
- `quiet_hours_start` = `23:00`
- `quiet_hours_end` = `07:00`
- `timezone` = `America/Sao_Paulo`

### `tasks`

- `id` int PK auto increment
- `parent_task_id` int nullable FK -> `tasks.id` with `ON DELETE CASCADE`
- `category` varchar(64) nullable (AI-inferred task category, e.g. `chores`, `home-maintenance`)
- other fields per spec (`status`, windows, nudge text, metadata, counters, timestamps)

Indexes:

- `status`
- `parent_task_id`
- `nudge_window_start`
- `last_nudged_at`

## Nudge semantics

A task is nudgable when:

- `status = pending`
- current time is inside `[nudge_window_start, nudge_window_end]`, or `now >= start` when end is null
- not in quiet hours
- repeat cooldown has elapsed (`default_repeat_minutes`)
- only top-level tasks are selected for nudging
- pending subtasks are included in the top-level nudge message
- nudge dispatch mode:
- `single`: send only the highest-priority eligible task each run
  - in multi-user mode, this means one top-priority task per target user each run
  - `all`: send every eligible task each run

On send:

- Runner sends pre-baked `nudge_text` (already contains task ID and done/snooze hints)
- Runner updates `last_nudged_at` and increments `nudge_count`
- Runner never calls OpenAI

## Trello sync

When Trello env vars are configured, each runner execution:

1. Pulls Trello status first for linked, not-done tasks.
2. Marks local task as `done` (and descendants) if card is archived or moved to configured done list.
3. Runs normal nudge flow.
4. Pushes new cards for top-level, non-archived tasks that are missing a Trello `external_id`.

Storage:

- `task_integrations` table stores provider mapping (`task_id` <-> Trello `external_id`).
- FK `task_id` uses `ON DELETE CASCADE`.

## Task completion behavior

- `done: <id>` marks the selected task **and all descendants** as `done`.

## TaskCompiler contract

- One OpenAI call per AI-backed command.
- Strict JSON schema response (`version = 1`).
- Runtime zod validation.
- On invalid output: friendly rephrase request.
- Supports `{{id}}` placeholder in `nudge_text` which is replaced post-insert.

## Scripts

- `npm run migrate`
- `npm run migrate:rollback`
- `npm run migrate:rollback:all`
- `npm run migrate:rollback -- --to 202602210001-create-settings.js`
- `npm run bot`
- `npm run runner`

## Docker Compose

This repository now includes:

- `docker-compose.yml`
- `Dockerfile`
- `.env.docker.example`

Services in compose:

- `db` (MySQL 8.4)
- `migrate` (one-shot migration runner)
- `bot` (Discord ingest process)
- `runner` (loop that runs `npm run runner` every `RUNNER_INTERVAL_SECONDS`)
- `portainer` (optional container management UI)
- `adminer` (optional DB UI)

MySQL root password is randomised by the container (`MYSQL_RANDOM_ROOT_PASSWORD=yes`); use `DB_USER` / `DB_PASSWORD` for the app and Adminer.

### Quick start

1. Copy `.env.docker.example` to `.env` and fill required secrets.
2. Start core services:
   - `docker compose up -d --build`
3. Optional tooling UI:
   - `docker compose --profile tools up -d`

Useful URLs (when tools profile is enabled):

- Portainer: `http://localhost:9000` (or `https://localhost:9443`)
- Adminer: `http://localhost:8080`

Note: these ports are bound to `127.0.0.1` in compose for safety. On a VPS, use SSH tunneling or change port bindings if you intentionally want public access.
