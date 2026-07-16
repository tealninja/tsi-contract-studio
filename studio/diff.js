/* ============================================================
   TSI Contract Studio — diff engine
   diff.js

   A compact, dependency-free word-level diff for comparing a stub
   against its previous library version (spec Module 2). Uses an
   LCS over word/whitespace tokens and renders inline insert/delete
   markup into the .diff-ins / .diff-del spans defined in studio.css.

   Purpose-built and self-contained rather than vendoring Google's
   diff-match-patch, so it is auditable in one screen and has no
   external file to keep in sync. Exposes window.TSIDiff.

   API:
     TSIDiff.diffWords(oldText, newText) -> [[op, text], ...]
        op: -1 delete (in old only), 0 equal, 1 insert (in new only)
     TSIDiff.renderInline(oldText, newText) -> HTML string
     TSIDiff.htmlToText(html) -> plain text (strips tags/entities)
   ============================================================ */
(function () {
  'use strict';

  // Tokenize into words and whitespace runs so reconstruction keeps
  // the original spacing and line breaks intact.
  function tokenize(s) {
    return String(s == null ? '' : s).match(/\s+|[^\s]+/g) || [];
  }

  // Longest common subsequence over token arrays (classic DP).
  // Stub versions are small; O(n*m) is comfortably fine.
  function lcsDiff(a, b) {
    const n = a.length, m = b.length;
    // DP table of LCS lengths.
    const dp = new Array(n + 1);
    for (let i = 0; i <= n; i++) dp[i] = new Int32Array(m + 1);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    // Walk the table to emit ops.
    const ops = [];
    let i = 0, j = 0;
    function push(op, text) {
      const last = ops[ops.length - 1];
      if (last && last[0] === op) last[1] += text;
      else ops.push([op, text]);
    }
    while (i < n && j < m) {
      if (a[i] === b[j]) { push(0, a[i]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { push(-1, a[i]); i++; }
      else { push(1, b[j]); j++; }
    }
    while (i < n) { push(-1, a[i]); i++; }
    while (j < m) { push(1, b[j]); j++; }
    return ops;
  }

  const DIFF = {};

  DIFF.diffWords = function (oldText, newText) {
    return lcsDiff(tokenize(oldText), tokenize(newText));
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  DIFF.renderInline = function (oldText, newText) {
    const ops = DIFF.diffWords(oldText, newText);
    return ops.map(function (o) {
      const t = esc(o[1]);
      if (o[0] === 1) return '<span class="diff-ins">' + t + '</span>';
      if (o[0] === -1) return '<span class="diff-del">' + t + '</span>';
      return '<span class="diff-eq">' + t + '</span>';
    }).join('');
  };

  // Count of changed (inserted + deleted) tokens — used for a quick
  // "N changes" summary in the stub manager.
  DIFF.changeCount = function (oldText, newText) {
    const ops = DIFF.diffWords(oldText, newText);
    let ins = 0, del = 0;
    ops.forEach(function (o) {
      const words = (o[1].match(/[^\s]+/g) || []).length;
      if (o[0] === 1) ins += words; else if (o[0] === -1) del += words;
    });
    return { insertions: ins, deletions: del, total: ins + del };
  };

  // Strip HTML down to readable text for diffing rendered stub bodies.
  DIFF.htmlToText = function (html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    // Drop editorial annotations so diffs compare substantive text only.
    tmp.querySelectorAll('.draft-note, .int-note, .atty-note, .open-issue, script, style')
      .forEach(function (el) { el.remove(); });
    const text = tmp.textContent || '';
    return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  window.TSIDiff = DIFF;
})();
