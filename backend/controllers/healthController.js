
const getHealth = (req, res) => {
  res.json({
    status: 'success',
    message: 'Arduino Website API is running!',
  })
}

module.exports = { getHealth }
