# Offline editor assets

`codemirror.js` bundles CodeMirror 6, its Markdown language and Lezer dependencies.
`codemirror-entry.js` is the maintained export surface used by `../body.js`.
`codemirror.LICENSE` retains the bundled packages' MIT license notices. Marked and
its original license remain separate. No CDN, package manager or build step is
needed to run the panel.

## Rebuild CodeMirror

From the skill directory, use this pinned dependency set in a temporary directory:

```sh
tmp=$(mktemp -d)
npm install --prefix "$tmp" --ignore-scripts --no-package-lock \
  @codemirror/autocomplete@6.20.3 \
  @codemirror/commands@6.11.0 \
  @codemirror/lang-css@6.3.1 \
  @codemirror/lang-html@6.4.12 \
  @codemirror/lang-javascript@6.2.5 \
  @codemirror/lang-markdown@6.5.2 \
  @codemirror/language@6.12.4 \
  @codemirror/lint@6.9.7 \
  @codemirror/state@6.7.4 \
  @codemirror/view@6.43.11 \
  @lezer/common@1.5.2 \
  @lezer/css@1.3.6 \
  @lezer/highlight@1.2.3 \
  @lezer/html@1.3.13 \
  @lezer/javascript@1.5.4 \
  @lezer/lr@1.4.10 \
  @lezer/markdown@1.7.2 \
  @marijn/find-cluster-break@1.0.4 \
  crelt@1.0.7 \
  esbuild@0.28.2 \
  style-mod@4.1.3 \
  w3c-keyname@2.2.8
NODE_PATH="$tmp/node_modules" "$tmp/node_modules/.bin/esbuild" \
  panel/vendor/codemirror-entry.js --bundle --format=iife \
  --global-name=DocDokiCM --minify --outfile=panel/vendor/codemirror.js
```

When changing versions, update the pins and concatenate the upstream LICENSE files
for every bundled package into `codemirror.LICENSE` (esbuild itself is a build tool,
not part of the runtime bundle). Run the Python, state and browser selftests. Keep
node_modules, build caches and source maps outside the skill.

## Editor API references

- [CodeMirror reference](https://codemirror.net/docs/ref/): state transactions,
  decorations, atomic ranges, input/composition and history.
- [Decorations](https://codemirror.net/examples/decoration/): source-backed display
  without HTML-to-Markdown serialization.
- [Styling](https://codemirror.net/examples/styling/): editor typography and layout.
