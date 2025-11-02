# Architecture Decision Records

This directory houses Architecture Decision Records (ADRs) for the project.
Each ADR documents an impactful technical decision, along with the context,
constraints, and consequences that motivated the chosen approach.

- Files follow the pattern `NNNN-title.md`, where `NNNN` is a zero-padded
  sequence number (e.g. `0003`). Reserve `0000-template.md` for the template.
- Keep filenames lowercase and dash-delimited; keep the title in the ADR itself
  sentence-cased.
- Link related ADRs together so readers can trace how decisions evolve.

## Creating a new ADR

1. Copy `0000-template.md` to the next sequential identifier
   (e.g. `docs/adr/0004-new-decision.md`).
2. Replace the placeholders in the new file with the relevant details.
3. Reference supporting discussions, tickets, or documents in the
   *References* section.
4. Submit the ADR alongside the change that implements it, or as a separate PR
   if the decision needs consensus first.

This lightweight workflow keeps the decision log close to the codebase while
remaining tooling-neutral.
