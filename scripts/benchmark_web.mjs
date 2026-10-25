// Measures local matching only. This is not a customer time-savings study.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
await import('../web/rr-core.js');
const C=globalThis.ReleaseRadarCore;
const sample=JSON.parse(await readFile(new URL('../config/fusion-customizations.example.json',import.meta.url),'utf8'));
const catalog=JSON.parse(await readFile(new URL('../data/releases/26D.json',import.meta.url),'utf8'));
const runs=[];
for(const size of [8,250,1000]){
  const inv=C.normalize({customer:'Synthetic benchmark',is_sample:true,customizations:Array.from({length:size},(_,i)=>({...sample.customizations[i%sample.customizations.length],object_key:'benchmark-'+i}))},'generated-benchmark.json');
  C.analyze(inv,catalog);
  const durations=[];
  let findings;
  for(let i=0;i<25;i++){const start=performance.now();const report=C.analyze(inv,catalog);durations.push(performance.now()-start);findings=report.findings.length;}
  durations.sort((a,b)=>a-b);
  runs.push({objects:size,features:catalog.features.length,iterations:durations.length,findings,p50_ms:+durations[12].toFixed(2),p95_ms:+durations[23].toFixed(2),max_ms:+durations[24].toFixed(2)});
}
const result={measured_at:new Date().toISOString(),runtime:process.version,platform:process.platform,method:'One warmup, then 25 iterations per size. Synthetic inventory copies. Matching only; excludes import, rendering, networking, human review and test execution.',budget:{objects:1000,p95_ms:1000},runs};
const arg=process.argv.indexOf('--output');
if(arg!==-1){const output=resolve(process.argv[arg+1]);await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));
if(runs.at(-1).p95_ms>result.budget.p95_ms){console.error('Matching exceeded the 1,000 ms p95 budget.');process.exitCode=1;}
