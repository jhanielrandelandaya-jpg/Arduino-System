const { MongoClient } = require('mongodb')

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
const databaseName = process.env.MONGODB_DB || 'learnspace'

const client = new MongoClient(uri)
let database

const getDatabase = async () => {
  if (!database) {
    await client.connect()
    database = client.db(databaseName)
  }
  return database
}

const close = async () => {
  await client.close().catch(() => {})
  database = null
}

const collection = async (name) => (await getDatabase()).collection(name)

module.exports = { getDatabase, close, collection }
