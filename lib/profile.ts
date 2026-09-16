// Campos de "Settings" que un seller debe rellenar antes de poder listar
// nada ("Add product"). Si falta alguno, se le manda a /dashboard/settings.
export type ProfileCompletenessFields = {
  full_name: string | null;
  iban: string | null;
  bank_account_holder: string | null;
  address: string | null;
  city: string | null;
  zip_code: string | null;
  country: string | null;
  phone: string | null;
};

export function isProfileComplete(p: ProfileCompletenessFields | null | undefined): boolean {
  if (!p) return false;
  return !!(
    p.full_name?.trim() &&
    p.iban?.trim() &&
    p.bank_account_holder?.trim() &&
    p.address?.trim() &&
    p.city?.trim() &&
    p.zip_code?.trim() &&
    p.country?.trim() &&
    p.phone?.trim()
  );
}
