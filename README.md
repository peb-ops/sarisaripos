# Sari-Sari POS

Offline point-of-sale for a Philippine sari-sari store, for a Windows PC. It runs entirely on that computer: no internet, no online server, and all data stays on the PC (in the browser's IndexedDB).

Features: tingi and bulk selling (stick/pack, ¼ kg/1 kg), cash/GCash/utang checkout with change calculation, inventory with restock and stock counts, a per-customer utang ledger with partial payments, reports (sales, profit, best sellers, low stock), void sale, and JSON backup/restore.

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
- **Automatic:** a few seconds after every change (and at startup), the app saves a full backup as `auto-YYYY-MM-DD.json`. The latest copy of each day is kept for 30 days. Restore one with Settings → Restore from backup.
- **Before every update:** `before-update-v<version>-<time>\` holds a copy of the latest automatic backup plus a raw copy of Edge's storage for the POS. The last 5 are kept. If records exist but can't be backed up, the update is cancelled.
- **Off the computer:** these files are on the same disk as the app. Use Settings → Download backup now and then, and copy the file to a USB drive or phone.

## Make a release

On GitHub: **Actions** tab → **Release** → **Run workflow** → type the new version (e.g. `0.2.0`) → **Run workflow**.

GitHub runs the tests, builds `SariSariPOS-v0.2.0.zip`, and publishes it under **Releases** with install steps and a list of changes. The newest release is always at `https://github.com/peb-ops/sarisaripos/releases/latest`. The version shows at the bottom of the app's Settings screen.

To build the zip locally instead (Node.js 20+): `npm install && npm run package` creates `release/SariSariPOS-v<version>.zip`.

## Develop

```sh
npm run dev        # http://localhost:5173
npm test           # unit tests (business logic)
npm run build      # production build in dist/
npm run preview    # serve the build at http://localhost:4173
```

Each address (port) keeps its own data in the browser. The installed app uses port 4173, the same as `npm run preview`.

## Barcode scanning

Off by default. Turn it on in **Settings → Barcode scanner**. USB and Bluetooth scanners act as keyboards, so no drivers are needed.

- When on, the product form shows a Barcode field. On the Sell screen, scanning adds the product, and an unknown code asks which product it belongs to.
- Test without a scanner: type a code very quickly and press Enter. Pasting with a text-expander tool also works.

## Code map

- `src/db/schema.ts`: tables and types. Money is integer centavos.
- `src/lib/`: business logic (`sales`, `inventory`, `ledger`, `reports`, `backup`), unit-tested with `fake-indexeddb`.
- `src/pages/`: Sell, Products, Utang, Reports, Settings.
- `src/features/barcode/`: scan detector, hook, and the UI pieces gated by the flag.
- `launcher/`: what goes in the install zip (installer, PowerShell server, launcher, read-me).
- `scripts/gen-icons.mjs`: regenerates the PWA icons and the shortcut `.ico` (`npm run icons`).
- `scripts/package.mjs`: builds the install zip (`npm run package`).
