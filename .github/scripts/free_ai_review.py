"""Advisory PR review. Standard library only; never imports or executes PR code."""

import argparse
import html
import json
import os
import re
from decimal import Decimal, InvalidOperation
from http.client import HTTPException
from pathlib import Path, PurePosixPath
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

GITHUB = "https://api.github.com"
OPENROUTER = "https://openrouter.ai/api/v1"
MARKER = "<!-- invoiceflow-free-ai-review -->"
MAX_DIFF_BYTES = 24_000
MAX_OUTPUT_TOKENS = 2048
MAX_HTTP_BYTES = 8_000_000
SOURCE_SUFFIXES = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".html",
    ".css",
    ".scss",
    ".sql",
    ".sh",
    ".ps1",
}


class ReviewError(Exception):
    """Safe fixed messages only: never include raw API responses or credentials."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ReviewError("API redirect refused.")


def request_json(url, token, payload=None, method=None):
    headers = {"Accept": "application/json", "User-Agent": "InvoiceFlow-Free-Review"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if url.startswith(GITHUB + "/"):
        headers["X-GitHub-Api-Version"] = "2022-11-28"
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    try:
        req = Request(url, data=data, headers=headers, method=method)
        with build_opener(NoRedirect()).open(req, timeout=90) as response:
            raw = response.read(MAX_HTTP_BYTES + 1)
        if len(raw) > MAX_HTTP_BYTES:
            raise ReviewError("API response exceeded the size limit.")
        return json.loads(raw)
    except HTTPError as exc:
        if exc.code == 429:
            raise ReviewError("API rate limit reached; AI review could not be completed.") from None
        raise ReviewError(f"API request failed (HTTP {exc.code}); review incomplete.") from None
    except (URLError, TimeoutError, OSError, ValueError, HTTPException):
        raise ReviewError("API unavailable or returned invalid JSON; review incomplete.") from None


class GitHub:
    def __init__(self, repo, token):
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
            raise ReviewError("Invalid repository.")
        self.repo = repo
        self.token = token

    def call(self, path, payload=None, method=None):
        return request_json(f"{GITHUB}/repos/{self.repo}/{path}", self.token, payload, method)

    def pages(self, path, max_pages=100):
        items = []
        for page in range(1, max_pages + 1):
            batch = self.call(f"{path}?per_page=100&page={page}")
            if not isinstance(batch, list):
                raise ReviewError("Invalid GitHub list response.")
            items.extend(batch)
            if len(batch) < 100:
                return items
        raise ReviewError("GitHub pagination limit reached; review incomplete.")

    def files(self, number):
        pr = self.call(f"pulls/{number}")
        if pr["changed_files"] >= 3000:
            raise ReviewError("PR exceeds GitHub's file listing limit; review incomplete.")
        files = self.pages(f"pulls/{number}/files", 30)
        if len(files) != pr["changed_files"]:
            raise ReviewError("Incomplete GitHub file listing.")
        return files


def source_file(name):
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or "\\" in name or any(ord(c) < 32 for c in name):
        return False
    excluded = {
        "node_modules",
        "dist",
        "build",
        "coverage",
        "vendor",
        "__pycache__",
        ".angular",
        ".venv",
        "generated",
        "__generated__",
        "docs",
        "tasks",
        ".agents",
        ".codex",
    }
    if set(path.parts) & excluded:
        return False
    if re.search(r"(?:\.generated\.|\.g\.ts$|\.min\.|\.d\.ts$|(?:^|/)schema\.ts$)", name):
        return False
    return path.suffix in SOURCE_SUFFIXES or path.name == "Dockerfile"


def right_lines(patch):
    result = set()
    line = None
    for text in patch.splitlines():
        match = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@", text)
        if match:
            line = int(match[1])
        elif line is not None and text.startswith(("+", " ")):
            result.add(line)
            line += 1
    return result


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def select_diff(files, budget=MAX_DIFF_BYTES):
    selected = []
    incomplete = False
    for file in files:
        if not source_file(file["filename"]):
            continue
        patch = file.get("patch")
        if not patch:
            incomplete = True
            continue
        for prefix, field in [("+", "additions"), ("-", "deletions")]:
            if (
                field in file
                and sum(line.startswith(prefix) for line in patch.splitlines()) != file[field]
            ):
                incomplete = True  # GitHub can omit part of a large patch itself.
        item = {"file": file["filename"], "patch": patch}
        if len(encoded(selected + [item])) > budget:
            # Keep only complete patch lines; omitted lines cannot be cited.
            kept = []
            for line in patch.splitlines(keepends=True):
                candidate = {"file": file["filename"], "patch": "".join(kept) + line}
                if len(encoded(selected + [candidate])) > budget:
                    break
                kept.append(line)
            item["patch"] = "".join(kept)
            incomplete = True
        if right_lines(item["patch"]):
            selected.append(item)
        else:
            incomplete = True
    refs = {item["file"]: right_lines(item["patch"]) for item in selected}
    return selected, refs, incomplete


def free_model(catalog, model):
    # Only the dedicated free router or explicit :free variants are accepted.
    if model != "openrouter/free" and not model.endswith(":free"):
        raise ReviewError("Model must be openrouter/free or an explicit :free variant.")
    if not isinstance(catalog, dict) or not isinstance(catalog.get("data"), list):
        raise ReviewError("Invalid model catalog; free pricing could not be verified.")
    for entry in catalog["data"]:
        if not isinstance(entry, dict):
            raise ReviewError("Invalid model catalog entry.")
        if entry.get("id") != model:
            continue
        prices = entry.get("pricing", {})
        if not isinstance(prices, dict):
            raise ReviewError("Selected model pricing could not be verified.")
        try:
            if not {"prompt", "completion"} <= prices.keys() or any(
                Decimal(str(value)) != 0 for value in prices.values()
            ):
                raise ReviewError("Selected model does not have verified zero pricing.")
        except (InvalidOperation, TypeError):
            raise ReviewError("Selected model pricing could not be verified.") from None
        context = entry.get("context_length")
        if type(context) is not int or context < 4096:
            raise ReviewError("Selected model has no usable context limit.")
        return context
    raise ReviewError("Selected free model is unavailable in the model catalog.")


def validate_review(value, refs):
    if (
        not isinstance(value, dict)
        or set(value) != {"summary", "findings"}
        or not isinstance(value["summary"], str)
        or len(value["summary"]) > 2000
        or not isinstance(value["findings"], list)
        or len(value["findings"]) > 8
    ):
        raise ReviewError("Model response failed schema validation; review incomplete.")
    keys = {"severity", "file", "line", "title", "explanation", "suggested_fix"}
    for finding in value["findings"]:
        if not isinstance(finding, dict) or set(finding) != keys:
            raise ReviewError("Malformed model finding; review incomplete.")
        for key in keys - {"line"}:
            if (
                not isinstance(finding[key], str)
                or not finding[key].strip()
                or len(finding[key]) > (200 if key == "title" else 2000)
            ):
                raise ReviewError("Invalid finding text; review incomplete.")
        if (
            finding["severity"] not in {"P0", "P1", "P2"}
            or type(finding["line"]) is not int
            or finding["line"] not in refs.get(finding["file"], set())
        ):
            raise ReviewError("Unsupported finding severity or diff reference; review incomplete.")
    texts = [value["summary"]] + [f[key] for f in value["findings"] for key in keys - {"line"}]
    if sum(len(safe_text(text).encode("utf-8")) for text in texts) > 40_000:
        raise ReviewError("Model findings exceed comment size limit; review incomplete.")
    return value


def infer(model, key, prompt, selected):
    response = request_json(
        OPENROUTER + "/chat/completions",
        key,
        {
            "model": model,
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": encoded(selected).decode("utf-8")},
            ],
            "max_tokens": MAX_OUTPUT_TOKENS,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "provider": {
                "allow_fallbacks": False,
                "require_parameters": True,
                "max_price": {"prompt": 0, "completion": 0, "request": 0},
            },
        },
    )
    try:
        choice = response["choices"][0]
        if choice["finish_reason"] != "stop" or choice["message"].get("tool_calls"):
            raise ReviewError("Model output was incomplete or requested tools; review incomplete.")
        return json.loads(choice["message"]["content"])
    except (KeyError, IndexError, TypeError, ValueError, AttributeError):
        raise ReviewError("Malformed model response; AI review could not be completed.") from None


def bot_comments(gh, number):
    return [
        c
        for c in gh.pages(f"issues/{number}/comments")
        if c.get("user", {}).get("login") == "github-actions[bot]"
        and c.get("user", {}).get("type") == "Bot"
        and c.get("body", "").startswith(MARKER)
    ]


def revision(pr):
    return f"{pr['head']['sha']}:{pr['base']['sha']}"


def eligible(pr, repo, expected):
    return (
        pr["state"] == "open"
        and not pr["draft"]
        and pr["base"]["ref"] == "master"
        and pr["head"].get("repo", {}).get("full_name") == repo
        and revision(pr) == expected
    )


def analyze(gh, number, expected, prompt, model, key, rerun=False):
    report = {
        "revision": expected,
        "status": "failed",
        "message": "",
        "review": None,
        "incomplete": False,
        "budget": MAX_DIFF_BYTES,
    }
    try:
        pr = gh.call(f"pulls/{number}")
        if not eligible(pr, gh.repo, expected):
            report.update(status="unchanged", message="Obsolete or ineligible PR; skipped.")
            return report
        stamp = f"<!-- revision:{expected} -->"
        if not rerun and any(stamp in c["body"] for c in bot_comments(gh, number)):
            report.update(status="unchanged", message="Revision already attempted; skipped.")
            return report
        files = gh.files(number)
        selected, refs, incomplete = select_diff(files)
        report["incomplete"] = incomplete
        if not selected:
            report.update(
                status="skipped",
                message="No reviewable source diff; AI review skipped.",
            )
            return report
        if not key:
            raise ReviewError("OPENROUTER_API_KEY is missing; AI review could not be completed.")
        context = free_model(request_json(OPENROUTER + "/models", ""), model)
        # A conservative bound: one token per UTF-8 byte plus framing reserve.
        budget = min(
            MAX_DIFF_BYTES,
            context - len(prompt.encode("utf-8")) - MAX_OUTPUT_TOKENS - 2048,
        )
        if budget < 512:
            raise ReviewError("Model context is too small; AI review could not be completed.")
        selected, refs, incomplete = select_diff(files, budget)
        report.update(incomplete=incomplete, budget=budget)
        if not selected:
            raise ReviewError("Diff does not fit model context; AI review could not be completed.")
        if not eligible(gh.call(f"pulls/{number}"), gh.repo, expected):
            report.update(status="unchanged", message="PR changed during analysis; skipped.")
            return report
        report["review"] = validate_review(infer(model, key, prompt, selected), refs)
        report["status"] = "completed"
    except ReviewError as exc:
        report["message"] = str(exc)
    except (KeyError, TypeError, ValueError):
        report["message"] = "Invalid API data; AI review could not be completed."
    return report


def safe_text(text):
    # Render model text as inert prose: no HTML, Markdown links, or mentions.
    text = re.sub(r"[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]", " ", text)
    text = html.escape(text).replace("@", "@\u200b")
    text = " ".join(text.split())
    return re.sub(r"([\\`*_[\]{}()!#|>~])", r"\\\1", text)


def comment_body(report):
    lines = [
        MARKER,
        f"<!-- revision:{report['revision']} -->",
        "### Free AI review (advisory)",
        f"Revision: `{report['revision']}`.",
    ]
    if report["incomplete"]:
        lines.append(
            "**Warning: incomplete review coverage. Oversized, unavailable, or "
            "unsupported source patches/lines were omitted.**"
        )
    if report["status"] == "completed":
        review = report["review"]
        if not review["findings"]:
            lines.append("No high-confidence issues were detected.")
        else:
            lines.append(safe_text(review["summary"]))
            for f in review["findings"]:
                lines.append(
                    f"**{f['severity']}: {safe_text(f['title'])}** — "
                    f"{safe_text(f['file'])}:{f['line']}\n\n"
                    f"{safe_text(f['explanation'])} "
                    f"Fix: {safe_text(f['suggested_fix'])}"
                )
    else:
        lines.append(safe_text(report["message"]))
    lines.append("AI output may be wrong. Existing quality gates remain authoritative.")
    return "\n\n".join(lines)


def publish(gh, number, expected, report):
    if report["revision"] != expected:
        raise ReviewError("Report revision mismatch.")
    if report["status"] == "unchanged":
        return
    if report["status"] not in {"completed", "failed", "skipped"}:
        raise ReviewError("Invalid report status.")
    if not eligible(gh.call(f"pulls/{number}"), gh.repo, expected):
        return
    if report["status"] == "completed":
        budget = report["budget"]
        if type(budget) is not int or not 512 <= budget <= MAX_DIFF_BYTES:
            raise ReviewError("Invalid report budget.")
        _, refs, incomplete = select_diff(gh.files(number), budget)
        validate_review(report["review"], refs)
        report["incomplete"] = incomplete
    comments = bot_comments(gh, number)
    # Recheck just before the write to avoid overwriting a newer revision.
    if not eligible(gh.call(f"pulls/{number}"), gh.repo, expected):
        return
    body = {"body": comment_body(report)}
    if comments:
        gh.call(f"issues/comments/{comments[0]['id']}", body, "PATCH")
    else:
        gh.call(f"issues/{number}/comments", body, "POST")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["analyze", "publish"])
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    gh = GitHub(os.environ["GITHUB_REPOSITORY"], os.environ["GITHUB_TOKEN"])
    number = event["number"]
    expected = revision(event["pull_request"])
    if args.command == "analyze":
        prompt = Path("prompts/free-ai-code-review.md").read_text(encoding="utf-8")
        report = analyze(
            gh,
            number,
            expected,
            prompt,
            os.environ.get("FREE_AI_REVIEW_MODEL") or "openrouter/free",
            os.environ.get("OPENROUTER_API_KEY", ""),
            int(os.environ.get("GITHUB_RUN_ATTEMPT", "1")) > 1,
        )
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_bytes(encoded(report))
        print("AI review status:", report["status"])
    else:
        if args.report.stat().st_size > 100_000:
            raise ReviewError("Review artifact exceeds size limit.")
        publish(gh, number, expected, json.loads(args.report.read_text(encoding="utf-8")))


if __name__ == "__main__":
    try:
        main()
    except ReviewError as error:
        raise SystemExit(str(error)) from None
