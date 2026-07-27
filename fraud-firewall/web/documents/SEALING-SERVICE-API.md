# Document Sealing Service API Reference

**API Version:** 1.0  
**Service:** Verum Omnis Document Sealing Service  
**Base URL:** `https://api.verumglobal.foundation/v1`  
**Authentication:** Bearer Token (JWT)  
**Content-Type:** `application/json`

---

## Overview

The Document Sealing Service provides cryptographic sealing and verification of evidence documents for regulatory compliance. Documents are sealed with SHA-512 fingerprints and optionally anchored to the Bitcoin blockchain via OpenTimestamps.

**Key Features:**
- Client-side document sealing (no data transmission to Verum)
- SHA-512 cryptographic integrity
- OpenTimestamps Bitcoin blockchain anchoring
- QR code generation for mobile verification
- Comprehensive chain of custody logging
- Constitutional Court of South Africa compliance

---

## Authentication

All API requests require Bearer token authentication:

```
Authorization: Bearer <JWT_TOKEN>
```

Obtain a token via OAuth 2.0 authorization endpoint:

```
POST /auth/oauth/token
```

**Request:**
```json
{
  "grant_type": "client_credentials",
  "client_id": "your_institution_id",
  "client_secret": "your_secret_key"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

## Endpoints

### 1. Seal Document

Creates a cryptographic seal for a document.

**Endpoint:** `POST /seals`

**Description:**  
Generates a SHA-512 hash of the document and optionally submits it to OpenTimestamps for blockchain anchoring. The seal is returned as a JSON certificate that can be embedded in the original document.

**Headers:**
```
Content-Type: multipart/form-data
Authorization: Bearer <TOKEN>
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `document` | File | Yes | Document binary file (PDF, JSON, etc) |
| `document_reference` | String | Yes | MIME type of document (e.g., `application/pdf`) |
| `blockchain_anchor` | Boolean | No | Enable blockchain anchoring (default: true) |
| `metadata` | JSON | No | Custom metadata object |

**Example Request:**
```bash
curl -X POST https://api.verumglobal.foundation/v1/seals \
  -H "Authorization: Bearer $TOKEN" \
  -F "document=@compliance-report.pdf" \
  -F "document_reference=application/pdf" \
  -F "blockchain_anchor=true"
```

**Response (200 OK):**
```json
{
  "seal_id": "VO-AF07AD93E861",
  "sha512": "af07ad93e8614f67...7955f7b1",
  "sealed_timestamp": "2026-07-20T06:32:10Z",
  "sealed_timezone": "Africa/Johannesburg",
  "constitution_version": "6.0.0",
  "document_reference": "application/pdf",
  "sealing_location_gps": "-25.7480,28.2293",
  "blockchain_anchor": {
    "status": "PENDING",
    "currency": "BTC",
    "tx_hash": "d1234567890abcdef...",
    "block_height": 850432,
    "timestamp": "2026-07-20T07:15:32Z"
  },
  "qr_code_url": "https://verify.verumglobal.foundation/qr/VO-AF07AD93E861.png",
  "verification_url": "https://verify.verumglobal.foundation/seal/VO-AF07AD93E861"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `INVALID_DOCUMENT` | Document file is empty or corrupt |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 413 | `FILE_TOO_LARGE` | Document exceeds 100MB limit |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests; retry after 60 seconds |
| 500 | `INTERNAL_ERROR` | Service error; retry with exponential backoff |

---

### 2. Verify Seal

Verifies the integrity and blockchain status of a sealed document.

**Endpoint:** `POST /seals/{seal_id}/verify`

**Description:**  
Accepts a sealed document and verifies:
1. SHA-512 hash matches seal certificate
2. Blockchain anchor (if present) is valid and confirmed
3. Chain of custody is intact

**Headers:**
```
Content-Type: multipart/form-data
Authorization: Bearer <TOKEN>
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `seal_id` | String | Yes | Seal ID (e.g., `VO-AF07AD93E861`) |

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `document` | File | Yes | Sealed document file |

**Example Request:**
```bash
curl -X POST https://api.verumglobal.foundation/v1/seals/VO-AF07AD93E861/verify \
  -H "Authorization: Bearer $TOKEN" \
  -F "document=@compliance-report-sealed.pdf"
```

**Response (200 OK):**
```json
{
  "seal_id": "VO-AF07AD93E861",
  "verification_status": "VERIFIED",
  "hash_match": true,
  "blockchain_verified": true,
  "blockchain_status": "CONFIRMED",
  "blockchain_anchor": {
    "status": "CONFIRMED",
    "tx_hash": "d1234567890abcdef...",
    "block_height": 850432,
    "block_timestamp": "2026-07-20T07:15:32Z",
    "confirmations": 147
  },
  "chain_of_custody": [
    {
      "timestamp": "2026-07-20T06:32:10Z",
      "action": "SEAL",
      "actor": "firewall-sealing-service",
      "gps_location": "-25.7480,28.2293"
    },
    {
      "timestamp": "2026-07-21T14:22:55Z",
      "action": "VERIFY",
      "actor": "regulatory-auditor-001",
      "gps_location": "-25.7450,28.2310"
    }
  ],
  "verification_timestamp": "2026-07-22T10:15:43Z"
}
```

