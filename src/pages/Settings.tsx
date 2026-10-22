import { useLiveQuery } from 'dexie-react-hooks';
import { Download, HardDrive, Keyboard, PackageOpen, Store, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Button, Card, Field, Input, PageHeader, errorMessage } from '../components/ui';
import { db } from '../db/schema';
import { seedDemoData } from '../db/seed';
import { useSetting } from '../hooks';
import { downloadJson, exportBackup, parseBackup, restoreBackup, type Backup } from '../lib/backup';
import { daysAgo, formatDate, formatDateTime } from '../lib/format';
import { setSetting } from '../lib/settings';

export default function Settings() {
  const toast = useToast();
  const storeName = useSetting('storeName', 'Sari-Sari Store');
  const lastBackupAt = useSetting<number | null>('lastBackupAt', null);
  const productCount = useLiveQuery(() => db.products.count(), []);
  const [name, setName] = useState(storeName);
  const [pending, setPending] = useState<Backup | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
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
            Everything is saved only on this computer. Download a backup regularly so you don't lose your records if
            the computer breaks.
          </p>
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
          {persisted === false && (
            <p className="mt-4 text-xs text-stone-500">
              Tip: install this app (the install icon in the browser's address bar) so the browser keeps its data safe.
            </p>
          )}
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
                {pending.data.sales.length} sales and {pending.data.customers.length} customers.
              </p>
              <p className="mt-2 font-semibold text-red-700">All current data on this computer will be replaced.</p>
            </>
          }
          onClose={() => setPending(null)}
          onConfirm={async () => {
            try {
              await restoreBackup(pending);
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
