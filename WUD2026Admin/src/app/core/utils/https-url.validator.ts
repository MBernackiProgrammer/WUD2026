import { ValidatorFn } from '@angular/forms';

export const optionalHttpsUrl: ValidatorFn = (control) => {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !!url.hostname &&
      !url.username &&
      !url.password &&
      !/[\s\\]/.test(value)
      ? null
      : { httpsUrl: true };
  } catch {
    return { httpsUrl: true };
  }
};
