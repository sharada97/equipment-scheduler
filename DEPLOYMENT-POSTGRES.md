# Deployment: PostgreSQL + Vercel

This branch uses **PostgreSQL** instead of SQLite, allowing you to deploy to **Vercel for free** with instant performance.

## Cost
- **Vercel**: Free
- **Neon (PostgreSQL)**: Free tier (5GB storage, enough for most use cases)
- **Total**: $0/month

## Setup Steps

### Step 1: Create a PostgreSQL Database (Neon)

1. Go to [https://neon.tech](https://neon.tech) and sign up
2. Create a new project (takes ~30 seconds)
3. Copy your connection string — it looks like:
   ```
   postgresql://user:password@host:5432/neondb
   ```
4. Save this string — you'll need it in Step 3

### Step 2: Deploy to Vercel

1. Push this branch to GitHub:
   ```bash
   git push origin postgres-vercel
   ```

2. Go to [https://vercel.com](https://vercel.com) and sign up
3. Click "New Project" → Connect your GitHub repo
4. Select the `postgres-vercel` branch
5. Click "Deploy"

### Step 3: Add Database Connection String

1. After deployment starts, go to your Vercel project → Settings → Environment Variables
2. Add a new variable:
   - **Name**: `DATABASE_URL`
   - **Value**: Paste your Neon connection string from Step 1
3. Redeploy (click "Deployments" → click the latest deploy → "Redeploy")

### Step 4: Test

1. Visit your Vercel URL
2. Create an event and book a slot
3. Refresh the page — data should persist
4. You're live!

## Why This Works

- **Neon** is a managed PostgreSQL service (free tier included)
- **Vercel** auto-deploys on every push and is always-on (no cold starts like Render's free tier)
- **PostgreSQL** is stateless — no disk needed, so Vercel can host it

## Next Time

Every time you push to `postgres-vercel` branch, Vercel automatically redeploys. Your database data persists in Neon.

## Local Development

To run this locally:

1. Create a local PostgreSQL database or use Neon's connection string
2. Create `.env.local`:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/labslot
   ```
3. Run `npm run dev`
4. Visit http://localhost:3000

## Going Back to SQLite

If you want to switch back to SQLite (Render deployment):
1. Switch to the `main` branch
2. Follow the deployment steps in the main README
