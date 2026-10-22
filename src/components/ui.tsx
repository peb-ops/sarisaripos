import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'success' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-red-700 text-white hover:bg-red-800',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  secondary: 'bg-white text-stone-800 border border-stone-300 hover:bg-stone-50',
  danger: 'bg-white text-red-700 border border-red-300 hover:bg-red-50',
  ghost: 'text-stone-600 hover:bg-stone-200/70',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-5 py-3 text-lg',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-lg border border-stone-300 bg-white px-3 py-2 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-200 ${className}`}
      {...props}
    />
  );
});

/** Text input for peso amounts; value is the raw typed string (parse with parsePeso). */
export const PesoInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PesoInput(
  { className = '', ...props },
  ref,
) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone-500">₱</span>
      <Input ref={ref} inputMode="decimal" autoComplete="off" className={`pl-7 ${className}`} {...props} />
    </div>
  );
});

export function Field({ label, hint, children, className = '' }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-stone-200 bg-white ${className}`}>{children}</div>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
      {children}
    </p>
  );
}

export function Chip({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
        active ? 'bg-stone-900 text-white' : 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
      }`}
    >
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.';
}
