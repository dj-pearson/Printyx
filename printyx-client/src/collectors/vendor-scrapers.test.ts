// Unit tests for the vendor HTTP scrapers. We don't actually hit the
// network — we feed canned XML through a stubbed axios.
//
// Run with: npx tsx --test src/collectors/vendor-scrapers.test.ts

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { xmlAll, xmlFirst, scrapeHp, scrapeKonicaMinolta } from './vendor-scrapers';

// ── XML helpers ─────────────────────────────────────────────────────

test('xmlFirst strips namespace prefixes', () => {
  const body = '<dd:SerialNumber>VND123ABC</dd:SerialNumber>';
  assert.equal(xmlFirst('SerialNumber', body), 'VND123ABC');
});

test('xmlAll returns every match', () => {
  const body = `
    <ConsumableInfo>
      <ConsumableLabelCode>K</ConsumableLabelCode>
      <ConsumablePercentageLevelRemaining>85</ConsumablePercentageLevelRemaining>
    </ConsumableInfo>
    <ConsumableInfo>
      <ConsumableLabelCode>C</ConsumableLabelCode>
      <ConsumablePercentageLevelRemaining>62</ConsumablePercentageLevelRemaining>
    </ConsumableInfo>`;
  assert.deepEqual(xmlAll('ConsumableLabelCode', body), ['K', 'C']);
  assert.deepEqual(xmlAll('ConsumablePercentageLevelRemaining', body), ['85', '62']);
});

test('xmlFirst returns undefined when tag is absent', () => {
  assert.equal(xmlFirst('Nope', '<Yes>1</Yes>'), undefined);
});

// ── HP scraper with stub axios ──────────────────────────────────────

function makeStubHttp(byUrl: Record<string, string | null>) {
  return {
    get: async (url: string) => {
      const data = byUrl[url];
      if (data == null) {
        const err: any = new Error(`404: ${url}`);
        err.response = { status: 404 };
        throw err;
      }
      return { status: 200, data };
    },
  } as any;
}

const HP_PRODUCT_XML = `<?xml version="1.0"?>
<pcdyn:ProductConfigDyn xmlns:dd="x" xmlns:pcdyn="x">
  <dd:SerialNumber>VND4242PQR</dd:SerialNumber>
  <dd:MakeAndModelBase>HP LaserJet Enterprise M607</dd:MakeAndModelBase>
</pcdyn:ProductConfigDyn>`;

const HP_CONSUMABLE_XML = `<?xml version="1.0"?>
<ccdyn:ConsumableConfigDyn xmlns:dd="x" xmlns:ccdyn="x">
  <ccdyn:ConsumableInfo>
    <dd:ConsumableLabelCode>K</dd:ConsumableLabelCode>
    <dd:ConsumablePercentageLevelRemaining>85</dd:ConsumablePercentageLevelRemaining>
  </ccdyn:ConsumableInfo>
  <ccdyn:ConsumableInfo>
    <dd:ConsumableLabelCode>C</dd:ConsumableLabelCode>
    <dd:ConsumablePercentageLevelRemaining>62</dd:ConsumablePercentageLevelRemaining>
  </ccdyn:ConsumableInfo>
  <ccdyn:ConsumableInfo>
    <dd:ConsumableLabelCode>Y</dd:ConsumableLabelCode>
    <dd:ConsumablePercentageLevelRemaining>10</dd:ConsumablePercentageLevelRemaining>
  </ccdyn:ConsumableInfo>
</ccdyn:ConsumableConfigDyn>`;

const HP_USAGE_XML = `<?xml version="1.0"?>
<pudyn:PrinterUsageDyn xmlns:dd="x" xmlns:pudyn="x">
  <dd:TotalImpressions>123456</dd:TotalImpressions>
  <dd:MonochromeImpressions>89000</dd:MonochromeImpressions>
  <dd:ColorImpressions>34456</dd:ColorImpressions>
</pudyn:PrinterUsageDyn>`;

test('scrapeHp extracts serial, model, toner, meters', async () => {
  const http = makeStubHttp({
    'https://192.168.1.50/DevMgmt/ProductConfigDyn.xml': HP_PRODUCT_XML,
    'https://192.168.1.50/DevMgmt/ConsumableConfigDyn.xml': HP_CONSUMABLE_XML,
    'https://192.168.1.50/DevMgmt/PrinterUsageDyn.xml': HP_USAGE_XML,
    'https://192.168.1.50/DevMgmt/ProductStatusDyn.xml': null,
  });
  const out = await scrapeHp(http, '192.168.1.50', { protocol: 'https' });
  assert.equal(out.serialNumber, 'VND4242PQR');
  assert.equal(out.model, 'HP LaserJet Enterprise M607');
  assert.equal(out.tonerLevels?.black, 85);
  assert.equal(out.tonerLevels?.cyan, 62);
  assert.equal(out.tonerLevels?.yellow, 10);
  assert.equal(out.meters?.totalImpressions, 123456);
  assert.equal(out.meters?.bwImpressions, 89000);
  assert.equal(out.meters?.colorImpressions, 34456);
  assert.equal(out.deviceStatus, 'online');
});

test('scrapeHp handles all-404 gracefully', async () => {
  const http = makeStubHttp({});
  const out = await scrapeHp(http, '192.168.1.99', { protocol: 'https' });
  assert.equal(out.ipAddress, '192.168.1.99');
  // Without any payload, serial falls through to the synthetic placeholder.
  assert.match(out.serialNumber!, /^HP-/);
  assert.deepEqual(out.tonerLevels, {});
  assert.deepEqual(out.meters, {});
});

// ── Konica Minolta scraper ──────────────────────────────────────────

const KM_SYSTEM_XML = `<?xml version="1.0"?>
<MFP>
  <SerialNumber>A1B2C3D4E5</SerialNumber>
  <ProductName>bizhub C658</ProductName>
</MFP>`;

const KM_COUNTER_XML = `<?xml version="1.0"?>
<MFP>
  <Total>
    <TotalCounter>987654</TotalCounter>
    <BlackCounter>700000</BlackCounter>
    <ColorCounter>287654</ColorCounter>
  </Total>
</MFP>`;

const KM_SUPPLY_XML = `<?xml version="1.0"?>
<MFP>
  <Toner><Color>K</Color><Level>72</Level></Toner>
  <Toner><Color>C</Color><Level>45</Level></Toner>
  <Toner><Color>M</Color><Level>30</Level></Toner>
  <Toner><Color>Y</Color><Level>5</Level></Toner>
</MFP>`;

test('scrapeKonicaMinolta extracts serial, counters, toner', async () => {
  const http = makeStubHttp({
    'https://10.0.0.5/wcd/system_device.xml': KM_SYSTEM_XML,
    'https://10.0.0.5/wcd/info_counter.xml': KM_COUNTER_XML,
    'https://10.0.0.5/wcd/info_supply.xml': KM_SUPPLY_XML,
  });
  const out = await scrapeKonicaMinolta(http, '10.0.0.5', { protocol: 'https' });
  assert.equal(out.serialNumber, 'A1B2C3D4E5');
  assert.equal(out.model, 'bizhub C658');
  assert.equal(out.meters?.totalImpressions, 987654);
  assert.equal(out.meters?.bwImpressions, 700000);
  assert.equal(out.meters?.colorImpressions, 287654);
  assert.equal(out.tonerLevels?.black, 72);
  assert.equal(out.tonerLevels?.cyan, 45);
  assert.equal(out.tonerLevels?.magenta, 30);
  assert.equal(out.tonerLevels?.yellow, 5);
});
