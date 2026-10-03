<div align="center">

<!-- Logo mark -->
<img src="public/chatbolt-logo.svg" alt="Chatbolt" width="80" height="80" />

# Chatbolt

### Autonomous AI Workforce Platform

**Run simulated teams of 20+ AI agents. Inspect every decision. Control your spend. Own your data.**

Source-available · Self-hostable · BUSL-1.1 → Apache 2.0 in 2030

---

[![CI](https://github.com/AbhinavKatare/chatbolt/actions/workflows/ci.yml/badge.svg)](https://github.com/AbhinavKatare/chatbolt/actions/workflows/ci.yml)
[![License: BUSL-1.1](https://img.shields.io/badge/license-BUSL--1.1-blue)](LICENSE)
[![Go Runtime](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go)](agent-runtime/)
[![Python Brain](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python)](agent-brain/)
[![Node Gateway](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)](chatai-backend/)
[![Next.js Dashboard](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](frontend/)

</div>

---

## What is Chatbolt?

Chatbolt is an enterprise-grade autonomous agent runtime that lets you deploy multi-agent teams — Engineering, SRE/Ops, Marketing, Operations — as a simulated company with a real org chart, real autonomy tiers, and real accountability.

Every decision is logged. Every token is counted. Every cost is shown before it's spent. You stay in control.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **20+ Concurrent Agents** | Go-powered bounded goroutine worker pool. Verified 20-agent concurrency in ~3 s, ~11.5 MB baseline RAM |
| **Tri-Tier Polyglot Runtime** | Node.js API gateway + Go concurrency engine + Python LangGraph ReAct reasoning — each service in its strongest language |
| **Radical Metering Transparency** | Itemized per-token costs at live provider rates, pre-execution budget guard, upfront spend forecasting |
| **4-Level Autonomy Matrix** | `observe_only` → `suggest_only` → `act_with_approval` → `fully_autonomous` — per agent, per team |
| **Inspectable Decision Ledger** | Cryptographically chained accountability log: who decided what, why, at what cost |
| **Proactive Crucial-Moment Detection** | Five-factor scoring (irreversibility, financial impact, external exposure, pattern deviation, novelty) routes high-stakes decisions to you before acting |
| **Behavioral Learning Profile** | Learns your actual approval/rejection/edit patterns over time to automate routine decisions confidently |
| **Browser-Native + Provider Voice** | Web Speech API dictation + SpeechSynthesis output, upgradeable to Whisper STT / Neural TTS via BYOK |
| **BYOK — Any Provider** | OpenAI, Anthropic, Google Gemini, DeepSeek, OpenRouter, Ollama — or all at once with automatic fallback |
| **Sandbox Secret Isolation** | 100% host secret scrubbing in Go sandbox; verified zero leakage across all 8 test suites |
| **AES-256-GCM Credential Vault** | Fail-fast at boot if master key missing or too short. Never stores secrets in plaintext |
| **Action Rollback Journal** | 120-second TTL reversible actions with automated undo handlers |

---

## LLM Provider Support

| Provider | Chat Completion | Embeddings | Notes |
|----------|----------------|------------|-------|
| **OpenAI** | ✅ | ✅ | GPT-4o, o1, o3 |
| **Anthropic** | ✅ | — | Claude 3.5 / 3.7 / 4 family |
| **Google Gemini** | ✅ | ✅ | Gemini 1.5 / 2.0 / 2.5 family |
| **OpenRouter** | ✅ | — | Routes to 200+ models via one key |
| **DeepSeek** | ✅ | — | DeepSeek-R1, V3 |
| **Ollama** | ✅ | ✅ | Local models — zero API cost |
| **HuggingFace** | ✅ | ✅ | Inference API |
| **NVIDIA NIM** | ✅ | — | Enterprise GPU inference |

Providers cascade automatically. If the primary provider fails, the brain falls over to the next in your configured list without failing the run.

---

## Quickstart

> **Prerequisites**: Docker Engine 24+ and Docker Compose v2.20+. No other installs required.

```bash
# 1. Clone
git clone https://github.com/AbhinavKatare/chatbolt.git
cd chatbolt

# 2. Configure secrets (takes ~2 minutes)
cp .env.example .env
# Edit .env — at minimum set:
#   VAULT_ENCRYPTION_KEY  (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
#   DB_PASSWORD           (any secure password)
#   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  (from your Supabase project)

# 3. Start the polyglot cluster
docker compose up -d

# 4. Verify all four services are healthy
docker compose ps
curl http://localhost:5000/health   # Node.js gateway
curl http://localhost:8081/health   # Go agent runtime
curl http://localhost:8082/health   # Python brain

# 5. Open the dashboard
open http://localhost:3000
```

All four services (PostgreSQL + pgvector, Go runtime, Python brain, Node gateway) start in dependency order with built-in health checks. The dashboard is at **http://localhost:3000**.

> [!IMPORTANT]
> Never run with the default placeholder values in `.env.example` in production. Generate real secrets before deploying.

### Bare-Metal Setup

If you prefer running services directly without Docker, see the [Self-Hosting Guide](docs/SELF_HOSTING.md#4-bare-metal--local-development-setup).

---

## Architecture

Chatbolt uses three services, each in its strongest runtime:

```
┌───────────────────────────────────────────────────────────┐
│          Web Dashboard / CLI / REST API / Webhooks         │
└─────────────────────────┬─────────────────────────────────┘
                          │ HTTPS / SSE
                          ▼
┌─────────────────────────────────────────────────────────────┐
│             NODE.JS API GATEWAY  :5000                       │
│  Auth · Vault · Team Orchestrator · SSE · Billing · Rollback │
└──────────────┬────────────────────────────┬─────────────────┘
               │ X-Internal-Service-Key     │ X-Internal-Service-Key
               ▼                            ▼
┌──────────────────────┐   ┌─────────────────────────────────┐
│  GO AGENT RUNTIME    │   │     PYTHON AGENT BRAIN          │
│  :8081               │   │     :8082                        │
│                      │   │                                  │
│  Worker pool (20+)   │   │  LangGraph ReAct loop            │
│  Sandbox exec        │   │  Multi-provider adapter          │
│  AgentBus pub/sub    │   │  Self-healing critic pass        │
│  Resource throttle   │   │  Fallback provider cascade       │
└──────────────────────┘   └─────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           POSTGRESQL 15 + PGVECTOR                           │
│  Workflows · Runs · Memory · Ledger · Tenants · Billing      │
└─────────────────────────────────────────────────────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full deep dive including security boundaries and failure recovery matrix.

---

## Verified Benchmarks

| Metric | Result |
|--------|--------|
| Go runtime baseline RAM | ~11.5 MB |
| Idle goroutine footprint | ~10 goroutines |
| 20-agent concurrency total time | ~3,048 ms (~152 ms / task) |
| Worker pool task drop rate | 0% across all load tests |
| Sandbox host secret leak rate | 0% (100% scrub verified) |
| Test suite pass rate | 100% across all 8 suites (49+ automated tests) |

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) | Full setup, system sizing, secrets management, bare-metal instructions |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Polyglot design, security boundaries, failure recovery matrix |
| [CONTRIBUTING.md](CONTRIBUTING.md) | CLA, code standards, PR guidelines, open-core boundary rules |
| [GOVERNANCE.md](GOVERNANCE.md) | Decision-making process, maintainer responsibilities, open-core policy |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting, response timeline, in-scope targets |
| [CHANGELOG.md](CHANGELOG.md) | Full release history |

---

## Contributing

Contributions are welcome for bug fixes, documentation improvements, new provider adapters, and core platform improvements.

**Before you start:** Read [CONTRIBUTING.md](CONTRIBUTING.md) — specifically the CLA section. By submitting a pull request you agree to grant Chatbolt Inc. the rights described there, which are required for us to maintain the open-core model.

**Quick workflow:**

1. File an issue to align on scope (skip for typo fixes)
2. Fork → branch → code → test
3. Open a PR against `main` using the PR template

All PRs need at least one maintainer review. Changes to security-sensitive code (auth, vault, sandbox, inter-service auth) require two.

---

## Licensing

| Component | License |
|-----------|---------|
| `core/`, `chatai-backend/`, `agent-runtime/`, `agent-brain/`, `frontend/`, `cli/` | [Business Source License 1.1](LICENSE) — converts to Apache 2.0 on 2030-01-01 |
| `enterprise/` | Proprietary — commercial license required |
| "Chatbolt" name, logos, and branding | [Trademark Policy](TRADEMARK.md) — all rights reserved by Chatbolt Inc. |

> [!NOTE]
> BUSL-1.1 is a **source-available** license, not an OSI-approved open-source license. You are free to study, modify, self-host, and contribute for internal, evaluation, educational, and non-commercial use. You may not offer Chatbolt as a competing hosted cloud service or redistribute it commercially under different branding without an enterprise license. Formal commercial deployments should consult qualified legal counsel.

---

<div align="center">

Built with ⚡ by [Chatbolt Inc.](https://github.com/AbhinavKatare)

</div>
