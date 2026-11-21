# Mayhem Library — Automatic Augments for GitHub Pages (NO Codespaces)

This version is designed for editing files directly at **github.com/qilue-snail/Mayhem**. You do not need Codespaces, a terminal, or to run Python yourself.

## Install using GitHub's website

1. On your live Mayhem Library, click **Export All** and keep the JSON backup.
2. Unzip this package on your computer. Your existing `index.html`, `styles.css`, and `app.js` are **not replaced by any files in this ZIP**.
3. Open https://github.com/qilue-snail/Mayhem and select the **main** branch.
4. Add the five files below to your repository, preserving their folder paths. For existing files, use the GitHub editor to update their content. The file upload UI may not accept nested folder uploads on every browser; you can create each file using **Add file → Create new file**, typing its full path (for example `.github/workflows/refresh-augments.yml`), then paste the file contents and **Commit changes**.

   - `install_auto_augments.py` — one-time installer executed **by GitHub Actions**, not by you.
   - `scripts/update_augment_roster.py` — fetches the Riot KIWI pool every six hours.
   - `data/live-augments.json` — starter fallback; refreshed automatically.
   - `.github/workflows/refresh-augments.yml` — runs installation, refreshing and deployment.
   - `.gitignore` — excludes the one-time backup `app.js.bak` from commits.

5. Go to **Settings → Pages → Build and deployment**. Set **Source** to **GitHub Actions** instead of Deploy from a branch. The included workflow now handles deploying your site. If you already use a different Pages workflow, do not leave two competing deployments enabled.
6. Go to **Settings → Actions → General → Workflow permissions**. Choose **Read and write permissions** and save, if the setting is available. The workflow needs to commit the new `app.js` once and refresh `data/live-augments.json` thereafter.
7. Open **Actions → Deploy Mayhem and refresh live augments → Run workflow → Run workflow**. Refresh until the workflow finishes successfully.
8. Open your normal GitHub Pages URL. Search **Tooth Fairy** in Augments. The site now prioritizes the live KIWI game-data roster, not delayed pick-rate stats.

## How it keeps working

- GitHub automatically checks the current KIWI augment pool every six hours and publishes the refreshed site when available.
- The site also checks the current data when someone visits or clicks Refresh.
- New and returning augments can appear without requiring you to ask ChatGPT or upload a patch by hand.
- If the live game-data service is down or publishes implausibly incomplete data, the updater refuses to replace the last good roster.
- Browser builds and layout settings remain in the same localStorage keys.
- Match pick rate is optional; it does not determine whether an augment is listed.

## Notes

- GitHub Pages alone cannot execute Python. GitHub **Actions** executes the installer and updater on GitHub's own runners.
- This is not proof of server-side availability. Riot sometimes disables augments in-game without immediately updating public client data.
- On the first workflow run, check that the commit **Automatically load and refresh current KIWI augments** appears in your repository. The workflow fails loudly if it cannot save app.js back to main.
- If the workflow reports `Resource not accessible by integration`, review **Settings → Actions → General → Workflow permissions** and branch protection rules for `main`. Your GitHub account must have permission to change those settings.
- If `data/live-augments.json` stays a 5-entry seed, inspect the Actions logs: CommunityDragon was unavailable or the source format changed. It will try again at the next scheduled run.
- The workflow publishes the root `index.html`, `styles.css`, `app.js`, and `data/live-augments.json`. If you later add additional local files needed by the website, include them in the `Assemble public static site` step.
