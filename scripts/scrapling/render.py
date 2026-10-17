"""Render only a bounded map of resources already fetched by the Node gateway.

The browser is offline. Every request is fulfilled from that map or aborted;
scripts cannot use the browser to bypass Nukkia's DNS/robots/size controls.
"""
import base64
import json
import signal
import sys
from scrapling.fetchers import DynamicFetcher

def terminate(_signum, _frame):
    raise SystemExit(1)

signal.signal(signal.SIGTERM, terminate)
payload = json.loads(sys.stdin.read(4_000_001))
resources = payload["resources"]
if len(resources) > 5:
    raise ValueError("Resource limit")
captured = {}

def setup(page):
    def route_request(route):
        resource = resources.get(route.request.url)
        if route.request.method != "GET" or resource is None:
            route.abort()
            return
        route.fulfill(status=200, content_type=resource["mime"], body=base64.b64decode(resource["body"], validate=True))
    page.context.route("**/*", route_request)

def capture(page):
    try:
        page.wait_for_function("document.querySelector('h1') && document.body.innerText.length > 400", timeout=3000)
    except Exception:
        pass
    captured["html"] = page.content()

DynamicFetcher.fetch(payload["url"], real_chrome=True, headless=True,
    google_search=False, page_setup=setup, page_action=capture, retries=1,
    timeout=5000, additional_args={"offline":True, "service_workers":"block"})
html = captured.get("html", "")
print(json.dumps({"html": html if len(html.encode("utf-8")) <= 1_000_000 else ""}))
