# Record architecture decisions

- Status: Accepted
- Date: 2025-11-02

## Context

The project has grown beyond an initial static site and is accumulating
incremental enhancements (tooling, deployment, styling). Without a shared log
of the rationale behind impactful changes, future contributors may revisit past
debates, undo intentional trade-offs, or struggle to explain why the project is
shaped the way it is.

## Decision

Adopt Architecture Decision Records (ADRs) stored under `docs/adr/`. Each ADR
will use a sequential identifier (`NNNN-title.md`), follow a lightweight
template, and be committed to the repository alongside the change it describes
or ahead of it when consensus is needed.

## Consequences

- Creates a discoverable audit trail for technical and architectural choices.
- Introduces a small process step when making substantive changes, which helps
  slow down decisions that demand broader review.
- Keeps the documentation close to the implementation, allowing Git history to
  capture both the decision narrative and the resulting code.

## References

- `docs/adr/README.md` – ADR workflow overview and naming conventions.
