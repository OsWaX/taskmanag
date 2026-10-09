import test from 'node:test';
import assert from 'node:assert/strict';
import { kpi, validWeights, validateData, canApprove, csvCell, isOverdue, localDate, validDate } from '../src/domain.js';
const task = overrides => ({ id:'t1',title:'Task',description:'',evidence:'Delivered',owner:'p1',sector:'Textile',status:'Approved',complexity:'Strategic',priority:'Normal',due:'2026-10-10',progress:100,quality:4,completedAt:'2026-10-10',checklist:[],comments:[],dependencies:[],...overrides });
const dataset = tasks => ({version:1,people:[{id:'p1',name:'Employee',role:'Specialist',sector:'Textile'}],tasks,weights:{completion:50,timeliness:30,quality:20}});
test('complexity-weighted KPI includes incomplete work in denominators and excludes other months and employees', () => {
  const tasks=[task({complexity:'Strategic'}),task({id:'t2',complexity:'Complex',completedAt:'2026-10-11'}),task({id:'t3',complexity:'Standard',status:'In progress',completedAt:null}),task({id:'t4',due:'2026-09-10'}),task({id:'t5',owner:'p2'})];
  const s=kpi(tasks,'p1','2026-10');
  assert.equal(s.total,10);assert.equal(s.earned,8);assert.equal(s.completion,80);assert.equal(s.timeliness,50);assert.equal(s.quality,64);assert.equal(s.score,67.8);
});
test('no assignments is not a zero performance rating',()=>assert.equal(kpi([],'p1','2026-10').score,null));
test('pending review receives no KPI points',()=>assert.equal(kpi([task({status:'In review'})],'p1','2026-10').score,0));
test('perfect delivery scores 100, same-day completion is on time',()=>assert.equal(kpi([task({quality:5})],'p1','2026-10').score,100));
test('KPI follows the due month even for late completion next month',()=>{
  const t=task({due:'2026-09-30',completedAt:'2026-10-01',quality:5});
  assert.equal(kpi([t],'p1','2026-09').score,70);assert.equal(kpi([t],'p1','2026-10').score,null);
});
test('weights must be numeric, in range, and sum to 100',()=>{
  assert.equal(validWeights({completion:50,timeliness:30,quality:20}),true);
  for(const w of [{completion:50,timeliness:50,quality:20},{completion:-10,timeliness:90,quality:20},{completion:'50',timeliness:30,quality:20}])assert.equal(validWeights(w),false);
});
test('approval requires evidence, completed checklist, approved prerequisites',()=>{
  assert.ok(canApprove(task({evidence:''}),[]));
  assert.ok(canApprove(task({checklist:[{label:'Review',done:false}]}),[]));
  assert.ok(canApprove(task({dependencies:['missing']}),[]));
  assert.equal(canApprove(task({dependencies:['t2']}),[task({id:'t2'})]),'');
});
test('backup validation rejects broken owners, cycles, impossible dates and invalid approved results',()=>{
  assert.doesNotThrow(()=>validateData(dataset([task({})])));
  for(const changes of [{owner:'missing'},{due:'2026-02-31'},{completedAt:null},{quality:10},{dependencies:['unknown']},{dependencies:['t1']},{progress:20}])assert.throws(()=>validateData(dataset([task(changes)])));
  assert.throws(()=>validateData(dataset([task({dependencies:['t2']}),task({id:'t2',dependencies:['t1']})])),/cycle/);
});
test('CSV neutralizes spreadsheet formulas and preserves quoted text',()=>{
  assert.equal(csvCell('=1+1'),'"\'=1+1"');assert.equal(csvCell('A "B"'),'"A ""B"""');
});
test('overdue excludes approved tasks and deadlines today',()=>{
  assert.equal(isOverdue(task({status:'In progress',due:'2026-10-09'}),'2026-10-10'),true);
  assert.equal(isOverdue(task({status:'In progress',due:'2026-10-10'}),'2026-10-10'),false);
  assert.equal(isOverdue(task({due:'2026-10-09'}),'2026-10-10'),false);
});
test('reporting date uses Tashkent timezone across UTC midnight',()=>{
  assert.equal(localDate(new Date('2026-10-09T20:30:00Z')),'2026-10-10');
  assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2028-02-29'),true);
});
