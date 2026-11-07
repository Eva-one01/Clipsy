import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { intlLocale } from '@/i18n';
import { useT } from '@/i18n/useT';
import { formatClock, formatShortDate } from '@/lib/date';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

interface Props {
  mode: 'date' | 'time';
  value: Date;
  onChange: (d: Date) => void;
  label: string;
  use24h?: boolean;
  minimumDate?: Date;
  /** Solo escritorio: versión grande (ver DateTimeField.web.tsx). */
  large?: boolean;
}

/**
 * iOS: selector compacto nativo (se integra con el sistema).
 * Android: botón con el valor que abre el diálogo nativo de Material.
 */
export function DateTimeField({ mode, value, onChange, label, use24h = true, minimumDate }: Props) {
  const { c, isDark } = useTheme();
  useT();
  const [open, setOpen] = useState(false);

  const handle = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (e.type === 'set' && d) onChange(d);
  };

  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="compact"
        onChange={handle}
        accentColor={c.accent}
        themeVariant={isDark ? 'dark' : 'light'}
        locale={intlLocale()}
        minimumDate={minimumDate}
        accessibilityLabel={label}
      />
    );
  }

  const text =
    mode === 'date'
      ? formatShortDate(value)
      : formatClock(value, use24h);

  return (
    <View>
      <PressableScale
        onPress={() => setOpen(true)}
        accessibilityLabel={`${label}: ${text}`}
        style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm }}
      >
        <Text variant="body" tabular>
          {text}
        </Text>
      </PressableScale>
      {open && <DateTimePicker value={value} mode={mode} is24Hour={use24h} onChange={handle} minimumDate={minimumDate} />}
    </View>
  );
}
