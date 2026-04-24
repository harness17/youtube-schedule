import * as m001 from './migrations/001_initial.js'
import * as m002 from './migrations/002_import_from_store.js'
import * as m003 from './migrations/003_archive_favorites.js'
import * as m004 from './migrations/004_notify_flag.js'
import * as m005 from './migrations/005_channel_accumulation.js'

export const migrations = [m001, m002, m003, m004, m005]
