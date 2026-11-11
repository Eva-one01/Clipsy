import { useRef, useState, type RefObject } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useT } from '@/i18n/useT';
import { monthNames } from '@/lib/date';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';
import { Text } from './Text';
import { Icon, IconButton } from './ui';

type Open = { kind: 'month' | 'year'; x: number; y: number } | null;

/**
 * Título de la agenda: «Noviembre ⌄ 2026 ⌄». Cada parte abre una ventanita pequeña justo debajo
 * (sin mover nada de la pantalla) para elegir el mes o el año.
 */
export function MonthYearTitle({ month, year, onChange }: { month: number; year: number; onChange: (year: number, month: number) => void }) {
  const { c } = useTheme();
  const { t } = useT();
  const [open, setOpen] = useState<Open>(null);
  const [page, setPage] = useState(year); // primer año de la página de años (de 12 en 12)
  const monthRef = useRef<View>(null);
  const yearRef = useRef<View>(null);
  const now = new Date();

  const show = (kind: 'month' | 'year') => {
    const ref = kind === 'month' ? monthRef : yearRef;
    ref.current?.measureInWindow((x, y, _w, h) => {
      if (kind === 'year') setPage(year);
      setOpen({ kind, x, y: y + h + 6 });
    });
  };
  // Página de años: el elegido queda en la segunda fila.
  const firstYear = open?.kind === 'year' ? page - 4 : 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
      <Part refObj={monthRef} label={monthNames('long')[month]} onPress={() => show('month')} open={open?.kind === 'month'} hint={t('cal.pickMonth')} />
      <Part refObj={yearRef} label={String(year)} onPress={() => show('year')} open={open?.kind === 'year'} hint={t('cal.pickYear')} muted />

      {open ? (
        <Modal transparent visible animationType="none" onRequestClose={() => setOpen(null)}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(null)} accessibilityLabel={t('common.close')} />
          <Animated.View
            entering={FadeIn.duration(motion.fast)}
            style={[styles.pop, { left: open.x, top: open.y, backgroundColor: c.elevated, borderColor: c.borderStrong }]}
          >
            {open.kind === 'month' ? (
              <View style={styles.grid}>
                {monthNames('short').map((name, m) => {
                  const cur = m === month;
                  const isNow = year === now.getFullYear() && m === now.getMonth();
                  return (
                    <Pressable
                      key={m}
                      onPress={() => {
                        onChange(year, m);
                        setOpen(null);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: cur }}
                      style={(s) => [styles.cell, { backgroundColor: cur ? c.accent : (s as { hovered?: boolean }).hovered ? c.surfaceAlt : 'transparent', borderColor: isNow && !cur ? c.accent : 'transparent' }]}
                    >
                      <Text variant="bodyStrong" style={{ color: cur ? c.onAccent : isNow ? c.accent : c.text }}>
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <>
                <View style={styles.head}>
                  <IconButton icon="chevron-left" label={t('cal.prevYear')} size={30} onPress={() => setPage((p) => p - 12)} />
                  <Text variant="caption" tone="muted" tabular>
                    {firstYear} – {firstYear + 11}
                  </Text>
                  <IconButton icon="chevron-right" label={t('cal.nextYear')} size={30} onPress={() => setPage((p) => p + 12)} />
                </View>
                <View style={styles.grid}>
                  {Array.from({ length: 12 }, (_, i) => firstYear + i).map((y) => {
                    const cur = y === year;
                    const isNow = y === now.getFullYear();
                    return (
                      <Pressable
                        key={y}
                        onPress={() => {
                          onChange(y, month);
                          setOpen(null);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: cur }}
                        style={(s) => [styles.cell, { backgroundColor: cur ? c.accent : (s as { hovered?: boolean }).hovered ? c.surfaceAlt : 'transparent', borderColor: isNow && !cur ? c.accent : 'transparent' }]}
                      >
                        <Text variant="bodyStrong" tabular style={{ color: cur ? c.onAccent : isNow ? c.accent : c.text }}>
                          {y}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </Animated.View>
        </Modal>
      ) : null}
    </View>
  );
}

function Part({ refObj, label, onPress, open, hint, muted }: { refObj: RefObject<View | null>; label: string; onPress: () => void; open: boolean; hint: string; muted?: boolean }) {
  const { c } = useTheme();
  return (
    <View ref={refObj} collapsable={false}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label} · ${hint}`}
        accessibilityState={{ expanded: open }}
        style={(s) => [styles.part, { backgroundColor: open || (s as { hovered?: boolean }).hovered ? c.surfaceAlt : 'transparent' }]}
      >
        <Text variant="display" accessibilityRole="header" numberOfLines={1} style={muted ? { color: c.textMuted } : undefined}>
          {label}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={c.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  part: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, marginHorizontal: -6, borderRadius: radius.md },
  pop: {
    position: 'absolute',
    width: 280,
    padding: space.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.33%', height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1 },
});
