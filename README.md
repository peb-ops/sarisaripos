# Sari-Sari POS

Offline point-of-sale for a Philippine sari-sari store, for a Windows PC. It runs entirely on that computer: no internet, no online server, and all data stays on the PC (in the browser's IndexedDB).

Features: tingi and bulk selling (stick/pack, ¼ kg/1 kg), cash/GCash/utang checkout with change calculation, inventory with restock and stock counts, a per-customer utang ledger with partial payments, reports (sales, profit, best sellers, low stock), void sale, and JSON backup/restore.

## Install on the store computer

The store computer needs **nothing installed**: no Node.js, no admin rights, no internet.

1. Get the zip `SariSariPOS-v<version>.zip` (see *Make the install zip* below), e.g. on a USB drive.
2. Right-click the zip → **Extract All…**
3. Open the extracted folder and double-click **Install Sari-Sari POS**. If Windows shows "Windows protected your PC", click **More info → Run anyway**.
4. From then on, use the **Sari-Sari POS** icon on the Desktop (also in the Start menu).

The zip includes `READ ME FIRST.txt` with these steps in English and Tagalog.

How it works: the installer copies the app to `%LOCALAPPDATA%\SariSariPOS` and creates the icons. The icon starts a tiny local web server using Windows' built-in PowerShell (`launcher/system/server.ps1`, localhost only), then opens the app in an Edge window. To update, install a newer zip the same way. Sales records live in the browser, so updating never erases them.

**Back up regularly** (Settings → Download backup). The data exists only on that computer.

## Make the install zip

On a development machine with Node.js 20+:

```sh
npm install
npm run package    # → release/SariSariPOS-v<version>.zip
```

Attach the zip to a GitHub Release, or copy it to a USB drive.

## Develop

```sh
npm run dev        # http://localhost:5173
npm test           # unit tests (business logic)
npm run build      # production build in dist/
npm run preview    # serve the build at http://localhost:4173
```

Each address (port) keeps its own data in the browser. The installed app uses port 4173, the same as `npm run preview`.

## Barcode scanning (hidden)

Barcode support is built but turned off until the store has a scanner. USB and Bluetooth scanners act as keyboards, so no drivers are needed.

- Turn on: open the app once with `?flags=barcode` (e.g. `http://localhost:4173/?flags=barcode`). The setting is remembered.
- Turn off: `?flags=-barcode`.
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
