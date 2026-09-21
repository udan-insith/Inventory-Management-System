# Gift Storage — Storage Management System

A storage & distribution ledger for a school's Gift Storage, built with
**Node.js + Express**, **MySQL**, and plain **HTML / CSS / JavaScript** on
the frontend (no framework, no build step).

---

## 1. Setup

Requires [Node.js](https://nodejs.org) v18+ and a running **MySQL** (or
MariaDB) server — either installed locally or hosted somewhere.

```bash
cd gift-storage-system
npm install
cp .env.example .env
```

Open `.env` and fill in your MySQL connection details:

```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=gift_storage
```

The database itself doesn't need to exist yet — the app creates it (and
every table) automatically on first boot, using `CREATE DATABASE IF NOT
EXISTS` / `CREATE TABLE IF NOT EXISTS`. The MySQL user in `.env` just needs
permission to create databases (a fresh local `root` account can).

```bash
npm start
```

Then open **http://localhost:3000**. The first boot also seeds the five
accounts below automatically.

To use a different port: set `PORT=8080` in `.env`, or `PORT=8080 npm start`.

> **Don't have MySQL installed?** On macOS: `brew install mysql && brew
services start mysql`. On Ubuntu/Debian: `sudo apt install mysql-server`.
> On Windows, use the [MySQL installer](https://dev.mysql.com/downloads/installer/)
> or run it via Docker: `docker run -p 3306:3306 -e MYSQL_ROOT_PASSWORD=yourpass mysql:8`.

---

## 2. ⚠️ One thing you need to edit before real use

The Issue/Receive branch dropdown ships with **placeholder branch names**
("Branch 01" through "Branch 53"). I could not find a verified, authoritative
list of the 53 BOC Western Province South branches, and getting bank branch
names wrong is worse than an obvious placeholder — so open
`public/js/branches.js` and replace the array with the real names. Every
page that uses the dropdown picks it up automatically; nothing else needs
to change.

---

## 3. Logins

The system ships with five accounts. Usernames are simply first names in
lowercase (shown below) — the full name is only used as the display name in
the app itself.

| Full name         | Username  | Password           | Role        |
| ----------------- | --------- | ------------------ | ----------- |
| M.D.S Madushanka  | `shanika` | `shanikamd@123`    | Admin       |
| Gayasri Peter     | `peter`   | `gayasripeter@123` | Admin       |
| Hasindu Wijekoon  | `hasindu` | `hasinduwije@123`  | Admin       |
| G.U.I Perera      | `udan`    | `udaninsith@123`   | Normal User |
| Mihisal Pamuditha | `mihisal` | `mihisalpamu@123`  | Normal User |

All five log in from the same **Log in** page — there's one shared login
form, not five separate pages, since that's how the credentials are meant
to be used day to day. (Usernames stayed the same as before — only the
display names changed.)

---

## 4. What each role can do

**Admins** (Madushanka, Peter, Wijekoon) get everything Normal Users get,
plus the **Users** page, where they can:

- Add a new user (created as a Normal User)
- Edit a Normal User's username / display name, and reset their password
- Delete a Normal User
- Change their **own** username and/or password (the "My account" card at
  the top of the Users page) — this requires re-entering their current
  password first, and is the only way an admin account can be changed.

Admin accounts are otherwise **protected** — one admin can't rename, reset
the password of, or delete another admin from the Users page. This is a
deliberate safety choice so nobody can accidentally (or maliciously) lock
another admin out of the system; each admin manages their own credentials.

**Normal Users** (Perera, Pamuditha, and anyone admins add later) get every
other feature: Stock, Issue, Receive, Requests, and History. They just
don't see the Users page, and can't change their own password — if a
Normal User needs a password reset, an admin does it for them from the
Users page.

**G.U.I Perera specifically** is the only account that can upload the two
one-time letters (see below) — this is tracked by the account itself, not
the username, so it keeps working even if an admin later renames it.

---

## 5. Feature tour

### Dashboard

Landing page with quick stats and navigation cards to every page you have
access to.

### Stock

Item inventory: every item is a card with its photo (if any), current
balance, and a **Low stock** badge once its balance drops to or below the
threshold you set for it (editable per item when you add it). A search box
filters by name. Three buttons per card:

- **Issue** — jumps to the Issue page (below) with this item already
  queued up, so you just type the amount.
- **Receive** — same, but jumps to the Receive page.
- **View Log** — the combined Issue/Receive history for just that item,
  with a **Print (PDF)** button.

**+ Add New Item** creates a new row with a starting balance, a low-stock
threshold, and an optional photo. Click any item's photo afterward to
replace it any time.

### Issue / Receive (their own pages now)

Both work the same way, just in opposite directions — **Issue** decreases
stock (gifts going out to a branch), **Receive** increases it (stock coming
in). Each is a full page rather than a popup, since a real Issue/Receive
event is often several different gifts at once for one branch/event:

- Fill in **Branch** (dropdown), **Date**, and **Event Name**.
- Click **+ Add Item** as many times as needed — an item dropdown and an
  amount, added to the **Items** list (adding the same item twice just
  adds to its quantity rather than making a duplicate line).
- **Issue**/**Receive** button — saves it and updates every item's balance.
  An Issue that brings an item down to exactly 0 **removes it from Stock
  automatically** — its entry (and everything logged before it) still
  shows up in Total History, since the item's name is snapshotted onto
  every log line.
- **Print** — prints whatever's currently filled in (no need to save
  first): a details sheet (branch/date/event/items), then the uploaded
  letter for that page, as two separate print prompts. See the honest note
  on this in section 6.

Each page also has its own letter status banner — **G.U.I Perera** sees an
**Upload** button there until that page's letter has been uploaded once.

### Received Requests

A log of incoming requests from branches, each with its supporting
document attached — an image (a photo of a handwritten/scanned request), a
PDF, or a Word document. **+ Add Request**: Branch, Date, Description, and
the file. Click any listed file to view or download it. Admins can delete
a logged request (removes its file too). Filterable by branch and date
range, and printable — see below.

### Total History

An automatic, combined feed of every Issue and Receive line across every
item — nothing to fill in here, it's a live read of the same tables Issue/
Receive write to.

### Filtering, sorting, and printing a date range

Total History, each item's **View Log**, and Received Requests all work
the same way:

- Filter by **From**/**To** date (native calendar pickers), plus type/item/
  branch where relevant.
- Click any column header to sort by it — click again to reverse the
  order. A small triangle shows the active sort.
- **Print (PDF)** only prints what's currently filtered and sorted on
  screen, never the whole unfiltered table — so picking a date range first
  and printing gives you just that range. The printed page states the
  range that was applied and who printed it, so a paper copy is
  self-documenting.

### Users (Admins only)

Add, rename, or remove Normal User accounts, plus a Danger Zone with
**Reset Application** for wiping everything back to a fresh install
(testing only — see section 9 below).

---

## 6. Printing, and an honest note on "filling in" the letter

"Print" buttons on Stock's logs and on History use the browser's own print
dialog with a dedicated print stylesheet (`css/print.css`) — choose **"Save
as PDF"** as the destination to get a PDF file.

For the Issue/Receive letters specifically: I didn't attempt to programmatically
find-and-replace placeholder text inside your uploaded PDF. Doing that
reliably for an arbitrary uploaded PDF (not a proper form-fillable template)
is fragile and easy to get subtly wrong — and getting an official letter
wrong is worse than being upfront about the limitation. Instead, clicking
**Print** on an Issue/Receive form prints two things back to back: a clean,
auto-generated details sheet (branch, date, event, items) built from
whatever's currently in the form, followed immediately by the uploaded
letter PDF itself. Two print prompts, not one merged document — if you'd
rather have the details typed directly onto the letter, that would need the
letter to be a proper fillable template (and a document-processing library
to match), which I'm happy to build if you want to go that route instead.

---

## 7. Project structure

```
gift-storage-system/
  server.js              Express app entry point
  database.js              MySQL connection pool, schema, seeding
  config.js                UPLOAD_DIR / ITEM_IMAGE_DIR / REQUEST_FILE_DIR (env-overridable)
  .env.example             template for your MySQL connection details
  middleware/auth.js       requireLogin / requireAdmin guards
  lib/itemLifecycle.js     shared "delete item, keep its history" helper
  routes/
    auth.js                login / logout / session
    users.js                admin-only user management
    items.js                item list + "add new item" (+ photo, threshold) / delete
    transactions.js         Issue / Receive transactions (auto-deletes item at 0)
    history.js               combined automatic history feed
    letters.js               one-time Issue/Receive letter upload/print
    requests.js              Received Requests (image/PDF/Word upload)
    reset.js                 admin-only "Reset Application" (testing only)
  public/                  static frontend (plain HTML/CSS/JS, no build step)
    login.html, dashboard.html, stock.html, issue.html, receive.html,
    requests.html, history.html, users.html
    css/style.css           design system (palette, layout, animations)
    css/print.css           print-only stylesheet
    js/                     one script per page, plus shared helpers
                            (api.js, toast.js, modal.js, animate.js, nav.js)
    js/transaction-page.js   shared logic for issue.html + receive.html
    js/branches.js           ⚠️ the BOC branch dropdown list — edit this
  uploads/                 uploaded letters live here; items/ and requests/
                           subfolders hold item photos and request documents
