# 🚀 GitHub + GitHub Pages Setup

**Goal:** get your project online so coworkers can play at a URL AND edit the code with proper version control.

You need Git (already installed — v2.53 ✅) and a free GitHub account. The rest takes about 5 minutes.

---

## Step 1 — Create the GitHub repository (web, ~60 s)

1. Go to **https://github.com/new**
2. Sign in if you haven't
3. Fill in:
   - **Repository name:** `LevelX`
   - **Description:** "Shardfall Expedition — 2D action platformer"
   - **Public** (required for free GitHub Pages hosting) — or Private if you'd rather not
   - **Do NOT** check "Add a README" — we already have one
   - **Do NOT** add .gitignore or license (we have them)
4. Click **Create repository**
5. GitHub will show you a URL like `https://github.com/YOUR_USERNAME/LevelX.git` — **copy it**

---

## Step 2 — Push your project (terminal, ~60 s)

Open **PowerShell** in the `LevelX` folder. (Easy way: right-click inside the folder in File Explorer → **Open in Terminal**.)

Paste these commands one at a time. Replace `YOUR_USERNAME` with your actual GitHub username:

```powershell
git init
git add .
git commit -m "Initial commit: LevelX Shardfall Expedition"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/LevelX.git
git push -u origin main
```

When the `push` command runs, your browser will open (or a terminal prompt will ask) to authenticate. Approve it — Git stores the credential for you.

**If you get an auth error:** run `git config --global credential.helper manager-core` first, then retry the push.

---

## Step 3 — Enable GitHub Pages (web, ~30 s)

1. Go to **https://github.com/YOUR_USERNAME/LevelX/settings/pages**
2. Under **"Build and deployment"**:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` · **Folder:** `/ (root)`
3. Click **Save**
4. Wait about 30–60 seconds. Refresh the page. You'll see a green banner with your live URL:

   **`https://YOUR_USERNAME.github.io/LevelX/mojiworld_game.html`**

This is the URL you send to coworkers. They click, game loads, they play — no installs.

---

## Step 4 — Invite coworkers to edit (web, ~30 s)

1. Go to **https://github.com/YOUR_USERNAME/LevelX/settings/access**
2. Click **Add people**
3. Enter their GitHub username or email
4. Choose **Write** (they can push directly) or **Triage** (they must open PRs that you approve)
5. They receive an email invite → accept → they're in

From their end, they'll:
```powershell
git clone https://github.com/YOUR_USERNAME/LevelX.git
cd LevelX
# edit mojiworld_game.html in any editor
git add .
git commit -m "describe change"
git push
```

And GitHub Pages auto-redeploys within a minute — the live URL reflects their edit.

---

## Step 5 — Edit workflow going forward

Every time YOU edit the game:

```powershell
git add .
git commit -m "describe change"
git push
```

Live URL updates automatically.

---

## 📋 Rollback if needed

Bad commit? Revert instantly:
```powershell
git revert HEAD
git push
```

Or roll back to a specific commit:
```powershell
git log --oneline        # find the commit hash you want
git reset --hard abc123  # hash of the good commit
git push --force         # careful — rewrites history
```

---

## 🤝 Reviewing coworker changes

When coworkers with **Triage** access open a Pull Request:

1. Go to **https://github.com/YOUR_USERNAME/LevelX/pulls**
2. Click the PR → review the diff
3. Click **Merge pull request** if you approve, or leave comments

Their changes go live within 60 s of merge.

---

## 🆘 Troubleshooting

| Problem | Fix |
|---|---|
| `git push` asks for password | Modern GitHub requires a Personal Access Token (PAT), not your password. Generate at **https://github.com/settings/tokens** — give it `repo` scope. Paste as password when prompted. Windows will cache it. |
| `Permission denied (publickey)` | You used the SSH URL instead of HTTPS. Switch with `git remote set-url origin https://github.com/YOUR_USERNAME/LevelX.git` |
| Pages URL shows 404 | Wait 2 minutes on first deploy. Refresh. If still 404, check Settings → Pages that the source is `main` and root. |
| Big file warning | `.gitignore` already excludes junk. If you add huge binary files, use [Git LFS](https://git-lfs.com/). |

---

## 🎯 When you're done

Your coworkers get **one URL to play** and **one repo URL to edit**. That's the whole flow.

Run the commands in Step 2 whenever you want to push new changes. Everything else is self-serve from the GitHub web UI.
