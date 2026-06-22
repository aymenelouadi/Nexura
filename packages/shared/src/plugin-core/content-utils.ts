const MAX_CONTENT_LENGTH = 1_000;
const SECRET_PATTERNS = [
  /[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/gu,
  /bearer\s+[a-zA-Z0-9_\-.]+/giu,
  /api[_-]?key[:=]\s*[a-zA-Z0-9_\-.]+/giu,
  /password[:=]\s*\S+/giu,
  /token[:=]\s*[a-zA-Z0-9_\-.]+/giu,
  /postgres(?:ql)?:\/\/[^\s]+/giu,
  /mongodb:\/\/[^\s]+/giu,
];

export function sanitizeContent(content: string | undefined): string {
  if (!content) return 'Content unavailable';
  let sanitized = content;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  if (sanitized.length > MAX_CONTENT_LENGTH) {
    sanitized = `${sanitized.slice(0, MAX_CONTENT_LENGTH)}…`;
  }
  return sanitized || 'Content unavailable';
}

export function resolveTemplateString(
  template: string,
  resolve: (name: string) => string | undefined,
): string {
  return template.replace(/\[([A-Za-z][A-Za-z0-9_.]*)\]/gu, (_match, name: string) => {
    const value = resolve(name);
    return value ?? _match;
  });
}

export function formatTimestamp(): string {
  return new Date().toISOString();
}
