import * as m001 from './migrations/001_initial.js'
import * as m002 from './migrations/002_import_from_store.js'
import * as m003 from './migrations/003_archive_favorites.js'
import * as m004 from './migrations/004_notify_flag.js'
import * as m005 from './migrations/005_channel_accumulation.js'
import * as m006 from './migrations/006_favorite_order.js'
import * as m007 from './migrations/007_video_source.js'
import * as m008 from './migrations/008_video_duration.js'
import * as m009 from './migrations/009_video_published_at.js'
import * as m010 from './migrations/010_membership_flag.js'
import * as m011 from './migrations/011_channel_logical_delete.js'
import * as m012 from './migrations/012_playlist_sync.js'

export const migrations = [m001, m002, m003, m004, m005, m006, m007, m008, m009, m010, m011, m012]
