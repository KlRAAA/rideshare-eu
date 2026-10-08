// Tabs and wording for Driver and Passenger mode (sub-project C).
import { clockLabel } from './tripRun';

export type AppMode = 'DRIVER' | 'PASSENGER';
export type TabKey = 'dashboard' | 'search' | 'post' | 'trips' | 'notifications' | 'profile';

const HOME = { key: 'dashboard' as TabKey, href: '/auth/dashboard', label: 'Home' };
const ALERTS = { key: 'notifications' as TabKey, href: '/auth/notifications', label: 'Alerts' };
const PROFILE = { key: 'profile' as TabKey, href: '/auth/profile', label: 'Profile' };

export function tabsFor(mode: AppMode) {
  return mode === 'DRIVER'
    ? [HOME, { key: 'post' as TabKey, href: '/auth/post', label: 'Post a Trip' }, { key: 'trips' as TabKey, href: '/auth/trips', label: 'My Trips' }, ALERTS, PROFILE]
    : [HOME, { key: 'search' as TabKey, href: '/auth/search', label: 'Find a Ride' }, { key: 'trips' as TabKey, href: '/auth/trips', label: 'My Rides' }, ALERTS, PROFILE];
}

export const otherMode = (mode: AppMode): AppMode => (mode === 'DRIVER' ? 'PASSENGER' : 'DRIVER');
export const modeLabel = (mode: AppMode) => (mode === 'DRIVER' ? 'Driver' : 'Passenger');

export function conflictMessage(departure: string): string {
  return `You already have a trip at ${clockLabel(departure)} that overlaps this one. Pick a different time or ride.`;
}
