# Printyx Client Security Guide

## Overview

The Printyx Monitoring Client is designed for deployment in secure enterprise environments including healthcare (HIPAA), financial services, legal firms, government contractors, and other regulated industries. This document outlines the security features, configuration, and best practices.

## Security Features

### 1. Transport Layer Security (TLS)

**HTTPS Only Enforcement**

- Client enforces HTTPS for all API communication
- HTTP endpoints are rejected with security error
- All traffic to Printyx platform encrypted over TLS

**TLS Version Requirements**

- Minimum: TLS 1.2 (configurable)
- Maximum: TLS 1.3
- Disabled: SSLv2, SSLv3, TLS 1.0, TLS 1.1
- Secure renegotiation enforced

**Certificate Validation**

- Full chain validation enabled by default
- Hostname verification enforced
- Self-signed certificates rejected (configurable for testing only)
- Custom CA certificate support for private CAs

**Configuration Example:**

```json
{
  "api": {
    "endpoint": "https://your-printyx.com/api/client-metrics/submit",
    "security": {
      "rejectUnauthorized": true,
      "minTLSVersion": "TLSv1.2",
      "customCA": "/path/to/custom-ca.pem"
    }
  }
}
```

### 2. Certificate Pinning (Advanced)

For maximum security environments, the client supports certificate pinning to prevent man-in-the-middle attacks.

**Fingerprint Pinning:**

```json
{
  "api": {
    "security": {
      "certificatePinning": {
        "enabled": true,
        "fingerprints": [
          "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
        ]
      }
    }
  }
}
```

**How to Get Certificate Fingerprint:**

```bash
# For your Printyx server
echo | openssl s_client -connect your-printyx.com:443 2>/dev/null | openssl x509 -noout -fingerprint -sha256
```

**Public Key Pinning** (more resilient to certificate rotation):

```json
{
  "api": {
    "security": {
      "certificatePinning": {
        "enabled": true,
        "publicKeys": ["base64-encoded-public-key-here"]
      }
    }
  }
}
```

### 3. Credential Encryption

**At Rest Encryption**

- AES-256-GCM authenticated encryption
- API keys encrypted in configuration file
- Device passwords and SNMP communities encrypted
- Machine-specific key derivation
- PBKDF2 with 100,000 iterations

**Enable Encryption:**

```json
{
  "encryption": {
    "enabled": true
  },
  "api": {
    "apiKey": "your-plain-api-key"
  }
}
```

When encryption is enabled, the client automatically encrypts sensitive fields on save and decrypts on load.

**Encrypted Config Example:**

```json
{
  "encryption": {
    "enabled": true
  },
  "api": {
    "apiKey": "a1b2c3d4:e5f6g7h8:i9j0k1l2:encrypted-data-here"
  }
}
```

### 4. SNMPv3 Support (Enterprise Printers)

For maximum security when monitoring printers, use SNMPv3 with authentication and encryption.

**Configuration:**

```json
{
  "devices": [
    {
      "ipAddress": "192.168.1.100",
      "protocol": "snmp",
      "snmpVersion": "3",
      "snmpUsername": "printyx-monitor",
      "snmpAuthProtocol": "SHA",
      "snmpAuthKey": "authentication-key",
      "snmpPrivProtocol": "AES",
      "snmpPrivKey": "encryption-key"
    }
  ]
}
```

**SNMPv3 Security Levels:**

- `noAuthNoPriv`: No authentication, no encryption (not recommended)
- `authNoPriv`: Authentication only
- `authPriv`: Authentication + encryption (recommended)

### 5. File System Security

**Configuration File Permissions:**

- Automatically set to 600 (owner read/write only) on Unix systems
- Prevents unauthorized access to sensitive credentials
- Windows: NTFS permissions should be manually restricted to administrator

**Secure File Locations:**

- Linux: `/etc/printyx-client/config.json` (root only)
- Windows: `C:\ProgramData\Printyx\config.json` (Administrators only)

**Set Permissions Manually:**

```bash
# Linux
sudo chown root:root /etc/printyx-client/config.json
sudo chmod 600 /etc/printyx-client/config.json

# Verify
ls -la /etc/printyx-client/config.json
# Should show: -rw------- 1 root root
```

### 6. Network Security

**Outbound Traffic Only:**

- Client initiates all connections
- No inbound ports required
- Firewall-friendly design

**Required Outbound Ports:**

- **443/TCP**: HTTPS to Printyx platform (REQUIRED)
- **161/UDP**: SNMP to local printers (optional, local network only)
- **80/TCP** or **443/TCP**: HTTP/HTTPS to local printers (optional, local network only)

**Firewall Rules Example (Linux iptables):**

```bash
# Allow outbound HTTPS to Printyx
iptables -A OUTPUT -p tcp --dport 443 -d your-printyx.com -j ACCEPT

# Allow SNMP to local network (adjust subnet)
iptables -A OUTPUT -p udp --dport 161 -d 192.168.1.0/24 -j ACCEPT

# Block everything else (if using strict firewall)
# iptables -P OUTPUT DROP
```

### 7. Audit Logging

**Security Event Logging:**

```json
{
  "logging": {
    "level": "info",
    "file": "/var/log/printyx-client.log",
    "securityEvents": true
  }
}
```

**Logged Security Events:**

- TLS connection attempts and failures
- Certificate validation failures
- Certificate pinning violations
- Authentication failures (API key)
- Configuration changes
- Unauthorized access attempts

