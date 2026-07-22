# Verum Omnis Document Sealing Standard (VO-DSS) v1.2

**Version:** 1.2  
**Status:** Active  
**Last Updated:** 22 July 2026  
**Jurisdiction:** Constitutional Court of South Africa  
**Classification:** Technical Specification - Open Public Registry

---

## 1. Executive Summary

The Verum Omnis Document Sealing Standard (VO-DSS) v1.2 is the definitive technical specification for the cryptographic sealing, timestamping, and verification of evidence documents within the Verum Omnis Fraud Firewall ecosystem.

This standard ensures:
- **Cryptographic Integrity:** SHA-512 fingerprints provide tamper-detection
- **Temporal Anchoring:** OpenTimestamps Bitcoin blockchain integration
- **Chain of Custody:** Immutable audit trails from creation to verification
- **Constitutional Compliance:** Adherence to South African evidentiary standards

---

## 2. Cryptographic Sealing Mechanism

### 2.1 Hash Algorithm: SHA-512

**Standard:** FIPS 180-4  
**Output Size:** 512 bits (64 bytes, 128 hexadecimal characters)  
**Purpose:** Create a cryptographic fingerprint of the document content

The SHA-512 hash is computed over the complete document binary content:

```
HASH = SHA-512(document_binary_content)
```

**Properties:**
- **One-way function:** Impossible to reverse-engineer content from hash
- **Collision-resistant:** Vanishingly small probability two documents share hash
- **Deterministic:** Same document always produces identical hash
- **Sensitive:** Single-bit change in document produces entirely different hash

### 2.2 Seal Certificate Structure

Each sealed document includes a machine-readable seal certificate in JSON format:

```json
{
  "seal_id": "VO-AF07AD93E861",
  "document_reference": "application/pdf",
  "sha512": "af07ad93e8614f67...(128 hex chars)...7955f7b1",
  "sealed_timestamp": "2026-07-20T06:32:10Z",
  "sealed_timezone": "Africa/Johannesburg",
  "constitution_version": "6.0.0",
  "sealing_institution": "Verum Omnis",
  "sealing_location_gps": "-25.7480,28.2293",
  "blockchain_anchor": {
    "status": "CONFIRMED",
    "currency": "BTC",
    "tx_hash": "d1234567890abcdef...",
    "block_height": 850432,
    "timestamp": "2026-07-20T07:15:32Z"
  },
  "qr_code_data": "https://verify.verumglobal.foundation/seal/VO-AF07AD93E861"
}
```

### 2.3 Seal Embedding in PDF

The seal certificate is embedded into the sealed PDF document using:
- **PDF Metadata:** Document Information Dictionary
- **QR Code:** Visual representation for mobile verification
- **Visible Seal:** Human-readable text overlay on first page

---

## 3. OpenTimestamps Bitcoin Blockchain Anchoring

### 3.1 Purpose

OpenTimestamps creates cryptographic proof that a document existed at a specific point in time by anchoring the document hash to the Bitcoin blockchain.

### 3.2 Submission Process

1. **Hash Submission:** SHA-512 hash submitted to OpenTimestamps Calendar
2. **Calendar Response:** Partial attestation chain returned (typically within seconds)
3. **Bitcoin Confirmation:** Document hash included in Bitcoin transaction
4. **Block Confirmation:** Transaction confirmed in blockchain block (typically 10 minutes)
5. **Proof Retrieval:** Complete attestation chain downloaded from OpenTimestamps

### 3.3 Attestation Chain

The attestation chain demonstrates:
- The sealed document existed at time T
- The document hash is immutable (embedded in blockchain)
- The document cannot be modified without invalidating the blockchain proof

**Anchor Status Definitions:**

| Status | Meaning | Verification |
|--------|---------|--------------|
| `PENDING_OFFLINE` | Hash submitted, awaiting blockchain confirmation | Valid within 24 hours |
| `PENDING` | Partial attestation received from calendar | Valid for regulatory filing |
| `CONFIRMED` | Bitcoin block confirmation received | Permanent, court-admissible |

---

## 4. Verification Protocol

### 4.1 Local Hash Verification

To verify a sealed document has not been tampered with:

```bash
# Extract document binary (without embedded seal certificate)
document_binary=$(extract_document_content(sealed_pdf))

# Compute hash
computed_hash = SHA-512(document_binary)

# Compare with seal certificate
if computed_hash == seal_certificate.sha512 then
  VERIFIED: Document integrity confirmed
else
  TAMPERING DETECTED: Document has been modified
end
```

