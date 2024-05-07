import { Message, fromFarcasterTime } from '@farcaster/hub-nodejs'

import { db } from '../db/kysely.js'
import { log } from '../lib/logger.js'
import { breakIntoChunks, formatLinks } from '../lib/utils.js'

export async function insertLinks(msgs: Message[]) {
  const links = formatLinks(msgs)
  if (links.length === 0) return
  const chunks = breakIntoChunks(links, 1000)

  for (const chunk of chunks) {
    try {
      await db
        .insertInto('links')
        .values(chunk)
        .onConflict((oc) => oc.column('hash').doNothing())
        .execute()

      log.debug(`LINKS INSERTED`)
    } catch (error) {
      log.error(error, 'ERROR INSERTING LINKS')
      throw error
    }
  }
}

export async function deleteLinks(msgs: Message[]) {
  try {
    await db.transaction().execute(async (trx) => {
      for (const msg of msgs) {
        const data = msg.data!

        await trx
          .updateTable('links')
          .set({
            deletedAt: new Date(
              fromFarcasterTime(data.timestamp)._unsafeUnwrap()
            ),
          })
          .where('fid', '=', data.fid)
          .where('targetFid', '=', data.linkBody!.targetFid!)
          .execute()
      }
    })

    log.debug(`LINKS DELETED`)
  } catch (error) {
    log.error(error, 'ERROR DELETING LINKS')
    throw error
  }
}
