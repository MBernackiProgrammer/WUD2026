import { isDevMode } from '@angular/core';
const environment = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
const runtime = (globalThis as { __FILHARMONIA_CONFIG__?: { publicApiUrl?: string; publicAdminUrl?: string } }).__FILHARMONIA_CONFIG__;
const host = typeof location === 'undefined' ? 'http://127.0.0.1' : location.protocol + '//' + location.hostname;
/** Private API routes and credentials never enter the public runtime config. */
export const CONTENT_API_URL = typeof window === 'undefined'
  ? environment?.['INTERNAL_API_URL'] || (isDevMode() ? host + ':5296/api' : 'http://api:8080/api')
  : runtime?.publicApiUrl || (isDevMode() ? host + ':5296/api' : '/api');
export const ADMIN_SITE_URL = typeof window === 'undefined'
  ? environment?.['PUBLIC_ADMIN_URL'] || (isDevMode() ? host + ':4201' : '/admin/')
  : runtime?.publicAdminUrl || (isDevMode() ? host + ':4201' : '/admin/');
