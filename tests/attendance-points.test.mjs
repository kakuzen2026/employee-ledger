import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx=vm.createContext({Date,console,localStorage:{getItem(){return null;}},document:{addEventListener(){}}});
vm.runInContext(readFileSync(new URL('../assets/js/employee-core.js',import.meta.url),'utf8'),ctx);
vm.runInContext(readFileSync(new URL('../assets/js/attendance-points.js',import.meta.url),'utf8'),ctx);
vm.runInContext(readFileSync(new URL('../assets/js/paid-leave-csv.js',import.meta.url),'utf8'),ctx);
const row=(date,type='全日',kubun='計画',employee_id=1)=>({employee_id,use_date:date,use_type:type,kubun});
test('全6内容の計画・突発、未分類・不明内容',()=>{
  for(const [type,pt] of Object.entries({'全日':1,'半休（午前）':.5,'半休（午後）':.5,'欠勤':1,'遅刻':.5,'早退':.5})){
    assert.equal(ctx.attendancePoints(row('2026-01-01',type)),pt);
    assert.equal(ctx.attendancePoints(row('2026-01-01',type,'突発')),10);
    assert.equal(ctx.attendancePoints(row('2026-01-01',type,'')),null);
  }
  assert.equal(ctx.attendancePoints(row('2026-01-01','不明','突発')),null);
});
test('月別・全四半期・年境界・別従業員・3pt閾値',()=>{
  const records=[row('2026-01-01'),row('2026-02-01'),row('2026-03-31'),row('2026-04-01','遅刻'),row('2026-06-30','欠勤','突発'),row('2026-07-01'),row('2026-09-30','早退'),row('2026-10-01','半休（午前）'),row('2026-12-31'),row('2025-12-31','欠勤','突発'),row('2027-01-01','欠勤','突発'),row('2026-01-01','欠勤','突発',2)];
  const s=ctx.attendanceSummary(records,1,2026);
  assert.deepEqual(Array.from(s.quarters,q=>q.points),[3,10.5,1.5,1.5]);
  assert.deepEqual(Array.from(s.quarters,q=>q.eligible),[true,false,true,true]);
  assert.equal(ctx.attendanceSummary([...records,row('2026-03-01','早退')],1,2026).quarters[0].eligible,false);
  assert.equal(s.months[5].points,10);
  assert.equal(ctx.attendanceSummary([],1,2026).quarters[0].eligible,true);
});
test('不明区分と不正日付は保留し、未来や別年の未分類を混ぜない',()=>{
  const s=ctx.attendanceSummary([row('2026-01-01','全日',''),row('2027-04-01','全日','')],1,2026);
  assert.equal(s.quarters[0].eligible,null);assert.equal(s.quarters[1].eligible,true);
  for(const date of ['2026-02-30','2026-13-01','',undefined])assert.equal(ctx.attendanceSummary([row(date)],1,2026).quarters[0].eligible,null);
  assert.equal(ctx.attendanceMonth('2024-02-29'),'2024-02');
  assert.equal(ctx.attendanceMonth('2026-02-29'),null);
});
test('欠勤・遅刻・早退は有休残日数を減らさず、旧記録の解釈を維持',()=>{
  vm.runInContext(`employees=[{id:1,status:'在籍',nyusha_date:'2025-01-01'}];yukyuGrants=[{employee_id:1,grant_date:'2026-01-01',days:10,expire_date:'2027-12-31'}];yukyuRecords=${JSON.stringify(['全日','半休（午前）','欠勤','遅刻','早退'].map(t=>row('2026-01-01',t)))};`,ctx);
  const s=ctx.calcYukyuInfo(1,'2026-09-08');assert.equal(s.used,1.5);assert.equal(s.remaining,8.5);assert.equal(ctx.paidLeaveDays({use_type:'旧形式'}),0.5);
});
test('同日遅刻と早退は別記録、同内容と有休同士の重複は防ぐ',()=>{
  vm.runInContext(`employees=[{id:1,shain_no:'1'}];yukyuRecords=[{id:5,employee_id:1,use_date:'2026-01-01',use_type:'遅刻'},{id:6,employee_id:1,use_date:'2026-01-02',use_type:'半休（午前）'}];`,ctx);
  assert.equal(ctx.findYukyuDuplicateRecord(1,'2026-01-01',null,'早退'),null);
  assert.equal(ctx.findYukyuDuplicateRecord(1,'2026-01-01',null,'遅刻').id,5);
  assert.equal(ctx.findYukyuDuplicateRecord(1,'2026-01-01',5,'遅刻'),null);
  assert.equal(ctx.findYukyuDuplicateRecord(1,'2026-01-02',null,'全日').id,6);
});
test('読込失敗時は空の記録を0ptとして判定せず、再読込で回復',async()=>{
  ctx.fetchYukyuRecords=async()=>{throw new Error('offline');};
  await assert.rejects(ctx.loadYukyu(),/offline/);
  assert.match(ctx.attendanceReportHtml([]),/判定を保留/);
  let message='';ctx.showToast=m=>message=m;ctx.exportAttendanceCSV();assert.match(message,/再読み込み/);
  ctx.fetchEmployees=async()=>[];await ctx.loadEmployees();
  ctx.fetchYukyuRecords=async()=>[];await ctx.loadYukyu();
  assert.match(ctx.attendanceReportHtml([]),/該当する従業員がいません/);
});

test('従業員読込だけ失敗しても古い一覧の判定・CSVは保留、両方の再読込で回復',async()=>{
  ctx.fetchEmployees=async()=>[{id:1,sei:'検証',mei:'太郎'}];await ctx.loadEmployees();
  ctx.fetchEmployees=async()=>{throw new Error('employee offline');};
  await assert.rejects(ctx.loadEmployees(),/employee offline/);
  ctx.fetchYukyuRecords=async()=>[];await ctx.loadYukyu();
  assert.match(ctx.attendanceReportHtml([{id:1}]),/判定を保留/);
  let message='';ctx.showToast=m=>message=m;ctx.exportAttendanceCSV();assert.match(message,/再読み込み/);
  let renders=0;ctx.renderYukyuList=()=>renders++;
  ctx.fetchEmployees=async()=>[];await ctx.retryAttendanceLoad();assert.equal(renders,1);
  assert.match(ctx.attendanceReportHtml([]),/該当する従業員がいません/);
});
