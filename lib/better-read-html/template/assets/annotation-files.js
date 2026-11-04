/* Temporary annotation documents, with optional file-backed autosave. */
(() => {
  const FORMAT = 'report-annotations';
  const day = (date = new Date()) => {
    const d = new Date(date);
    if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  };
  /* A record holds three surfaces: page and evidence strokes are grouped by target id
     ('' is the page root) and anchored to rendered text; image strokes are grouped by image path. */
  const surfaces = ['page', 'evidence', 'images'];
  const empty = () => ({page:{}, evidence:{}, images:{}});
  const content = record => Object.fromEntries(surfaces.map(k => [k, record[k]]));
  const finite = (list, n) => Array.isArray(list) && list.length === n && list.every(Number.isFinite);
  const stroke = s => s && /^#[0-9a-f]{6}$/i.test(s.color) && Number.isFinite(s.width) && s.width > 0 &&
    Array.isArray(s.points) && s.points.length > 0 && s.points.every(p => finite(p, 2));
  const textStroke = s => stroke(s) && finite(s.at, 2) && s.anchor &&
    Number.isInteger(s.anchor.offset) && s.anchor.offset >= 0 &&
    typeof s.anchor.prefix === 'string' && typeof s.anchor.suffix === 'string' &&
    [undefined, 'left', 'right'].includes(s.anchor.side);
  const imageStroke = s => stroke(s) && s.width <= 1 && finite(s.size, 2) && s.size.every(v => v > 0);
  const groups = (value, check) => value && typeof value === 'object' && !Array.isArray(value) &&
    Object.values(value).every(list => Array.isArray(list) && list.every(check));
  function validate(record) {
    if (record?.format !== FORMAT ||
        typeof record.id !== 'string' || typeof record.report !== 'string' ||
        typeof record.name !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.day) ||
        !Number.isFinite(Date.parse(record.createdAt)) || !Number.isFinite(Date.parse(record.updatedAt)))
      throw new Error('Not a supported annotation file.');
    if (!groups(record.page, textStroke) || !groups(record.evidence, textStroke) || !groups(record.images, imageStroke))
      throw new Error('Invalid annotation stroke.');
    return record;
  }
  async function directoryCache(key, value) {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('report-annotation-folders', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('folders');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('folders', value ? 'readwrite' : 'readonly');
        const request = value ? tx.objectStore('folders').put(value, key) : tx.objectStore('folders').get(key);
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Folder access could not be remembered.'));
      });
    } finally { db.close(); }
  }
  class AnnotationFiles {
    static day = day;
    static validate = validate;
    static empty = empty;
    static content = content;
    constructor(report, onchange = () => {}) {
      if (!/^[a-z0-9_-]+$/i.test(report)) throw new Error('Invalid annotation report ID.');
      this.report = report;
      this.onchange = onchange;
      this.entries = [];
      this.filenames = new Set();
      this.handles = new Map();
      this.current = null;
      this.directory = null;
      this.queue = Promise.resolve();
      this.pending = 0;
      this.cacheError = null;
      this.storageKey = 'report-annotations:documents:' + report;
      this.restoreLocal();
    }
    get state() { return this.current?.error || this.cacheError ? 'error' : this.pending ? 'saving' : 'ready'; }
    get message() { return this.current?.error || this.cacheError || ''; }
    notify() { this.onchange(); }
    restoreLocal() {
      try {
        const saved = JSON.parse(localStorage.getItem(this.storageKey));
        for (const entry of saved?.entries || []) {
          if (/^[^/\\]+\.json$/.test(entry.filename) && validate(entry.record).report === this.report) {
            this.entries.push(entry);
            this.filenames.add(entry.filename);
          }
        }
        const today = this.sorted().filter(e => e.record.day === day());
        this.current = today.find(e => e.record.id === saved?.current) || today.at(-1) || null;
      } catch { /* Invalid cached content does not replace annotation files. */ }
    }
    cache() {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify({
          current:this.current?.record.id || null, entries:this.entries
        }));
        this.cacheError = null;
      } catch (error) { this.cacheError = 'Could not retain annotations in this browser: ' + error.message; }
      this.notify();
    }
    sorted() {
      return [...this.entries].sort((a, b) => a.record.createdAt.localeCompare(b.record.createdAt) || a.record.id.localeCompare(b.record.id));
    }
    neighbor(delta) {
      const list = this.sorted(), i = list.indexOf(this.current);
      return i < 0 ? (delta < 0 ? list.at(-1) : null) : list[i + delta] || null;
    }
    async connect(prompt = true) {
      if (this.directory) {
        if (prompt && await this.directory.queryPermission({mode:'readwrite'}) !== 'granted' &&
            await this.directory.requestPermission({mode:'readwrite'}) !== 'granted')
          throw new Error('Folder write permission was not granted.');
        return this.current?.record || null;
      }
      if (!window.showDirectoryPicker) {
        if (!prompt) return this.current?.record || null;
        throw new Error('Saving to a folder requires a browser with folder access, such as Chrome or Edge.');
      }
      let root;
      try { root = await directoryCache(this.report); } catch { /* The folder can still be chosen explicitly. */ }
      if (root) {
        const permission = await root.queryPermission({mode:'readwrite'});
        if (permission !== 'granted') {
          if (!prompt) return this.current?.record || null;
          if (await root.requestPermission({mode:'readwrite'}) !== 'granted') root = null;
        }
      }
      if (!root) {
        if (!prompt) return this.current?.record || null;
        root = await window.showDirectoryPicker({mode:'readwrite', id:'report-annotations'});
      }
      const directory = await root.getDirectoryHandle(this.report, {create:true});
      try { await directoryCache(this.report, root); } catch {}
      this.directory = directory;
      const current = this.current;
      for await (const [filename, handle] of directory.entries()) {
        this.filenames.add(filename);
        if (handle.kind !== 'file' || !filename.endsWith('.json')) continue;
        const local = this.entries.find(e => e.bound && e.filename === filename);
        try {
          const file = await handle.getFile();
          // A previous write can have failed after creating the empty target.
          if (file.size === 0 && local?.dirty) { this.handles.set(local.record.id, handle); continue; }
          if (file.size > 25 * 1024 * 1024) continue;
          const record = validate(JSON.parse(await file.text()));
          if (record.report !== this.report) continue;
          const existing = this.entries.find(e => e.record.id === record.id);
          if (existing?.bound) {
            this.handles.set(record.id, handle);
            existing.filename = filename;
            if (!existing.dirty || existing.record.updatedAt < record.updatedAt) {
              existing.record = record; existing.dirty = false; existing.error = null;
            }
          } else if (!existing) {
            this.entries.push({filename, record, bound:true, dirty:false});
            this.handles.set(record.id, handle);
          }
        } catch { /* Unrecognized files are neither loaded nor overwritten. */ }
      }
      this.current = current || this.sorted().filter(e => e.record.day === day()).at(-1) || null;
      this.cache();
      for (const entry of this.entries) if (entry.bound && entry.dirty) this.write(entry);
      return this.current?.record || null;
    }
    availableName(date) {
      let number = 1, filename;
      do { filename = date + '_' + String(number++).padStart(2, '0') + '.json'; }
      while (this.filenames.has(filename));
      return filename;
    }
    begin(data = empty(), source = null) {
      const date = day();
      const latest = Math.max(0, ...this.entries.map(e => Date.parse(e.record.createdAt)));
      const timestamp = new Date(Math.max(Date.now(), latest + 1)).toISOString();
      const filename = this.availableName(date);
      this.filenames.add(filename);
      const record = {format:FORMAT, report:this.report, id:crypto.randomUUID(),
        name:filename.slice(0, -5), day:date, createdAt:timestamp, updatedAt:timestamp, ...content(data)};
      if (source) record.source = {id:source.id, name:source.name, report:source.report, createdAt:source.createdAt};
      this.current = {filename, record, bound:false, dirty:false};
      this.entries.push(this.current);
      this.cache();
      return record;
    }
    async create(data = empty(), source = null) {
      await this.queue;
      return this.begin(data, source);
    }
    async import(file) {
      if (file.size > 25 * 1024 * 1024) throw new Error('Annotation file is too large.');
      const source = validate(JSON.parse(await file.text()));
      if (source.report !== this.report) throw new Error('This annotation file belongs to another report.');
      return this.create(content(source), source);
    }
    async move(delta) {
      await this.queue;
      const next = this.neighbor(delta);
      if (next) this.current = next;
      this.cache();
      return this.current?.record || null;
    }
    update(data) {
      if (!this.current) throw new Error('No annotation document is open.');
      const entry = this.current;
      Object.assign(entry.record, content(data));
      entry.record.updatedAt = new Date(Math.max(Date.now(), Date.parse(entry.record.updatedAt) + 1)).toISOString();
      entry.dirty = true;
      this.cache();
      return entry.bound ? this.write(entry) : Promise.resolve();
    }
    async saveToFile() {
      if (!this.current) return;
      await this.queue;
      const entry = this.current;
      try {
        await this.connect();
        if (!entry.bound) {
          // A temporary name may already exist in the folder, or in another browser.
          let collision = false;
          try { await this.directory.getFileHandle(entry.filename); collision = true; }
          catch (error) { if (error.name !== 'NotFoundError') throw error; }
          if (collision) {
            entry.filename = this.availableName(entry.record.day);
            entry.record.name = entry.filename.slice(0, -5);
            this.filenames.add(entry.filename);
          }
          entry.bound = true;
        }
        entry.dirty = true;
        this.cache();
        await this.write(entry);
        if (entry.error) throw new Error(entry.error);
      } catch (error) {
        if (error.name !== 'AbortError') {
          entry.error = error.message; this.cache();
        }
        throw error;
      }
    }
    write(entry) {
      const snapshot = JSON.stringify(entry.record), filename = entry.filename;
      this.pending++; this.notify();
      const write = this.queue.then(async () => {
        let stream;
        try {
          if (!this.directory) throw new Error('Use Save to restore folder access.');
          let handle = this.handles.get(entry.record.id);
          if (!handle) {
            try {
              handle = await this.directory.getFileHandle(filename);
              const existing = JSON.parse(await (await handle.getFile()).text());
              if (existing.id !== entry.record.id) throw new Error('Filename belongs to another annotation document.');
            } catch (error) {
              if (error.name !== 'NotFoundError') throw error;
              handle = await this.directory.getFileHandle(filename, {create:true});
            }
            this.handles.set(entry.record.id, handle);
          }
          stream = await handle.createWritable();
          await stream.write(snapshot + '\n');
          await stream.close(); stream = null;
          entry.error = null;
          if (JSON.stringify(entry.record) === snapshot) entry.dirty = false;
        } catch (error) {
          if (stream) { try { await stream.abort(); } catch {} }
          entry.error = 'Not saved: ' + error.message;
        } finally {
          this.pending--;
          this.cache();
        }
      });
      this.queue = write;
      return write;
    }
    async flush() {
      await this.queue;
      if (this.current?.error) throw new Error(this.current.error);
    }
    export() {
      if (!this.current) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(this.current.record, null, 2) + '\n'], {type:'application/json'}));
      const link = document.createElement('a');
      link.href = url; link.download = this.current.record.name + '.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  window.AnnotationFiles = AnnotationFiles;
})();
