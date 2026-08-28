#!/usr/bin/env python3
"""Validate, deduplicate, and report Harry's manually researched job data.

This program intentionally performs no network calls and no external actions.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from datetime import date
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlsplit, urlunsplit


ROOT = Path(__file__).resolve().parents[1]
JOBS_PATH = ROOT / "data" / "jobs.json"
SCHEMA_PATH = ROOT / "data" / "job.schema.json"
CSV_PATH = ROOT / "data" / "jobs.csv"
SEEN_PATH = ROOT / "state" / "seen_jobs.json"
SOURCE_HEALTH_PATH = ROOT / "state" / "source_health.json"
SOURCES_PATH = ROOT / "sources.yaml"
SEARCH_CONFIG_PATH = ROOT / "SEARCH_CONFIG.yaml"

ACTIVE_STATUSES = {
    "discovered",
    "shortlisted",
    "needs_review",
    "approved",
    "application_ready",
    "applied",
    "contact_drafted",
    "contacted",
    "recruiter_screen",
    "interview",
    "waiting",
    "offer",
}
TERMINAL_STATUSES = {"rejected", "closed", "archived"}
CONTRACT_TYPES = {"Contract", "Freelance", "Part-time"}

FIT_COMPONENT_LIMITS = {
    "track_match": 25,
    "portfolio_evidence": 20,
    "experience_level": 15,
    "work_quality": 10,
    "location_work_mode": 10,
    "work_authorization": 10,
    "freshness": 5,
    "company_industry_value": 5,
}
CONFIDENCE_COMPONENT_LIMITS = {
    "original_jd_access": 30,
    "open_status_verified": 25,
    "jd_completeness": 20,
    "posting_date_clarity": 15,
    "dedupe_confidence": 10,
}


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_jobs(path: Path = JOBS_PATH) -> list[dict[str, Any]]:
    payload = read_json(path)
    if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list):
        raise ValueError(f"{path} must contain a top-level jobs array")
    return payload["jobs"]


def canonicalize_url(value: str) -> str:
    parts = urlsplit(value.strip())
    path = re.sub(r"/+$", "", parts.path)
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, "", ""))


def normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def source_registry_count() -> int:
    source_text = SOURCES_PATH.read_text(encoding="utf-8")
    return len(re.findall(r"^\s+- \{name:", source_text, flags=re.MULTILINE))


def dedupe_keys(job: dict[str, Any]) -> list[str]:
    company = normalize_text(job["company"])
    title = normalize_text(job["title"])
    location = normalize_text(job["location"])
    keys = [f"url:{canonicalize_url(job['canonical_url'])}"]
    if job.get("requisition_id"):
        keys.insert(0, f"req:{company}:{normalize_text(str(job['requisition_id']))}")
    keys.append(f"fingerprint:{company}:{title}:{location}")
    return keys


def merge_duplicate(primary: dict[str, Any], duplicate: dict[str, Any]) -> None:
    urls = set(primary.get("also_seen_on", []))
    urls.update(duplicate.get("also_seen_on", []))
    for candidate in (duplicate.get("canonical_url"), duplicate.get("source_url")):
        if candidate and canonicalize_url(candidate) != canonicalize_url(primary["canonical_url"]):
            urls.add(candidate)
    primary["also_seen_on"] = sorted(urls)
    if duplicate.get("confidence_score", 0) > primary.get("confidence_score", 0):
        primary["confidence_score"] = duplicate["confidence_score"]
        primary["confidence_components"] = duplicate["confidence_components"]


def dedupe_jobs(jobs: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    unique: list[dict[str, Any]] = []
    key_to_index: dict[str, int] = {}
    for source_job in jobs:
        job = json.loads(json.dumps(source_job))
        duplicate_index = next(
            (key_to_index[key] for key in dedupe_keys(job) if key in key_to_index),
            None,
        )
        if duplicate_index is None:
            index = len(unique)
            unique.append(job)
            for key in dedupe_keys(job):
                key_to_index[key] = index
        else:
            merge_duplicate(unique[duplicate_index], job)
            for key in dedupe_keys(job):
                key_to_index[key] = duplicate_index
    return unique


def validate_component_scores(
    job: dict[str, Any],
    field: str,
    total_field: str,
    limits: dict[str, int],
    errors: list[str],
) -> None:
    components = job.get(field)
    if not isinstance(components, dict):
        errors.append(f"{job.get('job_id', '<unknown>')}: {field} must be an object")
        return
    if set(components) != set(limits):
        errors.append(
            f"{job.get('job_id', '<unknown>')}: {field} keys must match {sorted(limits)}"
        )
        return
    for name, maximum in limits.items():
        value = components[name]
        if not isinstance(value, int) or not 0 <= value <= maximum:
            errors.append(
                f"{job.get('job_id', '<unknown>')}: {field}.{name}={value!r} "
                f"must be an integer from 0 to {maximum}"
            )
    expected = sum(components.values())
    if job.get(total_field) != expected:
        errors.append(
            f"{job.get('job_id', '<unknown>')}: {total_field}={job.get(total_field)} "
            f"does not equal component total {expected}"
        )


def validate_jobs(jobs: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    schema = read_json(SCHEMA_PATH)
    required = set(schema["required"])
    allowed = set(schema["properties"])
    seen_ids: set[str] = set()
    seen_urls: set[str] = set()

    for index, job in enumerate(jobs):
        label = job.get("job_id", f"index {index}")
        missing = sorted(required - set(job))
        extra = sorted(set(job) - allowed)
        if missing:
            errors.append(f"{label}: missing required fields: {', '.join(missing)}")
        if extra:
            errors.append(f"{label}: unknown fields: {', '.join(extra)}")
        if missing:
            continue

        if job["job_id"] in seen_ids:
            errors.append(f"{label}: duplicate job_id")
        seen_ids.add(job["job_id"])

        canonical = canonicalize_url(job["canonical_url"])
        if canonical in seen_urls:
            errors.append(f"{label}: duplicate canonical_url")
        seen_urls.add(canonical)
        if not canonical.startswith("https://"):
            errors.append(f"{label}: canonical_url must use https")

        if job["primary_track"] not in {"A", "B", "C"}:
            errors.append(f"{label}: primary_track must be A, B, or C")
        if job["secondary_track"] == job["primary_track"]:
            errors.append(f"{label}: secondary_track must differ from primary_track")
        if job["status"] not in ACTIVE_STATUSES | TERMINAL_STATUSES:
            errors.append(f"{label}: invalid status {job['status']!r}")

        if len(job["fit_reasons"]) < 3:
            errors.append(f"{label}: at least three fit_reasons are required")
        if len(job["gaps"]) < 2:
            errors.append(f"{label}: at least two gaps are required")
        if not 2 <= len(job["recommended_projects"]) <= 3:
            errors.append(f"{label}: recommended_projects must contain two or three items")

        salary_min = job["salary_min"]
        salary_max = job["salary_max"]
        if (salary_min is None) != (salary_max is None):
            errors.append(f"{label}: salary_min and salary_max must both be known or unknown")
        if salary_min is not None and salary_min > salary_max:
            errors.append(f"{label}: salary_min exceeds salary_max")

        for field in ("date_posted", "date_discovered", "last_verified"):
            value = job[field]
            if value is not None:
                try:
                    date.fromisoformat(value)
                except (TypeError, ValueError):
                    errors.append(f"{label}: {field} must be ISO YYYY-MM-DD or null")

        validate_component_scores(
            job,
            "score_components",
            "fit_score",
            FIT_COMPONENT_LIMITS,
            errors,
        )
        validate_component_scores(
            job,
            "confidence_components",
            "confidence_score",
            CONFIDENCE_COMPONENT_LIMITS,
            errors,
        )

        required_fact_sources = {
            "location",
            "employment_type",
            "salary",
            "date_posted",
            "experience",
            "work_authorization",
            "sponsorship",
        }
        if not required_fact_sources.issubset(job["fact_sources"]):
            errors.append(f"{label}: incomplete fact_sources")

    source_count = source_registry_count()
    if source_count < 30:
        errors.append(f"source registry contains only {source_count} sources; at least 30 required")

    config_text = SEARCH_CONFIG_PATH.read_text(encoding="utf-8")
    for disabled_flag in (
        "auto_apply: false",
        "auto_email: false",
        "auto_linkedin: false",
        "bypass_access_controls: false",
        "fill_sensitive_answers: false",
    ):
        if disabled_flag not in config_text:
            errors.append(f"SEARCH_CONFIG.yaml must contain {disabled_flag!r}")

    return errors


def sort_jobs(jobs: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        jobs,
        key=lambda job: (
            job["fit_score"],
            job["confidence_score"],
            job["company"].lower(),
        ),
        reverse=True,
    )


def group_jobs(jobs: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    groups: dict[str, list[dict[str, Any]]] = {
        "apply_today": [],
        "strong": [],
        "stretch": [],
        "contract": [],
        "manual": [],
        "archive": [],
    }
    active_full_time: list[dict[str, Any]] = []
    for job in sort_jobs(jobs):
        if job["status"] in TERMINAL_STATUSES:
            groups["archive"].append(job)
        elif job["status"] == "needs_review" or job["confidence_score"] < 60:
            groups["manual"].append(job)
        elif job["employment_type"] in CONTRACT_TYPES:
            groups["contract"].append(job)
        else:
            active_full_time.append(job)

    apply_candidates = [
        job
        for job in active_full_time
        if job["fit_score"] >= 80 and job["confidence_score"] >= 70
    ]
    groups["apply_today"] = apply_candidates[:5]
    apply_ids = {job["job_id"] for job in groups["apply_today"]}

    for job in active_full_time:
        if job["job_id"] in apply_ids:
            continue
        if job["fit_score"] >= 70:
            groups["strong"].append(job)
        elif job["fit_score"] >= 60:
            groups["stretch"].append(job)
        else:
            groups["archive"].append(job)

    groups["strong"] = groups["strong"][:7]
    groups["stretch"] = groups["stretch"][:3]
    return groups


def salary_text(job: dict[str, Any]) -> str:
    if job["salary_min"] is None:
        return "Unknown: not stated"
    minimum = job["salary_min"]
    maximum = job["salary_max"]
    unit = job["salary_currency"] or ""
    if isinstance(minimum, float) and not minimum.is_integer():
        low = f"{minimum:,.2f}"
        high = f"{maximum:,.2f}"
    else:
        low = f"{minimum:,.0f}"
        high = f"{maximum:,.0f}"
    return f"{low}-{high} {unit}".strip()


def date_text(job: dict[str, Any]) -> str:
    return job["date_posted"] or "Unknown: not stated on official page"


def job_markdown(job: dict[str, Any]) -> str:
    lines = [
        f"### [{job['title']} - {job['company']}]({job['canonical_url']})",
        "",
        f"- Facts: {job['location']} | {job['remote_type']} | "
        f"{job['employment_type']} | {salary_text(job)}",
        f"- Date posted: {date_text(job)} | Verified: {job['last_verified']}",
        f"- Track: {job['primary_track']}"
        + (f" (secondary {job['secondary_track']})" if job["secondary_track"] else ""),
        f"- Fit / confidence: {job['fit_score']} / {job['confidence_score']}",
        "",
        "Why it matches:",
        "",
    ]
    lines.extend(f"- {reason}" for reason in job["fit_reasons"])
    lines.extend(["", "Gaps and risks:", ""])
    lines.extend(f"- {gap}" for gap in job["gaps"])
    lines.extend(
        [
            "",
            f"- Resume route: {job['recommended_resume']}",
            f"- Portfolio order: {', '.join(job['recommended_projects'])}",
            f"- Next action: {job['next_action']}",
            "",
        ]
    )
    return "\n".join(lines)


def source_health_markdown() -> str:
    payload = read_json(SOURCE_HEALTH_PATH)
    checks = payload["checks"]
    successful = [item["source"] for item in checks if item["status"] == "accessible"]
    limited = [
        f"{item['source']} ({item['notes']})"
        for item in checks
        if item["status"] in {"limited", "login_required", "blocked", "failed"}
    ]
    lines = [
        f"- Checked: {len(checks)} sources in this rotation",
        f"- Accessible: {', '.join(successful)}",
    ]
    if limited:
        lines.append("- Limited or login-required:")
        lines.extend(f"  - {item}" for item in limited)
    lines.append("- Newly enabled sources: none; this was an implementation run, not weekly source discovery.")
    return "\n".join(lines)


def render_group(
    heading: str,
    jobs: list[dict[str, Any]],
    empty_message: str,
) -> str:
    lines = [f"## {heading}", ""]
    if not jobs:
        lines.append(empty_message)
        lines.append("")
        return "\n".join(lines)
    for job in jobs:
        lines.append(job_markdown(job))
    return "\n".join(lines)


def build_daily_brief(jobs: list[dict[str, Any]], run_date: str) -> str:
    groups = group_jobs(jobs)
    sections = [
        f"# Harry Career Agent Daily Brief - {run_date}",
        "",
        "This is a read-only research report. No application, email, LinkedIn message, "
        "or external tracker change was made. Scores are ranking aids, not hiring probabilities.",
        "",
        f"Run result: {len(groups['apply_today'])} Apply Today, "
        f"{len(groups['strong'])} Strong Consideration, "
        f"{len(groups['stretch'])} Stretch, "
        f"{len(groups['contract'])} Contract, "
        f"{len(groups['manual'])} Manual Review.",
        "",
        render_group(
            "A. 今天最值得申请的岗位 / Apply Today",
            groups["apply_today"],
            "No role met the threshold today.",
        ),
        render_group(
            "B. 其他 Strong Consideration",
            groups["strong"],
            "No additional role met this threshold.",
        ),
        render_group(
            "C. Stretch Opportunities",
            groups["stretch"],
            "No strategic stretch was retained.",
        ),
        render_group(
            "D. Freelance / Contract",
            groups["contract"],
            "No contract or freelance lead was retained.",
        ),
        render_group(
            "E. Review Manually",
            groups["manual"],
            "No role requires manual verification.",
        ),
        "## F. 需要 Harry 回答的问题",
        "",
        "- Are San Francisco / Redwood City hybrid roles realistic, including relocation timing?",
        "- For Help Scout, does the explicit no-sponsorship policy make the role non-viable now or later?",
        "- Is Anaago approved for public portfolio use, including the WeChat Mini Program?",
        "- Would you accept a part-time contract such as Intro, or should contract work be excluded?",
        "- Can you truthfully demonstrate any ComfyUI, ControlNet, Python automation, 3D, Lottie, or Rive work not present in the repository?",
        "",
        "## G. Source Health",
        "",
        source_health_markdown(),
        "",
        render_group(
            "H. Archived During Verification",
            groups["archive"],
            "No role was archived during this run.",
        ),
        "## Review note",
        "",
        "Please flag false positives, missed evidence, and any score that feels wrong. "
        "The system will not enter Phase 2 or create scheduled runs until Harry reviews this output.",
        "",
    ]
    return "\n".join(sections)


def bucket_label(job: dict[str, Any], groups: dict[str, list[dict[str, Any]]]) -> str:
    for label, items in groups.items():
        if any(item["job_id"] == job["job_id"] for item in items):
            return {
                "apply_today": "Apply Today",
                "strong": "Strong Consideration",
                "stretch": "Stretch",
                "contract": "Freelance / Contract",
                "manual": "Review Manually",
                "archive": "Archive",
            }[label]
    return "Archive"


def write_csv(jobs: list[dict[str, Any]], path: Path = CSV_PATH) -> None:
    groups = group_jobs(jobs)
    fields = [
        "job_id",
        "company",
        "title",
        "primary_track",
        "secondary_track",
        "location",
        "remote_type",
        "employment_type",
        "salary_min",
        "salary_max",
        "salary_currency",
        "date_posted",
        "date_discovered",
        "last_verified",
        "experience_required",
        "work_authorization_text",
        "sponsorship_text",
        "fit_score",
        "confidence_score",
        "bucket",
        "status",
        "canonical_url",
        "recommended_resume",
        "recommended_projects",
        "next_action",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for job in sort_jobs(jobs):
            row = {field: job.get(field) for field in fields if field != "bucket"}
            row["bucket"] = bucket_label(job, groups)
            row["recommended_projects"] = " | ".join(job["recommended_projects"])
            writer.writerow(row)


def write_seen_jobs(jobs: list[dict[str, Any]], run_date: str, path: Path = SEEN_PATH) -> None:
    previous: dict[str, dict[str, Any]] = {}
    if path.exists():
        payload = read_json(path)
        previous = {item["job_id"]: item for item in payload.get("jobs", [])}
    records = []
    for job in sort_jobs(jobs):
        old = previous.get(job["job_id"], {})
        records.append(
            {
                "job_id": job["job_id"],
                "canonical_url": job["canonical_url"],
                "company": job["company"],
                "title": job["title"],
                "first_seen": old.get("first_seen", job["date_discovered"]),
                "last_seen": run_date,
                "status": job["status"],
            }
        )
    payload = {"updated": run_date, "jobs": records}
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def run_validate() -> int:
    jobs = load_jobs()
    errors = validate_jobs(jobs)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    unique = dedupe_jobs(jobs)
    if len(unique) != len(jobs):
        print(f"ERROR: {len(jobs) - len(unique)} duplicate record(s) detected")
        return 1
    print(
        f"Validated {len(jobs)} jobs, "
        f"{source_registry_count()} sources, "
        "and all safety flags."
    )
    return 0


def run_build(run_date: str) -> int:
    try:
        date.fromisoformat(run_date)
    except ValueError:
        print("ERROR: --date must be YYYY-MM-DD")
        return 2
    jobs = load_jobs()
    errors = validate_jobs(jobs)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    jobs = dedupe_jobs(jobs)
    write_csv(jobs)
    write_seen_jobs(jobs, run_date)
    brief_path = ROOT / "runs" / f"{run_date}-daily-brief.md"
    brief_path.parent.mkdir(parents=True, exist_ok=True)
    brief_path.write_text(build_daily_brief(jobs, run_date), encoding="utf-8")
    print(f"Built {brief_path}")
    print(f"Built {CSV_PATH}")
    print(f"Updated {SEEN_PATH}")
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("validate", help="validate job data and safety configuration")
    build = subparsers.add_parser("build", help="generate CSV, seen state, and daily brief")
    build.add_argument("--date", required=True, help="run date in YYYY-MM-DD format")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.command == "validate":
        return run_validate()
    return run_build(args.date)


if __name__ == "__main__":
    sys.exit(main())
