import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyApifyHttpStatus,
  classifyApifyRunStatus,
  classifyApifyThrown,
  formatWoolworthsApifyError,
  shortApifyBodyMessage,
} from "./apify-errors";

describe("Apify error classification", () => {
  it("maps HTTP statuses to short codes", () => {
    assert.equal(classifyApifyHttpStatus(401), "unauthorized");
    assert.equal(classifyApifyHttpStatus(402), "payment");
    assert.equal(classifyApifyHttpStatus(404), "actor-missing");
    assert.equal(classifyApifyHttpStatus(403, "You must rent this Actor"), "actor-not-rented");
    assert.equal(classifyApifyHttpStatus(403, "nope"), "forbidden");
    assert.equal(classifyApifyHttpStatus(500), "http");
  });

  it("maps run status and thrown timeouts", () => {
    assert.equal(classifyApifyRunStatus("TIMED-OUT"), "timeout");
    assert.equal(classifyApifyRunStatus("FAILED"), "http");
    assert.equal(classifyApifyRunStatus("SUCCEEDED"), null);
    assert.equal(classifyApifyThrown(new Error("The operation was aborted due to timeout")), "timeout");
    assert.equal(classifyApifyThrown(Object.assign(new Error("aborted"), { name: "TimeoutError" })), "timeout");
    assert.equal(classifyApifyThrown(new Error("fetch failed")), "network");
  });

  it("pulls a short message from an Apify error body", () => {
    assert.equal(
      shortApifyBodyMessage(JSON.stringify({ error: { type: "invalid-token", message: "Token is invalid" } })),
      "Token is invalid",
    );
    assert.equal(shortApifyBodyMessage("<html>nope</html>"), "<html>nope</html>");
  });

  it("surfaces status + short reason in the Woolies error string", () => {
    const message = formatWoolworthsApifyError({
      code: "unauthorized",
      status: 401,
      detail: "Token is invalid",
    });
    assert.match(message, /401 unauthorized/);
    assert.match(message, /Token is invalid/);
    assert.match(message, /Akamai/);
    assert.match(message, /Coles still works/);
    assert.match(formatWoolworthsApifyError({ code: "timeout" }), /timeout/);
    assert.match(formatWoolworthsApifyError({ code: "actor-missing", status: 404 }), /404 actor not found/);
    assert.match(formatWoolworthsApifyError({ code: "payment", status: 402 }), /402 payment required/);
  });
});
