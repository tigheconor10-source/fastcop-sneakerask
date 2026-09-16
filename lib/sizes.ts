// Convierte una talla EU (p.ej. "42", "42.5", "42 2/3") a un número para
// poder ordenarlas. adidas usa notación de tercios para algunos modelos.
export function sizeToNumber(size: string): number {
  const thirds = size.match(/^(\d+)\s+(\d)\/(\d)$/);
  if (thirds) {
    return Number(thirds[1]) + Number(thirds[2]) / Number(thirds[3]);
  }
  const n = parseFloat(size);
  return Number.isNaN(n) ? 0 : n;
}

// Ordena una lista de tallas EU de menor a mayor.
export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => sizeToNumber(a) - sizeToNumber(b));
}
