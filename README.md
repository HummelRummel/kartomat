# (K)ARTOMAT

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

## Install banner

When (K)ARTOMAT is opened in a browser that supports installation, a dismissible banner appears at the top of the home screen once the user has reached the home screen (not during the loading screen).

**Chromium (Android/desktop Chrome & Edge):** the banner shows an **Installieren** button. Tapping it triggers the browser's native install prompt (`beforeinstallprompt`). On successful install the banner disappears permanently.

**iOS Safari:** the banner shows manual steps — *Offline nutzen: Teilen → Zum Home-Bildschirm* — because iOS does not support programmatic install. Only the close (×) button is interactive.

**Unsupported browsers** (desktop Firefox, in-app browsers, etc.): no banner is shown.

The banner is suppressed when any of the following hold:
- The app is already running as an installed PWA (standalone/fullscreen display mode).
- The user dismissed it within the last 30 days (timestamp stored in `localStorage`).
- The user previously completed installation (permanent flag in `localStorage`; clearing site data resets this).
- An app update is pending — the update banner takes priority and the install banner hides until the update is resolved.

## Configuring via URL / QR

The built `index.html` carries no credentials. Pass the Supabase project URL, anon key, and bucket as query-string parameters when opening the page:

| Parameter | Description |
|---|---|
| `url` | Supabase project URL, e.g. `https://<project>.supabase.co` |
| `key` | Supabase anon key |
| `bucket` | Storage bucket name |
| `adminkey` | Supabase admin key with write access to `lockout.json` and move/delete rights on the card bucket. Activates admin mode and persists the key and the mode to `localStorage`, so both survive reloads, collection switches, and closing the app. See [Admin mode](#admin-mode). |

`url`, `key`, and `bucket` must appear together in one link; omitting any triggers a configuration error. All customisable text (headline, description, collection name, content-policy) now lives in [`collection.json`](#collection-configuration-collectionjson) instead of the URL.

Any other query parameter is ignored rather than rejected — in particular the retired `event`, `tagline` and `policy` parameters, so QR codes already printed with them keep working, just without effect.

**Example link:**

```
https://<user>.github.io/<repo>/?url=https://<project>.supabase.co&key=<anon key>&bucket=<bucket>
```

(Opening a local file works too: `index.html?url=…&key=…&bucket=….`)

**QR codes:** Encode the full link above with any QR generator. The anon JWT is long (~200+ characters), so the resulting QR code is dense — use an adequate print size (≥ 4 cm) and a high error-correction level (Q or H) to ensure reliable scanning.

**Security note:** The anon key is public by design; it is not a secret. Access is controlled by Supabase Row Level Security policies. URL configuration is about deployment flexibility, not secrecy.

## Collection configuration (`collection.json`)

Every customisable piece of text lives in a `collection.json` file at the **root of the collection
bucket** (not under `assets/`). Editing it in the Supabase dashboard reaches every device on its next
start — no new QR code needed. It is fetched in parallel with the background image and font, over the
same authenticated Storage endpoint, so the home screen renders with final text on its first frame.

All fields are optional; each falls back to a built-in default when omitted:

| Field | Description |
|---|---|
| `title` | Home-screen top line, and the home screen's collection picker (previously the `?event=` parameter). |
| `description` | The line under the app name (previously the `?tagline=` parameter). |
| `name` | Short display name shown in the [per-screen collection bar](#flow), the [collection switcher](#flow), and on foreign-card badges. |
| `policy` | Publish content-policy text (previously the `?policy=` parameter). First line renders as the bold banner title, remaining lines as the muted body. |

**Example** (also in [`collection.json`](collection.json) at the repo root):

```json
{
  "title": "/// 3026grad festival",
  "description": "Erstelle deine eigene Festivalkarte — schön, schnell, auf deinem Handy.",
  "name": "3026grad",
  "policy": "Seid rücksichtsvoll.\nAndere Personen sehen deine Karte.\nKein Sexismus, kein Rassismus, keine Homophobie."
}
```

Line breaks in `policy` are JSON `\n` escapes inside the single string — the first line ("Seid
rücksichtsvoll.") becomes the banner title, the remaining two the body. Any field may be dropped to
take the built-in default; an empty `{}` is valid and yields the defaults for all four.

**Failure handling:**
- File missing or unreadable (404/403) — **fatal**: the app stops at the loading-error screen. A
  bucket that is reachable but cannot serve the file is treated as misconfigured.
- Bucket unreachable (offline, DNS, transport failure) — falls back to the copy stored the last time
  this bucket loaded successfully (see the [known-collections registry](#local-storage)); fatal if no
  such copy exists yet.

Because the file sits at the bucket root rather than under `assets/`, it falls outside the service
worker's cache-first rule and is always fetched fresh — it never participates in the "Update
verfügbar" check.

**Required policy:** add an anon **SELECT** policy covering the bucket root, in addition to the
existing `assets/**` and `front/**` policies — without it every request for `collection.json` 404s and
the app refuses to start.

## Flow

**Home screen** — the collection's `title` (from [`collection.json`](#collection-configuration-collectionjson))
is the decorative top line, and doubles as the collection picker: plain muted text when the device
knows only one collection, or the same text with a chevron once it knows more than one. Tapping it
opens a bottom-sheet picker (reusing the photo-chooser overlay's markup and styling) listing every
known collection by display name, most recently used first, with the active one marked; picking one
writes it as the active config and reloads the page into it. Below the title, a headline and
description are sourced from `collection.json`, followed by a secondary **Galerie** button and the
primary **Karte erstellen** button (Galerie is placed above Karte erstellen, in outlined style so
creating remains the primary call-to-action). There is no separate collection control below the
description — the title is the only picker. Below the buttons, cards appear as thumbnails. Own cards (belonging to the
current bucket) are listed first; foreign cards (from other buckets) appear below. Publish tags apply
to own cards:
- **Veröffentlicht** — card is published and unchanged since publish.
- **Veröffentlicht (alt)** — card was published but has been edited since.
- **Entwurf** — card has never been published.

Foreign cards show the originating collection's display name in place of the publish tag — falling
back to the raw bucket name, or "Unbekannt" for records with no bucket at all — and their thumbnail is
shown at 50% opacity.

**Collection bar** — every other screen (gallery, card view, deleted gallery, deleted card view, and
editor) shows a slim bar above its existing header, displaying the collection's short `name`. Tapping
it opens the same bottom-sheet picker as the home title, with one exception: the editor's bar is
never tappable, so an in-progress card can't be discarded by an accidental tap. Like the home title,
the bar is plain text with no chevron until the device knows more than one collection.

**Gallery screen** — a full-screen grid of published cards, newest first, fetched from Supabase Storage (up to 200 cards). A **Zurück** button at the top returns to the home screen. When returning from a card view, scroll position is restored instantly with no refetch. The grid has three states:
- *Wird geladen …* — while thumbnails are being fetched.
- *Noch keine Karten* — when nothing has been published yet.
- *Galerie nicht verfügbar* — when the list or download fails.
Only cards published with the new three-file bundle (`.thumb.jpeg` present) appear in the gallery; legacy JSON-only cards are not shown.

**Card view screen** — a read-only full-screen view of a single published card, opened by tapping a gallery thumbnail. Shows the full-size published preview image. A **Herunterladen** button downloads the full-size JPEG (reusing the already-fetched blob — no extra network request; saved as `kartomat-<uuid>.jpeg`). Tapping the card image or any empty area beside the card (the backdrop) returns to the gallery. No editing or re-publishing from this screen.

**Starting a card** — on mobile, tapping **Karte erstellen** shows a chooser (Kamera / Galerie). On desktop, the file picker opens directly. After photo selection the editor opens immediately.

**Editor** — a live card preview (cropped to the trim rectangle, matching the downloaded/published output) with:
- A static background image as the card's base layer (zoom and drag never affect it).
- Pinch/drag to reposition the photo within its window; a zoom slider for fine control.
- **Foto ändern** to swap the photo without losing text.
- Tap the upper box to edit the title in-place; tap the lower box to edit the description. Text auto-shrinks to fit its box.
- **Zurück** — navigates to the home screen immediately when there are no unsaved changes; requires a two-tap "Änderungen verwerfen?" confirm when there are.
- Bottom action bar — 2-column grid: **Speichern** + **Herunterladen** side-by-side on row 1; **Veröffentlichen** full-width on row 2.

**Publish flow** — Tapping **Veröffentlichen** triggers a lockout check (fetch `lockout.json` from the
`admin` bucket). The banner is anchored to the **bottom** of the editor, covering the action bar below
it instead of shrinking the card preview above; it uses the page's own background colour, and a
coloured left stripe is the only variant marker. Three outcomes:

- **Connection error** — a banner ("Keine Verbindung", amber stripe) with an **Erneut versuchen**
  button. Publishing is blocked until the check succeeds; going offline cannot bypass this.
- **User is locked out** — a locked-out banner ("Du bist gesperrt", red stripe). No confirm action is
  offered — this is a dead end.
- **User is clear** — a content-policy banner (neutral stripe; text comes from
  [`collection.json`](#collection-configuration-collectionjson)'s `policy` field). A **Bestätigen**
  button completes the upload; a **Doch nicht** button dismisses the banner and cancels publishing.

**Two-tap confirm** — Zurück uses this pattern when there are unsaved changes (relabels to "Änderungen verwerfen?"). Speichern is two-tap (relabels to "Wirklich?") only when overwriting an already-saved own card; a new card or a foreign-card fork is single-tap. Herunterladen is always single-tap.

**Delete flow** — The trash button (🗑) on each home-list card branches on ownership and publish state:
- **Foreign card** — single "delete locally" confirmation banner, then removes the local record only; the original in its own collection's cloud storage is untouched.
- **Own unpublished card** — single "delete locally" confirmation banner, then removes the local record.
- **Own published card** — reveals two choices: **Lokal** and **Online**.
  - **Online** — confirmation banner, then deletes the three UUID-derived Supabase Storage files first; only removes the local record if the online delete succeeds. If the online delete fails, the card is kept and an error banner invites retry.
  - **Lokal** — warning banner that the online copy can no longer be deleted or modified (it becomes orphaned), then removes only the local record.

Inactivity auto-dismisses the revealed buttons and banners; tapping elsewhere cancels the flow.

## Local storage

Cards are stored in **IndexedDB** (database name `kartomat`) via the `cardStore` module. Each record carries:

| Field | Description |
|---|---|
| `id` | Stable UUID assigned at first save |
| `bucket` | Bucket name stamped at persist time; a card is "foreign" when this differs from the active bucket. Records predating this change carry no `bucket` and are therefore always foreign. |
| `title`, `desc` | Card text |
| `photo` | JPEG normalized to ≤ 1110 px height on import |
| `userScale`, `offsetXFrac`, `offsetYFrac` | Pan/zoom state |
| `thumbnail` | Small `referenceJpeg` used for the home list tile |
| `publishedAt` | Timestamp set when published; `null` for drafts |
| `publishedFingerprint` | Content fingerprint of the last-published version; used to derive the publish tag and disable the publish button when the card is unchanged |
| `updatedAt` | Last-modified timestamp |

IndexedDB is used instead of localStorage because a single photo can exceed the ~5 MB localStorage cap.

API: `list()`, `get(id)`, `put(record)`, `remove(id)`, `markPublished(id, fingerprint)`.

Foreign cards fork into the current collection on save — a new `id`, `bucket` re-stamped to the
active bucket, and publish state cleared — so this also doubles as the migration path for records
predating the `bucket` field.

### localStorage keys

| Key | Holds |
|---|---|
| `kartomat_cfg` | The active `{url, key, bucket}`, written when a link is opened or a collection is picked from the switcher. |
| `kartomat:knownCollections` | Every collection this device has successfully opened, keyed by bucket: connection details, the four resolved `collection.json` fields, and a last-used timestamp. Written only once both the assets and `collection.json` have loaded successfully; also serves as the offline fallback for `collection.json`. Feeds the [collection switcher](#flow). |
| `kartomat:userId` | The anonymous per-device UUID — see [User identity](#user-identity). |
| `kartomat:etag:<url>` | Cached asset validator used to detect a changed background/font. |
| `kartomat:adminKey` | The admin key, once supplied via `?adminkey=`. Collection-independent — one key works across every collection — and kept on logout, so the [entry gesture](#admin-mode) can use it again. |
| `kartomat:adminActive` | The on/off flag for admin mode. Consulted on every start; survives reloads, collection switches, and closing the app until explicit logout clears it. |

The retired `kartomat:event`, `kartomat:tagline`, `kartomat:policy` keys and a dead `kartomat:bucket`
entry (which collided in name with the real connection parameter but was never read) are removed via
a one-time cleanup on first load.

**Save** requires only a photo. **Download** is a pure export — it renders and downloads the PNG and leaves the user in the editor; it does not persist the card and does not navigate home. **Publish** additionally requires title and description; empty fields are flagged with a red border. The Publish button is also disabled and relabelled **Keine Änderungen** when the card is already published and unchanged (i.e. `publishedFingerprint` matches the current version), preventing redundant re-publishes.

## User identity

On first launch the app generates a `crypto.randomUUID()` and stores it in localStorage under `kartomat:userId`. This anonymous UUID is stable across sessions (until the user clears site data) and is attached to every published card as `creatorId` in the JSON bundle.

Cards published before this feature was introduced carry no `creatorId` and are treated as **"Ersteller unbekannt"** in admin actions — they cannot be used to lock out a creator.

## Cloud publish

Publishing uploads the card bundle to Supabase Storage and marks the card as published locally (`publishedAt` timestamp and `publishedFingerprint` of the uploaded content).

**Bucket:** configured at runtime via the `bucket` URL parameter (see [Configuring via URL / QR](#configuring-via-url--qr)).

Publishing uploads three objects under the `front/` prefix, in this order:

| Path | Content |
|---|---|
| `front/kartomat-<uuid>.json` | Front-bundle JSON (`version:1, side:'front', title, desc, userScale, offsetXFrac, offsetYFrac, photo, referenceJpeg, creatorId`) |
| `front/kartomat-<uuid>.jpeg` | Full-size preview — trim-cropped card front, JPEG q0.9 |
| `front/kartomat-<uuid>.thumb.jpeg` | Grid thumbnail (~200 px wide) written **last** |

The thumbnail is written last so a card only becomes visible in the gallery once its JSON and preview are already in place — no half-published tiles appear. The UUID is stable across edits, so re-publishing overwrites the same three objects (`upsert: true`) rather than creating duplicates.

## Bucket assets

The font (`Nove.woff2`) and background image (`background.jpeg`) are fetched at runtime from the bucket's `assets/` prefix. The bucket is private, so they are requested through the Supabase **authenticated** object endpoint (`/storage/v1/object/authenticated/<bucket>/assets/…`) using the anon key, not a public URL. A full-screen loading screen blocks app entry until both are ready; if either fails, the app shows an error and a Retry button.

**Required layout in the bucket:**

| Object key | Description |
|---|---|
| `assets/background.jpeg` | Background JPEG, minimum 803×1110 px |
| `assets/Nove.woff2` | Nove bold font in WOFF2 format |

**Upload step (one-time, per bucket):** Use the Supabase dashboard → Storage → your bucket → upload `background.jpeg` and `Nove.woff2` into an `assets/` folder.

**Required policy:** The `anon` role must be allowed to read the `assets/` prefix — add a **SELECT** policy for `anon` covering `assets/**`. (The bucket itself stays private; the app authenticates each asset request with the anon key.) Without it the fetch fails and the app never starts.

## Supabase prerequisites

### Card bucket (private)

1. The configured bucket (passed via the `bucket` URL parameter) must exist.
2. `collection.json` uploaded to the **bucket root**, with a SELECT policy allowing the `anon` role to read the bucket root — see [Collection configuration](#collection-configuration-collectionjson). The app is fatal-on-404 for this file: a bucket missing either the file or the policy stops the app at the loading-error screen for every user, with no escape hatch to switch away.
3. Assets uploaded to `assets/`, with a SELECT policy allowing the `anon` role to read `assets/**` — see [Bucket assets](#bucket-assets).
4. An RLS **INSERT** policy must allow the `anon` role to write into `front/`. Without it, uploads return 403.
5. An RLS **SELECT / list** policy must allow the `anon` role to read and list objects in `front/`. Without it, the gallery cannot fetch thumbnails or preview images (`list()` and `download()` return nothing or error).
6. An RLS **DELETE** policy must allow the `anon` role to delete objects in `front/`. Without it, online card deletion returns 403.

Use the anon key (not the service-role key) in the configuration link.

**Before this reaches existing users:** every bucket already in use must get `collection.json` and its
root SELECT policy — without both, the app stops working for that bucket entirely. Also expect every
locally-saved card on a returning device to render as foreign afterwards: cards are now scoped by
bucket rather than the old event identifier, and no backfill is performed. Editing and saving a
foreign card forks it into the current collection.

### Admin bucket (public) — manual setup

These steps are one-time, per Supabase project. The app degrades gracefully (error banners / alerts) if they are missing.

1. **Create** a public bucket named `admin` in the same Supabase project.
2. **Seed** `lockout.json` — upload a file containing `[]` (empty JSON array) to the `admin` bucket. Without this file a fresh deployment blocks all publishing until the file exists (the lockout check treats a missing file as a connection error). Alternatively, performing any admin lock/unlock action creates or overwrites it automatically.
3. **RLS — anon read:** add a **SELECT** policy for the `anon` role covering all objects in the `admin` bucket. This allows the public lockout check to fetch `lockout.json` without authentication.
4. **RLS — anon write: none.** Do not add INSERT/UPDATE/DELETE policies for `anon` on the `admin` bucket. Normal users must not be able to write `lockout.json`.
5. **RLS — admin key write:** the dedicated admin key must have INSERT/UPDATE/DELETE rights on `lockout.json` in the `admin` bucket, and move/delete rights on `front/` and `front-deleted/` in the card bucket.
6. **Provision the admin user/key:** create a dedicated Supabase user (or use a service-role key scoped appropriately) with the rights above. Pass this key as `?adminkey=` in the admin link.

### `front-deleted/` prefix

Deleted cards are moved (not erased) to the `front-deleted/` prefix in the **card bucket** (three files per card: `.json`, `.jpeg`, `.thumb.jpeg`). This prefix is private like the rest of the bucket. The public gallery lists only `front/`; the admin Deleted Gallery lists `front-deleted/`. Restoring a card moves the three files back to `front/`.

## Admin mode

Admin mode is a persisted mode, not an ephemeral one: the key and the on/off flag both survive
reloads, collection switches, and closing the app, so an admin can move freely between collections
without losing their session.

### Entry

- **Admin link** — opening the app with `?adminkey=<key>` in the URL persists the key, turns the flag
  on, strips the parameter from the visible URL bar, and applies admin mode immediately.
- **Triple-tap** — once a key has been stored on a device, tapping the `(K)artomat` / `(K)admin`
  heading three times within a short window re-enters admin mode without the link. With no stored
  key the gesture is a complete no-op — no message, no hint — so an ordinary visitor can never
  discover that admin mode exists.

Both paths take effect via the same mechanism: persist the new flag, then reload. This is the same
persist-then-reload pattern collection switching already uses, and it is the only code path that
builds the admin interface — there is no separate in-place teardown/setup.

### Exit

Tapping **Abmelden**, in the red admin banner on every screen, clears the on/off flag but **keeps the
stored key**, then reloads back to normal mode. The triple-tap gesture can therefore re-enter admin
mode afterwards without the original link.

### Security note

An admin session now outlives the app being closed — a real trade-off against the previous design,
where any reload ended admin mode and limited the damage from a forgotten session on a shared device.
The explicit **Abmelden** control is the compensating measure: use it when handing a device to someone
else.

### Visibility

- Home title changes from `(K)artomat` to `(K)admin`.
- A fixed red banner reading **"(K)ADMIN — Admin-Modus aktiv"** is visible on every screen.
- The **Karte erstellen** button and local card list are hidden. A **Gelöschte Galerie** button appears in their place.

### Deleting a card

In admin mode each card detail view shows a **Löschen und/oder sperren** button at the top (instead of
Herunterladen). Tapping it hides the trigger and puts three option buttons in its place (no separate
panel heading — the trigger's own label already supplies that context):

- **Löschen & sperren** — moves the three card files to `front-deleted/` and adds the creator's UUID to `lockout.json`. Requires a second confirming tap (relabels to **"Wirklich sperren?"**). Disabled (shown as **"Schon gesperrt"**) if the creator is already locked; disabled (shown as **"Ersteller unbekannt"**) for legacy cards without a `creatorId`.
- **Nur löschen** — moves the three card files to `front-deleted/`. Requires a second confirming tap (relabels to **"Wirklich löschen?"**).
- **Abbrechen** — restores the trigger on a single tap.

Tapping elsewhere while a destructive button is armed disarms it without committing. Leaving the card
(back to the gallery, or opening a different one) also restores the trigger and hides the options, so
a half-open panel is never left behind. The card disappears from the public gallery immediately after
deletion.

Tapping the card image or any empty area beside the card (the backdrop) returns to the gallery — even when the delete panel is open.

### Deleted Gallery

The **Gelöschte Galerie** screen lists cards in `front-deleted/`. Opening a deleted card shows two action buttons:

- **Wiederherstellen** — moves the three files back to `front/`. If the creator is currently locked out, the lock is automatically removed. Requires a confirm step.
- **Ersteller entsperren** — removes the creator's UUID from `lockout.json` without restoring the card. Available only when the creator is actually on the lockout list; disabled for legacy cards with no `creatorId`. Requires a confirm step.
