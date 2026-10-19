import { isDevMode } from '@angular/core';
const runtime = (globalThis as { __FILHARMONIA_CONFIG__?: { publicApiUrl?: string; publicSiteUrl?: string } }).__FILHARMONIA_CONFIG__;
const host = typeof location === 'undefined' ? 'http://127.0.0.1' : location.protocol + '//' + location.hostname;
export const CONTENT_API_URL = runtime?.publicApiUrl || (isDevMode() ? host + ':5296/api' : '/api');
export const PUBLIC_SITE_URL = runtime?.publicSiteUrl || (isDevMode() ? host + ':4200' : '/');
