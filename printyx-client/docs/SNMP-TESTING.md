# Manual SNMP Testing

Use this to verify the collector against real hardware before rolling
the agent out to a customer. The CLI's `test` command exercises exactly
the same code path the scheduler uses, so a green test is a strong
signal the agent will collect successfully on that device.

## Prerequisites

```bash
npm install
npm run build
```

## SNMPv2c (community-based)

```bash
node dist/index.js test 192.168.1.50 \
    --snmp-version 2c \
    --community public
```

Expected output: device serial, manufacturer, model, supply percentages,
meter readings. If the device is locked down with a non-default
community, swap `public` for the configured string.

## SNMPv3 (recommended for production)

```bash
node dist/index.js test 192.168.1.50 \
    --snmp-version 3 \
    --snmp-username printyx-monitor \
    --snmp-auth-protocol SHA \
    --snmp-auth-key 'authentication-passphrase' \
    --snmp-priv-protocol AES \
    --snmp-priv-key 'privacy-passphrase'
```

Security levels:

- `noAuthNoPriv` — username only (don't use in production).
- `authNoPriv` — pass `--snmp-auth-key` and the collector picks this up.
- `authPriv` — pass both `--snmp-auth-key` and `--snmp-priv-key`. This
  is what the install template defaults to.

## Verifying vendor coverage

The collector identifies the device's vendor from `sysObjectID`. To see
what the collector sees:

```bash
snmpwalk -v2c -c public 192.168.1.50 1.3.6.1.2.1.1
```

Look for `SNMPv2-MIB::sysObjectID.0`. Cross-reference its prefix with
the table in `src/collectors/vendor-oids.ts`. If the vendor isn't
listed, add a row in `SYS_OBJECT_ID_VENDORS` and a (possibly empty)
counter map in `VENDOR_COUNTERS` — the collector will fall back to a
walk of `prtMarkerLifeCount` automatically.

## Capturing a vendor's counter OIDs

When porting to a new model:

```bash
# Walk the vendor's enterprise tree (replace the prefix with the right one)
snmpwalk -v2c -c public 192.168.1.50 1.3.6.1.4.1.<vendor-pin>

# Walk the standard Printer-MIB life-counter table — every device should
# return at least one row.
snmpwalk -v2c -c public 192.168.1.50 1.3.6.1.2.1.43.10.2.1.4
```

Find the OIDs whose values match the device's printed counter (visible
on the front panel under "counter information" / "billing meters" on
most MFPs). Add them to the appropriate `VENDOR_COUNTERS` entry.

## HTTP collector (when SNMP is locked down)

The agent will fall through to HTTP if `protocol: 'http'` or `'https'` is
set in the per-device config. HTTPS is preferred and strict TLS is on by
default — set `httpRejectUnauthorized: false` per device when the printer
admin UI is on a self-signed cert and you trust the LAN.

Real scrapers exist for **HP** (`/DevMgmt/*.xml`) and **Konica Minolta**
(`/wcd/*.xml`); other vendors fall back to a generic probe. Add new
scrapers in `src/collectors/vendor-scrapers.ts`.

```bash
node dist/index.js test 192.168.1.50 --protocol http
```

You can verify a vendor's endpoints by hand:

```bash
# HP — should return XML with toner levels
curl -k https://192.168.1.50/DevMgmt/ConsumableConfigDyn.xml

# Konica Minolta — counter XML
curl -k https://192.168.1.50/wcd/info_counter.xml
```

If both return empty/404 on a device that publicly advertises a vendor
name, it's likely behind embedded-server auth — pass `username` /
`password` in the device config.

## Unit tests

```bash
npm test
```

Runs `tsx --test src/**/*.test.ts`. Covers vendor detection,
discovery-method merging, and the HP / Konica HTTP scrapers against
canned XML fixtures. New behaviour should ship with a test in
`src/collectors/<thing>.test.ts` or `src/discovery/<thing>.test.ts`.
