import * as SQLite from 'expo-sqlite';

export interface ProductVariant {
  sku: string;
  label: string;
  priceAdjustment: number;
  stock: number;
}

export interface CachedProduct {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  active: number;
  updatedAt: number;
  variants: ProductVariant[];
}

interface ProductRow {
  id: string;
  name: string;
  price: number;
  variants_json: string;
  image_url: string | null;
  active: number;
  updated_at: number;
}

/**
 * Returns all active cached products with parsed variant arrays.
 */
export async function getCachedProducts(
  db: SQLite.SQLiteDatabase
): Promise<CachedProduct[]> {
  const rows = await db.getAllAsync<ProductRow>(
    'SELECT * FROM products WHERE active = 1 ORDER BY name ASC'
  );
  return rows.map((row) => {
    const variants = JSON.parse(row.variants_json ?? '[]') as ProductVariant[];
    const seen = new Set<string>();
    const uniqueVariants = variants.filter((v) => {
      if (seen.has(v.sku)) return false;
      seen.add(v.sku);
      return true;
    });
    return {
      id: row.id,
      name: row.name,
      price: row.price,
      imageUrl: row.image_url,
      active: row.active,
      updatedAt: row.updated_at,
      variants: uniqueVariants,
    };
  });
}

/**
 * Upserts a batch of products into the local cache.
 * Called during catalog sync from API.
 */
export async function upsertProducts(
  db: SQLite.SQLiteDatabase,
  products: CachedProduct[]
): Promise<void> {
  for (const product of products) {
    await db.runAsync(
      `INSERT OR REPLACE INTO products (id, name, price, variants_json, image_url, active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        product.id,
        product.name,
        product.price,
        JSON.stringify(product.variants),
        product.imageUrl,
        product.active,
        product.updatedAt,
      ]
    );
  }
}

/**
 * Returns a single product by ID, or null if not found.
 */
export async function getProductById(
  db: SQLite.SQLiteDatabase,
  productId: string
): Promise<CachedProduct | null> {
  const row = await db.getFirstAsync<ProductRow>(
    'SELECT * FROM products WHERE id = ?',
    [productId]
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    imageUrl: row.image_url,
    active: row.active,
    updatedAt: row.updated_at,
    variants: JSON.parse(row.variants_json ?? '[]') as ProductVariant[],
  };
}

/**
 * Updates the stock count for a specific variant after a local sale.
 * delta should be negative (e.g., -1) to decrement stock.
 */
export async function updateLocalStock(
  db: SQLite.SQLiteDatabase,
  productId: string,
  variantSku: string,
  delta: number
): Promise<void> {
  const product = await getProductById(db, productId);
  if (!product) return;

  const updatedVariants = product.variants.map((v) =>
    v.sku === variantSku ? { ...v, stock: v.stock + delta } : v
  );

  await db.runAsync(
    `UPDATE products SET variants_json = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(updatedVariants), Date.now(), productId]
  );
}
