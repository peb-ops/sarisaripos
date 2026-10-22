import { X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-[92vh] w-full flex-col rounded-2xl bg-white shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
      >
        <header className="flex items-center justify-between gap-4 border-b border-stone-200 px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-lg p-1 text-stone-500 hover:bg-stone-100"
          >
            <X size={20} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-stone-200 px-5 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy}
            autoFocus
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-stone-700">{message}</div>
    </Modal>
  );
}
