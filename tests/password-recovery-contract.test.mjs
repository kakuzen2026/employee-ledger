import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, javascript] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../assets/js/core.js", import.meta.url), "utf8")
]);

test("login page exposes request and update forms", () => {
  assert.match(html, /id="reset-request-form"/);
  assert.match(html, /id="password-update-form"/);
  assert.match(html, /autocomplete="new-password"/);
  assert.match(html, /minlength="12"/);
});

test("recovery flow uses the supported Supabase Auth methods", () => {
  assert.match(javascript, /resetPasswordForEmail\(email,\{redirectTo\}\)/);
  assert.match(javascript, /event==='PASSWORD_RECOVERY'&&session/);
  assert.match(javascript, /updateUser\(\{password:newPassword\}\)/);
  assert.match(javascript, /signOut\(\{scope:'global'\}\)/);
});

test("reset request response does not disclose account existence", () => {
  assert.match(javascript, /アカウントが登録されている場合/);
  assert.doesNotMatch(javascript, /このメールアドレスは登録されていません/);
});

test("password update validates length and confirmation", () => {
  assert.match(javascript, /newPassword\.length<12/);
  assert.match(javascript, /newPassword!==confirmation/);
});

test("URL text alone cannot authorize password recovery", () => {
  assert.match(javascript, /let passwordRecoveryActive=false/);
  assert.match(javascript, /waitForPasswordRecoveryEvent/);
  assert.doesNotMatch(javascript, /passwordRecoveryActive=recoveryRedirectInUrl/);
  assert.match(javascript, /async function checkLogin\(\)\{\s*if\(passwordRecoveryActive\)/);
  assert.match(javascript, /await db\.auth\.getSession\(\);\s*if\(passwordRecoveryActive\)/);
  assert.match(javascript, /再設定リンクを確認しています。/);
});

test("network failures restore actionable form state", () => {
  assert.match(javascript, /finally\{\s*btn\.disabled=false;\s*btn\.textContent='再設定メールを送る'/);
  assert.match(javascript, /finally\{\s*document\.getElementById\('new-password'\)\.value=''/);
});

test("password update completion remains visible on the login form", () => {
  assert.match(html, /id="login-status"[^>]+role="status"/);
  assert.match(javascript, /showLoginForm\('パスワードを更新しました。新しいパスワードでログインしてください。'\)/);
});
