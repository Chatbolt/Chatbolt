<!-- Header banner — SVG with a single slow horizontal highlight sweep -->
<!-- The animation is one pass over 8 seconds, then stops. No looping pulse. -->
<div align="center">

<picture>
<source media="(prefers-color-scheme: dark)"  srcset="https://capsule-render.vercel.app/api?type=rect&color=1c2229&height=120&section=header&text=Chatbolt&fontSize=42&fontColor=f3f4f6&fontAlignY=55&desc=Autonomous%20AI%20Workforce%20Platform&descAlignY=78&descSize=14&descColor=8899aa&animation=fadeIn&stroke=0284c7&strokeWidth=1">
<img alt="Chatbolt — Autonomous AI Workforce Platform" src="https://capsule-render.vercel.app/api?type=rect&color=1c2229&height=120&section=header&text=Chatbolt&fontSize=42&fontColor=f3f4f6&fontAlignY=55&desc=Autonomous%20AI%20Workforce%20Platform&descAlignY=78&descSize=14&descColor=8899aa&animation=fadeIn&stroke=0284c7&strokeWidth=1">
</picture>

</div>

---

Chatbolt is a self-hosted, open-core platform for deploying and supervising teams of autonomous AI agents across Engineering, Marketing, Operations, and SRE roles. It is built on a three-tier polyglot runtime — Node.js gateway, Go concurrency engine, and Python LangGraph reasoning loop — running on your own infrastructure, with your own API keys, against your own database. Every agent decision is logged, every token is counted, and every cost is visible before it is spent.

This organization hosts the main platform repository and its supporting documentation. The codebase is source-available under BUSL-1.1, converting to Apache 2.0 in 2030.

---

## Repositories

| Repository | Description |
|------------|-------------|
| [**chatbolt**](https://github.com/AbhinavKatare/chatbolt) | Core platform — Node.js API gateway, Go agent runtime, Python brain, Next.js dashboard |
| [chatbolt/docs](https://github.com/AbhinavKatare/chatbolt/tree/main/docs) | Self-hosting guide, architecture reference, API documentation |
| [chatbolt/.github](https://github.com/AbhinavKatare/chatbolt/tree/main/.github) | Issue templates, PR template, CI workflow, org governance |

---

## Platform Capabilities

| Capability | Notes |
|------------|-------|
| Multi-agent team orchestration | Engineering, Marketing, Ops, SRE squads with shared memory and cross-team dependency graphs |
| Personal agent (Dots-style) | Persistent personal assistant with behavioral learning profile and proactive notifications |
| 4-level autonomy tiers | `observe_only` · `suggest_only` · `act_with_approval` · `fully_autonomous` — per agent, per team |
| Radical metering transparency | Itemized per-token cost at live provider rates; pre-execution budget guard; upfront spend forecasting |
| Crucial-moment detection | Five-factor scoring routes high-stakes decisions to the user before acting |
| Inspectable decision ledger | Cryptographically chained audit log — who decided what, why, at what cost |
| BYOK — any LLM provider | OpenAI, Anthropic, Gemini, DeepSeek, OpenRouter, Ollama — automatic fallback cascade |
| Sandbox secret isolation | Go runtime scrubs all host secrets from execution environments; zero-leakage verified |
| AES-256-GCM credential vault | Fail-fast on boot if master key is missing or too short |
| Voice I/O | Browser-native (Web Speech API) with optional provider upgrade to Whisper STT / Neural TTS |
| Action rollback journal | 120-second TTL reversible actions with automated undo handlers |

---

## Tech Stack

<!-- flat-square badges, muted custom colors so the row reads as one set -->

![Next.js](https://img.shields.io/badge/Next.js_14-1c2229?style=flat-square&logo=next.js&logoColor=f3f4f6&label=Next.js%2014&labelColor=242f3d&color=334155)
![TypeScript](https://img.shields.io/badge/TypeScript-1c2229?style=flat-square&logo=typescript&logoColor=f3f4f6&label=TypeScript&labelColor=242f3d&color=334155)
![Go](https://img.shields.io/badge/Go-1c2229?style=flat-square&logo=go&logoColor=f3f4f6&label=Go%201.21%2B&labelColor=242f3d&color=334155)
![Python](https://img.shields.io/badge/Python-1c2229?style=flat-square&logo=python&logoColor=f3f4f6&label=Python%203.10%2B&labelColor=242f3d&color=334155)
![LangGraph](https://img.shields.io/badge/LangGraph-1c2229?style=flat-square&logo=chainlink&logoColor=f3f4f6&label=LangGraph&labelColor=242f3d&color=334155)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-1c2229?style=flat-square&logo=postgresql&logoColor=f3f4f6&label=PostgreSQL%2015%20%2B%20pgvector&labelColor=242f3d&color=334155)
![Supabase](https://img.shields.io/badge/Supabase-1c2229?style=flat-square&logo=supabase&logoColor=f3f4f6&label=Supabase&labelColor=242f3d&color=334155)
![Docker](https://img.shields.io/badge/Docker-1c2229?style=flat-square&logo=docker&logoColor=f3f4f6&label=Docker%20Compose&labelColor=242f3d&color=334155)

---

## Get Started

The fastest path to a running instance is Docker Compose. See the [Quickstart in the main README](https://github.com/AbhinavKatare/chatbolt#quickstart) — it covers cloning, secret generation, cluster startup, and health verification in under five minutes. A [bare-metal setup guide](https://github.com/AbhinavKatare/chatbolt/blob/main/docs/SELF_HOSTING.md) is available for environments where Docker is not an option.

---

## Contributing

Bug fixes, documentation improvements, new provider adapters, and core platform enhancements are welcome. Read [CONTRIBUTING.md](https://github.com/AbhinavKatare/chatbolt/blob/main/CONTRIBUTING.md) before opening a pull request — the CLA and open-core boundary rules are both explained there.

---

## License and Trademark

The core platform is distributed under the [Business Source License 1.1](https://github.com/AbhinavKatare/chatbolt/blob/main/LICENSE), which converts automatically to Apache 2.0 on 2030-01-01. BUSL-1.1 is source-available — not OSI-approved open source — and prohibits offering the software as a competing hosted cloud service without a commercial license. The `enterprise/` module is proprietary. The "Chatbolt" name, mark, and logo are reserved under our [Trademark Policy](https://github.com/AbhinavKatare/chatbolt/blob/main/TRADEMARK.md); code use does not grant trademark rights.

---

<div align="center">

Maintained by [Chatbolt Inc.](https://github.com/AbhinavKatare) &nbsp;·&nbsp; [chatbolt/chatbolt](https://github.com/AbhinavKatare/chatbolt) &nbsp;·&nbsp; BUSL-1.1

</div>
