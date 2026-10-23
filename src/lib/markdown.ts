import { Marked } from 'marked';

// Post bodies are Markdown written by members, so raw HTML is escaped rather
// than rendered, and links are limited to http(s) and mailto.
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const md = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) { return escape(text); },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      if (!/^(https?:|mailto:|\/)/i.test(href)) return label;
      const t = title ? ` title="${escape(title)}"` : '';
      return `<a href="${escape(href)}"${t} rel="nofollow ugc noopener" target="_blank">${label}</a>`;
    },
    image({ href, text }) {
      if (!/^https:/i.test(href)) return escape(text);
      return `<img src="${escape(href)}" alt="${escape(text)}" loading="lazy">`;
    },
  },
});

export function renderMarkdown(text: string): string {
  return md.parse(text, { async: false }) as string;
}
