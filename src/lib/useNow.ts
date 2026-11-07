import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Devuelve la hora actual y se re-renderiza en cada cambio de minuto
 * (o de segundo si `seconds`), alineado al reloj y pausado en segundo plano.
 */
export function useNow(seconds = false): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const step = seconds ? 1000 : 60_000;

    const tick = () => {
      const d = new Date();
      setNow(d);
      const delay = step - (d.getTime() % step) + 20;
      timer = setTimeout(tick, delay);
    };
    tick();

    const sub = AppState.addEventListener('change', (s) => {
      clearTimeout(timer);
      if (s === 'active') tick();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [seconds]);

  return now;
}
