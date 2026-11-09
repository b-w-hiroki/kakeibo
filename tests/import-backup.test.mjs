import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const html=readFileSync('index.html','utf8');
const keys=html.slice(html.indexOf('const BACKUP_KEYS ='),html.indexOf('function openDataModal()'));
const helpers=html.slice(html.indexOf('function prepareBackupStore('),html.indexOf('function importBackup(files)'));
const validStore={
 kakeibo_csv:JSON.stringify({'file.csv':[{date:'2026/11/09',name:'Lunch',cat:'食費',amt:-500,type:'exp',bank:'cash',month:'2026/11',id:'x',sub:''}]}),
 kakeibo_assets:JSON.stringify([{id:1,name:'cash',amt:50}]),
 kakeibo_inc:'[]', kakeibo_exp:'[]', kakeibo_ah:JSON.stringify([{month:'2026/11',total:50,cash:50}]),
 kakeibo_nextId:'20', kakeibo_budget:'{"食費":1000}', kakeibo_cat_aliases:'{"Lunch":"食費"}',
 kakeibo_fixed_cats:'[]',kakeibo_invest_cats:'[]',kakeibo_excluded:'[]',kakeibo_collapsed:'[]',
 kakeibo_goal:'{"amt":100,"year":2027}', kakeibo_cat_colors:'{"食費":"#abcdef"}',
 kakeibo_theme:'dark', kakeibo_trips:'{"excl":false,"list":[]}',kakeibo_trip_tags:'{}',kakeibo_csvdetail_seeded:'1'
};
function setup(initial={},failure=()=>false){
 const m=new Map(Object.entries(initial));let count=0;
 const localStorage={getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{if(failure(++count,k,v))throw Error('quota');m.set(k,v)},removeItem:k=>m.delete(k)};
 const api=runInNewContext(keys+helpers+';({prepareBackupStore,applyBackupStore,recovery:()=>pendingBackupRecovery})',{localStorage,window:{addEventListener(){}}});
 return {...api,m,localStorage};
}
const backup=store=>({_app:'kakeibo',_version:1,store});
test('current full backup and legacy missing version accepted',()=>{const a=setup();assert.equal(Object.keys(a.prepareBackupStore(backup(validStore))).length,18);assert.equal(a.prepareBackupStore({_app:'kakeibo',store:{kakeibo_inc:'[]'}}).kakeibo_inc,'[]')});
test('future version, empty, primitive/null store rejected',()=>{const a=setup();for(const x of [null,[],{},'x'])assert.throws(()=>a.prepareBackupStore(backup(x)));assert.throws(()=>a.prepareBackupStore({...backup(validStore),_version:2}))});
test('unsafe IDs, amounts, object names and malformed collections rejected',()=>{const a=setup();for(const bad of [{id:'1);alert(1)',name:'cash',amt:5},{id:1,name:{},amt:5},{id:1,name:'cash',amt:'<img>'},null]){assert.throws(()=>a.prepareBackupStore(backup({kakeibo_assets:JSON.stringify([bad])})));}for(const [key,value] of [['kakeibo_csv','{"f":{}}'],['kakeibo_fixed_cats','[1]'],['kakeibo_cat_colors','{"c":"red;expression(x)"}'],['kakeibo_nextId','-1'],['kakeibo_theme','<img>']])assert.throws(()=>a.prepareBackupStore(backup({[key]:value})));});
test('partial legacy backup keeps unrelated app keys and other apps',()=>{const a=setup({kakeibo_assets:'old-assets',unrelated:'keep',kakeibo_inc:'old'});a.applyBackupStore(a.prepareBackupStore(backup({kakeibo_inc:'[]'})));assert.equal(a.m.get('kakeibo_assets'),'old-assets');assert.equal(a.m.get('unrelated'),'keep');assert.equal(a.m.get('kakeibo_inc'),'[]')});
test('unknown store keys ignored, no unexpected writes',()=>{const a=setup();a.applyBackupStore(a.prepareBackupStore(backup({kakeibo_inc:'[]',unrelated:'overwrite'})));assert.equal(a.m.has('unrelated'),false)});
test('storage failure rolls back earlier writes and newly created keys',()=>{const a=setup({kakeibo_inc:'old'},n=>n===3);assert.throws(()=>a.applyBackupStore({kakeibo_inc:'[]',kakeibo_exp:'[]',kakeibo_assets:'[]'}));assert.deepEqual([...a.m],[['kakeibo_inc','old']]);assert.equal(a.recovery(),null)});
test('rollback failure preserves original snapshot and blocks more imports',()=>{const a=setup({kakeibo_inc:'old',kakeibo_assets:'original'},n=>n>=2);assert.throws(()=>a.applyBackupStore({kakeibo_inc:'[]',kakeibo_exp:'[]'}));assert.equal(a.recovery().kakeibo_inc,'old');assert.equal(a.recovery().kakeibo_assets,'original');assert.throws(()=>a.applyBackupStore({kakeibo_inc:'[]'}));});
test('validation failure makes no write',()=>{const a=setup({kakeibo_inc:'original'});assert.throws(()=>a.prepareBackupStore(backup({kakeibo_inc:'null'})));assert.equal(a.m.get('kakeibo_inc'),'original')});
