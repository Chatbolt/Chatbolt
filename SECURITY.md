# Security Policy

## Supported Versions

The following versions of Chatbolt currently receive security updates:

| Version | Supported |
|---------|-----------|
| `main` branch (latest) | ✅ Active security support |
| Tagged releases ≥ `2.0.0` | ✅ Critical patches backported |
| Versions < `2.0.0` | ❌ End of life — please upgrade |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in Chatbolt, please report it through one of these private channels:

1. **GitHub Security Advisories** (preferred): Use the "Security" tab on the repository → "Report a vulnerability" to submit a private advisory. This keeps the report confidential until a fix is ready.

2. **Email**: Send a detailed report to the maintainers. Include:
   - A clear description of the vulnerability and its potential impact
   - Step-by-step reproduction instructions (proof of concept if possible)
   - Affected version(s) and configurations
   - Any suggested mitigations or patches you've identified

---

## Response Timeline

| Phase | Target SLA |
|-------|-----------|
| **Acknowledgment** | Within 48 hours of receipt |
| **Initial Assessment** | Within 5 business days |
| **Fix or Mitigation** | Within 30 days for critical/high severity |
| **Public Disclosure** | Coordinated with reporter; typically after fix is published |

We are a small team. We will make every reasonable effort to address vulnerabilities promptly and communicate transparently with reporters.

---

## Scope

The following are **in scope** for vulnerability reports:

- **Authentication & Authorization bypasses** in the Node.js backend (`chatai-backend/`)
- **Credential vault compromise** — any path that could expose `VAULT_ENCRYPTION_KEY` or decrypted BYOK API keys
- **Sandbox escape** — any bypass of the Go `agent-runtime` environment sanitization that leaks host secrets to sandboxed code execution
- **Privilege escalation** — any path allowing unprivileged users to access other users' data, agents, or billing records
- **SQL injection or data exfiltration** via unparameterized queries
- **Inter-service authentication bypass** — bypassing the `X-Internal-Service-Key` gate between Node, Go, and Python services
- **Dependency vulnerabilities** with a clear exploitation path in the context of this codebase
- **XSS or CSRF** in the Next.js frontend that could allow session hijacking

The following are **out of scope**:

- Vulnerabilities in the user's own deployed infrastructure (e.g., insecure `.env` configuration on their own server)
- Rate limiting or brute force on public endpoints without authentication context
- Denial of service through resource exhaustion that requires authenticated access
- Issues already known and documented in `CHANGELOG.md` or open issues

---

## Security Architecture Overview

Key security invariants that Chatbolt enforces by design:

1. **Fail-Fast Vault**: The backend refuses to start if `VAULT_ENCRYPTION_KEY` is missing or under 32 bytes. BYOK provider API keys are encrypted at rest using AES-256-GCM.

2. **Fail-Closed Authentication**: All protected routes strictly validate Supabase JWT signatures. No mock tokens, default tenant bypasses, or development-mode auth shortcuts exist in production paths.

3. **Sandbox Environment Isolation**: The Go `agent-runtime` scrubs all environment variables containing `KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `DATABASE`, `VAULT`, or `SUPABASE` before executing sandboxed agent code. This is enforced unconditionally — no override flag exists.

4. **Inter-Service Authentication Gate**: All internal HTTP calls between the Node gateway, Go runtime, and Python brain carry `X-Internal-Service-Key`. Missing or incorrect keys return `401 Unauthorized` immediately.

5. **Destructive Action Gates**: Irreversible operations (`file_delete`, `drop_table`, `rm -rf`) require explicit human approval tokens and are blocked at the autonomy tier enforcement layer.

---

## Disclosure Policy

We follow a coordinated disclosure model. We ask that reporters:

- Give us reasonable time to investigate and issue a fix before public disclosure
- Avoid exploiting the vulnerability beyond what's necessary to demonstrate it
- Avoid accessing, modifying, or deleting data that doesn't belong to you

We will credit reporters who responsibly disclose vulnerabilities in the relevant security advisory and changelog entry, if they wish to be credited.

---

## Bug Bounty

Chatbolt does not currently operate a formal bug bounty program. We appreciate the community's help in keeping the platform secure and will acknowledge meaningful contributions in release notes.
