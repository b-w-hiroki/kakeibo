import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const html=readFileSync('index.html','utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const code=section('function splitCSVLine(', '\nfunction ')+section('function isAssetHistCSV(', '/* 既に取り込み済み')+section('const AH_COLS =','function loadAssetHistFile(');
const csv=(rows)=>'日付,合計,現金,株式,信用,投信,年金,ポイント,その他\n'+rows;
const row=(date,amt=10)=>`${date},${amt},0,0,0,0,0,0,0`;
function setup(accept=true,fail=false){let prompt='',writes=0;const store={kakeibo_ah:'old',kakeibo_csv:'unrelated'}; const ctx={assetHistory:[{month:'2025/01',total:3}],pendingBackupRecovery:false,confirm:t=>(prompt=t,accept),showToast:()=>{},renderAssetHistSummary:()=>{},switchTab:()=>{},localStorage:{setItem(k,v){if(fail)throw Error('quota');store[k]=v;writes++;}}};const api=runInNewContext(code+';({applyAssetHistData,parseAssetHistCSV})',ctx);return {api,ctx,store,prompt:()=>prompt,writes:()=>writes};}
test('asset preview discloses full replacement and duplicate first occurrence policy',()=>{const t=setup();assert.equal(t.api.applyAssetHistData(csv(row('2026/11/01')+'\n'+row('2026/11/30',20)),'sample.csv'),true);assert.match(t.prompt(),/2行 → 1ヶ月/);assert.match(t.prompt(),/すべて置き換え/);assert.match(t.prompt(),/最初に出現/);assert.equal(t.ctx.assetHistory[0].total,10);assert.equal(t.store.kakeibo_csv,'unrelated');assert.equal(t.writes(),1);});
test('cancel and quota failure leave both memory and storage untouched',()=>{for(const [accept,fail] of [[false,false],[true,true]]){const t=setup(accept,fail);const old=t.ctx.assetHistory;assert.equal(t.api.applyAssetHistData(csv(row('2026/11/01'))),null);assert.equal(t.ctx.assetHistory,old);assert.equal(t.store.kakeibo_ah,'old');assert.equal(t.writes(),0);}});
test('invalid dates, numbers, truncated rows reject entire file without writes',()=>{for(const bad of [row('2026/02/30'),row('2026/13/01'),row('2026/11/01','12abc'),row('2026/11/01','9007199254740992'),'2026/11/01,10']){const t=setup();assert.equal(t.api.applyAssetHistData(csv(row('2026/10/01')+'\n'+bad)),null);assert.equal(t.writes(),0);}});
test('zero and quoted comma balances parse without 100000 threshold',()=>{const t=setup();assert.equal(t.api.parseAssetHistCSV(csv(row('2026/11/01',0)))[0].total,0);assert.equal(t.api.parseAssetHistCSV(csv(row('2026/11/01','"1,200"')))[0].total,1200);});

test('malformed grouping and unmatched quotes are rejected',()=>{for(const bad of [row('2026/11/01','"1,2"'),row('2026/11/01','"1,,200"'),row('2026/11/01').slice(0,-1)+'"0']){const t=setup();assert.equal(t.api.applyAssetHistData(csv(bad)),null);assert.equal(t.writes(),0);}});
