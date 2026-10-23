import { useLiveQuery } from 'dexie-react-hooks';
import {
  Download,
  FileSpreadsheet,
  FolderArchive,
  HardDrive,
  History,
  Keyboard,
  PackageOpen,
  ScanBarcode,
  Smartphone,
  Store,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Button, Card, ErrorText, Field, Input, PageHeader, PesoInput, errorMessage } from '../components/ui';
import { db } from '../db/schema';
import { seedDemoData } from '../db/seed';
import { useAutoBackupStatus, useFlag, useServiceFees, useSetting } from '../hooks';
import { exportCsv, exportExcel } from '../lib/exportFiles';
import { setFlag } from '../lib/featureFlags';
import { downloadJson, exportBackup, parseBackup, type Backup } from '../lib/backup';
import { daysAgo, formatDate, formatDateTime, formatDayTime } from '../lib/format';
import {
  fetchLocalBackup,
  listLocalBackups,
  restoreWithSafetyCopy,
  type LocalBackup,
  type LocalBackupKind,
} from '../lib/localBackups';
import { formatPeso, parsePeso, pesoInputValue } from '../lib/money';
import type { ServiceFees } from '../lib/services';
import { setSetting } from '../lib/settings';

const BACKUP_KIND: Record<LocalBackupKind, string> = {
  auto: 'Automatic backup (latest of that day)',
  'before-update': 'Saved before an update',
  'before-restore': 'Your records just before a restore',
};

