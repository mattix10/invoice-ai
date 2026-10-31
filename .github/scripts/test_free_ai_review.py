"""Offline tests; no credentials, network, database or model calls required."""

import copy
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError

import free_ai_review as review

PATCH = "@@ -1,2 +1,3 @@\n old\n-removed\n+new\n+extra\n"
FILES = [{"filename": "apps/backend/src/invoice.py", "patch": PATCH}]
PATH = FILES[0]["filename"]
REVISION = "a" * 40 + ":" + "b" * 40
PR = {
    "state": "open",
    "draft": False,
    "changed_files": 1,
    "head": {"sha": "a" * 40, "repo": {"full_name": "owner/repo"}},
    "base": {"sha": "b" * 40, "ref": "master"},
}
EMPTY = {"summary": "Nothing found", "findings": []}
CATALOG = {
    "data": [
        {
            "id": "openrouter/free",
            "context_length": 32_768,
            "pricing": {"prompt": "0", "completion": "0", "request": "0"},
        }
    ]
}


def finding(**changes):
    value = {
        "severity": "P1",
        "file": PATH,
        "line": 2,
        "title": "Concrete bug",
        "explanation": "This input triggers a regression.",
        "suggested_fix": "Validate the input.",
    }
    value.update(changes)
    return {"summary": "One issue", "findings": [value]}


def bot(body, identifier=1):
    return {
        "id": identifier,
        "body": body,
        "user": {"login": "github-actions[bot]", "type": "Bot"},
    }


def github(comments=None):
    gh = Mock(spec=review.GitHub)
    gh.repo = "owner/repo"
    gh.call.return_value = copy.deepcopy(PR)
    gh.files.return_value = copy.deepcopy(FILES)
    gh.pages.return_value = comments or []
    return gh


def completion(value=EMPTY, **changes):
    choice = {"finish_reason": "stop", "message": {"content": json.dumps(value)}}
    choice.update(changes)
    return {"choices": [choice]}


class DiffTests(unittest.TestCase):
    def test_source_filter_excludes_non_source_and_generated(self):
        for name in [
            "README.md",
            "docs/example.py",
            "package-lock.json",
            "uv.lock",
            "dist/app.js",
            "node_modules/pkg/main.js",
            "photo.png",
            "binary.bin",
            "x.generated.ts",
            "x.g.ts",
            "types.d.ts",
            "app.min.js",
            "src/generated/client.py",
            "src/core/api/schema.ts",
            "../evil.py",
            "a\\evil.py",
            "/absolute.py",
            "bad\nname.py",
        ]:
            with self.subTest(name=name):
                self.assertFalse(review.source_file(name))
        for name in [PATH, "src/app.ts", "src/app.html", "migration.sql", "Dockerfile"]:
            self.assertTrue(review.source_file(name))

    def test_only_source_diff_is_submitted(self):
        selected, refs, incomplete = review.select_diff(
            FILES + [{"filename": "README.md", "patch": PATCH}]
        )
        self.assertEqual(len(selected), 1)
        self.assertEqual(refs[PATH], {1, 2, 3})
        self.assertFalse(incomplete)

    def test_missing_patch_is_incomplete(self):
        selected, _, incomplete = review.select_diff([{"filename": PATH}])
        self.assertEqual(selected, [])
        self.assertTrue(incomplete)

    def test_github_truncated_patch_warns(self):
        _, _, incomplete = review.select_diff([{**FILES[0], "additions": 100, "deletions": 1}])
        self.assertTrue(incomplete)

    def test_deleted_file_is_not_assigned_a_right_line(self):
        selected, refs, incomplete = review.select_diff(
            [{"filename": PATH, "patch": "@@ -1,1 +0,0 @@\n-deleted\n"}]
        )
        self.assertEqual((selected, refs), ([], {}))
        self.assertTrue(incomplete)

    def test_oversized_unicode_diff_is_bounded_and_cannot_cite_omitted_lines(self):
        files = [{"filename": PATH, "patch": "@@ -0,0 +1,5000 @@\n" + "+ż🙂\n" * 5000}]
        selected, refs, incomplete = review.select_diff(files, 500)
        self.assertLessEqual(len(review.encoded(selected)), 500)
        self.assertTrue(incomplete)
        self.assertNotIn(5000, refs[PATH])
        self.assertTrue(selected[0]["patch"].endswith("\n"))

    def test_multiple_hunks_and_deleted_lines(self):
        patch_text = "@@ -3,2 +3,1 @@\n-gone\n kept\n@@ -20,1 +19,2 @@\n same\n+new\n"
        self.assertEqual(review.right_lines(patch_text), {3, 19, 20})


