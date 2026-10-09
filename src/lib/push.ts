// Turning phone notifications (Web Push) on and off in this browser (sub-project F).
import { apiFetch } from '@/lib/api';
import { isIosSafari } from '@/lib/loudNotifications';

export type PushState = 'unsupported' | 'ios-install' | 'off-server' | 'blocked' | 'off' | 'on';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export async function pushState(): Promise<PushState> {
  if (isIosSafari(navigator.userAgent, standalone())) return 'ios-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const { publicKey } = await apiFetch<{ publicKey: string | null }>('/api/push/key');
  if (!publicKey) return 'off-server';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

// Asks the browser's permission, subscribes, and registers the phone with the API.
export async function turnOnPush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.register('/sw.js');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const { publicKey } = await apiFetch<{ publicKey: string | null }>('/api/push/key');
  if (!publicKey) return 'off-server';
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  await apiFetch('/api/push/subscriptions', { method: 'POST', body: JSON.stringify(sub.toJSON()) });
  return 'on';
}

export async function turnOffPush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await apiFetch('/api/push/subscriptions', { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe();
  }
  return 'off';
}
