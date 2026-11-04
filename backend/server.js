
const express = require('express')
const cors = require('cors')
require('dotenv').config()

const healthRoutes = require('./routes/healthRoutes')
const authRoutes = require('./routes/authRoutes')
const facultyRoutes = require('./routes/facultyRoutes')
const studentRoutes = require('./routes/studentRoutes')
const learningRoutes = require('./routes/learningRoutes')
const notificationRoutes = require('./routes/notificationRoutes')
const searchRoutes = require('./routes/searchRoutes')
const supportRoutes = require('./routes/supportRoutes')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/faculty', facultyRoutes)
app.use('/api/student', studentRoutes)
app.use('/api/learning', learningRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/support', supportRoutes)

app.get('/', (req, res) => {
  res.send('Arduino Website API is running!')
})

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`)
  })
}

module.exports = app
