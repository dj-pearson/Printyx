// Unit tests for NetworkScanner result merging. We don't actually do
// real multicast in CI — we monkey-patch the per-method runners to
// return canned results and verify the merge / dedupe contract.
//
// Run with: npx tsx --test src/discovery/network-scanner.test.ts

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { NetworkScanner, DiscoveredDevice } from './network-scanner';

function fixtureScanner(byMethod: {
  mdns?: DiscoveredDevice[];
  wsd?: DiscoveredDevice[];
  cidr?: DiscoveredDevice[];
}) {
  const scanner = new NetworkScanner();
  // Reach into private runners and stub them. The merge logic in
  // discoverDevices() is what we want to test.
  (scanner as any).runMdns = async () =>
    (byMethod.mdns || []).map((d) => ({ ...d, discoveredVia: ['mdns'] }));
  (scanner as any).runWsd = async () =>
    (byMethod.wsd || []).map((d) => ({ ...d, discoveredVia: ['wsd'] }));
  (scanner as any).runCidr = async () =>
    (byMethod.cidr || []).map((d) => ({ ...d, discoveredVia: ['cidr'] }));
  return scanner;
}

test('merges results from multiple methods by IP', async () => {
  const scanner = fixtureScanner({
    mdns: [{ ipAddress: '10.0.0.5', protocol: 'snmp', isResponding: true, hostname: 'hp01.local' }],
    wsd: [{ ipAddress: '10.0.0.5', protocol: 'snmp', isResponding: true }],
    cidr: [{ ipAddress: '10.0.0.99', protocol: 'snmp', isResponding: true }],
  });
  const out = await scanner.discoverDevices(['10.0.0.0/24'], ['mdns', 'wsd', 'cidr']);
  // Two unique IPs.
  assert.equal(out.length, 2);
  // Same IP from mdns + wsd should carry both source tags.
  const merged = out.find((d) => d.ipAddress === '10.0.0.5')!;
  assert.deepEqual(merged.discoveredVia?.sort(), ['mdns', 'wsd']);
  // Hostname survives from mdns even though wsd didn't have one.
  assert.equal(merged.hostname, 'hp01.local');
});

test('only invokes methods that were requested', async () => {
  const scanner = fixtureScanner({
    mdns: [{ ipAddress: '10.0.0.5', protocol: 'snmp', isResponding: true }],
    wsd: [{ ipAddress: '10.0.0.6', protocol: 'snmp', isResponding: true }],
    cidr: [{ ipAddress: '10.0.0.7', protocol: 'snmp', isResponding: true }],
  });
  const out = await scanner.discoverDevices([], ['mdns']);
  assert.equal(out.length, 1);
  assert.equal(out[0].ipAddress, '10.0.0.5');
});

test('"all" method runs every discovery path', async () => {
  const scanner = fixtureScanner({
    mdns: [{ ipAddress: '10.0.0.5', protocol: 'snmp', isResponding: true }],
    wsd: [{ ipAddress: '10.0.0.6', protocol: 'snmp', isResponding: true }],
    cidr: [{ ipAddress: '10.0.0.7', protocol: 'snmp', isResponding: true }],
  });
  const out = await scanner.discoverDevices(['10.0.0.0/24'], ['all']);
  const ips = out.map((d) => d.ipAddress).sort();
  assert.deepEqual(ips, ['10.0.0.5', '10.0.0.6', '10.0.0.7']);
});
