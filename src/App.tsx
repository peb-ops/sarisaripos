import { BarChart3, NotebookPen, Package, Settings as SettingsIcon, ShoppingCart, Smartphone, Store } from 'lucide-react';
import { Suspense, lazy } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import { ToastProvider } from './components/Toast';
import { useProducts, useSetting } from './hooks';
import { lowStock } from './lib/reports';
import Sell from './pages/Sell';
import { CartProvider } from './state/cart';

// Sell is the first screen, so it's in the main bundle. The others load when
// first opened (Reports brings the chart library), so the app starts faster.
const Products = lazy(() => import('./pages/Products'));
const Utang = lazy(() => import('./pages/Utang'));
const Services = lazy(() => import('./pages/Services'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));

const NAV = [
  { to: '/', label: 'Sell', sub: 'Benta', icon: ShoppingCart, end: true },
  { to: '/products', label: 'Products', sub: 'Paninda', icon: Package },
  { to: '/utang', label: 'Utang', sub: 'Listahan', icon: NotebookPen },
  { to: '/services', label: 'Load & GCash', sub: 'E-load, bills', icon: Smartphone },
  { to: '/reports', label: 'Reports', sub: 'Ulat', icon: BarChart3 },
  { to: '/settings', label: 'Settings', sub: '', icon: SettingsIcon },
];

export default function App() {
  const storeName = useSetting('storeName', 'Sari-Sari Store');
  const products = useProducts();
  const lowCount = products ? lowStock(products).length : 0;

  return (
    <ToastProvider>
      <CartProvider>
        <div className="flex h-full">
          <nav className="flex w-52 shrink-0 flex-col bg-stone-900 text-stone-300">
            <div className="flex items-center gap-2 px-4 py-5 text-white">
              <span className="rounded-lg bg-red-700 p-2">
                <Store size={20} />
              </span>
              <span className="font-bold leading-tight">{storeName}</span>
            </div>
            <ul className="flex flex-col gap-1 px-2">
              {NAV.map(({ to, label, sub, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-3 transition-colors ${
                        isActive ? 'bg-red-700 text-white' : 'hover:bg-stone-800 hover:text-white'
                      }`
                    }
                  >
                    <Icon size={22} />
                    <span className="flex-1">
                      <span className="block font-semibold">{label}</span>
                      {sub && <span className="block text-xs opacity-70">{sub}</span>}
                    </span>
                    {to === '/products' && lowCount > 0 && (
                      <span
                        title={`${lowCount} low on stock`}
                        className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-stone-900"
                      >
                        {lowCount}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <main className="min-w-0 flex-1 overflow-hidden">
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Sell />} />
                <Route path="/products" element={<Products />} />
                <Route path="/utang" element={<Utang />} />
                <Route path="/utang/:customerId" element={<Utang />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/services" element={<Services />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </CartProvider>
    </ToastProvider>
  );
}
