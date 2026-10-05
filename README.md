# Client Galleries (Google Drive backend)

A branded, mobile-first client gallery for photos **and** video. You drop files into a Google Drive folder; the site picks them up automatically.

- Full-screen cover, justified photo grid, dark/light mode
- Lightbox with swipe, pinch-zoom, double-tap zoom, swipe-down to close, keyboard arrows
- Videos stream from Drive with seeking (HTTP range requests), shown with a poster frame and duration
- Clients heart favorites, add notes per photo or clip, and send their picks → rows land in a Google Sheet (+ optional email)
- Per-gallery password, per-file download, and "Download all" as a .zip (everything / photos / films)
- Files stay private in Drive — nothing needs to be shared publicly

- **Owner dashboard at `/admin`**: sign in with Google, create galleries, drag in photos and films (they upload straight into your Drive), set passwords, pick the cover, copy the client invite
- Every gallery link ends in a private code (e.g. `/g/lakeshore-brand-film-3fa9c2`), so clients can only reach their own gallery

It runs in **demo mode** with sample media until you add Google credentials, so you can try it first.

```bash
npm install
npm run dev        # http://localhost:3000
```

---

## How Drive maps to the site

```
CLIENTS/                              ← created by the dashboard; nothing outside it is touched
├── Lakeshore CU — Brand Film/        → yoursite.com/g/lakeshore-cu-brand-film-3fa9c2
│   ├── gallery.json                  (optional settings)
│   ├── cover.jpg                     (optional hero image, hidden from grid)
│   ├── 01 Hero cut.mp4
│   ├── 02 Social 9x16.mp4
│   └── stills-001.jpg …
├── Fall Leadership Conference/
└── _Work in progress/                ← folders starting with _ stay hidden
```

- **Folder name = gallery title**. The link is the name plus a private code, so renaming changes the link.
- Use the dashboard to create galleries and upload. The app signs in with the `drive.file` permission, so it can only see and change the folders and files it created — never the rest of your Drive.
- Files are sorted by name (natural order), so prefix with numbers to control order.
- Files starting with `_` or `.` are skipped.
- No `cover.*` file? The first photo is used.
- New uploads appear within `CACHE_SECONDS` (default 60s).

### `gallery.json` (all fields optional)

```json
{
  "client": "Lakeshore Credit Union",
  "date": "2026-09-18",
  "message": "Final cuts and stills from the shoot. Heart anything you'd like to use.",
  "password": "lakeshore26",
  "downloads": true,
  "cover": "stills-014.jpg"
}
```

Changing the password signs out anyone who unlocked the old one.

---

## One-time setup (≈15 minutes)

### 1. Google Cloud service account
1. Go to <https://console.cloud.google.com/> → create a project (e.g. "Client Galleries").
2. **APIs & Services → Library** → enable **Google Drive API** and **Google Sheets API**.
3. **IAM & Admin → Service Accounts → Create service account** (no roles needed).
4. Open it → **Keys → Add key → JSON**. A `.json` file downloads. Keep it private.
5. Copy the service account's email (looks like `galleries@your-project.iam.gserviceaccount.com`).

### 2. Owner sign-in (OAuth client)
1. **APIs & Services → OAuth consent screen**: User type **External**, app name e.g. "Client Galleries", your email as support + developer contact. Add yourself as a test user, then click **Publish app** (drive.file is a non-sensitive scope, so no Google review is needed).
2. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.**
3. Authorized redirect URI: `https://client-galleries.vercel.app/api/auth/callback` (and `http://localhost:3000/api/auth/callback` for local testing).
4. Copy the **Client ID** and **Client secret**.

The **CLIENTS** folder is created and shared with the service account automatically the first time you make a gallery in the dashboard.

### 3. Selections sheet
1. Create a Google Sheet. Put these headers in row 1:
   `Time | Gallery | Name | Email | File | Note | Drive link | Message`
