import { useEffect, useMemo, useState } from 'react'
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'
import DashboardLayout from '../layout/DashboardLayout.jsx'
import ToastProvider from '../components/ToastProvider.jsx'
import Icon from '../components/Icon.jsx'
import {
  Badge,
  DonutChart,
  EmptyState,
  Field,
  MetricRing,
  Modal,
  PageHeader,
  ProgressBar,
  ProgressRing,
  SectionHeader,
} from '../components/DashboardUI.jsx'
import { useToast } from '../context/toast.js'
import {
  initialStudentNotes,
  learningProgress,
  quizResults,
  studentLessons,
  studentLiveClasses,
  studentQuizzes,
  studentSubjects,
} from '../data/sampleData.js'
import { useLearningData } from '../hooks/useLearningData.js'
import PresentationLibrary from '../presentation/PresentationLibrary.jsx'
import PresentationViewer from '../presentation/PresentationViewer.jsx'
import { ensurePresentationForLesson } from '../presentation/presentationStore.js'

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

const sharedQuizForStudent = (quiz, progress = {}) => {
  const sample = studentQuizzes.find(
    (item) => item.title.toLowerCase() === quiz.title.toLowerCase(),
  )

  return {
    ...quiz,
    title: quiz.quizTitle,
    type: 'Faculty quiz',
    subjectId: quiz.classId,
    subjectCode: quiz.subjectCode,
    facultyStatus: quiz.status,
    status:
      progress.status ||
      (quiz.status === 'Draft' ? 'Draft' : 'Available'),
    attemptsUsed: progress.attemptsUsed || 0,
    bestScore: progress.bestScore ?? null,
    due: quiz.dueDate || 'No deadline',
    questionList:
      quiz.questionList?.length > 0
        ? quiz.questionList
        : sample?.questionList || [],
  }
}

