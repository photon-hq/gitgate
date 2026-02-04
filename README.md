# GitGate

A secure GitHub Releases proxy service with device authentication, caching, and audit logging.

## Features

- **GitHub Releases Proxy**: Proxy access to GitHub releases and assets
- **Device Authentication**: Support for multiple auth methods:
  - Jamf API (macOS device management)
  - Tailscale (VPN-based device identity)
  - mTLS (mutual TLS certificates)
  - None (open access)
- **Local Caching**: SHA-256 checksummed asset caching with TTL
- **Asset Signing**: Optional RSA-SHA256 signing of downloaded assets
- **Rate Limiting**: Per-device rate limiting (60 requests/minute)
- **Audit Logging**: JSON-formatted audit logs of all access

## Installation

```bash
bun install
```

## Configuration

Copy `config.example.json` to `config.json` and update with your settings:

```json
{
  "port": 3000,
  "host": "0.0.0.0",
  "github": {
    "token": "ghp_your_fine_grained_pat",
    "cache_dir": "./cache",
    "cache_ttl_seconds": 3600
  },
  "auth": {
    "method": "jamf",
    "jamf": {
      "api_url": "https://your-jamf-instance.jamfcloud.com",
      "api_key": "your_api_key",
      "api_secret": "your_api_secret"
    }
  },
  "signing": {
    "enabled": false,
    "private_key_path": "/path/to/private.key"
  },
  "audit": {
    "enabled": true,
    "log_file": "./logs/audit.log"
  }
}
```

## Running

Development mode with auto-reload:

```bash
bun run dev
```

Production build:

```bash
bun run build
bun run start
```

Type checking:

```bash
bun run lint
```

## API Endpoints

### Health Check

```
GET /health
```

Returns service status.

### List Releases

```
GET /releases/:owner/:repo
```

Lists all releases for a repository. Requires device authentication.

### Download Asset

```
GET /release/:owner/:repo/:version/:asset
```

Downloads a specific asset from a release. Requires device authentication.

Response headers:

- `X-Checksum-SHA256`: SHA-256 checksum of the asset
- `X-Signature-RSA-SHA256`: RSA-SHA256 signature (if signing enabled)

## Authentication Methods

### Jamf

Requires `X-Jamf-Token` header with valid Jamf API token.

### Tailscale

Requires Tailscale headers:

- `X-Tailscale-User`: User ID
- `X-Tailscale-Device`: Device ID
- `X-Tailscale-IP`: Device IP (optional)

### mTLS

Requires valid client certificate signed by configured CA.

### None

No authentication required (open access).

## Audit Logging

Audit logs are written to the configured log file in JSON format:

```json
{
  "timestamp": 1234567890,
  "device_id": "device-123",
  "action": "download_asset",
  "resource": "owner/repo/v1.0.0/app.zip",
  "status": "success",
  "details": {
    "cached": true
  }
}
```

## Architecture

- `src/types.ts`: Type definitions
- `src/config.ts`: Configuration loading and validation
- `src/auth/`: Authentication modules (Jamf, Tailscale, mTLS)
- `src/github/`: GitHub API client, caching, and signing
- `src/audit/`: Audit logging
- `src/middleware/`: Rate limiting
- `src/server.ts`: HTTP server and route handlers
- `src/index.ts`: Entry point

## License

MIT
