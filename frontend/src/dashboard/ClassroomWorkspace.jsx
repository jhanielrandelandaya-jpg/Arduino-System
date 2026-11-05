import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Avatar,
  Badge,
  EmptyState,
  Field,
  Modal,
} from '../components/DashboardUI.jsx'
import Icon from '../components/Icon.jsx'
import { useToast } from '../context/toast.js'
import StudentAttachmentPreview from './StudentAttachmentPreview.jsx'
import './ClassroomWorkspace.css'

const tabs = ['Stream', 'Classwork', 'People']

const formatDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date not available'
    : date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
}

const toDueDate = (value) => {
  if (!value) return null
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59` : value)
  return Number.isNaN(date.getTime()) ? null : date
}

export default function ClassroomWorkspace({
  learningClass,
  role,
  slides,
  quizzes,
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  addAnnouncementComment,
  classwork = [],
  getClasswork,
  createClasswork,
  deleteClasswork,
  uploadClassworkAttachment,
  downloadClassworkAttachment,
  onPreviewAttachment,
  getClassworkSubmissions,
  gradeClassworkSubmission,
  submitClasswork,
  downloadSubmissionFile,
  getPeople,
  getStudents,
  onViewScores,
  onDownloadFile,
  onPreviewFile,
  onClose,
  studentQuizContent,
}) {
  const notify = useToast()
  const [activeTab, setActiveTab] = useState(() =>
    window.location.hash === '#class-quizzes' ? 'Classwork' : 'Stream',
  )
  const [announcementsResult, setAnnouncementsResult] = useState(null)
  const [message, setMessage] = useState('')
  const [posting, setPosting] = useState(false)
  const [peopleResult, setPeopleResult] = useState(null)
  const [classworkResult, setClassworkResult] = useState(null)
  const [classworkLoading, setClassworkLoading] = useState(false)
  const [classworkError, setClassworkError] = useState('')
  const [creatingClasswork, setCreatingClasswork] = useState(false)
  const [reviewingClasswork, setReviewingClasswork] = useState('')
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [attachmentPreview, setAttachmentPreview] = useState(null)
  const [previewingFileId, setPreviewingFileId] = useState('')

  useEffect(
    () => () => {
      if (attachmentPreview?.url) URL.revokeObjectURL(attachmentPreview.url)
    },
    [attachmentPreview],
  )

  useEffect(() => {
    if (activeTab === 'Classwork' && window.location.hash === '#class-quizzes') {
      document.getElementById('class-quizzes')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [activeTab])

  useEffect(() => {
    let active = true
    getAnnouncements(learningClass.id)
      .then((items) => {
        if (active) {
          setAnnouncementsResult({
            classId: learningClass.id,
            items,
            error: '',
          })
        }
      })
      .catch((error) => {
        if (active) {
          setAnnouncementsResult({
            classId: learningClass.id,
            items: [],
            error: error.message,
          })
        }
      })
    return () => {
      active = false
    }
  }, [getAnnouncements, learningClass.id])

  useEffect(() => {
    if (activeTab !== 'People') return
    let active = true
    const request = getPeople
      ? getPeople(learningClass.id)
      : role === 'Faculty' && getStudents
        ? getStudents(learningClass.id).then((students) => ({ students }))
        : Promise.resolve({ teacher: null, students: [] })
    request
      .then((result) => {
        if (active) {
          setPeopleResult({
            classId: learningClass.id,
            teacher: result.teacher || null,
            students: result.students || [],
            error: '',
          })
        }
      })
      .catch((error) => {
        if (active) {
          setPeopleResult({
            classId: learningClass.id,
            teacher: null,
            students: [],
            error: error.message,
          })
        }
      })
    return () => {
      active = false
    }
  }, [activeTab, getPeople, getStudents, learningClass.id, role])

  useEffect(() => {
    if (activeTab !== 'Classwork' || !getClasswork) return
    let active = true
    setClassworkLoading(true)
    setClassworkError('')
    getClasswork(learningClass.id)
      .then((items) => {
        if (active) setClassworkResult({ classId: learningClass.id, items })
      })
      .catch((error) => {
        if (active) setClassworkError(error.message)
      })
      .finally(() => {
        if (active) setClassworkLoading(false)
      })
    return () => {
      active = false
    }
  }, [activeTab, getClasswork, learningClass.id])

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60000)
    return () => window.clearInterval(interval)
  }, [])

  const announcementState =
    announcementsResult?.classId === learningClass.id ? announcementsResult : null
  const announcements = announcementState?.items || []
  const peopleState =
    peopleResult?.classId === learningClass.id ? peopleResult : null
  const people = peopleState?.students || []
  const classworkItems =
    classworkResult?.classId === learningClass.id
      ? classworkResult.items
      : classwork
  const visibleSlides =
    role === 'Student'
      ? slides.filter((slide) => slide.status === 'Published')
      : slides

  const upcoming = useMemo(() => {
    const quizDates = quizzes.map((quiz) => ({
      id: `quiz-${quiz.id}`,
      title: quiz.title,
      dueAt: toDueDate(quiz.dueDate || quiz.due),
    }))
    const assignmentDates = classworkItems.map((item) => ({
      id: item.id,
      title: item.title,
      dueAt: toDueDate(item.dueAt),
    }))
    return [...quizDates, ...assignmentDates]
      .filter((item) => item.dueAt && item.dueAt.getTime() >= currentTime)
      .sort((first, second) => first.dueAt - second.dueAt)
      .slice(0, 5)
  }, [classworkItems, currentTime, quizzes])

  const reloadClasswork = async () => {
    if (!getClasswork) return
    setClassworkLoading(true)
    setClassworkError('')
    try {
      const items = await getClasswork(learningClass.id)
      setClassworkResult({ classId: learningClass.id, items })
    } catch (error) {
      setClassworkError(error.message)
      throw error
    } finally {
      setClassworkLoading(false)
    }
  }

  const postAnnouncement = async (event) => {
    event.preventDefault()
    setPosting(true)
    try {
      const { announcement } = await createAnnouncement(learningClass.id, message)
      setAnnouncementsResult((current) => ({
        classId: learningClass.id,
        items: [
          announcement,
          ...(current?.classId === learningClass.id ? current.items : []),
        ],
        error: '',
      }))
      setMessage('')
      notify('Announcement posted to this class.')
    } catch (error) {
      setAnnouncementsResult((current) => ({
        classId: learningClass.id,
        items: current?.classId === learningClass.id ? current.items : [],
        error: error.message,
      }))
    } finally {
      setPosting(false)
    }
  }

  const removeAnnouncement = async (announcement) => {
    try {
      await deleteAnnouncement(learningClass.id, announcement.id)
      setAnnouncementsResult((current) => ({
        classId: learningClass.id,
        items: current.items.filter((item) => item.id !== announcement.id),
        error: '',
      }))
      notify('Announcement deleted.')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const addComment = async (announcementId, text) => {
    const comment = await addAnnouncementComment(
      learningClass.id,
      announcementId,
      text,
    )
    setAnnouncementsResult((current) => ({
      classId: learningClass.id,
      items: current.items.map((item) =>
        item.id === announcementId
          ? { ...item, comments: [...(item.comments || []), comment] }
          : item,
      ),
      error: '',
    }))
  }

  const saveClasswork = async (payload, file) => {
    let created = false
    let attachmentUploaded = false
    try {
      const result = await createClasswork(learningClass.id, payload)
      created = true
      if (file) {
        await uploadClassworkAttachment(result.classwork.id, file)
        attachmentUploaded = true
      }
      await reloadClasswork()
      setCreatingClasswork(false)
      notify(file ? 'Classwork and attachment created.' : 'Classwork created.')
    } catch (error) {
      if (!created) {
        notify(error.message, 'error')
        return
      }
      setCreatingClasswork(false)
      try {
        await reloadClasswork()
      } catch {
        setClassworkError('Classwork was created, but the list could not be refreshed.')
      }
      notify(
        file && !attachmentUploaded
          ? `Classwork was created, but the attachment could not be uploaded: ${error.message}`
          : `Classwork was created, but the list could not be refreshed: ${error.message}`,
        'error',
      )
    }
  }

  const removeClasswork = async (item) => {
    if (!window.confirm(`Delete "${item.title}" and its submissions?`)) return
    try {
      await deleteClasswork(item.id)
      setClassworkResult((current) => ({
        classId: learningClass.id,
        items: (current?.classId === learningClass.id ? current.items : classworkItems)
          .filter((entry) => entry.id !== item.id),
      }))
      notify('Classwork deleted.')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const submitWork = async (item, submission) => {
    try {
      await submitClasswork(item.id, submission)
      await reloadClasswork()
      notify('Assignment turned in.')
    } catch (error) {
      notify(error.message, 'error')
      throw error
    }
  }

  const downloadLessonFile = async (slideId, preview = false) => {
    try {
      const result = await (preview
        ? onPreviewFile(slideId)
        : onDownloadFile(slideId))
      if (preview && result?.url) {
        setAttachmentPreview(result)
      }
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const openAttachmentPreview = async (item, attachment) => {
    if (!onPreviewAttachment) return
    setPreviewingFileId(attachment.fileId)
    try {
      const preview = await onPreviewAttachment(item.id, attachment)
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
    <div className="lms-classroom">
      <button type="button" className="lms-link lms-classroom-back" onClick={onClose}>
        ← Back to classes
      </button>
      <header className="lms-classroom-banner">
        <div>
          <span>{learningClass.subjectCode}</span>
          <h1>{learningClass.className}</h1>
          <p>
            {learningClass.subject}
            {learningClass.term ? ` · ${learningClass.term}` : ''}
            {role === 'Student' && learningClass.teacherName
              ? ` · ${learningClass.teacherName}`
              : ''}
          </p>
        </div>
        <div className="lms-classroom-banner-meta">
          {learningClass.academicYear && <span>{learningClass.academicYear}</span>}
          {learningClass.joinCode && role === 'Faculty' && (
            <span>Class code: {learningClass.joinCode}</span>
          )}
        </div>
      </header>

      <nav className="lms-classroom-tabs" role="tablist" aria-label="Class sections">
        {tabs.map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'is-active' : ''}
            key={tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="lms-classroom-layout">
        <main className="lms-classroom-main">
          {activeTab === 'Stream' && (
            <section className="lms-classroom-panel">
              <h2>Class stream</h2>
              {role === 'Faculty' && (
                <form className="lms-classroom-announcement-form" onSubmit={postAnnouncement}>
                  <label htmlFor="class-announcement">Share an announcement</label>
                  <textarea
                    id="class-announcement"
                    rows="3"
                    maxLength="5000"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Share an update with students in this class..."
                    required
                  />
                  <button
                    type="submit"
                    className="lms-btn lms-btn-primary"
                    disabled={posting || !message.trim()}
                  >
                    {posting ? 'Posting...' : 'Post announcement'}
                  </button>
                </form>
              )}
              {announcementState?.error && (
                <p className="lms-classroom-error" role="alert">
                  {announcementState.error}
                </p>
              )}
              {!announcementState ? (
                <p className="lms-cell-muted" role="status">Loading class announcements...</p>
              ) : announcements.length === 0 && !announcementState.error ? (
                <EmptyState
                  icon="message"
                  title="No announcements yet"
                  description="Updates shared with this class will appear here."
                />
              ) : (
                <div className="lms-classroom-announcements">
                  {announcements.map((announcement) => (
                    <AnnouncementStreamItem
                      key={announcement.id}
                      announcement={announcement}
                      role={role}
                      onDelete={() => removeAnnouncement(announcement)}
                      onAddComment={(comment) => addComment(announcement.id, comment)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'Classwork' && (
            <section className="lms-classroom-panel">
              <div className="lms-classroom-panel-heading">
                <div>
                  <h2>Classwork</h2>
                  <p>Assignments, materials, lessons, and teacher-provided quizzes.</p>
                </div>
                {role === 'Faculty' && (
                  <div className="lms-classroom-actions">
                    <button
                      type="button"
                      className="lms-btn lms-btn-primary lms-btn-sm"
                      onClick={() => setCreatingClasswork(true)}
                    >
                      <Icon name="plus" size={14} />
                      Create classwork
                    </button>
                    <Link
                      className="lms-btn lms-btn-secondary lms-btn-sm"
                      to={`/faculty/lessons?create=1&classId=${encodeURIComponent(learningClass.id)}`}
                    >
                      Add lesson
                    </Link>
                    <Link
                      className="lms-btn lms-btn-secondary lms-btn-sm"
                      to={`/faculty/quizzes?create=1&classId=${encodeURIComponent(learningClass.id)}`}
                    >
                      Create quiz
                    </Link>
                  </div>
                )}
              </div>

              {classworkError && (
                <div className="lms-classroom-error" role="alert">
                  {classworkError}{' '}
                  <button
                    type="button"
                    className="lms-link"
                    onClick={() => reloadClasswork().catch(() => {})}
                  >
                    Retry
                  </button>
                </div>
              )}
              {classworkLoading ? (
                <p className="lms-cell-muted" role="status">Loading classwork...</p>
              ) : classworkItems.length === 0 ? (
                <EmptyState
                  icon="fileText"
                  title="No work assigned yet"
                  description={
                    role === 'Faculty'
                      ? 'Create an assignment, quiz, or material for this class.'
                      : 'Your teacher’s assignments, quizzes, and materials will appear here.'
                  }
                />
              ) : (
                <div className="lms-classroom-work-list">
                  {classworkItems.map((item) => (
                    <ClassworkItem
                      key={item.id}
                      item={item}
                      role={role}
                      quizzes={quizzes}
                      reviewing={reviewingClasswork === item.id}
                      onDelete={() => removeClasswork(item)}
                      onReview={() =>
                        setReviewingClasswork((current) =>
                          current === item.id ? '' : item.id,
                        )
                      }
                      onSubmit={(submission) => submitWork(item, submission)}
                      onDownloadAttachment={(attachment) =>
                        downloadClassworkAttachment(item.id, attachment).catch(
                          (error) => notify(error.message, 'error'),
                        )
                      }
                      onPreviewAttachment={
                        onPreviewAttachment
                          ? (attachment) => openAttachmentPreview(item, attachment)
                          : undefined
                      }
                      previewingFileId={previewingFileId}
                      onDownloadSubmission={(id, name) =>
                        downloadSubmissionFile(id, name).catch(
                          (error) => notify(error.message, 'error'),
                        )
                      }
                      getSubmissions={getClassworkSubmissions}
                      onGrade={gradeClassworkSubmission}
                      onRefresh={reloadClasswork}
                    />
                  ))}
                </div>
              )}

              <div className="lms-classroom-work-section">
                <h3>Lessons</h3>
                {visibleSlides.length === 0 ? (
                  <p className="lms-cell-muted">No lessons have been added to this class.</p>
                ) : (
                  visibleSlides.map((slide) => (
                    <article className="lms-classroom-work-item" key={slide.id}>
                      <div>
                        <strong>{slide.title}</strong>
                        <span>{slide.content?.[0]?.summary || 'Class lesson'}</span>
                        {slide.content?.[0]?.presentation?.fileName && (
                          <span>File: {slide.content[0].presentation.fileName}</span>
                        )}
                      </div>
                      {role === 'Faculty' && (
                        <Badge tone={slide.status === 'Published' ? 'success' : 'neutral'} dot>
                          {slide.status}
                        </Badge>
                      )}
                      {slide.content?.[0]?.presentation?.fileId && (
                        <>
                          {slide.content[0].presentation.previewable &&
                            onPreviewFile && (
                              <button
                                type="button"
                                className="lms-link"
                                onClick={() => downloadLessonFile(slide.id, true)}
                              >
                                Preview file
                              </button>
                            )}
                          {onDownloadFile && (
                            <button
                              type="button"
                              className="lms-link"
                              onClick={() => downloadLessonFile(slide.id)}
                            >
                              Download file
                            </button>
                          )}
                        </>
                      )}
                      {role === 'Student' && (
                        <Link
                          className="lms-link"
                          to={`/student/lessons?classId=${encodeURIComponent(learningClass.id)}`}
                        >
                          Open lesson
                        </Link>
                      )}
                    </article>
                  ))
                )}
              </div>
              <div className="lms-classroom-work-section" id="class-quizzes">
                <h3>Quizzes</h3>
                {role === 'Student' ? (
                  studentQuizContent
                ) : quizzes.length === 0 ? (
                  <p className="lms-cell-muted">No quizzes have been created for this class.</p>
                ) : (
                  quizzes.map((quiz) => (
                    <article className="lms-classroom-work-item" key={quiz.id}>
                      <div>
                        <strong>{quiz.title}</strong>
                        <span>
                          {quiz.questions} questions
                          {quiz.dueDate ? ` · Due ${formatDate(quiz.dueDate)}` : ''}
                        </span>
                      </div>
                      <Badge tone={quiz.status === 'Published' ? 'success' : 'warning'} dot>
                        {quiz.status}
                      </Badge>
                    </article>
                  ))
                )}
              </div>
            </section>
          )}

          {activeTab === 'People' && (
            <section className="lms-classroom-panel">
              <div className="lms-classroom-panel-heading">
                <div>
                  <h2>People</h2>
                  <p>Teachers and students in this class.</p>
                </div>
              </div>
              {!peopleState ? (
                <p className="lms-cell-muted" role="status">Loading class people...</p>
              ) : peopleState.error ? (
                <p className="lms-classroom-error" role="alert">{peopleState.error}</p>
              ) : role === 'Faculty' ? (
                <>
                  {people.length === 0 ? (
                    <EmptyState
                      icon="users"
                      title="No students enrolled"
                      description="Students who join this class will appear here."
                    />
                  ) : (
                    <div className="lms-classroom-people-list">
                      {people.map((student) => (
                        <article className="lms-classroom-person" key={student.id}>
                          <Avatar name={student.name} size="sm" />
                          <div>
                            <strong>{student.name}</strong>
                            {student.username && <span>@{student.username}</span>}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  {onViewScores && (
                    <button
                      type="button"
                      className="lms-btn lms-btn-secondary"
                      onClick={() => onViewScores(learningClass)}
                    >
                      View quiz scores
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="lms-classroom-people-group">
                    <h3>Teacher</h3>
                    <div className="lms-classroom-person">
                      <Avatar
                        name={peopleState.teacher?.name || learningClass.teacherName}
                        size="sm"
                      />
                      <div>
                        <span>Faculty</span>
                        <strong>{peopleState.teacher?.name || learningClass.teacherName}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="lms-classroom-people-group">
                    <h3>Classmates · {people.length}</h3>
                    {people.length === 0 ? (
                      <p className="lms-cell-muted">You’re the first student in this class.</p>
                    ) : (
                      <div className="lms-classroom-people-list">
                        {people.map((student) => (
                          <article className="lms-classroom-person" key={student.id}>
                            <Avatar name={student.name} size="sm" />
                            <div><strong>{student.name}</strong></div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          )}
        </main>

        <aside className="lms-classroom-upcoming">
          <h2>Upcoming</h2>
          <p>Due dates in this class</p>
          {upcoming.length === 0 ? (
            <p className="lms-cell-muted">Nothing due soon.</p>
          ) : (
            upcoming.map((item) => (
              <article className="lms-classroom-upcoming-item" key={item.id}>
                <strong>{item.title}</strong>
                <span>Due {formatDate(item.dueAt)}</span>
              </article>
            ))
          )}
        </aside>
      </div>
      {creatingClasswork && (
        <ClassworkFormModal
          quizzes={quizzes}
          onClose={() => setCreatingClasswork(false)}
          onSave={saveClasswork}
        />
      )}
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
    </div>
  )
}

function AnnouncementStreamItem({ announcement, role, onDelete, onAddComment }) {
  const notify = useToast()
  const [comment, setComment] = useState('')
  const [posting, setPosting] = useState(false)

  const submitComment = async (event) => {
    event.preventDefault()
    setPosting(true)
    try {
      await onAddComment(comment.trim())
      setComment('')
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setPosting(false)
    }
  }

  return (
    <article className="lms-classroom-announcement">
      <Avatar name={announcement.authorName} size="sm" />
      <div>
        <div className="lms-classroom-announcement-meta">
          <strong>{announcement.authorName}</strong>
          <span>{formatDate(announcement.createdAt)}</span>
          {role === 'Faculty' && (
            <button
              type="button"
              className="lms-link lms-classroom-delete"
              onClick={onDelete}
              aria-label="Delete announcement"
            >
              Delete
            </button>
          )}
        </div>
        <p>{announcement.message}</p>
        {(announcement.comments || []).length > 0 && (
          <div className="lms-classroom-comments">
            {announcement.comments.map((item) => (
              <div className="lms-classroom-comment" key={item.id}>
                <Avatar name={item.authorName} size="sm" />
                <div>
                  <strong>{item.authorName}</strong>
                  <span>{formatDate(item.createdAt)}</span>
                  <p>{item.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {role === 'Student' && (
          <form className="lms-classroom-comment-form" onSubmit={submitComment}>
            <input
              value={comment}
              maxLength={2000}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Add a comment"
              aria-label="Add a comment to this announcement"
              required
            />
            <button
              type="submit"
              className="lms-btn lms-btn-secondary lms-btn-sm"
              disabled={posting || !comment.trim()}
            >
              {posting ? 'Posting...' : 'Comment'}
            </button>
          </form>
        )}
      </div>
    </article>
  )
}

function ClassworkItem({
  item,
  role,
  quizzes,
  reviewing,
  onDelete,
  onReview,
  onSubmit,
  onDownloadAttachment,
  onPreviewAttachment,
  previewingFileId,
  onDownloadSubmission,
  getSubmissions,
  onGrade,
  onRefresh,
}) {
  const notify = useToast()
  const [submissionResult, setSubmissionResult] = useState(null)
  const [savingStudentId, setSavingStudentId] = useState('')
  const [grades, setGrades] = useState({})

  useEffect(() => {
    if (!reviewing || role !== 'Faculty' || !getSubmissions) return
    let active = true
    getSubmissions(item.id)
      .then((items) => {
        if (active) setSubmissionResult({ id: item.id, items, error: '' })
      })
      .catch((loadError) => {
        if (active) {
          setSubmissionResult({ id: item.id, items: [], error: loadError.message })
        }
      })
    return () => {
      active = false
    }
  }, [getSubmissions, item.id, reviewing, role])

  const submissions =
    submissionResult?.id === item.id ? submissionResult.items : []
  const loading =
    reviewing && submissionResult?.id !== item.id
  const error =
    submissionResult?.id === item.id ? submissionResult.error : ''

  const linkedQuiz = quizzes.find((quiz) => quiz.id === item.quizId)
  const studentStatus = {
    assigned: 'Assigned',
    missing: 'Missing',
    turned_in: 'Turned In',
    graded: 'Graded',
    returned: 'Returned',
  }[item.status] || item.status
  const badgeTone = role === 'Faculty'
    ? item.status === 'Published' ? 'success' : 'neutral'
    : item.status === 'missing'
      ? 'danger'
      : ['graded', 'returned'].includes(item.status)
        ? 'success'
        : item.status === 'turned_in'
          ? 'info'
          : 'warning'

  const gradeSubmission = async (submission, status = 'graded') => {
    const input = grades[submission.studentId]
    if (status === 'graded' && input === undefined && submission.grade == null) {
      notify('Enter a grade before saving.', 'error')
      return
    }
    const grade = input === undefined ? submission.grade : Number(input)
    if (grade != null && (!Number.isFinite(grade) || grade < 0 || grade > 100)) {
      notify('Grade must be between 0 and 100.', 'error')
      return
    }
    setSavingStudentId(submission.studentId)
    try {
      const result = await onGrade(item.id, submission.studentId, {
        status,
        ...(grade == null ? {} : { grade }),
      })
      setSubmissionResult((current) => ({
        ...current,
        items: current.items.map((entry) =>
          entry.studentId === submission.studentId
            ? { ...entry, ...result.submission }
            : entry,
        ),
      }))
      await onRefresh()
      notify(status === 'returned' ? 'Work returned to the student.' : 'Submission graded.')
    } catch (gradeError) {
      notify(gradeError.message, 'error')
    } finally {
      setSavingStudentId('')
    }
  }

  return (
    <article className="lms-classroom-work-card">
      <div className="lms-classroom-work-item">
        <span className="lms-classroom-work-icon">
          <Icon
            name={item.type === 'quiz' ? 'quiz' : item.type === 'material' ? 'book' : 'fileText'}
            size={18}
          />
        </span>
        <div>
          <strong>{item.title}</strong>
          <span>
            {item.type[0].toUpperCase() + item.type.slice(1)}
            {item.dueAt ? ` · Due ${formatDate(item.dueAt)}` : ''}
          </span>
          {item.instructions && <p>{item.instructions}</p>}
        </div>
        <Badge tone={badgeTone} dot>{role === 'Student' ? studentStatus : item.status}</Badge>
        {role === 'Faculty' && (
          <button
            type="button"
            className="lms-icon-btn lms-icon-btn-danger"
            onClick={onDelete}
            aria-label={`Delete ${item.title}`}
          >
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>

      {item.attachments?.length > 0 && (
        <div className="lms-classroom-attachments">
          {item.attachments.map((attachment) => (
            <div className="lms-classroom-attachment" key={attachment.fileId}>
              <Icon name="fileText" size={15} />
              <span>{attachment.fileName}</span>
              {onPreviewAttachment && (
                <button
                  type="button"
                  className="lms-link"
                  onClick={() => onPreviewAttachment(attachment)}
                  disabled={previewingFileId === attachment.fileId}
                >
                  {previewingFileId === attachment.fileId
                    ? 'Loading preview...'
                    : 'Preview'}
                </button>
              )}
              <button
                type="button"
                className="lms-link"
                onClick={() => onDownloadAttachment(attachment)}
              >
                Download
              </button>
            </div>
          ))}
        </div>
      )}

      {role === 'Student' && item.type === 'assignment' && (
        <div className="lms-classroom-turnin">
          {item.submissionText && (
            <p className="lms-classroom-submission-copy">{item.submissionText}</p>
          )}
          {item.fileName && item.submissionId && (
            <button
              type="button"
              className="lms-link"
              onClick={() => onDownloadSubmission(item.submissionId, item.fileName)}
            >
              <Icon name="download" size={13} /> {item.fileName}
            </button>
          )}
          {item.grade != null && <Badge tone="success">Grade: {item.grade}%</Badge>}
          {item.status !== 'graded' && (
            <StudentTurnInForm item={item} onSubmit={onSubmit} />
          )}
        </div>
      )}

      {role === 'Student' && item.type === 'quiz' && (
        <Link className="lms-link" to="#class-quizzes">
          {linkedQuiz ? `Open ${linkedQuiz.title}` : 'Open teacher-provided quizzes'}
          <Icon name="arrowRight" size={12} />
        </Link>
      )}

      {role === 'Faculty' && item.type === 'assignment' && (
        <button
          type="button"
          className="lms-link lms-classroom-review-toggle"
          onClick={onReview}
          aria-expanded={reviewing}
        >
          <Icon name="users" size={14} />
          {item.submittedCount || 0} of {item.studentCount || 0} turned in
          <span>{reviewing ? 'Hide submissions' : 'Review submissions'}</span>
        </button>
      )}

      {role === 'Faculty' && reviewing && (
        <div className="lms-classroom-submission-list">
          {loading ? (
            <p className="lms-cell-muted" role="status">Loading student work...</p>
          ) : error ? (
            <p className="lms-classroom-error" role="alert">{error}</p>
          ) : submissions.length === 0 ? (
            <p className="lms-cell-muted">No students are enrolled in this class.</p>
          ) : (
            submissions.map((submission) => (
              <article className="lms-classroom-submission" key={submission.studentId}>
                <Avatar name={submission.studentName} size="sm" />
                <div className="lms-classroom-submission-main">
                  <div className="lms-classroom-submission-head">
                    <strong>{submission.studentName}</strong>
                    <Badge
                      tone={['graded', 'returned'].includes(submission.status)
                        ? 'success'
                        : submission.status === 'turned_in' ? 'info' : 'neutral'}
                    >
                      {submission.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  {submission.text && <p>{submission.text}</p>}
                  {submission.fileId && submission.id && (
                    <button
                      type="button"
                      className="lms-link"
                      onClick={() => onDownloadSubmission(submission.id, submission.fileName)}
                    >
                      <Icon name="download" size={13} /> {submission.fileName}
                    </button>
                  )}
                  {submission.status !== 'assigned' && (
                    <div className="lms-classroom-grade-row">
                      <label>
                        Grade
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={grades[submission.studentId] ?? submission.grade ?? ''}
                          onChange={(event) =>
                            setGrades((current) => ({
                              ...current,
                              [submission.studentId]: event.target.value,
                            }))
                          }
                        />
                        <span>%</span>
                      </label>
                      <button
                        type="button"
                        className="lms-btn lms-btn-primary lms-btn-sm"
                        disabled={savingStudentId === submission.studentId}
                        onClick={() => gradeSubmission(submission)}
                      >
                        Save grade
                      </button>
                      {submission.status !== 'returned' && (
                        <button
                          type="button"
                          className="lms-btn lms-btn-secondary lms-btn-sm"
                          disabled={savingStudentId === submission.studentId}
                          onClick={() => gradeSubmission(submission, 'returned')}
                        >
                          Return
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </article>
  )
}

function StudentTurnInForm({ item, onSubmit }) {
  const [text, setText] = useState(item.submissionText || '')
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    if (!text.trim() && !file) return
    setError('')
    setSubmitting(true)
    try {
      await onSubmit({ text: text.trim(), file })
      setFile(null)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="lms-classroom-turnin-form" onSubmit={submit}>
      <label>
        Your work
        <textarea
          rows="3"
          maxLength="10000"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write your response..."
          disabled={submitting}
        />
      </label>
      <label>
        Attach a file
        <input
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          disabled={submitting}
        />
      </label>
      {error && <p className="lms-classroom-error" role="alert">{error}</p>}
      <button
        type="submit"
        className="lms-btn lms-btn-primary lms-btn-sm"
        disabled={submitting || (!text.trim() && !file)}
      >
        {submitting ? 'Turning in...' : item.status === 'returned' ? 'Resubmit work' : 'Turn in'}
      </button>
    </form>
  )
}

function ClassworkFormModal({ quizzes, onClose, onSave }) {
  const [type, setType] = useState('assignment')
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [quizId, setQuizId] = useState('')
  const [status, setStatus] = useState('Published')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async (event) => {
    event.preventDefault()
    setError('')
    if (type === 'quiz' && !quizId) {
      setError('Create or choose a quiz for this class.')
      return
    }
    if (dueAt && new Date(dueAt).getTime() < Date.now()) {
      setError('Due date cannot be in the past.')
      return
    }
    setSaving(true)
    try {
      await onSave(
        {
          type,
          title: title.trim(),
          instructions: instructions.trim(),
          dueAt: dueAt ? new Date(dueAt).toISOString() : '',
          quizId: type === 'quiz' ? quizId : undefined,
          status,
        },
        file,
      )
    } finally {
      setSaving(false)
    }
  }

  const [localNow] = useState(() => {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
  })

  return (
    <Modal
      title="Create classwork"
      description="Add an assignment, connect a class quiz, or share a material."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="lms-btn lms-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="classwork-form"
            className="lms-btn lms-btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Create classwork'}
          </button>
        </>
      }
    >
      <form id="classwork-form" className="lms-form-grid" onSubmit={save}>
        <Field label="Type">
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="assignment">Assignment</option>
            <option value="quiz">Quiz</option>
            <option value="material">Material</option>
          </select>
        </Field>
        <Field label="Visibility">
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="Published">Published</option>
            <option value="Draft">Draft</option>
          </select>
        </Field>
        <Field label="Title" className="lms-field-full">
          <input
            value={title}
            maxLength="200"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Chapter 1 reflection"
            required
          />
        </Field>
        {type === 'quiz' && (
          <Field label="Class quiz" className="lms-field-full">
            <select
              value={quizId}
              onChange={(event) => setQuizId(event.target.value)}
              required
            >
              <option value="">Choose a quiz</option>
              {quizzes.map((quiz) => (
                <option value={quiz.id} key={quiz.id}>
                  {quiz.title} · {quiz.status}
                </option>
              ))}
            </select>
            {quizzes.length === 0 && (
              <span className="lms-field-hint">Create a quiz for this class first.</span>
            )}
          </Field>
        )}
        <Field label="Due date (optional)">
          <input
            type="datetime-local"
            value={dueAt}
            min={localNow}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </Field>
        <Field label="Attachment (optional)">
          <input
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <span className="lms-field-hint">Any file type, up to 25 MB.</span>
        </Field>
        <Field label="Instructions" className="lms-field-full">
          <textarea
            rows="5"
            maxLength="10000"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Add instructions or details for students..."
          />
        </Field>
        {error && <p className="lms-classroom-error lms-field-full" role="alert">{error}</p>}
      </form>
    </Modal>
  )
}