const loadNotes = () => {
  try {
    const stored = window.localStorage.getItem(NOTES_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch {
    // Fall back to the sample notes when storage is unavailable.
  }

  return initialStudentNotes
}

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function StudentDashboard({ user, onLogout }) {
  return (
    <ToastProvider>
      <StudentWorkspace user={user} onLogout={onLogout} />
    </ToastProvider>
  )
}

function StudentWorkspace({ user, onLogout }) {
  const {
    classes,
    quizzes: sharedQuizzes,
    activity,
    syncedAt,
    loading: sharedLoading,
  } = useLearningData()
  const [practiceQuizzes, setPracticeQuizzes] = useState([])
  const [quizProgress, setQuizProgress] = useState({})
  const [results, setResults] = useState(quizResults)

  const quizzes = useMemo(
    () => [
      ...practiceQuizzes,
      ...sharedQuizzes.map((quiz) =>
        sharedQuizForStudent(quiz, quizProgress[quiz.id]),
      ),
    ],
    [practiceQuizzes, quizProgress, sharedQuizzes],
  )

  const handleQuizComplete = (quiz, score, passed) => {
    const today = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    setResults((current) => [
      {
        id: `result-${Date.now()}`,
        quiz: quiz.title,
        subjectCode: quiz.subjectCode,
        date: today,
        score,
        passing: quiz.passing,
        attempt: 'Latest',
        status: passed ? 'Passed' : 'Failed',
      },
      ...current,
    ])

    if (quiz.type === 'Practice quiz') {
      setPracticeQuizzes((current) =>
        current.map((item) =>
          item.id === quiz.id
            ? {
                ...item,
                attemptsUsed: item.attemptsUsed + 1,
                bestScore: Math.max(item.bestScore || 0, score),
                status: 'Practice',
              }
            : item,
        ),
      )
      return
    }

    setQuizProgress((current) => {
      const previous = current[quiz.id] || {}
      return {
        ...current,
        [quiz.id]: {
          attemptsUsed: (previous.attemptsUsed || quiz.attemptsUsed || 0) + 1,
          bestScore: Math.max(previous.bestScore || 0, score),
          status: passed ? 'Completed' : 'Retake available',
        },
      }
    })
  }

  const handleCreatePractice = (quiz) => {
    setPracticeQuizzes((current) => [quiz, ...current])
  }

  return (
    <DashboardLayout role="Student" user={user} onLogout={onLogout}>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <StudentOverview
              user={user}
              results={results}
              classes={classes}
              quizzes={quizzes}
              activity={activity}
              syncedAt={syncedAt}
              syncing={sharedLoading}
            />
          }
        />
        <Route
          path="subjects"
          element={<StudentSubjects classes={classes} loading={sharedLoading} />}
        />
        <Route path="lessons" element={<StudentLessons />} />
        <Route
          path="presentations"
          element={<PresentationLibrary role="student" />}
        />
        <Route
          path="presentations/:presentationId"
          element={<PresentationViewer role="Student" />}
        />
        <Route path="notes" element={<StudentNotes />} />
        <Route
          path="quizzes"
          element={
            <StudentQuizzes
              quizzes={quizzes}
              onCreatePractice={handleCreatePractice}
              onQuizComplete={handleQuizComplete}
            />
          }
        />
        <Route path="results" element={<StudentResults results={results} />} />
        <Route path="progress" element={<StudentProgress />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  )
}

function StudentOverview({
  user,
  results,
  classes,
  quizzes,
  activity,
  syncedAt,
  syncing,
}) {
  const notify = useToast()
  const firstName = user.fullName.split(' ')[0]
  const activeClasses = classes.filter(
    (subject) => subject.status !== 'Archived',
  )
  const assignedQuizzes = quizzes.filter(
    (quiz) => quiz.type === 'Faculty quiz' && quiz.status !== 'Draft',
  )
  const completedLessons = studentLessons.filter(
    (lesson) => lesson.status === 'completed',
  ).length
  const overallProgress = Math.round(
    studentSubjects.reduce((total, subject) => total + subject.progress, 0) /
      studentSubjects.length,
  )
  const passedQuizzes = results.filter(
    (result) => result.status === 'Passed',
  ).length
  const continueLearning = studentLessons
    .filter((lesson) => lesson.status === 'current')
    .slice(0, 2)
    .map((lesson) => ({
      lesson,
      subject: studentSubjects.find(
        (subject) => subject.id === lesson.subjectId,
      ),
    }))
  const liveNow = studentLiveClasses.find(
    (session) => session.status === 'live',
  )
  const totalLessons = studentLessons.length

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
          <p>
            You&apos;ve completed {overallProgress}% of your weekly goal. Keep
            the momentum going and finish strong.
          </p>
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
          <MetricRing
            value={48}
            display="12"
            label="Day streak"
            tone="blue"
          />
          <MetricRing
            value={63}
            display="126"
            label="Hours"
            tone="violet"
          />
          <MetricRing
            value={72}
            display="3.6k"
            label="XP points"
            tone="amber"
          />
        </div>
      </section>

      <section className="lms-student-section">
        <div className="lms-student-section-head">
          <div>
            <h2>My Classes</h2>
            <p>Every class your teachers have shared with you.</p>
          </div>
          <Link to="/student/subjects" className="lms-link">
            View all classes
            <Icon name="arrowRight" size={13} />
          </Link>
        </div>

        <div className="lms-student-class-grid">
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
            </article>
          ))}
        </div>

        {activeClasses.length === 0 && (
          <div className="lms-card">
            <EmptyState
              icon="book"
              title="No classes yet"
              description="New classes created by your teacher will appear here automatically."
            />
          </div>
        )}
      </section>

      <section className="lms-student-section">
        <div className="lms-student-section-head">
          <div>
            <h2>Assigned Quizzes</h2>
            <p>Published assessments from your classes, always up to date.</p>
          </div>
          <Link to="/student/quizzes" className="lms-link">
            Open all quizzes
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
                <Link to="/student/quizzes" className="lms-link">
                  View quiz
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
                      <span>{subject?.name}</span>
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
                  {studentLiveClasses.map((session) => (
                    <tr key={session.id}>
                      <td>
                        <div className="lms-live-class">
                          <span
                            className={`lms-live-icon ${
                              session.status === 'live'
                                ? 'is-live'
                                : 'lms-tone-blue'
                            }`}
                          >
                            <Icon name="monitor" size={15} />
                          </span>
                          <div>
                            <strong>{session.title}</strong>
                            <span>{session.subjectCode}</span>
                          </div>
                        </div>
                      </td>
                      <td className="lms-cell-muted">{session.instructor}</td>
                      <td>
                        <span className="lms-live-time">
                          <strong>{session.day}</strong>
                          <span>{session.time}</span>
                        </span>
                      </td>
                      <td>
                        <div className="lms-live-action">
                          {session.status === 'live' && (
                            <Badge tone="danger" dot>
                              LIVE
                            </Badge>
                          )}
                          <button
                            type="button"
                            className={`lms-btn lms-btn-sm ${
                              session.status === 'live'
                                ? 'lms-btn-primary'
                                : 'lms-btn-secondary'
                            }`}
                            onClick={() =>
                              notify(
                                session.status === 'live'
                                  ? `Joining ${session.title} (demo).`
                                  : `Reminder set for ${session.title}.`,
                              )
                            }
                          >
                            {session.status === 'live' ? 'Join Now' : 'Set Reminder'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
                <strong>{completedLessons}</strong>
                <span>Completed</span>
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

          <LearningProgressWidget overall={overallProgress} />

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
              label="Lessons completed"
              value={Math.round((completedLessons / totalLessons) * 100)}
              tone="blue"
            />
            <ProgressBar
              label="Quizzes passed"
              value={Math.round((passedQuizzes / results.length) * 100)}
              tone="violet"
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

function LearningProgressWidget({ overall }) {
  const [range, setRange] = useState('Weekly')
  const segments =
    range === 'Weekly'
      ? [
          { label: 'Computing', value: 60, color: '#2f6fed' },
          { label: 'Mathematics', value: 24, color: '#7c4dd6' },
          { label: 'Web systems', value: 16, color: '#0f8b83' },
        ]
      : [
          { label: 'Computing', value: 52, color: '#2f6fed' },
          { label: 'Mathematics', value: 28, color: '#7c4dd6' },
          { label: 'Web systems', value: 20, color: '#0f8b83' },
        ]

  return (
    <section className="lms-card lms-card-pad lms-progress-widget">
      <div className="lms-progress-widget-head">
        <div>
          <h2>Learning Progress</h2>
          <p>Subject focus this period</p>
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

function StudentSubjects({ classes, loading }) {
  const [search, setSearch] = useState('')
  const [semester, setSemester] = useState('All')

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

  return (
    <>
      <PageHeader
        eyebrow="My classes"
        title="Your enrolled classes"
        description="Classes created by your teachers appear here automatically, with the latest subject details and schedules."
        actions={
          <Link to="/student/lessons" className="lms-btn lms-btn-secondary">
            <Icon name="presentation" size={16} />
            Open lessons
          </Link>
        }
      />

      <div className="lms-toolbar">
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
        <div className="lms-card lms-card-pad">
          <p className="lms-cell-muted">Loading classes from your teachers...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="lms-card">
          <EmptyState
            icon="book"
            title="No classes found"
            description="Try a different search term, or wait for your teacher to create a class."
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
                <span>Added {formatDate(subject.createdDate)}</span>
              </div>
              <div className="lms-subject-card-stats">
                <Link to="/student/lessons" className="lms-link">
                  Open class
                  <Icon name="arrowRight" size={12} />
                </Link>
                <Link to="/student/quizzes" className="lms-link">
                  View quizzes
                  <Icon name="arrowRight" size={12} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

function StudentLessons() {
  const notify = useToast()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState(
    studentLessons.find((lesson) => lesson.status === 'current')?.id ||
      studentLessons[0].id,
  )
  const [subjectFilter, setSubjectFilter] = useState('All')

  const visibleLessons = studentLessons.filter(
    (lesson) =>
      subjectFilter === 'All' || lesson.subjectId === subjectFilter,
  )
  const selected =
    studentLessons.find((lesson) => lesson.id === selectedId) ||
    visibleLessons[0]

  const openPresentation = (lesson) => {
    const presentation = ensurePresentationForLesson(lesson)
    navigate(`/student/presentations/${presentation.id}`)
  }

  return (
    <>
      <PageHeader
        eyebrow="Lessons"
        title="Lessons & presentations"
        description="Read lesson text, review uploaded presentations, and follow the topic sequence for each subject."
        actions={
          <select
            className="lms-select"
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
            aria-label="Filter lessons by subject"
          >
            <option value="All">All subjects</option>
            {studentSubjects.map((subject) => (
              <option value={subject.id} key={subject.id}>
                {subject.code} · {subject.name}
              </option>
            ))}
          </select>
        }
      />

      <div className="lms-lesson-layout">
        <aside className="lms-card lms-lesson-menu">
          <div className="lms-lesson-menu-head">
            <h2>Course topics</h2>
            <p>{visibleLessons.length} lessons available</p>
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
                  if (lesson.status === 'locked') {
                    notify(
                      'This topic is locked. Pass the required quiz to continue.',
                      'error',
                    )
                    return
                  }
                  setSelectedId(lesson.id)
                }}
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

        {selected && (
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

            {selected.presentation && (
              <div className="lms-presentation-card">
                <span className="lms-presentation-icon">
                  <Icon name="fileText" size={20} />
                </span>
                <div className="lms-presentation-copy">
                  <strong>{selected.presentation.name}</strong>
                  <span>
                    {selected.presentation.slides} slides ·{' '}
                    {selected.presentation.size} · uploaded by faculty
                  </span>
                </div>
                <button
                  type="button"
                  className="lms-btn lms-btn-secondary lms-btn-sm"
                  onClick={() => openPresentation(selected)}
                >
                  <Icon name="eye" size={14} />
                  View slides
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
              <Link to="/student/quizzes" className="lms-btn lms-btn-primary lms-btn-sm">
                <Icon name="quiz" size={14} />
                Take lesson quiz
              </Link>
            </div>
          </article>
        )}
      </div>
    </>
  )
}

function StudentNotes() {
  const notify = useToast()
  const [notes, setNotes] = useState(loadNotes)
  const [selectedId, setSelectedId] = useState(() => loadNotes()[0]?.id || null)

  useEffect(() => {
    try {
      window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
    } catch {
      // Notes still work for this session when storage is unavailable.
    }
  }, [notes])

  const selected = notes.find((note) => note.id === selectedId) || notes[0]

  const updateSelected = (patch) => {
    if (!selected) return
    setNotes((current) =>
      current.map((note) =>
        note.id === selected.id
          ? { ...note, ...patch, updatedAt: new Date().toISOString() }
          : note,
      ),
    )
  }

  const createNote = () => {
    const note = {
      id: `note-${Date.now()}`,
      topicId: studentLessons[0]?.id,
      title: 'Untitled note',
      body: '',
      updatedAt: new Date().toISOString(),
    }
    setNotes((current) => [note, ...current])
    setSelectedId(note.id)
    notify('New note created. Start writing your ideas.')
  }

  const deleteNote = () => {
    if (!selected) return
    setNotes((current) => current.filter((note) => note.id !== selected.id))
    setSelectedId(notes.find((note) => note.id !== selected.id)?.id || null)
    notify('Note deleted.', 'error')
  }

  return (
    <>
      <PageHeader
        eyebrow="My notes"
        title="Personal study notes"
        description="Capture important ideas per topic. Notes are saved in this browser for now."
        actions={
          <button type="button" className="lms-btn lms-btn-primary" onClick={createNote}>
            <Icon name="plus" size={16} />
            New note
          </button>
        }
      />

      {notes.length === 0 ? (
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
                const topic = studentLessons.find(
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
                  aria-label="Link note to topic"
                >
                  {studentLessons.map((lesson) => (
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
                  placeholder="Write your notes here..."
                  aria-label="Note content"
                />
              </div>

              <div className="lms-note-editor-foot">
                <span>
                  Last edited {formatDate(selected.updatedAt)} · saved locally
                </span>
                <button
                  type="button"
                  className="lms-btn lms-btn-primary lms-btn-sm"
                  onClick={() => notify('Note saved successfully.')}
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

function StudentQuizzes({ quizzes, onCreatePractice, onQuizComplete }) {
  const notify = useToast()
  const [tab, setTab] = useState('faculty')
  const [creating, setCreating] = useState(false)
  const [activeQuiz, setActiveQuiz] = useState(null)

  const filtered = quizzes.filter((quiz) =>
    tab === 'faculty'
      ? quiz.type === 'Faculty quiz'
      : quiz.type === 'Practice quiz',
  )

  const handleComplete = (quiz, score, passed) => {
    onQuizComplete(quiz, score, passed)
    notify(
      passed
        ? `Quiz submitted. You passed with ${score}%.`
        : `Quiz submitted. You scored ${score}%. Review and try again.`,
      passed ? 'success' : 'error',
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="My quizzes"
        title="Assessments & practice"
        description="Answer faculty quizzes, keep track of attempts, and create your own practice sets."
        actions={
          <button
            type="button"
            className="lms-btn lms-btn-primary"
            onClick={() => setCreating(true)}
          >
            <Icon name="plus" size={16} />
            Create practice quiz
          </button>
        }
      />

      <div className="lms-toolbar">
        <div className="lms-segmented" role="tablist" aria-label="Quiz type">
          <button
            type="button"
            className={tab === 'faculty' ? 'is-active' : ''}
            onClick={() => setTab('faculty')}
          >
            Faculty quizzes
          </button>
          <button
            type="button"
            className={tab === 'practice' ? 'is-active' : ''}
            onClick={() => setTab('practice')}
          >
            My practice quizzes
          </button>
        </div>
        <span className="lms-chip">
          <Icon name="shield" size={13} />
          Passing rule enforced
        </span>
      </div>

      <div className="lms-quiz-grid">
        {filtered.map((quiz) => {
          const attemptsLeft =
            quiz.attemptsAllowed - quiz.attemptsUsed
          const isDraft = quiz.status === 'Draft'
          const hasQuestions = quiz.questionList?.length > 0
          const isLocked =
            quiz.type === 'Faculty quiz' &&
            (quiz.status === 'Completed' ||
              attemptsLeft <= 0 ||
              isDraft ||
              !hasQuestions)

          return (
            <article className="lms-quiz-card" key={quiz.id}>
              <div className="lms-quiz-card-head">
                <span className="lms-quiz-card-icon lms-tone-violet">
                  <Icon name="quiz" size={18} />
                </span>
                <Badge
                  tone={
                    quiz.status === 'Completed'
                      ? 'success'
                      : quiz.status === 'Retake available' ||
                          quiz.status === 'Draft'
                        ? 'warning'
                        : quiz.status === 'Practice'
                          ? 'violet'
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
                    {quiz.attemptsUsed}/{quiz.attemptsAllowed}
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
                        ? 'No attempts remaining'
                        : quiz.type === 'Practice quiz'
                          ? 'Unlimited practice'
                          : `${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left`}
                </span>
                <button
                  type="button"
                  className="lms-btn lms-btn-primary lms-btn-sm"
                  disabled={isLocked}
                  onClick={() => setActiveQuiz(quiz)}
                >
                  <Icon name="play" size={13} />
                  {isDraft
                    ? 'Awaiting publish'
                    : !hasQuestions
                      ? 'Not ready'
                      : quiz.status === 'Retake available'
                        ? 'Retake'
                        : 'Start quiz'}
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {creating && (
        <PracticeQuizModal
          onClose={() => setCreating(false)}
          onCreate={(quiz) => {
            onCreatePractice(quiz)
            setCreating(false)
            setTab('practice')
            notify('Practice quiz created.')
          }}
        />
      )}

      {activeQuiz && (
        <QuizPlayer
          quiz={activeQuiz}
          onClose={() => setActiveQuiz(null)}
          onComplete={(quiz, score, passed) =>
            handleComplete(quiz, score, passed)
          }
        />
      )}
    </>
  )
}

function PracticeQuizModal({ onClose, onCreate }) {
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState(studentSubjects[0].id)
  const [timeLimit, setTimeLimit] = useState(10)
  const [passing, setPassing] = useState(70)
  const [prompt, setPrompt] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [answer, setAnswer] = useState(0)
  const [error, setError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!title.trim() || !prompt.trim()) {
      setError('Add a quiz title and a question before saving.')
      return
    }
    if (options.some((option) => !option.trim())) {
      setError('Please complete all four answer options.')
      return
    }

    const subject = studentSubjects.find((item) => item.id === subjectId)

    onCreate({
      id: `practice-${Date.now()}`,
      title: title.trim(),
      subjectId,
      subjectCode: subject?.code || 'General',
      type: 'Practice quiz',
      questions: 1,
      timeLimit: Number(timeLimit) || 10,
      maxScore: 100,
      passing: Number(passing) || 70,
      attemptsAllowed: 99,
      attemptsUsed: 0,
      bestScore: null,
      due: 'No deadline',
      status: 'Practice',
      questionList: [
        {
          id: 'practice-q1',
          prompt: prompt.trim(),
          options: options.map((option) => option.trim()),
          answer,
        },
      ],
    })
  }

  return (
    <Modal
      title="Create a practice quiz"
      description="Build a quick self-check for any subject. Practice quizzes do not affect your official grade."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="lms-btn lms-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="practice-quiz-form"
            className="lms-btn lms-btn-primary"
          >
            <Icon name="plus" size={15} />
            Save practice quiz
          </button>
        </>
      }
    >
      <form id="practice-quiz-form" onSubmit={handleSubmit}>
        {error && (
          <div className="lms-completion-note" style={{ marginBottom: 14, color: '#b33131', background: '#fdf3f3', borderColor: '#f1cccc' }}>
            <Icon name="alert" size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="lms-form-grid">
          <Field label="Quiz title" className="lms-field-full">
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Binary numbers quick check"
              required
            />
          </Field>
          <Field label="Subject">
            <select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              {studentSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} · {subject.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Time limit (minutes)">
            <input
              type="number"
              min="1"
              max="60"
              value={timeLimit}
              onChange={(event) => setTimeLimit(event.target.value)}
            />
          </Field>
          <Field label="Passing percentage">
            <input
              type="number"
              min="1"
              max="100"
              value={passing}
              onChange={(event) => setPassing(event.target.value)}
            />
          </Field>
          <Field label="Question" className="lms-field-full">
            <input
              type="text"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Write your practice question"
              required
            />
          </Field>
          {options.map((option, index) => (
            <Field
              key={index}
              label={`Option ${String.fromCharCode(65 + index)}`}
            >
              <input
                type="text"
                value={option}
                onChange={(event) =>
                  setOptions((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  )
                }
                placeholder={`Answer choice ${String.fromCharCode(65 + index)}`}
                required
              />
            </Field>
          ))}
          <Field label="Correct answer">
            <select
              value={answer}
              onChange={(event) => setAnswer(Number(event.target.value))}
            >
              {options.map((option, index) => (
                <option key={index} value={index}>
                  Option {String.fromCharCode(65 + index)}
                  {option ? ` — ${option}` : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </form>
    </Modal>
  )
}

function QuizPlayer({ quiz, onClose, onComplete }) {
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [remaining, setRemaining] = useState(Number(quiz.timeLimit) * 60)
  const questionList = quiz.questionList || []

  useEffect(() => {
    if (submitted || remaining <= 0) {
      return undefined
    }

    const timeout = window.setTimeout(
      () => setRemaining((value) => Math.max(0, value - 1)),
      1000,
    )
    return () => window.clearTimeout(timeout)
  }, [remaining, submitted])

  const correctCount = questionList.filter(
    (question) => answers[question.id] === question.answer,
  ).length
  const score =
    questionList.length > 0
      ? Math.round((correctCount / questionList.length) * 100)
      : 0
  const passed = score >= quiz.passing
  const answeredCount = Object.keys(answers).length
  const minutes = Math.floor(remaining / 60)
  const seconds = String(remaining % 60).padStart(2, '0')

  const handleSubmit = () => {
    setSubmitted(true)
    onComplete(quiz, score, passed)
  }

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
              onClick={handleSubmit}
            >
              <Icon name="check" size={15} />
              Submit quiz
            </button>
          </>
        )
      }
    >
      {submitted ? (
        <div className={`lms-result-box ${passed ? '' : 'is-failed'}`}>
          <Icon name={passed ? 'award' : 'alert'} size={28} />
          <strong>{score}%</strong>
          <h3 style={{ margin: '2px 0 4px' }}>
            {passed ? 'Assessment passed' : 'Keep practicing'}
          </h3>
          <p>
            You answered {correctCount} of {questionList.length} questions
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
              <div className="lms-answer-list">
                {question.options.map((option, optionIndex) => (
                  <label
                    className="lms-answer-option"
                    key={`${question.id}-${optionIndex}`}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      checked={answers[question.id] === optionIndex}
                      onChange={() =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: optionIndex,
                        }))
                      }
                    />
                    <span>
                      {String.fromCharCode(65 + optionIndex)}. {option}
                    </span>
                  </label>
                ))}
              </div>
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
          {['All', 'Passed', 'Failed', 'Retake available'].map((status) => (
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

function StudentProgress() {
  const [activeSubject, setActiveSubject] = useState(
    learningProgress[0].subjectId,
  )
  const selected =
    learningProgress.find((item) => item.subjectId === activeSubject) ||
    learningProgress[0]
  const overall = Math.round(
    learningProgress.reduce((total, subject) => total + subject.progress, 0) /
      learningProgress.length,
  )
  const navigate = useNavigate()

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
                Two topics are currently in progress. Keep completing lessons
                and required quizzes to unlock the rest of your path.
              </p>
              <Badge tone="success" dot>
                On track
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
            <ProgressBar label="Completed topics" value={68} tone="green" />
          </div>
          <div style={{ marginTop: 10 }}>
            <ProgressBar label="Quizzes passed" value={62} tone="violet" />
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
              {studentSubjects.find((item) => item.id === subject.subjectId)?.code}
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
