// Clinic header printed at the top of every report. Each installation starts
// empty; the doctor fills it in once via "⚙ Setări" and it is stored in
// localStorage as JSON.

export type ClinicSettings = {
  name: string;
  address: string;
};

export const CLINIC_SETTINGS_STORAGE_KEY = 'ecocard-clinic-settings';

export function createEmptyClinicSettings(): ClinicSettings {
  return { name: '', address: '' };
}

/** Reads stored settings; missing or invalid data yields empty fields. */
export function parseClinicSettings(raw: string | null): ClinicSettings {
  if (!raw) return createEmptyClinicSettings();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return createEmptyClinicSettings();
  }
  if (typeof data !== 'object' || data === null) return createEmptyClinicSettings();
  const { name, address } = data as Record<string, unknown>;
  return {
    name: typeof name === 'string' ? name.trim() : '',
    address: typeof address === 'string' ? address.trim() : '',
  };
}

export function isClinicSettingsEmpty(settings: ClinicSettings): boolean {
  return settings.name.trim() === '' && settings.address.trim() === '';
}
