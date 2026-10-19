import { createRequestId } from './request-id';

describe('Chat request IDs on HTTP LAN', () => {
  it('uses secure random bytes without depending on randomUUID', () => {
    const random = spyOn(globalThis.crypto, 'getRandomValues').and.callThrough();
    const ids = Array.from({ length: 20 }, () => createRequestId());
    expect(random).toHaveBeenCalledTimes(20);
    for (const id of ids)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
