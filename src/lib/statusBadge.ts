type Tone = 'success' | 'warning' | 'neutral' | 'primary' | 'info';

// inProgress: today's run has started (sub-project B).
export function tripStatusBadge(status: string, inProgress = false): { label: string; tone: Tone } {
  if (inProgress) return { label: 'In progress', tone: 'primary' };
  switch (status) {
    case 'OPEN':
      return { label: 'Open', tone: 'success' };
    case 'FULL':
      return { label: 'Full', tone: 'warning' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'neutral' };
    case 'COMPLETED':
      return { label: 'Completed', tone: 'info' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export function matchStatusBadge(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'PENDING':
      return { label: 'Pending', tone: 'warning' };
    case 'APPROVED':
      return { label: 'Confirmed', tone: 'primary' };
    case 'DECLINED':
      return { label: 'Declined', tone: 'neutral' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'neutral' };
    case 'COMPLETED':
      return { label: 'Completed', tone: 'info' };
    default:
      return { label: status, tone: 'neutral' };
  }
}
