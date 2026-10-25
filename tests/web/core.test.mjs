import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
await import('../../web/rr-core.js');
const C=globalThis.ReleaseRadarCore;
const sample=JSON.parse(await readFile(new URL('../../config/fusion-customizations.example.json',import.meta.url),'utf8'));
const catalog=JSON.parse(await readFile(new URL('../../data/releases/26D.json',import.meta.url),'utf8'));
export const results=[];
async function test(name,run){await run();results.push(name);}
const row={object_key:'x',name:'Custom service tab',object_type:'PAGE_COMPOSER',module:'Service',description:'A custom tab on the Service Request details page.'};
const inventory=()=>C.normalize({customer:'Acme',customizations:[row]},'test.json');
await test('all browser scripts compile',async()=>{for(const name of ['rr-core.js','rr-app.js','rr-data.js'])new Script(await readFile(new URL('../../web/'+name,import.meta.url),'utf8'),{filename:name});});
await test('sample produces evidence-backed findings and separate unmatched objects',()=>{
  const r=C.analyze(C.normalize(sample,'sample.json'),catalog);
  assert.deepEqual(r.counts,{REVIEW:2,TEST:2,OPPORTUNITY:2});
  assert.equal(r.objects_checked,8);assert.equal(r.affected_objects,6);assert.equal(r.unmatched.length,2);
  assert.equal(r.is_sample,true);assert.equal(r.mode,'RULE_BASED_REVIEW');
  assert.ok(r.findings.every(f=>f.feature.source_url.startsWith('https://docs.oracle.com/')&&f.feature.quote&&f.feature.steps.length));
});
await test('module mismatches do not create findings',()=>{const inv=inventory();inv.objects[0].module='HCM';const r=C.analyze(inv,catalog);assert.equal(r.findings.length,0);assert.match(r.unmatched[0].reason,/no dedicated coverage/);});
await test('cross-application BICC guidance matches ERP integrations',()=>{const inv=C.normalize([{...row,object_type:'OIC',module:'ERP',description:'BICC extract for invoices'}],'test.json');assert.equal(C.analyze(inv,catalog).findings[0].feature.id,'bicc-views');});
await test('word boundaries avoid substring matches',()=>{assert.equal(C.hasTerm('department and table','tab'),false);assert.equal(C.hasTerm('a tab on the page','tab'),true);});
await test('optional page layout does not produce a breaking claim',()=>{const r=C.analyze(inventory(),catalog);assert.equal(r.findings[0].category,'TEST');assert.match(r.findings[0].feature.enablement,/Optional/);});
await test('specific reporting note suppresses broad duplicate guidance',()=>{const r=C.analyze(C.normalize(sample,'sample.json'),catalog);const matches=r.findings.filter(f=>f.object.object_key==='nw-sales-report');assert.equal(matches.length,1);assert.equal(matches[0].feature.id,'otbi-pim');});
await test('no findings is a complete review with a coverage explanation',()=>{const inv=inventory();inv.objects[0].description='Require signed quote';inv.objects[0].name='Quote validator';const r=C.analyze(inv,catalog);assert.equal(r.findings.length,0);assert.match(r.unmatched[0].reason,/No matching note/);});
await test('standard configuration is excluded explicitly',()=>{const inv=C.normalize([{...row,is_custom:false},{...row,object_key:'b',is_custom:'true'}],'test.json');assert.equal(inv.skipped,1);assert.equal(inv.objects.length,1);});
await test('all standard objects cannot start an empty review',()=>{assert.throws(()=>C.analyze(C.normalize([{...row,is_custom:false}],'test.json'),catalog),/at least one/);});
await test('unknown types are retained for manual review',()=>{const inv=C.normalize([{...row,object_type:'UNRECOGNIZED'}],'test.json');assert.equal(inv.objects[0].object_type,'OTHER');assert.equal(inv.warnings.length,1);assert.equal(C.analyze(inv,catalog).unmatched.length,1);});
await test('field and module aliases are supported',()=>{const inv=C.normalize([{displayName:'Example',type:'Visual Builder',application:'CX Service',details:'A service request tab'}],'test.json');assert.equal(inv.objects[0].module,'Service');assert.equal(inv.objects[0].object_type,'PAGE_COMPOSER');});
await test('grouped JSON maps declared types',()=>{const inv=C.normalize({customer:'Acme',reports:[{name:'Pipeline',module:'Sales',description:'OTBI subject area'}]},'x.json');assert.equal(inv.objects[0].object_type,'REPORT');});
await test('duplicate identifiers fail rather than merge objects',()=>assert.throws(()=>C.normalize([row,row],'x.json'),/more than once/));
await test('multiple customer datasets fail rather than mix data',()=>assert.throws(()=>C.normalize([{...row,customer:'A'},{...row,object_key:'y',customer:'B'}],'x.json'),/one customer/));
await test('missing descriptions are actionable errors',()=>assert.throws(()=>C.normalize([{...row,description:''}],'x.json'),/description or code/));
await test('OCI credentials template is not treated as customization data',()=>assert.throws(()=>C.normalize({provider:'ocigenai',credential_name:'EXAMPLE'},'x.json'),/No customization records/));
await test('invalid and empty input rejected',()=>{for(const value of ['{', 'null', '{}', '[]'])assert.throws(()=>C.parseText(value,'x.json'));});
await test('UTF-8 BOM is accepted',()=>assert.equal(C.parseText('\uFEFF'+JSON.stringify([row]),'x.JSON').objects.length,1));
await test('CSV escaped quotes and multiline descriptions are preserved',()=>{const csv='name,object_type,module,description\r\n"Customer, report",REPORT,Sales,"OTBI ""quoted""\nsubject area"\r\n';const inv=C.parseText(csv,'test.csv');assert.equal(inv.objects[0].name,'Customer, report');assert.equal(inv.objects[0].description,'OTBI "quoted"\nsubject area');});
await test('invalid CSV columns and quote closure fail',()=>{for(const csv of ['name,Name\na,b','name,type\na','name,type\n"a,b','name,type\n"a"b,c'])assert.throws(()=>C.parseText(csv,'x.csv'));});
await test('XML external entities are rejected before parsing',()=>assert.throws(()=>C.parseText('<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a/>','x.xml'),/external entities/));
await test('record and field limits enforced',()=>{assert.throws(()=>C.normalize(Array(1001).fill(row),'x.json'),/1000/);assert.throws(()=>C.normalize([{...row,description:'x'.repeat(12001)}],'x.json'),/too long/);});
await test('file size guard rejects before reading',async()=>{await assert.rejects(()=>C.parseFile({name:'x.json',size:C.MAX_FILE+1}),/5 MB/);await assert.rejects(()=>C.parseFile({name:'x.json',size:0}),/non-empty/);});
await test('upload loader uses actual file content',async()=>{const bytes=new TextEncoder().encode(JSON.stringify([row]));const inv=await C.parseFile({name:'x.json',size:bytes.length,arrayBuffer:async()=>bytes.buffer});assert.equal(inv.objects[0].name,row.name);});
await test('damaged ZIP returns a clear error',async()=>{await assert.rejects(()=>C.readZip(new Uint8Array(24).buffer),/ZIP directory/);});
await test('reports distinguish coverage and include sources and tests',()=>{const r=C.analyze(inventory(),catalog);const md=C.reportMarkdown(r);assert.match(md,/not a complete review/);assert.match(md,/Suggested test/);assert.match(md,/https:\/\/docs.oracle.com\//);});
await test('hostile markup is inert inventory text and escaped in Markdown',()=>{const inv=inventory();inv.objects[0].name='<script>alert(1)</script> [click](https://evil.test)';const report=C.analyze(inv,catalog);const md=C.reportMarkdown(report);assert.ok(!md.includes('<script>'));assert.ok(!md.includes('[click]('));});
await test('analysis does not mutate imported data',()=>{const inv=inventory(),before=JSON.stringify(inv);C.analyze(inv,catalog);assert.equal(JSON.stringify(inv),before);});
await test('recording a decision requires a real finding and explicit evidence',()=>{
  const report=C.analyze(inventory(),catalog),id=report.findings[0].id;
  assert.throws(()=>C.updateDecision(report,'missing',{status:'OPEN'}),/no longer/);
  assert.throws(()=>C.updateDecision(report,id,{status:'SAFE'}),/valid review/);
  for(const status of ['VERIFIED','NOT_APPLICABLE'])assert.throws(()=>C.updateDecision(report,id,{status,note:' '}),/evidence or a reason/);
  const changed=C.updateDecision(report,id,{status:'ACTION_PLANNED',owner:' QA team ',note:'Test both role assignments.'});
  assert.equal(C.decisionFor(changed,id).owner,'QA team');
  assert.equal(C.decisionFor(report,id).status,'OPEN');
  assert.match(C.reportMarkdown(changed),/Test both role assignments/);
  assert.match(C.actionPlanCsv(changed),/Action planned/);
});
await test('review notes and owners enforce length limits',()=>{
  const report=C.analyze(inventory(),catalog),id=report.findings[0].id;
  assert.throws(()=>C.updateDecision(report,id,{status:'OPEN',owner:'x'.repeat(121)}),/120/);
  assert.throws(()=>C.updateDecision(report,id,{status:'OPEN',note:'x'.repeat(2001)}),/2,000/);
});
await test('CSV exports escape quotes, multiline notes, and formula prefixes',()=>{
  const report=C.analyze(inventory(),catalog),id=report.findings[0].id;
  const changed=C.updateDecision(report,id,{status:'VERIFIED',owner:'=HYPERLINK("x")',note:'Checked "A"\nwith test role.'});
  const rows=C.csvRows(C.actionPlanCsv(changed).replace(/^\uFEFF/,''));
  assert.equal(rows[0].Owner,"'"+'=HYPERLINK("x")');
  assert.equal(rows[0]['Review note'],'Checked "A"\nwith test role.');
  assert.equal(rows[0]['Review status'],'Verified by reviewer');
});
await test('action plan keeps unmatched objects visible for manual review',()=>{
  const report=C.analyze(C.normalize(sample,'sample.json'),catalog);
  const rows=C.csvRows(C.actionPlanCsv(report).replace(/^\uFEFF/,''));
  assert.equal(rows.length,report.findings.length+report.unmatched.length);
  assert.equal(rows.filter(r=>r.Category==='MANUAL_REVIEW').length,2);
  assert.ok(report.matching_ms>=0);
});
await test('older release index is not labeled a newer quarter',()=>{
  assert.equal(C.isNewerRelease('26C','26D'),false);
  assert.equal(C.isNewerRelease('26D','26D'),false);
  assert.equal(C.isNewerRelease('27A','26D'),true);
  assert.throws(()=>C.isNewerRelease('latest','26D'),/Invalid release/);
});
await test('native setup definitions retain uncertainty and do not infer customization status',()=>{
  const inv=C.parseText('ProfileOptionName,UserProfileOptionName,Description,ApplicationId\nABC,Example option,Example setting,100\n','FND_APP_PROFILE_OPTION.csv');
  assert.equal(inv.import_kind,'NATIVE_SETUP');
  assert.equal(inv.objects[0].object_type,'SETUP');
  assert.equal(inv.objects[0].module,'Unspecified');
  assert.match(inv.warnings[0],/not inferred/);
  assert.equal(C.analyze(inv,catalog).findings.length,0);
});
await test('empty native tables are supported but malformed identities fail',()=>{
  assert.equal(C.parseText('ProfileOptionName,Description\n','FND_APP_PROFILE_OPTION.csv').objects.length,0);
  assert.throws(()=>C.parseText('ProfileOptionName,Description\n,Missing identity\n','FND_APP_PROFILE_OPTION.csv'),/needs ProfileOptionName/);
});
await test('the repository Financials export is readable as a bounded native setup preview',async()=>{
  const data=await readFile(new URL('../../Financials_CSV_20261025_102916_752.zip',import.meta.url));
  const inv=await C.parseFile({name:'Financials.zip',size:data.length,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)});
  assert.equal(inv.import_kind,'NATIVE_SETUP');assert.ok(inv.objects.length>0&&inv.objects.length<=1000);
  assert.equal(inv.files.length,4);assert.ok(inv.warnings.some(w=>w.includes('skipped')));
  assert.ok(inv.objects.every(o=>o.object_type==='SETUP'));
  assert.equal(C.analyze(inv,catalog).unmatched.length,inv.objects.length);
});
console.log(`${results.length} browser-core checks passed.`);
