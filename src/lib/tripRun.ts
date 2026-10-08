// Labels for a trip run on the trip page.
export function elapsedLabel(startedAt: string | Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 60000);
  if (minutes < 1) return 'just started';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function clockLabel(at: string | Date): string {
  return new Date(at).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
}
