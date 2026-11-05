import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import DashboardLayout from '../layout/DashboardLayout.jsx'
import ToastProvider from '../components/ToastProvider.jsx'
import Icon from '../components/Icon.jsx'
import {
  Badge,
  DonutChart,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  ProgressBar,
  ProgressRing,
  SectionHeader,
} from '../components/DashboardUI.jsx'
import { useToast } from '../context/toast.js'
import { useLearningData } from '../hooks/useLearningData.js'
import ClassroomWorkspace from './ClassroomWorkspace.jsx'
import StudentAttachmentPreview from './StudentAttachmentPreview.jsx'
import StudentPracticeQuizzes from './StudentPracticeQuizzes.jsx'

const NOTES_KEY = 'learnspace_student_notes'

const formatDate = (value) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Recently'
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const formatRelativeTime = (value) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Recently'
  }

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d ago`
  return formatDate(value)
}

const hashSeed = (value) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const createSeededRandom = (seed) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const shuffleQuestionsForStudent = (questionList, studentId, quizId) => {
  if (!Array.isArray(questionList) || questionList.length < 2 || !studentId) {
    return questionList
  }

  const random = createSeededRandom(hashSeed(`${studentId}:${quizId}`))
  const shuffled = [...questionList]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }
  return shuffled
}

const sharedQuizForStudent = (quiz, progress = {}, studentId = '') => {
  return {
    ...quiz,
    title: quiz.quizTitle,
    type: 'Faculty quiz',
    subjectId: quiz.classId,
    subjectCode: quiz.subjectCode,
    facultyStatus: quiz.status,
    status:
      progress.status ||
      (quiz.status === 'Draft'
        ? 'Draft'
        : quiz.locked
          ? 'Locked'
          : quiz.passed
          ? 'Passed'
          : quiz.attemptsUsed > 0
            ? 'Retake available'
            : 'Available'),
    attemptsAllowed: null,
    attemptsUsed: progress.attemptsUsed ?? quiz.attemptsUsed ?? 0,
    bestScore: progress.bestScore ?? quiz.bestScore ?? null,
    passed: progress.passed ?? quiz.passed ?? false,
    due: quiz.dueDate || 'No deadline',
    questionList: shuffleQuestionsForStudent(
      quiz.questionList || [],
      studentId,
      quiz.id,
    ),
  }
}

const loadNotes = (userId) => {
  try {
    const stored = window.localStorage.getItem(`${NOTES_KEY}_${userId}`)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch {
    // Notes remain empty when browser storage is unavailable.
  }

  return []
}

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function StudentDashboard({ user, onLogout, onUserUpdate }) {
  return (
    <ToastProvider>
      <StudentWorkspace
        user={user}
        onLogout={onLogout}
        onUserUpdate={onUserUpdate}
      />
    </ToastProvider>
  )
}

function StudentWorkspace({ user, onLogout, onUserUpdate }) {
  const {
    classes,
    quizzes: sharedQuizzes,
    slides,
    classwork,
    quizAttempts,
    practiceQuizzes,
    activity,
    enrollClass,
    getClassAnnouncements,
    getClassPeople,
    addAnnouncementComment,
    getClasswork,
    submitClasswork,
    downloadClassworkAttachment,
    previewClassworkAttachment,
    downloadSubmissionFile,
    startQuizAttempt,
    submitQuizAttempt,
    createPracticeQuiz,
    deletePracticeQuiz,
    startPracticeQuizAttempt,
    submitPracticeQuizAttempt,
    getStudentNotes,
    createStudentNote,
    updateStudentNote,
    deleteStudentNote,
    downloadSlideFile,
    loadSlideFilePreview,
    syncedAt,
    loading: sharedLoading,
    error,
    refresh,
  } = useLearningData({ role: 'Student' })
  const [quizProgress, setQuizProgress] = useState({})

  const quizzes = useMemo(
    () =>
      sharedQuizzes.map((quiz) =>
        sharedQuizForStudent(quiz, quizProgress[quiz.id], user.id),
      ),
    [quizProgress, sharedQuizzes, user.id],
  )

  const results = useMemo(
    () =>
      quizAttempts.map((attempt) => ({
        id: attempt.id,
        quiz: attempt.quizTitle,
        quizId: attempt.quizId,
        classId: attempt.classId,
        subjectCode: attempt.subjectCode,
        date: formatDate(attempt.submittedAt),
        score: attempt.score,
        passing: attempt.passing,
        attempt: 'Latest',
        status: attempt.passed ? 'Passed' : 'Failed',
      })),
    [quizAttempts],
  )

  const handleQuizComplete = async (quiz, answers) => {
    const result = await submitQuizAttempt(quiz.id, quiz.attemptId, answers)

    setQuizProgress((current) => {
      const previous = current[quiz.id] || {}
      return {
        ...current,
        [quiz.id]: {
          attemptsUsed: (previous.attemptsUsed || quiz.attemptsUsed || 0) + 1,
          bestScore: Math.max(previous.bestScore || 0, result.score),
          passed: result.passed,
          status: result.passed ? 'Passed' : 'Retake available',
        },
      }
    })
    return result
  }

  const handleQuizStart = (quiz) => startQuizAttempt(quiz.id)

  return (
    <DashboardLayout
      role="Student"
      user={user}
      onLogout={onLogout}
      onUserUpdate={onUserUpdate}
    >
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <StudentOverview
              user={user}
              classes={classes}
              quizzes={quizzes}
              slides={slides}
              activity={activity}
              syncedAt={syncedAt}
              syncing={sharedLoading}
              loading={sharedLoading}
              error={error}
              onRetry={refresh}
              onEnroll={enrollClass}
            />
          }
        />
        <Route
          path="subjects"
          element={
            <StudentSubjects
              classes={classes}
              quizzes={quizzes}
              slides={slides}
              loading={sharedLoading}
              error={error}
              onRetry={refresh}
              onEnroll={enrollClass}
              classwork={classwork}
              getClasswork={getClasswork}
              addAnnouncementComment={addAnnouncementComment}
              submitClasswork={submitClasswork}
              downloadClassworkAttachment={downloadClassworkAttachment}
              previewClassworkAttachment={previewClassworkAttachment}
              downloadSubmissionFile={downloadSubmissionFile}
              getAnnouncements={getClassAnnouncements}
              getPeople={getClassPeople}
              onDownloadFile={downloadSlideFile}
              onPreviewFile={loadSlideFilePreview}
              onQuizStart={handleQuizStart}
              onQuizComplete={handleQuizComplete}
            />
          }
        />
        <Route
          path="lessons"
          element={
            <StudentLessons
              slides={slides}
              classes={classes}
              classwork={classwork}
              quizzes={quizzes}
              results={results}
              onDownloadClassworkAttachment={downloadClassworkAttachment}
              onPreviewClassworkAttachment={previewClassworkAttachment}
              onDownloadFile={downloadSlideFile}
              onPreviewSlideFile={loadSlideFilePreview}
            />
          }
        />
        <Route
          path="presentations/*"
          element={<Navigate to="/student/lessons" replace />}
        />
        <Route
          path="notes"
          element={
            <StudentNotes
              userId={user.id}
              slides={slides}
              getNotes={getStudentNotes}
              createNoteRequest={createStudentNote}
              updateNoteRequest={updateStudentNote}
              deleteNoteRequest={deleteStudentNote}
            />
          }
        />
        <Route path="quizzes" element={<Navigate to="subjects" replace />} />
        <Route
          path="practice-quizzes"
          element={
            <StudentPracticeQuizzes
              classes={classes}
              practiceQuizzes={practiceQuizzes}
              onCreate={createPracticeQuiz}
              onDelete={deletePracticeQuiz}
              onStart={startPracticeQuizAttempt}
              onSubmit={submitPracticeQuizAttempt}
            />
          }
        />
        <Route path="results" element={<StudentResults results={results} />} />
        <Route
          path="progress"
          element={
            <StudentProgress
              classes={classes}
              quizzes={quizzes}
              slides={slides}
              results={results}
            />
          }
        />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  )
}

function StudentJoinClassForm({ onEnroll }) {
  const notify = useToast()
  const [classCode, setClassCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  const joinClass = async (event) => {
    event.preventDefault()
    setJoining(true)
    setError('')

    try {
      await onEnroll(classCode.trim())
      setClassCode('')
      notify('Class joined successfully.')
    } catch (joinError) {
      setError(joinError.message)
      notify(joinError.message, 'error')
    } finally {
      setJoining(false)
    }
  }

  return (
    <form className="lms-toolbar lms-student-join-form" onSubmit={joinClass}>
      <div className="lms-student-join-intro">
        <span className="lms-student-join-icon">
          <Icon name="plus" size={17} />
        </span>
        <div>
          <strong>Join a class</strong>
          <span>Enter the invitation code shared by your faculty.</span>
        </div>
      </div>
      <Field
        label="Class code"
        className="lms-student-join-field"
      >
        <input
          type="text"
          value={classCode}
          onChange={(event) => {
            setClassCode(event.target.value)
            setError('')
          }}
          placeholder="e.g. CS101-AB12"
          autoComplete="off"
          spellCheck="false"
          maxLength={32}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'student-join-error' : undefined}
          disabled={joining}
          required
        />
        {error && (
          <span
            id="student-join-error"
            className="lms-inline-error"
            role="alert"
          >
            {error}
          </span>
        )}
      </Field>
      <button
        type="submit"
        className="lms-btn lms-btn-primary"
        disabled={joining || !classCode.trim()}
      >
        {joining ? (
          <>
            <span className="lms-search-spinner" />
            Joining...
          </>
        ) : (
          <>
            <Icon name="plus" size={15} />
            Join class
          </>
        )}
      </button>
    </form>
  )
}

function StudentOverview({
  user,
  classes,
  quizzes,
  slides,
  activity,
  syncedAt,
  syncing,
  loading,
  error,
  onRetry,
  onEnroll,
}) {
  const firstName = user.fullName.split(' ')[0]
  const activeClasses = classes.filter(
    (subject) => subject.status !== 'Archived',
  )
  const assignedQuizzes = quizzes.filter((quiz) => quiz.type === 'Faculty quiz')
  const passedQuizzes = assignedQuizzes.filter(
    (quiz) => quiz.passed || quiz.status === 'Passed',
  ).length
  const overallProgress = assignedQuizzes.length
    ? Math.round((passedQuizzes / assignedQuizzes.length) * 100)
    : 0
  const progressMessage = assignedQuizzes.length
    ? `You’ve passed ${passedQuizzes} of ${assignedQuizzes.length} assigned quizzes. Keep learning at your own pace.`
    : 'Your quiz progress will appear here when your teachers assign assessments.'
  const continueLearning = slides.slice(0, 2).map((slide) => ({
    lesson: {
      ...slide,
      duration: `${slide.content.length} slides`,
    },
    subject: classes.find((subject) => subject.id === slide.classId),
  }))
  const liveNow = null
  const totalLessons = slides.length

  return (
    <div className="lms-student-overview">
      <section className="lms-welcome-banner">
        <div className="lms-welcome-copy">
          <span className="lms-hero-eyebrow">
            <Icon name="sparkles" size={13} />
            {getGreeting()} · Student workspace
          </span>
          <h1>
            Welcome back, {firstName} <span aria-hidden="true">👋</span>
          </h1>
          <p>{progressMessage}</p>
          <div className="lms-welcome-actions">
            <Link
              to="/student/lessons"
              className="lms-btn lms-btn-primary lms-welcome-cta"
            >
              Continue Learning
              <Icon name="arrowRight" size={15} />
            </Link>
            <Link
              to="/student/progress"
              className="lms-btn lms-btn-on-dark-outline"
            >
              View learning path
            </Link>
          </div>
        </div>

        <div className="lms-welcome-metrics">
          <div className="lms-welcome-metric">
            <span className="lms-welcome-metric-icon">
              <Icon name="trend" size={16} />
            </span>
            <strong>{overallProgress}%</strong>
            <span className="lms-welcome-metric-label">Quiz progress</span>
            <small>
              {passedQuizzes} of {assignedQuizzes.length} passed
            </small>
          </div>
          <div className="lms-welcome-metric">
            <span className="lms-welcome-metric-icon">
              <Icon name="book" size={16} />
            </span>
            <strong>{totalLessons}</strong>
            <span className="lms-welcome-metric-label">Lessons available</span>
            <small>Across your classes</small>
          </div>
          <div className="lms-welcome-metric">
            <span className="lms-welcome-metric-icon">
              <Icon name="check" size={16} />
            </span>
            <strong>{passedQuizzes}</strong>
            <span className="lms-welcome-metric-label">Quizzes passed</span>
            <small>Keep up the great work</small>
          </div>
        </div>
      </section>

      {error && (
        <div className="lms-dashboard-notice lms-dashboard-notice-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="lms-btn lms-btn-secondary lms-btn-sm"
            onClick={() => onRetry()}
            disabled={loading}
          >
            Try again
          </button>
        </div>
      )}

      {loading && (
        <div className="lms-dashboard-data-state" role="status">
          <span className="lms-search-spinner" />
          Loading your classes and learning progress...
        </div>
      )}

      <section className="lms-student-section">
        <div className="lms-student-section-head">
          <div>
            <h2>My Classes</h2>
            <p>Every class your teachers have shared with you.</p>
          </div>
          <Link to="/student/subjects" className="lms-link">
            View all classes <Icon name="arrowRight" size={13} />
          </Link>
        </div>

        <StudentJoinClassForm onEnroll={onEnroll} />

        <div className="lms-student-class-grid" aria-busy={loading}>
          {activeClasses.slice(0, 4).map((subject) => (
            <article className="lms-student-class-card" key={subject.id}>
              <div className="lms-student-class-top">
                <span
                  className={`lms-subject-code lms-tone-${subject.accent || 'blue'}`}
                >
                  {subject.subjectCode}
                </span>
                <Badge
                  tone={subject.status === 'Published' ? 'success' : 'neutral'}
                  dot
                >
                  {subject.status}
                </Badge>
                {subject.pendingClasswork > 0 && (
                  <Badge tone="warning">
                    {subject.pendingClasswork} pending
                  </Badge>
                )}
              </div>
              <span className="lms-student-class-subject">
                {subject.subject}
              </span>
              <h3>{subject.className}</h3>
              <p>{subject.description}</p>
              <div className="lms-student-class-meta">
                <span>
                  <Icon name="calendar" size={12} /> {subject.term}
                </span>
                <span>
                  <Icon name="user" size={12} /> {subject.teacherName}
                </span>
              </div>
              <div className="lms-student-class-foot">
                <span>
                  <Icon name="layers" size={12} /> {subject.lessons} lessons ·{' '}
                  {subject.quizzes} quizzes
                </span>
                <span>Added {formatDate(subject.createdDate)}</span>
              </div>
              <Link
                to={`/student/subjects?classId=${encodeURIComponent(subject.id)}`}
                className="lms-link lms-student-class-open"
              >
                Open class <Icon name="arrowRight" size={12} />
              </Link>
            </article>
          ))}
        </div>

        {loading && activeClasses.length === 0 ? (
          <p className="lms-cell-muted" role="status">
            Loading your enrolled classes...
          </p>
        ) : activeClasses.length === 0 && !error ? (
          <div className="lms-card">
            <EmptyState
              icon="book"
              title="You haven’t joined any classes yet"
              description="Enter the class code your teacher shared to join your first class."
            />
          </div>
        ) : null}
      </section>

      <section className="lms-student-section">
        <div className="lms-student-section-head">
          <div>
            <h2>Assigned Quizzes</h2>
            <p>Published assessments from your classes, always up to date.</p>
          </div>
          <Link to="/student/subjects" className="lms-link">
            Open classes
            <Icon name="arrowRight" size={13} />
          </Link>
        </div>

        <div className="lms-student-quiz-grid">
          {assignedQuizzes.slice(0, 4).map((quiz) => (
            <article className="lms-student-quiz-card" key={quiz.id}>
              <div className="lms-student-quiz-top">
                <span className="lms-student-quiz-icon">
                  <Icon name="quiz" size={17} />
                </span>
                <Badge tone="info" dot>
                  {quiz.status}
                </Badge>
              </div>
              <span className="lms-student-quiz-subject">
                {quiz.subjectCode}
              </span>
              <h3>{quiz.title}</h3>
              <div className="lms-student-quiz-meta">
                <span>
                  <Icon name="calendar" size={12} /> Due {quiz.due}
                </span>
                <span>
                  <Icon name="clock" size={12} /> {quiz.timeLimit} min
                </span>
              </div>
              <div className="lms-student-quiz-foot">
                <span>{quiz.questions} questions · {quiz.passing}% to pass</span>
                <Link
                  to={`/student/subjects?classId=${encodeURIComponent(quiz.classId)}`}
                  className="lms-link"
                >
                  Open class
                  <Icon name="arrowRight" size={12} />
                </Link>
              </div>
            </article>
          ))}
        </div>

        {assignedQuizzes.length === 0 && (
          <div className="lms-card">
            <EmptyState
              icon="quiz"
              title="No assigned quizzes yet"
              description="Published quizzes from your teachers will show up here."
            />
          </div>
        )}
      </section>

      <div className="lms-student-overview-grid">
        <div className="lms-student-main">
          <section className="lms-student-section">
            <div className="lms-student-section-head">
              <div>
                <h2>Continue Learning</h2>
                <p>Pick up exactly where you left off.</p>
              </div>
              <Link to="/student/lessons" className="lms-link">
                View all lessons
                <Icon name="arrowRight" size={13} />
              </Link>
            </div>

            <div className="lms-continue-list">
              {continueLearning.map(({ lesson, subject }) => (
                <article className="lms-continue-card" key={lesson.id}>
                  <div
                    className={`lms-continue-thumb lms-thumb-${subject?.accent || 'blue'}`}
                  >
                    <Icon name="presentation" size={25} />
                    <span>{lesson.subjectCode}</span>
                  </div>
                  <div className="lms-continue-body">
                    <div className="lms-continue-head">
                      <span>{subject?.className}</span>
                      <Badge tone="neutral">
                        <Icon name="clock" size={11} /> {lesson.duration}
                      </Badge>
                    </div>
                    <h3>{lesson.title}</h3>
                    <ProgressBar
                      label="Complete"
                      value={subject?.progress || 0}
                      tone={subject?.accent || 'blue'}
                    />
                  </div>
                  <Link
                    to="/student/lessons"
                    className="lms-btn lms-btn-primary lms-btn-sm lms-continue-cta"
                  >
                    Resume Lesson
                    <Icon name="arrowRight" size={13} />
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section className="lms-card lms-card-pad lms-live-card">
            <SectionHeader
              title="Upcoming Live Classes"
              description="Join your next sessions or set a reminder."
              action={
                <span className="lms-chip">
                  <Icon name="monitor" size={13} />
                  {liveNow ? '1 class live now' : 'Next class soon'}
                </span>
              }
            />

            <div className="lms-live-table-wrap">
              <table className="lms-table lms-live-table">
                <thead>
                  <tr>
                    <th>Class name</th>
                    <th>Instructor</th>
                    <th>Time</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {!liveNow && (
                  <tr>
                    <td colSpan="4" className="lms-cell-muted">
                      Live class schedules are not available yet.
                    </td>
                  </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="lms-student-rail">
          <section className="lms-card lms-card-pad lms-update-card">
            <div className="lms-update-head">
              <div>
                <h2>Recent Updates</h2>
                <p>Changes made by your teachers.</p>
              </div>
              <span className={`lms-live-pill ${syncing ? 'is-syncing' : ''}`}>
                <span />
                {syncing ? 'Syncing' : 'Live'}
              </span>
            </div>

            <div className="lms-update-list">
              {activity.slice(0, 6).map((item) => (
                <article className="lms-update-item" key={item.id}>
                  <span
                    className={`lms-update-icon ${
                      item.entityType === 'quiz'
                        ? 'lms-tone-violet'
                        : 'lms-tone-blue'
                    }`}
                  >
                    <Icon
                      name={item.entityType === 'quiz' ? 'quiz' : 'book'}
                      size={14}
                    />
                  </span>
                  <div>
                    <strong>{item.message}</strong>
                    <span>{formatRelativeTime(item.createdAt)}</span>
                  </div>
                </article>
              ))}
            </div>

            {activity.length === 0 && (
              <p className="lms-update-empty">
                New classes and quizzes will appear here.
              </p>
            )}

            {syncedAt && (
              <span className="lms-update-sync">
                Synced {formatRelativeTime(syncedAt)}
              </span>
            )}
          </section>

          <div className="lms-widget-stats">
            <article className="lms-widget-stat">
              <span className="lms-widget-icon lms-tone-blue">
                <Icon name="book" size={16} />
              </span>
              <div>
                <strong>{activeClasses.length}</strong>
                <span>Enrolled</span>
              </div>
            </article>
            <article className="lms-widget-stat">
              <span className="lms-widget-icon lms-tone-green">
                <Icon name="checkCircle" size={16} />
              </span>
              <div>
                <strong>{passedQuizzes}</strong>
                <span>Quizzes passed</span>
              </div>
            </article>
            <article className="lms-widget-stat">
              <span className="lms-widget-icon lms-tone-violet">
                <Icon name="clock" size={16} />
              </span>
              <div>
                <strong>126</strong>
                <span>Hours</span>
              </div>
            </article>
            <article className="lms-widget-stat">
              <span className="lms-widget-icon lms-tone-amber">
                <Icon name="target" size={16} />
              </span>
              <div>
                <strong>12</strong>
                <span>Day streak</span>
              </div>
            </article>
          </div>

          <StudentCalendar />

          <LearningProgressWidget
            overall={overallProgress}
            classes={activeClasses}
          />

          <section className="lms-card lms-card-pad lms-goal-card">
            <div className="lms-goal-head">
              <span className="lms-goal-icon lms-tone-violet">
                <Icon name="award" size={17} />
              </span>
              <div>
                <h2>Weekly focus</h2>
                <p>Small steps, steady progress.</p>
              </div>
            </div>
            <ProgressBar
              label="Quiz completion"
              value={overallProgress}
              tone="blue"
            />
          </section>
        </aside>
      </div>
    </div>
  )
}

function StudentCalendar() {
  const today = new Date()
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  const eventDays = new Set([9, 16, 23])
  const isToday = (day) =>
    day === today.getDate() &&
    monthIndex === today.getMonth() &&
    year === today.getFullYear()

  return (
    <section className="lms-card lms-card-pad lms-calendar-widget">
      <div className="lms-calendar-toolbar">
        <button
          type="button"
          className="lms-icon-btn"
          aria-label="Previous month"
          onClick={() =>
            setMonth(new Date(year, monthIndex - 1, 1))
          }
        >
          <Icon name="chevronLeft" size={15} />
        </button>
        <strong>
          {month.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })}
        </strong>
        <button
          type="button"
          className="lms-icon-btn"
          aria-label="Next month"
          onClick={() =>
            setMonth(new Date(year, monthIndex + 1, 1))
          }
        >
          <Icon name="chevronRight" size={15} />
        </button>
      </div>

      <div className="lms-calendar-weekdays">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="lms-calendar-grid">
        {cells.map((day, index) => (
          <span
            key={day ? `${year}-${monthIndex}-${day}` : `blank-${index}`}
            className={`lms-calendar-day ${
              day && isToday(day) ? 'is-today' : ''
            } ${day && eventDays.has(day) ? 'has-event' : ''}`}
          >
            {day || ''}
          </span>
        ))}
      </div>
    </section>
  )
}

function LearningProgressWidget({ overall, classes }) {
  const [range, setRange] = useState('Weekly')
  const segments = classes.map((learningClass, index) => ({
    label: learningClass.subject,
    value: classes.length ? Math.floor(100 / classes.length) : 0,
    color: ['#2f6fed', '#7c4dd6', '#0f8b83', '#d18a2e'][index % 4],
  }))

  return (
    <section className="lms-card lms-card-pad lms-progress-widget">
      <div className="lms-progress-widget-head">
        <div>
          <h2>Learning Progress</h2>
          <p>{range} focus across your enrolled classes</p>
        </div>
        <select
          className="lms-select lms-select-sm"
          value={range}
          onChange={(event) => setRange(event.target.value)}
          aria-label="Learning progress range"
        >
          <option value="Weekly">Weekly</option>
          <option value="Monthly">Monthly</option>
        </select>
      </div>

      <div className="lms-donut-wrap">
        <DonutChart
          segments={segments}
          size={124}
          centerValue={`${overall}%`}
          centerLabel="complete"
        />
        <div className="lms-donut-legend">
          {segments.map((segment) => (
            <div className="lms-legend-item" key={segment.label}>
              <span
                className="lms-legend-dot"
                style={{ background: segment.color }}
              />
              <span>{segment.label}</span>
              <strong>{segment.value}%</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function StudentSubjects({
  classes,
  quizzes,
  slides,
  classwork,
  loading,
  error,
  onRetry,
  onEnroll,
  getAnnouncements,
  getPeople,
  addAnnouncementComment,
  getClasswork,
  submitClasswork,
  downloadClassworkAttachment,
  previewClassworkAttachment,
  downloadSubmissionFile,
  onDownloadFile,
  onPreviewFile,
  onQuizStart,
  onQuizComplete,
}) {
  const notify = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [semester, setSemester] = useState('All')
  const [expandedClassId, setExpandedClassId] = useState(
    () => searchParams.get('classId'),
  )

  const activeClasses = classes.filter(
    (subject) => subject.status !== 'Archived',
  )
  const terms = [
    'All',
    ...new Set(activeClasses.map((subject) => subject.term).filter(Boolean)),
  ]
  const filtered = activeClasses.filter((subject) => {
    const matchesSearch =
      `${subject.className} ${subject.subject} ${subject.subjectCode} ${subject.teacherName}`
        .toLowerCase()
        .includes(search.toLowerCase())
    const matchesSemester =
      semester === 'All' || subject.term === semester
    return matchesSearch && matchesSemester
  })
  const handleQuizComplete = async (quiz, answers) => {
    const result = await onQuizComplete(quiz, answers)
    notify(
      result.passed
        ? `Quiz submitted. You passed with ${result.score}%.`
        : `Quiz submitted. You scored ${result.score}%.`,
      result.passed ? 'success' : 'error',
    )
    return result
  }

  const workspaceClass = activeClasses.find(
    (subject) => subject.id === searchParams.get('classId'),
  )

  if (workspaceClass) {
    const classQuizzes = quizzes.filter(
      (quiz) => quiz.classId === workspaceClass.id,
    )
    return (
      <ClassroomWorkspace
        learningClass={workspaceClass}
        role="Student"
        slides={slides.filter((slide) => slide.classId === workspaceClass.id)}
        quizzes={classQuizzes}
        getAnnouncements={getAnnouncements}
        getPeople={getPeople}
        classwork={classwork.filter((item) => item.classId === workspaceClass.id)}
        getClasswork={getClasswork}
        addAnnouncementComment={addAnnouncementComment}
        submitClasswork={submitClasswork}
        downloadClassworkAttachment={downloadClassworkAttachment}
        onPreviewAttachment={previewClassworkAttachment}
        downloadSubmissionFile={downloadSubmissionFile}
        onDownloadFile={onDownloadFile}
        onPreviewFile={onPreviewFile}
        onClose={() => {
          const next = new URLSearchParams(searchParams)
          next.delete('classId')
          setSearchParams(next)
          setExpandedClassId(null)
        }}
        studentQuizContent={
          <StudentClassQuizzes
            quizzes={classQuizzes}
            onQuizStart={onQuizStart}
            onQuizComplete={handleQuizComplete}
          />
        }
      />
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="My classes"
        title="Your enrolled classes"
        description="Your courses, learning materials, and assessments—all in one place."
        actions={
          <Link to="/student/lessons" className="lms-btn lms-btn-secondary">
            <Icon name="presentation" size={16} />
            Browse lessons
          </Link>
        }
      />

      <StudentJoinClassForm onEnroll={onEnroll} />

      {error && (
        <div className="lms-dashboard-notice lms-dashboard-notice-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="lms-btn lms-btn-secondary lms-btn-sm"
            onClick={() => onRetry()}
            disabled={loading}
          >
            Try again
          </button>
        </div>
      )}

      <div className="lms-toolbar lms-student-subject-toolbar">
        <label className="lms-filter-input">
          <Icon name="search" size={15} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search class, subject, code, or teacher"
          />
        </label>
        <div className="lms-segmented" role="tablist" aria-label="Filter by term">
          {terms.map((term) => (
            <button
              key={term}
              type="button"
              className={semester === term ? 'is-active' : ''}
              onClick={() => setSemester(term)}
            >
              {term}
            </button>
          ))}
        </div>
        <span className="lms-chip">
          <Icon name="book" size={13} />
          {filtered.length} class{filtered.length === 1 ? '' : 'es'}
        </span>
      </div>

      {loading && filtered.length === 0 ? (
        <div className="lms-card lms-card-pad lms-dashboard-data-state" role="status">
          <span className="lms-search-spinner" />
          Loading your enrolled classes...
        </div>
      ) : filtered.length === 0 ? (
        <div className="lms-card">
          <EmptyState
            icon="book"
            title={classes.length === 0 ? 'You haven’t joined any classes yet' : 'No classes found'}
            description={
              classes.length === 0
                ? 'Enter the class code your teacher shared to join your first class.'
                : 'Try a different search term or term filter.'
            }
            action={
              error ? (
                <button
                  type="button"
                  className="lms-btn lms-btn-secondary"
                  onClick={() => onRetry()}
                  disabled={loading}
                >
                  Try again
                </button>
              ) : classes.length > 0 ? (
                <button
                  type="button"
                  className="lms-btn lms-btn-secondary"
                  onClick={() => {
                    setSearch('')
                    setSemester('All')
                  }}
                >
                  Clear filters
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="lms-subject-grid">
          {filtered.map((subject) => (
            <article className="lms-subject-card" key={subject.id}>
              <div className="lms-subject-card-top">
                <span
                  className={`lms-subject-code lms-tone-${subject.accent || 'blue'}`}
                >
                  {subject.subjectCode}
                </span>
                <Badge
                  tone={subject.status === 'Published' ? 'success' : 'neutral'}
                  dot
                >
                  {subject.status}
                </Badge>
                {subject.pendingClasswork > 0 && (
                  <Badge tone="warning">
                    {subject.pendingClasswork} pending
                  </Badge>
                )}
              </div>
              <span className="lms-student-class-subject">
                {subject.subject}
              </span>
              <h3>{subject.className}</h3>
              <p>{subject.description}</p>
              <div className="lms-subject-meta">
                <span>
                  <Icon name="calendar" size={12} /> {subject.term}
                </span>
                <span>
                  <Icon name="bookmark" size={12} /> AY {subject.academicYear}
                </span>
                <span>
                  <Icon name="user" size={12} /> {subject.teacherName}
                </span>
              </div>
              <div className="lms-subject-card-stats">
                <span>
                  {subject.lessons} lessons · {subject.quizzes} quizzes
                </span>
                <span>{formatDate(subject.createdDate)}</span>
              </div>
              <div className="lms-subject-card-actions">
                <Link
                  to={`/student/subjects?classId=${encodeURIComponent(subject.id)}`}
                  className="lms-btn lms-btn-primary lms-btn-sm"
                >
                  Open classroom <Icon name="arrowRight" size={13} />
                </Link>
                <Link
                  to={`/student/lessons?classId=${encodeURIComponent(subject.id)}`}
                  className="lms-link"
                >
                  Lessons <Icon name="arrowRight" size={12} />
                </Link>
                <button
                  type="button"
                  className="lms-link"
                  onClick={() =>
                    setExpandedClassId((current) =>
                      current === subject.id ? null : subject.id,
                    )
                  }
                  aria-expanded={expandedClassId === subject.id}
                >
                  {expandedClassId === subject.id
                    ? 'Hide quizzes'
                    : `Quizzes · ${quizzes.filter((quiz) => quiz.classId === subject.id).length}`}
                  <Icon
                    name="chevronDown"
                    size={12}
                    className={expandedClassId === subject.id ? 'is-rotated' : ''}
                  />
                </button>
              </div>
              {expandedClassId === subject.id && (
                <StudentClassQuizzes
                  quizzes={quizzes.filter((quiz) => quiz.classId === subject.id)}
                  onQuizStart={onQuizStart}
                  onQuizComplete={handleQuizComplete}
                />
              )}
            </article>
          ))}
        </div>
      )}
    </>
  )
}

function StudentLessons({
  slides,
  classes,
  classwork,
  quizzes,
  results,
  onDownloadClassworkAttachment,
  onPreviewClassworkAttachment,
  onDownloadFile,
  onPreviewSlideFile,
}) {
  const notify = useToast()
  const [attachmentPreview, setAttachmentPreview] = useState(null)
  const [previewingFileId, setPreviewingFileId] = useState('')
  useEffect(
    () => () => {
      if (attachmentPreview?.url) URL.revokeObjectURL(attachmentPreview.url)
    },
    [attachmentPreview],
  )
  const passedQuizIds = new Set(
    results.filter((result) => result.status === 'Passed').map((result) => result.quizId)
  )

  const slidesByClass = {}
  slides.forEach((slide) => {
    if (!slidesByClass[slide.classId]) {
      slidesByClass[slide.classId] = []
    }
    slidesByClass[slide.classId].push(slide)
  })

  const slideStatuses = {}
  Object.entries(slidesByClass).forEach(([classId, classSlides]) => {
    const sortedSlides = classSlides.sort(
      (left, right) => {
        const hasOrder = classSlides.every(
          (slide) => Number.isInteger(slide.orderIndex),
        )
        return hasOrder
          ? left.orderIndex - right.orderIndex
          : new Date(left.createdDate) - new Date(right.createdDate)
      },
    )
    const classQuizzes = quizzes
      .filter((q) => q.classId === classId && q.status !== 'Draft')
      .sort((a, b) => new Date(a.createdDate) - new Date(b.createdDate))

    const quizzesBySlide = new Map(
      sortedSlides.map((slide) => [slide.id, []]),
    )
    const assignedQuizIds = new Set()
    classQuizzes.forEach((quiz) => {
      if (quiz.topicId && quizzesBySlide.has(quiz.topicId)) {
        quizzesBySlide.get(quiz.topicId).push(quiz)
        assignedQuizIds.add(quiz.id)
      }
    })
    const unassignedSlides = sortedSlides.filter(
      (slide) => quizzesBySlide.get(slide.id).length === 0,
    )
    classQuizzes
      .filter((quiz) => !assignedQuizIds.has(quiz.id))
      .forEach((quiz, index) => {
        const slide = unassignedSlides[index]
        if (slide) quizzesBySlide.get(slide.id).push(quiz)
      })

    sortedSlides.forEach((slide) => {
      const topicQuizzes = quizzesBySlide.get(slide.id)
      slideStatuses[slide.id] = slide.locked
        ? 'locked'
        : topicQuizzes.length > 0 &&
            topicQuizzes.every((quiz) => passedQuizIds.has(quiz.id))
          ? 'completed'
          : 'current'
    })
  })

  const lessons = [
    ...slides.map((slide) => ({
      ...slide,
      kind: 'slide',
      subjectId: slide.classId,
      content: slide.content
        .map((item) => item.text || item.summary || '')
        .filter(Boolean)
        .join('\n\n'),
      summary:
        slide.content[0]?.summary ||
        (slide.content[0]?.presentation?.fileName
          ? 'File attachment available'
          : 'Class lesson'),
      presentation: slide.content[0]?.presentation || null,
      duration: slide.content[0]?.presentation?.fileName
        ? 'File attached'
        : 'Lesson',
      status: slideStatuses[slide.id] || 'current',
      attachments: [],
    })),
    ...classwork
      .filter((item) => item.type === 'material')
      .map((item) => ({
        ...item,
        id: `material-${item.id}`,
        kind: 'material',
        classworkId: item.id,
        subjectId: item.classId,
        content: item.instructions || '',
        summary: item.instructions || 'Shared class material',
        duration: item.attachments.length
          ? `${item.attachments.length} attachment${item.attachments.length === 1 ? '' : 's'}`
          : 'Material',
        status: 'current',
      })),
  ].sort((first, second) => {
    const firstDate = new Date(first.createdDate || first.createdAt || 0).getTime()
    const secondDate = new Date(second.createdDate || first.createdAt || 0).getTime()
    return firstDate - secondDate
  })
  const [selectedId, setSelectedId] = useState('')
  const requestedClassId = new URLSearchParams(window.location.search).get('classId')
  const [subjectFilter, setSubjectFilter] = useState(
    () => requestedClassId || 'All',
  )
  const activeSubjectFilter =
    subjectFilter !== 'All' &&
    classes.length > 0 &&
    !classes.some((item) => item.id === subjectFilter)
      ? 'All'
      : subjectFilter

  const visibleLessons = lessons.filter(
    (lesson) =>
      activeSubjectFilter === 'All' || lesson.subjectId === activeSubjectFilter,
  )
  const selected =
    lessons.find((lesson) => lesson.id === selectedId) ||
    visibleLessons[0]
  const downloadPresentation = async () => {
    try {
      await onDownloadFile(selected.id)
    } catch (error) {
      notify(error.message, 'error')
    }
  }
  const openPresentation = async () => {
    setPreviewingFileId(selected.id)
    try {
      const preview = await onPreviewSlideFile(selected.id)
      setAttachmentPreview(preview)
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setPreviewingFileId('')
    }
  }
  const openClassworkAttachment = async (item, attachment) => {
    setPreviewingFileId(attachment.fileId)
    try {
      const preview = await onPreviewClassworkAttachment(
        item.classworkId,
        attachment,
      )
      setAttachmentPreview({
        ...preview,
        fileName: attachment.fileName,
      })
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setPreviewingFileId('')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Lessons"
        title="Lessons and materials"
        description="Lessons and teacher-shared class materials are collected here."
        actions={
          <select
            className="lms-select"
            value={activeSubjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
            aria-label="Filter lessons by subject"
          >
            <option value="All">All subjects</option>
            {classes.map((subject) => (
              <option value={subject.id} key={subject.id}>
                {subject.subjectCode} · {subject.className}
              </option>
            ))}
          </select>
        }
      />

      <div className="lms-lesson-layout">
        <aside className="lms-card lms-lesson-menu">
          <div className="lms-lesson-menu-head">
            <h2>Course topics</h2>
            <p>{visibleLessons.length} lessons and materials available</p>
          </div>
          <div className="lms-lesson-menu-list">
            {visibleLessons.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                className={`lms-lesson-menu-item ${
                  selected?.id === lesson.id ? 'is-active' : ''
                } ${lesson.status === 'locked' ? 'is-locked' : ''}`}
                onClick={() => {
                  if (lesson.status === 'locked') return
                  setSelectedId(lesson.id)
                }}
                disabled={lesson.status === 'locked'}
              >
                <span
                  className={`lms-lesson-menu-status ${
                    lesson.status === 'completed'
                      ? 'is-completed'
                      : lesson.status === 'current'
                        ? 'is-current'
                        : ''
                  }`}
                >
                  <Icon
                    name={
                      lesson.status === 'completed'
                        ? 'check'
                        : lesson.status === 'locked'
                          ? 'lock'
                          : 'play'
                    }
                    size={13}
                  />
                </span>
                <span className="lms-lesson-menu-copy">
                  <strong>{lesson.title}</strong>
                  <span>
                    {lesson.subjectCode} · {lesson.duration}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {selected ? (
          <article className="lms-card lms-lesson-reader">
            <div className="lms-lesson-reader-head">
              <div className="lms-reader-meta">
                <Badge tone="info">{selected.subjectCode}</Badge>
                <Badge
                  tone={selected.status === 'completed' ? 'success' : 'warning'}
                  dot
                >
                  {selected.status === 'completed'
                    ? 'Completed'
                    : 'Current topic'}
                </Badge>
                <Badge tone="neutral">
                  <Icon name="clock" size={11} /> {selected.duration}
                </Badge>
              </div>
              <h2>{selected.title}</h2>
              <p>{selected.summary}</p>
            </div>

            <div className="lms-lesson-content">{selected.content}</div>

            {selected.kind === 'material' &&
              (selected.attachments || []).map((attachment) => (
                <div className="lms-presentation-card" key={attachment.fileId}>
                  <span className="lms-presentation-icon">
                    <Icon name="fileText" size={20} />
                  </span>
                  <div className="lms-presentation-copy">
                    <strong>{attachment.fileName}</strong>
                    <span>Shared by your teacher in this class.</span>
                  </div>
                  <button
                    type="button"
                    className="lms-btn lms-btn-secondary lms-btn-sm"
                    onClick={() =>
                      openClassworkAttachment(selected, attachment)
                    }
                    disabled={previewingFileId === attachment.fileId}
                  >
                    <Icon name="eye" size={14} />
                    {previewingFileId === attachment.fileId
                      ? 'Loading preview...'
                      : 'Preview'}
                  </button>
                  <button
                    type="button"
                    className="lms-btn lms-btn-secondary lms-btn-sm"
                    onClick={() =>
                      onDownloadClassworkAttachment(
                        selected.classworkId,
                        attachment,
                      ).catch((error) => notify(error.message, 'error'))
                    }
                  >
                    <Icon name="download" size={14} />
                    Download file
                  </button>
                </div>
              ))}

            {selected.presentation?.fileId && (
              <div className="lms-presentation-card">
                <span className="lms-presentation-icon">
                  <Icon name="fileText" size={20} />
                </span>
                <div className="lms-presentation-copy">
                  <strong>{selected.presentation.fileName}</strong>
                  <span>
                    Uploaded by faculty. Preview in this page or download a copy.
                  </span>
                </div>
                <button
                  type="button"
                  className="lms-btn lms-btn-secondary lms-btn-sm"
                  onClick={openPresentation}
                  disabled={previewingFileId === selected.id}
                >
                  <Icon name="eye" size={14} />
                  {previewingFileId === selected.id
                    ? 'Loading preview...'
                    : 'Preview'}
                </button>
                <button
                  type="button"
                  className="lms-btn lms-btn-secondary lms-btn-sm"
                  onClick={downloadPresentation}
                >
                  <Icon name="download" size={14} />
                  Download file
                </button>
              </div>
            )}

            <div className="lms-lesson-reader-foot">
              <span className="lms-completion-note">
                <Icon name="shield" size={15} />
                <span>
                  Lesson completion is confirmed by passing the required quiz.
                </span>
              </span>
              <Link
                to={`/student/subjects?classId=${encodeURIComponent(selected.subjectId)}#class-quizzes`}
                className="lms-btn lms-btn-primary lms-btn-sm"
              >
                <Icon name="quiz" size={14} />
                View class quizzes
              </Link>
            </div>
          </article>
        ) : (
          <article className="lms-card lms-lesson-reader">
            <EmptyState
              icon="book"
              title="No lessons or materials yet"
              description="Published lessons and materials from your enrolled classes will appear here."
            />
          </article>
        )}
      </div>
      {attachmentPreview && (
        <Modal
          title={attachmentPreview.fileName}
          description="Preview of the file shared in this class."
          onClose={() => setAttachmentPreview(null)}
          size="lg"
        >
          <StudentAttachmentPreview
            key={attachmentPreview.url}
            file={attachmentPreview}
          />
        </Modal>
      )}
    </>
  )
}

