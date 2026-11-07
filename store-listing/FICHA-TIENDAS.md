# Ficha de tiendas · Razor

Textos listos para copiar en App Store Connect y Google Play Console. Respeta los límites de caracteres indicados.

---

## Español (principal)

**Nombre de la app** (App Store ≤30 · Play ≤30)
Razor: Agenda y Finanzas

**Subtítulo — App Store** (≤30)
Tu día, afilado

**Descripción corta — Google Play** (≤80)
Calendario, tareas, objetivos, alarmas, relojes y finanzas en una app minimalista.

**Texto promocional — App Store** (≤170, editable sin nueva versión)
Organiza tu día sin ruido: agenda, tareas, ideas, objetivos, recordatorios, relojes mundiales y finanzas. Sin cuentas ni anuncios. Tus datos, sólo en tu teléfono.

**Descripción** (≤4000)

Razor reúne todo lo que necesitas para planificar tu día en una sola app, limpia y precisa.

HOY
Empieza cada mañana con una vista clara: progreso de tus tareas, tu siguiente evento, recordatorios del día y la hora en las ciudades que te importan.

AGENDA
Calendario mensual con eventos de colores, eventos de todo el día y repeticiones diarias, semanales o de lunes a viernes, ideal para tus horarios fijos. Recibe avisos antes de cada evento.

TAREAS, IDEAS Y OBJETIVOS
• Tareas con fecha, prioridad y vínculo a un objetivo. Agrupadas en vencidas, hoy, próximas y sin fecha.
• Ideas: captura rápida y conviértelas en tarea con un toque.
• Objetivos con fecha límite, motivación y progreso visible.

ALARMAS Y RECORDATORIOS
Alarmas recurrentes por día de la semana y recordatorios puntuales con atajos rápidos ("en 1 hora", "mañana a las 9").

RELOJES MUNDIALES
Añade o quita ciudades a tu gusto. Diferencia horaria, día y momento del día de un vistazo.

FINANZAS
Registra ingresos y gastos por categoría, consulta tu balance mensual, controla un presupuesto y descubre en qué se va tu dinero.

DISEÑO
Minimalista y profesional, con tema claro, oscuro o automático, animaciones suaves y respuesta háptica. Disponible en español, inglés, portugués, francés, ruso y alemán.

PRIVACIDAD
Sin cuentas, sin anuncios, sin métricas de uso, sin rastreo. Todo se guarda en tu dispositivo. Exporta o borra tus datos cuando quieras.

**Palabras clave — App Store** (≤100, separadas por comas, sin espacios)
agenda,calendario,tareas,planificador,recordatorios,alarma,objetivos,hábitos,presupuesto,gastos,horario

**Novedades de la versión 1.0.0**
Primera versión de Razor.

---

## English (optional second locale)

**Name:** Razor: Planner & Finance
**Subtitle:** Your day, sharpened
**Short description (Play):** Calendar, tasks, goals, alarms, world clocks and budgeting in one minimalist app.
**Keywords:** planner,calendar,tasks,todo,reminders,alarm,goals,budget,expenses,schedule,worldclock

> La app está disponible en español, inglés, portugués, francés, ruso y alemán. Puedes añadir fichas localizadas en cada tienda para esos idiomas.

---

## Categorías y clasificación

| Campo | App Store | Google Play |
|---|---|---|
| Categoría principal | Productividad | Productividad |
| Categoría secundaria | Finanzas | — (etiquetas: Calendario, Lista de tareas) |
| Edad | 4+ (cuestionario: todo "Ninguno") | Cuestionario IARC: sin contenido sensible → "Para todos/PEGI 3" |
| Público objetivo (Play) | — | 18+ (evita el programa Familias) |
| Contiene anuncios | No | No |
| Compras dentro de la app | No | No |

---

## Privacidad: respuestas para cada tienda

### App Store Connect → Privacidad de la app
- ¿Recopilas datos de esta app? → **No, no recopilamos datos**.
- Resultado: etiqueta **"Datos no recopilados"**.
- URL de política de privacidad: el enlace del documento de Google Docs publicado en la Web (ver README, sección «Política de privacidad para las tiendas»).
- Cifrado (Export Compliance): la app declara `ITSAppUsesNonExemptEncryption = false` → no pregunta.

### Google Play Console → Seguridad de los datos
- ¿Tu app recopila o comparte alguno de los tipos de datos requeridos? → **No**.
- ¿Los datos se cifran en tránsito? → No aplica (no hay transmisión).
- ¿Ofreces una forma de solicitar la eliminación de datos? → Sí: en la app (Ajustes → Borrar todos los datos).
- Política de privacidad: el mismo enlace de Google Docs.
- Declaración de permisos: `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM` y `RECEIVE_BOOT_COMPLETED` se usan para alarmas y recordatorios locales. No se usa `USE_EXACT_ALARM` (bloqueado en `app.json`), por lo que no hace falta la declaración especial de alarmas exactas.

---

## Recursos gráficos

| Recurso | Tamaño | Estado |
|---|---|---|
| Icono App Store | 1024×1024 PNG sin transparencia | `assets/images/icon.png` ✔ |
| Icono Google Play | 512×512 PNG | `store-listing/play-icon-512.png` ✔ |
| Gráfico de funciones (Play) | 1024×500 | `store-listing/play-feature-graphic-1024x500.png` ✔ |
| Capturas iPhone 6,9" | 1320×2868 (mín. 1, recomendado 5–6) | Pendiente: hazlas en el simulador iPhone 17 Pro Max |
| Capturas Android teléfono | 1080×1920 o más (mín. 2) | Pendiente: hazlas en un emulador Pixel |

**Capturas recomendadas (en este orden, con un titular arriba):**
1. Hoy — "Tu día, de un vistazo"
2. Agenda — "Tus horarios, bajo control"
3. Listas — "Tareas, ideas y objetivos"
4. Finanzas — "Sabe en qué se va tu dinero"
5. Relojes — "El mundo, en tu zona horaria"
6. Tema claro/oscuro — "Claro u oscuro. Siempre nítido."

Usa datos de ejemplo realistas (sin nombres reales de terceros) y haz las capturas en tema oscuro salvo la última.
