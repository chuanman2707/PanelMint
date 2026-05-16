# Local Generation Workflow

This workflow uses `examples/sample-manuscript.md` for a small first run.

## 1. Install And Configure

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma generate
npx prisma migrate deploy
```

Open `.env` and set:

```bash
WAVESPEED_API_KEY=your_key_here
```

## 2. Start The App

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run worker
```

Open `http://localhost:3000`.

## 3. Create A Comic

1. Open the create screen.
2. Paste the contents of `examples/sample-manuscript.md` into the manuscript field.
3. Keep the default generation settings for the first run.
4. Submit the run.
5. Wait for analysis to complete.
6. Review and approve the analysis.
7. Review and approve the storyboard.
8. Start image generation.

The worker terminal should show queued jobs being claimed and completed.

## 4. Check Output

Generated image files are stored under:

```text
.panelmint/generated
```

The app serves those files through its storage API, so the reader and editor should keep working after an app restart.

## 5. Health Check

```bash
curl http://localhost:3000/api/health
```

Expected when fully configured:

```json
{
  "status": "ready"
}
```

If `WAVESPEED_API_KEY` is missing, health reports degraded generation readiness. Add the key to `.env`, then restart the app and worker.
