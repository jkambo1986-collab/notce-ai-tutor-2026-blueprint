/**
 * @file cn.ts
 * @description Tiny classNames joiner used across the UI kit. Filters out falsy
 * values so conditional classes read cleanly: cn('base', active && 'on').
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
