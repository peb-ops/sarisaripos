import { db, type Product } from './schema';

// Demo data so the store can try the app right away. Prices are illustrative.

type SeedProduct = [name: string, category: string, baseUnit: string, cost: number, units: [string, number, number][], stock: number, lowStockAt: number];

const p = (pesos: number) => Math.round(pesos * 100);

const PRODUCTS: SeedProduct[] = [
  ['Lucky Me Pancit Canton', 'Noodles', 'pack', p(15), [['pack', 1, p(18)]], 48, 12],
  ['Lucky Me Beef Mami', 'Noodles', 'pack', p(10), [['pack', 1, p(12)]], 36, 10],
  ['Nissin Cup Noodles', 'Noodles', 'cup', p(26), [['cup', 1, p(30)]], 12, 4],
  ['Century Tuna Flakes 155g', 'Canned', 'can', p(33), [['can', 1, p(38)]], 18, 5],
  ['Ligo Sardines 155g', 'Canned', 'can', p(21), [['can', 1, p(25)]], 24, 6],
  ['Argentina Corned Beef 150g', 'Canned', 'can', p(40), [['can', 1, p(45)]], 10, 4],
  ['Coke Mismo', 'Drinks', 'bottle', p(17), [['bottle', 1, p(20)]], 24, 6],
  ['Coke 1.5L', 'Drinks', 'bottle', p(68), [['bottle', 1, p(75)]], 6, 2],
  ['Royal Mismo', 'Drinks', 'bottle', p(17), [['bottle', 1, p(20)]], 12, 6],
  ['Nescafé 3-in-1 Original', 'Coffee & Milk', 'sachet', p(8), [['sachet', 1, p(10)]], 60, 15],
  ['Great Taste White', 'Coffee & Milk', 'sachet', p(8), [['sachet', 1, p(10)]], 40, 15],
  ['Bear Brand 33g', 'Coffee & Milk', 'sachet', p(11.5), [['sachet', 1, p(14)]], 30, 10],
  ['Skyflakes', 'Snacks', 'pack', p(6.5), [['pack', 1, p(8)]], 40, 10],
  ['Piattos', 'Snacks', 'pack', p(17), [['pack', 1, p(20)]], 15, 5],
  ['Chippy', 'Snacks', 'pack', p(17), [['pack', 1, p(20)]], 15, 5],
  ['Maxx Candy', 'Snacks', 'piece', p(0.75), [['piece', 1, p(1)], ['3 pcs', 3, p(2)]], 150, 30],
  ['Marlboro Red', 'Cigarettes', 'stick', p(8.25), [['stick', 1, p(10)], ['pack', 20, p(180)]], 200, 40],
  ['Fortune', 'Cigarettes', 'stick', p(6), [['stick', 1, p(7)], ['pack', 20, p(130)]], 200, 40],
  ['Rice (Dinorado)', 'Rice & Grocery', '¼ kg', p(12.5), [['¼ kg', 1, p(14)], ['½ kg', 2, p(28)], ['1 kg', 4, p(54)]], 100, 20],
  ['Eggs', 'Rice & Grocery', 'piece', p(8), [['piece', 1, p(9)], ['tray (30)', 30, p(255)]], 60, 12],
  ['Pandesal', 'Rice & Grocery', 'piece', p(3.5), [['piece', 1, p(5)]], 40, 10],
  ['Cooking Oil (tingi)', 'Rice & Grocery', 'pack', p(12), [['pack', 1, p(15)]], 20, 6],
  ['Silver Swan Soy Sauce pouch', 'Condiments', 'pouch', p(8), [['pouch', 1, p(10)]], 20, 6],
  ['Datu Puti Vinegar pouch', 'Condiments', 'pouch', p(8), [['pouch', 1, p(10)]], 20, 6],
  ['Ajinomoto sachet', 'Condiments', 'sachet', p(4), [['sachet', 1, p(5)]], 30, 10],
  ['Safeguard bar', 'Toiletries', 'bar', p(40), [['bar', 1, p(45)]], 8, 3],
  ['Palmolive Shampoo sachet', 'Toiletries', 'sachet', p(6.5), [['sachet', 1, p(8)]], 48, 12],
  ['Colgate sachet', 'Toiletries', 'sachet', p(10), [['sachet', 1, p(12)]], 24, 6],
  ['Surf Powder sachet', 'Laundry', 'sachet', p(8.5), [['sachet', 1, p(10)]], 36, 10],
  ['Joy Dishwashing sachet', 'Laundry', 'sachet', p(6), [['sachet', 1, p(7)]], 36, 10],
];

const CUSTOMERS = [
  { name: 'Aling Nena', phone: '0917 123 4567', creditLimit: p(1000) },
  { name: 'Mang Jun', creditLimit: p(500) },
];

export async function seedDemoData(now = Date.now()): Promise<void> {
  await db.transaction('rw', db.products, db.customers, async () => {
    const products: Product[] = PRODUCTS.map(([name, category, baseUnit, costPerBase, units, stock, lowStockAt]) => ({
      name,
      category,
      baseUnit,
      costPerBase,
      units: units.map(([unitName, qtyInBase, price]) => ({ name: unitName, qtyInBase, price })),
      stock,
      lowStockAt,
      active: true,
      createdAt: now,
    }));
    await db.products.bulkAdd(products);
    await db.customers.bulkAdd(CUSTOMERS.map((c) => ({ ...c, createdAt: now })));
  });
}