**Response (200 OK - Tampering Detected):**
```json
{
  "seal_id": "VO-AF07AD93E861",
  "verification_status": "TAMPERING_DETECTED",
  "hash_match": false,
  "computed_hash": "3fd47b91a7c8...",
  "expected_hash": "af07ad93e8614f67...",
  "tampering_indicators": [
    "Document content has been modified after sealing",
    "Hash mismatch indicates alterations"
  ],
  "forensic_details": {
    "seal_timestamp": "2026-07-20T06:32:10Z",
    "modification_detected_at": "2026-07-22T10:15:43Z",
    "estimated_time_since_tampering": "41 hours 43 minutes"
  }
}
```

---

### 3. Get Seal Information

Retrieves metadata and status of a seal without requiring the document.

**Endpoint:** `GET /seals/{seal_id}`

**Description:**  
Returns cached seal certificate and blockchain anchor status. Useful for checking seal validity without re-verifying the document.

**Headers:**
```
Authorization: Bearer <TOKEN>
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `seal_id` | String | Yes | Seal ID (e.g., `VO-AF07AD93E861`) |

**Example Request:**
```bash
curl https://api.verumglobal.foundation/v1/seals/VO-AF07AD93E861 \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):**
```json
{
  "seal_id": "VO-AF07AD93E861",
  "sha512": "af07ad93e8614f67...",
  "sealed_timestamp": "2026-07-20T06:32:10Z",
  "constitution_version": "6.0.0",
  "sealing_institution": "Demo Bank of South Africa",
  "sealing_location_gps": "-25.7480,28.2293",
  "blockchain_anchor": {
    "status": "CONFIRMED",
    "tx_hash": "d1234567890abcdef...",
    "block_height": 850432,
    "confirmations": 147
  },
  "verification_url": "https://verify.verumglobal.foundation/seal/VO-AF07AD93E861"
}
```

---

### 4. Revoke Seal

Marks a seal as revoked (document should be disregarded).

**Endpoint:** `POST /seals/{seal_id}/revoke`

**Description:**  
Records a revocation in the chain of custody. Revoked seals still exist in blockchain (immutable) but are flagged in the ledger. Used when a document is discovered to be fraudulent or no longer authoritative.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <TOKEN>
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `seal_id` | String | Yes | Seal ID to revoke |

**Request Body:**
```json
{
  "reason": "Document found to contain forged signatures",
  "revoked_by": "Chief Fraud Officer",
  "revocation_timestamp": "2026-07-22T11:30:00Z"
}
```

**Example Request:**
```bash
curl -X POST https://api.verumglobal.foundation/v1/seals/VO-AF07AD93E861/revoke \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Document authenticity questioned",
    "revoked_by": "CFO@demobank.co.za"
  }'
```

**Response (200 OK):**
```json
{
  "seal_id": "VO-AF07AD93E861",
  "status": "REVOKED",
  "revocation_timestamp": "2026-07-22T11:30:00Z",
  "revocation_reason": "Document found to contain forged signatures",
  "revoked_by": "Chief Fraud Officer",
  "chain_of_custody_updated": true
}
```

---

### 5. List Seals

Returns paginated list of seals created by authenticated institution.

**Endpoint:** `GET /seals`

**Description:**  
Lists all seals created by the authenticated institution with optional filtering by date range or blockchain status.

**Headers:**
```
Authorization: Bearer <TOKEN>
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | Integer | 1 | Page number (1-indexed) |
| `page_size` | Integer | 50 | Results per page (1-100) |
| `start_date` | ISO 8601 | None | Filter seals created after this date |
| `end_date` | ISO 8601 | None | Filter seals created before this date |
| `blockchain_status` | String | None | Filter by status: `PENDING_OFFLINE`, `PENDING`, `CONFIRMED` |

**Example Request:**
```bash
curl "https://api.verumglobal.foundation/v1/seals?start_date=2026-07-01&end_date=2026-07-22&blockchain_status=CONFIRMED&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):**
```json
{
  "page": 1,
  "page_size": 10,
  "total_count": 247,
  "total_pages": 25,
  "seals": [
    {
      "seal_id": "VO-AF07AD93E861",
      "sealed_timestamp": "2026-07-20T06:32:10Z",
      "blockchain_status": "CONFIRMED",
      "document_reference": "application/pdf",
      "status": "ACTIVE"
    },
    {
      "seal_id": "VO-38FEB4A5DF0E",
      "sealed_timestamp": "2026-07-20T09:47:22Z",
      "blockchain_status": "CONFIRMED",
      "document_reference": "application/json",
      "status": "ACTIVE"
    }
  ],
  "next_page_url": "https://api.verumglobal.foundation/v1/seals?page=2&page_size=10"
}
```

