const QUIZ_TIME_LIMIT_MINUTES = 10
const PASSING_SCORE = 75
const MAX_QUIZ_QUESTIONS = 20

const isCorrectAnswer = (answer, question) => {
  const expected =
    question.answer ?? question.correctAnswers ?? question.correct_answer
  if (answer === undefined || expected === undefined) return false
  if (Array.isArray(expected)) {
    if (!Array.isArray(answer) || answer.length !== expected.length) return false
    const actualValues = answer.map(String).sort()
    const expectedValues = expected.map(String).sort()
    return actualValues.every((value, index) => value === expectedValues[index])
  }
  if (typeof answer === 'string' && typeof expected === 'string') {
    return answer.trim().toLowerCase() === expected.trim().toLowerCase()
  }
  return String(answer) === String(expected)
}

const scoreQuiz = (questions, answers, timedOut = false) => {
  const correctCount = timedOut
    ? 0
    : questions.reduce(
        (total, question) =>
          total + (isCorrectAnswer(answers[question.id], question) ? 1 : 0),
        0,
      )
  const score = questions.length
    ? Math.round((correctCount / questions.length) * 100)
    : 0
  return {
    correctCount,
    score,
    passed: !timedOut && score >= PASSING_SCORE,
  }
}

module.exports = {
  QUIZ_TIME_LIMIT_MINUTES,
  PASSING_SCORE,
  MAX_QUIZ_QUESTIONS,
  isCorrectAnswer,
  scoreQuiz,
}