2. Share it with the service account email as **Editor**.
3. Copy the ID from the URL: `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.
4. Optional: **Tools → Notification settings → Edit notifications → Any changes are made** to get an email when picks arrive (no extra service needed).

### 4. Environment variables
Copy `.env.example` to `.env.local` and fill in:

| Variable | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Entire contents of the JSON key (or base64 of it) |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | From step 2 |
| `OWNER_EMAILS` | Your Google account, e.g. `mylesazalewa@gmail.com` |
| `SELECTIONS_SHEET_ID` | Sheet ID from step 3 |
| `GALLERY_SECRET` | Any long random string |
| `STUDIO_NAME`, `STUDIO_TAGLINE`, `STUDIO_URL`, `STUDIO_EMAIL` | Your branding |
| `SHOW_INDEX` | `true` to list unlocked galleries on the home page (off by default) |
| `RESEND_API_KEY`, `NOTIFY_EMAIL` | Optional email alert via resend.com instead of Sheets notifications |

### 5. Deploy to Vercel
1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project →** import the repo (framework auto-detects as Next.js).
3. Paste the environment variables, deploy, then add your domain (e.g. `galleries.yourdomain.com`).

---

## Dashboard features

- **Sections**: add sections (Final cuts, Social versions, Stills…) to a gallery; they're subfolders in Drive. Choose a section above the drop zone to upload into it, or use “Move…” on any file.
- **Closes on**: after that date clients see a “gallery closed” page and files stop loading. Clear the date to reopen.
- **Hold downloads until paid**: clients get watermarked, reduced-size previews and no downloads. Click **Mark as paid** to unlock everything.
- **Favorites & picks**: off by default (galleries are for finished deliverables); turn on per gallery if you want clients to heart and send picks.
- **Activity**: views, unlocks, downloads and picks go to the **Client Galleries — Activity** sheet inside CLIENTS, and show on the dashboard. For email alerts, open the sheet → Tools → Notification settings → Edit notifications → “Any changes are made” → “Email – daily digest” (or “right away”).
- **Branding**: dashboard → Branding: studio name, tagline, landing headline, contact email, website, accent color, logo and a landing background (photo or short muted reel). Saved in CLIENTS/brand.json and CLIENTS/_brand.
- **Owner preview**: when you're signed in you see everything; use “See what clients see” (or add `?as=client` to a gallery link) to check the password screen, watermarks and expiry.

## Good to know

- **Export video as H.264 MP4.** Browsers can't play ProRes, and HEVC only plays in Safari. Drive also needs a few minutes after upload to generate a video's poster frame.
- **Bandwidth.** Photos are resized by Drive and cached at Vercel's edge, so they're cheap. Video plays through the server, which counts against Vercel bandwidth. For a handful of clients that's fine; if you start delivering lots of long 4K films, move playback to Cloudflare Stream or Mux and keep Drive for masters and downloads.
- **Vercel plan.** The free Hobby plan is meant for non-commercial use; client delivery is commercial, so Pro is the plan that fits.
- **"Download all" zips** stream on the fly and must finish within the function's time limit (300s here). Great for stills; for multi-GB video deliveries, link the Drive folder directly in your email.
- **Favorites** are saved on the client's device until they hit *Send picks*, so they can come back later and keep going.

## Project map

```
app/g/[slug]/page.tsx       gallery page (lock screen or gallery)
app/api/media/[id]          resized images and video posters from Drive
app/api/stream/[id]         video streaming with range/seek support
app/api/download/[id]       single-file download
app/api/zip/[slug]          zip of the whole gallery
app/api/unlock              password check → signed cookie
app/api/selections          client picks → Google Sheet (+ email)
app/admin                   owner dashboard (gallery list + gallery manager)
app/api/auth/*              Google sign-in for the owner
app/api/admin/*             create/edit/delete galleries, start uploads, remove files
components/GalleryView.tsx  hero, filters, grid, selection bar, send dialog
components/Lightbox.tsx     viewer with gestures, notes, downloads
lib/galleries.ts            reads folders/files from Drive (and demo data)
```