export default function Settings() {
  const toast = useToast();
  const storeName = useSetting('storeName', 'Sari-Sari Store');
  const lastBackupAt = useSetting<number | null>('lastBackupAt', null);
  const productCount = useLiveQuery(() => db.products.count(), []);
  const [name, setName] = useState(storeName);
  const [pending, setPending] = useState<Backup | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const auto = useAutoBackupStatus();
  const barcodeOn = useFlag('barcode');
  const [exporting, setExporting] = useState(false);
  const [saved, setSaved] = useState<LocalBackup[] | null>(null);
  const [showAllSaved, setShowAllSaved] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  // Refresh the list whenever a new automatic backup lands.
  useEffect(() => {
    listLocalBackups().then(setSaved, () => setSaved(null));
  }, [auto.savedAt]);

  async function openLocal(b: LocalBackup) {
    setOpening(b.id);
    try {
      setPending(await fetchLocalBackup(b.id));
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setOpening(null);
    }
  }

  async function runExport(run: () => Promise<void>) {
    setExporting(true);
    try {
      await run();
      toast('Exported: the file is in your Downloads folder');
    } catch (err) {
      toast(`Export failed: ${errorMessage(err)}`, 'error');
    } finally {
      setExporting(false);
    }
  }
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setName(storeName), [storeName]);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  async function backup() {
    const data = await exportBackup();
    downloadJson(data, `sari-sari-backup-${new Date().toISOString().slice(0, 10)}.json`);
    await setSetting('lastBackupAt', data.exportedAt);
    toast('Backup downloaded. Keep it somewhere safe (USB, Google Drive).');
  }

  const backupAge = lastBackupAt ? daysAgo(lastBackupAt) : null;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader title="Settings" />

        <Section icon={<Store size={20} />} title="Store">
          <form
            className="flex items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await setSetting('storeName', name.trim() || 'Sari-Sari Store');
              toast('Store name saved');
            }}
          >
            <Field label="Store name" className="flex-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button type="submit" disabled={name === storeName}>
              Save
            </Button>
          </form>
        </Section>

        <Section icon={<HardDrive size={20} />} title="Backup">
          <p className="mb-3 text-sm text-stone-600">
            Everything is saved only on this computer. Download a backup regularly and keep it somewhere else (USB,
            phone) so you don't lose your records if the computer breaks.
          </p>
          {auto.available && (
            <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <strong>Automatic backup is on.</strong> A copy is saved on this computer after every change
              {auto.savedAt ? ` (latest at ${formatDateTime(auto.savedAt)})` : ''}, and before every update.
              {auto.folder && (
                <span className="mt-1 block text-xs break-all text-emerald-800">
                  Folder: <code>{auto.folder}</code>
                </span>
              )}
            </p>
          )}
          <p
            className={`mb-4 text-sm font-medium ${backupAge === null || backupAge >= 7 ? 'text-amber-700' : 'text-emerald-700'}`}
          >
            {lastBackupAt
              ? `Last backup: ${formatDateTime(lastBackupAt)} (${backupAge === 0 ? 'today' : `${backupAge} day${backupAge === 1 ? '' : 's'} ago`})`
              : 'No backup yet.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={backup}>
              <Download size={18} /> Download backup
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={18} /> Restore from backup…
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  setPending(parseBackup(await file.text()));
                } catch (err) {
                  toast(errorMessage(err), 'error');
                }
              }}
            />
          </div>
          {saved && saved.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-700">
                <History size={16} /> Backups saved on this computer
              </h3>
              <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                {(showAllSaved ? saved : saved.slice(0, 5)).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div>
                      <div className="font-medium">{formatDayTime(b.modified)}</div>
                      <div className="text-xs text-stone-500">{BACKUP_KIND[b.kind]}</div>
                    </div>
                    <Button size="sm" disabled={opening !== null} onClick={() => openLocal(b)}>
                      Restore…
                    </Button>
                  </li>
                ))}
              </ul>
              {saved.length > 5 && (
                <Button size="sm" variant="ghost" className="mt-2" onClick={() => setShowAllSaved((v) => !v)}>
                  {showAllSaved ? 'Show fewer' : `Show all ${saved.length}`}
                </Button>
              )}
            </div>
          )}
          {persisted === false && (
            <p className="mt-4 text-xs text-stone-500">
              Tip: install this app (the install icon in the browser's address bar) so the browser keeps its data safe.
            </p>
          )}
        </Section>

        <Section icon={<FileSpreadsheet size={20} />} title="Export data">
          <p className="mb-3 text-sm text-stone-600">
            Download all records (products, sales, items sold, customers, utang, load &amp; GCash) to open in Excel or
            Google Sheets. Products, Reports, Utang and Load &amp; GCash also have their own Export button.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={exporting} onClick={() => runExport(() => exportExcel('all'))}>
              <FileSpreadsheet size={18} /> Export all (Excel)
            </Button>
            <Button disabled={exporting} onClick={() => runExport(() => exportCsv('all'))}>
              <FolderArchive size={18} /> Export all (CSV files)
            </Button>
          </div>
        </Section>

        <Section icon={<Smartphone size={20} />} title="Load & GCash fees">
          <FeesForm />
        </Section>

        <Section icon={<ScanBarcode size={20} />} title="Barcode scanner">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              role="switch"
              checked={barcodeOn}
              onChange={async (e) => {
                await setFlag('barcode', e.target.checked);
                toast(e.target.checked ? 'Barcode scanner turned on' : 'Barcode scanner turned off');
              }}
              className="mt-1 size-5 accent-red-700"
            />
            <span className="text-sm text-stone-600">
              <span className="block font-semibold text-stone-800">Use a barcode scanner</span>
              Turn this on if you have a USB or Bluetooth barcode scanner. Products get a Barcode field, and scanning an
              item on the Sell screen adds it to the cart. No setup needed: plug in the scanner and scan.
            </span>
          </label>
        </Section>

        {productCount === 0 && (
          <Section icon={<PackageOpen size={20} />} title="Sample data">
            <p className="mb-3 text-sm text-stone-600">Load common sari-sari products and two sample customers to try the app.</p>
            <Button
              onClick={async () => {
                await seedDemoData();
                toast('Sample data loaded');
              }}
            >
              Load sample data
            </Button>
          </Section>
        )}

        <Section icon={<Keyboard size={20} />} title="Keyboard shortcuts">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {[
              ['/', 'Search products (Sell screen)'],
              ['Enter', 'Add the product when the search shows only one'],
              ['F2', 'Checkout'],
              ['Enter', 'Complete sale (in checkout, after typing cash)'],
              ['Esc', 'Close a window / clear search'],
            ].map(([key, what], i) => (
              <div key={i} className="contents">
                <dt>
                  <kbd className="rounded border border-stone-300 bg-stone-50 px-2 py-0.5 font-mono text-xs">{key}</kbd>
                </dt>
                <dd className="text-stone-600">{what}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <p className="text-center text-xs text-stone-400">Sari-Sari POS version {__APP_VERSION__}</p>
      </div>

      {pending && (
        <ConfirmDialog
          title="Restore this backup?"
          confirmLabel="Replace my data"
          message={
            <>
              <p>
                Backup from <strong>{formatDate(pending.exportedAt)}</strong> with {pending.data.products.length} products,{' '}
                {pending.data.sales.length} sales, {pending.data.services.length} load &amp; GCash and{' '}
                {pending.data.customers.length} customers.
              </p>
              <p className="mt-2 font-semibold text-red-700">All current data on this computer will be replaced.</p>
              {auto.available !== false && (
                <p className="mt-2 text-sm text-stone-500">
                  A copy of your current records is saved first, so you can undo this from the backup list.
                </p>
              )}
            </>
          }
          onClose={() => setPending(null)}
          onConfirm={async () => {
            try {
              await restoreWithSafetyCopy(pending);
              toast('Backup restored');
            } catch (err) {
              toast(errorMessage(err), 'error');
            }
            setPending(null);
          }}
        />
      )}
    </div>
  );
}

/** Default fees filled in on the Load & GCash screen (they can still be changed each time). */
function FeesForm() {
  const toast = useToast();
  const fees = useServiceFees();
  const [form, setForm] = useState<Record<keyof ServiceFees, string> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (fees && !form)
      setForm({ eload: pesoInputValue(fees.eload), gcashPer500: pesoInputValue(fees.gcashPer500), bills: pesoInputValue(fees.bills) });
  }, [fees, form]);
  if (!form) return null;

  const fields: { key: keyof ServiceFees; label: string; hint: string }[] = [
    { key: 'eload', label: 'E-load markup', hint: `e.g. ₱50 load sells for ${formatPeso(5000 + (parsePeso(form.eload) ?? 0))}` },
    { key: 'gcashPer500', label: 'GCash fee per ₱500', hint: 'For cash-in and cash-out, per ₱500 or part of it' },
    { key: 'bills', label: 'Bills payment fee', hint: 'Per bill' },
  ];

  async function save(e: FormEvent) {
    e.preventDefault();
    const parsed = Object.fromEntries(fields.map((f) => [f.key, parsePeso(form![f.key])]));
    if (Object.values(parsed).some((v) => v === null)) return setError('Enter a valid amount for every fee.');
    setError('');
    await setSetting('serviceFees', parsed);
    toast('Fees saved');
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <PesoInput value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
          </Field>
        ))}
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit">Save fees</Button>
    </form>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 flex items-center gap-2 font-bold">
        <span className="text-red-700">{icon}</span>
        {title}
      </h2>
      {children}
    </Card>
  );
}
