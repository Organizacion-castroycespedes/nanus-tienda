## Overview

The login blocker is in the web UI. The backend auth flow already works, including `POST /auth/login` and the existing session handling. The QA fix should therefore stay in the web client and use an explicit non-production flag that is only valid on localhost-style QA runs.

## Design

### QA gate

Add a tiny helper that decides whether the login page may skip the manual human-check gate.

Rules:

- Only allow it when an explicit `NEXT_PUBLIC_QA_LOGIN_ENABLED=true` is present.
- Only allow it on local hostnames like `localhost`, `127.0.0.1`, or `::1`.
- Do not change the backend auth contract.
- Do not add any universal bypass.

### Login page behavior

When the QA flag is active:

- the human-check gate is treated as already satisfied,
- the login form can submit normally,
- the rest of the session flow stays the same,
- redirect behavior stays the same.

When the flag is inactive:

- the current login screen behavior stays unchanged,
- the manual human-check is still required.

### Validation

Add a small unit test for the helper so the local-only rule stays tight.

## Risks

- If someone enables the QA flag outside a local build, the flag could be misused.
- The code must keep the hostname guard so the flag does not become a general production bypass.
- This does not change backend auth, so any later auth issues would still be real auth issues, not login gate issues.
