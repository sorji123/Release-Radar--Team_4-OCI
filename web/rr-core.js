/* Shared browser/Node logic. No model calls, network requests or persistence. */
(function (root) {
  'use strict';
  const MAX_FILE = 5 * 1024 * 1024;
  const MAX_EXPANDED = 10 * 1024 * 1024;
  const MAX_OBJECTS = 1000;
  const TYPE_LABELS = {GROOVY:'Groovy script', APP_COMPOSER:'Custom object or field', PAGE_COMPOSER:'Page extension', WORKFLOW:'Workflow or approval', OIC:'Integration', REPORT:'Report', SETUP:'Native setup definition', OTHER:'Unrecognized type'};
  const NATIVE_SETUP={
    'FND_APP_PROFILE_OPTION.csv':{key:'ProfileOptionName',name:'UserProfileOptionName',label:'Profile option'},
    'FND_APP_STANDARD_LOOKUP.csv':{key:'LookupType',name:'Meaning',label:'Standard lookup'},
    'FND_APP_FLEX_VALUE_SET.csv':{key:'ValueSetCode',name:'ValueSetCode',label:'Flex value set'},
    'FND_APP_DESCRIPTIVE_FLEXFIELD.csv':{key:'DescriptiveFlexfieldCode',name:'Name',label:'Descriptive flexfield'}
  };
  const basename=filename=>filename.split(/[\\/]/).pop();
  const nativeName=filename=>/^(FND_APP_|ORA_|KEY_FLEXFIELD_)/.test(basename(filename));
  const key = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const text = value => typeof value === 'string' ? value.trim() : '';
  function get(row, names) {
    const fields = new Map(Object.entries(row).map(([name,value]) => [key(name),value]));
    for (const name of names) if (fields.has(key(name))) return fields.get(key(name));
    return undefined;
  }
  function typeOf(value) {
    const aliases = {groovy:'GROOVY', groovyscript:'GROOVY', script:'GROOVY', objectfunction:'GROOVY', appcomposer:'APP_COMPOSER', applicationcomposer:'APP_COMPOSER', customobject:'APP_COMPOSER', customfield:'APP_COMPOSER', pagecomposer:'PAGE_COMPOSER', pagecustomization:'PAGE_COMPOSER', visualbuilder:'PAGE_COMPOSER', pageextension:'PAGE_COMPOSER', workflow:'WORKFLOW', approval:'WORKFLOW', approvalrule:'WORKFLOW', oic:'OIC', integration:'OIC', rest:'OIC', soap:'OIC', report:'REPORT', bip:'REPORT', bipublisher:'REPORT', otbi:'REPORT'};
    return aliases[key(value)] || 'OTHER';
  }
  function moduleOf(value) {
    const aliases = {sales:'Sales', cxsales:'Sales', fusionsales:'Sales', salesforceautomation:'Sales', service:'Service', fusionservice:'Service', servicecenter:'Service', cxservice:'Service', erp:'ERP', financials:'ERP', finance:'ERP', hcm:'HCM', humanresources:'HCM', scm:'SCM', supplychain:'SCM', common:'Common'};
    return aliases[key(value)] || text(value) || 'Unspecified';
  }
  function normalize(payload, filename) {
    if (!payload || typeof payload !== 'object') throw new Error('Use a JSON inventory with a customizations array, or a list of configuration objects.');
    const envelope = Array.isArray(payload) ? {} : payload;
    let rows = Array.isArray(payload) ? payload : get(payload, ['customizations', 'config_objects', 'objects', 'items']);
    if (!rows) {
      rows = [];
      const groups = {groovyScripts:'GROOVY',customObjects:'APP_COMPOSER',customFields:'APP_COMPOSER',pageCustomizations:'PAGE_COMPOSER',workflows:'WORKFLOW',integrations:'OIC',reports:'REPORT'};
      for (const [name,kind] of Object.entries(groups)) {
        const group = get(payload,[name]);
        if (group !== undefined && !Array.isArray(group)) throw new Error(`${name} must be a list of objects.`);
        if (group) rows.push(...group.map(row => ({...row, object_type:kind})));
      }
    }
    if (!Array.isArray(rows) || !rows.length) throw new Error('No customization records were found. Use the sample inventory format. OCI connection settings are not a Fusion configuration export.');
    if (rows.length > MAX_OBJECTS) throw new Error(`Limit each review to ${MAX_OBJECTS} objects.`);
    const customer = text(get(envelope,['customer','customer_name','organization']));
    const objects = [], seen = new Set(), warnings = [];
    let skipped = 0;
    for (const [index,row] of rows.entries()) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Record ${index+1} must be an object.`);
      const custom = get(row,['is_custom','is_customization','is_customized']);
      if (custom === false || /^(false|no|n|0)$/i.test(String(custom))) { skipped++; continue; }
      const name = text(get(row,['name','object_name','display_name','label']));
      const description = text(get(row,['description','details','purpose']));
      const snippet = text(get(row,['snippet','code','script','configuration']));
      if (!name) throw new Error(`Record ${index+1} needs a name.`);
      if (!description && !snippet) throw new Error(`“${name}” needs a description or code snippet so it can be reviewed.`);
      if (name.length>200 || description.length>12000 || snippet.length>20000) throw new Error(`“${name.slice(0,80)}” is too long. Use a shorter description or snippet.`);
      const object_key = text(get(row,['object_key','id','key'])) || `object-${index+1}`;
      if (seen.has(object_key)) throw new Error(`The object identifier “${object_key}” appears more than once.`);
      seen.add(object_key);
      const rawType = text(get(row,['object_type','type','customization_type']));
      const object_type = typeOf(rawType);
      const module = moduleOf(get(row,['module','application','product']));
      if (object_type === 'OTHER') warnings.push(`“${name}” has an unrecognized customization type and needs manual review.`);
      if (module === 'Unspecified') warnings.push(`“${name}” has no module. Add a module for module-specific matching.`);
      objects.push({object_key,name,description,snippet,object_type,module,customer:text(get(row,['customer','customer_name']))||customer||'Your organization',source_file:filename});
    }
    const customers = [...new Set(objects.map(o=>o.customer))];
    if (customers.length>1) throw new Error('Review one customer at a time. This file contains multiple customer names.');
    return {objects,customer:customers[0]||customer||'Your organization',source_release:text(get(envelope,['source_release','release'])),is_sample:get(envelope,['is_sample'])===true,skipped,warnings,files:[filename]};
  }
  function csvRows(source,allowEmpty=false) {
    const rows = []; let row=[], cell='', quoted=false, closed=false;
    for (let i=0;i<source.length;i++) {
      const c=source[i];
      if (quoted) {
        if (c==='"' && source[i+1]==='"') {cell+='"'; i++;}
        else if (c==='"') {quoted=false; closed=true;}
        else cell+=c;
      } else if (c==='"' && !cell && !closed) quoted=true;
      else if (c===',') {row.push(cell);cell='';closed=false;}
      else if (c==='\r' || c==='\n') {
        if(c==='\r' && source[i+1]==='\n')i++;
        row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';closed=false;
      } else if (closed) {if(!/\s/.test(c))throw new Error('Unexpected text after a quoted CSV field.');}
      else if (c==='"') throw new Error('Put CSV fields containing quotes inside double quotes.');
      else cell+=c;
    }
    if(quoted)throw new Error('The CSV has an unclosed quoted field.');
    row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
    if(rows.length<(allowEmpty?1:2))throw new Error('The CSV needs a header and at least one configuration row.');
    const headers=rows.shift().map(x=>x.trim());
    if(headers.some(x=>!x) || new Set(headers.map(key)).size!==headers.length)throw new Error('CSV column names must be non-empty and unique.');
    return rows.map((values,i)=>{
      if(values.length!==headers.length)throw new Error(`CSV row ${i+2} has ${values.length} fields; expected ${headers.length}.`);
      return Object.fromEntries(headers.map((name,j)=>[name,values[j]]));
    });
  }
  function parseNativeSetup(source,filename) {
    const shape=NATIVE_SETUP[basename(filename)];
    const rows=csvRows(source,true),seen=new Set();
    if(rows.length>MAX_OBJECTS)throw new Error(`Limit each review to ${MAX_OBJECTS} objects.`);
    const objects=rows.map((row,index)=>{
      const code=text(row[shape.key]);
      if(!code)throw new Error(`Native ${shape.label} row ${index+1} needs ${shape.key}.`);
      const object_key=basename(filename)+':'+code+':'+text(row.ApplicationId);
      if(seen.has(object_key))throw new Error('Duplicate native setup definition: '+code);
      seen.add(object_key);
      const name=text(row[shape.name])||code,description=text(row.Description)||shape.label+' definition from the native setup export.';
      if(name.length>200||description.length>12000)throw new Error('Native setup name or description exceeds the inventory limits.');
      return {object_key,name,description,snippet:`${shape.label}: ${code}`,object_type:'SETUP',module:'Unspecified',customer:'Imported setup inventory',source_file:filename};
    });
    return {objects,customer:'Imported setup inventory',source_release:'',is_sample:false,import_kind:'NATIVE_SETUP',skipped:0,files:[filename],warnings:['Native setup preview: only profile-option, lookup, flex-value-set and descriptive-flexfield definitions are extracted. Seeded versus custom status and product ownership are not inferred. These records require manual review; no dedicated setup-impact rules are available.']};
  }
  function xmlRows(source) {
    if(/<!\s*(DOCTYPE|ENTITY)/i.test(source))throw new Error('XML documents with DTDs or external entities are not supported.');
    if(typeof DOMParser==='undefined')throw new Error('XML import requires a browser.');
    const xml=new DOMParser().parseFromString(source,'application/xml');
    if(xml.getElementsByTagName('parsererror').length)throw new Error('The XML is not well-formed. Check the file and try again.');
    const elements=[...xml.getElementsByTagName('*')];
    const records=elements.filter(e=>['customization','configobject','object'].includes(key(e.localName)));
    return {customer:xml.documentElement.getAttribute('customer')||'',customizations:records.map(e=>{
      const row=Object.fromEntries([...e.attributes].map(a=>[a.localName,a.value]));
      for(const child of e.children)row[child.localName]=child.textContent;
      return row;
    })};
  }
  function parseText(source,filename) {
    if(typeof source!=='string')throw new Error('The configuration must contain text.');
    source=source.replace(/^\uFEFF/,'');
    const ext=filename.split('.').pop().toLowerCase();
    if(Object.hasOwn(NATIVE_SETUP,basename(filename)))return parseNativeSetup(source,filename);
    if(nativeName(filename))throw new Error('This native setup table is not supported. Import the complete setup ZIP to preview supported definitions, or use a normalized customization inventory.');
    let payload;
    if(ext==='json') {try {payload=JSON.parse(source);} catch {throw new Error('The JSON is not valid. Check commas, quotes and brackets, then try again.');}}
    else if(ext==='csv')payload=csvRows(source);
    else if(ext==='xml')payload=xmlRows(source);
    else throw new Error('Choose a JSON, CSV or XML inventory, or a ZIP containing those files.');
    return normalize(payload,filename);
  }
  function crc32(bytes) {
    let crc=0xffffffff;
    for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^(0xedb88320&-(crc&1));}
    return (crc^0xffffffff)>>>0;
  }
  async function readZip(buffer) {
    const view=new DataView(buffer), bytes=new Uint8Array(buffer);
    if(buffer.byteLength<22)throw new Error('This ZIP is incomplete.');
    let end=-1;
    for(let i=buffer.byteLength-22;i>=Math.max(0,buffer.byteLength-65557);i--){
      if(view.getUint32(i,true)===0x06054b50 && i+22+view.getUint16(i+20,true)===buffer.byteLength){end=i;break;}
    }
    if(end<0)throw new Error('The ZIP directory could not be read.');
    const count=view.getUint16(end+10,true), directory=view.getUint32(end+16,true);
    if(view.getUint16(end+4,true)||view.getUint16(end+6,true)||count>100||directory===0xffffffff)throw new Error('Use a single ZIP with no more than 100 files; ZIP64 is not supported.');
    const results=[], ignored=[]; let offset=directory,total=0;
    for(let i=0;i<count;i++){
      if(offset+46>end || view.getUint32(offset,true)!==0x02014b50)throw new Error('The ZIP directory is damaged.');
      const flags=view.getUint16(offset+8,true),method=view.getUint16(offset+10,true),crc=view.getUint32(offset+16,true),size=view.getUint32(offset+20,true),expanded=view.getUint32(offset+24,true);
      const n=view.getUint16(offset+28,true),extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true),local=view.getUint32(offset+42,true);
      const next=offset+46+n+extra+comment;
      if(next>end)throw new Error('The ZIP directory is damaged.');
      const filename=new TextDecoder('utf-8',{fatal:true}).decode(bytes.slice(offset+46,offset+46+n));offset=next;
      if(filename.endsWith('/'))continue;
      if(nativeName(filename)&&!Object.hasOwn(NATIVE_SETUP,basename(filename))){ignored.push(filename);continue;}
      if(filename.startsWith('__MACOSX/') || !/\.(json|csv|xml)$/i.test(filename)){ignored.push(filename);continue;}
      if(flags&1)throw new Error('Password-protected ZIPs are not supported.');
      if(![0,8].includes(method))throw new Error('Use a ZIP with standard Deflate compression.');
      if(expanded>MAX_EXPANDED-total)throw new Error('Uncompressed configuration exceeds the 10 MB limit.');
      if(local+30>directory || view.getUint32(local,true)!==0x04034b50)throw new Error('The ZIP entry is damaged.');
      const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
      if(start+size>directory)throw new Error('The ZIP entry is incomplete.');
      let data=bytes.slice(start,start+size);
      if(method===8){
        let stream;
        try {stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}
        catch {throw new Error('This browser cannot unzip this file. Extract it and upload the JSON, CSV or XML inventory instead.');}
        const reader=stream.getReader(),chunks=[];let length=0;
        try {while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;
          if(length>expanded||length>MAX_EXPANDED-total){await reader.cancel();throw new Error('Uncompressed configuration exceeds its size limit.');}chunks.push(value);}}
        finally {reader.releaseLock();}
        data=new Uint8Array(length);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.length;}
      }
      total+=data.length;
      if(data.length!==expanded || crc32(data)!==crc)throw new Error('ZIP integrity check failed. Export the file again.');
      results.push(parseText(new TextDecoder('utf-8',{fatal:true}).decode(data),filename));
    }
    if(!results.length)throw new Error('No supported customization inventory was found in the ZIP. Native Fusion package mapping is pending a sample export.');
    const objects=results.flatMap(r=>r.objects), customers=[...new Set(objects.map(o=>o.customer))];
    const native=results.some(r=>r.import_kind==='NATIVE_SETUP');
    if(native&&results.some(r=>r.import_kind!=='NATIVE_SETUP'))throw new Error('Keep native setup exports and normalized customization inventories in separate uploads.');
    if(objects.length>MAX_OBJECTS)throw new Error(`Limit each review to ${MAX_OBJECTS} objects.`);
    if(customers.length>1)throw new Error('Review one customer at a time. The ZIP contains multiple customers.');
    if(new Set(objects.map(o=>o.object_key)).size!==objects.length)throw new Error('Duplicate object identifiers across ZIP files. Give each object a unique object_key.');
    return {objects,customer:customers[0]||'Your organization',is_sample:results.every(r=>r.is_sample),import_kind:native?'NATIVE_SETUP':'NORMALIZED',source_release:results[0].source_release,skipped:results.reduce((a,r)=>a+r.skipped,0),files:results.flatMap(r=>r.files),warnings:[...new Set(results.flatMap(r=>r.warnings)),...(ignored.length?[`${ignored.length} unsupported or metadata file(s) were skipped: ${ignored.slice(0,5).join(', ')}`]:[])]};
  }
  async function parseFile(file) {
    if(!file || !file.size)throw new Error('Choose a non-empty configuration file.');
    if(file.size>MAX_FILE)throw new Error('Choose a file smaller than 5 MB.');
    try {
      const buffer=await file.arrayBuffer();
      if(/\.zip$/i.test(file.name))return await readZip(buffer);
      return parseText(new TextDecoder('utf-8',{fatal:true}).decode(buffer),file.name);
    } catch(error) {
      if(error instanceof TypeError)throw new Error('The file could not be read as UTF-8 text. Export a JSON, CSV or XML inventory.');
      throw error;
    }
  }
  function hasTerm(haystack,term) {
    const escaped=term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`,'i').test(haystack);
  }
  function analyze(inventory,catalog) {
    if(!inventory?.objects?.length)throw new Error('Import at least one customization before starting a review.');
    const started=performance.now();
    const findings=[],unmatched=[];
    for(const object of inventory.objects){
      const sourceText=[object.name,object.description,object.snippet].join(' ');
      const haystack=(sourceText+' '+sourceText.replace(/([a-z])([A-Z])/g,'$1 $2')).toLowerCase();
      let matches=[];
      for(const feature of catalog.features){
        if(!feature.types.includes(object.object_type))continue;
        if(feature.module!=='Common' && feature.module!==object.module)continue;
        const terms=feature.match_groups.map(group=>group.find(term=>hasTerm(haystack,term))).filter(Boolean);
        if(terms.length!==feature.match_groups.length)continue;
        matches.push({id:`${object.object_key}::${feature.id}`,object,feature,matched_terms:terms,category:feature.category});
      }
      if(matches.some(m=>m.feature.id==='otbi-pim'))matches=matches.filter(m=>m.feature.id!=='otbi-review');
      if(!matches.length)unmatched.push({...object,reason:object.object_type==='SETUP'?'Native setup definition: customization status and module ownership are unverified. No dedicated impact rules are available; assign an owner for manual review.':object.object_type==='OTHER'?'This customization type needs a manual review.':!['Sales','Service','Common'].includes(object.module)?'This module has no dedicated coverage in the current catalog. Cross-application notes were checked where applicable.':'No matching note was found in the reviewed selection. Include this object in your usual regression testing.'});
      findings.push(...matches);
    }
    const rank={REVIEW:0,TEST:1,OPPORTUNITY:2};
    findings.sort((a,b)=>rank[a.category]-rank[b.category]||a.object.name.localeCompare(b.object.name)||a.feature.id.localeCompare(b.feature.id));
    return {schema_version:2,import_kind:inventory.import_kind||'NORMALIZED',mode:'RULE_BASED_REVIEW',release:catalog.release_code,source_release:inventory.source_release,verified_on:catalog.verified_on,generated_at:new Date().toISOString(),customer:inventory.customer,is_sample:inventory.is_sample,objects_checked:inventory.objects.length,features_checked:catalog.features.length,affected_objects:new Set(findings.map(f=>f.object.object_key)).size,counts:Object.fromEntries(Object.keys(rank).map(k=>[k,findings.filter(f=>f.category===k).length])),findings,unmatched,decisions:{},matching_ms:Math.round((performance.now()-started)*100)/100,coverage_note:catalog.coverage_note,method:catalog.method,warnings:inventory.warnings};
  }
  const REVIEW_STATUSES={OPEN:'To review',ACTION_PLANNED:'Action planned',VERIFIED:'Verified by reviewer',NOT_APPLICABLE:'Not applicable'};
  function updateDecision(report,id,decision) {
    if(!report.findings.some(f=>f.id===id))throw new Error('The finding is no longer in this report.');
    if(!Object.hasOwn(REVIEW_STATUSES,decision.status))throw new Error('Choose a valid review status.');
    const owner=text(decision.owner),note=text(decision.note);
    if(owner.length>120 || note.length>2000)throw new Error('Use up to 120 characters for the owner and 2,000 for the review note.');
    if(['VERIFIED','NOT_APPLICABLE'].includes(decision.status)&&!note)throw new Error('Add evidence or a reason before marking a finding verified or not applicable.');
    return {...report,decisions:{...report.decisions,[id]:{status:decision.status,owner,note,updated_at:new Date().toISOString()}}};
  }
  function decisionFor(report,id) {return report.decisions?.[id]||{status:'OPEN',owner:'',note:''};}
  function isNewerRelease(candidate,current) {
    if(!/^\d{2}[A-D]$/.test(candidate)||!/^\d{2}[A-D]$/.test(current))throw new Error('Invalid release code.');
    return candidate>current;
  }
  function actionPlanCsv(report) {
    const cell=value=>{let valueText=String(value??'');if(/^\s*[=+\-@]/.test(valueText))valueText="'"+valueText;return '"'+valueText.replace(/"/g,'""')+'"';};
    const rows=[['Customer','Release','Object key','Customization','Category','Review status','Owner','Review note','Next action','Test steps','Expected result','Oracle source']];
    for(const f of report.findings){const d=decisionFor(report,f.id);rows.push([report.customer,report.release,f.object.object_key,f.object.name,f.category,REVIEW_STATUSES[d.status],d.owner,d.note,f.feature.action,f.feature.steps.map((s,i)=>`${i+1}. ${s}`).join('\n'),f.feature.expected,f.feature.source_url]);}
    for(const o of report.unmatched)rows.push([report.customer,report.release,o.object_key,o.name,'MANUAL_REVIEW','To review','','',o.reason,'Include in the normal regression test plan.','','']);
    return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
  }
  function reportMarkdown(report) {
    const plain=value=>String(value??'').replace(/[<>]/g,'').replace(/[\r\n]+/g,' ').replace(/([\\`*_{}\[\]#!|])/g,'\\$1');
    const lines=[`# Release Radar — ${plain(report.customer)}`,``,`${report.is_sample?'Sample configuration · ':''}Release ${report.release} · Catalog checked ${report.verified_on}`,``,`${report.objects_checked} configuration records checked; ${report.affected_objects} have review suggestions.`,`${report.counts.REVIEW} priority reviews · ${report.counts.TEST} testing suggestions · ${report.counts.OPPORTUNITY} opportunities`, ``,report.coverage_note,report.method,``,...report.warnings.map(w=>`Note: ${plain(w)}`)];
    lines.push(``,`Matching time: ${report.matching_ms} ms (local rules only; excludes human review and test execution).`,`Review statuses are entered by a human and are not automated test results.`);
    for(const f of report.findings){const d=decisionFor(report,f.id);lines.push(``,`## ${plain(f.object.name)}: ${plain(f.feature.title)}`,``,`Review: ${plain(REVIEW_STATUSES[d.status])} · Owner: ${plain(d.owner||'Unassigned')}`,`Reviewer note: ${plain(d.note||'None recorded')}`,``,plain(f.feature.impact),``, `Next step: ${plain(f.feature.action)}`,``,`Oracle evidence: “${plain(f.feature.quote)}”`,`Source: ${f.feature.source_url}`,``,`### Suggested test`,...f.feature.steps.map((s,i)=>`${i+1}. ${plain(s)}`),`Expected: ${plain(f.feature.expected)}`);}
    lines.push(``,`## Objects needing a separate review`,...report.unmatched.map(o=>`- ${plain(o.name)} — ${plain(o.reason)}`));
    return lines.join('\n')+'\n';
  }
  root.ReleaseRadarCore={normalize,parseText,parseFile,csvRows,readZip,analyze,reportMarkdown,actionPlanCsv,updateDecision,decisionFor,REVIEW_STATUSES,isNewerRelease,hasTerm,TYPE_LABELS,MAX_FILE};
})(globalThis);
