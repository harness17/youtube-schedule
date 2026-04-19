import * as m001 from './migrations/001_initial.js'
import * as m002 from './migrations/002_import_from_store.js'
import * as m003 from './migrations/003_archive_favorites.js'

export const migrations = [m001, m002, m003]
