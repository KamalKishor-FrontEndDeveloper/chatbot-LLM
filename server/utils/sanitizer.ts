export function sanitizeForLog(input: string): string {
  return input
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[<>&"']/g, (char) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#x27;'
      };
      return entities[char] || char;
    })
    .substring(0, 200);
}

export function sanitizeForOutput(input: string): string {
  return input
    .replace(/[<>&"']/g, (char) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#x27;'
      };
      return entities[char] || char;
    });
}

export function validatePath(filePath: string): string {
  const path = require('path');
  const normalized = path.normalize(filePath);
  if (normalized.includes('..') || path.isAbsolute(normalized)) {
    throw new Error('Invalid file path');
  }
  return path.basename(normalized);
}