function StudentNotes({
  userId,
  slides,
  getNotes,
  createNoteRequest,
  updateNoteRequest,
  deleteNoteRequest,
}) {
  const notify = useToast()
  const [notes, setNotes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [notesError, setNotesError] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [notesLoaded, setNotesLoaded] = useState(false)
  const saveTimers = useRef(new Map())
  const pendingUpdates = useRef(new Map())
  const notesLoadPromise = useRef(null)

  useEffect(() => {
    let active = true
    if (!notesLoadPromise.current) {
      notesLoadPromise.current = (async () => {
        const remoteNotes = await getNotes()
        let nextNotes = remoteNotes
        const legacyNotes = loadNotes(userId)
        if (legacyNotes.length > 0) {
          for (const note of legacyNotes) {
            const topicId = note.topicId
            if (!topicId) {
              throw new Error(
                'A saved browser note is missing its lesson. Keep its browser data and link it to a lesson before migrating.',
              )
            }
            const created = await createNoteRequest({
              topicId,
              title: note.title,
              body: note.body,
            })
            nextNotes = [created, ...nextNotes]
          }
          window.localStorage.removeItem(`${NOTES_KEY}_${userId}`)
        }
        return nextNotes
      })()
    }
    notesLoadPromise.current
      .then((loadedNotes) => {
        if (active) {
          setNotes(loadedNotes)
          setSelectedId(loadedNotes[0]?.id || null)
          setNotesLoaded(true)
        }
      })
      .catch((loadError) => {
        if (active) {
          setNotesError(loadError.message || 'Could not load your notes.')
          setNotesLoaded(true)
        }
      })
    return () => {
      active = false
    }
  }, [createNoteRequest, getNotes, userId])

  const selected = notes.find((note) => note.id === selectedId) || notes[0]

  const updateSelected = (patch) => {
    if (!selected) return
    setNotesError('')
    const noteId = selected.id
    const queued = { ...pendingUpdates.current.get(noteId), ...patch }
    pendingUpdates.current.set(noteId, queued)
    setNotes((current) =>
      current.map((note) =>
        note.id === noteId
          ? { ...note, ...patch, updatedAt: new Date().toISOString() }
          : note,
      ),
    )
    window.clearTimeout(saveTimers.current.get(noteId))
    const timer = window.setTimeout(async () => {
      const updates = pendingUpdates.current.get(noteId)
      if (!updates) return
      pendingUpdates.current.delete(noteId)
      saveTimers.current.delete(noteId)
      setSavingNote(true)
      try {
        const updated = await updateNoteRequest(noteId, updates)
        setNotes((current) =>
          current.map((note) => (note.id === updated.id ? updated : note)),
        )
      } catch (saveError) {
        setNotesError(saveError.message || 'Could not save your note.')
      } finally {
        setSavingNote(false)
      }
    }, 500)
    saveTimers.current.set(noteId, timer)
  }

  const createNote = async () => {
    const topicId = slides[0]?.id
    if (!topicId) {
      setNotesError('Join a class with a published lesson before creating a topic note.')
      return
    }
    try {
      const note = await createNoteRequest({
        topicId,
        title: 'Untitled note',
        body: '',
      })
      setNotes((current) => [note, ...current])
      setSelectedId(note.id)
      notify('New note created.')
    } catch (createError) {
      setNotesError(createError.message || 'Could not create your note.')
    }
  }

  const deleteNote = async () => {
    if (!selected) return
    try {
      window.clearTimeout(saveTimers.current.get(selected.id))
      saveTimers.current.delete(selected.id)
      pendingUpdates.current.delete(selected.id)
      await deleteNoteRequest(selected.id)
      const remainingNotes = notes.filter((note) => note.id !== selected.id)
      setNotes(remainingNotes)
      setSelectedId(remainingNotes[0]?.id || null)
      notify('Note deleted.')
    } catch (deleteError) {
      setNotesError(deleteError.message || 'Could not delete your note.')
    }
  }

  const saveSelectedNow = async () => {
    if (!selected) return
    window.clearTimeout(saveTimers.current.get(selected.id))
    saveTimers.current.delete(selected.id)
    const updates = pendingUpdates.current.get(selected.id) || {
      title: selected.title,
      body: selected.body,
      topicId: selected.topicId,
    }
    pendingUpdates.current.delete(selected.id)
    setSavingNote(true)
    try {
      const updated = await updateNoteRequest(selected.id, updates)
      setNotes((current) =>
        current.map((note) => (note.id === updated.id ? updated : note)),
      )
      notify('Note saved to your account.')
    } catch (saveError) {
      setNotesError(saveError.message || 'Could not save your note.')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="My notes"
        title="Personal study notes"
        description="Capture important ideas per topic. Your notes are saved to your account."
        actions={
          <button type="button" className="lms-btn lms-btn-primary" onClick={createNote}>
            <Icon name="plus" size={16} />
            New note
          </button>
        }
      />

      {notesError && <p className="lms-inline-error" role="alert">{notesError}</p>}

      {!notesLoaded ? (
        <div className="lms-card lms-card-pad">Loading your notes...</div>
      ) : notes.length === 0 ? (
        <div className="lms-card">
          <EmptyState
            icon="notes"
            title="No notes yet"
            description="Create a note to keep your key takeaways organized by topic."
            action={
              <button type="button" className="lms-btn lms-btn-primary" onClick={createNote}>
                Create note
              </button>
            }
          />
        </div>
      ) : (
        <div className="lms-notes-layout">
          <aside className="lms-card lms-notes-list">
            <div className="lms-notes-list-head">
              <h2>All notes</h2>
              <Badge tone="neutral">{notes.length}</Badge>
            </div>
            <div className="lms-notes-items">
              {notes.map((note) => {
                const topic = slides.find(
                  (lesson) => lesson.id === note.topicId,
                )
                return (
                  <button
                    key={note.id}
                    type="button"
                    className={`lms-note-item ${note.id === selected?.id ? 'is-active' : ''}`}
                    onClick={() => setSelectedId(note.id)}
                  >
                    <strong>{note.title || 'Untitled note'}</strong>
                    <span>
                      {topic?.subjectCode || 'General'} ·{' '}
                      {formatDate(note.updatedAt)}
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          {selected && (
            <section className="lms-card lms-note-editor">
              <div className="lms-note-editor-head">
                <input
                  className="lms-note-title-input"
                  value={selected.title}
                  onChange={(event) =>
                    updateSelected({ title: event.target.value })
                  }
                  onBlur={saveSelectedNow}
                  aria-label="Note title"
                />
                <button
                  type="button"
                  className="lms-icon-btn"
                  onClick={deleteNote}
                  aria-label="Delete note"
                  title="Delete note"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>

              <div className="lms-note-editor-body">
                <select
                  className="lms-select"
                  value={selected.topicId || ''}
                  onChange={(event) =>
                    updateSelected({ topicId: event.target.value })
                  }
                  onBlur={saveSelectedNow}
                  aria-label="Link note to topic"
                >
                  {slides.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.subjectCode} · {lesson.title}
                    </option>
                  ))}
                </select>
                <textarea
                  value={selected.body}
                  onChange={(event) =>
                    updateSelected({ body: event.target.value })
                  }
                  onBlur={saveSelectedNow}
                  placeholder="Write your notes here..."
                  aria-label="Note content"
                />
              </div>

              <div className="lms-note-editor-foot">
                <span>
                  Last edited {formatDate(selected.updatedAt)} ·{' '}
                  {savingNote ? 'saving...' : 'saved to your account'}
                </span>
                <button
                  type="button"
                  className="lms-btn lms-btn-primary lms-btn-sm"
                  onClick={saveSelectedNow}
                  disabled={savingNote}
                >
                  <Icon name="check" size={14} />
                  Save note
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  )
}

function StudentClassQuizzes({ quizzes, onQuizStart, onQuizComplete }) {
  const notify = useToast()
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [startingQuizId, setStartingQuizId] = useState('')

  const startQuiz = async (quiz) => {
    setStartingQuizId(quiz.id)
    try {
      const attempt = await onQuizStart(quiz)
      setActiveQuiz({ ...quiz, ...attempt })
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setStartingQuizId('')
    }
  }

  const filtered = quizzes

  return (
    <div className="lms-class-quiz-list">
      <div className="lms-class-quiz-head">
        <div>
          <h4>Teacher-provided quizzes</h4>
          <p>Take published quizzes for this class here.</p>
        </div>
        <Icon name="quiz" size={18} />
      </div>
      {filtered.length === 0 ? (
        <p className="lms-cell-muted">No published quizzes in this class yet.</p>
      ) : (
        <div className="lms-quiz-grid">
          {filtered.map((quiz) => {
          const isDraft = quiz.status === 'Draft'
          const hasQuestions = quiz.questionList?.length > 0
          const isLocked = quiz.passed || quiz.locked || !hasQuestions

            return (
            <article className="lms-quiz-card" key={quiz.id}>
              <div className="lms-quiz-card-head">
                <span className="lms-quiz-card-icon lms-tone-violet">
                  <Icon name="quiz" size={18} />
                </span>
                <Badge
                  tone={
                    quiz.passed || quiz.status === 'Passed'
                      ? 'success'
                      : quiz.status === 'Retake available' ||
                          quiz.status === 'Locked' ||
                          quiz.status === 'Draft'
                        ? 'warning'
                        : 'info'
                  }
                  dot
                >
                  {quiz.status}
                </Badge>
              </div>
              <div>
                <p className="lms-cell-muted" style={{ margin: '0 0 3px' }}>
                  {quiz.subjectCode}
                </p>
                <h3>{quiz.title}</h3>
              </div>
              <p>
                {quiz.questions} questions · Due {quiz.due}
              </p>
              <div className="lms-quiz-details">
                <div>
                  <span>Time limit</span>
                  <strong>{quiz.timeLimit} min</strong>
                </div>
                <div>
                  <span>Passing score</span>
                  <strong>{quiz.passing}%</strong>
                </div>
                <div>
                  <span>Attempts</span>
                  <strong>
                    {quiz.attemptsUsed} / Unlimited
                  </strong>
                </div>
                <div>
                  <span>Best score</span>
                  <strong>
                    {quiz.bestScore === null ? '—' : `${quiz.bestScore}%`}
                  </strong>
                </div>
              </div>
              <div className="lms-quiz-card-foot">
                <span className="lms-cell-muted">
                  {isDraft
                    ? 'Not published yet'
                    : !hasQuestions
                      ? 'Questions coming soon'
                      : isLocked
                          ? quiz.passed ? 'Quiz passed' : 'Complete the previous quiz first'
                          : 'Retakes allowed until passed'}
                </span>
                <button
                  type="button"
                  className="lms-btn lms-btn-primary lms-btn-sm"
                  disabled={isLocked || startingQuizId === quiz.id}
                  onClick={() => startQuiz(quiz)}
                >
                  <Icon name="play" size={13} />
                  {isDraft
                    ? 'Awaiting publish'
                    : !hasQuestions
                      ? 'Not ready'
                      : quiz.status === 'Retake available'
                        ? 'Retake'
                        : startingQuizId === quiz.id
                          ? 'Starting...'
                          : 'Start quiz'}
                </button>
              </div>
            </article>
            )
          })}
        </div>
      )}

      {activeQuiz && (
        <QuizPlayer
          quiz={activeQuiz}
          onClose={() => setActiveQuiz(null)}
          onComplete={onQuizComplete}
        />
      )}
    </div>
  )
}

function QuizPlayer({ quiz, onClose, onComplete }) {
  const notify = useToast()
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [remaining, setRemaining] = useState(() =>
    Math.max(
      0,
      Number(quiz.timeLimit) * 60 -
        Math.floor((Date.now() - Date.parse(quiz.startedAt)) / 1000),
    ),
  )
  const questionList = quiz.questionList || []

  const answeredCount = Object.keys(answers).length
  const minutes = Math.floor(remaining / 60)
  const seconds = String(remaining % 60).padStart(2, '0')

  const handleSubmit = useCallback(async () => {
    if (submitted || submitting) return
    setSubmitting(true)
    try {
      const submission = await onComplete(quiz, answers)
      setResult(submission)
      setSubmitted(true)
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }, [answers, notify, onComplete, quiz, submitted, submitting])

  useEffect(() => {
    if (submitted || remaining <= 0) {
      return undefined
    }

    const timeout = window.setTimeout(() => {
      const nextRemaining = Math.max(0, remaining - 1)
      setRemaining(nextRemaining)
      if (nextRemaining === 0) handleSubmit()
    }, 1000)
    return () => window.clearTimeout(timeout)
  }, [handleSubmit, remaining, submitted])

  return (
    <Modal
      title={quiz.title}
      description={`${quiz.subjectCode} · ${questionList.length} questions · Passing score ${quiz.passing}%`}
      onClose={onClose}
      size="lg"
      footer={
        submitted ? (
          <button type="button" className="lms-btn lms-btn-primary" onClick={onClose}>
            Done
          </button>
        ) : (
          <>
            <button type="button" className="lms-btn lms-btn-secondary" onClick={onClose}>
              Exit quiz
            </button>
            <button
              type="button"
              className="lms-btn lms-btn-primary"
              disabled={submitting}
              onClick={handleSubmit}
            >
              <Icon name="check" size={15} />
              {submitting ? 'Submitting...' : 'Submit quiz'}
            </button>
          </>
        )
      }
    >
      {submitted ? (
        <div className={`lms-result-box ${result?.passed ? '' : 'is-failed'}`}>
          <Icon name={result?.passed ? 'award' : 'alert'} size={28} />
          <strong>{result?.score}%</strong>
          <h3 style={{ margin: '2px 0 4px' }}>
            {result?.passed ? 'Assessment passed' : 'Review your answers'}
          </h3>
          <p>
            You answered {result?.correctCount} of {result?.questionCount} questions
            correctly. The passing score is {quiz.passing}%.
          </p>
        </div>
      ) : (
        <>
          <div className="lms-quiz-player-head">
            <span>
              Question progress: <strong>{answeredCount}</strong> of{' '}
              {questionList.length} answered
            </span>
            <span className="lms-quiz-timer">
              <Icon name="clock" size={14} />
              {minutes}:{seconds}
            </span>
          </div>

          {questionList.map((question, index) => (
            <div className="lms-quiz-question" key={question.id}>
              <h3>
                <span>{index + 1}.</span> {question.prompt}
              </h3>
              {(question.type === 'short_answer' || question.type === 'paragraph') ? (
                question.type === 'paragraph' ? (
                  <textarea
                    value={answers[question.id] || ''}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: event.target.value,
                      }))
                    }
                    aria-label={`Answer question ${index + 1}`}
                  />
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
                    aria-label={`Answer question ${index + 1}`}
                  />
                )
              ) : question.type === 'dropdown' ? (
                <select
                  value={answers[question.id] ?? ''}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [question.id]: event.target.value,
                    }))
                  }
                  aria-label={`Answer question ${index + 1}`}
                >
                  <option value="">Select an answer</option>
                  {question.options.map((option, optionIndex) => (
                    <option key={`${question.id}-${optionIndex}`} value={optionIndex}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="lms-answer-list">
                  {(question.options || []).map((option, optionIndex) => (
                    <label
                      className="lms-answer-option"
                      key={`${question.id}-${optionIndex}`}
                    >
                      <input
                        type={question.type === 'checkboxes' ? 'checkbox' : 'radio'}
                        name={question.id}
                        checked={
                          question.type === 'checkboxes'
                            ? (answers[question.id] || []).includes(optionIndex)
                            : String(answers[question.id]) === String(optionIndex)
                        }
                        onChange={(event) => {
                          if (question.type !== 'checkboxes') {
                            setAnswers((current) => ({
                              ...current,
                              [question.id]: optionIndex,
                            }))
                            return
                          }
                          setAnswers((current) => {
                            const selected = current[question.id] || []
                            return {
                              ...current,
                              [question.id]: event.target.checked
                                ? [...selected, optionIndex]
                                : selected.filter((item) => item !== optionIndex),
                            }
                          })
                        }}
                      />
                      <span>
                        {String.fromCharCode(65 + optionIndex)}. {option}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </Modal>
  )
}

function StudentResults({ results }) {
  const [statusFilter, setStatusFilter] = useState('All')

  const filtered = results.filter(
    (result) =>
      statusFilter === 'All' || result.status === statusFilter,
  )
  const average =
    results.length > 0
      ? Math.round(
          results.reduce((total, result) => total + result.score, 0) /
            results.length,
        )
      : 0
  const passed = results.filter((result) => result.status === 'Passed').length
  const best = results.reduce(
    (highest, result) => Math.max(highest, result.score),
    0,
  )

  return (
    <>
      <PageHeader
        eyebrow="Quiz results"
        title="Your assessment history"
        description="Review every quiz attempt, compare scores against the passing rule, and identify what to revisit."
      />

      <div className="lms-result-summary">
        <div className="lms-summary-tile">
          <span>Average score</span>
          <strong>{average}%</strong>
        </div>
        <div className="lms-summary-tile">
          <span>Quizzes passed</span>
          <strong>
            {passed}/{results.length}
          </strong>
        </div>
        <div className="lms-summary-tile">
          <span>Total attempts</span>
          <strong>{results.length}</strong>
        </div>
        <div className="lms-summary-tile">
          <span>Best score</span>
          <strong>{best}%</strong>
        </div>
      </div>

      <div className="lms-toolbar">
        <div className="lms-segmented" role="tablist" aria-label="Filter results">
          {['All', 'Passed', 'Failed'].map((status) => (
            <button
              key={status}
              type="button"
              className={statusFilter === status ? 'is-active' : ''}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
        <span className="lms-chip">
          <Icon name="shield" size={13} />
          Scores are based on official passing percentages
        </span>
      </div>

      <div className="lms-table-wrap">
        <table className="lms-table">
          <thead>
            <tr>
              <th>Quiz</th>
              <th>Subject</th>
              <th>Date</th>
              <th>Attempt</th>
              <th>Score</th>
              <th>Passing</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((result) => (
              <tr key={result.id}>
                <td className="lms-cell-strong">{result.quiz}</td>
                <td className="lms-cell-muted">{result.subjectCode}</td>
                <td className="lms-cell-muted">{result.date}</td>
                <td className="lms-cell-muted">{result.attempt}</td>
                <td>
                  <span className="lms-score">
                    {result.score}%
                    <span className="lms-score-bar">
                      <span
                        style={{
                          width: `${result.score}%`,
                          background:
                            result.score >= result.passing
                              ? '#16825f'
                              : '#d18a2e',
                        }}
                      />
                    </span>
                  </span>
                </td>
                <td className="lms-cell-muted">{result.passing}%</td>
                <td>
                  <Badge
                    tone={
                      result.status === 'Passed'
                        ? 'success'
                        : result.status === 'Retake available'
                          ? 'warning'
                          : 'danger'
                    }
                    dot
                  >
                    {result.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function StudentProgress({ classes, quizzes, slides, results }) {
  const learningProgress = classes.map((learningClass) => {
    const classSlides = slides.filter(
      (slide) => slide.classId === learningClass.id,
    )
    const classQuizzes = quizzes.filter(
      (quiz) =>
        quiz.classId === learningClass.id && quiz.status !== 'Draft',
    )
    const classResults = results.filter(
      (result) => result.classId === learningClass.id,
    )
    const resultsByQuiz = new Map(
      classResults.map((result) => [result.quizId, result]),
    )
    const passedCount = classResults.filter(
      (result) => result.status === 'Passed',
    ).length
    const progress = classQuizzes.length
      ? Math.round((passedCount / classQuizzes.length) * 100)
      : 0
    const topics = [
      ...classSlides.map((slide) => ({
        id: `slide-${slide.id}`,
        title: slide.title,
        requirement: 'Published class material',
        state: 'current',
      })),
      ...classQuizzes.map((quiz) => {
        const result = resultsByQuiz.get(quiz.id)
        return {
          id: `quiz-${quiz.id}`,
          title: quiz.title,
          requirement: result
            ? `Quiz · Scored ${result.score}% · Passing ${quiz.passing}%`
            : `Quiz · Passing ${quiz.passing}%`,
          state: result
            ? result.status === 'Passed'
              ? 'completed'
              : 'failed'
            : 'current',
        }
      }),
    ]
    return {
      subjectId: learningClass.id,
      title: learningClass.className,
      progress,
      topics,
    }
  })
  const studentSubjects = classes
  const [activeSubject, setActiveSubject] = useState(
    learningProgress[0]?.subjectId || '',
  )
  const selected =
    learningProgress.find((item) => item.subjectId === activeSubject) ||
    learningProgress[0]
  const overall = Math.round(
    learningProgress.reduce((total, subject) => total + subject.progress, 0) /
      Math.max(learningProgress.length, 1),
  )
  const attemptsPercent = quizzes.length
    ? Math.round((results.length / quizzes.length) * 100)
    : 0
  const navigate = useNavigate()

  if (!selected) {
    return (
      <>
        <PageHeader
          eyebrow="Learning progress"
          title="Your learning path"
          description="Enroll in a class to see its published learning materials."
        />
        <div className="lms-card">
          <EmptyState
            icon="trend"
            title="No enrolled classes yet"
            description="Learning materials will appear here after you join a class."
          />
        </div>
      </>
    )
  }

  if (!selected) {
    return (
      <>
        <PageHeader
          eyebrow="Learning progress"
          title="Your learning path"
          description="Enroll in a class to see its published learning materials."
        />
        <div className="lms-card">
          <EmptyState
            icon="trend"
            title="No enrolled classes yet"
            description="Progress and class materials will appear here after you join a class."
          />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Learning progress"
        title="Your learning path"
        description="Topics unlock in order. Pass the required quiz for the current lesson before moving on to the next one."
      />

      <div className="lms-grid-2">
        <section className="lms-card">
          <div className="lms-progress-overview">
            <ProgressRing value={overall} label="Overall" size={112} />
            <div className="lms-progress-overview-copy">
              <h2>You are {overall}% through your active subjects</h2>
              <p>
                Your progress reflects the quizzes you have passed in each
                subject, along with the published materials and assessments
                listed below.
              </p>
              <Badge tone={overall === 100 ? 'success' : 'info'} dot>
                {overall === 100 ? 'Completed' : 'In progress'}
              </Badge>
            </div>
          </div>
        </section>

        <section className="lms-card lms-card-pad">
          <SectionHeader
            title="How unlocking works"
            description="A clear rule keeps your learning sequence intact."
          />
          <div className="lms-completion-note">
            <Icon name="lock" size={16} />
            <span>
              A topic stays locked until you <strong>pass the required quiz</strong>{' '}
              for the topic before it. Faculty set the passing percentage for
              each quiz.
            </span>
          </div>
          <div style={{ marginTop: 14 }}>
            <ProgressBar
              label="Quiz attempts recorded"
              value={Math.min(100, attemptsPercent)}
              tone="green"
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <ProgressBar
              label="Quizzes passed"
              value={overall}
              tone="violet"
            />
          </div>
        </section>
      </div>

      <div className="lms-toolbar" style={{ marginTop: 20 }}>
        <div className="lms-segmented" role="tablist" aria-label="Choose subject">
          {learningProgress.map((subject) => (
            <button
              key={subject.subjectId}
              type="button"
              className={
                activeSubject === subject.subjectId ? 'is-active' : ''
              }
              onClick={() => setActiveSubject(subject.subjectId)}
            >
              {studentSubjects.find((item) => item.id === subject.subjectId)?.subjectCode}
            </button>
          ))}
        </div>
        <span className="lms-chip">
          <Icon name="trend" size={13} />
          {selected.progress}% complete
        </span>
      </div>

      <section className="lms-card lms-card-pad">
        <SectionHeader
          title={selected.title}
          description="Complete each step in order to keep your progress moving."
          action={
            <Badge tone={selected.progress === 100 ? 'success' : 'info'} dot>
              {selected.progress === 100 ? 'Completed' : 'In progress'}
            </Badge>
          }
        />
        <div className="lms-progress-timeline">
          {selected.topics.map((topic, index) => (
            <div className="lms-progress-step" key={topic.id}>
              <span
                className={`lms-step-marker ${
                  topic.state === 'completed'
                    ? 'is-completed'
                    : topic.state === 'current'
                      ? 'is-current'
                      : 'is-locked'
                }`}
              >
                <Icon
                  name={
                    topic.state === 'completed'
                      ? 'check'
                      : topic.state === 'current'
                        ? 'play'
                        : topic.state === 'failed'
                          ? 'alert'
                          : 'lock'
                  }
                  size={14}
                />
              </span>
              <div className="lms-step-copy">
                <h3>
                  {index + 1}. {topic.title}
                </h3>
                <p>{topic.requirement}</p>
                <div className="lms-step-actions">
                  {topic.state === 'completed' && (
                    <>
                      <Badge tone="success">Quiz passed</Badge>
                      <button
                        type="button"
                        className="lms-link"
                        onClick={() => navigate('/student/lessons')}
                      >
                        Review topic
                      </button>
                    </>
                  )}
                  {topic.state === 'failed' && (
                    <>
                      <Badge tone="danger" dot>
                        Quiz not passed
                      </Badge>
                      <button
                        type="button"
                        className="lms-link"
                        onClick={() => navigate('/student/results')}
                      >
                        View result
                      </button>
                    </>
                  )}
                  {topic.state === 'current' && (
                    <>
                      <Badge tone="warning" dot>
                        In progress
                      </Badge>
                      <button
                        type="button"
                        className="lms-btn lms-btn-primary lms-btn-sm"
                        onClick={() => navigate('/student/lessons')}
                      >
                        Continue
                      </button>
                    </>
                  )}
                  {topic.state === 'locked' && (
                    <button
                      type="button"
                      className="lms-btn lms-btn-secondary lms-btn-sm"
                      disabled
                    >
                      <Icon name="lock" size={13} />
                      Locked
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

export default StudentDashboard
