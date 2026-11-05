import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  EmptyState,
  Field,
  PageHeader,
  SectionHeader,
} from '../components/DashboardUI.jsx'
import Icon from '../components/Icon.jsx'
import { useToast } from '../context/toast.js'

const createQuestion = (index) => ({
  id: `practice-question-${Date.now()}-${index}`,
  prompt: '',
  type: 'multiple_choice',
  options: ['', ''],
  answer: 0,
})

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

export default function StudentPracticeQuizzes({
  classes,
  practiceQuizzes,
  onCreate,
  onDelete,
  onStart,
  onSubmit,
}) {
  const notify = useToast()
  const [title, setTitle] = useState('')
  const [classId, setClassId] = useState(() => classes[0]?.id || '')
  const [questions, setQuestions] = useState([createQuestion(0)])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState(null)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [attemptResult, setAttemptResult] = useState(null)
  const answersRef = useRef(answers)
  const submitActiveRef = useRef(null)
  const timeoutSubmitted = useRef('')

  useEffect(() => {
    if (!active) return undefined
    const interval = window.setInterval(() => {
      const now = Date.now()
      const elapsedSeconds = Math.floor(
        (now - Date.parse(active.attempt.startedAt)) / 1000,
      )
      setCurrentTime(now)
      if (
        elapsedSeconds >= 600 &&
        timeoutSubmitted.current !== active.attempt.id
      ) {
        timeoutSubmitted.current = active.attempt.id
        submitActiveRef.current?.(answersRef.current)
      }
    }, 1000)
    return () => window.clearInterval(interval)
  }, [active])

  const remainingSeconds = useMemo(() => {
    if (!active) return 0
    return Math.max(
      0,
      600 -
        Math.floor((currentTime - Date.parse(active.attempt.startedAt)) / 1000),
    )
  }, [active, currentTime])

  const classNameFor = (id) =>
    classes.find((learningClass) => learningClass.id === id)?.className ||
    classes.find((learningClass) => learningClass.id === id)?.class_name ||
    'Class'

  const effectiveClassId = classId || classes[0]?.id || ''

  const updateQuestion = (index, changes) => {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...changes } : question,
      ),
    )
  }

  const createQuiz = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const selectedClassId = classId || classes[0]?.id || ''
      const normalizedQuestions = questions.map((question) => {
        const prompt = question.prompt.trim()
        if (question.type === 'multiple_choice') {
          const options = question.options
            .map((option, optionIndex) => ({
              text: option.trim(),
              optionIndex,
            }))
            .filter(({ text }) => text)
          const answerIndex = options.findIndex(
            ({ optionIndex }) => optionIndex === Number(question.answer),
          )
          if (options.length < 2 || answerIndex < 0) {
            throw new Error('Each multiple-choice question needs at least two options and a correct answer.')
          }
          return {
            ...question,
            prompt,
            options: options.map(({ text }) => text),
            answer: answerIndex,
          }
        }
        if (!String(question.answer).trim()) {
          throw new Error('Enter the correct answer for each short-answer question.')
        }
        return { ...question, prompt, answer: String(question.answer).trim() }
      })
      await onCreate({ title, classId: selectedClassId, questions: normalizedQuestions })
      setTitle('')
      setQuestions([createQuestion(0)])
      notify('Private practice quiz created.')
    } catch (createError) {
      setError(createError.message || 'Could not create the practice quiz.')
    } finally {
      setSaving(false)
    }
  }

  const startQuiz = async (quiz) => {
    setError('')
    setAttemptResult(null)
    try {
      const result = await onStart(quiz.id)
      setAnswers({})
      setCurrentTime(Date.parse(result.attempt.startedAt))
      timeoutSubmitted.current = ''
      setActive({ quiz, attempt: result.attempt })
    } catch (startError) {
      setError(startError.message || 'Could not start this practice quiz.')
    }
  }

  const submitAnswers = useCallback(
    async (answersToSubmit) => {
      if (!active || timeoutSubmitted.current === active.attempt.id) return
      timeoutSubmitted.current = active.attempt.id
      setSubmitting(true)
      setError('')
      try {
        const result = await onSubmit(
          active.quiz.id,
          active.attempt.id,
          answersToSubmit,
        )
        setAttemptResult({ quizId: active.quiz.id, ...result })
        setActive(null)
        notify(result.passed ? 'Practice quiz passed.' : 'Practice quiz submitted.')
      } catch (submitError) {
        timeoutSubmitted.current = ''
        setError(submitError.message || 'Could not submit this practice quiz.')
      } finally {
        setSubmitting(false)
      }
    },
    [active, notify, onSubmit],
  )

  useEffect(() => {
    answersRef.current = answers
  }, [answers])
  useEffect(() => {
    submitActiveRef.current = submitAnswers
  }, [submitAnswers])

  const deleteQuiz = async (quiz) => {
    if (!window.confirm(`Delete "${quiz.title}" and its practice attempts?`)) {
      return
    }
    try {
      await onDelete(quiz.id)
      notify('Practice quiz deleted.')
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete the practice quiz.')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Independent study"
        title="Private practice quizzes"
        description="Create quizzes for your own study. Only you can view, take, or delete them; they are not included in faculty reports."
      />

      <div className="lms-practice-quizzes">
      {error && (
        <p className="lms-inline-error" role="alert">
          {error}
        </p>
      )}

      {active ? (
        <section className="lms-card lms-card-pad">
          <SectionHeader
            title={active.quiz.title}
            description={`${classNameFor(active.quiz.classId)} · ${active.quiz.questions.length} questions`}
            action={
              <Badge tone={remainingSeconds < 60 ? 'warning' : 'info'}>
                <Icon name="clock" size={13} /> {formatTime(remainingSeconds)}
              </Badge>
            }
          />
          <form
            className="lms-form-grid"
            onSubmit={(event) => {
              event.preventDefault()
              submitAnswers(answers)
            }}
          >
            {active.quiz.questions.map((question, index) => (
              <Field
                key={question.id}
                label={`${index + 1}. ${question.prompt}`}
                className="lms-field-full"
              >
                {question.type === 'multiple_choice' ? (
                  <select
                    value={answers[question.id] ?? ''}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: event.target.value,
                      }))
                    }
                    required
                    disabled={submitting || remainingSeconds === 0}
                  >
                    <option value="" disabled>
                      Select an answer
                    </option>
                    {question.options.map((option, optionIndex) => (
                      <option key={`${question.id}-${optionIndex}`} value={optionIndex}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={answers[question.id] || ''}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: event.target.value,
                      }))
                    }
                    required
                    disabled={submitting || remainingSeconds === 0}
                  />
                )}
              </Field>
            ))}
            <button
              type="submit"
              className="lms-btn lms-btn-primary lms-field-full"
              disabled={submitting || remainingSeconds === 0}
            >
              {submitting ? 'Submitting...' : 'Submit practice quiz'}
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="lms-card lms-card-pad">
            <SectionHeader
              title="Create a practice quiz"
              description="Use up to 20 questions. Practice quizzes are private to your account."
            />
            {classes.length === 0 ? (
              <EmptyState
                icon="book"
                title="Join a class first"
                description="Practice quizzes are organized under one of your enrolled classes."
              />
            ) : (
              <form className="lms-form-grid" onSubmit={createQuiz}>
                <Field label="Quiz title">
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={200}
                    required
                  />
                </Field>
                <Field label="Subject">
                  <select
                    value={effectiveClassId}
                    onChange={(event) => setClassId(event.target.value)}
                    required
                  >
                    {classes.map((learningClass) => (
                      <option value={learningClass.id} key={learningClass.id}>
                        {learningClass.subjectCode || learningClass.subject_code || learningClass.className || learningClass.class_name}
                      </option>
                    ))}
                  </select>
                </Field>
                {questions.map((question, index) => (
                  <article className="lms-field-full lms-card lms-card-pad" key={question.id}>
                    <SectionHeader
                      title={`Question ${index + 1}`}
                      action={
                        questions.length > 1 ? (
                          <button
                            type="button"
                            className="lms-btn lms-btn-secondary lms-btn-sm"
                            onClick={() =>
                              setQuestions((current) =>
                                current.filter((_, itemIndex) => itemIndex !== index),
                              )
                            }
                          >
                            Remove
                          </button>
                        ) : null
                      }
                    />
                    <div className="lms-form-grid">
                      <Field label="Question type">
                        <select
                          value={question.type}
                          onChange={(event) =>
                            updateQuestion(index, {
                              type: event.target.value,
                              options: ['', ''],
                              answer: event.target.value === 'multiple_choice' ? 0 : '',
                            })
                          }
                        >
                          <option value="multiple_choice">Multiple choice</option>
                          <option value="short_answer">Short answer</option>
                        </select>
                      </Field>
                      <Field label="Question">
                        <input
                          value={question.prompt}
                          onChange={(event) =>
                            updateQuestion(index, { prompt: event.target.value })
                          }
                          required
                        />
                      </Field>
                      {question.type === 'multiple_choice' ? (
                        <>
                          <Field
                            label="Answer options"
                            hint="Enter one option per line (at least two)."
                            className="lms-field-full"
                          >
                            <textarea
                              value={question.options.join('\n')}
                              onChange={(event) =>
                                updateQuestion(index, {
                                  options: event.target.value.split('\n'),
                                })
                              }
                              required
                            />
                          </Field>
                          <Field label="Correct option">
                            <select
                              value={question.answer}
                              onChange={(event) =>
                                updateQuestion(index, { answer: Number(event.target.value) })
                              }
                            >
                              {question.options
                                .map((option, optionIndex) => ({ option, optionIndex }))
                                .filter(({ option }) => option.trim())
                                .map(({ option, optionIndex }) => (
                                  <option value={optionIndex} key={optionIndex}>
                                    {option.trim()}
                                  </option>
                                ))}
                            </select>
                          </Field>
                        </>
                      ) : (
                        <Field label="Correct answer" className="lms-field-full">
                          <input
                            value={question.answer}
                            onChange={(event) =>
                              updateQuestion(index, { answer: event.target.value })
                            }
                            required
                          />
                        </Field>
                      )}
                    </div>
                  </article>
                ))}
                <div className="lms-field-full lms-form-actions">
                  <button
                    type="button"
                    className="lms-btn lms-btn-secondary"
                    onClick={() =>
                      setQuestions((current) => [
                        ...current,
                        createQuestion(current.length),
                      ])
                    }
                    disabled={questions.length >= 20}
                  >
                    <Icon name="plus" size={15} /> Add question
                  </button>
                  <button
                    type="submit"
                    className="lms-btn lms-btn-primary"
                    disabled={saving}
                  >
                    {saving ? 'Creating...' : 'Create private quiz'}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="lms-card lms-card-pad">
            <SectionHeader
              title="Your practice quizzes"
              description="Each quiz has a 10-minute limit and a 75% passing score. Failed attempts can be retaken."
            />
            {practiceQuizzes.length === 0 ? (
              <EmptyState
                icon="quiz"
                title="No practice quizzes yet"
                description="Create a quiz above to begin reviewing your course material."
              />
            ) : (
              <div className="lms-card-grid">
                {practiceQuizzes.map((quiz) => (
                  <article className="lms-card lms-card-pad" key={quiz.id}>
                    <div className="lms-reader-meta">
                      <Badge tone={quiz.passed ? 'success' : 'info'}>
                        {quiz.passed ? 'Passed' : 'Private'}
                      </Badge>
                      <Badge tone="neutral">
                        {quiz.questions.length} questions
                      </Badge>
                    </div>
                    <h3>{quiz.title}</h3>
                    <p>{classNameFor(quiz.classId)}</p>
                    <p>
                      {quiz.attempts.length} attempts
                      {quiz.attempts.length > 0
                        ? ` · Best score ${quiz.bestScore}%`
                        : ''}
                    </p>
                    <div className="lms-table-actions">
                      <button
                        type="button"
                        className="lms-btn lms-btn-primary lms-btn-sm"
                        onClick={() => startQuiz(quiz)}
                        disabled={quiz.passed}
                      >
                        <Icon name="quiz" size={14} />
                        {quiz.passed ? 'Passed' : 'Start quiz'}
                      </button>
                      <button
                        type="button"
                        className="lms-btn lms-btn-secondary lms-btn-sm"
                        onClick={() => deleteQuiz(quiz)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {attemptResult && (
        <section className="lms-card lms-card-pad" role="status">
          <h2>{attemptResult.passed ? 'Practice quiz passed' : 'Practice quiz result'}</h2>
          <p>
            Score: {attemptResult.score}% ({attemptResult.correctCount}/
            {attemptResult.questionCount} correct). Passing score: 75%.
          </p>
          {!attemptResult.passed && <p>You can retake this private practice quiz.</p>}
        </section>
      )}
      </div>
    </>
  )
}