class ValidationTests(unittest.TestCase):
    def test_valid_and_empty_findings(self):
        refs = {PATH: {2}}
        self.assertEqual(review.validate_review(EMPTY, refs), EMPTY)
        self.assertEqual(review.validate_review(finding(), refs), finding())

    def test_malformed_and_unsupported_findings_are_rejected(self):
        for value in [
            None,
            [],
            {},
            {"summary": "x", "findings": {}},
            {**EMPTY, "tools": []},
            finding(file="other.py"),
            finding(line=99),
            finding(line=True),
            finding(severity="P3"),
            finding(explanation=""),
            finding(title="x" * 201),
            finding(line="2"),
            {"summary": "x", "findings": [{"severity": "P1"}]},
        ]:
            with self.subTest(value=value), self.assertRaises(review.ReviewError):
                review.validate_review(value, {PATH: {2}})

    def test_zero_pricing_and_explicit_free_variant(self):
        self.assertEqual(review.free_model(CATALOG, "openrouter/free"), 32_768)
        catalog = copy.deepcopy(CATALOG)
        catalog["data"][0]["id"] = "vendor/model:free"
        self.assertEqual(review.free_model(catalog, "vendor/model:free"), 32_768)

    def test_malformed_catalog_is_rejected(self):
        for catalog in [
            None,
            {},
            {"data": "invalid"},
            {"data": [None]},
            {"data": [{"id": "openrouter/free", "pricing": None}]},
        ]:
            with self.subTest(catalog=catalog), self.assertRaises(review.ReviewError):
                review.free_model(catalog, "openrouter/free")

    def test_escaped_output_cannot_exceed_github_comment_limit(self):
        value = finding(explanation="&" * 2000, suggested_fix="&" * 2000)
        value["findings"] *= 8
        with self.assertRaises(review.ReviewError):
            review.validate_review(value, {PATH: {2}})

    def test_paid_unknown_invalid_or_missing_price_is_rejected(self):
        for prices in [
            {"prompt": "0.01", "completion": "0"},
            {"prompt": "0", "completion": "0", "request": "1"},
            {"prompt": "0"},
            {"prompt": "unknown", "completion": "0"},
        ]:
            catalog = copy.deepcopy(CATALOG)
            catalog["data"][0]["pricing"] = prices
            with self.assertRaises(review.ReviewError):
                review.free_model(catalog, "openrouter/free")
        for model in ["openrouter/auto", "vendor/paid", "absent:free"]:
            with self.assertRaises(review.ReviewError):
                review.free_model(CATALOG, model)


