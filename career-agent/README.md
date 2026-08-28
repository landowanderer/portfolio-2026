# Harry Career Agent

A research and decision-support system for high-quality U.S. design job searches. It discovers, verifies, scores, deduplicates, and reports roles; it does not apply or contact anyone.

## Current scope

Phase 0 and Phase 1 are implemented:

- candidate context audit and evidence map
- registry of 56 rotating sources
- track-specific search configuration
- normalized JSON job schema
- auditable fit and confidence scoring
- deterministic deduplication and daily-brief generation
- first read-only market scan

Phase 2 is intentionally not started. Track-specific resume files and tailored application packages remain pending Harry's review.

## Files to review first

- `reports/context-audit.md` - what was found and what is missing
- `PROFILE.md` - candidate facts and constraints
- `portfolio/evidence_map.yaml` - claims the portfolio can support
- `runs/2026-07-25-daily-brief.md` - first shortlist
- `data/jobs.csv` - tracker-friendly view
- `state/source_health.json` - source access results

## Run locally

From the repository root:

```text
python3 career-agent/scripts/career_agent.py validate
python3 career-agent/scripts/career_agent.py build --date YYYY-MM-DD
python3 -m unittest discover -s career-agent/tests -v
```

The build command reads `data/jobs.json`, validates and deduplicates it, then regenerates `data/jobs.csv`, `state/seen_jobs.json`, and the dated daily brief. It performs no network calls and no external writes.

## Review workflow

1. Review the daily brief and flag bad matches or missing context.
2. Confirm willingness to relocate and current work-authorization wording.
3. Supply the Visual/Brand and Product/Experience resume versions when ready.
4. Mark a role `approved` only after deciding to pursue it.
5. Start Phase 2 for approved roles only.

No scheduling should be created until at least two manual runs have been reviewed.
