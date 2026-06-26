/**
 * @file routes.ts
 * @description Single source of truth for URL paths and the mapping between the
 * authenticated app's internal `ShellView` and its real, shareable URL.
 *
 * The app uses real browser URLs (react-router) but keeps the existing
 * view-state rendering inside MainApp; this map is the bridge between the two.
 */

import { ShellView } from './components/AppShell';

/** Authenticated-app view -> canonical URL path. */
export const VIEW_TO_PATH: Record<ShellView, string> = {
  'landing': '/home',          // in-app hub (MainDashboard)
  'study': '/study',
  'dashboard': '/dashboard',   // analytics
  'mock-study': '/mock-study',
  'exam-mode': '/exam',
  'payment-success': '/payment/success',
  'payment-cancel': '/payment/cancel',
};

/** Canonical URL path -> authenticated-app view. */
export const PATH_TO_VIEW: Record<string, ShellView> = Object.entries(VIEW_TO_PATH)
  .reduce((acc, [view, path]) => {
    acc[path] = view as ShellView;
    return acc;
  }, {} as Record<string, ShellView>);

/** Public (unauthenticated) auth-flow views. */
export type AuthView = 'landing' | 'login' | 'register' | 'verify';

/** Public paths the unauthenticated app serves. `/login` and `/register` are
 *  aliases that redirect to the canonical `/signin` and `/signup`. */
export const PUBLIC_PATHS = ['/', '/signin', '/signup', '/login', '/register', '/verify'];

/** Default landing spot for an authenticated user. */
export const HOME_PATH = '/home';

/** Returns true if the path belongs to the authenticated app. */
export const isAppPath = (pathname: string): boolean =>
  Object.prototype.hasOwnProperty.call(PATH_TO_VIEW, pathname);