class ApiTests(unittest.TestCase):
    @patch.object(review, "build_opener")
    def test_http_json_transport_and_secret_not_in_url(self, opener):
        response = opener.return_value.open.return_value.__enter__.return_value
        response.read.return_value = b'{"ok":true}'
        self.assertEqual(review.request_json(review.OPENROUTER + "/models", "secret"), {"ok": True})
        req = opener.return_value.open.call_args.args[0]
        self.assertNotIn("secret", req.full_url)
        self.assertEqual(req.get_header("Authorization"), "Bearer secret")

    @patch.object(review, "build_opener")
    def test_api_failures_are_safe_and_not_retried(self, opener):
        for error in [
            HTTPError("url", 429, "sensitive", {}, io.BytesIO(b"secret")),
            HTTPError("url", 503, "sensitive", {}, None),
            URLError("secret"),
            TimeoutError("secret"),
        ]:
            opener.reset_mock()
            opener.return_value.open.side_effect = error
            with self.assertRaises(review.ReviewError) as caught:
                review.request_json(review.OPENROUTER + "/chat/completions", "secret", {})
            self.assertNotIn("secret", str(caught.exception))
            self.assertEqual(opener.return_value.open.call_count, 1)

    @patch.object(review, "request_json")
    def test_one_inference_request_and_no_paid_fallback(self, http):
        http.return_value = completion()
        self.assertEqual(review.infer("openrouter/free", "key", "prompt", []), EMPTY)
        self.assertEqual(http.call_count, 1)
        payload = http.call_args.args[2]
        self.assertNotIn("models", payload)
        self.assertFalse(payload["provider"]["allow_fallbacks"])
        self.assertEqual(
            payload["provider"]["max_price"],
            {"prompt": 0, "completion": 0, "request": 0},
        )
        self.assertEqual(payload["max_tokens"], review.MAX_OUTPUT_TOKENS)

    @patch.object(review, "request_json")
    def test_malformed_or_truncated_output_fails(self, http):
        for response in [
            {},
            {"choices": []},
            completion(finish_reason="length"),
            completion(message={"content": "```json\n{}\n```"}),
            completion(message={"content": "{}", "tool_calls": [{}]}),
            completion(message="invalid"),
        ]:
            http.return_value = response
            with self.assertRaises(review.ReviewError):
                review.infer("openrouter/free", "key", "prompt", [])

    def test_redirects_are_refused(self):
        with self.assertRaises(review.ReviewError):
            review.NoRedirect().redirect_request(None, None, 302, "", {}, "https://evil.test")

    def test_github_pagination_and_file_limit(self):
        gh = review.GitHub("owner/repo", "key")
        with patch.object(gh, "call", side_effect=[[{}] * 100, [{"id": 101}]]):
            self.assertEqual(len(gh.pages("issues/1/comments")), 101)
        with (
            patch.object(gh, "call", return_value={**PR, "changed_files": 3000}),
            self.assertRaises(review.ReviewError),
        ):
            gh.files(1)
        with (
            patch.object(gh, "call", return_value=PR),
            patch.object(gh, "pages", return_value=[]),
            self.assertRaises(review.ReviewError),
        ):
            gh.files(1)


