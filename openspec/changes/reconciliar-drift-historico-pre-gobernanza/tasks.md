# Tasks

## 1. Classification

- [ ] 1.1 Define source-preserving historical drift categories.
- [ ] 1.2 Add deterministic repository-only classification tests.
- [ ] 1.3 Review findings without mutating SQL or migrations_history.

## 2. Safety

- [ ] 2.1 Prove historical replay is rejected before execution.
- [ ] 2.2 Prove post-cutover versions cannot use this historical exception.
