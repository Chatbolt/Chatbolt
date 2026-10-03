---
name: Bug Report
about: Report a reproducible bug or unexpected behavior
title: "[Bug] "
labels: ["bug", "needs-triage"]
assignees: []
---

## Summary

<!-- A clear, one-sentence description of the bug. -->

## Steps to Reproduce

1. 
2. 
3. 

## Expected Behavior

<!-- What should happen? -->

## Actual Behavior

<!-- What actually happens? Include error messages, stack traces, or screenshots. -->

## Environment

| Field | Value |
|-------|-------|
| Chatbolt version / commit | <!-- e.g., v2.0.0 or git SHA --> |
| Deployment mode | <!-- Docker Compose / Bare-metal / Cloud --> |
| OS | <!-- e.g., Ubuntu 22.04, macOS 14, Windows 11 --> |
| Docker / Compose version | <!-- `docker --version` and `docker compose version` --> |
| Node.js version | <!-- `node --version` --> |
| LLM Provider in use | <!-- e.g., OpenAI GPT-4o, Anthropic Claude 3.5, OpenRouter --> |

## Logs

<!-- Paste relevant logs below. Run `docker compose logs --tail=100` to collect them. -->

```
<paste logs here>
```

## Additional Context

<!-- Any other context: config overrides, unusual setup, related issues. -->

---

> [!IMPORTANT]
> **Security vulnerabilities must not be filed as public issues.**
> Follow the process in [SECURITY.md](../../SECURITY.md) to report privately.
