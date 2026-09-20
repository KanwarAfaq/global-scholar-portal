const ALLOWED_TAGS = new Set(['P','BR','STRONG','B','EM','I','U','H1','H2','H3','H4','UL','OL','LI','BLOCKQUOTE','A','CODE','PRE','HR','SPAN']);
const ALLOWED_ATTRS = new Set(['href','target','rel','class']);

export function sanitizeRichHtml(value = '') {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return String(value).replace(/<[^>]*>/g, '');
  const doc = new DOMParser().parseFromString(String(value), 'text/html');
  const cleanNode = (node) => {
    [...node.children].forEach((el) => {
      if (!ALLOWED_TAGS.has(el.tagName)) {
        cleanNode(el);
        el.replaceWith(...el.childNodes);
        return;
      }
      [...el.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (!ALLOWED_ATTRS.has(name) || name.startsWith('on')) el.removeAttribute(attr.name);
      });
      if (el.tagName === 'A') {
        const href = el.getAttribute('href') || '';
        if (!/^(https?:|mailto:|\/)/i.test(href)) el.removeAttribute('href');
        el.setAttribute('rel', 'noopener noreferrer nofollow');
        if (el.getAttribute('target') !== '_self') el.setAttribute('target', '_blank');
      }
      cleanNode(el);
    });
  };
  cleanNode(doc.body);
  return doc.body.innerHTML;
}
