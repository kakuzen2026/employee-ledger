import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, javascript, adapter] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/core.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/firebase-adapter.js", import.meta.url), "utf8")
]);

test("login page exposes a password reset request form", () => {
  assert.match(html, /id="reset-request-form"/);
  assert.match(html, /id="reset-request-btn"/);
  assert.doesNotMatch(html, /id="password-update-form"/);
});

test("recovery flow uses the Firebase-compatible adapter method", () => {
  assert.match(javascript, /resetPasswordForEmail\(email,\{redirectTo\}\)/);
  assert.match(adapter, /sendPasswordResetEmail\(email, \{ url: redirectTo \}\)/);
  assert.doesNotMatch(javascript, /PASSWORD_RECOVERY/);
  assert.doesNotMatch(javascript, /updateUser\(\{password:newPassword\}\)/);
});

test("reset request response does not disclose account existence", () => {
  assert.match(javascript, /アカウントが登録されている場合/);
  assert.doesNotMatch(javascript, /このメールアドレスは登録されていません/);
});

test("network failures restore actionable form state", () => {
  assert.match(javascript, /finally\{\s*btn\.disabled=false;\s*btn\.textContent='再設定メールを送る'/);
});
