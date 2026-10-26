import { useMemo, useState } from 'react'
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
import {
  facultyLessons,
  facultyReports,
  facultyStudents,
  facultySubjects,
} from '../data/sampleData.js'
import { useLearningData } from '../hooks/useLearningData.js'
import PresentationEditor from '../presentation/PresentationEditor.jsx'
import PresentationLibrary from '../presentation/PresentationLibrary.jsx'
import PresentationViewer from '../presentation/PresentationViewer.jsx'
import { ensurePresentationForLesson } from '../presentation/presentationStore.js'

function FacultyDashboard({ user, onLogout }) {
  return (
    <ToastProvider>
      <FacultyWorkspace user={user} onLogout={onLogout} />
    </ToastProvider>
  )
}

function FacultyWorkspace({ user, onLogout }) {
  const notify = useToast()
  const {
    classes: subjects,
    quizzes,
    createClass,
    updateClass,
    deleteClass,
    createQuiz,
    updateQuiz,
  } = useLearningData()
  const [lessons, setLessons] = useState(facultyLessons)

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

  const saveLesson = (lesson) => {
    setLessons((current) => {
      const exists = current.some((item) => item.id === lesson.id)
      return exists
        ? current.map((item) => (item.id === lesson.id ? lesson : item))
        : [lesson, ...current]
    })
    notify(
      lessons.some((item) => item.id === lesson.id)
        ? 'Lesson updated successfully.'
        : 'Lesson created successfully.',
    )
  }

  const toggleLessonStatus = (id) => {
    setLessons((current) =>
      current.map((lesson) =>
        lesson.id === id
          ? {
              ...lesson,
              status: lesson.status === 'Published' ? 'Draft' : 'Published',
              updated: 'Just now',
            }
          : lesson,
      ),
    )
    notify('Lesson visibility updated.')
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
    <DashboardLayout role="Faculty" user={user} onLogout={onLogout}>
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
            />
          }
        />
        <Route
          path="subjects"
          element={
            <SubjectManagement
              subjects={subjects}
              onSave={saveSubject}
              onDelete={deleteSubject}
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
            />
          }
        />
        <Route
          path="presentations"
          element={<PresentationLibrary role="faculty" subjects={subjects} />}
        />
        <Route
          path="presentations/:presentationId/edit"
          element={<PresentationEditor />}
        />
        <Route
          path="presentations/:presentationId/present"
          element={<PresentationViewer role="Faculty" />}
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
        <Route path="performance" element={<StudentPerformance />} />
        <Route path="reports" element={<FacultyReports />} />
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

function FacultyOverview({ subjects, lessons, quizzes }) {
  const navigate = useNavigate()
  const students = subjects.reduce((total, subject) => total + subject.students, 0)
  const submissions = quizzes.reduce((total, quiz) => total + quiz.attempts, 0)
  const publishedLessons = lessons.filter(
    (lesson) => lesson.status === 'Published',
  ).length
  const passedReports = facultyReports.filter(
    (report) => report.status === 'Passed',
  ).length
  const passRate = Math.round((passedReports / facultyReports.length) * 100)
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

  const recentSubmissions = facultyStudents.slice(0, 4).map((student) => {
    const quiz =
      quizzes.find(
        (item) => item.subjectCode === student.subjectCode && item.attempts > 0,
      ) || quizzes.find((item) => item.subjectCode === student.subjectCode)

    return { ...student, test: quiz?.title || 'Subject quiz' }
  })

  const enrollmentTimes = [
    '2 hours ago',
    'Yesterday',
    '2 days ago',
    '3 days ago',
  ]

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
            value: students,
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
              {passedReports} of {facultyReports.length} learners above passing
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

          <div className="lms-faculty-class-list">
            {subjects.slice(0, 4).map((subject) => (
              <Link
                to="/faculty/subjects"
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

          <div className="lms-faculty-enrollment-list">
            {facultyStudents.slice(0, 4).map((student, index) => (
              <div className="lms-faculty-enrollment" key={student.id}>
                <Avatar name={student.name} size="sm" />
                <div className="lms-faculty-enrollment-copy">
                  <strong>{student.name}</strong>
                  <span>Enrolled in {student.subjectCode}</span>
                </div>
                <time>{enrollmentTimes[index]}</time>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function SubjectManagement({ subjects, onSave, onDelete }) {
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(() =>
    searchParams.get('create') === '1' ? {} : null,
  )

  const filtered = subjects.filter((subject) =>
    `${subject.code} ${subject.name} ${subject.subject} ${subject.term} ${subject.academicYear}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  return (
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
            placeholder="Search class, subject, code, term, or academic year"
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
                      <span>{subject.subject || subject.term}</span>
                    </div>
                  </div>
                </td>
                <td className="lms-cell-muted">{subject.term}</td>
                <td className="lms-cell-muted">{subject.academicYear}</td>
                <td className="lms-cell-strong">{subject.students}</td>
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
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      type="button"
                      className="lms-icon-btn"
                      onClick={() => onDelete(subject.id)}
                      aria-label={`Delete ${subject.code}`}
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

function LessonManagement({ lessons, subjects, onSave, onToggleStatus }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [editing, setEditing] = useState(null)

  const filtered = lessons.filter((lesson) => {
    const matchesSearch = `${lesson.title} ${lesson.subjectCode}`
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchesSubject =
      subjectFilter === 'All' || lesson.subjectId === subjectFilter
    return matchesSearch && matchesSubject
  })

  const openSlideStudio = (lesson) => {
    const presentation = ensurePresentationForLesson(lesson)
    navigate(`/faculty/presentations/${presentation.id}/edit`)
  }

  return (
    <>
      <PageHeader
        eyebrow="Lesson management"
        title="Lessons & presentations"
        description="Create lesson text, upload presentation files, write summaries, and control what students can access."
        actions={
          <button
            type="button"
            className="lms-btn lms-btn-primary"
            onClick={() => setEditing({})}
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
                  {lesson.presentation || 'No file uploaded'}
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
          onSave={(lesson) => {
            onSave(lesson)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function LessonFormModal({ lesson, subjects, onClose, onSave }) {
  const isEditing = Boolean(lesson.id)
  const [form, setForm] = useState({
    title: lesson.title || '',
    subjectId: lesson.subjectId || subjects[0]?.id || '',
    summary: lesson.summary || '',
    content: lesson.content || '',
    presentation: lesson.presentation || '',
    status: lesson.status || 'Draft',
  })

  const update = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }))

  const selectedSubject = subjects.find(
    (subject) => subject.id === form.subjectId,
  )

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({
      ...lesson,
      id: lesson.id || `lesson-${Date.now()}`,
      ...form,
      subjectCode: selectedSubject?.code || lesson.subjectCode || '',
      type: form.presentation ? 'Presentation + text' : 'Text + summary',
      updated: 'Just now',
    })
  }

  return (
    <Modal
      title={isEditing ? 'Edit lesson' : 'Create lesson'}
      description="Add lesson text, an optional presentation, and a short summary for students."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="lms-btn lms-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="lesson-form"
            className="lms-btn lms-btn-primary"
          >
            {isEditing ? 'Save lesson' : 'Publish lesson'}
          </button>
        </>
      }
    >
      <form id="lesson-form" className="lms-form-grid" onSubmit={handleSubmit}>
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
            required
          />
        </Field>
        <Field
          label="Presentation file"
          hint="Upload a PPTX, PDF, or slide deck. Demo mode stores the file name only."
          className="lms-field-full"
        >
          <input
            type="file"
            accept=".ppt,.pptx,.pdf,.key"
            onChange={(event) =>
              update('presentation', event.target.files?.[0]?.name || '')
            }
          />
        </Field>
        {form.presentation && (
          <div className="lms-completion-note lms-field-full">
            <Icon name="checkCircle" size={15} />
            <span>Selected presentation: {form.presentation}</span>
          </div>
        )}
      </form>
    </Modal>
  )
}

function QuizManagement({ quizzes, subjects, onSave }) {
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(() =>
    searchParams.get('create') === '1' ? {} : null,
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
            onClick={() => setEditing({})}
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
  options: ['', '', '', ''],
  answer: 0,
})

function QuizFormModal({ quiz, subjects, onClose, onSave }) {
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
      ? quiz.questionList
      : [blankQuestion()],
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
    const validQuestions = questions.filter(
      (question) => question.prompt.trim(),
    )
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
                <p>Choose the correct option below.</p>
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
              />
            </Field>
            <div className="lms-form-grid" style={{ marginTop: 12 }}>
              {question.options.map((option, optionIndex) => (
                <Field
                  key={`${question.id}-${optionIndex}`}
                  label={`Option ${String.fromCharCode(65 + optionIndex)}${question.answer === optionIndex ? ' (correct)' : ''}`}
                >
                  <input
                    type="text"
                    value={option}
                    onChange={(event) =>
                      updateOption(questionIndex, optionIndex, event.target.value)
                    }
                    placeholder={`Answer choice ${String.fromCharCode(65 + optionIndex)}`}
                  />
                </Field>
              ))}
            </div>
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
          </div>
        ))}
      </form>
    </Modal>
  )
}

function StudentPerformance() {
  const notify = useToast()
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('All')

  const filtered = facultyStudents.filter((student) => {
    const matchesSearch = `${student.name} ${student.username}`
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchesSubject =
      subjectFilter === 'All' || student.subjectCode === subjectFilter
    return matchesSearch && matchesSubject
  })
  const atRisk = facultyStudents.filter(
    (student) => student.status === 'At risk' || student.status === 'Needs support',
  ).length
  const average = Math.round(
    facultyStudents.reduce((total, student) => total + student.average, 0) /
      facultyStudents.length,
  )

  return (
    <>
      <PageHeader
        eyebrow="Student performance"
        title="Scores & quiz attempts"
        description="Review individual student performance, quiz attempts, passing status, and recent activity."
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
          <span>Students tracked</span>
          <strong>{facultyStudents.length}</strong>
        </div>
        <div className="lms-summary-tile">
          <span>Class average</span>
          <strong>{average}%</strong>
        </div>
        <div className="lms-summary-tile">
          <span>Needs support</span>
          <strong>{atRisk}</strong>
        </div>
        <div className="lms-summary-tile">
          <span>Pass rate</span>
          <strong>
            {Math.round(
              (facultyStudents.filter(
                (student) => student.average >= 75,
              ).length /
                facultyStudents.length) *
                100,
            )}
            %
          </strong>
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
          />
        </label>
        <select
          className="lms-select"
          value={subjectFilter}
          onChange={(event) => setSubjectFilter(event.target.value)}
          aria-label="Filter by subject"
        >
          <option value="All">All subjects</option>
          {facultySubjects.map((subject) => (
            <option key={subject.id} value={subject.code}>
              {subject.code}
            </option>
          ))}
        </select>
      </div>

      <div className="lms-table-wrap">
        <table className="lms-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Subject</th>
              <th>Attempts</th>
              <th>Average</th>
              <th>Passed</th>
              <th>Last active</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student, index) => (
              <tr key={student.id}>
                <td>
                  <div className="lms-table-user">
                    <Avatar
                      name={student.name}
                      tone={['blue', 'violet', 'teal', 'amber'][index % 4]}
                    />
                    <div>
                      <strong>{student.name}</strong>
                      <span>@{student.username}</span>
                    </div>
                  </div>
                </td>
                <td className="lms-cell-muted">{student.subjectCode}</td>
                <td className="lms-cell-strong">{student.attempts}</td>
                <td>
                  <span className="lms-score">
                    {student.average}%
                    <span className="lms-score-bar">
                      <span
                        style={{
                          width: `${student.average}%`,
                          background:
                            student.average >= 80
                              ? '#16825f'
                              : student.average >= 70
                                ? '#d18a2e'
                                : '#c24141',
                        }}
                      />
                    </span>
                  </span>
                </td>
                <td className="lms-cell-muted">
                  {student.passed}/{student.attempts}
                </td>
                <td className="lms-cell-muted">{student.lastActive}</td>
                <td>
                  <Badge
                    tone={
                      student.status === 'Excellent'
                        ? 'violet'
                        : student.status === 'On track'
                          ? 'success'
                          : student.status === 'Needs support'
                            ? 'warning'
                            : 'danger'
                    }
                    dot
                  >
                    {student.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon="users"
          title="No students found"
          description="Try a different name or subject filter."
        />
      )}
    </>
  )
}

const csvEscape = (value) => `"${String(value).replaceAll('"', '""')}"`

function FacultyReports() {
  const notify = useToast()
  const [sortBy, setSortBy] = useState('surname')
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const filtered = facultyReports.filter((report) => {
      const matchesSubject =
        subjectFilter === 'All' || report.subjectCode === subjectFilter
      const matchesSearch = `${report.name} ${report.subjectCode}`
        .toLowerCase()
        .includes(search.toLowerCase())
      return matchesSubject && matchesSearch
    })

    return [...filtered].sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score
      if (sortBy === 'subject') {
        return a.subjectCode.localeCompare(b.subjectCode)
      }
      return a.surname.localeCompare(b.surname)
    })
  }, [sortBy, subjectFilter, search])

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
          />
        </label>
        <select
          className="lms-select"
          value={subjectFilter}
          onChange={(event) => setSubjectFilter(event.target.value)}
          aria-label="Filter report by subject"
        >
          <option value="All">All subjects</option>
          {facultySubjects.map((subject) => (
            <option key={subject.id} value={subject.code}>
              {subject.code}
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
