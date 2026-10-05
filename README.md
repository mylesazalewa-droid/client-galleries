# Client Galleries (Google Drive backend)

A branded, mobile-first client gallery for photos **and** video. You drop files into a Google Drive folder; the site picks them up automatically.

- Full-screen cover, justified photo grid, dark/light mode
- Lightbox with swipe, pinch-zoom, double-tap zoom, swipe-down to close, keyboard arrows
- Videos stream from Drive with seeking (HTTP range requests), shown with a poster frame and duration
- Clients heart favorites, add notes per photo or clip, and send their picks → rows land in a Google Sheet (+ optional email)
- Per-gallery password, per-file download, and "Download all" as a .zip (everything / photos / films)
- Files stay private in Drive — nothing needs to be shared publicly

It runs in **demo mode** with sample media until you add Google credentials, so you can try it first.

```bash
npm install
npm run dev        # http://localhost:3000
```

---

## How Drive maps to the site

```
Client Galleries/                     ← DRIVE_ROOT_FOLDER_ID
├── Lakeshore CU — Brand Film/        → yoursite.com/g/lakeshore-cu-brand-film
│   ├── gallery.json                  (optional settings)
│   ├── cover.jpg                     (optional hero image, hidden from grid)
│   ├── 01 Hero cut.mp4
│   ├── 02 Social 9x16.mp4
│   └── stills-001.jpg …
├── Fall Leadership Conference/
└── _Work in progress/                ← folders starting with _ stay hidden
```

- **Folder name = gallery title**, and its URL slug is made from the name. Renaming the folder changes the link.
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

### 2. Drive folder
1. Create a folder, e.g. **Client Galleries**.
2. **Share** it with the service account email as **Viewer**.
3. Copy the folder ID from the URL: `drive.google.com/drive/folders/`**`THIS_PART`**.

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
| `DRIVE_ROOT_FOLDER_ID` | Folder ID from step 2 |
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
components/GalleryView.tsx  hero, filters, grid, selection bar, send dialog
components/Lightbox.tsx     viewer with gestures, notes, downloads
lib/galleries.ts            reads folders/files from Drive (and demo data)
```
