const { getDatabase } = require('./config/database')

const db = getDatabase()

async function main() {
  const collections = await db.listCollections().toArray()
  for (const collection of collections) {
    const name = collection.name
    const collectionDb = db.collection(name)
    const count = await collectionDb.countDocuments({})
    console.log(`=== ${name} ===`)
    console.log(`COUNT: ${count}`)
    if (name === 'users') {
      const users = await collectionDb.find({}).limit(20).toArray()
      for (const r of users) console.log(`${r.full_name} | ${r.role} | ${r.username}`)
    } else if (name === 'classes') {
      const classes = await collectionDb.find({}).limit(20).toArray()
      for (const r of classes) console.log(`${r.class_name} | ${r.class_code}`)
    } else if (name === 'quizzes') {
      const quizzes = await collectionDb.find({}).limit(20).toArray()
      for (const r of quizzes) console.log(`${r.quiz_title} | class:${r.class_id}`)
    }
    console.log('')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
