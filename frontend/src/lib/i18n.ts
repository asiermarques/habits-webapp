import type { LocaleCode } from '@habitsapp/shared';
import { setActiveLocale as setLocaleTag } from './locale';

// Pragmatic flat-key translation mechanism. The `key` parameter of `t()` is
// typed against the English dictionary so missing keys surface as TypeScript errors.

const en = {
  // App shell
  'app.title': 'Habits',

  // Header
  'header.backToHome': 'Back to home',
  'header.logEntry': 'Log entry',
  'header.metrics': 'Metrics',
  'header.settings': 'Settings',

  // Home
  'home.greeting': 'Hello,',
  'home.empty': 'A quiet ledger of small acts.',
  'home.subtitle': 'Mark what you did. Not what you should have done.',
  'home.thisWeek': 'this week',
  'home.recentEntries': 'recent entries',
  'home.filter.all': 'All habits',
  'home.filter.aria': 'Filter by habit',

  // Common actions
  'action.cancel': 'Cancel',
  'action.delete': 'Delete',
  'action.save': 'Save changes',
  'action.add': 'Add',
  'action.loading': 'Loading…',
  'action.cantUndo': 'This action cannot be undone.',

  // Metrics page
  'metrics.eyebrow': 'the long view',
  'metrics.title': 'Metrics',
  'metrics.subtitle': 'Patterns emerge slowly. Read them without judgement.',
  'metrics.weekly': 'This week',
  'metrics.byHabit': 'By habit (last 3 months)',
  'metrics.heatmaps': 'Heatmaps',
  'metrics.heatmaps.eyebrow': 'last 6 months',
  'metrics.loading': 'Loading…',
  'metrics.noEntriesWeek': 'No entries this week.',
  'metrics.noEntriesMonths': 'No entries in the last 3 months.',
  'metrics.noHabits': 'No habits configured yet.',
  'metrics.unknown': 'Unknown',
  'metrics.entries': 'ENTRIES',

  // Summary cards
  'summary.eyebrow': 'last 30 days',
  'summary.mostLogged': 'Most logged',
  'summary.leastLogged': 'Least logged',
  'summary.badHabitCost': 'Bad habit total cost',
  'summary.activeHabits': 'Active habits',
  'summary.of': 'of',
  'summary.reps': 'reps',

  // Units (used in entry summaries)
  'unit.min': 'min',
  'unit.km': 'km',
  'unit.kg': 'kg',
  'unit.reps': 'reps',
  'unit.words': 'words',
  'unit.cost': 'cost',
  'unit.separator': ' · ',

  // Entries list
  'entries.noUser': 'Add a user in Settings to start logging.',
  'entries.empty': 'No entries yet. Tap "Log" above to add your first.',
  'entries.seeMore': 'See more →',
  'entries.unknownHabit': 'Unknown habit',
  'entries.deleteTitle': 'Delete this entry?',
  'entries.editAria': 'Edit entry',
  'entries.deleteAria': 'Delete entry',

  // Log / Edit entry dialog
  'logEntry.titleEdit': 'Edit entry',
  'logEntry.titleNew': 'Log entry',
  'logEntry.descriptionEdit': 'Update the details of this habit entry.',
  'logEntry.descriptionNew': 'Record a new entry for one of your habits.',

  // Entry form
  'entryForm.noHabits': 'No habit definitions yet. Add one in Settings before logging.',
  'entryForm.habit': 'Habit',
  'entryForm.date': 'Date',
  'entryForm.duration': 'Duration (min)',
  'entryForm.distance': 'Distance (km)',
  'entryForm.weight': 'Weight (kg)',
  'entryForm.repetitions': 'Repetitions',
  'entryForm.notes': 'Notes',
  'entryForm.words': 'Words',
  'entryForm.time': 'Time (min)',
  'entryForm.costSpent': 'Cost spent',
  'entryForm.submit': 'Log entry',

  // Export section
  'export.title': 'Export CSV',
  'export.from': 'From',
  'export.to': 'To',
  'export.exporting': 'Exporting…',
  'export.export': 'Export',
  'export.error': 'Request failed:',

  // Settings
  'settings.title': 'Settings',
  'settings.eyebrow': 'arrangements',
  'settings.users.title': 'Users',
  'settings.users.description': 'Names that can log habits. The default user is pre-selected when logging.',
  'settings.users.placeholder': 'New user name',
  'settings.users.loading': 'Loading…',
  'settings.users.empty': 'No users yet. Add one above to get started.',
  'settings.users.default': 'Default',
  'settings.users.setDefaultPrefix': 'Set',
  'settings.users.setDefaultSuffix': 'as default',
  'settings.users.rename': 'Rename',
  'settings.habits.edit': 'Edit',
  'settings.users.saveName': 'Save name',
  'settings.users.cancelRename': 'Cancel rename',
  'settings.habits.title': 'Habit Definitions',
  'settings.habits.perUser': 'Habits for',
  'settings.habits.perUserSuffix': 'Each user has their own list.',
  'settings.habits.noUser': 'Add a user above to start defining habits.',
  'settings.habits.loading': 'Loading…',
  'settings.habits.empty': 'No habits yet.',
  'settings.habits.new': 'New',
  'settings.habits.negative': 'negative',
  'settings.habits.editTitle': 'Edit habit',
  'settings.habits.newTitle': 'New habit',
  'settings.habits.editDescription': 'Update the habit name, type, or whether it is positive.',
  'settings.habits.newDescription': 'Add a new habit for',
  'settings.habits.addSubmit': 'Add habit',
  'settings.habits.deleteTitle': 'Delete {name}?',
  'settings.habits.deleteBlocked': 'This habit has logged entries and cannot be deleted.',
  'settings.currency.title': 'Currency',
  'settings.currency.description': 'Used for displaying the "Cost spent" amount on bad habits. Shared across all users.',
  'settings.currency.label': 'Currency code',
  'settings.locale.title': 'Language',
  'settings.locale.description': 'Language and date formatting used across the app.',
  'settings.locale.label': 'Language',
  'settings.locale.en': 'English',
  'settings.locale.es': 'Spanish',

  // Habit types
  'habitType.workout': 'Workout',
  'habitType.writing': 'Writing',
  'habitType.custom': 'Custom',

  // Habit form
  'habitForm.name': 'Name',
  'habitForm.namePlaceholder': 'e.g. Running',
  'habitForm.type': 'Type',
  'habitForm.typeLocked': 'Type is locked because entries already exist for this habit.',
  'habitForm.positive': 'Positive habit',
  'habitForm.positiveHelp': 'Off = something you want less of (e.g. fast food).',

  // User switcher
  'userSwitcher.aria': 'Switch user',
} as const;

