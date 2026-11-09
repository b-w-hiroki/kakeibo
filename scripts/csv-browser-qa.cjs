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
   await context.close();
  }
  console.log('PASS: 390/320 CSV preview, cancel, accept, same-name cancel, duplicate cancel');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
