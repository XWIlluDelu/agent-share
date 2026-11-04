const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');

async function setup(t) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'report-ink-'));
  t.after(() => fs.rm(folder, {recursive:true,force:true}));
  const clock = {time:new Date(2026, 9, 30, 3, 50).getTime(), fail:false};
  const storage = new Map();
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.time])); }
    static now() { return clock.time; }
  }
  function fileHandle(file) {
    return {kind:'file',name:path.basename(file),
      async getFile() { const data=await fs.readFile(file); return {size:data.length,text:async()=>data.toString()}; },
      async createWritable() {
        let data;
        return {async write(value) { data=value; },
          async close() { if(clock.fail) throw new Error('Disk unavailable'); await fs.writeFile(file,data); },
          async abort() {}};
      }};
  }
  function directory(folder) {
    return {kind:'directory',name:path.basename(folder),
      async queryPermission(){return 'granted';},async requestPermission(){return 'granted';},
      async getDirectoryHandle(name,{create=false}={}) {
        const target=path.join(folder,name); if(create) await fs.mkdir(target,{recursive:true});
        return directory(target);
      },
      async getFileHandle(name,{create=false}={}) {
        const file=path.join(folder,name);
        try { await fs.access(file); } catch {
          if(!create) throw Object.assign(new Error('Missing'),{name:'NotFoundError'});
          await fs.writeFile(file,'',{flag:'wx'});
        }
        return fileHandle(file);
      },
      async *entries() {for(const entry of await fs.readdir(folder,{withFileTypes:true}))
        yield [entry.name,entry.isFile()?fileHandle(path.join(folder,entry.name)):directory(path.join(folder,entry.name))];}
    };
  }
  const context = vm.createContext({window:{showDirectoryPicker:async()=>directory(folder)},Date:Clock,
    crypto:webcrypto,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    setTimeout,console,Blob,URL});
  vm.runInContext(await fs.readFile(path.join(__dirname,'../template/assets/annotation-files.js'),'utf8'),context);
  const Store=context.window.AnnotationFiles;
  return {Store,clock,storage,folder,read:async name=>JSON.parse(await fs.readFile(path.join(folder,'report',name),'utf8'))};
}
const text = () => ({anchor:{offset:12,prefix:'the quick ',suffix:'brown fox'},at:[3.2,1.1],
  color:'#c73e37',width:.15,points:[[0,1.2],[4.5,1.2]]});
const picture = () => ({size:[640,320],color:'#326fb0',width:.004,points:[[.1,.2],[.3,.4]]});
// n strokes spread over the three surfaces; count() reads them back from a record.
const ink = (n = 1) => {
  const data = {page:{}, evidence:{}, images:{}};
  for (let i = 0; i < n; i++) {
    if (i % 3 === 0) (data.page['s-intro'] ||= []).push(text());
    else if (i % 3 === 1) (data.evidence['ev-table2'] ||= []).push(text());
    else (data.images['assets/figure.svg'] ||= []).push(picture());
  }
  return data;
};
const count = record => ['page','evidence','images'].reduce((sum, k) => sum + Object.values(record[k]).flat().length, 0);


test('temporary drawing and multiple documents survive reload without folder access',async t=>{
  const {Store,clock,folder}=await setup(t);
  const store=new Store('report');
  store.begin();await store.update(ink(1));
  assert.equal(store.directory,null);
  assert.equal(store.current.bound,false);
  assert.deepEqual(await fs.readdir(folder),[]);
  const first=store.current.record.id;
  clock.time+=1000;await store.create();
  await store.update(ink(2));
  const second=store.current.record.id;
  const reopened=new Store('report');
  assert.equal(reopened.current.record.id,second);
  assert.equal(count(reopened.current.record),2);
  await reopened.move(-1);assert.equal(reopened.current.record.id,first);
  await reopened.move(1);assert.equal(reopened.current.record.id,second);
  assert.equal(reopened.neighbor(1),null);
});

test('04:00 assigns dates but never switches an open document',async t=>{
  const {Store,clock}=await setup(t);
  assert.equal(Store.day(new Date(2026,9,30,3,59)),'2026-10-29');
  assert.equal(Store.day(new Date(2026,9,30,4,0)),'2026-10-30');
  assert.equal(Store.day(new Date(2027,0,1,3,0)),'2026-12-31');
  const store=new Store('report');
  store.begin();await store.update(ink(1));
  const id=store.current.record.id;
  clock.time=new Date(2026,9,30,4,10).getTime();
  await store.update(ink(2));
  assert.equal(store.current.record.id,id);
  assert.equal(store.current.record.day,'2026-10-29');
  const reopened=new Store('report');
  assert.equal(reopened.current,null);
  assert.equal(reopened.neighbor(-1).record.id,id);
  reopened.begin();await reopened.update(ink(1));
  assert.equal(reopened.current.record.day,'2026-10-30');
});

