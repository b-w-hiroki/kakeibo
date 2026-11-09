import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const src=readFileSync('index.html','utf8');
const marker="const esc =";
const start=src.indexOf(marker);
const end=src.indexOf("\n",start);
const escape=runInNewContext(src.slice(start,end)+';esc');
test('production escape keeps hostile imported values as text',()=>{
 const value="\"<img src=x onerror=alert(1)>'&";
 const safe=escape(value); assert.ok(!/[<>"']/.test(safe)); assert.ok(safe.includes('&lt;'));
});
test('boundary 1 stays escaped',()=>assert.ok(src.includes("${esc(row.amt||'')}")));
test('boundary 2 stays escaped',()=>assert.ok(src.includes("${esc(budgetMap[cat]||'')}")));
test('inline row handlers use numeric IDs',()=>{assert.ok(!src.includes('${row.id}'));assert.ok(src.includes('Number.isSafeInteger(row.id)'))});
