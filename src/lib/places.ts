// Short place names for lists and alerts: the campus is "MSEUF", not its
// full legal name written out in every line (adviser feedback: too much text).
const CAMPUS = /Manuel S\.? Enverga University Foundation(?:,? Lucena(?: City)?)?|Enverga University(?:,? Lucena(?: City)?)?/gi;

export function shortPlace(text: string): string {
  return text.replace(CAMPUS, 'MSEUF');
}

// "Sariaya Town Plaza, Sariaya, Quezon" → "Sariaya Town Plaza": the first part
// of an address, for one-line routes. The campus becomes "MSEUF".
export function placeName(address: string): string {
  const short = shortPlace(address);
  return short.startsWith('MSEUF') ? 'MSEUF' : short.split(',')[0].trim();
}
