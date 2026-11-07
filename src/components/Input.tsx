import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space, type as typeScale } from '@/theme/tokens';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
  large?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(function Input({ label, hint, error, large, style, onFocus, onBlur, ...rest }, ref) {
  const { c, isDark } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="label" tone="faint" upper>
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={c.textFaint}
        selectionColor={c.accent}
        cursorColor={c.accent}
        keyboardAppearance={isDark ? 'dark' : 'light'}
        accessibilityLabel={label ?? rest.placeholder}
        maxFontSizeMultiplier={1.5}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          large ? typeScale.title : typeScale.body,
          {
            color: c.text,
            backgroundColor: large ? 'transparent' : c.surface,
            borderRadius: radius.md,
            borderWidth: large ? 0 : StyleSheet.hairlineWidth * 2,
            borderColor: error ? c.danger : focused ? c.accent : c.border,
            paddingHorizontal: large ? 0 : space.md,
            paddingVertical: large ? space.xs : space.md,
            minHeight: large ? undefined : 48,
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="faint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