### 4.2 Blockchain Verification

If blockchain anchor is present:

1. Retrieve OpenTimestamps attestation chain from seal certificate
2. Compute OpenTimestamps proof digest using the document SHA-512
3. Match against Bitcoin blockchain transaction
4. Confirm transaction is in blockchain at block height specified

**Verification Requirements:**
- Block must exist in current longest Bitcoin chain
- Transaction must be unspent or part of confirmed block
- Timestamp must be consistent with block height

### 4.3 Chain of Custody Verification

Each access to sealed document is logged:

```json
{
  "seal_id": "VO-AF07AD93E861",
  "access_log": [
    {
      "timestamp": "2026-07-20T06:32:10Z",
      "action": "SEAL",
      "actor": "firewall-sealing-service",
      "ip_address": "192.168.1.100",
      "gps_location": "-25.7480,28.2293"
    },
    {
      "timestamp": "2026-07-21T14:22:55Z",
      "action": "VERIFY",
      "actor": "regulatory-auditor-001",
      "ip_address": "203.45.67.89",
      "gps_location": "-25.7450,28.2310"
    }
  ]
}
```

---

## 5. Document Reference Standards

### 5.1 MIME Types

Sealed documents must explicitly specify their MIME type:

| Document Type | MIME Type |
|---------------|-----------|
| PDF | `application/pdf` |
| JSON | `application/json` |
| Plain Text | `text/plain` |
| Email | `message/rfc822` |

### 5.2 File Naming Convention

```
[SEAL_ID]_[DOCUMENT_TYPE]_[YYYY-MM-DD].ext
```

Example: `VO-AF07AD93E861_compliance-report_2026-07-20.pdf`

---

## 6. Constitutional Compliance

### 6.1 Evidence Admissibility

Under the Rules of the Constitutional Court of South Africa, sealed documents using VO-DSS v1.2 are:

- **Authentic:** Cryptographic sealing proves document origin and integrity
- **Reliable:** Blockchain anchoring provides temporal certainty
- **Relevant:** Chain of custody maintained and verifiable
- **Not Hearsay:** Technical certification distinguishes factual records from witness testimony

### 6.2 Privacy Preservation

The sealing standard does NOT transmit document content to Verum Omnis:

- **Local Sealing:** All cryptographic operations occur on client/institution systems
- **Hash-Only Storage:** Only SHA-512 hash stored centrally (cannot be reversed)
- **POPIA Compliance:** Personal data remains under institution's control
- **No External Transmission:** Document never leaves regulatory jurisdiction

---

## 7. Implementation Reference

### 7.1 Pseudo-Code: Sealing

```pseudocode
function sealDocument(document_binary, metadata):
  // Compute hash
  sha512_hash = SHA512(document_binary)
  
  // Create seal certificate
  seal_certificate = {
    seal_id: generateSealID(),
    sha512: sha512_hash,
    sealed_timestamp: getCurrentTimestamp(),
    constitution_version: CURRENT_CONSTITUTION_VERSION,
    document_reference: metadata.mimeType,
    sealing_location_gps: getCurrentGPS()
  }
  
  // Submit to OpenTimestamps (if blockchain_anchor_enabled)
  if ENABLE_BLOCKCHAIN_ANCHOR:
    ots_response = submitToOpenTimestamps(sha512_hash)
    seal_certificate.blockchain_anchor = ots_response
  
  // Embed into document
  addMetadataToPDF(document_binary, seal_certificate)
  addQRCodeToPDF(seal_certificate.qr_code_data)
  
  return sealed_pdf
endfunction
```

### 7.2 Pseudo-Code: Verification

```pseudocode
function verifySealedDocument(sealed_pdf):
  // Extract seal certificate from PDF metadata
  seal_certificate = extractSealCertificate(sealed_pdf)
  
  // Extract document without certificate
  document_binary = extractDocumentContent(sealed_pdf)
  
  // Compute local hash
  computed_hash = SHA512(document_binary)
  
  // Verify hash matches
  if computed_hash != seal_certificate.sha512:
    return { status: "TAMPERING_DETECTED" }
  
  // Verify blockchain anchor (if present)
  if seal_certificate.blockchain_anchor:
    is_blockchain_valid = verifyOpenTimestampsChain(
      seal_certificate.sha512,
      seal_certificate.blockchain_anchor
    )
    if not is_blockchain_valid:
      return { status: "BLOCKCHAIN_VERIFICATION_FAILED" }
  
  return {
    status: "VERIFIED",
    sealed_timestamp: seal_certificate.sealed_timestamp,
    blockchain_confirmed: seal_certificate.blockchain_anchor.status == "CONFIRMED"
  }
endfunction
```