---

## Error Handling

All error responses follow a standard format:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required parameter: document",
    "details": {
      "parameter": "document",
      "reason": "multipart file upload required"
    },
    "request_id": "req_123abc456def"
  }
}
```

**Common Error Codes:**

| Code | HTTP Status | Description |
|------|------------|-------------|
| `INVALID_REQUEST` | 400 | Malformed request or missing parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Authenticated but lacks permission |
| `NOT_FOUND` | 404 | Seal or resource does not exist |
| `CONFLICT` | 409 | Seal already exists or conflicting state |
| `RATE_LIMITED` | 429 | Too many requests; retry after X seconds |
| `INTERNAL_ERROR` | 500 | Server error; safe to retry |
| `SERVICE_UNAVAILABLE` | 503 | Temporary outage; retry with backoff |

---

## Rate Limiting

- **Free Tier:** 100 requests/hour
- **Standard Tier:** 10,000 requests/hour
- **Enterprise:** Unlimited (custom SLA)

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9945
X-RateLimit-Reset: 1658935200
```

---

## Security Best Practices

### 1. Never Transmit Documents Unencrypted
All API requests must use HTTPS (TLS 1.2+).

### 2. Validate Seals Before Relying on Them
Always call the verify endpoint with the full document before making decisions based on a seal.

### 3. Monitor Blockchain Status
For critical documents, wait for `blockchain_status: CONFIRMED` before final acceptance. `PENDING` status is acceptable for time-sensitive operations but should be re-checked within 24 hours.

### 4. Implement Exponential Backoff
When receiving 5XX errors, retry with exponential backoff:
```
retry_delay = base_delay * (2 ^ attempt_number)
```

### 5. Store Audit Logs
Maintain local logs of all seal operations for regulatory compliance.

---

## Webhook Events

The service can deliver real-time notifications when seal status changes.

**Available Events:**
- `seal.created` - Seal successfully created
- `seal.blockchain_anchor_confirmed` - Blockchain anchor reached confirmation
- `seal.verification_failed` - Tampering or verification failure detected
- `seal.revoked` - Seal marked as revoked

**Example Webhook Payload:**
```json
{
  "event_type": "seal.blockchain_anchor_confirmed",
  "seal_id": "VO-AF07AD93E861",
  "timestamp": "2026-07-20T07:15:32Z",
  "blockchain_anchor": {
    "tx_hash": "d1234567890abcdef...",
    "block_height": 850432,
    "confirmations": 6
  }
}
```

---

## Integration Examples

### Python Client Library

```python
from verum_omnis import SealingService

# Initialize client
service = SealingService(
    client_id="your_client_id",
    client_secret="your_secret"
)

# Seal a document
with open("compliance-report.pdf", "rb") as f:
    seal = service.seal_document(
        document=f,
        document_reference="application/pdf",
        blockchain_anchor=True
    )
    print(f"Seal ID: {seal['seal_id']}")
    print(f"SHA-512: {seal['sha512']}")

# Verify the seal
with open("compliance-report-sealed.pdf", "rb") as f:
    verification = service.verify_seal(
        seal_id=seal['seal_id'],
        document=f
    )
    if verification['verification_status'] == 'VERIFIED':
        print("✓ Document integrity confirmed")
    else:
        print("✗ Tampering detected!")
```

### JavaScript/Node.js Client

```javascript
const VerumOmnis = require('verum-omnis-sdk');

const service = new VerumOmnis.SealingService({
  clientId: 'your_client_id',
  clientSecret: 'your_secret'
});

// Seal document
const formData = new FormData();
formData.append('document', fileInput.files[0]);
formData.append('document_reference', 'application/pdf');
formData.append('blockchain_anchor', 'true');

const seal = await service.sealDocument(formData);
console.log(`Seal ID: ${seal.seal_id}`);

// Verify seal
const verification = await service.verifySeal(seal.seal_id, sealedFile);
console.log(`Status: ${verification.verification_status}`);
```

---

## Support

**Documentation:** https://docs.verumglobal.foundation  
**Status Page:** https://status.verumglobal.foundation  
**Email Support:** support@verumglobal.foundation  
**Community Forum:** https://community.verumglobal.foundation

---

**API Version:** 1.0  
**Last Updated:** 22 July 2026  
**Document Classification:** Public  
**Copyright © 2026 Verum Omnis. All rights reserved.**
