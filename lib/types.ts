// Tipos compartidos que describen las filas de la base de datos.
// Si cambias el esquema en supabase/schema.sql, actualiza también esto.

export type ProductStatus = "pending" | "published" | "sold" | "rejected" | "removed";
export type ShippingStatus = "unshipped" | "shipped" | "delivered";
export type CommissionStatus = "pending" | "paid";

export type Profile = {
  id: string;
  discord_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  email: string | null;
  iban: string | null;
  vat_number: string | null;
  full_name: string | null;
  id_number: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  zip_code: string | null;
  country: string | null;
  bank_account_holder: string | null;
  bic_swift: string | null;
  notify_discord: boolean;
  vacation_mode: boolean;
  vacation_paused_ids: string[];
  is_admin: boolean;
  is_approved: boolean;
  created_at: string;
};

export type VatType = "vat" | "margin_scheme";

export type Catalog = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  image_url: string;
  created_at: string;
};

// Resultado de buscar en vivo en el catálogo de Shopify (no viene de Supabase).
// "prices" mapea talla EU -> precio actual en fastcopstore.com (si existe esa talla).
// "variantIds" mapea talla EU -> GID de la variante de Shopify (para poder
// actualizarla directamente al consignar).
export type ShopifyCatalogItem = {
  sku: string;
  name: string;
  brand: string;
  image_url: string;
  productId: string;
  prices: Record<string, number>;
  variantIds: Record<string, string>;
  variantSkus: Record<string, string>;
  isEssentials: boolean;
};

export type Product = {
  id: string;
  consignor_id: string;
  brand: string;
  model: string;
  size: string;
  condition: string | null;
  desired_price: number;
  photos: string[];
  status: ProductStatus;
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  original_price: number | null;
  original_sku: string | null;
  deleted_at: string | null;
  admin_notes: string | null;
  commission_rate: number;
  catalog_id: string | null;
  vat_type: VatType | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type Sale = {
  id: string;
  product_id: string;
  consignor_id: string;
  shopify_order_id: string;
  sale_price: number;
  customer_name: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  shipping_status: ShippingStatus;
  shipping_label_url: string | null;
  // Plazo de envío (48h laborables desde la venta, ver lib/businessHours.ts)
  // + horas extra que el admin haya concedido manualmente.
  shipping_deadline: string | null;
  shipping_extension_hours: number;
  shipped_at: string | null;
  tracking_number: string | null;
  created_at: string;
};

export type Commission = {
  id: string;
  sale_id: string;
  consignor_id: string;
  sale_price: number;
  commission_rate: number;
  fastcop_fee: number;
  consignor_amount: number;
  status: CommissionStatus;
  // Multa por envío tardío aplicada al marcar como pagada (0 = sin multa).
  late_penalty: number;
  created_at: string;
};

// Tallas EU estándar para el selector de "Añadir producto"
export const EU_SIZES = [
  "36", "36.5", "37", "37.5", "38", "38.5", "39", "40", "40.5",
  "41", "42", "42.5", "43", "44", "44.5", "45", "46",
] as const;
