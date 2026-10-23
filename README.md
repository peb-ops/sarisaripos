# Sari-Sari POS

Offline point-of-sale for a Philippine sari-sari store, for a Windows PC. It runs entirely on that computer: no internet, no online server, and all data stays on the PC (in the browser's IndexedDB).

Features: tingi and bulk selling (stick/pack, ¼ kg/1 kg), cash/GCash/utang checkout with change calculation, inventory with restock and stock counts, a printable buying list, a per-customer utang ledger with partial payments, e-load / GCash cash-in and cash-out / bills payment with wallet balances, reports (sales, profit, best sellers, low stock), void, Excel/CSV export, and automatic backups with one-click restore.

## Install on the store computer

The store computer needs **nothing installed**: no Node.js, no admin rights, no internet.

1. Download `SariSariPOS-v<version>.zip` from the [latest release](https://github.com/peb-ops/sarisaripos/releases/latest) (or copy it over on a USB drive).
2. Right-click the zip → **Extract All…**
3. Open the extracted folder and double-click **Install Sari-Sari POS**. If Windows shows "Windows protected your PC", click **More info → Run anyway**.
4. From then on, use the **Sari-Sari POS** icon on the Desktop (also in the Start menu).

The zip includes `READ ME FIRST.txt` with these steps in English and Tagalog.

How it works: the installer copies the app to `%LOCALAPPDATA%\SariSariPOS` and creates the icons. The icon starts a tiny local web server using Windows' built-in PowerShell (`launcher/system/server.ps1`, localhost only), then opens the app in an Edge window. To update, install a newer zip the same way. Sales records live in the browser, so updating never erases them.

**Updates:** when the POS icon is opened, the launcher checks this repo's latest GitHub Release, at most once a day and only if the PC is online. If there's a newer version, it asks "Update now?". **Yes** backs up the records first (see below), downloads the zip, verifies its SHA-256, installs it, and reopens the POS. **No** asks again the next day. Offline, it skips the check silently. Installs of v0.1.0 predate this feature, so they need one manual install of a newer release.

**Backups** (all in `%LOCALAPPDATA%\SariSariPOS\backups\`):
- **Automatic:** a few seconds after a change (and at startup), the app saves a full backup as `auto-YYYY-MM-DD.json`. The latest copy of each day is kept for 30 days.
- **Restore:** Settings → Backup lists every backup on the computer, newest first, each with a **Restore** button. Before restoring, the current records are saved as `before-restore-<time>.json` (the last 5 are kept), so a wrong choice can be undone from the same list. **Restore from backup…** also opens a downloaded backup file.
- **Before every update:** `before-update-v<version>-<time>\` holds a copy of the latest automatic backup plus a raw copy of Edge's storage for the POS. The last 5 are kept. If records exist but can't be backed up, the update is cancelled.
- **Off the computer:** these files are on the same disk as the app. Use Settings → Download backup now and then, and copy the file to a USB drive or phone.

## Make a release

On GitHub: **Actions** tab → **Release** → **Run workflow** → type the new version (e.g. `0.2.0`) → **Run workflow**.

GitHub runs the tests, builds `SariSariPOS-v0.2.0.zip`, and publishes it under **Releases** with install steps and a list of changes. The newest release is always at `https://github.com/peb-ops/sarisaripos/releases/latest`. The version shows at the bottom of the app's Settings screen.

To build the zip locally instead (Node.js 22.12+): `npm install && npm run package` creates `release/SariSariPOS-v<version>.zip`.

## Develop

Needs Node.js 22.12 or newer.

```sh
npm run dev        # http://localhost:5173
npm test           # unit tests (business logic)
npm run build      # production build in dist/
npm run preview    # serve the build at http://localhost:4173
```

Each address (port) keeps its own data in the browser. The installed app uses port 4173, the same as `npm run preview`.

## Export to Excel / CSV

Files are saved to the Downloads folder, and nothing is uploaded anywhere.

- **Products** → Export: products and stock.
- **Reports** → Export: sales for the selected range, as Excel (Sales and Items sold sheets) or CSV.
- **Utang** → Export: who owes what, and the full utang history with running balances.
- **Load & GCash** → Export: every service, and the wallet history with running balances.
- **Export all**: at the bottom of every Export menu, and in **Settings → Export data**. Gives one Excel file with every sheet (Products, Sales, Sale items, Customers, Utang history, Load & GCash, Wallet history), or a zip with one CSV per sheet.

Money is in pesos with a ₱ format in Excel. CSV files are UTF-8 with a byte-order mark, so ₱ and ñ show correctly when opened in Excel.

## Load & GCash

E-load, GCash cash-in, GCash cash-out and bills payment are recorded on the **Load & GCash** screen, not in the cart, since they move wallet money instead of stock.

- **Wallets:** the screen shows the Load wallet and GCash wallet balances. E-load lowers the load wallet; cash-in and bills lower the GCash wallet; cash-out and product sales paid by GCash raise it. **Top up** adds money you put in; **Correct balance** sets it to what your load or GCash app shows. A wallet can go below zero (with a warning), like stock.
- **Fees:** the fee is filled in for you and can be changed each time. Defaults are in Settings → Load & GCash fees: e-load markup ₱2, GCash ₱10 per ₱500 (or part of it), bills ₱15.
- **Cash:** e-load, cash-in and bills show how much to collect; cash-out shows how much cash to give (amount minus fee).
- **Utang:** e-load can be put on a customer's utang; the other services are cash only.
- Fees and markups appear in Reports as **Load & GCash earned**, separate from product sales. Any service can be voided.

## Buying list

Products → **Buying list** shows every low-stock item, grouped by supplier, with a suggested amount (enough to reach twice the low-stock level, also shown in packs) and the estimated cost at the last price paid. **Print** gives a checklist to take shopping. Set a product's supplier in its Edit form.

## Barcode scanning

Off by default. Turn it on in **Settings → Barcode scanner**. USB and Bluetooth scanners act as keyboards, so no drivers are needed.

- When on, the product form shows a Barcode field. On the Sell screen, scanning adds the product, and an unknown code asks which product it belongs to.
- Test without a scanner: type a code very quickly and press Enter. Pasting with a text-expander tool also works.

## Code map

- `src/db/schema.ts`: tables, types and database versions. Money is integer centavos.
- `src/lib/`: business logic (`sales`, `inventory`, `ledger`, `services`, `buyingList`, `reports`, `backup`), unit-tested with `fake-indexeddb`.
- `src/pages/`: Sell, Products, Utang, Load & GCash, Reports, Settings. All but Sell load on first open.
- `src/features/barcode/`: scan detector, hook, and the UI pieces gated by the flag.
- `launcher/`: what goes in the install zip (installer, PowerShell server, launcher, read-me).
- `scripts/gen-icons.mjs`: regenerates the PWA icons and the shortcut `.ico` (`npm run icons`).
- `scripts/package.mjs`: builds the install zip (`npm run package`).

## Changing the database

Store computers keep their records in the browser, created by whichever version was installed first. Never edit a database version in `src/db/schema.ts` that has been released. Instead add a new `db.version(n)` (with an `.upgrade()` if existing rows must change), and add a test to `src/db/migrations.test.ts` that builds a database with the previous version, opens it with the new code and checks every record survived. If you add a table, also add it to `TABLES` in `src/lib/backup.ts`, bump `BACKUP_VERSION`, and let `parseBackup` fill the table in for older backups, so old backup files still restore.
