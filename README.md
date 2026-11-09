# Clipsy

App de organización personal para **Windows y macOS**: agenda, tareas, ideas, objetivos, alarmas, recordatorios, relojes mundiales y finanzas. Minimalista, con tema claro/oscuro y animaciones fluidas. Se vende en la web (`razor_web`) con licencia por cuenta y 7 días de prueba gratis.

Construida con **Expo SDK 57** (React Native Web, React 19.2), **Expo Router**, **Reanimated 4** y **Zustand**, exportada como web y envuelta con [Electron](https://www.electronjs.org) en una ventana nativa con menús, atajos, bandeja del sistema e instaladores. El contenido se guarda en el equipo.

> Nota: internamente se conservan los nombres antiguos «Razor» en la carpeta de datos (`%APPDATA%\Razor`), el `appId` (`com.felipefranco.razor`), el protocolo `app://razor` y la clave de guardado `razor-store`. **No los cambies**: ahí están los datos de los usuarios. Tampoco nombres ningún archivo `aux`, `con`, `nul`, `prn`, `com1`… (nombres reservados de Windows).

---

## 1. Arrancar en tu ordenador

Requisitos: Node 20.19+ (o 22 LTS) y Git.

```bash
npm install                 # una vez
npm run desktop:install     # una vez (instala Electron en desktop/)
npm run desktop:dev         # exporta la app y abre la ventana
npm run typecheck           # comprobación de tipos
npm run test:quick          # pruebas del alta rápida en lenguaje natural
npm run test:import         # pruebas de la importación de archivos
```

En desarrollo no se pide licencia. Para probarla: `RAZOR_REQUIRE_LICENSE=1 npm start --prefix desktop`.

---

## 2. Estructura

```
app/                     Rutas (Expo Router)
  (tabs)/                Hoy · Agenda · Listas · Finanzas · Más
  form/                  Ventanas de formulario: evento, tarea, objetivo, movimiento, alarma, recordatorio, reloj…
  mini.tsx quick.tsx     Ventana «Hoy» flotante y barra de alta rápida
src/
  theme/                 Tokens de diseño + proveedor de tema claro/oscuro
  components/            UI: Screen, Sidebar, Card, CommandPalette, FormScreen…
  store/                 Estado global persistente (Zustand) y tipos
  lib/                   Fechas, recurrencias, zonas horarias, notificaciones, dinero, alta rápida, importación
  desktop/               Puente con Electron: licencia, sincronización cifrada, ventanas auxiliares
  constants/             Ciudades y categorías financieras
desktop/                 Electron: ventana, menús, bandeja, atajos, licencia, voz, importación e instaladores
tools/                   Comprobaciones de compilación (archivos de escritorio, clave pública)
assets/images/           Icono y favicon
```

---

## 3. Decisiones de diseño

- **Estilo**: superficies neutras, líneas finas (hairline), un único color de acento, radios contenidos y números tabulares para que horas y cifras no "bailen".
- **Jerarquía**: título grande que se condensa en barra compacta al desplazar, secciones con etiqueta en versalitas y espaciado en escala de 4.
- **Movimiento con propósito**: indicador de pestañas y control segmentado con muelle, entradas escalonadas de listas, check animado, anillo de progreso, transiciones de mes deslizantes.
- **Permisos en contexto**: nunca se pide permiso de notificaciones al abrir. Se pide al crear la primera alarma, recordatorio o aviso, y un banner explica el motivo si están desactivadas.
- **Entrada rápida**: añadir tareas/ideas con intro, atajos de fecha ("Hoy", "Mañana", "En 1 hora"), acciones rápidas en Hoy.
- **Accesibilidad**: roles y etiquetas en todos los controles, navegación con teclado, contraste AA en ambos temas.
- **Privacidad visible**: onboarding y "Más" lo dicen claramente; exportar a archivo, restaurar y borrar datos desde Ajustes.
- **Relojes siempre visibles (1.3.0)**: arriba a la derecha de cada pantalla se ve el reloj principal y los que el usuario fije (hasta 3). En *Relojes*, hacer clic en una ciudad permite hacerla principal o mostrarla/quitarla de arriba (`src/components/HeaderClocks.tsx`).
- **Introducción animada (1.3.0)**: cada paso sale hacia un lado y el siguiente entra escalonado (icono → título → texto → controles); al volver la dirección se invierte. Al pulsar *Empezar*, el logotipo aparece centrado antes de entrar a la app.
- **Gráfica de torta en Finanzas (1.3.0)**: el anillo completo es el 100 % del balance del mes (base fijada en Ajustes + ingresos; si no hay ninguno, el total gastado). El balance del mes = base + ingresos − gastos y siempre está visible, aunque no haya gastos. Cada categoría ocupa su porcentaje con un color fijo; lo no gastado queda como *Disponible*. Hacer clic en una categoría de la leyenda la resalta. Colores validados para daltonismo en ambos temas (`chartColors` en `src/theme/tokens.ts`).
- **Calendario compacto (1.3.0)**: celdas más bajas: el mes y la agenda del día van lado a lado.
- **Color de acento**: 5 opciones (azul, violeta, turquesa, magenta, grafito) con versión clara y oscura, todas con contraste AA. Se evitan verde, rojo y ámbar porque la interfaz los usa para ingresos, errores y avisos. Se definen en `src/theme/tokens.ts` (`accents`).

---

## 4. Escritorio

**Diseño de escritorio**
- Con la ventana ancha, la navegación es una **barra lateral** con botón «Nueva tarea» y atajos visibles.
- El contenido se centra con un ancho de lectura cómodo; los formularios se abren como **ventanas flotantes** (Esc cierra, Ctrl/⌘ + Intro guarda).
- Diálogos propios con el estilo de la app, selectores de fecha y hora del sistema, scrollbars discretas.
- Atajos: Ctrl/⌘ 1–5 secciones, Ctrl/⌘ N nueva tarea, Ctrl/⌘ ⇧ N nuevo evento, Ctrl/⌘ , ajustes. Están en la pantalla de Ayuda.

**Alarmas y recordatorios**: llegan como notificaciones del sistema. Al cerrar la ventana Clipsy sigue en la bandeja (barra de menús en Mac) para avisarte; en Ajustes → Escritorio puedes hacer que arranque solo al iniciar sesión. Si sales del todo, no hay avisos hasta que vuelvas a abrirla.

**Dictado por voz (Windows)**: `Ctrl+Shift+D` («D» de dictar) desde cualquier programa (o el micrófono junto a «Nueva tarea» o en la barra rápida) abre la barra escuchando. Al callar, lo dicho se escribe en el campo y se guarda solo al momento, salvo que lo corrijas o pulses Esc. Ejemplos: «recuérdame llamar a Juan en 20 minutos», «pon una alarma a las 6 y media», «gasté 35 mil en almuerzo».

**Importar** (barra lateral, encima de Ayuda): trae la rutina, el horario, la agenda, las tareas o las finanzas que la persona ya tiene en un Excel (.xlsx), CSV, Word (.docx), PDF, texto o una foto. El archivo se lee en el equipo (`desktop/importer.js`; fotos y PDF con el reconocedor de texto de Windows, `desktop/ocr.ps1`), no se guarda, y lo que se entendió (`src/lib/importParse.ts`) se muestra para revisarlo antes de añadirlo. Pruebas: `npm run test:import`.
- El audio se pasa a texto **en el equipo** con [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (`desktop/voice.js`) y nunca sale de él.
- El motor y el modelo `ggml-base-q5_1` (unos 70 MB) **no van en el instalador**. Se descargan una sola vez cuando la persona activa la voz, desde GitHub y Hugging Face, y se comprueba su SHA-256 antes de usarlos. Quedan en `%APPDATA%\Razor\voice` y se pueden quitar desde *Ajustes → Escritorio*.
- Para cambiar de versión o de modelo, actualiza la URL, el tamaño y el SHA-256 en `desktop/voice.js`.
- En macOS y Linux la voz no aparece todavía: whisper.cpp no publica binarios para esos sistemas, así que habría que compilarlos y añadirlos.
- El intérprete de frases (`src/lib/quickParse.ts`) es el mismo para lo escrito y lo dictado. Sus pruebas: `npm run test:quick`.

**Tus datos**: se guardan en el equipo. Para usarlos en varios equipos, activa *Ajustes → Sincronización* (cifrada de extremo a extremo) o usa *Ajustes → Exportar / Restaurar copia de seguridad*.

### Instalar sin firma digital
Sin certificados de pago, los sistemas avisan la primera vez:
- **Windows** («Windows protegió su PC»): *Más información → Ejecutar de todas formas*.
- **macOS** («no se puede verificar el desarrollador»): arrastra Clipsy a Aplicaciones, ábrelo una vez, ve a *Ajustes del Sistema → Privacidad y seguridad* y pulsa *Abrir igualmente*.

Para eliminar estos avisos: certificado de firma de código para Windows y Apple Developer Program (99 USD/año) para firmar y notarizar en macOS.

### Licencias (activación con la cuenta de la web)
Desde la 1.3.0, tras la introducción la app pide **iniciar sesión con la cuenta de la web** con la que se compró Clipsy. Sin licencia válida no se puede usar (los atajos y menús tampoco abren nada).

- **Cómo funciona**: la app inicia sesión en Supabase, llama a `razor-web/api/license/activate` y recibe un token firmado (Ed25519) ligado a un identificador aleatorio de ese equipo. La app lo comprueba **sin conexión** con la clave pública y lo renueva como mucho una vez al día.
- **Sin conexión**: funciona hasta **30 días** sin validar (`offlineGraceDays`); después pide conectarse.
- **Reembolso** o **equipo quitado desde la web** → en la siguiente validación la app vuelve a pedir iniciar sesión, con un mensaje que explica el motivo.
- **Límite**: 5 equipos por cuenta (`LICENSE_DEVICE_LIMIT` en Vercel). En *Ajustes → Licencia* se puede cerrar sesión en el equipo para liberar la plaza; desde la web se ven y se quitan los equipos.
- **Los datos nunca se tocan**: la pantalla de activación tapa la app, pero el contenido del usuario sigue en su carpeta y reaparece al activar.
- **En desarrollo** (`npm run desktop:dev`) no se pide licencia. Para probarla: `RAZOR_REQUIRE_LICENSE=1 npm start --prefix desktop`.
- Como toda protección que corre en el equipo del usuario, una persona con conocimientos técnicos podría modificar la app para saltársela. El objetivo es que usar Clipsy sin pagar no sea trivial, no hacerlo imposible.

**Configurar** (una vez):
1. En `razor-web`: `node tools/generate-license-keys.js`. La clave **privada** va a Vercel como `LICENSE_PRIVATE_KEY`. La **pública** no hace falta copiarla: al compilar en GitHub Actions, `tools/fill-license-key.js` la descarga de `siteUrl/api/license/public-key` y la escribe en `desktop/config.js` (si ya hay una, comprueba que coincida).
2. Rellena el resto de `desktop/config.js`: `siteUrl`, `supabaseUrl`, `supabaseAnonKey` y `updatesUrl` (`https://github.com/Eva-one01/razor-releases/releases/latest/download`).
3. Pon la misma URL de `updatesUrl` en `desktop/package.json → build.publish[0].url`.
4. Si `config.js` se queda con los valores de ejemplo al compilar en tu PC, el instalador mostrará «Esta copia de Clipsy no tiene configurada la activación».

### Actualizaciones automáticas
- **Windows**: la app busca versiones nuevas al abrirse y cada 30 minutos, la descarga en segundo plano y avisa junto al botón de minimizar. Al aceptar, se instala en silencio y se vuelve a abrir sola.
- **macOS sin firmar**: Apple no permite instalar solo, así que la app avisa de la versión nueva y el botón **Descargar** abre *Mi cuenta → Descargas*. Si firmas la app con Apple Developer, pon `macAutoUpdate: true` en `desktop/config.js`.
- *Ajustes → Actualizaciones → Buscar actualizaciones* permite comprobarlo a mano.

**Ninguna actualización borra datos.** Viven en la carpeta del usuario (`%APPDATA%\Razor` en Windows, `~/Library/Application Support/Razor` en Mac), aparte del programa. Si cambias la forma en que se guardan, sube `version` del almacén en `src/store/index.ts` y añade el paso en `migrate`.

### Publicar una versión nueva
1. Sube `version` en `app.json`, `package.json` y `desktop/package.json` (las tres iguales).
2. En este repositorio: **Actions → Escritorio → Run workflow**. Compila Windows y Mac, comprueba que estén todos los archivos, pone la clave pública de licencias y deja los instaladores en la release `build-vX.Y.Z` de este repositorio.
3. En `razor-releases`: **Actions → Publicar → Run workflow** con la versión (por ejemplo `1.4.4`). Crea la release `vX.Y.Z` y la marca como la última.

La web muestra y entrega sola la versión nueva, y las apps instaladas se actualizan en menos de media hora.

---

## 5. Idiomas

La app está traducida a español, inglés, portugués, francés, ruso y alemán (`src/i18n/locales/`). El idioma se elige en el primer paso de la configuración inicial y se puede cambiar en Ajustes; por defecto se usa el del sistema si está soportado.

- Todos los diccionarios comparten el tipo de `es.ts`: si falta o sobra una clave en cualquier idioma, `npm run typecheck` falla.
- Para añadir un idioma: copia `en.ts`, tradúcelo, regístralo en `src/i18n/index.ts` (`languages`, `dicts`, `intlBase`) y añade los nombres de ciudades en `src/constants/cities.ts`. Los textos de menús y bandeja están en `desktop/i18n.js`.
- Fechas, días, meses y moneda usan `Intl` con el idioma elegido.

---

## 6. Lista de verificación antes de publicar

- [ ] `npm run typecheck`, `npm run test:quick` y `npm run test:import` sin errores
- [ ] Probado en Windows (y Mac si se publica), en tema claro y oscuro
- [ ] Notificaciones: conceder, denegar y volver a activar
- [ ] Alarma recurrente y recordatorio puntual llegan con la ventana cerrada (Clipsy en la bandeja)
- [ ] Activación con una cuenta con compra, con prueba gratis y sin conexión
- [ ] Exportar copia, restaurarla y borrar todos los datos; sincronización entre dos equipos
- [ ] Revisar la app en los 6 idiomas (textos largos en alemán y ruso)

---

## 7. Limitaciones conocidas

- **Alarmas**: llegan como notificaciones del sistema mientras Clipsy esté abierto o en la bandeja. Si se cierra del todo, no hay avisos hasta volver a abrirlo.
- **Voz** solo en Windows por ahora (whisper.cpp no publica binarios para macOS).
