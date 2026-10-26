
const express = require('express')
const cors = require('cors')
require('dotenv').config()

const healthRoutes = require('./routes/healthRoutes')
const authRoutes = require('./routes/authRoutes')
const facultyRoutes = require('./routes/facultyRoutes')
const learningRoutes = require('./routes/learningRoutes')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/faculty', facultyRoutes)
app.use('/api/learning', learningRoutes)

app.get('/', (req, res) => {
  res.send('Arduino Website API is running!')
})

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`)
})
