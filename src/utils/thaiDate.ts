/**
 * Thai Date & Time formatting utilities
 * Formats dates in Thai Buddhist Era (พ.ศ.)
 */

export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.',
  'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.',
  'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

export const THAI_DAYS = [
  'อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'
];

export function toThaiYear(gregorianYear: number): number {
  return gregorianYear > 2400 ? gregorianYear : gregorianYear + 543;
}

export function toGregorianYear(thaiYear: number): number {
  return thaiYear > 2400 ? thaiYear - 543 : thaiYear;
}

export function formatThaiDate(
  dateInput: string | number | Date | null | undefined,
  format: 'full' | 'medium' | 'short' | 'time' | 'full-with-time' = 'medium'
): string {
  if (!dateInput) return '-';

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';

  const day = date.getDate();
  const monthIdx = date.getMonth();
  const year = date.getFullYear() + 543;
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const dayOfWeek = THAI_DAYS[date.getDay()];

  switch (format) {
    case 'full':
      return `วัน${dayOfWeek}ที่ ${day} ${THAI_MONTHS_FULL[monthIdx]} พ.ศ. ${year}`;
    case 'full-with-time':
      return `${day} ${THAI_MONTHS_FULL[monthIdx]} พ.ศ. ${year} เวลา ${hours}:${minutes} น.`;
    case 'medium':
      return `${day} ${THAI_MONTHS_SHORT[monthIdx]} ${year}`;
    case 'short':
      return `${day.toString().padStart(2, '0')}/${(monthIdx + 1).toString().padStart(2, '0')}/${year}`;
    case 'time':
      return `${hours}:${minutes} น.`;
    default:
      return `${day} ${THAI_MONTHS_SHORT[monthIdx]} ${year}`;
  }
}

export function getCurrentThaiAcademicYear(): number {
  const now = new Date();
  const gregorianYear = now.getFullYear();
  // Thai academic year usually starts around May (month 4 in 0-indexed)
  // If before May, it's considered previous academic year
  const month = now.getMonth();
  let academicYearGregorian = gregorianYear;
  if (month < 4) {
    academicYearGregorian -= 1;
  }
  return academicYearGregorian + 543;
}

/**
 * Flexible date parser for Excel dates, Thai Buddhist era dates, ISO strings
 * Returns YYYY-MM-DD (Gregorian)
 */
export function parseDateToYyyyMmDd(val: any): string {
  if (val === null || val === undefined || val === '') {
    return new Date().toISOString().split('T')[0];
  }

  // 1. If it's already a JS Date object
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return val.toISOString().split('T')[0];
    }
  }

  // 2. If it's an Excel numeric serial date (e.g. 45290)
  if (typeof val === 'number' && val > 1000 && val < 90000) {
    // Excel base date is 1899-12-30 (accounting for 1900 leap year bug)
    const excelEpochMs = (val - 25569) * 86400 * 1000;
    const d = new Date(excelEpochMs);
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  const str = String(val).trim();
  if (!str) {
    return new Date().toISOString().split('T')[0];
  }

  // 3. If standard ISO format YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    let year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (year > 2400) year -= 543; // Convert Thai Buddhist year to Gregorian
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // 4. If DD/MM/YYYY or DD-MM-YYYY format
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000; // e.g. 26 -> 2026
    if (year > 2400) year -= 543; // e.g. 2569 -> 2026
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // 5. Thai month name check (e.g. "10 ก.ย. 2569" or "10 กันยายน 2569")
  for (let i = 0; i < 12; i++) {
    const shortName = THAI_MONTHS_SHORT[i].replace('.', '');
    const fullName = THAI_MONTHS_FULL[i];
    if (str.includes(shortName) || str.includes(fullName)) {
      const numbers = str.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        const day = parseInt(numbers[0], 10);
        let year = parseInt(numbers[numbers.length - 1], 10);
        if (year > 2400) year -= 543;
        const month = i + 1;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }

  // 6. Try standard Date.parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    let year = parsed.getFullYear();
    if (year > 2400) year -= 543;
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return new Date().toISOString().split('T')[0];
}

