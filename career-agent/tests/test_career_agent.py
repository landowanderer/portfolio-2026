import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "career_agent.py"
SPEC = importlib.util.spec_from_file_location("career_agent", SCRIPT)
career_agent = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(career_agent)


class CareerAgentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.jobs = career_agent.load_jobs()

    def test_seed_data_validates(self):
        self.assertEqual(career_agent.validate_jobs(self.jobs), [])

    def test_source_registry_meets_acceptance_count(self):
        self.assertGreaterEqual(career_agent.source_registry_count(), 30)

    def test_seed_data_has_no_duplicates(self):
        self.assertEqual(len(career_agent.dedupe_jobs(self.jobs)), len(self.jobs))

    def test_dedupe_ignores_query_and_trailing_slash(self):
        duplicate = dict(self.jobs[0])
        duplicate["job_id"] = "duplicate-test"
        duplicate["canonical_url"] = self.jobs[0]["canonical_url"] + "/?utm_source=test"
        duplicate["source_url"] = duplicate["canonical_url"]
        deduped = career_agent.dedupe_jobs([self.jobs[0], duplicate])
        self.assertEqual(len(deduped), 1)

    def test_apply_today_limit_and_closed_exclusion(self):
        groups = career_agent.group_jobs(self.jobs)
        self.assertLessEqual(len(groups["apply_today"]), 5)
        apply_ids = {job["job_id"] for job in groups["apply_today"]}
        archive_ids = {job["job_id"] for job in groups["archive"]}
        for job_id in (
            "dentsu-R1124574",
            "zip-4d0ef7e9",
            "centerfield-ff72748e",
        ):
            self.assertNotIn(job_id, apply_ids)
            self.assertIn(job_id, archive_ids)

    def test_contract_is_separate(self):
        groups = career_agent.group_jobs(self.jobs)
        contract_ids = {job["job_id"] for job in groups["contract"]}
        self.assertIn("intro-59e8c47c", contract_ids)
        self.assertNotIn(
            "intro-59e8c47c",
            {job["job_id"] for job in groups["apply_today"]},
        )

    def test_reverified_webtoon_is_grouped_as_contract(self):
        groups = career_agent.group_jobs(self.jobs)
        self.assertIn(
            "webtoon-6fd68ef9",
            {job["job_id"] for job in groups["contract"]},
        )
        self.assertNotIn(
            "webtoon-6fd68ef9",
            {job["job_id"] for job in groups["manual"]},
        )

    def test_brief_contains_safety_and_source_health(self):
        brief = career_agent.build_daily_brief(self.jobs, "2026-07-25")
        self.assertIn("No application, email, LinkedIn message", brief)
        self.assertIn("Source Health", brief)
        self.assertIn("Archived During Verification", brief)


if __name__ == "__main__":
    unittest.main()
