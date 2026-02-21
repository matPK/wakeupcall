# Operator Checklist

## 1. Create Discord app + bot token

1. Go to Discord Developer Portal -> Applications -> New Application.
2. Open your app -> `Bot` -> `Add Bot`.
3. Under `Token`, click `Reset Token` and copy it once.
4. Save it in your local `.env` as `DISCORD_BOT_TOKEN`.

## 2. Configure intents

1. In app `Bot` settings, enable:
2. `MESSAGE CONTENT INTENT`.
3. `SERVER MEMBERS INTENT` is not required for this app.
4. Save changes.

## 3. Add bot to your Discord account scope (DM usage)

1. In `OAuth2 -> URL Generator`, select scopes:
2. `bot`
3. Permissions: `Send Messages`, `Read Message History`.
4. Open generated URL and authorize bot to at least one server (required so bot account is active).
5. Open a DM with your bot user.

## 4. Get your Discord user ID (owner gate)

1. Discord `User Settings -> Advanced -> Developer Mode` = ON.
2. Right-click your username/avatar -> `Copy User ID`.
3. Put this in `.env` as `DISCORD_OWNER_ID`.

## 5. Create `.env`

Create `.env` in project root with these keys:

- `DISCORD_BOT_TOKEN`
- `DISCORD_OWNER_ID`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional; default `gpt-5-nano`)
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `DB_DIALECT`
- `TRELLO_API_KEY` (optional for Trello sync)
- `TRELLO_TOKEN` (optional for Trello sync)
- `TRELLO_BOARD_ID` (optional for Trello sync)
- `TRELLO_TODO_LIST_ID` (optional for Trello sync)
- `TRELLO_DONE_LIST_ID` (optional for Trello sync)

## 6. Install dependencies

```bash
npm install
```

## 7. Run migrations

```bash
npm run migrate
```

## 8. Run bot

```bash
npm run bot
```

DM commands to the bot from your owner account only:

- `help`
- `list`
- `nudge: ...`
- `snooze: <id> ...`
- `done: <id>`
- `config: ...`

## 9. Run runner manually

```bash
npm run runner
```

If Trello vars are configured, runner will also sync tasks to Trello.

## 10. Cron setup (Linux/macOS)

Run every minute:

```cron
* * * * * cd /path/to/wakeupcall && /usr/bin/npm run runner >> /path/to/wakeupcall/runner.log 2>&1
```

## 11. Task Scheduler setup (Windows alternative)

1. Create Basic Task -> Daily -> Repeat every `1 minute` for `Indefinitely`.
2. Action: Start a program:
3. Program/script: `C:\Windows\System32\cmd.exe`
4. Add arguments:

```text
/c cd /d C:\Users\matpk\sites\wakeupcall && npm run runner >> runner.log 2>&1
```
