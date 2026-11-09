import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AccentPicker } from '@/components/AccentPicker';
import { Input } from '@/components/Input';
import { PermissionBanner } from '@/components/PermissionBanner';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { Card, Chip, Divider, Icon, IconButton, ListRow, SectionHeader, Toggle } from '@/components/ui';
import { desktop, voiceKeysLabel, type VoiceState } from '@/desktop/bridge';
import { useDesktopState } from '@/desktop/licensing';
import { disableSync, syncNow, useSync } from '@/desktop/sync';
import { ShortcutsCard } from '@/components/Shortcuts';
import { languages } from '@/i18n';
import { useT } from '@/i18n/useT';
import { exportBackup, pickBackup, pickTextFile } from '@/lib/backup';
import { parseIcs } from '@/lib/ics';
import { formatDateTime, formatLongDate } from '@/lib/date';
import { showDialog } from '@/lib/dialog';
import { currencies, formatMoney, parseAmount } from '@/lib/money';
import { useStore } from '@/store';
import type { ThemePref } from '@/store/types';
import { useTheme } from '@/theme/ThemeProvider';
import { space, tagColors } from '@/theme/tokens';

export default function SettingsScreen() {
  const { c } = useTheme();
  const { t } = useT();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const resetAll = useStore((s) => s.resetAll);
  const [budgetText, setBudgetText] = useState(settings.monthlyBudget ? String(settings.monthlyBudget) : '');

  const importData = useStore((s) => s.importData);

  const exportData = async () => {
    try {
      await exportBackup();
    } catch {
      showDialog(t('set.export'), t('backup.exportFailed'));
    }
  };

  const restoreData = async () => {
    const res = await pickBackup().catch(() => ({ status: 'invalid' as const }));
    if (res.status === 'canceled') return;
    if (res.status === 'invalid') {
      showDialog(t('set.import'), t('backup.invalid'));
      return;
    }
    const date = res.exportedAt ? formatLongDate(res.exportedAt) : '—';
    showDialog(t('backup.confirmTitle'), t('backup.confirmBody', { date, n: res.count }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('backup.confirm'),
        style: 'destructive',
        onPress: async () => {
          await importData(res.data);
          setBudgetText(useStore.getState().settings.monthlyBudget ? String(useStore.getState().settings.monthlyBudget) : '');
          showDialog(t('backup.restored'));
        },
      },
    ]);
  };

  const importIcs = async () => {
    const text = await pickTextFile('.ics,text/calendar', ['text/calendar', 'application/octet-stream', 'text/plain']).catch(() => null);
    if (text === null) return;
    const res = text.includes('BEGIN:VCALENDAR') ? parseIcs(text, tagColors[1] ?? tagColors[0]) : null;
    if (!res || res.events.length === 0) {
      showDialog(t('ics.title'), res ? t('ics.empty') : t('ics.invalid'));
      return;
    }
    showDialog(t('ics.confirmTitle', { n: res.events.length }), [res.simplified ? t('ics.simplified', { n: res.simplified }) : '', res.skippedOld ? t('ics.old', { n: res.skippedOld }) : '', t('ics.confirmBody')].filter(Boolean).join('\n\n'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('ics.confirm'),
        onPress: () => {
          const n = useStore.getState().importEvents(res.events);
          showDialog(t('ics.done', { n }), n < res.events.length ? t('ics.dupes', { n: res.events.length - n }) : undefined);
        },
      },
    ]);
  };

  const confirmReset = () => {
    showDialog(t('set.reset'), t('set.resetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('set.resetConfirm'),
        style: 'destructive',
        onPress: async () => {
          await resetAll();
          router.dismissAll?.();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <Screen title={t('set.title')} leading={<IconButton icon="chevron-left" label={t('common.back')} onPress={() => router.back()} />}>
      <PermissionBanner />

      <SectionHeader title={t('set.language')} />
      <Card padded={false}>
        {languages.map((l, i) => {
          const sel = settings.language === l.code;
          return (
            <View key={l.code}>
              {i > 0 && <Divider inset={space.lg} />}
              <ListRow
                title={l.native}
                onPress={() => {
                  if (sel) return;
                  setSettings({ language: l.code });
                }}
                right={sel ? <Icon name="check" size={18} color={c.accent} /> : <View style={{ width: 18 }} />}
              />
            </View>
          );
        })}
      </Card>

      <SectionHeader title={t('set.appearance')} />
      <Segmented<ThemePref>
        value={settings.theme}
        onChange={(v) => setSettings({ theme: v })}
        options={[
          { value: 'system', label: t('set.system') },
          { value: 'light', label: t('set.light') },
          { value: 'dark', label: t('set.dark') },
        ]}
      />
      <Card style={{ marginTop: space.md, gap: space.sm }}>
        <Text variant="label" tone="faint" upper>
          {t('set.accent')}
        </Text>
        <AccentPicker />
      </Card>

      <SectionHeader title={t('set.prefs')} />
      <Card padded={false}>
        <ListRow icon="clock" title={t('set.h24')} right={<Toggle value={settings.use24h} onChange={(v) => setSettings({ use24h: v })} label={t('set.h24')} />} />
        <Divider inset={58} />
        <ListRow
          icon="calendar"
          title={t('set.monday')}
          right={<Toggle value={settings.weekStartsMonday} onChange={(v) => setSettings({ weekStartsMonday: v })} label={t('set.monday')} />}
        />
      </Card>

      {desktop && <DesktopSection />}

      {desktop && (
        <>
          <SectionHeader title={t('desk.shortcuts')} />
          <ShortcutsCard />
        </>
      )}

      <SectionHeader title={t('set.finance')} />
      <Card style={{ gap: space.lg }}>
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="faint" upper>
            {t('set.currency')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {currencies.map((cur) => (
              <Chip key={cur.code} label={cur.code} selected={settings.currency === cur.code} onPress={() => setSettings({ currency: cur.code })} />
            ))}
          </View>
        </View>
        <Input
          label={t('set.budget')}
          placeholder={t('set.budgetPh')}
          keyboardType="decimal-pad"
          value={budgetText}
          onChangeText={(v) => {
            // Se guarda al escribir: en escritorio (web) onEndEditing no se dispara,
            // así que el valor no llegaba a guardarse al pulsar Enter o salir.
            setBudgetText(v);
            const n = parseAmount(v);
            setSettings({ monthlyBudget: Number.isFinite(n) && n > 0 ? n : 0 });
          }}
          returnKeyType="done"
          hint={settings.monthlyBudget > 0 ? t('set.budgetCurrent', { x: formatMoney(settings.monthlyBudget, settings.currency) }) : t('set.budgetHint')}
        />
      </Card>

      <SectionHeader title={t('set.data')} />
      <Card padded={false}>
        <ListRow icon="upload" title={t('set.export')} subtitle={t('set.exportSub')} onPress={exportData} />
        <Divider inset={58} />
        <ListRow icon="download" title={t('set.import')} subtitle={t('set.importSub')} onPress={restoreData} />
        <Divider inset={58} />
        <ListRow icon="calendar" title={t('ics.title')} subtitle={t('ics.sub')} onPress={importIcs} />
        <Divider inset={58} />
        <ListRow icon="shield" title={t('more.legal')} onPress={() => router.push('/legal')} />
        <Divider inset={58} />
        <ListRow icon="trash-2" title={t('set.reset')} danger onPress={confirmReset} chevron={false} />
      </Card>
      <Text variant="caption" tone="faint" style={{ marginTop: space.md }}>
        {t('set.footer')}
      </Text>
    </Screen>
  );
}

/** Solo en la app de escritorio: arranque con el sistema y aviso sobre la bandeja. */
function DesktopSection() {
  const { t } = useT();
  const [openAtLogin, setOpenAtLogin] = useState(false);

  useEffect(() => {
    desktop?.getOpenAtLogin().then(setOpenAtLogin).catch(() => undefined);
  }, []);

  return (
    <>
      <SectionHeader title={t('desk.section')} />
      <Card padded={false}>
        <ListRow
          icon="power"
          title={t('desk.login')}
          subtitle={t('desk.loginSub')}
          right={
            <Toggle
              value={openAtLogin}
              label={t('desk.login')}
              onChange={async (v) => {
                setOpenAtLogin(v);
                const real = await desktop?.setOpenAtLogin(v).catch(() => !v);
                if (typeof real === 'boolean') setOpenAtLogin(real);
              }}
            />
          }
        />
        {desktop?.openMini ? (
          <>
            <Divider inset={58} />
            <ListRow icon="sidebar" title={t('desk.sc.mini')} subtitle={t('desk.miniSub')} onPress={() => desktop?.openMini?.()} />
          </>
        ) : null}
        {desktop?.voice ? <VoiceRows /> : null}
      </Card>
      <Text variant="caption" tone="faint" style={{ marginTop: space.md }}>
        {desktop?.platform === 'darwin' ? t('desk.trayNoteMac') : t('desk.trayNote')}
      </Text>
      {desktop?.sync ? <SyncSection /> : null}
      {desktop?.license ? <LicenseSection /> : null}
    </>
  );
}

/** Dictado por voz: descarga única del motor (whisper.cpp) y del modelo; después funciona sin internet. */
function VoiceRows() {
  const { t } = useT();
  const [st, setSt] = useState<VoiceState | null>(null);

  useEffect(() => {
    desktop?.voice?.status().then(setSt).catch(() => undefined);
    return desktop?.voice?.onChange(setSt);
  }, []);
  if (!st?.supported) return null;

  const subtitle = st.installing
    ? t('voice.downloading', { p: Math.round(st.progress * 100) })
    : st.installed
      ? voiceKeysLabel()
        ? t('voice.sub', { keys: voiceKeysLabel() ?? '' })
        : t('voice.subNoKey')
      : st.error
        ? t('voice.installFailed')
        : t('voice.setup', { mb: st.sizeMB });
  return (
    <>
      <Divider inset={58} />
      <ListRow
        icon="mic"
        title={t('voice.title')}
        subtitle={subtitle}
        onPress={st.installed || st.installing ? undefined : () => desktop?.voice?.install().then(setSt).catch(() => undefined)}
        value={st.installed ? t('voice.ready') : st.installing ? undefined : t('voice.download')}
        chevron={!st.installed && !st.installing}
      />
      {st.installed ? (
        <>
          <Divider inset={58} />
          <ListRow icon="trash-2" title={t('voice.remove')} subtitle={t('voice.removeSub', { mb: st.sizeMB })} onPress={() => desktop?.voice?.remove().then(setSt).catch(() => undefined)} />
        </>
      ) : null}
    </>
  );
}

/** Sincronización cifrada entre equipos (solo escritorio). */
function SyncSection() {
  const { t } = useT();
  const { status, lastSync, error, enabled } = useSync();
  const sub =
    status === 'syncing'
      ? t('sync.syncing')
      : status === 'error'
        ? error === 'key'
          ? t('sync.err.keyChanged')
          : t('sync.err.short')
        : lastSync
          ? t('sync.last', { date: formatDateTime(lastSync, useStore.getState().settings.use24h) })
          : t('sync.never');

  const turnOff = () =>
    showDialog(t('sync.offTitle'), t('sync.offBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('sync.offHere'), onPress: () => disableSync(false) },
      {
        text: t('sync.offAll'),
        style: 'destructive',
        onPress: async () => {
          if (!(await disableSync(true))) showDialog(t('sync.err.generic'));
        },
      },
    ]);

  return (
    <>
      <SectionHeader title={t('sync.section')} />
      <Card padded={false}>
        {!enabled && error === 'removed' ? (
          <>
            <ListRow icon="info" title={t('sync.removed')} chevron={false} />
            <Divider inset={58} />
          </>
        ) : null}
        {enabled ? (
          <>
            <ListRow icon="refresh-cw" title={t('sync.now')} subtitle={sub} onPress={() => syncNow()} chevron={false} />
            {status === 'error' && error === 'key' ? (
              <>
                <Divider inset={58} />
                <ListRow icon="key" title={t('sync.reenter')} onPress={() => router.push('/form/sync')} />
              </>
            ) : null}
            <Divider inset={58} />
            <ListRow icon="cloud-off" title={t('sync.off')} onPress={turnOff} />
          </>
        ) : (
          <ListRow icon="cloud" title={t('sync.enableRow')} subtitle={t('sync.enableSub')} onPress={() => router.push('/form/sync')} />
        )}
      </Card>
      <Text variant="caption" tone="faint" style={{ marginTop: space.md }}>
        {t('sync.footnote')}
      </Text>
    </>
  );
}

/** Licencia de este equipo y actualizaciones (solo escritorio). */
function LicenseSection() {
  const { t } = useT();
  const license = useDesktopState((s) => s.license);
  const update = useDesktopState((s) => s.update);
  const [checking, setChecking] = useState(false);

  const updSub = (() => {
    switch (update?.status) {
      case 'checking':
        return t('upd.checking');
      case 'downloading':
        return t('upd.downloading', { v: update.version ?? '', p: update.progress ?? 0 });
      case 'ready':
        return t('upd.readyShort', { v: update.version ?? '' });
      case 'installing':
        return t('upd.installingShort');
      case 'available':
        return t('upd.availableShort', { v: update.version ?? '' });
      case 'none':
        return t('upd.upToDate');
      case 'error':
        return t('upd.error');
      case 'disabled':
        return t('upd.disabled');
      default:
        return t('upd.current', { v: desktop?.version ?? '' });
    }
  })();

  const signOut = () =>
    showDialog(t('lic.signOutTitle'), t('lic.signOutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('lic.signOut'), style: 'destructive', onPress: () => desktop?.license?.deactivate().catch(() => undefined) },
    ]);

  return (
    <>
      <SectionHeader title={t('lic.section')} />
      <Card padded={false}>
        <ListRow
          icon="key"
          title={license?.dev ? t('lic.devMode') : license?.trialEndsAt ? t('trial.activeFor', { email: license?.email ?? '' }) : t('lic.activeFor', { email: license?.email ?? '' })}
          subtitle={
            license?.trialEndsAt
              ? t('trial.ends', { date: formatLongDate(new Date(license.trialEndsAt)) })
              : license?.checkedAt
                ? t('lic.checked', { date: formatLongDate(new Date(license.checkedAt)) })
                : undefined
          }
        />
        {license?.trialEndsAt ? (
          <>
            <Divider inset={58} />
            <ListRow icon="shopping-bag" title={t('lic.buy')} subtitle={t('trial.buySub')} onPress={() => desktop?.openSite?.('buy')} />
            <Divider inset={58} />
            <ListRow icon="refresh-cw" title={t('lic.bought')} onPress={() => desktop?.license?.refresh().catch(() => undefined)} />
          </>
        ) : null}
        <Divider inset={58} />
        <ListRow icon="monitor" title={t('lic.manageDevices')} onPress={() => desktop?.openSite?.('devices')} />
        <Divider inset={58} />
        <ListRow icon="log-out" title={t('lic.signOut')} subtitle={t('lic.signOutSub')} onPress={signOut} />
      </Card>

      <SectionHeader title={t('upd.section')} />
      <Card padded={false}>
        <ListRow
          icon="download-cloud"
          title={t('upd.check')}
          subtitle={updSub}
          onPress={async () => {
            if (update?.status === 'ready' || (update?.status === 'available' && update.manual)) return desktop?.updates?.install();
            setChecking(true);
            await desktop?.updates?.check().catch(() => undefined);
            setChecking(false);
          }}
          right={checking ? <Text variant="caption" tone="faint">…</Text> : undefined}
        />
      </Card>
      <Text variant="caption" tone="faint" style={{ marginTop: space.md }}>
        {t('upd.dataNote')}
      </Text>

      <ErrorReportsSection />
    </>
  );
}

/** Privacidad: informes de errores anónimos (solo si esta copia los tiene configurados). */
function ErrorReportsSection() {
  const { t } = useT();
  const [st, setSt] = useState<{ enabled: boolean; available: boolean } | null>(null);
  const [testState, setTestState] = useState<'idle' | 'sending' | 'ok' | 'fail'>('idle');
  useEffect(() => {
    desktop?.errorReports?.get().then(setSt).catch(() => undefined);
  }, []);
  if (!st?.available) return null;
  return (
    <>
      <SectionHeader title={t('err.section')} />
      <Card padded={false}>
        <ListRow
          icon="activity"
          title={t('err.title')}
          subtitle={t('err.sub')}
          right={<Toggle value={st.enabled} onChange={(v) => desktop?.errorReports?.set(v).then(setSt)} label={t('err.title')} />}
        />
        {st.enabled ? (
          <>
            <Divider inset={58} />
            <ListRow
              icon="send"
              title={t('err.test')}
              subtitle={testState === 'sending' ? t('err.testSending') : testState === 'ok' ? t('err.testOk') : testState === 'fail' ? t('err.testFail') : t('err.testSub')}
              onPress={async () => {
                setTestState('sending');
                const r = await desktop?.errorReports?.test?.().catch(() => ({ ok: false }));
                setTestState(r?.ok ? 'ok' : 'fail');
              }}
            />
          </>
        ) : null}
      </Card>
    </>
  );
}
