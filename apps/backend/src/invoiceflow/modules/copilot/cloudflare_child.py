"""Isolated Cloudflare HTTP operation, supervised by the parent process."""

import base64
import json
import sys
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    try:
        payload = json.load(sys.stdin.buffer)
        request = Request(
            payload["url"],
            data=base64.b64decode(payload["body"], validate=True),
            headers={"Authorization": payload["authorization"], "Content-Type": "application/json"},
            method="POST",
        )
        with build_opener(NoRedirect()).open(request, timeout=payload["timeout"]) as response:
            body = response.read(payload["max_response_bytes"] + 1)
        if len(body) > payload["max_response_bytes"]:
            result = {"error": "invalid_response"}
        else:
            result = {"body": base64.b64encode(body).decode("ascii")}
    except HTTPError as exc:
        result = {
            "error": "authentication"
            if exc.code in (401, 403)
            else "quota"
            if exc.code == 429
            else "upstream_error"
        }
    except TimeoutError:
        result = {"error": "timeout"}
    except URLError as exc:
        result = {"error": "timeout" if isinstance(exc.reason, TimeoutError) else "upstream_error"}
    except (OSError, HTTPException, ValueError, KeyError, TypeError):
        result = {"error": "upstream_error"}
    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()