const es: Record<keyof typeof en, string> = {
  'app.title': 'Hábitos',

  'header.backToHome': 'Volver al inicio',
  'header.logEntry': 'Registrar entrada',
  'header.metrics': 'Métricas',
  'header.settings': 'Ajustes',

  'home.greeting': 'Hola,',
  'home.empty': 'Un registro tranquilo de pequeños actos.',
  'home.subtitle': 'Anota lo que hiciste. No lo que deberías haber hecho.',
  'home.thisWeek': 'esta semana',
  'home.recentEntries': 'entradas recientes',
  'home.filter.all': 'Todos los hábitos',
  'home.filter.aria': 'Filtrar por hábito',

  'action.cancel': 'Cancelar',
  'action.delete': 'Eliminar',
  'action.save': 'Guardar cambios',
  'action.add': 'Añadir',
  'action.loading': 'Cargando…',
  'action.cantUndo': 'Esta acción no se puede deshacer.',

  'metrics.eyebrow': 'la mirada larga',
  'metrics.title': 'Métricas',
  'metrics.subtitle': 'Los patrones surgen despacio. Léelos sin juzgar.',
  'metrics.weekly': 'Esta semana',
  'metrics.byHabit': 'Por hábito (últimos 3 meses)',
  'metrics.heatmaps': 'Mapas de calor',
  'metrics.heatmaps.eyebrow': 'últimos 6 meses',
  'metrics.loading': 'Cargando…',
  'metrics.noEntriesWeek': 'Sin entradas esta semana.',
  'metrics.noEntriesMonths': 'Sin entradas en los últimos 3 meses.',
  'metrics.noHabits': 'Aún no hay hábitos configurados.',
  'metrics.unknown': 'Desconocido',
  'metrics.entries': 'ENTRADAS',

  'summary.eyebrow': 'últimos 30 días',
  'summary.mostLogged': 'Más registrado',
  'summary.leastLogged': 'Menos registrado',
  'summary.badHabitCost': 'Coste total de malos hábitos',
  'summary.activeHabits': 'Hábitos activos',
  'summary.of': 'de',
  'summary.reps': 'rep.',

  'unit.min': 'min',
  'unit.km': 'km',
  'unit.kg': 'kg',
  'unit.reps': 'rep.',
  'unit.words': 'palabras',
  'unit.cost': 'coste',
  'unit.separator': ' · ',

  'entries.noUser': 'Añade un usuario en Ajustes para empezar a registrar.',
  'entries.empty': 'Sin entradas aún. Pulsa "Registrar" para añadir la primera.',
  'entries.seeMore': 'Ver más →',
  'entries.unknownHabit': 'Hábito desconocido',
  'entries.deleteTitle': '¿Eliminar esta entrada?',
  'entries.editAria': 'Editar entrada',
  'entries.deleteAria': 'Eliminar entrada',

  'logEntry.titleEdit': 'Editar entrada',
  'logEntry.titleNew': 'Registrar entrada',
  'logEntry.descriptionEdit': 'Actualiza los detalles de esta entrada.',
  'logEntry.descriptionNew': 'Registra una nueva entrada para uno de tus hábitos.',

  'entryForm.noHabits': 'Aún no hay hábitos. Añade uno en Ajustes antes de registrar.',
  'entryForm.habit': 'Hábito',
  'entryForm.date': 'Fecha',
  'entryForm.duration': 'Duración (min)',
  'entryForm.distance': 'Distancia (km)',
  'entryForm.weight': 'Peso (kg)',
  'entryForm.repetitions': 'Repeticiones',
  'entryForm.notes': 'Notas',
  'entryForm.words': 'Palabras',
  'entryForm.time': 'Tiempo (min)',
  'entryForm.costSpent': 'Coste',
  'entryForm.submit': 'Registrar entrada',

  'export.title': 'Exportar CSV',
  'export.from': 'Desde',
  'export.to': 'Hasta',
  'export.exporting': 'Exportando…',
  'export.export': 'Exportar',
  'export.error': 'La solicitud falló:',

  'settings.title': 'Ajustes',
  'settings.eyebrow': 'preferencias',
  'settings.users.title': 'Usuarios',
  'settings.users.description': 'Nombres que pueden registrar hábitos. El usuario por defecto se preselecciona al registrar.',
  'settings.users.placeholder': 'Nombre del nuevo usuario',
  'settings.users.loading': 'Cargando…',
  'settings.users.empty': 'Sin usuarios aún. Añade uno arriba para empezar.',
  'settings.users.default': 'Por defecto',
  'settings.users.setDefaultPrefix': 'Establecer',
  'settings.users.setDefaultSuffix': 'como predeterminado',
  'settings.users.rename': 'Renombrar',
  'settings.habits.edit': 'Editar',
  'settings.users.saveName': 'Guardar nombre',
  'settings.users.cancelRename': 'Cancelar renombre',
  'settings.habits.title': 'Definiciones de hábitos',
  'settings.habits.perUser': 'Hábitos de',
  'settings.habits.perUserSuffix': 'Cada usuario tiene su propia lista.',
  'settings.habits.noUser': 'Añade un usuario arriba para empezar a definir hábitos.',
  'settings.habits.loading': 'Cargando…',
  'settings.habits.empty': 'Aún no hay hábitos.',
  'settings.habits.new': 'Nuevo',
  'settings.habits.negative': 'negativo',
  'settings.habits.editTitle': 'Editar hábito',
  'settings.habits.newTitle': 'Nuevo hábito',
  'settings.habits.editDescription': 'Actualiza el nombre, tipo o dirección del hábito.',
  'settings.habits.newDescription': 'Añadir un nuevo hábito para',
  'settings.habits.addSubmit': 'Añadir hábito',
  'settings.habits.deleteTitle': '¿Eliminar {name}?',
  'settings.habits.deleteBlocked': 'Este hábito tiene entradas registradas y no puede eliminarse.',
  'settings.currency.title': 'Moneda',
  'settings.currency.description': 'Se usa para mostrar el "Coste" de los malos hábitos. Compartido entre todos los usuarios.',
  'settings.currency.label': 'Código de moneda',
  'settings.locale.title': 'Idioma',
  'settings.locale.description': 'Idioma y formato de fechas usados en toda la aplicación.',
  'settings.locale.label': 'Idioma',
  'settings.locale.en': 'Inglés',
  'settings.locale.es': 'Español',

  'habitType.workout': 'Entrenamiento',
  'habitType.writing': 'Escritura',
  'habitType.custom': 'Personalizado',

  'habitForm.name': 'Nombre',
  'habitForm.namePlaceholder': 'p.ej. Correr',
  'habitForm.type': 'Tipo',
  'habitForm.typeLocked': 'El tipo está bloqueado porque ya existen entradas para este hábito.',
  'habitForm.positive': 'Hábito positivo',
  'habitForm.positiveHelp': 'Desactivado = algo que quieres hacer menos (p.ej. comida rápida).',

  'userSwitcher.aria': 'Cambiar usuario',
};

const dictionaries: Record<LocaleCode, Record<string, string>> = { en, es };

export type TranslationKey = keyof typeof en;

let active: LocaleCode = 'en';

export function setActiveLocale(locale: LocaleCode): void {
  active = locale;
  setLocaleTag(locale);
}

export function getActiveLocale(): LocaleCode {
  return active;
}

export function t(key: TranslationKey, params?: Record<string, string>): string {
  const raw = dictionaries[active][key] ?? key;
  if (!params) return raw;
  return Object.entries(params).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), raw);
}
