# Razor

App de organización personal para iOS y Android: agenda, tareas, ideas, objetivos, alarmas, recordatorios, relojes mundiales y finanzas. Minimalista, con tema claro/oscuro y animaciones fluidas.

Construida con **Expo SDK 57** (React Native 0.86, React 19.2), **Expo Router**, **Reanimated 4**, **Zustand** y almacenamiento local. Sin backend, sin cuentas, sin rastreo.

---

## 1. Arrancar en tu máquina

Requisitos: Node 20.19+ (o 22 LTS), Git, una cuenta gratuita en [expo.dev](https://expo.dev). Para builds locales: Xcode 26.4+ (macOS) y/o Android Studio.

```bash
cd razor
npm install
npx expo install --fix      # alinea TODAS las versiones con SDK 57 (importante)
npx expo-doctor@latest      # debe salir sin errores
npm run typecheck
```

Probar en tu teléfono con un *development build* (recomendado: las notificaciones y la háptica se comportan como en producción):

```bash
npm install -g eas-cli
eas login
eas init                    # crea el proyecto y escribe el projectId en app.json
eas build --profile development --platform android   # o ios
npx expo start --dev-client
```

> Las versiones de `package.json` son las esperadas para SDK 57; `npx expo install --fix` corrige cualquier diferencia de parche.

---

## 2. Estructura

```
app/                     Rutas (Expo Router)
  (tabs)/                Hoy · Agenda · Listas · Finanzas · Más
  form/                  Hojas modales: evento, tarea, objetivo, movimiento, alarma, recordatorio, reloj
  clocks.tsx alarms.tsx settings.tsx onboarding.tsx
src/
  theme/                 Tokens de diseño + proveedor de tema claro/oscuro
  components/            UI base: Screen, TabBar, Card, Checkbox, Segmented, ProgressRing, FormScreen…
  store/                 Estado global persistente (Zustand + AsyncStorage) y tipos
  lib/                   Fechas, zonas horarias, notificaciones, dinero, háptica
  constants/             Ciudades y categorías financieras
desktop/                 App de escritorio (Electron): ventana, menús, bandeja, iconos e instaladores
modules/razor-alarms/    Módulo nativo local (Android): comprueba y abre el permiso de alarmas exactas
assets/images/           Icono, icono adaptativo Android, splash, icono de notificación
store-listing/           Textos de ficha, política de privacidad, gráficos de Play
```

---

## 3. Decisiones de UX/UI

- **Concepto "afilado"**: superficies neutras, líneas finas (hairline), un único color de acento, radios contenidos y números tabulares para que horas y cifras no "bailen".
- **Jerarquía**: título grande que se condensa en barra compacta al desplazar (patrón nativo iOS), secciones con etiqueta en versalitas y espaciado en escala de 4.
- **Movimiento con propósito**: indicador de pestañas y control segmentado con muelle, entradas escalonadas de listas, check animado, anillo de progreso, transiciones de mes deslizantes (también con gesto de swipe).
- **Permisos en contexto**: nunca se pide permiso de notificaciones al abrir. Se pide al crear la primera alarma, recordatorio o aviso, y un banner explica el motivo si están desactivadas.
- **Entrada rápida**: añadir tareas/ideas con intro, atajos de fecha ("Hoy", "Mañana", "En 1 hora"), acciones rápidas en Hoy.
- **Accesibilidad**: roles y etiquetas en todos los controles, objetivos táctiles ≥ 40 pt, tipografía dinámica respetada (con tope en números grandes), contraste AA en ambos temas.
- **Privacidad visible**: onboarding y "Más" lo dicen claramente; exportar a archivo, restaurar y borrar datos desde Ajustes.
- **Relojes siempre visibles (1.3.0)**: arriba a la derecha de cada pantalla se ve el reloj principal y los que el usuario fije (1 extra en móvil, hasta 3 en escritorio). En *Relojes*, tocar una ciudad permite hacerla principal o mostrarla/quitarla de arriba (`src/components/HeaderClocks.tsx`).
- **Introducción animada (1.3.0)**: cada paso sale hacia un lado y el siguiente entra escalonado (icono → título → texto → controles); al volver la dirección se invierte. Al pulsar *Empezar*, el logotipo aparece centrado antes de entrar a la app.
- **Gráfica de torta en Finanzas (1.3.0)**: el anillo completo es el 100 % del balance del mes (base fijada en Ajustes + ingresos; si no hay ninguno, el total gastado). El balance del mes = base + ingresos − gastos y siempre está visible, aunque no haya gastos. Cada categoría ocupa su porcentaje con un color fijo; lo no gastado queda como *Disponible*. Tocar una categoría de la leyenda la resalta. Colores validados para daltonismo en ambos temas (`chartColors` en `src/theme/tokens.ts`).
- **Calendario compacto (1.3.0)**: celdas más bajas; en escritorio el mes y la agenda del día van lado a lado.
- **Color de acento**: 5 opciones (azul, violeta, turquesa, magenta, grafito) con versión clara y oscura, todas con contraste AA. Se evitan verde, rojo y ámbar porque la interfaz los usa para ingresos, errores y avisos. Se definen en `src/theme/tokens.ts` (`accents`).

---

## Versión de escritorio (Windows y macOS)

La app de escritorio usa **el mismo código** que la móvil: Expo la exporta como web y [Electron](https://www.electronjs.org) la envuelve en una ventana nativa con menús, atajos de teclado, bandeja del sistema e instaladores. Todo el contenido sigue siendo local. La interfaz no puede conectarse a ningún servidor (la política de seguridad de la ventana lo bloquea); solo el proceso principal se conecta, para validar la licencia y buscar actualizaciones.

**Diseño de escritorio**
- Con la ventana ancha, la barra inferior pasa a ser una **barra lateral** con botón «Nueva tarea» y atajos visibles.
- El contenido se centra con un ancho de lectura cómodo; los formularios se abren como **ventanas flotantes** (Esc cierra, Ctrl/⌘ + Intro guarda).
- Diálogos propios con el estilo de la app, selectores de fecha y hora del sistema, scrollbars discretas.
- Atajos: Ctrl/⌘ 1–5 secciones, Ctrl/⌘ N nueva tarea, Ctrl/⌘ ⇧ N nuevo evento, Ctrl/⌘ , ajustes. Están en la pantalla de Ayuda.

**Alarmas y recordatorios**: llegan como notificaciones del sistema. Al cerrar la ventana Razor sigue en la bandeja (barra de menús en Mac) para avisarte; en Ajustes → Escritorio puedes hacer que arranque solo al iniciar sesión. Si sales del todo, no hay avisos hasta que vuelvas a abrirla.

**Dictado por voz (Windows)**: `Ctrl+Alt+Espacio` desde cualquier programa (o el micrófono de la barra rápida) abre la barra escuchando. Al callar, lo dicho se escribe en el campo y se guarda solo al momento, salvo que lo corrijas o pulses Esc. Ejemplos: «recuérdame llamar a Juan en 20 minutos», «pon una alarma a las 6 y media», «gasté 35 mil en almuerzo».
- El audio se pasa a texto **en el equipo** con [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (`desktop/voice.js`) y nunca sale de él.
- El motor y el modelo `ggml-base-q5_1` (unos 70 MB) **no van en el instalador**. Se descargan una sola vez cuando la persona activa la voz, desde GitHub y Hugging Face, y se comprueba su SHA-256 antes de usarlos. Quedan en `%APPDATA%\Razor\voice` y se pueden quitar desde *Ajustes → Escritorio*.
- Para cambiar de versión o de modelo, actualiza la URL, el tamaño y el SHA-256 en `desktop/voice.js`.
- En macOS y Linux la voz no aparece todavía: whisper.cpp no publica binarios para esos sistemas, así que habría que compilarlos y añadirlos.
- El intérprete de frases (`src/lib/quickParse.ts`) es el mismo para lo escrito y lo dictado. Sus pruebas: `npm run test:quick`.

**Tus datos**: el escritorio y el teléfono guardan sus datos por separado. Para pasarlos de uno a otro, usa *Ajustes → Exportar / Restaurar copia de seguridad*: el formato es el mismo.

### Probar en tu ordenador
```bash
npm install                 # una vez (añade react-native-web)
npm run desktop:install     # una vez (instala Electron en desktop/)
npm run desktop:dev         # exporta la app y abre la ventana
```

### Crear los instaladores
- **Windows** (desde un PC con Windows): `npm run desktop:win` → `desktop/release/Razor-Setup-1.3.0.exe`
- **macOS** (desde un Mac): `npm run desktop:mac` → `desktop/release/Razor-1.3.0-mac-arm64.dmg` (Apple Silicon) y `…-x64.dmg` (Intel)
- **Sin Mac**: sube el proyecto a GitHub y lanza el flujo **Escritorio** en la pestaña *Actions* (o crea una etiqueta `v1.3.0`). Compila ambos instaladores en servidores de GitHub y los deja para descargar en *Artifacts*.

### Instalar sin firma digital
Sin certificados de pago, los sistemas avisan la primera vez:
- **Windows** («Windows protegió su PC»): *Más información → Ejecutar de todas formas*.
- **macOS** («no se puede verificar el desarrollador»): arrastra Razor a Aplicaciones, ábrelo una vez, ve a *Ajustes del Sistema → Privacidad y seguridad* y pulsa *Abrir igualmente*.

Para eliminar estos avisos: certificado de firma de código para Windows y Apple Developer Program (99 USD/año) para firmar y notarizar en macOS. También puedes publicar en Microsoft Store (cuenta individual sin coste) o en Mac App Store.

### Licencias (activación con la cuenta de la web)
Desde la 1.3.0, tras la introducción la app pide **iniciar sesión con la cuenta de la web** con la que se compró Razor. Sin licencia válida no se puede usar (los atajos y menús tampoco abren nada).

- **Cómo funciona**: la app inicia sesión en Supabase, llama a `razor-web/api/license/activate` y recibe un token firmado (Ed25519) ligado a un identificador aleatorio de ese equipo. La app lo comprueba **sin conexión** con la clave pública y lo renueva como mucho una vez al día.
- **Sin conexión**: funciona hasta **30 días** sin validar (`offlineGraceDays`); después pide conectarse.
- **Reembolso** o **equipo quitado desde la web** → en la siguiente validación la app vuelve a pedir iniciar sesión, con un mensaje que explica el motivo.
- **Límite**: 5 equipos por cuenta (`LICENSE_DEVICE_LIMIT` en Vercel). En *Ajustes → Licencia* se puede cerrar sesión en el equipo para liberar la plaza; desde la web se ven y se quitan los equipos.
- **Los datos nunca se tocan**: la pantalla de activación tapa la app, pero el contenido del usuario sigue en su carpeta y reaparece al activar.
- **En desarrollo** (`npm run desktop:dev`) no se pide licencia. Para probarla: `RAZOR_REQUIRE_LICENSE=1 npm start --prefix desktop`.
- Como toda protección que corre en el equipo del usuario, una persona con conocimientos técnicos podría modificar la app para saltársela. El objetivo es que usar Razor sin pagar no sea trivial, no hacerlo imposible.

**Configurar** (una vez):
1. En `razor-web`: `node tools/generate-license-keys.js`. La clave **privada** va a Vercel como `LICENSE_PRIVATE_KEY`; la **pública**, a `desktop/config.js → licensePublicKey`.
2. Rellena el resto de `desktop/config.js`: `siteUrl`, `supabaseUrl`, `supabaseAnonKey` y `updatesUrl` (`https://github.com/Eva-one01/razor-releases/releases/latest/download`).
3. Pon la misma URL de `updatesUrl` en `desktop/package.json → build.publish[0].url`.
4. Si `config.js` se queda con los valores de ejemplo, el instalador mostrará «Esta copia de Razor no tiene configurada la activación».

### Actualizaciones automáticas
- **Windows**: la app busca versiones nuevas al abrirse y cada 6 horas, la descarga en segundo plano y muestra «Razor X está lista · Reiniciar y actualizar». Si el usuario no reinicia, se instala al salir.
- **macOS sin firmar**: Apple no permite instalar solo, así que la app avisa de la versión nueva y el botón **Descargar** abre *Mi cuenta → Descargas*. El usuario la instala encima. Si firmas la app con Apple Developer, pon `macAutoUpdate: true` en `desktop/config.js` y se actualizará sola como en Windows.
- *Ajustes → Actualizaciones → Buscar actualizaciones* permite comprobarlo a mano.

**Ninguna actualización borra datos.** Viven en la carpeta del usuario (`%APPDATA%\Razor` en Windows, `~/Library/Application Support/Razor` en Mac), aparte del programa. Para que siga siendo así:
1. No cambies nunca `appId` (`com.felipefranco.razor`), el nombre `Razor` ni el protocolo interno `app://razor`.
2. Si cambias la forma en que se guardan los datos, sube `version` del almacén en `src/store/index.ts` y añade el paso en `migrate` (como v2 → v3).
3. Sube siempre la versión (1.3.0 → 1.3.1 → 1.4.0).

### Publicar una versión nueva
1. Cambia `version` en `app.json`, `package.json` y `desktop/package.json` (las tres iguales).
2. Compila: `npm run desktop:win` y `npm run desktop:mac`, o usa el flujo **Escritorio** de GitHub Actions.
3. Publica los archivos en **GitHub Releases** del repositorio público `razor-releases` (el plan gratis de Supabase no admite archivos de más de 50 MB): *Releases → Draft a new release*, etiqueta `vX.Y.Z`, arrastra todo lo que hay en `desktop/release/`:
   - Windows: `Razor-Setup-X.exe`, `Razor-Setup-X.exe.blockmap`, `latest.yml`
   - Mac: los dos `.dmg`, los dos `.zip`, sus `.blockmap` y `latest-mac.yml`

   y pulsa **Publish release** con *Set as the latest release* marcado.
4. En Vercel cambia `RAZOR_VERSION` a la versión nueva, y `appVersion` en `razor-web/assets/js/config.js`.

A las pocas horas, todas las apps abiertas se habrán actualizado (o, en Mac, avisado).

## 4. Idiomas

La app está traducida a español, inglés, portugués, francés, ruso y alemán (`src/i18n/locales/`). El idioma se elige en el primer paso de la configuración inicial y se puede cambiar en Ajustes; por defecto se usa el del teléfono si está soportado.

- Todos los diccionarios comparten el tipo de `es.ts`: si falta o sobra una clave en cualquier idioma, `npm run typecheck` falla.
- Para añadir un idioma: copia `en.ts`, tradúcelo, regístralo en `src/i18n/index.ts` (`languages`, `dicts`, `intlBase`), añade los nombres de ciudades en `src/constants/cities.ts` y su código en `CFBundleLocalizations` de `app.json`.
- Fechas, días de la semana, meses y moneda usan `Intl` con el idioma elegido y la región del teléfono.
- Al cambiar de idioma se reprograman las notificaciones para que lleguen en el idioma nuevo.

## 5. Antes de publicar (cambia esto)

| Dónde | Qué |
|---|---|
| `app.json → ios.bundleIdentifier` y `android.package` | Están como `com.felipefranco.razor`. **No se pueden cambiar** tras la primera subida. |
| `app.json → extra.eas.projectId` | Lo rellena `eas init`. |
| `eas.json → submit.production.ios.ascAppId` | ID numérico de la app en App Store Connect. |
| `google-service-account.json` | Clave de cuenta de servicio de Play para `eas submit` (no la subas a Git). |

---

### Política de privacidad para las tiendas

Dentro de la app está todo: privacidad y términos (Más → Privacidad y términos), ayuda y preguntas frecuentes (Más → Ayuda) y contacto. La app no depende de ninguna web externa.

Aun así, Google Play y App Store exigen pegar en su consola una **URL pública** de la política de privacidad (no sirve un PDF). Esa URL solo se usa en la ficha de la tienda. La opción más sencilla con tu cuenta de Google:

1. Abre `store-listing/privacy.html` en el navegador, selecciona todo el texto y pégalo en un documento nuevo de Google Docs.
2. En Google Docs: **Archivo → Compartir → Publicar en la Web → Publicar**.
3. Copia el enlace que aparece y pégalo en Play Console (*Contenido de la app → Política de privacidad*) y, más adelante, en App Store Connect.

Si actualizas la política, edita ese mismo documento: el enlace no cambia.

## 6. Publicar en Google Play

1. Crea la cuenta de desarrollador (pago único de 25 USD) en [play.google.com/console](https://play.google.com/console) y verifica tu identidad.
2. **Crea la app** → idioma Español, tipo App, gratuita.
3. Completa *Contenido de la app*: política de privacidad, anuncios (No), acceso a la app (sin restricciones), clasificación de contenido, público objetivo (18+), seguridad de los datos (ver `store-listing/FICHA-TIENDAS.md`).
4. Build de producción (AAB firmado; EAS gestiona el keystore):
   ```bash
   eas build --profile production --platform android
   ```
5. Primera subida: arrastra el `.aab` a **Pruebas → Prueba interna** en la consola (Google exige la primera subida manual). Después puedes usar `eas submit --platform android`.
6. **Cuentas personales nuevas**: Google exige una **prueba cerrada con al menos 12 testers durante 14 días seguidos** antes de poder pedir acceso a producción. Planifícalo desde el principio.
7. Ficha de Play Store: textos, icono 512, gráfico de funciones 1024×500 y al menos 2 capturas.
8. Producción → crear versión → enviar a revisión.

## 7. Publicar en App Store

1. Inscríbete en el [Apple Developer Program](https://developer.apple.com/programs/) (99 USD/año).
2. En [App Store Connect](https://appstoreconnect.apple.com) → *Mis apps* → **+ Nueva app** con el mismo bundle ID. Apunta el *Apple ID* numérico en `eas.json`.
3. Build y envío (EAS crea certificados y perfiles por ti):
   ```bash
   eas build --profile production --platform ios
   eas submit --platform ios --profile production
   ```
4. Prueba la build en **TestFlight**.
5. Completa la ficha: capturas 6,9" (1320×2868), descripción, palabras clave, URL de soporte y de privacidad, categoría Productividad, clasificación 4+.
6. *Privacidad de la app* → "Datos no recopilados".
7. Envía a revisión. Notas para el revisor: "No requiere inicio de sesión. Todos los datos son locales. Las alarmas usan notificaciones locales."

---

## 8. Lista de verificación final

- [ ] `npx expo-doctor` sin errores · `npm run typecheck` sin errores
- [ ] Probado en iPhone y Android reales, en tema claro y oscuro, con texto grande del sistema
- [ ] Notificaciones: conceder, denegar y volver a activar desde el banner
- [ ] Alarma recurrente y recordatorio puntual llegan con la app cerrada y tras reiniciar el teléfono (Android)
- [ ] Cambiar zona horaria del teléfono y revisar relojes
- [ ] Exportar copia, restaurarla en otro teléfono o tras reinstalar, y borrar todos los datos
- [ ] Android 14+: el aviso de alarmas exactas aparece, lleva al ajuste y desaparece al concederlo
- [ ] Probar los 5 colores de acento en tema claro y oscuro
- [ ] Revisar la app en los 6 idiomas (textos largos en alemán y ruso)
- [ ] Política de privacidad publicada y enlazada en ambas fichas (en la app ya está en Más → Privacidad y términos)
- [ ] Capturas y textos subidos

---

## 9. Limitaciones conocidas y siguientes pasos

- **Alarmas**: se entregan como notificaciones locales de alta prioridad con sonido. No suenan en modo silencio de iOS ni a pantalla completa. Para una alarma "de despertador" real: iOS 26+ ofrece **AlarmKit** y Android permite alarmas a pantalla completa; ambas requieren un módulo nativo (Expo Modules) — buen candidato para la v1.1.
- En Android 14+, `SCHEDULE_EXACT_ALARM` viene desactivado por defecto. La app lo detecta con el módulo nativo `modules/razor-alarms`, muestra un aviso en Alarmas y Ajustes (y tras guardar una alarma) y reprograma todo cuando el usuario lo concede. Ese módulo necesita un development build o un build de EAS: en Expo Go no existe y la app simplemente no muestra el aviso.
- Ideas para v1.1: widgets de pantalla de inicio, sincronización opcional con iCloud/Google Drive, importar copia de seguridad, gráficos históricos de finanzas, Face ID para la sección de finanzas.
