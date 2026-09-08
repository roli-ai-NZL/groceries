import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyParsedWoolworthsBody,
  classifyWoolworthsResponse,
  decideWoolworthsFollowUp,
  decideWoolworthsStart,
  isConnectionReset,
  shouldFallbackToApify,
  WOOLWORTHS_AKAMAI_ERROR,
  WOOLWORTHS_UNAVAILABLE_NO_TOKEN,
  woolworthsUnavailableMessage,
} from "./woolworths-errors";

describe("classifyWoolworthsResponse", () => {
  it("treats 403 as Akamai blocked", () => {
    assert.equal(classifyWoolworthsResponse(403, "Access Denied"), "blocked");
  });

  it("treats Access Denied HTML as blocked even on 200", () => {
    const html = "<html><h1>Access Denied</h1><p>You don't have permission. Reference #18.abc</p></html>";
    assert.equal(classifyWoolworthsResponse(200, html, "text/html"), "blocked");
  });

  it("treats edgesuite HTML as blocked", () => {
    assert.equal(
      classifyWoolworthsResponse(200, "<html>errors.edgesuite.net</html>", "text/html; charset=utf-8"),
      "blocked",
    );
  });

  it("treats other HTTP errors as http", () => {
    assert.equal(classifyWoolworthsResponse(500, '{"error":true}', "application/json"), "http");
  });

  it("treats JSON product payloads as ok", () => {
    assert.equal(
      classifyWoolworthsResponse(200, '{"Products":[]}', "application/json"),
      "ok",
    );
  });
});

describe("classifyParsedWoolworthsBody", () => {
  it("flags missing Products as empty/suspicious", () => {
    assert.equal(classifyParsedWoolworthsBody({}), "empty");
    assert.equal(classifyParsedWoolworthsBody(null), "empty");
  });

  it("flags a present Products array as a real no-match", () => {
    assert.equal(classifyParsedWoolworthsBody({ Products: [] }), "nomatch");
  });
});

describe("isConnectionReset", () => {
  it("detects reset / fetch failures", () => {
    assert.equal(isConnectionReset(new Error("read ECONNRESET")), true);
    assert.equal(isConnectionReset(new TypeError("fetch failed")), true);
    assert.equal(isConnectionReset(new Error("something else")), false);
  });
});

describe("Woolworths fallback routing", () => {
  it("starts with a direct fetch unless this process already saw Akamai", () => {
    assert.equal(decideWoolworthsStart(false, false), "direct");
    assert.equal(decideWoolworthsStart(true, false), "unavailable");
    assert.equal(decideWoolworthsStart(true, true), "call-apify");
  });

  it("falls back to Apify on block/empty/reset when a token exists", () => {
    assert.equal(shouldFallbackToApify("blocked"), true);
    assert.equal(shouldFallbackToApify("empty"), true);
    assert.equal(shouldFallbackToApify("reset"), true);
    assert.equal(shouldFallbackToApify("nomatch"), false);
    assert.equal(
      decideWoolworthsFollowUp({ alreadyBlocked: false, hasToken: true, kind: "blocked", matchCount: 0 }),
      "call-apify",
    );
  });

  it("explains Woolies is unavailable when blocked and there is no token", () => {
    assert.equal(
      decideWoolworthsFollowUp({ alreadyBlocked: false, hasToken: false, kind: "blocked", matchCount: 0 }),
      "unavailable",
    );
    assert.equal(woolworthsUnavailableMessage(false), WOOLWORTHS_UNAVAILABLE_NO_TOKEN);
    assert.match(WOOLWORTHS_UNAVAILABLE_NO_TOKEN, /Akamai/);
    assert.match(WOOLWORTHS_UNAVAILABLE_NO_TOKEN, /APIFY_TOKEN/);
    assert.match(WOOLWORTHS_UNAVAILABLE_NO_TOKEN, /Coles still works/);
    assert.equal(WOOLWORTHS_AKAMAI_ERROR, "Woolworths blocked this server (Akamai).");
  });

  it("does not pretend a genuine empty search is a block", () => {
    assert.equal(
      decideWoolworthsFollowUp({ alreadyBlocked: false, hasToken: true, kind: "nomatch", matchCount: 0 }),
      "nomatch",
    );
  });

  it("prefers successful matches over fallback", () => {
    assert.equal(
      decideWoolworthsFollowUp({ alreadyBlocked: true, hasToken: true, kind: "blocked", matchCount: 2 }),
      "use-matches",
    );
  });
});
