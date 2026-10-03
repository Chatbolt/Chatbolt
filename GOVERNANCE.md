# Chatbolt Governance

## Overview

Chatbolt is an open-core project maintained by **Chatbolt Inc.** under the Business Source License 1.1 (BUSL-1.1). This document describes how the project is governed, who makes decisions, how contributors can escalate concerns, and how the open-core boundary is maintained.

This governance model is intentionally lightweight for a project at this stage. As the community grows, governance will evolve — any changes to this document will be made transparently via pull request and noted in `CHANGELOG.md`.

---

## Project Leadership

**Chatbolt Inc.** serves as the primary maintainer and steward of the project. The founding maintainer holds final decision authority over:

- The open-core boundary (what belongs in `core/` vs. `enterprise/`)
- Licensing decisions and any future relicensing
- Roadmap prioritization and release timing
- Trademark policy (`TRADEMARK.md`)

Day-to-day maintenance decisions — reviewing pull requests, triaging issues, managing releases — are carried out by the maintainer team. Maintainer status is granted by the founding maintainer based on demonstrated sustained contribution quality.

---

## Decision-Making Process

Most decisions are made through lazy consensus: a proposal is made (via issue or pull request), and if no substantive objection is raised within a reasonable review window (typically 5–7 business days), it proceeds.

For decisions with significant impact — breaking API changes, new external dependencies, major architectural shifts, changes to the license or open-core boundary, or changes to this document — the founding maintainer's explicit approval is required.

Community members are encouraged to voice opinions on open issues and pull requests. Dissenting views are taken seriously and responded to, but the maintainer team has final say to keep the project moving.

---

## Contribution Path

1. **File an issue first** for non-trivial changes — this avoids wasted effort and aligns on scope before coding begins.
2. **Fork → Branch → Pull Request**: All contributions arrive via pull requests against the `main` branch.
3. **Review**: At least one maintainer review is required before merging. For changes touching security, the vault, authentication, or the open/enterprise boundary, two maintainer reviews are required.
4. **CLA**: Contributors agree to the Contributor License Agreement in `CONTRIBUTING.md` on their first pull request. This is required for Chatbolt Inc. to maintain the right to dual-license and offer commercial editions.

---

## Open-Core Boundary Policy

The open-core split is a core governance concern:

- **`core/` and `chatai-backend/` (open platform)**: Generic agent runtime, base tool set, pub/sub bus, metering transparency, local concurrency, and the ReAct reasoning loop. These live under BUSL-1.1 and will convert to Apache 2.0 in 2030.
- **`enterprise/` (proprietary)**: Multi-organization governance, cryptographic license-key enforcement, SLA compliance reporting, enterprise billing hooks, and SSO integrations. These are commercial-only and not covered by BUSL-1.1.

Any PR that moves functionality from the enterprise layer into core — or proposes adding enterprise-only capabilities to core — must be explicitly approved by the founding maintainer. The boundary exists to sustain the project's long-term commercial viability, which funds ongoing development.

---

## Maintainer Responsibilities

Current maintainers agree to:

- Respond to issues and pull requests within a reasonable timeframe (target: 5 business days for triage, longer for deep reviews)
- Disclose any conflicts of interest on decisions where they exist
- Follow and enforce the Code of Conduct (`CODE_OF_CONDUCT.md`) consistently
- Keep the public roadmap and changelog accurate and up to date

Maintainer status can be revoked if a maintainer is consistently unresponsive, violates the Code of Conduct, or acts in bad faith against the project's interests.

---

## Conflict Resolution

If a contributor believes a decision was made unfairly or in violation of this document, they may request a written explanation from the maintainer team. The founding maintainer has final authority to resolve disputes. There is no external arbitration body at this stage.

---

## Changes to This Document

This document is versioned alongside the codebase. Proposed changes must be submitted as a pull request. The change will be announced in the relevant GitHub release notes and `CHANGELOG.md` entry.
