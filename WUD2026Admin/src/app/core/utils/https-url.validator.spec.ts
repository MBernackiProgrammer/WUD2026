import { FormControl } from '@angular/forms';
import { optionalHttpsUrl } from './https-url.validator';

describe('Seller URL validation', () => {
  it('accepts an empty optional URL and a complete HTTPS address', () => {
    expect(optionalHttpsUrl(new FormControl(''))).toBeNull();
    expect(
      optionalHttpsUrl(new FormControl('https://tickets.example.org/event?id=123')),
    ).toBeNull();
  });
  it('rejects unsafe protocols and embedded credentials', () => {
    expect(optionalHttpsUrl(new FormControl('javascript:alert(1)'))).toEqual({ httpsUrl: true });
    expect(optionalHttpsUrl(new FormControl('https://user:password@example.org'))).toEqual({
      httpsUrl: true,
    });
  });
});
