import { router } from 'expo-router';
import { View } from 'react-native';
import { t } from '@/i18n';
import { showDialog } from '@/lib/dialog';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { space, tagColors } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { Button, Icon } from './ui';

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }} accessibilityRole="radiogroup">
      {tagColors.map((col) => {
        const sel = col === value;
        return (
          <PressableScale
            key={col}
            onPress={() => {
              haptic.tap();
              onChange(col);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={`${t('form.color')} ${tagColors.indexOf(col) + 1}`}
            scaleTo={0.85}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: col,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: sel ? 2 : 0,
              borderColor: c.text,
            }}
          >
            {sel && <Icon name="check" size={16} color="#0A0A0B" />}
          </PressableScale>
        );
      })}
    </View>
  );
}

export function DeleteButton({ label, confirm, onDelete }: { label: string; confirm: string; onDelete: () => void | Promise<void> }) {
  return (
    <View style={{ marginTop: space.md }}>
      <Button
        title={label}
        variant="danger"
        icon="trash-2"
        full
        onPress={() => {
          haptic.warning();
          showDialog(label, confirm, [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.delete'),
              style: 'destructive',
              onPress: async () => {
                await onDelete();
                if (router.canGoBack()) router.back();
              },
            },
          ]);
        }}
      />
    </View>
  );
}

export function FieldLabel({ children }: { children: string }) {
  return (
    <Text variant="label" tone="faint" upper style={{ marginBottom: space.sm }}>
      {children}
    </Text>
  );
}
