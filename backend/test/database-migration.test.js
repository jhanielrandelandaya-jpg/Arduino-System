require('dotenv').config()

const assert = require('node:assert/strict')
const test = require('node:test')

process.env.MONGODB_DB = `migration_${process.pid}_${Date.now()}`

const { close, collection, getDatabase } = require('../config/database')

test('database layer connects to the configured MongoDB database and exposes collections', async () => {
  let database

  try {
    database = await getDatabase()
    assert.equal(database.databaseName, process.env.MONGODB_DB)

    const records = await collection('database_layer_test')
    await records.insertOne({ id: 'document-1', value: 'stored' })

    const storedRecord = await records.findOne({ id: 'document-1' })
    assert.equal(storedRecord.id, 'document-1')
    assert.equal(storedRecord.value, 'stored')
  } finally {
    try {
      if (database) await database.dropDatabase()
    } finally {
      await close()
    }
  }
})
