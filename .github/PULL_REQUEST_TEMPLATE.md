---
name: Pull Request
about: Standard PR template for all contributions
---

## What does this PR do?

<!-- Provide a clear summary of the change and the motivation for it.
     If this closes an issue, link it: "Closes #123" -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Documentation update
- [ ] Refactor / cleanup (no behavior change)
- [ ] CI / build / dependency update
- [ ] Security fix (see SECURITY.md before opening if this is a vulnerability)

## Open-Core Boundary

- [ ] This change only touches open-platform code (`core/`, `chatai-backend/`, `agent-runtime/`, `agent-brain/`, `frontend/`)
- [ ] This change touches `enterprise/` — I confirm the founding maintainer's approval is required and has been obtained or sought in a linked issue

## Testing

<!-- Describe how you tested your changes. -->

- [ ] `npm test` passes in `chatai-backend/`
- [ ] `pytest` passes in `agent-brain/`
- [ ] `go test ./...` passes in `agent-runtime/`
- [ ] Manual testing performed (describe below)

**Manual testing notes:**

## Security Checklist

For any change touching auth, vault, secrets handling, sandbox, or inter-service communication:

- [ ] No secrets, API keys, or credentials are logged or stored in plaintext
- [ ] New environment variables are documented in `.env.example`
- [ ] Sandbox execution still scrubs host environment variables
- [ ] Auth middleware is not weakened by this change
- [ ] If this adds a new external HTTP call, the endpoint is not user-controllable without validation

## Screenshots / Recordings (if UI change)

<!-- Drag and drop screenshots or recordings here. -->

## Additional Notes for Reviewers

<!-- Anything that would help the reviewer understand tricky parts of this change. -->