test('Save binds only the current document; subsequent edits autosave but New remains temporary',async t=>{
  const {Store,read,clock}=await setup(t);
  const store=new Store('report');store.begin();await store.update(ink(1));
  await store.saveToFile();const filename=store.current.filename,id=store.current.record.id;
  assert.equal(store.current.bound,true);
  assert.equal(count((await read(filename))),1);
  await store.update(ink(2));
  assert.equal(count((await read(filename))),2);
  assert.equal((await read(filename)).id,id);
  clock.time+=1000;await store.create();
  assert.equal(store.current.bound,false);
  await assert.rejects(read(store.current.filename),/ENOENT/);
  await store.move(-1);await store.update(ink(0));
  assert.equal(count((await read(filename))),0);
  const reopened=new Store('report');await reopened.connect();
  assert.equal(reopened.current.record.id,id);
  assert.equal(reopened.current.bound,true);
});

test('import is a temporary independent copy; edits and later Save never overwrite the source',async t=>{
  const {Store,clock,read}=await setup(t);
  const store=new Store('report');await store.create(ink(1));await store.saveToFile();
  const source=await read(store.current.filename);
  clock.time+=1000;
  await store.import({size:100,text:async()=>JSON.stringify(source)});
  assert.equal(store.current.bound,false);
  assert.notEqual(store.current.record.id,source.id);
  assert.equal(store.current.record.source.id,source.id);
  await store.update(ink(0));await store.saveToFile();
  assert.equal(store.current.filename,'2026-10-29_02.json');
  assert.deepEqual(await read('2026-10-29_01.json'),source);
  assert.equal(count((await read('2026-10-29_02.json'))),0);
});

test('failed writes retain recovery data and can be retried after reload',async t=>{
  const {Store,clock,read}=await setup(t);
  const store=new Store('report');store.begin();await store.update(ink(1));
  clock.fail=true;await assert.rejects(store.saveToFile(),/Disk unavailable/);
  assert.equal(store.state,'error');
  clock.fail=false;
  const reopened=new Store('report');
  assert.equal(count(reopened.current.record),1);
  await reopened.connect();await reopened.flush();
  assert.notEqual(reopened.state,'error');
  assert.equal(count((await read('2026-10-29_01.json'))),1);
});

test('folder filename collisions are renamed; invalid or foreign imports leave current content alone',async t=>{
  const {Store,folder}=await setup(t);
  await fs.mkdir(path.join(folder,'report'));
  await fs.writeFile(path.join(folder,'report','2026-10-29_01.json'),'not annotations');
  const store=new Store('report');await store.create(ink(1));
  assert.equal(store.current.filename,'2026-10-29_01.json');
  await store.saveToFile();
  assert.equal(store.current.filename,'2026-10-29_02.json');
  const id=store.current.record.id;
  await assert.rejects(store.import({size:2,text:async()=>'{}'}),/supported/);
  const foreign={...store.current.record,report:'other'};
  await assert.rejects(store.import({size:100,text:async()=>JSON.stringify(foreign)}),/another report/);
  assert.equal(store.current.record.id,id);
  assert.equal(await fs.readFile(path.join(folder,'report','2026-10-29_01.json'),'utf8'),'not annotations');
});

test('consecutive edits to a file-backed document serialize writes with latest content last',async t=>{
  const {Store,read}=await setup(t);
  const store=new Store('report');await store.create();await store.saveToFile();
  await Promise.all([store.update(ink(1)),store.update(ink(2)),store.update(ink(0))]);
  await store.flush();
  assert.equal(count((await read(store.current.filename))),0);
  assert.equal(store.current.dirty,false);
});

test('temporary and disk documents merge without losing the selected temporary document',async t=>{
  const {Store,clock}=await setup(t);
  const disk=new Store('report');await disk.create(ink(1));await disk.saveToFile();
  const draft=new Store('report');clock.time+=1000;await draft.create(ink(2));
  const id=draft.current.record.id;
  await draft.connect();
  assert.equal(draft.current.record.id,id);
  assert.equal(draft.current.bound,false);
  assert.equal(draft.entries.length,2);
  await draft.move(-1);assert.equal(draft.current.bound,true);
});

test('a failed file save does not prevent creating or restoring a new temporary document',async t=>{
  const {Store,clock}=await setup(t);
  const store=new Store('report');await store.create(ink(1));
  clock.fail=true;await assert.rejects(store.saveToFile());
  clock.time+=1000;await store.create(ink(2));
  assert.notEqual(store.state,'error');
  const reopened=new Store('report');
  assert.equal(reopened.current.record.id,store.current.record.id);
  assert.equal(reopened.entries.length,2);
  await reopened.move(-1);assert.equal(reopened.state,'error');
});

test('records keep surfaces separate and reject malformed strokes',async t=>{
  const {Store,read}=await setup(t);
  const store=new Store('report');await store.create(ink(3));await store.saveToFile();
  const saved=await read(store.current.filename);
  assert.deepEqual(Object.keys(saved.page),['s-intro']);
  assert.deepEqual(Object.keys(saved.evidence),['ev-table2']);
  assert.deepEqual(Object.keys(saved.images),['assets/figure.svg']);
  const bad=[
    {...saved,page:{'s-intro':[{...text(),anchor:{offset:-1,prefix:'',suffix:''}}]}},
    {...saved,evidence:{'ev-table2':[{...text(),anchor:{...text().anchor,side:'top'}}]}},
    {...saved,images:{'assets/figure.svg':[{...picture(),size:[0,10]}]}},
    {...saved,page:[text()]}
  ];
  for (const record of bad)
    await assert.rejects(store.import({size:100,text:async()=>JSON.stringify(record)}),/Invalid annotation stroke/);
});
