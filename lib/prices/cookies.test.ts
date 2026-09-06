import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeCookieJar } from "./cookies";

describe("mergeCookieJar", () => {
  it("merges Set-Cookie name=value pairs and keeps the latest value", () => {
    const next = mergeCookieJar("a=1; b=2", ["b=9; Path=/", "c=3; Secure"]);
    assert.equal(next, "a=1; b=9; c=3");
  });

  it("ignores attribute-only or empty cookies", () => {
    assert.equal(mergeCookieJar("", ["Secure", "", "ak_bmsc=token"]), "ak_bmsc=token");
  });

  it("returns the existing jar when there are no new cookies", () => {
    assert.equal(mergeCookieJar("session=abc", []), "session=abc");
  });
});
