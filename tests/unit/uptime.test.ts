import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain JS script, no types needed for this test
import { checkHealth, checkSite } from '../../scripts/uptime.mjs';

const reply = (status: number, body: string) => async () => new Response(body, { status });
const refuse = async () => { throw new Error('connection refused'); };

describe('the uptime check', () => {
  it('passes the app, and nothing else that answers 200', async () => {
    expect(await checkSite(reply(200, '<html><div id="root"></div></html>'), 'https://s')).toBeNull();
    expect(await checkSite(reply(200, '<html>This domain is parked</html>'), 'https://s')).toMatch(/not with the Mole Sense app/);
    expect(await checkSite(reply(522, ''), 'https://s')).toMatch(/answered 522/);
    expect(await checkSite(refuse, 'https://s')).toMatch(/didn't answer: connection refused/);
  });

  it('names the part of the backend that is down', async () => {
    expect(await checkHealth(reply(200, '{"ok":true,"database":true,"moleV3":true}'), 'https://h')).toBeNull();
    expect(await checkHealth(reply(200, '{"ok":false,"database":true,"moleV3":false}'), 'https://h')).toMatch(/moleV3 not reachable/);
    expect(await checkHealth(reply(502, '<html>Bad gateway</html>'), 'https://h')).toMatch(/didn't answer with JSON/);
  });
});
