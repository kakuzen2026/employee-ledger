import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../assets/js/employee-settings-docs.js', import.meta.url);

test('employment contract uses the official MHLW model reference', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /mhlw-general-worker-2026-10-ready-v1/);
  assert.match(source, /https:\/\/www\.mhlw\.go\.jp\/stf\/seisakunitsuite\/bunya\/koyou_roudou\/roudoukijun\/roudoukijunkankei\.html/);
});

test('employment contract covers the 2024 mandatory disclosure additions', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  for (const field of [
    'cm_place_scope',
    'cm_work_scope',
    'cm_renew_limit',
    'cm_renew_limit_detail',
    'cm_indefinite_conversion'
  ]) {
    assert.match(source, new RegExp(field));
  }
});

test('employment contract type can be switched between fixed-term and permanent', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /emp_contractSelect\('cm_contract_type','契約種別'/);
  assert.match(source, /\['fixed','有期契約（期間の定めあり）'\]/);
  assert.match(source, /\['permanent','無期契約（期間の定めなし）'\]/);
  assert.match(source, /data-employee-change="\$\{emp_esc\(options\.change\)\}"/);
  assert.match(source, /id="cm_fixed_fields"/);
  assert.match(source, /function toggleContractTermFields\(\)/);
  assert.match(source, /const isFixed=terms\.contract_type==='fixed'/);
  assert.doesNotMatch(
    source.slice(source.indexOf('function generateContract()')),
    /const isFixed=e\.employment_type/
  );
});

test('employment contract covers wages, retirement, consultation and work rules', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  for (const field of [
    'cm_premium_overtime',
    'cm_premium_holiday',
    'cm_premium_night',
    'cm_resignation',
    'cm_dismissal',
    'cm_consultation',
    'cm_treatment_explanation',
    'cm_rules_access'
  ]) {
    assert.match(source, new RegExp(field));
  }
});

test('employment contract rejects missing required terms and saves its exact snapshot', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /validateEmploymentContractTerms\(terms,isFixed\)/);
  assert.match(source, /terms\.end<terms\.start/);
  assert.match(source, /if\(!w\)\{[\s\S]*?return;\s*\}\s*closeContractModal\(\);/);
  assert.match(source, /template_id:EMPLOYMENT_CONTRACT_MODEL\.id/);
  assert.match(source, /template_checked_at:EMPLOYMENT_CONTRACT_MODEL\.checked_at/);
  assert.match(source, /\n\s+terms\n\s+\}\)\.then/);
});

test('employment contract does not pre-commit uncertain business terms', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.doesNotMatch(source, /value="有（月45時間以内）"/);
  assert.doesNotMatch(source, /value="有（会社業績・本人評価による）"/);
  assert.doesNotMatch(source, /value="有（会社業績による）"/);
});

test('every contract form field has a unique ID and is included in the saved snapshot', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const formSource = source.slice(
    source.indexOf('function emp_openContractModal'),
    source.indexOf('function collectEmploymentContractTerms')
  );
  const collectorSource = source.slice(
    source.indexOf('function collectEmploymentContractTerms'),
    source.indexOf('function validateEmploymentContractTerms')
  );
  const fieldIds = [...formSource.matchAll(/emp_contract(?:Input|Area|Select)\('([^']+)'/g)]
    .map((match) => match[1]);

  assert.ok(fieldIds.length >= 40);
  assert.equal(new Set(fieldIds).size, fieldIds.length);
  for (const fieldId of fieldIds) assert.match(collectorSource, new RegExp(`'${fieldId}'`));
});

test('employment contract identifies both parties only once in the signature area', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const generateSource = source.slice(source.indexOf('function generateContract()'));
  const printSource = generateSource.slice(
    generateSource.indexOf('const content=`<!DOCTYPE html>'),
    generateSource.indexOf('const w=window.open')
  );
  assert.doesNotMatch(printSource, /class="parties"/);
  assert.match(printSource, /使用者（甲）署名欄/);
  assert.match(printSource, /労働者（乙）署名欄/);
  assert.match(printSource, /所在地：〒/);
  assert.match(printSource, /生年月日：/);
});

test('employment contract print layout is compacted for one A4 portrait page', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const generateSource = source.slice(source.indexOf('function generateContract()'));
  const printSource = generateSource.slice(
    generateSource.indexOf('const content=`<!DOCTYPE html>'),
    generateSource.indexOf('const w=window.open')
  );
  assert.match(printSource, /@page\{size:A4;margin:5\.5mm 7mm\}/);
  assert.match(printSource, /font-size:8\.8px;line-height:1\.32/);
  assert.match(printSource, /\.section\{margin:4px 0;break-inside:avoid\}/);
  assert.match(printSource, /\.sign-box\{[^}]*min-height:58px\}/);
});
