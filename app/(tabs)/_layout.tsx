import { Redirect, Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';
import { SIDEBAR_WIDTH, useIsDesktop } from '@/desktop/layout';
import { useStore } from '@/store';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabsLayout() {
  const { c } = useTheme();
  const onboarded = useStore((s) => s.settings.onboarded);
  const isDesktop = useIsDesktop();

  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tabBar={(props: any) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg, paddingLeft: isDesktop ? SIDEBAR_WIDTH : 0 }, animation: 'shift' }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="lists" />
      <Tabs.Screen name="finance" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
