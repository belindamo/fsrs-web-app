/**
 * Lightweight Markdown renderer for flashcard content.
 * No external dependencies. Handles the subset of Markdown
 * that matters for flashcards: code blocks, inline code,
 * bold, italic, lists, blockquotes, and line breaks.
 */
const Markdown = (() => {

  /**
   * Escape HTML entities to prevent XSS, but preserve
   * our own markdown-generated tags afterward.
   */
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Render inline markdown (bold, italic, code, links).
   * Assumes HTML is already escaped.
   */
  function renderInline(text) {
    // Inline code (must come first to protect contents)
    text = text.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

    // Bold + italic ***text*** or ___text___
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

    // Bold **text** or __text__
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic *text* or _text_ (but not inside words for _)
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    text = text.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');

    // Strikethrough ~~text~~
    text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');

    return text;
  }

  /**
   * Render a full markdown string to HTML.
   *
   * Supports:
   * - Fenced code blocks (```lang ... ```)
   * - Inline code (`code`)
   * - Bold (**text**), italic (*text*)
   * - Unordered lists (- item, * item)
   * - Ordered lists (1. item)
   * - Blockquotes (> text)
   * - Headings (## text) — rendered as bold with size
   * - Horizontal rules (---, ***)
   * - Line breaks
   */
  function render(src) {
    if (!src) return '';

    const lines = src.split('\n');
    const output = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // --- Fenced code block ---
      if (line.trimStart().startsWith('```')) {
        const lang = line.trimStart().slice(3).trim();
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
          codeLines.push(escapeHtml(lines[i]));
          i++;
        }
        i++; // skip closing ```
        const langAttr = lang ? ` data-lang="${escapeHtml(lang)}"` : '';
        const langLabel = lang ? `<span class="md-code-lang">${escapeHtml(lang)}</span>` : '';
        output.push(`<div class="md-code-block"${langAttr}>${langLabel}<pre><code>${codeLines.join('\n')}</code></pre></div>`);
        continue;
      }

      // --- Horizontal rule ---
      if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
        output.push('<hr class="md-hr">');
        i++;
        continue;
      }

      // --- Heading ---
      const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = renderInline(escapeHtml(headingMatch[2]));
        output.push(`<div class="md-h md-h${level}">${text}</div>`);
        i++;
        continue;
      }

      // --- Blockquote ---
      if (line.trimStart().startsWith('&gt;') || line.trimStart().startsWith('>')) {
        const quoteLines = [];
        while (i < lines.length) {
          const ql = lines[i];
          if (ql.trimStart().startsWith('>')) {
            quoteLines.push(ql.trimStart().replace(/^>\s?/, ''));
            i++;
          } else {
            break;
          }
        }
        const inner = quoteLines.map(l => renderInline(escapeHtml(l))).join('<br>');
        output.push(`<blockquote class="md-blockquote">${inner}</blockquote>`);
        continue;
      }

      // --- Unordered list ---
      if (/^\s*[-*+]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          const text = lines[i].replace(/^\s*[-*+]\s+/, '');
          items.push(`<li>${renderInline(escapeHtml(text))}</li>`);
          i++;
        }
        output.push(`<ul class="md-list">${items.join('')}</ul>`);
        continue;
      }

      // --- Ordered list ---
      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          const text = lines[i].replace(/^\s*\d+\.\s+/, '');
          items.push(`<li>${renderInline(escapeHtml(text))}</li>`);
          i++;
        }
        output.push(`<ol class="md-list">${items.join('')}</ol>`);
        continue;
      }

      // --- Blank line ---
      if (line.trim() === '') {
        i++;
        continue;
      }

      // --- Paragraph ---
      const paraLines = [];
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].trimStart().startsWith('```')
        && !lines[i].trimStart().startsWith('#') && !lines[i].trimStart().startsWith('>')
        && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])
        && !/^(\s*[-*_]\s*){3,}$/.test(lines[i])) {
        paraLines.push(renderInline(escapeHtml(lines[i])));
        i++;
      }
      if (paraLines.length > 0) {
        output.push(`<p class="md-p">${paraLines.join('<br>')}</p>`);
      }
    }

    return output.join('');
  }

  /**
   * Check if a string contains any markdown syntax.
   * Used to decide whether to render as markdown or plain text.
   */
  function hasMarkdown(str) {
    if (!str) return false;
    return /```|`[^`]+`|\*\*|__|\*[^*]+\*|^#{1,4}\s|^>\s|^\s*[-*+]\s|^\s*\d+\.\s|^---\s*$|^\*\*\*\s*$/m.test(str);
  }

  return { render, escapeHtml, hasMarkdown };
})();

if (typeof module !== 'undefined') module.exports = Markdown;