```

## 8. A few implementation notes

- Sessions are cookie-based (`express-session`) and last 8 hours per login.
- Passwords are hashed with bcrypt — the plaintext passwords above are only
  ever used to log in, they aren't stored anywhere.
- The database itself (`CREATE DATABASE IF NOT EXISTS`) and every table are
  created automatically on first boot — nothing to run by hand in MySQL.
- One Issue or Receive event is one `gift_transactions` row with one or more
  `gift_transaction_items` lines (one per item in that event) — this is how
  a single Issue can cover several different gifts at once.
- Deleting an item (manually, or automatically when an Issue brings it to 0
  stock) never deletes its history: `item_id` uses `ON DELETE SET NULL` in
  the schema, and every log line also carries its own snapshot of the
  item's name.
- This is set up for local/trusted-network use. If you ever deploy it
  somewhere public, set a long random `SESSION_SECRET` in `.env` and put
  the app behind HTTPS.
- The **Reset Application** button (Users page, Danger Zone) wipes every
  table, every item photo, both letters, and every received request (and
  its file) — meant for testing, not for a database with real data you
  care about.
- The visual theme was tightened up for internal/official use: sidebar
  icons are plain monochrome line icons instead of emoji, animations are
  more restrained, and every printed document carries a letterhead-style
  header/footer stating the date range applied and who printed it.

## 9. Running this long-term on one laptop (Windows)

For a single laptop, you don't need to host this anywhere — just run it
locally. Install Node.js and MySQL directly on the laptop once, then:

**`start.bat`** — double-click to start the server and open the login page
in your browser automatically. To stop the app, close the console window
titled "Gift Storage Server" that it opens.

Want it running automatically every time the laptop turns on, with no
double-click needed? Press `Win+R`, type `shell:startup`, and drop a
shortcut to `start.bat` in the folder that opens.

**`backup.bat`** — double-click to back up the database to a timestamped
file in `backups\`. It reads the connection details straight from your
`.env` file, so there's nothing to type. **Afterwards, copy the `backups`
folder somewhere off this laptop too** (a USB drive, OneDrive, Google
Drive) — a backup sitting on the same disk doesn't help if that disk
fails. This is the one real risk of a single-laptop setup, worth taking
seriously for something tracking real inventory.

To restore a backup later (e.g. after reinstalling), run:

```
mysql -u root -p gift_storage < backups\gift_storage_2026-09-06_120000.sql
```

using the actual filename of the backup you want. This is left as a manual
command rather than another double-click script on purpose — restoring
overwrites whatever is currently in the database, so it's worth typing out
deliberately rather than doing by accident.

If several people need to check stock from their own phone/laptop over the
office WiFi, the app is also reachable at `http://<this-laptop's-local-IP>:3000`
from any other device on the same network — no hosting service needed for
that either. Find the IP with `ipconfig` (look for "IPv4 Address").

_(These `.bat` scripts use standard Windows batch syntax but were written
and tested outside of Windows, so give `start.bat` and `backup.bat` a try
once after setup to confirm they work as expected on your machine.)_
