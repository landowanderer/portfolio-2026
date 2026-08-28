# Career Agent Operating Rules

These rules apply to every file and run inside `career-agent/`.

## Truth and evidence

- Treat Harry's current resume, portfolio pages, and explicit confirmations as the only sources of candidate facts.
- Never invent experience, skills, metrics, clients, launch status, work authorization, sponsorship eligibility, or relationships.
- Keep job-description facts separate from inference. Use `Unknown: not stated` or `Needs manual verification` when the source is silent.
- Prefer the employer's career page or official ATS as the canonical source. Preserve discovery sources in `also_seen_on`.

## External actions

- Research, score, organize, and draft only.
- Never submit an application, send email, send a LinkedIn message, create a connection request, or change an external tracker without Harry's explicit approval for that action.
- Never bypass a login wall, CAPTCHA, rate limit, robots restriction, or anti-automation control.
- Sensitive application answers (work authorization, sponsorship, salary, disability, demographics) require Harry's direct answer.

## Job handling

- Assign exactly one `primary_track`: `A`, `B`, or `C`.
- Validate that the original role page is open before shortlisting.
- Dedupe in this order: company + requisition ID, canonical URL, company + normalized title + location, then highly similar JD.
- Keep closed, duplicate, low-fit, and risky roles in the data with an explanatory status; never use them to pad a brief.
- A generated application package is not an application. Only Harry can confirm `applied`.

## Scoring

- Fit score is a 100-point ranking aid, not an admission probability.
- Store the eight component scores so every total is auditable.
- Store confidence separately; lower it for unknown dates, incomplete details, reposts, agency-hidden clients, and inaccessible original pages.
- State real gaps alongside fit reasons.

## Failure handling

- A single failed source must not stop a run.
- Record each source as `accessible`, `limited`, `login_required`, `blocked`, `failed`, or `not_checked`.
- Continue with other sources and surface limitations in the daily brief.
- Stop before any action that would require circumvention or an unconfirmed personal answer.
