// Indian vehicle registration numbers, in the two accepted layouts:
//   Standard:     MH 36 AD 2861  (state, 2-digit RTO, 1-3 series letters, 4 digits)
//   Bharat (BH):  22 BH 8667 CD  (year, BH, 4 digits, 1-2 series letters)

export const VEHICLE_FORMAT_HINT = 'e.g. MH 36 AD 2861, MH 48 D 9886 or 22 BH 8667 CD';
export const VEHICLE_FORMAT_ERROR = `Enter a valid vehicle number, ${VEHICLE_FORMAT_HINT}.`;

const STATE_CODES = new Set(
  'AN AP AR AS BR CG CH CT DD DL DN GA GJ HP HR JH JK KA KL LA LD MH ML MN MP MZ NL OD OR PB PY RJ SK TG TN TR TS UA UK UP WB'.split(
    ' ',
  ),
);

const STANDARD = /^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{4})$/;
const BHARAT = /^(\d{2})BH(\d{4})([A-Z]{1,2})$/;

/** Uppercase letters and digits only, e.g. "mh-36 ad 2861" -> "MH36AD2861". */
export function compactVehicleNumber(input: string): string {
  return (input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Returns the standard spaced form, or null when the input is not a valid plate. */
export function formatVehicleNumber(input: string): string | null {
  const compact = compactVehicleNumber(input);

  const standard = compact.match(STANDARD);
  if (standard && STATE_CODES.has(standard[1]!) && standard[2] !== '00' && standard[4] !== '0000') {
    return `${standard[1]} ${standard[2]} ${standard[3]} ${standard[4]}`;
  }

  const bharat = compact.match(BHARAT);
  if (bharat && Number(bharat[1]) >= 21 && bharat[2] !== '0000') {
    return `${bharat[1]} BH ${bharat[2]} ${bharat[3]}`;
  }

  return null;
}