class LifecycleTests(unittest.TestCase):
    def analyze(self, gh=None, **changes):
        args = dict(
            gh=gh or github(),
            number=1,
            expected=REVISION,
            prompt="trusted prompt",
            model="openrouter/free",
            key="secret",
        )
        args.update(changes)
        return review.analyze(**args)

    @patch.object(review, "request_json", side_effect=[CATALOG, completion()])
    def test_empty_success_is_distinct_from_failure(self, http):
        report = self.analyze()
        self.assertEqual(report["status"], "completed")
        self.assertEqual(http.call_count, 2)  # catalog GET + exactly one inference POST
        self.assertIn("No high-confidence issues were detected.", review.comment_body(report))

    @patch.object(review, "request_json")
    def test_no_inference_for_docs_missing_secret_or_paid_model(self, http):
        gh = github()
        gh.files.return_value = [{"filename": "README.md", "patch": PATCH}]
        self.assertEqual(self.analyze(gh)["status"], "skipped")
        self.assertEqual(self.analyze(key="")["status"], "failed")
        http.assert_not_called()
        http.return_value = CATALOG
        self.assertEqual(self.analyze(model="paid/model")["status"], "failed")
        self.assertEqual(http.call_count, 1)  # catalog only, no inference

    @patch.object(review, "request_json")
    def test_rate_limit_report_does_not_claim_no_findings(self, http):
        http.side_effect = review.ReviewError("API rate limit reached; review incomplete.")
        report = self.analyze()
        self.assertEqual(report["status"], "failed")
        self.assertIn("rate limit", review.comment_body(report))
        self.assertNotIn("No high-confidence", review.comment_body(report))

    @patch.object(review, "request_json", side_effect=[CATALOG, completion()])
    def test_large_diff_warns_and_uses_one_inference(self, http):
        gh = github()
        gh.files.return_value = [
            {"filename": PATH, "patch": "@@ -0,0 +1,10000 @@\n" + "+x\n" * 10000}
        ]
        report = self.analyze(gh)
        self.assertEqual(report["status"], "completed")
        self.assertTrue(report["incomplete"])
        self.assertIn("incomplete review coverage", review.comment_body(report))
        self.assertEqual(http.call_count, 2)

    @patch.object(review, "request_json", side_effect=[CATALOG, completion()])
    def test_existing_revision_skips_unless_explicit_rerun(self, http):
        gh = github([bot(review.MARKER + f"\n<!-- revision:{REVISION} -->")])
        self.assertEqual(self.analyze(gh)["status"], "unchanged")
        http.assert_not_called()
        self.assertEqual(self.analyze(gh, rerun=True)["status"], "completed")

    @patch.object(review, "request_json", return_value=CATALOG)
    def test_head_change_during_diff_fetch_prevents_inference(self, http):
        gh = github()
        gh.call.side_effect = [copy.deepcopy(PR), {**PR, "draft": True}]
        self.assertEqual(self.analyze(gh)["status"], "unchanged")
        self.assertEqual(http.call_count, 1)  # only catalog metadata fetched

    @patch.object(review, "request_json")
    def test_smaller_model_context_reduces_submitted_diff(self, http):
        catalog = copy.deepcopy(CATALOG)
        catalog["data"][0]["context_length"] = 6000
        http.side_effect = [catalog, completion()]
        gh = github()
        gh.files.return_value = [
            {"filename": PATH, "patch": "@@ -0,0 +1,2000 @@\n" + "+x\n" * 2000}
        ]
        report = self.analyze(gh)
        self.assertEqual(report["status"], "completed")
        self.assertLess(report["budget"], review.MAX_DIFF_BYTES)
        self.assertTrue(report["incomplete"])

    @patch.object(review, "request_json")
    def test_fork_draft_closed_stale_or_wrong_base_pr_cannot_infer(self, http):
        for change in [
            {"draft": True},
            {"state": "closed"},
            {"base": {**PR["base"], "ref": "main"}},
            {"head": {**PR["head"], "repo": {"full_name": "fork/repo"}}},
            {"head": {**PR["head"], "sha": "c" * 40}},
        ]:
            gh = github()
            gh.call.return_value.update(change)
            self.assertEqual(self.analyze(gh)["status"], "unchanged")
        http.assert_not_called()

    def report(self):
        return {
            "revision": REVISION,
            "status": "completed",
            "message": "",
            "review": EMPTY,
            "incomplete": False,
            "budget": review.MAX_DIFF_BYTES,
            "inference_completed": True,
        }

    def test_publisher_creates_then_updates_one_bot_comment(self):
        for comments, method, path in [
            ([], "POST", "issues/1/comments"),
            ([bot(review.MARKER, 42)], "PATCH", "issues/comments/42"),
        ]:
            gh = github(comments)
            review.publish(gh, 1, REVISION, self.report())
            writes = [c for c in gh.call.call_args_list if len(c.args) == 3]
            self.assertEqual(len(writes), 1)
            self.assertEqual((writes[0].args[0], writes[0].args[2]), (path, method))

    def test_human_marker_cannot_impersonate_bot_comment(self):
        gh = github([{**bot(review.MARKER), "user": {"login": "person", "type": "User"}}])
        review.publish(gh, 1, REVISION, self.report())
        self.assertEqual(gh.call.call_args.args[2], "POST")

    def test_publisher_revalidates_diff_and_rejects_invalid_artifact(self):
        gh = github()
        report = self.report()
        report["review"] = finding(line=999)
        with self.assertRaises(review.ReviewError):
            review.publish(gh, 1, REVISION, report)
        self.assertFalse(any(len(c.args) == 3 for c in gh.call.call_args_list))

    def test_publisher_skips_new_commit_even_after_validation(self):
        gh = github()
        gh.call.side_effect = [copy.deepcopy(PR), {**PR, "draft": True}]
        review.publish(gh, 1, REVISION, self.report())
        self.assertFalse(any(len(c.args) == 3 for c in gh.call.call_args_list))

    def test_model_text_is_inert(self):
        rendered = review.safe_text("<script> @team [click](https://evil.test) `run`")
        self.assertNotIn("<script>", rendered)
        self.assertNotIn("@team", rendered)
        self.assertNotIn("[click]", rendered)