**Log Rotation:**

```bash
# Linux logrotate example
# /etc/logrotate.d/printyx-client
/var/log/printyx-client.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 600 root root
    postrotate
        systemctl reload printyx-client > /dev/null 2>&1 || true
    endscript
}
```

### 8. API Key Security

**Key Rotation:**

- Regular rotation recommended (90 days)
- Zero-downtime rotation supported
- Old keys invalidated immediately after rotation

**Rotate API Key:**

1. Generate new key via Printyx platform
2. Update configuration file
3. Restart client service
4. Verify connectivity

```bash
# Update config
sudo nano /etc/printyx-client/config.json

# Restart service
sudo systemctl restart printyx-client

# Verify
sudo systemctl status printyx-client
```

**Key Storage Best Practices:**

- Enable encryption for at-rest protection
- Use file permissions (600) to restrict access
- Never commit API keys to version control
- Use separate keys per deployment location

## Compliance Considerations

### HIPAA (Healthcare)

**Requirements Met:**

- ✅ Encryption in transit (TLS 1.2+)
- ✅ Encryption at rest (AES-256)
- ✅ Access controls (file permissions, authentication)
- ✅ Audit logging (security events)
- ✅ Integrity controls (authenticated encryption)

**Additional Recommendations:**

- Enable certificate pinning
- Use SNMPv3 with encryption
- Enable encryption for config files
- Implement log monitoring/SIEM integration
- Sign Business Associate Agreement (BAA) with Printyx

### PCI DSS (Payment Card Industry)

**Requirements Met:**

- ✅ Strong cryptography (TLS 1.2+, AES-256)
- ✅ Secure key management
- ✅ Access restrictions
- ✅ Audit trails

**Additional Recommendations:**

- Dedicated network segment for printers
- Regular security scans
- Penetration testing
- Incident response plan

### SOC 2

**Requirements Met:**

- ✅ Security (encryption, access controls)
- ✅ Availability (monitoring, uptime)
- ✅ Confidentiality (data protection)
- ✅ Privacy (minimal data collection)

### Government (FedRAMP, NIST 800-53)

**Requirements Met:**

- ✅ FIPS 140-2 compatible encryption
- ✅ Certificate-based authentication
- ✅ Audit logging
- ✅ Access controls

**Additional Recommendations:**

- Use FIPS-compliant crypto libraries
- Enable certificate pinning
- Implement continuous monitoring
- Document security controls

## Hardening Checklist

### Deployment

- [ ] Use HTTPS endpoint only
- [ ] Verify TLS certificate of Printyx server
- [ ] Enable configuration encryption
- [ ] Set file permissions to 600 (Unix) or Administrator-only (Windows)
- [ ] Use unique API key per deployment
- [ ] Configure minimum TLS 1.2
- [ ] Disable certificate validation ONLY for testing, never production

### Network

- [ ] Deploy on isolated/monitoring network segment
- [ ] Configure firewall rules (outbound 443 only)
- [ ] Use SNMPv3 for printer communication
- [ ] Restrict SNMP to local network only
- [ ] Document network topology

### Monitoring

- [ ] Enable security event logging
- [ ] Configure log rotation
- [ ] Integrate with SIEM if available
- [ ] Set up alerts for authentication failures
- [ ] Monitor certificate expiration
- [ ] Test failover procedures

### Maintenance

- [ ] Rotate API keys every 90 days
- [ ] Update client software regularly
- [ ] Review audit logs monthly
- [ ] Test backups and recovery
- [ ] Document configuration changes
- [ ] Conduct annual security review

## Incident Response

### Authentication Failures

**Symptoms:**

- Error: "Authentication failed: Invalid API key or tenant ID"
- HTTP 401 responses in logs

**Actions:**

1. Verify API key hasn't been rotated
2. Check tenant ID is correct
3. Verify client status in Printyx platform (not disabled)
4. Review audit logs for unauthorized access attempts
5. If compromised, immediately rotate API key

### Certificate Validation Failures

**Symptoms:**

- Error: "CERT_HAS_EXPIRED"
- Error: "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
- Error: "SELF_SIGNED_CERT_IN_CHAIN"

**Actions:**

1. Check Printyx server certificate expiration
2. Verify system time is correct (NTP sync)
3. Check for man-in-the-middle attack (unusual for TLS)
4. If using custom CA, verify CA certificate is valid
5. If using certificate pinning, update fingerprints after legitimate certificate rotation

### Certificate Pinning Violations

**Symptoms:**

- Error: "Certificate fingerprint does not match pinned fingerprints"
- Connection immediately rejected

**Actions:**

1. **DO NOT DISABLE** certificate pinning without investigation
2. Verify Printyx server certificate hasn't been legitimately rotated
3. Check for man-in-the-middle attack
4. Obtain new certificate fingerprint from trusted source
5. Update configuration only after verification
6. Document incident

### Data Breach Response

**If Config File Compromised:**

1. Immediately rotate API key via Printyx platform
2. Review audit logs for unauthorized activity
3. Identify how compromise occurred
4. Implement additional controls
5. Document incident
6. Notify security team/management

## Security Contact

For security issues or questions:

- **Product Security**: Printyx Support
- **Vulnerability Reports**: security@printyx.com
- **Emergency**: Contact Printyx support hotline

## Version History

- **v1.0.0**: Initial release with TLS 1.2+, encryption, certificate pinning
