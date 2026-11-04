import { useEffect, useState } from 'react'
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
  Avatar,
  Badge,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SectionHeader,
} from '../components/DashboardUI.jsx'
import { useToast } from '../context/toast.js'
import { useLearningData } from '../hooks/useLearningData.js'
import PresentationEditor from '../presentation/PresentationEditor.jsx'
import PresentationLibrary from '../presentation/PresentationLibrary.jsx'
import PresentationViewer from '../presentation/PresentationViewer.jsx'
import { ensurePresentationForLesson } from '../presentation/presentationStore.js'
import ClassroomWorkspace from './ClassroomWorkspace.jsx'
import StudentAttachmentPreview from './StudentAttachmentPreview.jsx'

function FacultyDashboard({ user, onLogout, onUserUpdate }) {
  return (
    <ToastProvider>
      <FacultyWorkspace
        user={user}
        onLogout={onLogout}
        onUserUpdate={onUserUpdate}
      />
    </ToastProvider>
  )
}

function FacultyWorkspace({ user, onLogout, onUserUpdate }) {
  const notify = useToast()
  const [pendingLessonIds, setPendingLessonIds] = useState(() => new Set())
  const {
    classes: subjects,
    quizzes,
    students,
    slides,
    classwork,
    createSlide,
    updateSlide,
    createClass,
    updateClass,
    deleteClass,
    createQuiz,
    updateQuiz,
    getClassStudents,
    getClassQuizAttempts,
    getClassAnnouncements,
    getClassPeople,
    createClassAnnouncement,
    deleteClassAnnouncement,
    getClasswork,
    createClasswork,
    deleteClasswork,
    uploadClassworkAttachment,
    downloadClassworkAttachment,
    previewClassworkAttachment,
    getClassworkSubmissions,
    gradeClassworkSubmission,
    downloadSubmissionFile,
    uploadSlideFile,
    downloadSlideFile,
    loadSlideFilePreview,
    loading,
    error,
    refresh,
  } = useLearningData({ role: 'Faculty' })
  const lessons = slides.map((slide) => ({
    id: slide.id,
    subjectId: slide.classId,
    subjectCode: slide.subjectCode,
    title: slide.title,
    summary: slide.content[0]?.summary || '',
    content: slide.content[0]?.text || '',
    presentation: slide.content[0]?.presentation || null,
    type: slide.content[0]?.presentation?.fileName
      ? 'File attachment + text'
      : 'Text lesson',
    status: slide.status,
    updated: slide.updatedAt,
  }))

  const saveSubject = async (subject) => {
    const isEditing = subjects.some((item) => item.id === subject.id)

    try {
      if (isEditing) {
        await updateClass(subject.id, subject)
      } else {
        await createClass(subject)
      }
      notify(
        isEditing
          ? 'Class updated for students.'
          : 'Class created and shared with students.',
      )
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const deleteSubject = async (id) => {
    try {
      await deleteClass(id)
      notify('Class removed from the shared workspace.', 'error')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const saveLesson = async (lesson) => {
    const exists =
      slides.some((item) => item.id === lesson.id) ||
      pendingLessonIds.has(lesson.id)
    const payload = {
      classId: lesson.subjectId,
      title: lesson.title,
      content: [
        {
          summary: lesson.summary,
          text: lesson.content,
          presentation: lesson.presentation,
        },
      ],
      status: lesson.status,
    }

    let savedSlideId = lesson.id
    try {
      if (exists) {
        await updateSlide(lesson.id, payload)
      } else {
        const result = await createSlide(payload)
        savedSlideId = result.slide.id
        setPendingLessonIds((current) => new Set(current).add(savedSlideId))
      }
      if (lesson.presentationFile) {
        await uploadSlideFile(savedSlideId, lesson.presentationFile)
      }
      setPendingLessonIds((current) => {
        const next = new Set(current)
        next.delete(savedSlideId)
        return next
      })
      notify(
        lesson.presentationFile
          ? 'Lesson and file attachment saved for enrolled students.'
          : exists
            ? 'Lesson updated successfully.'
            : 'Lesson created successfully.',
      )
    } catch (error) {
      notify(error.message, 'error')
      if (!exists && savedSlideId) {
        error.lessonId = savedSlideId
      }
      throw error
    }
  }

  const toggleLessonStatus = async (id) => {
    const lesson = lessons.find((item) => item.id === id)
    if (!lesson) return
    try {
      await updateSlide(id, {
        status: lesson.status === 'Published' ? 'Draft' : 'Published',
      })
      notify('Lesson visibility updated.')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const saveQuiz = async (quiz) => {
    const isEditing = quizzes.some((item) => item.id === quiz.id)

    try {
      if (isEditing) {
        await updateQuiz(quiz.id, quiz)
      } else {
        await createQuiz(quiz)
      }
      notify(
        isEditing
          ? 'Quiz updated for students.'
          : 'Quiz created and shared with students.',
      )
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  return (
    <DashboardLayout
      role="Faculty"
      user={user}
      onLogout={onLogout}
      onUserUpdate={onUserUpdate}
    >
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <FacultyOverview
              user={user}
              subjects={subjects}
              lessons={lessons}
              quizzes={quizzes}
              students={students}
              loading={loading}
              error={error}
              onRetry={refresh}
            />
          }
        />
        <Route
          path="subjects"
          element={
            <SubjectManagement
              subjects={subjects}
              slides={slides}
              quizzes={quizzes}
              onSave={saveSubject}
              onDelete={deleteSubject}
              onViewStudents={getClassStudents}
              onViewScores={getClassQuizAttempts}
              getAnnouncements={getClassAnnouncements}
              getPeople={getClassPeople}
              createAnnouncement={createClassAnnouncement}
              deleteAnnouncement={deleteClassAnnouncement}
              classwork={classwork}
              getClasswork={getClasswork}
              createClasswork={createClasswork}
              deleteClasswork={deleteClasswork}
              uploadClassworkAttachment={uploadClassworkAttachment}
              downloadClassworkAttachment={downloadClassworkAttachment}
              previewClassworkAttachment={previewClassworkAttachment}
              getClassworkSubmissions={getClassworkSubmissions}
              gradeClassworkSubmission={gradeClassworkSubmission}
              downloadSubmissionFile={downloadSubmissionFile}
              downloadSlideFile={downloadSlideFile}
              loadSlideFilePreview={loadSlideFilePreview}
            />
          }
        />
        <Route
          path="lessons"
          element={
            <LessonManagement
              lessons={lessons}
              subjects={subjects}
              onSave={saveLesson}
              onToggleStatus={toggleLessonStatus}
              onPreviewLessonFile={loadSlideFilePreview}
              userId={user.id}
            />
          }
        />
        <Route
          path="presentations"
          element={
            <PresentationLibrary
              role="faculty"
              subjects={subjects}
              userId={user.id}
            />
          }
        />
        <Route
          path="presentations/:presentationId/edit"
          element={<PresentationEditor userId={user.id} />}
        />
        <Route
          path="presentations/:presentationId/present"
          element={<PresentationViewer role="Faculty" userId={user.id} />}
        />
        <Route
          path="quizzes"
          element={
            <QuizManagement
              quizzes={quizzes}
              subjects={subjects}
              onSave={saveQuiz}
            />
          }
        />
        <Route
          path="performance"
          element={<StudentPerformance students={students} subjects={subjects} />}
        />
        <Route path="reports" element={<FacultyReports subjects={subjects} />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  )
}

const classCodeFor = (subject) => {
  if (subject.classCode) return subject.classCode

  const code = subject.code.replace(/\s+/g, '')
  const hash = Array.from(subject.id)
    .reduce((total, character) => total * 31 + character.charCodeAt(0), 7)
    .toString(36)
    .toUpperCase()
    .padStart(5, '0')
    .slice(-5)

  return `${code}-${hash}`
}

function FacultyOverview({
  subjects,
  lessons,
  quizzes,
  students,
  loading,
  error,
  onRetry,
}) {
  const navigate = useNavigate()
  const studentCount = students.length
  const submissions = quizzes.reduce((total, quiz) => total + quiz.attempts, 0)
  const publishedLessons = lessons.filter(
    (lesson) => lesson.status === 'Published',
  ).length
  const passedReports = 0
  const passRate = 0
  const completionRate = Math.round(
    (publishedLessons / Math.max(lessons.length, 1)) * 100,
  )
  const draftTests = quizzes.filter((quiz) => quiz.status === 'Draft').length

  const testDates = ['Oct 24, 2026', 'Oct 21, 2026', 'Oct 18, 2026', 'Oct 12, 2026']
  const recentTests = quizzes.slice(0, 4).map((quiz, index) => ({
    ...quiz,
    created: testDates[index] || 'Just now',
    tone:
      subjects.find((subject) => subject.id === quiz.subjectId)?.accent ||
      'violet',
  }))

  const recentSubmissions = []

  return (
    <div className="lms-faculty-overview">
      <PageHeader
        eyebrow="Faculty workspace"
        title="Teacher Dashboard"
        description="Track your classes, assessments, and learner activity from one clear workspace."
        actions={
          <>
            <Link
              to="/faculty/subjects?create=1"
              className="lms-btn lms-btn-secondary"
            >
              <Icon name="plus" size={16} />
              Create New Class
            </Link>
            <Link
              to="/faculty/quizzes?create=1"
              className="lms-btn lms-btn-primary"
            >
              <Icon name="quiz" size={16} />
              Create New Quiz
            </Link>
          </>
        }
      />

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
          Loading your classes and dashboard...
        </div>
      )}

      <div className="lms-faculty-kpis">
        {[
          {
            label: 'Total Tests',
            value: quizzes.length,
            meta: 'Across all class workspaces',
            icon: 'quiz',
            tone: 'violet',
          },
          {
            label: 'Total Classes',
            value: subjects.length,
            meta: `${subjects.filter((subject) => subject.status === 'Published').length} currently active`,
            icon: 'presentation',
            tone: 'indigo',
          },
          {
            label: 'Total Submissions',
            value: submissions,
            meta: 'Student quiz attempts recorded',
            icon: 'fileText',
            tone: 'blue',
          },
          {
            label: 'Total Students',
            value: studentCount,
            meta: 'Enrolled across your classes',
            icon: 'users',
            tone: 'green',
          },
        ].map((item) => (
          <article
            className={`lms-faculty-kpi lms-kpi-${item.tone}`}
            key={item.label}
          >
            <span className="lms-faculty-kpi-icon">
              <Icon name={item.icon} size={20} />
            </span>
            <span className="lms-faculty-kpi-label">{item.label}</span>
            <strong>{item.value}</strong>
            <span className="lms-faculty-kpi-meta">{item.meta}</span>
          </article>
        ))}
      </div>

      <div className="lms-faculty-mini-kpis">
        <article className="lms-faculty-mini lms-mini-green">
          <div>
            <span>Pass Rate</span>
            <strong>{passRate}%</strong>
            <p>
              {passedReports} graded submissions above passing
            </p>
          </div>
          <span className="lms-faculty-mini-icon">
            <Icon name="award" size={20} />
          </span>
        </article>
        <article className="lms-faculty-mini lms-mini-amber">
          <div>
            <span>Completion Rate</span>
            <strong>{completionRate}%</strong>
            <p>
              {publishedLessons} of {lessons.length} lessons published
            </p>
          </div>
          <span className="lms-faculty-mini-icon">
            <Icon name="trend" size={20} />
          </span>
        </article>
        <article className="lms-faculty-mini lms-mini-blue">
          <div>
            <span>Tests Remaining</span>
            <strong>{draftTests}</strong>
            <p>
              {draftTests === 1 ? 'Draft waiting to publish' : 'Drafts waiting to publish'}
            </p>
          </div>
          <span className="lms-faculty-mini-icon">
            <Icon name="clock" size={20} />
          </span>
        </article>
      </div>

      <div className="lms-faculty-grid">
        <section className="lms-card lms-card-pad lms-faculty-panel">
          <SectionHeader
            title="Recent Tests"
            description="Your latest assessments and submission activity."
            action={
              <Link to="/faculty/quizzes" className="lms-link">
                View all
                <Icon name="arrowRight" size={13} />
              </Link>
            }
          />

          {loading && recentTests.length === 0 ? (
            <p className="lms-cell-muted" role="status">Loading assessments...</p>
          ) : recentTests.length > 0 ? (
            <div className="lms-table-wrap">
              <table className="lms-table lms-faculty-table lms-tests-table">
                <thead>
                  <tr>
                    <th>Test name</th>
                    <th>Created</th>
                    <th>Submissions</th>
                    <th aria-label="Open test" />
                  </tr>
                </thead>
                <tbody>
                  {recentTests.map((test) => (
                    <tr key={test.id}>
                      <td>
                        <div className="lms-faculty-test">
                          <span
                            className={`lms-faculty-test-cover lms-tone-${test.tone}`}
                          >
                            <Icon name="fileText" size={16} />
                          </span>
                          <div>
                            <strong>{test.title}</strong>
                            <span>{test.subjectCode}</span>
                          </div>
                        </div>
                      </td>
                      <td className="lms-cell-muted">{test.created}</td>
                      <td>
                        <span className="lms-faculty-submissions">
                          <strong>{test.attempts}</strong> submissions
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="lms-icon-btn"
                          onClick={() => navigate('/faculty/quizzes')}
                          aria-label={`Open ${test.title}`}
                        >
                          <Icon name="arrowRight" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="quiz"
              title="No tests yet"
              description="Create your first quiz to start collecting submissions."
            />
          )}
        </section>

        <section className="lms-card lms-card-pad lms-faculty-panel">
          <SectionHeader
            title="My Classes"
            description="Active class workspaces and their enrollment."
            action={
              <Link to="/faculty/subjects" className="lms-link">
                All classes
                <Icon name="arrowRight" size={13} />
              </Link>
            }
          />

          {loading && subjects.length === 0 ? (
            <p className="lms-cell-muted" role="status">Loading your classes...</p>
          ) : subjects.length > 0 ? (
            <div className="lms-faculty-class-list">
              {subjects.slice(0, 4).map((subject) => (
                <Link
                  to={`/faculty/subjects?classId=${encodeURIComponent(subject.id)}`}
                  className="lms-faculty-class"
                  key={subject.id}
                >
                  <span
                    className={`lms-faculty-class-icon lms-tone-${subject.accent || 'violet'}`}
                  >
                    <Icon name="book" size={17} />
                  </span>
                  <span className="lms-faculty-class-copy">
                    <strong>{subject.name}</strong>
                    <span>
                      {subject.code} · {subject.students} students
                    </span>
                  </span>
                  <span className="lms-faculty-code">
                    {classCodeFor(subject)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="book"
              title="No classes yet"
              description="Create a class to share lessons and quizzes with students."
            />
          )}
        </section>
      </div>

      <div className="lms-faculty-grid lms-faculty-grid-bottom">
        <section className="lms-card lms-card-pad lms-faculty-panel">
          <SectionHeader
            title="Recent Submissions"
            description="Latest quiz attempts from your learners."
            action={
              <Link to="/faculty/performance" className="lms-link">
                View all
                <Icon name="arrowRight" size={13} />
              </Link>
            }
          />

          {loading && recentSubmissions.length === 0 ? (
            <p className="lms-cell-muted" role="status">Loading submissions...</p>
          ) : recentSubmissions.length > 0 ? (
            <div className="lms-table-wrap">
              <table className="lms-table lms-faculty-table lms-submission-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Test</th>
                    <th>Score</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubmissions.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <div className="lms-faculty-student">
                          <Avatar name={student.name} size="sm" />
                          <div>
                            <strong>{student.name}</strong>
                            <span>@{student.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="lms-cell-muted">{student.test}</td>
                      <td>
                        <span
                          className={`lms-faculty-score ${
                            student.average >= 75 ? 'is-pass' : 'is-fail'
                          }`}
                        >
                          {student.average}%
                        </span>
                      </td>
                      <td className="lms-cell-muted">{student.lastActive}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="fileText"
              title="No submissions yet"
              description="Student quiz attempts will appear here once they start answering."
            />
          )}
        </section>

        <section className="lms-card lms-card-pad lms-faculty-panel">
          <SectionHeader
            title="Recent Enrollments"
            description="Students who recently joined your classes."
            action={
              <Link to="/faculty/subjects" className="lms-link">
                All classes
                <Icon name="arrowRight" size={13} />
              </Link>
            }
          />

          {loading && students.length === 0 ? (
            <p className="lms-cell-muted" role="status">Loading enrollments...</p>
          ) : students.length > 0 ? (
            <div className="lms-faculty-enrollment-list">
              {students.slice(0, 4).map((student) => (
                <div className="lms-faculty-enrollment" key={student.id}>
                  <Avatar name={student.name} size="sm" />
                  <div className="lms-faculty-enrollment-copy">
                    <strong>{student.name}</strong>
                    <span>
                      Enrolled in {student.classNames.join(', ') || 'your class'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="users"
              title="No enrollments yet"
              description="New students will appear here as they join your classes."
            />
          )}
        </section>
      </div>
    </div>
  )
}

function SubjectManagement({
  subjects,
  slides,
  quizzes,
  onSave,
  onDelete,
  onViewStudents,
  onViewScores,
  getAnnouncements,
  getPeople,
  createAnnouncement,
  deleteAnnouncement,
  classwork,
  getClasswork,
  createClasswork,
  deleteClasswork,
  uploadClassworkAttachment,
  downloadClassworkAttachment,
  previewClassworkAttachment,
  getClassworkSubmissions,
  gradeClassworkSubmission,
  downloadSubmissionFile,
  downloadSlideFile,
  loadSlideFilePreview,
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [editing, setEditing] = useState(() =>
    searchParams.get('create') === '1' ? {} : null,
  )
  const [rosterClass, setRosterClass] = useState(null)
  const [rosterStudents, setRosterStudents] = useState([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterError, setRosterError] = useState('')
  const [scoresClass, setScoresClass] = useState(null)
  const [quizAttempts, setQuizAttempts] = useState([])
  const [scoresLoading, setScoresLoading] = useState(false)
  const [scoresError, setScoresError] = useState('')
  const workspaceClass = subjects.find(
    (subject) => subject.id === searchParams.get('classId'),
  )

  const openWorkspace = (learningClass) => {
    const next = new URLSearchParams(searchParams)
    next.set('classId', learningClass.id)
    setSearchParams(next)
  }

  const closeWorkspace = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('classId')
    setSearchParams(next)
  }

  const openRoster = async (learningClass) => {
    setRosterClass(learningClass)
    setRosterStudents([])
    setRosterError('')
    setRosterLoading(true)
    try {
      setRosterStudents(await onViewStudents(learningClass.id))
    } catch (error) {
      setRosterError(error.message)
    } finally {
      setRosterLoading(false)
    }
  }

  const openScores = async (learningClass) => {
    setScoresClass(learningClass)
    setQuizAttempts([])
    setScoresError('')
    setScoresLoading(true)
    try {
      setQuizAttempts(await onViewScores(learningClass.id))
    } catch (error) {
      setScoresError(error.message)
    } finally {
      setScoresLoading(false)
    }
  }

  const filtered = subjects.filter((subject) =>
    `${subject.code} ${subject.name} ${subject.subject} ${subject.term} ${subject.academicYear}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  return (
    <>
      {workspaceClass ? (
        <ClassroomWorkspace
          learningClass={workspaceClass}
          role="Faculty"
          slides={slides.filter((slide) => slide.classId === workspaceClass.id)}
          quizzes={quizzes.filter((quiz) => quiz.classId === workspaceClass.id)}
          getAnnouncements={getAnnouncements}
          getPeople={getPeople}
          createAnnouncement={createAnnouncement}
          deleteAnnouncement={deleteAnnouncement}
          classwork={classwork.filter((item) => item.classId === workspaceClass.id)}
          getClasswork={getClasswork}
          createClasswork={createClasswork}
          deleteClasswork={deleteClasswork}
          uploadClassworkAttachment={uploadClassworkAttachment}
          downloadClassworkAttachment={downloadClassworkAttachment}
          onPreviewAttachment={previewClassworkAttachment}
          getClassworkSubmissions={getClassworkSubmissions}
          gradeClassworkSubmission={gradeClassworkSubmission}
          downloadSubmissionFile={downloadSubmissionFile}
          onDownloadFile={downloadSlideFile}
          onPreviewFile={loadSlideFilePreview}
          getStudents={onViewStudents}
          onViewScores={openScores}
          onClose={closeWorkspace}
        />
      ) : (
        <>
          <PageHeader
            eyebrow="Class management"
            title="Manage your classes"
            description="Create classes that appear instantly on the student dashboard, with their subject, term, and academic year."
            actions={
              <button
                type="button"
                className="lms-btn lms-btn-primary"
                onClick={() => setEditing({})}
              >
                <Icon name="plus" size={16} />
                Create new class
              </button>
            }
          />

          <div className="lms-toolbar">
            <label className="lms-filter-input">
              <Icon name="search" size={15} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search classes, codes, or terms"
                aria-label="Search classes"
              />
            </label>
            <span className="lms-chip">
              <Icon name="book" size={13} />
              {filtered.length} subject{filtered.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="lms-table-wrap">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Term</th>
                  <th>Academic year</th>
                  <th>Students</th>
                  <th>Lessons</th>
                  <th>Quizzes</th>
                  <th>Average</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((subject) => (
                  <tr key={subject.id}>
                    <td>
                      <div className="lms-table-user">
                        <span
                          className={`lms-subject-code lms-tone-${subject.accent || 'blue'}`}
                        >
                          {subject.code}
                        </span>
                        <div>
                          <strong>{subject.name}</strong>
                          <span>
                            {subject.subject || subject.term} · Class code:{' '}
                            {classCodeFor(subject)}
                          </span>
                          <button
                            type="button"
                            className="lms-link"
                            onClick={() => openWorkspace(subject)}
                          >
                            Open classroom
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="lms-cell-muted">{subject.term}</td>
                    <td className="lms-cell-muted">{subject.academicYear}</td>
                    <td>
                      <button
                        type="button"
                        className="lms-link"
                        onClick={() => openRoster(subject)}
                        aria-label={`View ${subject.students} students in ${subject.name}`}
                      >
                        {subject.students} · View students
                      </button>
                      <button
                        type="button"
                        className="lms-link"
                        onClick={() => openScores(subject)}
                        aria-label={`View quiz scores in ${subject.name}`}
                      >
                        View scores
                      </button>
                    </td>
                    <td className="lms-cell-muted">{subject.lessons}</td>
                    <td className="lms-cell-muted">{subject.quizzes}</td>
                    <td>
                      <span className="lms-score">
                        {subject.average}%
                        <span className="lms-score-bar">
                          <span
                            style={{
                              width: `${subject.average}%`,
                              background:
                                subject.average >= 80 ? '#16825f' : '#d18a2e',
                            }}
                          />
                        </span>
                      </span>
                    </td>
                    <td>
                      <Badge
                        tone={subject.status === 'Published' ? 'success' : 'neutral'}
                        dot
                      >
                        {subject.status}
                      </Badge>
                    </td>
                    <td>
                      <div className="lms-table-actions">
                        <button
                          type="button"
                          className="lms-icon-btn"
                          onClick={() => setEditing(subject)}
                          aria-label={`Edit ${subject.code}`}
                          title={`Edit ${subject.code}`}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          className="lms-icon-btn lms-icon-btn-danger"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete ${subject.code}? It will be removed from the student dashboard.`,
                              )
                            ) {
                              onDelete(subject.id)
                            }
                          }}
                          aria-label={`Delete ${subject.code}`}
                          title={`Delete ${subject.code}`}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <EmptyState
              icon="book"
              title="No subjects found"
              description="Try a different search term or add a new subject."
            />
          )}
        </>
      )}

      {editing && (
        <SubjectFormModal
          subject={editing}
          onClose={() => setEditing(null)}
          onSave={(subject) => {
            onSave(subject)
            setEditing(null)
          }}
        />
      )}

      {rosterClass && (
        <Modal
          title={`${rosterClass.name} students`}
          description={`${rosterStudents.length} actively enrolled student${rosterStudents.length === 1 ? '' : 's'} in ${rosterClass.code}.`}
          onClose={() => setRosterClass(null)}
          size="md"
        >
          {rosterLoading ? (
            <p className="lms-cell-muted">Loading enrolled students...</p>
          ) : rosterError ? (
            <p role="alert" className="lms-cell-muted">{rosterError}</p>
          ) : rosterStudents.length === 0 ? (
            <EmptyState
              icon="users"
              title="No students enrolled"
              description="Students who join this class will appear here."
            />
          ) : (
            <div className="lms-faculty-enrollment-list">
              {rosterStudents.map((student) => (
                <div className="lms-faculty-enrollment" key={student.id}>
                  <Avatar name={student.name} size="sm" />
                  <div className="lms-faculty-enrollment-copy">
                    <strong>{student.name}</strong>
                    <span>@{student.username}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {scoresClass && (
        <Modal
          title={`${scoresClass.name} quiz scores`}
          description="Scores from students actively enrolled in this class. Each row represents one submitted attempt."
          onClose={() => setScoresClass(null)}
          size="lg"
        >
          {scoresLoading ? (
            <p className="lms-cell-muted">Loading quiz scores...</p>
          ) : scoresError ? (
            <p role="alert" className="lms-cell-muted">{scoresError}</p>
          ) : quizAttempts.length === 0 ? (
            <EmptyState
              icon="chart"
              title="No quiz submissions yet"
              description="Scores will appear here after students submit a published quiz."
            />
          ) : (
            <div className="lms-table-wrap">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Quiz</th>
                    <th>Score</th>
                    <th>Result</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {quizAttempts.map((attempt) => (
                    <tr key={attempt.id}>
                      <td>
                        <div className="lms-table-user">
                          <Avatar name={attempt.studentName} size="sm" />
                          <div>
                            <strong>{attempt.studentName}</strong>
                            <span>@{attempt.username}</span>
                          </div>
                        </div>
                      </td>
                      <td>{attempt.quizTitle}</td>
                      <td>
                        <strong>{attempt.score}%</strong>
                        <span className="lms-cell-muted">
                          {' '}({attempt.correctCount}/{attempt.questionCount})
                        </span>
                      </td>
                      <td>
                        <Badge tone={attempt.passed ? 'success' : 'warning'} dot>
                          {attempt.passed ? 'Passed' : 'Not passed'}
                        </Badge>
                      </td>
                      <td className="lms-cell-muted">
                        {new Date(attempt.submittedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}

function SubjectFormModal({ subject, onClose, onSave }) {
  const isEditing = Boolean(subject.id)
  const [form, setForm] = useState({
    code: subject.subjectCode || subject.code || '',
    name: subject.className || subject.name || '',
    subject: subject.subject || '',
    term: subject.term || 'First Semester',
    academicYear: subject.academicYear || '2026–2027',
    status: subject.status || 'Published',
    description: subject.description || '',
  })

  const update = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }))

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({
      ...subject,
      id: subject.id || `class-${Date.now()}`,
      className: form.name.trim(),
      name: form.name.trim(),
      subject: form.subject.trim(),
      subjectCode: form.code.trim(),
      code: form.code.trim(),
      term: form.term,
      academicYear: form.academicYear,
      status: form.status,
      description: form.description.trim(),
      students: subject.students || 0,
      lessons: subject.lessons || 0,
      quizzes: subject.quizzes || 0,
      average: subject.average || 0,
      accent: subject.accent || 'blue',
    })
  }

  return (
    <Modal
      title={isEditing ? 'Edit class' : 'Create new class'}
      description="Class details are shared with the student dashboard as soon as you save."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="lms-btn lms-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="subject-form"
            className="lms-btn lms-btn-primary"
          >
            {isEditing ? 'Save changes' : 'Create class'}
          </button>
        </>
      }
    >
      <form id="subject-form" className="lms-form-grid" onSubmit={handleSubmit}>
        <Field label="Subject code">
          <input
            type="text"
            value={form.code}
            onChange={(event) => update('code', event.target.value)}
            placeholder="e.g. CS 101"
            required
          />
        </Field>
        <Field label="Class name">
          <input
            type="text"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="e.g. Introduction to Computing"
            required
          />
        </Field>
        <Field label="Subject">
          <input
            type="text"
            value={form.subject}
            onChange={(event) => update('subject', event.target.value)}
            placeholder="e.g. Computer Science"
            required
          />
        </Field>
        <Field label="Term">
          <select
            value={form.term}
            onChange={(event) => update('term', event.target.value)}
          >
            <option>First Semester</option>
            <option>Second Semester</option>
            <option>Third Semester</option>
            <option>Summer Term</option>
          </select>
        </Field>
        <Field label="Academic year">
          <input
            type="text"
            value={form.academicYear}
            onChange={(event) => update('academicYear', event.target.value)}
            placeholder="e.g. 2026–2027"
            required
          />
        </Field>
        <Field label="Visibility">
          <select
            value={form.status}
            onChange={(event) => update('status', event.target.value)}
          >
            <option>Published</option>
            <option>Draft</option>
            <option>Archived</option>
          </select>
        </Field>
        <Field label="Class description" className="lms-field-full">
          <textarea
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            placeholder="Short description students will see on their dashboard"
          />
        </Field>
      </form>
    </Modal>
  )
}

function LessonManagement({
  lessons,
  subjects,
  onSave,
  onToggleStatus,
  onPreviewLessonFile,
  userId,
}) {
  const navigate = useNavigate()
  const notify = useToast()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [filePreview, setFilePreview] = useState(null)
  const [previewingLessonId, setPreviewingLessonId] = useState('')
  const [editing, setEditing] = useState(() =>
    searchParams.get('create') === '1'
      ? { subjectId: searchParams.get('classId') || '' }
      : null,
  )

  useEffect(
    () => () => {
      if (filePreview?.url) URL.revokeObjectURL(filePreview.url)
    },
    [filePreview],
  )

  const previewLessonFile = async (lesson) => {
    if (!onPreviewLessonFile || !lesson.presentation?.fileId) return
    setPreviewingLessonId(lesson.id)
    try {
      setFilePreview(await onPreviewLessonFile(lesson.id))
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setPreviewingLessonId('')
    }
  }

  const filtered = lessons.filter((lesson) => {
    const matchesSearch = `${lesson.title} ${lesson.subjectCode}`
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchesSubject =
      subjectFilter === 'All' || lesson.subjectId === subjectFilter
    return matchesSearch && matchesSubject
  })

  const openSlideStudio = (lesson) => {
    const presentation = ensurePresentationForLesson(lesson, userId)
    navigate(`/faculty/presentations/${presentation.id}/edit`)
  }

  return (
    <>
      <PageHeader
        eyebrow="Lesson management"
        title="Lessons & presentations"
        description="Create lesson text, attach files, write summaries, and control what students can access."
        actions={
          <button
            type="button"
            className="lms-btn lms-btn-primary"
            onClick={() =>
              setEditing({ subjectId: searchParams.get('classId') || '' })
            }
          >
            <Icon name="plus" size={16} />
            New lesson
          </button>
        }
      />

      <div className="lms-toolbar">
        <label className="lms-filter-input">
          <Icon name="search" size={15} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search lesson title or subject code"
            aria-label="Search lessons"
          />
        </label>
        <select
          className="lms-select"
          value={subjectFilter}
          onChange={(event) => setSubjectFilter(event.target.value)}
          aria-label="Filter lessons by subject"
        >
          <option value="All">All subjects</option>
          {subjects.map((subject) => (
            <option value={subject.id} key={subject.id}>
              {subject.code}
            </option>
          ))}
        </select>
        <span className="lms-chip">
          <Icon name="presentation" size={13} />
          {filtered.length} lesson{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="lms-table-wrap">
        <table className="lms-table">
          <thead>
            <tr>
              <th>Lesson</th>
              <th>Subject</th>
              <th>Content</th>
              <th>Presentation</th>
              <th>Status</th>
              <th>Updated</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((lesson) => (
              <tr key={lesson.id}>
                <td>
                  <div className="lms-table-user">
                    <span className="lms-lesson-row-icon lms-tone-violet">
                      <Icon name="fileText" size={15} />
                    </span>
                    <div>
                      <strong>{lesson.title}</strong>
                      <span>{lesson.subjectCode}</span>
                    </div>
                  </div>
                </td>
                <td className="lms-cell-muted">{lesson.subjectCode}</td>
                <td className="lms-cell-muted">{lesson.type}</td>
                <td className="lms-cell-muted">
                  {lesson.presentation?.fileName || 'No file uploaded'}
                </td>
                <td>
                  <Badge
                    tone={
                      lesson.status === 'Published'
                        ? 'success'
                        : lesson.status === 'Scheduled'
                          ? 'info'
                          : 'warning'
                    }
                    dot
                  >
                    {lesson.status}
                  </Badge>
                </td>
                <td className="lms-cell-muted">{lesson.updated}</td>
                <td>
                  <div className="lms-table-actions">
                    <button
                      type="button"
                      className="lms-icon-btn"
                      onClick={() => openSlideStudio(lesson)}
                      aria-label={`Open slide deck for ${lesson.title}`}
                      title="Open in Presentation Studio"
                    >
                      <Icon name="layers" size={14} />
                    </button>
                    {lesson.presentation?.fileId && onPreviewLessonFile && (
                      <button
                        type="button"
                        className="lms-icon-btn"
                        onClick={() => previewLessonFile(lesson)}
                        disabled={previewingLessonId === lesson.id}
                        aria-label={`Preview file for ${lesson.title}`}
                        title="Preview file"
                      >
                        <Icon name="fileText" size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="lms-icon-btn"
                      onClick={() => onToggleStatus(lesson.id)}
                      aria-label={`Toggle visibility for ${lesson.title}`}
                      title="Toggle visibility"
                    >
                      <Icon name="eye" size={14} />
                    </button>
                    <button
                      type="button"
                      className="lms-icon-btn"
                      onClick={() => setEditing(lesson)}
                      aria-label={`Edit ${lesson.title}`}
                      title={`Edit ${lesson.title}`}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon="presentation"
          title="No lessons found"
          description="Try a different filter or create a new lesson."
        />
      )}

      {editing && (
        <LessonFormModal
          lesson={editing}
          subjects={subjects}
          onClose={() => setEditing(null)}
          onSave={async (lesson) => {
            await onSave(lesson)
            setEditing(null)
          }}
        />
      )}

      {filePreview && (
        <Modal
          title={filePreview.fileName || 'File preview'}
          description="Preview of the file uploaded for this lesson."
          onClose={() => setFilePreview(null)}
          size="lg"
        >
          <StudentAttachmentPreview
            key={filePreview.url}
            file={filePreview}
          />
        </Modal>
      )}
    </>
  )
}

function LessonFormModal({ lesson, subjects, onClose, onSave }) {
  const isEditing = Boolean(lesson.id)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [persistedLessonId, setPersistedLessonId] = useState('')
  const [form, setForm] = useState({
    title: lesson.title || '',
    subjectId: lesson.subjectId || subjects[0]?.id || '',
    summary: lesson.summary || '',
    content: lesson.content || '',
    presentation: lesson.presentation || null,
    presentationFile: null,
    status: lesson.status || 'Draft',
  })

  const update = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }))

  const selectedSubject = subjects.find(
    (subject) => subject.id === form.subjectId,
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      await onSave({
        ...lesson,
        id: lesson.id || persistedLessonId || `lesson-${Date.now()}`,
        ...form,
        subjectCode: selectedSubject?.code || lesson.subjectCode || '',
        type: form.presentationFile || form.presentation
          ? 'Presentation + text'
          : 'Text + summary',
        updated: 'Just now',
      })
    } catch (error) {
      setSaveError(error.message || 'Could not save this lesson.')
      if (error.lessonId) setPersistedLessonId(error.lessonId)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEditing ? 'Edit lesson' : 'Create lesson'}
      description="Add lesson text, an optional presentation, and a short summary for students."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button
            type="button"
            className="lms-btn lms-btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="lesson-form"
            className="lms-btn lms-btn-primary"
            disabled={saving}
          >
            {saving
              ? form.presentationFile
                ? 'Uploading file...'
                : 'Saving lesson...'
              : isEditing
                ? 'Save lesson'
                : 'Publish lesson'}
          </button>
        </>
      }
    >
      <form id="lesson-form" className="lms-form-grid" onSubmit={handleSubmit}>
        {saveError && (
          <p className="lms-field-full" role="alert">
            {saveError}
          </p>
        )}
        <Field label="Lesson title" className="lms-field-full">
          <input
            type="text"
            value={form.title}
            onChange={(event) => update('title', event.target.value)}
            placeholder="e.g. Foundations of Computing"
            required
          />
        </Field>
        <Field label="Subject">
          <select
            value={form.subjectId}
            onChange={(event) => update('subjectId', event.target.value)}
          >
            {subjects.map((subject) => (
              <option value={subject.id} key={subject.id}>
                {subject.code} · {subject.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Visibility">
          <select
            value={form.status}
            onChange={(event) => update('status', event.target.value)}
          >
            <option>Draft</option>
            <option>Published</option>
            <option>Scheduled</option>
          </select>
        </Field>
        <Field label="Short summary" className="lms-field-full">
          <input
            type="text"
            value={form.summary}
            onChange={(event) => update('summary', event.target.value)}
            placeholder="A one-sentence overview of the lesson"
          />
        </Field>
        <Field label="Lesson text" className="lms-field-full">
          <textarea
            value={form.content}
            onChange={(event) => update('content', event.target.value)}
            placeholder="Write the lesson content students will read..."
          />
        </Field>
        <Field
          label="Lesson file attachment"
          hint="Upload any file type (maximum 25 MB). Enrolled students can preview supported files or download it after the lesson is published."
          className="lms-field-full"
        >
          <input
            type="file"
            onChange={(event) =>
              update('presentationFile', event.target.files?.[0] || null)
            }
          />
        </Field>
        {(form.presentationFile || form.presentation?.fileName) && (
          <div className="lms-completion-note lms-field-full">
            <Icon name="checkCircle" size={15} />
            <span>
              {form.presentationFile
                ? `Selected file: ${form.presentationFile.name}`
                : `Attached file: ${form.presentation.fileName}`}
            </span>
          </div>
        )}
      </form>
    </Modal>
  )
}

function QuizManagement({ quizzes, subjects, onSave }) {
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [editing, setEditing] = useState(() =>
    searchParams.get('create') === '1'
      ? { subjectId: searchParams.get('classId') || '' }
      : null,
  )

  const filtered = quizzes.filter((quiz) =>
    `${quiz.title} ${quiz.subjectCode}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  return (
    <>
      <PageHeader
        eyebrow="Quiz management"
        title="Quizzes & scoring rules"
        description="Build assessments, add questions, and set the timer, maximum score, and passing percentage."
        actions={
          <button
            type="button"
            className="lms-btn lms-btn-primary"
            onClick={() =>
              setEditing({ subjectId: searchParams.get('classId') || '' })
            }
          >
            <Icon name="plus" size={16} />
            Create quiz
          </button>
        }
      />

      <div className="lms-toolbar">
        <label className="lms-filter-input">
          <Icon name="search" size={15} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search quiz or subject code"
            aria-label="Search quizzes"
          />
        </label>
        <span className="lms-chip">
          <Icon name="shield" size={13} />
          Passing rules enforced automatically
        </span>
      </div>

      <div className="lms-quiz-grid">
        {filtered.map((quiz) => (
          <article className="lms-quiz-card" key={quiz.id}>
            <div className="lms-quiz-card-head">
              <span className="lms-quiz-card-icon lms-tone-teal">
                <Icon name="quiz" size={18} />
              </span>
              <Badge
                tone={quiz.status === 'Published' ? 'success' : 'warning'}
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
            <p>{quiz.questions} questions · Due {quiz.due}</p>
            <div className="lms-quiz-details">
              <div>
                <span>Timer</span>
                <strong>{quiz.timeLimit} min</strong>
              </div>
              <div>
                <span>Max score</span>
                <strong>{quiz.maxScore}</strong>
              </div>
              <div>
                <span>Passing</span>
                <strong>{quiz.passing}%</strong>
              </div>
              <div>
                <span>Attempts</span>
                <strong>{quiz.attempts}</strong>
              </div>
            </div>
            <div className="lms-quiz-card-foot">
              <span className="lms-cell-muted">
                {quiz.average === null
                  ? 'No attempts yet'
                  : `${quiz.average}% average`}
              </span>
              <button
                type="button"
                className="lms-btn lms-btn-secondary lms-btn-sm"
                onClick={() => setEditing(quiz)}
              >
                <Icon name="edit" size={13} />
                Edit quiz
              </button>
            </div>
          </article>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon="quiz"
          title="No quizzes found"
          description="Search for another quiz or create a new assessment."
        />
      )}

      {editing && (
        <QuizFormModal
          quiz={editing}
          subjects={subjects}
          onClose={() => setEditing(null)}
          onSave={(quiz) => {
            onSave(quiz)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

const blankQuestion = () => ({
  id: `question-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  prompt: '',
  type: 'multiple_choice',
  options: ['', '', '', ''],
  answer: 0,
})

function QuizFormModal({ quiz, subjects, onClose, onSave }) {
  const notify = useToast()
  const isEditing = Boolean(quiz.id)
  const [form, setForm] = useState({
    title: quiz.title || '',
    subjectId: quiz.subjectId || subjects[0]?.id || '',
    timeLimit: quiz.timeLimit || 15,
    maxScore: quiz.maxScore || 100,
    passing: quiz.passing || 75,
    due: quiz.due || 'Nov 30, 2026',
    status: quiz.status || 'Draft',
  })
  const [questions, setQuestions] = useState(
    quiz.questionList?.length
      ? quiz.questionList.map((question) => {
          const type = question.type || 'multiple_choice'
          return {
            ...question,
            type,
            options: ['short_answer', 'paragraph'].includes(type)
              ? []
              : question.options || ['', '', '', ''],
            answer:
              type === 'checkboxes'
                ? Array.isArray(question.answer)
                  ? question.answer
                  : []
                : question.answer ??
                  (['short_answer', 'paragraph'].includes(type) ? '' : 0),
          }
        })
      : Array.from({ length: 10 }, () => blankQuestion()),
  )

  const update = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }))

  const updateQuestion = (index, patch) =>
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    )

  const updateOption = (questionIndex, optionIndex, value) =>
    setQuestions((current) =>
      current.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              options: question.options.map((option, currentOption) =>
                currentOption === optionIndex ? value : option,
              ),
            }
          : question,
      ),
    )

  const handleSubmit = (event) => {
    event.preventDefault()
    const invalidCheckboxQuestion = questions.find(
      (question) =>
        question.type === 'checkboxes' &&
        (!Array.isArray(question.answer) || question.answer.length === 0),
    )
    if (invalidCheckboxQuestion) {
      notify('Select at least one correct answer for each checkbox question.', 'error')
      return
    }
    const validQuestions = questions.filter((question) => question.prompt.trim())
    const subject = subjects.find(
      (item) => item.id === form.subjectId,
    )

    onSave({
      ...quiz,
      id: quiz.id || `quiz-${Date.now()}`,
      ...form,
      subjectCode: subject?.code || quiz.subjectCode || '',
      questions: validQuestions.length || quiz.questions || questions.length,
      attempts: quiz.attempts || 0,
      average: quiz.average ?? null,
      questionList: validQuestions,
    })
  }

  return (
    <Modal
      title={isEditing ? 'Edit quiz' : 'Create quiz'}
      description="Configure the assessment rules and build the question set students will answer."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="lms-btn lms-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="quiz-form"
            className="lms-btn lms-btn-primary"
          >
            {isEditing ? 'Save quiz' : 'Create quiz'}
          </button>
        </>
      }
    >
      <form id="quiz-form" onSubmit={handleSubmit}>
        <div className="lms-form-grid">
          <Field label="Quiz title" className="lms-field-full">
            <input
              type="text"
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="e.g. Number Systems Quiz"
              required
            />
          </Field>
          <Field label="Subject">
            <select
              value={form.subjectId}
              onChange={(event) => update('subjectId', event.target.value)}
            >
              {subjects.map((subject) => (
                <option value={subject.id} key={subject.id}>
                  {subject.code} · {subject.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <input
              type="text"
              value={form.due}
              onChange={(event) => update('due', event.target.value)}
              placeholder="e.g. Nov 30, 2026"
            />
          </Field>
          <Field label="Timer (minutes)">
            <input
              type="number"
              min="1"
              max="180"
              value={form.timeLimit}
              onChange={(event) => update('timeLimit', event.target.value)}
            />
          </Field>
          <Field label="Maximum score">
            <input
              type="number"
              min="1"
              value={form.maxScore}
              onChange={(event) => update('maxScore', event.target.value)}
            />
          </Field>
          <Field label="Passing percentage">
            <input
              type="number"
              min="1"
              max="100"
              value={form.passing}
              onChange={(event) => update('passing', event.target.value)}
            />
          </Field>
          <Field label="Visibility">
            <select
              value={form.status}
              onChange={(event) => update('status', event.target.value)}
            >
              <option>Draft</option>
              <option>Published</option>
            </select>
          </Field>
        </div>

        <div className="lms-section-head" style={{ marginTop: 20 }}>
          <div>
            <h2>Questions</h2>
            <p>Add questions and mark the correct answer for automatic scoring.</p>
          </div>
          <button
            type="button"
            className="lms-btn lms-btn-secondary lms-btn-sm"
            onClick={() => setQuestions((current) => [...current, blankQuestion()])}
          >
            <Icon name="plus" size={13} />
            Add question
          </button>
        </div>

        {questions.map((question, questionIndex) => (
          <div className="lms-card lms-card-pad" key={question.id} style={{ marginBottom: 12 }}>
            <div className="lms-section-head">
              <div>
                <h2>Question {questionIndex + 1}</h2>
                <p>Choose the question type and configure the expected answer.</p>
              </div>
              {questions.length > 1 && (
                <button
                  type="button"
                  className="lms-icon-btn"
                  onClick={() =>
                    setQuestions((current) =>
                      current.filter((item) => item.id !== question.id),
                    )
                  }
                  aria-label="Remove question"
                >
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
            <Field label="Question prompt" className="lms-field-full">
              <input
                type="text"
                value={question.prompt}
                onChange={(event) =>
                  updateQuestion(questionIndex, { prompt: event.target.value })
                }
                placeholder="Write the question"
                required
              />
            </Field>
            <Field label="Question type" className="lms-field-full">
              <select
                value={question.type}
                onChange={(event) => {
                  const type = event.target.value
                  updateQuestion(questionIndex, {
                    type,
                    options: type === 'short_answer'
                      || type === 'paragraph'
                      ? []
                      : question.options.length
                        ? question.options
                        : ['', '', '', ''],
                    answer: type === 'short_answer' || type === 'paragraph'
                      ? ''
                      : type === 'checkboxes'
                        ? []
                        : 0,
                  })
                }}
              >
                <option value="multiple_choice">Multiple choice</option>
                <option value="dropdown">Dropdown</option>
                <option value="checkboxes">Checkboxes (select all that apply)</option>
                <option value="short_answer">Short answer</option>
                <option value="paragraph">Paragraph</option>
              </select>
            </Field>
            {question.type !== 'short_answer' && question.type !== 'paragraph' && (
              <div className="lms-form-grid" style={{ marginTop: 12 }}>
                {question.options.map((option, optionIndex) => (
                <Field
                  key={`${question.id}-${optionIndex}`}
                  label={`Option ${String.fromCharCode(65 + optionIndex)}`}
                >
                  <input
                    type="text"
                    value={option}
                    onChange={(event) =>
                      updateOption(questionIndex, optionIndex, event.target.value)
                    }
                    placeholder={`Answer choice ${String.fromCharCode(65 + optionIndex)}`}
                    required
                  />
                </Field>
              ))}
              </div>
            )}
            {question.type === 'checkboxes' ? (
              <Field
                label="Correct answers"
                hint="Select every option students must choose."
                className="lms-field-full"
              >
                <div className="lms-form-grid">
                  {question.options.map((option, optionIndex) => (
                    <label key={`${question.id}-correct-${optionIndex}`}>
                      <input
                        type="checkbox"
                        checked={question.answer.includes(optionIndex)}
                        onChange={(event) => {
                          const currentAnswers = question.answer
                          const answer = event.target.checked
                            ? [...currentAnswers, optionIndex]
                            : currentAnswers.filter((value) => value !== optionIndex)
                          updateQuestion(questionIndex, { answer })
                        }}
                      />
                      {option || `Option ${String.fromCharCode(65 + optionIndex)}`}
                    </label>
                  ))}
                </div>
              </Field>
            ) : question.type === 'short_answer' || question.type === 'paragraph' ? (
              <Field
                label="Expected answer"
                hint="Answers are automatically checked without regard to letter case."
                className="lms-field-full"
              >
                <input
                  type="text"
                  value={question.answer}
                  onChange={(event) =>
                    updateQuestion(questionIndex, { answer: event.target.value })
                  }
                  required
                />
              </Field>
            ) : (
              <Field label="Correct answer" className="lms-field-full" style={{ marginTop: 12 }}>
                <select
                  value={question.answer}
                  onChange={(event) =>
                    updateQuestion(questionIndex, {
                      answer: Number(event.target.value),
                    })
                  }
                >
                  {question.options.map((option, optionIndex) => (
                    <option key={`${question.id}-answer-${optionIndex}`} value={optionIndex}>
                      Option {String.fromCharCode(65 + optionIndex)}
                      {option ? ` — ${option}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        ))}
      </form>
    </Modal>
  )
}

function StudentPerformance({ students, subjects }) {
  const notify = useToast()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [subjectFilter, setSubjectFilter] = useState('All')

  const filtered = students.filter((student) => {
    const matchesSearch = `${student.name} ${student.username}`
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchesSubject =
      subjectFilter === 'All' || student.subjectCodes.includes(subjectFilter)
    return matchesSearch && matchesSubject
  })

  return (
    <>
      <PageHeader
        eyebrow="Student performance"
        title="Enrolled students"
        description="View students enrolled in your classes. Student records from other faculty classes are not available here."
        actions={
          <button
            type="button"
            className="lms-btn lms-btn-secondary"
            onClick={() => notify('Performance list is ready to export.')}
          >
            <Icon name="download" size={16} />
            Export list
          </button>
        }
      />

      <div className="lms-result-summary">
        <div className="lms-summary-tile">
          <span>Students enrolled</span>
          <strong>{students.length}</strong>
        </div>
        <div className="lms-summary-tile">
          <span>Your classes</span>
          <strong>{subjects.length}</strong>
        </div>
        <div className="lms-summary-tile">
          <span>Classes with enrollment</span>
          <strong>{subjects.filter((subject) => subject.students > 0).length}</strong>
        </div>
        <div className="lms-summary-tile">
          <span>Performance records</span>
          <strong>Not available</strong>
        </div>
      </div>

      <div className="lms-toolbar">
        <label className="lms-filter-input">
          <Icon name="search" size={15} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search student name or username"
            aria-label="Search students"
          />
        </label>
        <select
          className="lms-select"
          value={subjectFilter}
          onChange={(event) => setSubjectFilter(event.target.value)}
          aria-label="Filter by subject"
        >
          <option value="All">All subjects</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.subjectCode}>
              {subject.subjectCode}
            </option>
          ))}
        </select>
      </div>

      <div className="lms-table-wrap">
        <table className="lms-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Enrolled in</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student) => (
              <tr key={student.id}>
                <td>
                  <div className="lms-table-user">
                    <Avatar name={student.name} />
                    <div>
                      <strong>{student.name}</strong>
                      <span>@{student.username}</span>
                    </div>
                  </div>
                </td>
                <td>
                  {student.classNames.join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon="users"
          title="No enrolled students found"
          description="Students appear here after joining one of your classes."
        />
      )}
    </>
  )
}

const csvEscape = (value) => `"${String(value).replaceAll('"', '""')}"`

function FacultyReports({ subjects }) {
  const notify = useToast()
  const [searchParams] = useSearchParams()
  const [sortBy, setSortBy] = useState('surname')
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [search, setSearch] = useState(() => searchParams.get('q') || '')

  const rows = []

  const average = Math.round(
    rows.reduce((total, report) => total + report.score, 0) /
      Math.max(rows.length, 1),
  )
  const passed = rows.filter((report) => report.status === 'Passed').length

  const exportCsv = () => {
    const header = [
      'Surname',
      'Student',
      'Subject',
      'Score',
      'Passing',
      'Attempts',
      'Status',
    ]
    const body = rows.map((report) => [
      report.surname,
      report.name,
      report.subjectCode,
      report.score,
      report.passing,
      report.attempts,
      report.status,
    ])
    const csv = [header, ...body]
      .map((line) => line.map(csvEscape).join(','))
      .join('\r\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'learnspace-score-report.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    notify('Score report exported as a CSV spreadsheet.')
  }

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Score reports"
        description="Sort scores by surname or score, then print or export a clean report for your records."
        actions={
          <>
            <button
              type="button"
              className="lms-btn lms-btn-secondary"
              onClick={() => window.print()}
            >
              <Icon name="print" size={16} />
              Print
            </button>
            <button
              type="button"
              className="lms-btn lms-btn-primary"
              onClick={exportCsv}
            >
              <Icon name="fileSpreadsheet" size={16} />
              Export CSV
            </button>
          </>
        }
      />

      <div className="lms-result-summary">
        <div className="lms-summary-tile">
          <span>Report rows</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="lms-summary-tile">
          <span>Average score</span>
          <strong>{average}%</strong>
        </div>
        <div className="lms-summary-tile">
          <span>Passed</span>
          <strong>{passed}</strong>
        </div>
        <div className="lms-summary-tile">
          <span>Failed</span>
          <strong>{rows.length - passed}</strong>
        </div>
      </div>

      <div className="lms-report-toolbar">
        <label className="lms-filter-input">
          <Icon name="search" size={15} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search student or subject"
            aria-label="Search report rows"
          />
        </label>
        <select
          className="lms-select"
          value={subjectFilter}
          onChange={(event) => setSubjectFilter(event.target.value)}
          aria-label="Filter report by subject"
        >
          <option value="All">All subjects</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.subjectCode}>
              {subject.subjectCode}
            </option>
          ))}
        </select>
        <div className="lms-segmented" role="tablist" aria-label="Sort report">
          <button
            type="button"
            className={sortBy === 'surname' ? 'is-active' : ''}
            onClick={() => setSortBy('surname')}
          >
            Sort by surname
          </button>
          <button
            type="button"
            className={sortBy === 'score' ? 'is-active' : ''}
            onClick={() => setSortBy('score')}
          >
            Sort by score
          </button>
          <button
            type="button"
            className={sortBy === 'subject' ? 'is-active' : ''}
            onClick={() => setSortBy('subject')}
          >
            By subject
          </button>
        </div>
      </div>

      <section className="lms-card lms-report-page">
        <div className="lms-report-title">
          <h2>LearnSpace · Quiz Score Report</h2>
          <p>
            Generated {new Date().toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}{' '}
            · Faculty: LearnSpace
          </p>
        </div>
        <div className="lms-report-meta">
          <span>
            Subject filter: <strong>{subjectFilter}</strong>
          </span>
          <span>
            Sorted by: <strong>{sortBy}</strong>
          </span>
          <span>
            Rows: <strong>{rows.length}</strong>
          </span>
          <span>
            Average: <strong>{average}%</strong>
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="lms-table">
            <thead>
              <tr>
                <th>Surname</th>
                <th>Student</th>
                <th>Subject</th>
                <th>Score</th>
                <th>Passing</th>
                <th>Attempts</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((report) => (
                <tr key={report.id}>
                  <td className="lms-cell-strong">{report.surname}</td>
                  <td>{report.name}</td>
                  <td className="lms-cell-muted">{report.subjectCode}</td>
                  <td>
                    <span className="lms-score">
                      {report.score}%
                      <span className="lms-score-bar">
                        <span
                          style={{
                            width: `${report.score}%`,
                            background:
                              report.status === 'Passed'
                                ? '#16825f'
                                : '#c24141',
                          }}
                        />
                      </span>
                    </span>
                  </td>
                  <td className="lms-cell-muted">{report.passing}%</td>
                  <td className="lms-cell-muted">{report.attempts}</td>
                  <td>
                    <Badge
                      tone={report.status === 'Passed' ? 'success' : 'danger'}
                      dot
                    >
                      {report.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="lms-completion-note" style={{ marginTop: 14 }}>
        <Icon name="fileText" size={15} />
        <span>
          Use <strong>Print</strong> to save as PDF from your browser, or{' '}
          <strong>Export CSV</strong> to open the report in a spreadsheet.
        </span>
      </div>
    </>
  )
}

export default FacultyDashboard