class OutcomeTests(unittest.TestCase):
    def report(self, **changes):
        value = {
            "revision": REVISION,
            "status": "completed",
            "message": "",
            "review": EMPTY,
            "incomplete": False,
            "inference_completed": True,
        }
        value.update(changes)
        return value

    def test_status_codes_match_actual_review_outcome(self):
        for changes, expected, verdict in [
            ({}, 0, "clear"),
            ({"status": "failed", "review": None, "message": "OpenRouter HTTP 429"}, 1, "failed"),
            ({"incomplete": True}, 1, "incomplete"),
            ({"review": finding()}, 1, "findings"),
            ({"inference_completed": False}, 1, "failed"),
            ({"status": "skipped", "review": None}, 0, "skipped"),
        ]:
            with self.subTest(verdict=verdict), patch("sys.stdout", new_callable=io.StringIO):
                report = self.report(**changes)
                self.assertEqual(review.report_status(report), expected)
                self.assertEqual(review.outcome(report), verdict)

    @patch.object(review, "request_json")
    def test_inference_rate_limit_cannot_claim_validated_review(self, http):
        http.side_effect = [CATALOG, review.ReviewError("OpenRouter HTTP 429; review incomplete.")]
        report = review.analyze(github(), 1, REVISION, "prompt", "openrouter/free", "key")
        self.assertTrue(report["inference_attempted"])
        self.assertFalse(report["inference_completed"])
        self.assertEqual(report["status"], "failed")
        self.assertEqual(http.call_count, 2)
        with patch("sys.stdout", new_callable=io.StringIO):
            self.assertEqual(review.report_status(report), 1)

    def test_failure_is_written_to_job_summary_without_clearance(self):
        with tempfile.TemporaryDirectory() as directory:
            summary = Path(directory) / "summary.md"
            with (
                patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": str(summary)}),
                patch("sys.stdout", new_callable=io.StringIO),
            ):
                code = review.report_status(
                    self.report(status="failed", review=None, message="OpenRouter HTTP 429")
                )
            text = summary.read_text(encoding="utf-8")
            self.assertEqual(code, 1)
            self.assertIn("Result: FAILED", text)
            self.assertIn("OpenRouter HTTP 429", text)
            self.assertIn("not assessed", text)
            self.assertNotIn("No high-confidence issues", text)

    def test_duplicate_failure_and_legacy_report_do_not_turn_green(self):
        gh = github([bot(review.MARKER + f"\n<!-- revision:{REVISION} -->")])
        with patch.object(review, "request_json") as http:
            report = review.analyze(gh, 1, REVISION, "prompt", "openrouter/free", "key")
        self.assertEqual(review.outcome(report), "failed")
        http.assert_not_called()
        for cached in ["failed", "incomplete", "findings", "clear"]:
            report["cached_outcome"] = cached
            self.assertEqual(review.outcome(report), cached)

    def test_model_text_is_not_interpreted_as_a_workflow_command(self):
        report = self.report(review={"summary": "::warning::untrusted", "findings": []})
        with patch("sys.stdout", new_callable=io.StringIO) as log:
            review.report_status(report)
        self.assertNotIn("::warning::untrusted", log.getvalue())

    def test_failure_report_is_published_before_failure_is_signalled(self):
        gh = github()
        report = self.report(status="failed", review=None, message="OpenRouter HTTP 429")
        review.publish(gh, 1, REVISION, report)
        self.assertEqual(gh.call.call_args.args[2], "POST")
        self.assertIn("HTTP 429", gh.call.call_args.args[1]["body"])
        with patch("sys.stdout", new_callable=io.StringIO):
            self.assertEqual(review.report_status(report), 1)

    def test_status_command_needs_no_credentials_and_returns_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "report.json"
            path.write_bytes(
                review.encoded(
                    self.report(status="failed", review=None, message="OpenRouter HTTP 429")
                )
            )
            with (
                patch.dict(os.environ, {}, clear=True),
                patch("sys.argv", ["reviewer", "status", "--report", str(path)]),
                patch("sys.stdout", new_callable=io.StringIO),
            ):
                self.assertEqual(review.main(), 1)


if __name__ == "__main__":
    unittest.main()
