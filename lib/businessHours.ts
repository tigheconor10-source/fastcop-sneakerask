// Añade `hours` horas LABORABLES a `start`, saltándose por completo los
// sábados y domingos - se usa para calcular el plazo de envío de 48h: si
// una venta entra el viernes a las 15:00, el contador "se pausa" durante
// el fin de semana y sigue contando el lunes.
//
// Implementación simple: avanza hora a hora y solo descuenta del contador
// las horas que caen en día laborable (lun-vie). Para 48h esto son como
// máximo ~96 iteraciones incluso si cae sobre dos findes - trivial en coste.
export function addBusinessHours(start: Date, hours: number): Date {
  let remaining = hours;
  let current = new Date(start.getTime());

  while (remaining > 0) {
    current = new Date(current.getTime() + 60 * 60 * 1000); // +1h
    const day = current.getDay(); // 0 = domingo, 6 = sábado
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return current;
}
