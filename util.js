import path from 'path';

// 去除路径末尾的斜杠（如果有）
export const removeTrailingSlash = (p) => p.endsWith(path.sep) ? p.slice(0, -1) : p;