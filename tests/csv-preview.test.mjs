import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const html=readFileSync('index.html','utf8');
const code=html.slice(html.indexOf('function confirmCSVImport('),html.indexOf('/* CSV LOAD */'));
function preview(map,dup,accepted){let text; const api=runInNewContext(code+';confirmCSVImport',{csvFileMap:map,countDuplicateRows:()=>dup,confirm:t=>{text=t;return accepted;}});return {run:api,text:()=>text};}
test('preview gives incoming amounts, not merged account balance',()=>{const p=preview({}, {count:0,files:[]},true);assert.equal(p.run([{amt:1200},{amt:-500}], 'sample.csv'),true);assert.match(p.text(),/収入 1,200円 \/ 支出 500円/);assert.match(p.text(),/新しいファイル/);assert.match(p.text(),/統合後の合計ではありません/);});
test('same name replacement and duplicate risk are both explicit',()=>{const map={'same.csv':[{amt:1},{amt:2}]};const p=preview(map,{count:1,files:['other.csv']},false);assert.equal(p.run([{amt:300}], 'same.csv'),false);assert.match(p.text(),/既存 2件を置き換え/);assert.match(p.text(),/重複の可能性：1件/);assert.equal(map['same.csv'].length,2);});
test('filename stays plain confirmation text and cancellation is returned',()=>{const p=preview({}, {count:0,files:[]},false);assert.equal(p.run([], '<img src=x>.csv'),false);assert.match(p.text(),/<img src=x>/);assert.doesNotMatch(code,/innerHTML/);});
test('both normal and misplaced transaction CSV paths confirm before assignment',()=>{for(const segment of [html.slice(html.indexOf('function loadFiles(files)'),html.indexOf('function renderChips()')),html.slice(html.indexOf('function loadAssetHistFile(files)'),html.indexOf('function loadAssetHistFile(files)')+1800)]){assert.ok(segment.indexOf('confirmCSVImport(rows, file.name)')>=0);assert.ok(segment.indexOf('confirmCSVImport(rows, file.name)')<segment.indexOf('csvFileMap[file.name] = rows'));}});