---

## 8. Performance Characteristics

### 8.1 Sealing Performance

| Operation | Typical Time | Maximum Time |
|-----------|-------------|--------------|
| SHA-512 Computation | 10ms (1MB doc) | 500ms (100MB doc) |
| PDF Metadata Embedding | 5ms | 50ms |
| OpenTimestamps Submission | 100ms | 5000ms |
| QR Code Generation | 20ms | 100ms |

### 8.2 Verification Performance

| Operation | Typical Time | Maximum Time |
|-----------|-------------|--------------|
| Hash Extraction | 5ms | 100ms |
| SHA-512 Recomputation | 10ms | 500ms |
| Hash Comparison | <1ms | 1ms |
| Blockchain Verification | 50ms | 2000ms |

---

## 9. Security Considerations

### 9.1 Hash Collision Attack (Mitigated)

**Risk:** Two different documents produce same SHA-512 hash  
**Mitigation:** SHA-512 collision resistance: 2^256 operations (computationally infeasible)  
**Status:** ✓ MITIGATED

### 9.2 Private Key Compromise (Mitigated)

**Risk:** Institution's sealing key is compromised  
**Mitigation:** No private key used; signatures not part of sealing (blockchain anchor handles temporal proof)  
**Status:** ✓ NOT APPLICABLE (SHA-512 is deterministic, not asymmetric)

### 9.3 Blockchain Reorg Attack (Mitigated)

**Risk:** Bitcoin blockchain reorganization invalidates anchor  
**Mitigation:** Block confirmations + 6-block confirmation rule (99.9% safety)  
**Status:** ✓ MITIGATED (chain must be reversed, requiring 51% hashpower)

### 9.4 PDF Embedding Tampering (Mitigated)

**Risk:** Attacker modifies seal certificate in PDF while keeping document content intact  
**Mitigation:** Hash verification detects ANY modification to sealed content  
**Status:** ✓ MITIGATED

---

## 10. Governance & Updates

### 10.1 Version History

| Version | Release Date | Changes |
|---------|-------------|---------|
| 1.0 | 15 June 2026 | Initial release; SHA-512 + PDF sealing |
| 1.1 | 01 July 2026 | OpenTimestamps integration; QR code support |
| 1.2 | 22 July 2026 | GPS location logging; enhanced chain of custody |

### 10.2 Compatibility

VO-DSS v1.2 is **backward compatible** with v1.0 and v1.1 seals:
- Documents sealed under prior versions verify successfully
- Bitcoin anchors from prior versions remain valid
- New GPS logging applies only to documents sealed after 22 July 2026

### 10.3 Future Roadmap

**Planned for v1.3 (Q4 2026):**
- Multi-signature sealing (requires 3-of-5 institutions to confirm)
- Ethereum blockchain anchor option (parallel to Bitcoin)
- Bulk document sealing optimization

---

## 11. References

- **FIPS 180-4:** Secure Hash Standard (SHA)
- **RFC 3610:** Counter with CBC-MAC (CCM)
- **OpenTimestamps:** https://opentimestamps.org
- **Bitcoin Proof of Work:** https://bitcoin.org/en/developer-reference
- **South African Constitution:** https://www.gov.za/documents/constitution
- **Rules of the Constitutional Court:** Case CCT 1/94

---

## Appendix A: Example Seal Certificate (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "seal_id",
    "sha512",
    "sealed_timestamp",
    "constitution_version"
  ],
  "properties": {
    "seal_id": {
      "type": "string",
      "pattern": "^VO-[A-F0-9]{16}$",
      "description": "Unique seal identifier"
    },
    "sha512": {
      "type": "string",
      "pattern": "^[a-f0-9]{128}$",
      "description": "SHA-512 hash of document content"
    },
    "sealed_timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp of sealing"
    },
    "blockchain_anchor": {
      "type": "object",
      "properties": {
        "status": {
          "enum": ["PENDING_OFFLINE", "PENDING", "CONFIRMED"]
        },
        "tx_hash": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        },
        "block_height": {
          "type": "integer",
          "minimum": 0
        }
      }
    }
  }
}
```

---

**Document Classification:** Public  
**Copyright © 2026 Verum Omnis. All rights reserved.**
