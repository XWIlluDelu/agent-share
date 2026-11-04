/* Rendered-text index: collapsed whitespace, one unit per formula, generated markers skipped.
   Offsets into this text stay meaningful when layout reflows or HTML indentation changes. */
(() => {
  const SKIP = '.ev-ref,.code-copy-button,script,style,template,svg.ink-layer';
  const ATOM = '.katex';
  const WHITE = /[ \t\n\r\f]/;
  class TextIndex {
    static ATOM = ATOM;
    constructor(root) {
      this.root = root;
      this.nodes = []; this.offsets = [];
      let text = '', space = true;
      const walk = parent => {
        for (let n = parent.firstChild; n; n = n.nextSibling) {
          if (n.nodeType === Node.TEXT_NODE) {
            const s = n.data;
            for (let i = 0; i < s.length; i++) {
              if (WHITE.test(s[i])) { if (space) continue; space = true; text += ' '; }
              else { space = false; text += s[i]; }
              this.nodes.push(n); this.offsets.push(i);
            }
          } else if (n.nodeType === Node.ELEMENT_NODE && !n.matches(SKIP)) {
            if (n.matches(ATOM)) { text += '\uFFFC'; space = false; this.nodes.push(n); this.offsets.push(-1); }
            else walk(n);
          }
        }
      };
      walk(root);
      this.text = text;
    }
    /* Unit index at a DOM caret position; positions inside a formula map to the formula. */
    indexOf(node, offset) {
      const atom = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest(ATOM);
      if (atom && this.root.contains(atom)) {
        const i = this.nodes.indexOf(atom);
        if (i >= 0) return i;
      }
      const range = document.createRange();
      range.setStart(node, offset);
      let lo = 0, hi = this.nodes.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1, n = this.nodes[mid];
        const before = this.offsets[mid] < 0 ? range.comparePoint(n.parentNode, [...n.parentNode.childNodes].indexOf(n)) : range.comparePoint(n, this.offsets[mid]);
        if (before < 0) lo = mid + 1; else hi = mid;
      }
      return lo;
    }
    element(i) {
      const n = this.nodes[i];
      return n ? (this.offsets[i] < 0 ? n : n.parentElement) : this.root;
    }
    /* Client rect of one unit, or null when it is not rendered (e.g. inside closed details). */
    rect(i) {
      const n = this.nodes[i];
      if (!n?.isConnected) return null;
      if (this.offsets[i] < 0) {
        const r = n.getBoundingClientRect();
        return r.width || r.height ? r : null;
      }
      const range = document.createRange();
      range.setStart(n, this.offsets[i]); range.setEnd(n, this.offsets[i] + 1);
      for (const r of range.getClientRects()) if (r.height) return r;
      return null;
    }
    /* DOM boundary before unit i (or after the last unit when i === length). */
    boundary(i) {
      if (i >= this.nodes.length) {
        const j = this.nodes.length - 1, n = this.nodes[j];
        if (!n) return [this.root, 0];
        return this.offsets[j] < 0 ? [n.parentNode, [...n.parentNode.childNodes].indexOf(n) + 1] : [n, this.offsets[j] + 1];
      }
      const n = this.nodes[i];
      return this.offsets[i] < 0 ? [n.parentNode, [...n.parentNode.childNodes].indexOf(n)] : [n, this.offsets[i]];
    }
    range(start, end) {
      const range = document.createRange();
      range.setStart(...this.boundary(start));
      range.setEnd(...this.boundary(end));
      return range;
    }
    /* Relocate a quoted position: exact context first, then either side alone, nearest to the old offset. */
    find({offset, prefix, suffix}) {
      const t = this.text;
      if (t.slice(Math.max(0, offset - prefix.length), offset) === prefix && t.startsWith(suffix, offset)) return offset;
      const nearest = (needle, shift) => {
        let best = -1;
        for (let i = t.indexOf(needle); i >= 0; i = t.indexOf(needle, i + 1)) {
          const at = i + shift;
          if (best < 0 || Math.abs(at - offset) < Math.abs(best - offset)) best = at;
        }
        return best;
      };
      if (prefix || suffix) {
        const both = nearest(prefix + suffix, prefix.length);
        if (both >= 0) return both;
      }
      // One side alone is accepted only when long enough to be specific.
      const after = suffix.length >= 12 ? nearest(suffix, 0) : -1;
      const before = prefix.length >= 12 ? nearest(prefix, prefix.length) : -1;
      if (after < 0 || before < 0) return Math.max(after, before);
      return Math.abs(after - offset) <= Math.abs(before - offset) ? after : before;
    }
  }
  window.TextIndex = TextIndex;
})();
