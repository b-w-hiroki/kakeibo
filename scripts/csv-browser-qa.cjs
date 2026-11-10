const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const width of [390,320]){
   const context=await browser.newContext({viewport:{width,height:844}});
   await context.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:4394/')||r.request().url().startsWith('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/')?r.continue():r.abort());
   const page=await context.newPage();await page.goto('http://127.0.0.1:4394/');
   const csv=amount=>Buffer.from('日付,内容,金額（円）,大項目,ID\n2026/11/09,合成テスト,'+amount+',食費,qa-1\n');
   async function upload(name,amount,accept){let text='';const dialog=page.waitForEvent('dialog');const upload=page.locator('#csvfile').setInputFiles({name,mimeType:'text/csv',buffer:csv(amount)});const d=await dialog;text=d.message();await (accept?d.accept():d.dismiss());await upload;return text;}
   let text=await upload('test.csv',-500,false);assert.match(text,/取引 1件/);assert.match(text,/支出 500円/);
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('kakeibo_csv')||'{}')['test.csv']===undefined);
   await upload('test.csv',-500,true);
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('kakeibo_csv')||'{}')['test.csv']?.[0]?.amt===-500);
   const saved=await page.evaluate(()=>localStorage.getItem('kakeibo_csv'));
   text=await upload('test.csv',-900,false);assert.match(text,/既存 1件を置き換え/);
   assert.equal(await page.evaluate(()=>localStorage.getItem('kakeibo_csv')),saved);
   text=await upload('other.csv',-500,false);assert.match(text,/重複の可能性：1件/);
   assert.equal(await page.evaluate(()=>localStorage.getItem('kakeibo_csv')),saved);
   const assetCSV=amount=>Buffer.from('日付,合計,現金,株式,信用,投信,年金,ポイント,その他\n2026/11/01,'+amount+',0,0,0,0,0,0,0\n2026/11/30,200,0,0,0,0,0,0,0');
   async function assetUpload(selector,amount,accept){const event=page.waitForEvent('dialog');const pending=page.locator(selector).setInputFiles({name:'assets.csv',mimeType:'text/csv',buffer:assetCSV(amount)});const d=await event;const text=d.message();await (accept?d.accept():d.dismiss());await pending;return text;}
   text=await assetUpload('#assethistfile',100,false);assert.match(text,/2行 → 1ヶ月/);
   assert.equal(await page.evaluate(()=>localStorage.getItem('kakeibo_ah')), '[]');
   await assetUpload('#csvfile',100,true);
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('kakeibo_ah'))?.[0]?.total===100);
   const oldAssets=await page.evaluate(()=>localStorage.getItem('kakeibo_ah'));
   text=await assetUpload('#assethistfile',300,false);assert.match(text,/すべて置き換え/);
   assert.equal(await page.evaluate(()=>localStorage.getItem('kakeibo_ah')),oldAssets);
   await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='kakeibo_ah')throw Error('synthetic quota');return window.originalSet.call(this,k,v);};});
   await assetUpload('#assethistfile',400,true);
   assert.equal(await page.evaluate(()=>localStorage.getItem('kakeibo_ah')),oldAssets);
   assert.equal(await page.evaluate(()=>assetHistory[0].total),100);
   await page.evaluate(()=>{Storage.prototype.setItem=window.originalSet;});
   await page.locator('#assethistfile').setInputFiles({name:'broken.csv',mimeType:'text/csv',buffer:assetCSV('invalid')});
   await page.waitForFunction(()=>document.body.textContent.includes('金額が不正'));
   assert.equal(await page.evaluate(()=>localStorage.getItem('kakeibo_ah')),oldAssets);
   assert.equal(await page.evaluate(()=>localStorage.getItem('kakeibo_csv')),saved);
   await page.screenshot({path:`asset-import-${width}.png`,fullPage:true});
   await context.close();
  }
  console.log('PASS: 390/320 CSV preview, cancel, accept, same-name cancel, duplicate cancel; assets preview/cancel/accept/replacement/duplicate/quota/malformed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
