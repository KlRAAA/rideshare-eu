// Colors carry one meaning everywhere (globals.css, .rsu-tone-*): green
// confirmed or open, amber waiting, red cancelled or declined, blue happening
// now, grey finished or neutral.
type Tone = 'success' | 'warning' | 'neutral' | 'primary' | 'info' | 'danger';

// inProgress: today's run has started (sub-project B).
export function tripStatusBadge(status: string, inProgress = false): { label: string; tone: Tone } {
  if (inProgress) return { label: 'In progress', tone: 'info' };
  switch (status) {
    case 'OPEN':
      return { label: 'Open', tone: 'success' };
    case 'FULL':
      return { label: 'Full', tone: 'neutral' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'danger' };
    case 'COMPLETED':
      return { label: 'Completed', tone: 'neutral' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export function matchStatusBadge(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'PENDING':
      return { label: 'Pending', tone: 'warning' };
    case 'APPROVED':
      return { label: 'Confirmed', tone: 'success' };
    case 'DECLINED':
      return { label: 'Declined', tone: 'danger' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'danger' };
    case 'COMPLETED':
      return { label: 'Completed', tone: 'neutral' };
    default:
      return { label: status, tone: 'neutral' };
  }
}
