# Kartomat

Mobile-first tool for creating card **fronts** at the festival. Front-only, upload-only — no backs, no print screen, no cloud browsing.

## Build

The source is `kartomat.template.html`. The build step (`scripts/build.py`) renders it to `index.html` — the file GitHub Pages serves as the directory default — and generates the service worker `sw.js`:

```
make
```

**Prerequisites:**
- Python 3

`index.html` and `sw.js` are build outputs but are committed, because GitHub Pages serves them directly from the repo. Rebuild and commit both whenever the template or `manifest.json` changes. `make clean` removes them.

The font and background image are fetched at runtime from the configured Supabase bucket — see [Bucket assets](#bucket-assets) for the upload step.

### Versioning & update detection

`build.py` stamps a **content version** into both `index.html` (`<meta name="build-version">`) and `sw.js` (`BUILD_VERSION` / the `kartomat-shell-<version>` cache name). The version is the SHA-256 hash of the user-facing sources — `kartomat.template.html` and `manifest.json` — truncated to 12 hex chars.

Because it hashes only those sources, editing unrelated files (docs, tooling, other issues) does **not** change the version, so the in-app "Update verfügbar" banner does not fire spuriously. The banner appears when a rebuilt `sw.js` differs from the installed one: either the content version changed, or the caching logic in `scripts/sw.template.js` changed (which alters `sw.js` regardless of version).

## Opening the app

Open `index.html` directly in a browser, or visit the deployed GitHub Pages URL — no server needed. Supabase is loaded from CDN; all other features work offline via the service worker.

## Configuring via URL / QR

The built `index.html` carries no credentials. Pass the Supabase project URL, anon key, and bucket as query-string parameters when opening the page:

| Parameter | Description |
|---|---|
| `url` | Supabase project URL, e.g. `https://<project>.supabase.co` |
| `key` | Supabase anon key |
| `bucket` | Storage bucket name |

**Example link:**

```
https://<user>.github.io/<repo>/?url=https://<project>.supabase.co&key=<anon key>&bucket=<bucket>
```

(Opening a local file works too: `index.html?url=…&key=…&bucket=…`.)

**QR codes:** Encode the full link above with any QR generator. The anon JWT is long (~200+ characters), so the resulting QR code is dense — use an adequate print size (≥ 4 cm) and a high error-correction level (Q or H) to ensure reliable scanning.

**Security note:** The anon key is public by design; it is not a secret. Access is controlled by Supabase Row Level Security policies. URL configuration is about deployment flexibility, not secrecy.

## Flow

**Home screen** — shows the app name, a one-line intention, a secondary **Galerie** button, and the primary **Karte erstellen** button (Galerie is placed above Karte erstellen, in outlined style so creating remains the primary call-to-action). Below the buttons, any previously saved cards appear as thumbnails with title and a publish tag:
- **Veröffentlicht** — card is published and unchanged since publish.
- **Veröffentlicht (alt)** — card was published but has been edited since.
- **Entwurf** — card has never been published.

**Gallery screen** — a full-screen grid of published cards, newest first, fetched from Supabase Storage (up to 200 cards). A **Zurück** button at the top returns to the home screen. The grid has three states:
- *Wird geladen …* — while thumbnails are being fetched.
- *Noch keine Karten* — when nothing has been published yet.
- *Galerie nicht verfügbar* — when the list or download fails.
Only cards published with the new three-file bundle (`.thumb.jpeg` present) appear in the gallery; legacy JSON-only cards are not shown.

**Card view screen** — a read-only full-screen view of a single published card, opened by tapping a gallery thumbnail. Shows the full-size published preview image. A **Zurück** button returns to the gallery. No editing or re-publishing from this screen.

**Starting a card** — on mobile, tapping **Karte erstellen** shows a chooser (Kamera / Galerie). On desktop, the file picker opens directly. After photo selection the editor opens immediately.

**Editor** — a live card preview (cropped to the trim rectangle, matching the downloaded/published output) with:
- A static background image as the card's base layer (zoom and drag never affect it).
- Pinch/drag to reposition the photo within its window; a zoom slider for fine control.
- **Foto ändern** to swap the photo without losing text.
- Tap the upper box to edit the title in-place; tap the lower box to edit the description. Text auto-shrinks to fit its box.
- **Zurück** — navigates to the home screen immediately when there are no unsaved changes; requires a two-tap "Änderungen verwerfen?" confirm when there are.
- Bottom action bar — 2-column grid: **Speichern** + **Herunterladen** side-by-side on row 1; **Veröffentlichen** full-width on row 2.

**Two-tap confirm** — Veröffentlichen uses a two-tap pattern: first tap arms (relabels to "Bestätigen"); second tap commits. Tapping elsewhere resets the armed state. Zurück also uses this pattern when there are unsaved changes (relabels to "Änderungen verwerfen?"). Speichern and Herunterladen are single-tap.

**Delete flow** — The trash button (🗑) on each home-list card branches on publish state:
- **Unpublished card** — single "delete locally" confirmation banner, then removes the local record.
- **Published card** — reveals two choices: **Lokal** and **Online**.
  - **Online** — confirmation banner, then deletes the three UUID-derived Supabase Storage files first; only removes the local record if the online delete succeeds. If the online delete fails, the card is kept and an error banner invites retry.
  - **Lokal** — warning banner that the online copy can no longer be deleted or modified (it becomes orphaned), then removes only the local record.

Inactivity auto-dismisses the revealed buttons and banners; tapping elsewhere cancels the flow.

## Local storage

Cards are stored in **IndexedDB** (database name `kartomat`) via the `cardStore` module. Each record carries:

| Field | Description |
|---|---|
| `id` | Stable UUID assigned at first save |
| `title`, `desc` | Card text |
| `photo` | JPEG normalized to ≤ 1110 px height on import |
| `userScale`, `offsetXFrac`, `offsetYFrac` | Pan/zoom state |
| `thumbnail` | Small `referenceJpeg` used for the home list tile |
| `publishedAt` | Timestamp set when published; `null` for drafts |
| `publishedFingerprint` | Content fingerprint of the last-published version; used to derive the publish tag and disable the publish button when the card is unchanged |
| `updatedAt` | Last-modified timestamp |

IndexedDB is used instead of localStorage because a single photo can exceed the ~5 MB localStorage cap.

API: `list()`, `get(id)`, `put(record)`, `remove(id)`, `markPublished(id, fingerprint)`.

**Save/Download** require only a photo. **Publish** additionally requires title and description; the button is disabled with a hint when either is missing. It is also disabled when the current card is already published and unchanged (i.e. `publishedFingerprint` matches the current version), preventing redundant re-publishes.

## Cloud publish

Publishing uploads the card bundle to Supabase Storage and marks the card as published locally (`publishedAt` timestamp and `publishedFingerprint` of the uploaded content).

**Bucket:** configured at runtime via the `bucket` URL parameter (see [Configuring via URL / QR](#configuring-via-url--qr)).

Publishing uploads three objects under the `front/` prefix, in this order:

| Path | Content |
|---|---|
| `front/kartomat-<uuid>.json` | Front-bundle JSON (`version:1, side:'front', title, desc, userScale, offsetXFrac, offsetYFrac, photo, referenceJpeg`) |
| `front/kartomat-<uuid>.jpeg` | Full-size preview — trim-cropped card front, JPEG q0.9 |
| `front/kartomat-<uuid>.thumb.jpeg` | Grid thumbnail (~200 px wide) written **last** |

The thumbnail is written last so a card only becomes visible in the gallery once its JSON and preview are already in place — no half-published tiles appear. The UUID is stable across edits, so re-publishing overwrites the same three objects (`upsert: true`) rather than creating duplicates.

## Bucket assets

The font (`Nove.woff2`) and background image (`background.jpeg`) are fetched at runtime from the bucket's public `assets/` prefix. A full-screen loading screen blocks app entry until both are ready; if either fails, the app shows an error and a Retry button.

**Required layout in the bucket:**

| Object key | Description |
|---|---|
| `assets/background.jpeg` | Background JPEG, minimum 803×1110 px |
| `assets/Nove.woff2` | Nove bold font in WOFF2 format |

**Upload step (one-time, per bucket):** Use the Supabase dashboard → Storage → your bucket → upload `background.jpeg` and `Nove.woff2` into an `assets/` folder.

**Required policy:** The `assets/` prefix must allow public reads — add a **SELECT** policy for the `anon` role covering `assets/**`. Without it the fetch fails and the app never starts.

## Supabase prerequisites

1. The configured bucket (passed via the `bucket` URL parameter) must exist.
2. Assets uploaded to `assets/` with a public-read SELECT policy — see [Bucket assets](#bucket-assets).
3. An RLS **INSERT** policy must allow the `anon` role to write into `front/`. Without it, uploads return 403.
4. An RLS **SELECT / list** policy must allow the `anon` role to read and list objects in `front/`. Without it, the gallery cannot fetch thumbnails or preview images (`list()` and `download()` return nothing or error).
5. An RLS **DELETE** policy must allow the `anon` role to delete objects in `front/`. Without it, online card deletion returns 403.

Use the anon key (not the service-role key) in the configuration link.
