export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

export function hasMeaningfulChange(
  current: string,
  previous: string,
  wordThreshold: number,
): boolean {
  const currentWords = countWords(current);
  const previousWords = countWords(previous);
  return currentWords - previousWords >= wordThreshold;
}

export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
