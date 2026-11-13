"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { pkcePair, parseDeepLink, deepLinkFromArgv, classifyUrl, unreadFromTitle } = require("../src/logic.cjs");

const SITE = "https://kasbegalari.vercel.app";

test("PKCE: challenge = sha256(verifier), 43 belgi", () => {
  const { verifier, challenge } = pkcePair();
  assert.equal(challenge.length, 43);
  assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(crypto.createHash("sha256").update(verifier).digest("base64url"), challenge);
  assert.notEqual(pkcePair().verifier, verifier);
});

test("deep link", () => {
  const code = "x".repeat(40);
  assert.deepEqual(parseDeepLink(`kasbegalari://auth?code=${code}`), { kind: "auth", code });
  assert.equal(parseDeepLink("kasbegalari://auth?code=short"), null);
  assert.equal(parseDeepLink("https://evil.com/?code=" + code), null);
  assert.deepEqual(parseDeepLink("kasbegalari://open?path=/kabinet"), { kind: "open", path: "/kabinet" });
  assert.equal(parseDeepLink("kasbegalari://open?path=//evil.com"), null);
  assert.equal(parseDeepLink("kasbegalari://open?path=https://evil.com"), null);
  assert.equal(parseDeepLink("kasbegalari://boshqa"), null);
  assert.equal(deepLinkFromArgv(["app.exe", "--x", "kasbegalari://auth?code=1"]), "kasbegalari://auth?code=1");
  assert.equal(deepLinkFromArgv(["app.exe"]), null);
});

test("URL tasnifi", () => {
  assert.equal(classifyUrl(`${SITE}/kabinet`, SITE), "app");
  assert.equal(classifyUrl(`${SITE}/api/auth/google?next=/`, SITE), "google");
  assert.equal(classifyUrl("https://accounts.google.com/o/oauth2/v2/auth", SITE), "google");
  assert.equal(classifyUrl("https://t.me/kasb_egalari_bot", SITE), "external");
  assert.equal(classifyUrl("https://kasbegalari.vercel.app.evil.com/", SITE), "external");
  assert.equal(classifyUrl("javascript:alert(1)", SITE), "block");
  assert.equal(classifyUrl("file:///etc/passwd", SITE), "block");
  assert.equal(classifyUrl("mailto:a@b.uz", SITE), "external");
  assert.equal(classifyUrl("https://kasbegalari.uz/x", SITE, ["kasbegalari.uz"]), "app");
});

test("sarlavhadan o'qilmaganlar", () => {
  assert.equal(unreadFromTitle("(3) Chat · Kasb Egalari"), 3);
  assert.equal(unreadFromTitle("(99+) Chat"), 99);
  assert.equal(unreadFromTitle("Chat · Kasb Egalari"), 0);
  assert.equal(unreadFromTitle("2024 (3) yil"), 0);
});
