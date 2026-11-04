/* Copy code source and preserve LaTeX when copying rendered mathematics.
 * The formula-boundary projection follows Inspire's rich-text-copy approach. */
document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('main');
  function mathBoundary(node) {
    const element = node instanceof Element ? node : node.parentElement;
    const math = element?.closest('.katex, .katex-display');
    if (!math || !root.contains(math)) return null;
    return math.closest('.katex-display') || math;
  }
  function displaySource(source) {
    return '$$\n' + source.replace(/^\s*\n|\n\s*$/g, '') + '\n$$';
  }
  root.addEventListener('copy', event => {
    const selection = window.getSelection();
    if (!event.clipboardData || !selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0).cloneRange();
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
    const start = mathBoundary(range.startContainer), end = mathBoundary(range.endContainer);
    if (start) range.setStartBefore(start);
    if (end) range.setEndAfter(end);
    const fragment = range.cloneContents();
    if (!fragment.querySelector('.katex-mathml annotation')) return;
    const rich = document.createElement('div');
    rich.append(fragment.cloneNode(true));
    for (const math of [...fragment.querySelectorAll('.katex')]) {
      const source = math.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
      if (source == null) continue;
      const display = math.closest('.katex-display');
      const text = display ? displaySource(source) : '$' + source + '$';
      (display || math).replaceWith(document.createTextNode(text));
    }
    fragment.querySelectorAll('.code-copy-button').forEach(button => button.remove());
    event.clipboardData.setData('text/plain', fragment.textContent || '');
    event.clipboardData.setData('text/html', rich.innerHTML);
    event.preventDefault();
  });

  async function writeText(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch { /* Local-file browsers may require the legacy copy gesture. */ }
    const active = document.activeElement, selection = window.getSelection();
    const ranges = Array.from({length: selection.rangeCount}, (_, i) => selection.getRangeAt(i).cloneRange());
    const field = document.createElement('textarea');
    field.value = text;
    field.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.append(field);
    field.select();
    let copied;
    try { copied = document.execCommand('copy'); }
    finally {
      field.remove();
      active?.focus({preventScroll:true});
      selection.removeAllRanges();
      ranges.forEach(range => selection.addRange(range));
    }
    if (!copied) throw new Error('Clipboard access unavailable');
  }

  const copyIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>';
  const checkIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  for (const pre of root.querySelectorAll('pre.code-block')) {
    const code = pre.querySelector('code');
    if (!code) continue;
    const wrapper = document.createElement('div');
    wrapper.className = 'code-copy-wrap';
    pre.before(wrapper);
    wrapper.append(pre);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy-button';
    const label = value => { button.title = value; button.setAttribute('aria-label', value); };
    label('Copy code');
    button.innerHTML = copyIcon;
    wrapper.append(button);
    let reset;
    button.addEventListener('click', async () => {
      clearTimeout(reset);
      button.disabled = true;
      try {
        await writeText(code.textContent);
        label('Copied');
        button.innerHTML = checkIcon;
      } catch {
        label('Copy failed — select the code and copy manually');
        button.textContent = '!';
      } finally {
        button.disabled = false;
        reset = setTimeout(() => { label('Copy code'); button.innerHTML = copyIcon; }, 1800);
      }
    });
  }
});
