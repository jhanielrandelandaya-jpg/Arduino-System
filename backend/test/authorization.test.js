const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'learnspace-auth-'))
process.env.MONGODB_DB = `auth_${process.pid}_${Date.now()}`
process.env.LEARNING_DATA_DIR = temporaryDirectory
process.env.CLASSWORK_DATA_DIR = path.join(temporaryDirectory, 'classwork')
process.env.SUBMISSION_DATA_DIR = path.join(temporaryDirectory, 'submissions')
process.env.SLIDE_DATA_DIR = path.join(temporaryDirectory, 'slides')
process.env.JWT_SECRET = 'test-secret-with-sufficient-length'

const app = require('../server')
const db = require('../config/database')
const jwt = require('jsonwebtoken')
const { jwtSecret } = require('../config/auth')

const users = {
  facultyA: { id: 'faculty-a', name: 'Faculty A', role: 'Faculty' },
  facultyB: { id: 'faculty-b', name: 'Faculty B', role: 'Faculty' },
  studentA: { id: 'student-a', name: 'Student A', role: 'Student' },
  studentB: { id: 'student-b', name: 'Student B', role: 'Student' },
  unassigned: { id: 'student-unassigned', name: 'Unassigned Student', role: 'Student' },
}

const classes = {
  a: 'class-a',
  b: 'class-b',
  inactive: 'class-inactive',
}

let server
let origin
let database

const tokenFor = (user) =>
  jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '1h' })

const request = async (pathName, user, options = {}) => {
  const headers = { ...(options.headers || {}) }
  if (user) headers.Authorization = `Bearer ${tokenFor(user)}`
  if (typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json'
  }
  const response = await fetch(`${origin}${pathName}`, { ...options, headers })
  const contentType = response.headers.get('content-type') || ''
  return {
    status: response.status,
    body: contentType.includes('application/json')
      ? await response.json()
      : await response.text(),
  }
}

test.before(async () => {
  database = await db.getDatabase()

  await database.collection('users').insertMany(
    Object.values(users).map((user) => ({
      id: user.id,
      full_name: user.name,
      username: `${user.id}@example.test`,
      password_hash: 'not-used',
      role: user.role,
    })),
  )

  await database.collection('classes').insertMany([
    {
      id: classes.a,
      class_name: 'Faculty A Class',
      subject: 'Science',
      subject_code: 'SCI-A',
      class_code: 'JOIN-A',
      join_code: 'A1B2C3D4',
      status: 'Published',
      faculty_id: users.facultyA.id,
      created_date: '2025-01-01T00:00:00.000Z',
    },
    {
      id: classes.b,
      class_name: 'Faculty B Class',
      subject: 'History',
      subject_code: 'HIS-B',
      class_code: 'JOIN-B',
      join_code: 'B1C2D3E4',
      status: 'Published',
      faculty_id: users.facultyB.id,
      created_date: '2025-01-02T00:00:00.000Z',
    },
    {
      id: classes.inactive,
      class_name: 'Inactive Enrollment Class',
      subject: 'Science',
      subject_code: 'SCI-I',
      class_code: 'JOIN-I',
      join_code: 'I1N2A3C4',
      status: 'Published',
      faculty_id: users.facultyA.id,
      created_date: '2025-01-03T00:00:00.000Z',
    },
  ])

  await database.collection('enrollments').insertMany([
    { id: 'enrollment-a', student_id: users.studentA.id, class_id: classes.a, status: 'Active' },
    { id: 'enrollment-b', student_id: users.studentB.id, class_id: classes.b, status: 'Active' },
    { id: 'enrollment-inactive', student_id: users.studentA.id, class_id: classes.inactive, status: 'Inactive' },
  ])

  await database.collection('quizzes').insertMany([
    {
      id: 'quiz-a-published',
      quiz_title: 'A Published Quiz',
      class_id: classes.a,
      subject_code: 'SCI-A',
      status: 'Published',
      questions_json: JSON.stringify([
        { id: 'choice', type: 'multiple_choice', prompt: 'Select the correct choice', options: ['Wrong', 'Right'], answer: 1 },
        { id: 'multiple', type: 'checkboxes', prompt: 'Select both correct choices', options: ['First', 'Second', 'Third'], answer: [0, 2] },
        { id: 'short', type: 'short_answer', prompt: 'Enter the answer', answer: 'Alpha' },
        { id: 'dropdown', type: 'dropdown', prompt: 'Choose the answer', options: ['Correct', 'Incorrect'], answer: 0 },
      ]),
      attempts_allowed: 1,
      created_date: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'quiz-a-draft',
      quiz_title: 'A Draft Quiz',
      class_id: classes.a,
      subject_code: 'SCI-A',
      status: 'Draft',
      questions_json: '[]',
    },
    {
      id: 'quiz-b-published',
      quiz_title: 'B Private Quiz',
      class_id: classes.b,
      subject_code: 'HIS-B',
      status: 'Published',
      questions_json: '[]',
    },
  ])

  await database.collection('slides').insertMany([
    { id: 'slide-a-published', class_id: classes.a, title: 'A Published Slides', content_json: '[]', presentation_json: '[]', status: 'Published' },
    { id: 'slide-a-draft', class_id: classes.a, title: 'A Draft Slides', content_json: '[]', presentation_json: '[]', status: 'Draft' },
    { id: 'slide-b-published', class_id: classes.b, title: 'B Private Slides', content_json: '[]', presentation_json: '[]', status: 'Published' },
    { id: 'slide-a-document', class_id: classes.a, title: 'A Document Lesson', content_json: '[]', presentation_json: '[]', status: 'Draft' },
    { id: 'slide-a-pdf', class_id: classes.a, title: 'A PDF Lesson', content_json: '[]', presentation_json: '[]', status: 'Draft' },
  ])

  await database.collection('classwork').insertMany([
    {
      id: 'classwork-a-assignment',
      class_id: classes.a,
      type: 'assignment',
      title: 'A Assignment',
      instructions: 'Complete this work.',
      due_at: '2099-12-31T23:59:00Z',
      status: 'Published',
    },
    {
      id: 'classwork-a-quiz',
      class_id: classes.a,
      type: 'quiz',
      title: 'A Classwork Quiz',
      instructions: 'Complete the linked quiz.',
      status: 'Published',
    },
    {
      id: 'classwork-a-draft',
      class_id: classes.a,
      type: 'material',
      title: 'A Draft Material',
      instructions: 'Not published.',
      status: 'Draft',
    },
    {
      id: 'classwork-b-assignment',
      class_id: classes.b,
      type: 'assignment',
      title: 'B Private Assignment',
      instructions: 'Private class work.',
      due_at: '2099-12-31T23:59:00Z',
      status: 'Published',
    },
  ])

  await database.collection('submissions').insertOne({
    id: 'submission-a-assignment',
    classwork_id: 'classwork-a-assignment',
    student_id: users.studentA.id,
    status: 'assigned',
  })

  await database.collection('announcements').insertMany([
    {
      id: 'announcement-a',
      class_id: classes.a,
      author_id: users.facultyA.id,
      title: 'Faculty A update',
      body: 'A class update',
      comment_json: '[]',
    },
    {
      id: 'announcement-b',
      class_id: classes.b,
      author_id: users.facultyB.id,
      title: 'Faculty B private update',
      body: 'A private class update',
      comment_json: '[]',
    },
  ])

  await database.collection('activity_logs').insertMany([
    {
      id: 'activity-a', action: 'class.created', entity_type: 'class', entity_id: classes.a,
      message: 'Faculty A activity', actor_id: users.facultyA.id, class_id: classes.a,
      created_at: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'activity-b', action: 'class.created', entity_type: 'class', entity_id: classes.b,
      message: 'Faculty B activity', actor_id: users.facultyB.id, class_id: classes.b,
      created_at: '2025-01-02T00:00:00.000Z',
    },
  ])

  await database.collection('activity').insertMany([
    {
      id: 'activity-a', action: 'class.created', entity_type: 'class', entity_id: classes.a,
      message: 'Faculty A activity', actor_id: users.facultyA.id, class_id: classes.a,
    },
    {
      id: 'activity-b', action: 'class.created', entity_type: 'class', entity_id: classes.b,
      message: 'Faculty B activity', actor_id: users.facultyB.id, class_id: classes.b,
    },
  ])

  await new Promise((resolve, reject) => {
    server = app.listen(0, () => {
      origin = `http://127.0.0.1:${server.address().port}`
      resolve()
    })
    server.on('error', reject)
  })
})

test.after(async () => {
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
    if (database) await database.dropDatabase()
  } finally {
    try {
      await db.close()
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true })
    }
  }
})

test('registration requires and records Security Policy acceptance', async () => {
  const registration = {
    fullName: 'Policy Test User',
    username: 'policy-test-user',
    password: 'secure-password-123',
    role: 'Student',
  }

  const missingAcceptance = await request('/api/auth/register', null, {
    method: 'POST',
    body: JSON.stringify(registration),
  })
  assert.equal(missingAcceptance.status, 400)
  assert.match(missingAcceptance.body.message, /Security Policy/)

  const accepted = await request('/api/auth/register', null, {
    method: 'POST',
    body: JSON.stringify({
      ...registration,
      username: 'policy-test-user-accepted',
      securityPolicyAccepted: true,
    }),
  })
  assert.equal(accepted.status, 201)

  const created = await database.collection('users').findOne({
    username: 'policy-test-user-accepted',
  })
  assert.equal(created.security_policy_version, '1')
  assert.ok(Number.isFinite(Date.parse(created.security_policy_accepted_at)))
})

test('faculty dashboard and all learning lists are scoped to owned classes', async () => {
  const dashboard = await request('/api/faculty/dashboard', users.facultyA)
  assert.equal(dashboard.status, 200)
  assert.deepEqual(
    dashboard.body.classes.map((item) => item.id).sort(),
    [classes.a, classes.inactive].sort(),
  )
  assert.deepEqual(dashboard.body.quizzes.map((item) => item.id).sort(), [
    'quiz-a-draft',
    'quiz-a-published',
  ])
  assert.deepEqual(dashboard.body.slides.map((item) => item.id).sort(), [
    'slide-a-document',
    'slide-a-draft',
    'slide-a-pdf',
    'slide-a-published',
  ])
  assert.deepEqual(
    dashboard.body.classwork.map((item) => item.id).sort(),
    ['classwork-a-assignment', 'classwork-a-quiz'].sort(),
  )
  assert.doesNotMatch(
    JSON.stringify(dashboard.body.classwork),
    /classwork-b|B Private Assignment/,
  )
  assert.deepEqual(dashboard.body.students.map((item) => item.id), [users.studentA.id])

  for (const endpoint of [
    '/api/learning/bootstrap',
  ]) {
    const response = await request(endpoint, users.facultyA)
    assert.equal(response.status, 200, endpoint)
    assert.doesNotMatch(JSON.stringify(response.body), /Faculty B|HIS-B|class-b|quiz-b|slide-b/)
  }

  const students = await request(
    `/api/faculty/classes/${classes.a}/students`,
    users.facultyA,
  )
  assert.equal(students.status, 200)
  assert.deepEqual(students.body.students.map((student) => student.id), [
    users.studentA.id,
  ])
})

test('faculty cannot read or mutate another faculty class or its content', async () => {
  assert.equal(
    (await request(`/api/learning/classes/${classes.b}`, users.facultyA)).status,
    404,
  )
  assert.equal(
    (await request('/api/learning/quizzes/quiz-b-published', users.facultyA)).status,
    403,
  )
  assert.equal(
    (await request('/api/learning/slides/slide-b-published', users.facultyA)).status,
    403,
  )
  assert.equal(
    (await request(`/api/faculty/classes/${classes.b}/students`, users.facultyA)).status,
    404,
  )
  assert.equal(
    (
      await request(`/api/learning/classes/${classes.b}`, users.facultyA, {
        method: 'PATCH',
        body: JSON.stringify({ className: 'Hijacked' }),
      })
    ).status,
    404,
  )
  assert.equal(
    (
      await request('/api/learning/quizzes/quiz-b-published', users.facultyA, {
        method: 'DELETE',
      })
    ).status,
    404,
  )
  const crossOwnerQuiz = await request('/api/learning/quizzes', users.facultyA, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Unauthorized class quiz',
      classId: classes.b,
      facultyId: users.facultyA.id,
    }),
  })
  assert.equal(crossOwnerQuiz.status, 404)
  assert.equal(
    (
      await request('/api/learning/quizzes/quiz-a-published', users.facultyA, {
        method: 'PATCH',
        body: JSON.stringify({ classId: classes.b }),
      })
    ).status,
    200,
  )
  assert.equal(
    (await database.collection('quizzes').findOne({ id: 'quiz-a-published' }))
      .class_id,
    classes.a,
  )
  const crossOwnerSlide = await request('/api/learning/slides', users.facultyA, {
    method: 'POST',
    body: JSON.stringify({
      classId: classes.b,
      title: 'Unauthorized slides',
      content: [],
    }),
  })
  assert.equal(crossOwnerSlide.status, 404)
  assert.equal(
    (
      await request('/api/learning/slides/slide-a-published', users.facultyA, {
        method: 'PATCH',
        body: JSON.stringify({ classId: classes.b }),
      })
    ).status,
    200,
  )
  assert.equal(
    (await database.collection('slides').findOne({ id: 'slide-a-published' }))
      .class_id,
    classes.a,
  )
})

test('class announcements are available only to the class owner and active students', async () => {
  const facultyAnnouncements = await request(
    `/api/learning/classes/${classes.a}/announcements`,
    users.facultyA,
  )
  assert.equal(facultyAnnouncements.status, 200)
  assert.deepEqual(
    facultyAnnouncements.body.announcements.map((item) => item.title),
    ['Faculty A update'],
  )

  const studentAnnouncements = await request(
    `/api/learning/classes/${classes.a}/announcements`,
    users.studentA,
  )
  assert.equal(studentAnnouncements.status, 200)
  assert.deepEqual(
    studentAnnouncements.body.announcements.map((item) => item.title),
    ['Faculty A update'],
  )

  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.a}/announcements`,
        users.facultyB,
      )
    ).status,
    404,
  )
  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.a}/announcements`,
        users.studentB,
      )
    ).status,
    404,
  )
  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.a}/announcements`,
        null,
      )
    ).status,
    401,
  )
  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.b}/announcements`,
        users.facultyA,
        {
          method: 'POST',
          body: JSON.stringify({
            title: 'Cross-class announcement',
            body: 'Should not be created.',
          }),
        },
      )
    ).status,
    404,
  )
  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.a}/announcements`,
        users.studentA,
        {
          method: 'POST',
          body: JSON.stringify({
            title: 'Student announcement',
            body: 'Students cannot post announcements.',
          }),
        },
      )
    ).status,
    403,
  )

  const created = await request(
    `/api/learning/classes/${classes.a}/announcements`,
    users.facultyA,
    {
      method: 'POST',
      body: JSON.stringify({
        title: '  New class update  ',
        body: '  A new update for the class.  ',
        classId: classes.b,
        authorId: users.facultyB.id,
      }),
    },
  )
  assert.equal(created.status, 201)
  assert.equal(created.body.announcement.title, 'New class update')
  assert.equal(created.body.announcement.body, 'A new update for the class.')
  assert.equal(created.body.announcement.author_id, users.facultyA.id)
  const studentView = await request(
    `/api/learning/classes/${classes.a}/announcements`,
    users.studentA,
  )
  assert.deepEqual(
    studentView.body.announcements.map((item) => item.title).sort(),
    ['Faculty A update', 'New class update'].sort(),
  )

  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.a}/announcements`,
        users.facultyA,
        {
          method: 'POST',
          body: JSON.stringify({ title: 'Announcement', body: ' ' }),
        },
      )
    ).status,
    400,
  )
})

test('student dashboard returns only active enrolled classes and published content', async () => {
  const dashboard = await request('/api/student/dashboard', users.studentA)
  assert.equal(dashboard.status, 200)
  assert.deepEqual(dashboard.body.classes.map((item) => item.id), [classes.a])
  assert.equal(dashboard.body.classes[0].quizzes, 1)
  assert.equal(dashboard.body.classes[0].lessons, 1)
  assert.deepEqual(dashboard.body.quizzes.map((item) => item.id), [
    'quiz-a-published',
  ])
  assert.deepEqual(dashboard.body.slides.map((item) => item.id), [
    'slide-a-published',
  ])
  assert.deepEqual(
    dashboard.body.classwork.map((item) => item.id).sort(),
    ['classwork-a-assignment', 'classwork-a-quiz'].sort(),
  )
  assert.doesNotMatch(
    JSON.stringify(dashboard.body.classwork),
    /classwork-b|B Private Assignment|A Draft Material/,
  )
  const assignment = dashboard.body.classwork.find(
    (item) => item.id === 'classwork-a-assignment',
  )
  assert.equal(assignment.status, 'assigned')
  assert.equal(dashboard.body.classes[0].pendingClasswork, 1)
  assert.doesNotMatch(JSON.stringify(dashboard.body), /class-b|HIS-B|Draft/)

  for (const endpoint of [
    '/api/learning/bootstrap',
  ]) {
    const response = await request(endpoint, users.studentA)
    assert.equal(response.status, 200, endpoint)
    assert.doesNotMatch(JSON.stringify(response.body), /Faculty B|HIS-B|class-b|quiz-b|slide-b/)
    for (const quiz of response.body.quizzes || []) {
      for (const question of quiz.questionList) {
        assert.equal(Object.hasOwn(question, 'answer'), false, endpoint)
      }
    }
  }
})

test('classwork APIs enforce ownership, enrollment, submissions, grading, and attachments', async () => {
  const facultyList = await request(
    `/api/learning/classes/${classes.a}/classwork`,
    users.facultyA,
  )
  assert.equal(facultyList.status, 200)
  assert.deepEqual(
    facultyList.body.classwork.map((item) => item.id).sort(),
    ['classwork-a-assignment', 'classwork-a-quiz'].sort(),
  )
  assert.doesNotMatch(JSON.stringify(facultyList.body), /B Private Assignment/)
  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.a}/classwork`,
        users.facultyB,
      )
    ).status,
    404,
  )

  const studentList = await request(
    `/api/learning/classes/${classes.a}/classwork`,
    users.studentA,
  )
  assert.equal(studentList.status, 200)
  assert.deepEqual(
    studentList.body.classwork.map((item) => item.id).sort(),
    ['classwork-a-assignment', 'classwork-a-quiz'].sort(),
  )
  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.a}/classwork`,
        users.studentB,
      )
    ).status,
    404,
  )
  assert.equal(
    (
      await request(`/api/learning/classes/${classes.a}/classwork`, null)
    ).status,
    401,
  )
  assert.equal(
    (
      await request(`/api/learning/classes/${classes.a}/classwork`, users.studentA, {
        method: 'POST',
        body: JSON.stringify({ type: 'assignment', title: 'Forbidden' }),
      })
    ).status,
    403,
  )

  const pastDue = await request(
    `/api/learning/classes/${classes.a}/classwork`,
    users.facultyA,
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'assignment',
        title: 'Past due',
        dueAt: '2000-01-01T00:00:00.000Z',
      }),
    },
  )
  assert.equal(pastDue.status, 400)
  const foreignQuiz = await request(
    `/api/learning/classes/${classes.a}/classwork`,
    users.facultyA,
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'quiz',
        title: 'Wrong class quiz',
        quizId: 'quiz-b-published',
      }),
    },
  )
  assert.equal(foreignQuiz.status, 400)

  const created = await request(
    `/api/learning/classes/${classes.a}/classwork`,
    users.facultyA,
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'assignment',
        title: 'Turn-in Assignment',
        instructions: 'Submit text or a file.',
        dueAt: '2099-12-31T23:59:00.000Z',
        status: 'Published',
      }),
    },
  )
  assert.equal(created.status, 201)
  const classworkId = created.body.classwork.id

  const attachmentForm = new FormData()
  attachmentForm.append(
    'file',
    new Blob(['assignment instructions'], { type: 'text/plain' }),
    'instructions.txt',
  )
  const attachment = await request(
    `/api/learning/classwork/${classworkId}/attachments`,
    users.facultyA,
    { method: 'POST', body: attachmentForm },
  )
  assert.equal(attachment.status, 201)
  const fileResponse = await fetch(
    `${origin}/api/learning/classwork/${classworkId}/attachments/${attachment.body.attachment.fileId}`,
    { headers: { Authorization: 'Be' + 'arer ' + tokenFor(users.facultyA) } },
  )
  assert.equal(fileResponse.status, 200)
  assert.equal(await fileResponse.text(), 'assignment instructions')
  const previewResponse = await fetch(
    `${origin}/api/learning/classwork/${classworkId}/attachments/${attachment.body.attachment.fileId}?preview=1`,
    { headers: { Authorization: 'Be' + 'arer ' + tokenFor(users.studentA) } },
  )
  assert.equal(previewResponse.status, 200)
  assert.match(previewResponse.headers.get('content-type'), /text\/plain/)
  assert.match(previewResponse.headers.get('content-disposition'), /^inline;/)
  assert.equal(await previewResponse.text(), 'assignment instructions')
  const blockedFile = await fetch(
    `${origin}/api/learning/classwork/${classworkId}/attachments/${attachment.body.attachment.fileId}`,
    { headers: { Authorization: 'Be' + 'arer ' + tokenFor(users.studentB) } },
  )
  assert.equal(blockedFile.status, 404)
  const blockedPreview = await fetch(
    `${origin}/api/learning/classwork/${classworkId}/attachments/${attachment.body.attachment.fileId}?preview=1`,
    { headers: { Authorization: 'Be' + 'arer ' + tokenFor(users.studentB) } },
  )
  assert.equal(blockedPreview.status, 404)

  const unsupportedPreviewForm = new FormData()
  unsupportedPreviewForm.append(
    'file',
    new Blob(['not a PDF'], { type: 'application/pdf' }),
    'notes.pdf',
  )
  const unsupportedAttachment = await request(
    `/api/learning/classwork/${classworkId}/attachments`,
    users.facultyA,
    { method: 'POST', body: unsupportedPreviewForm },
  )
  assert.equal(unsupportedAttachment.status, 201)
  const genericPreview = await fetch(
    `${origin}/api/learning/classwork/${classworkId}/attachments/${unsupportedAttachment.body.attachment.fileId}?preview=1`,
    { headers: { Authorization: 'Be' + 'arer ' + tokenFor(users.studentA) } },
  )
  assert.equal(genericPreview.status, 200)
  assert.equal(genericPreview.headers.get('content-type'), 'application/octet-stream')
  assert.match(genericPreview.headers.get('content-disposition'), /^inline;/)
  assert.equal(await genericPreview.text(), 'not a PDF')

  const submissionForm = new FormData()
  submissionForm.append('text', 'My assignment response')
  submissionForm.append(
    'file',
    new Blob(['student work'], { type: 'text/plain' }),
    'response.txt',
  )
  const turnedIn = await request(
    `/api/learning/classwork/${classworkId}/submission`,
    users.studentA,
    { method: 'POST', body: submissionForm },
  )
  assert.equal(turnedIn.status, 201)
  assert.equal(turnedIn.body.submission.status, 'turned_in')
  assert.equal(
    turnedIn.body.submission.submission_text,
    'My assignment response',
  )

  const submissions = await request(
    `/api/learning/classwork/${classworkId}/submissions`,
    users.facultyA,
  )
  assert.equal(submissions.status, 200)
  assert.equal(submissions.body.submissions.length, 1)
  assert.equal(submissions.body.submissions[0].studentId, users.studentA.id)
  assert.equal(submissions.body.submissions[0].fileName, 'response.txt')
  assert.equal(
    (
      await request(
        `/api/learning/classwork/${classworkId}/submissions`,
        users.facultyB,
      )
    ).status,
    404,
  )
  assert.equal(
    (
      await request(
        `/api/learning/classwork/${classworkId}/submission`,
        users.studentB,
      )
    ).status,
    404,
  )
  assert.equal(
    (
      await request(
        `/api/learning/classwork/${classworkId}/submissions/${users.studentA.id}`,
        users.facultyB,
        { method: 'PATCH', body: JSON.stringify({ grade: 91 }) },
      )
    ).status,
    404,
  )

  const submissionId = turnedIn.body.submission.id
  const privateFile = await fetch(
    `${origin}/api/learning/submissions/${submissionId}/file`,
    { headers: { Authorization: 'Be' + 'arer ' + tokenFor(users.facultyA) } },
  )
  assert.equal(privateFile.status, 200)
  assert.equal(await privateFile.text(), 'student work')
  const studentOwnFile = await fetch(
    `${origin}/api/learning/submissions/${submissionId}/file`,
    { headers: { Authorization: 'Be' + 'arer ' + tokenFor(users.studentA) } },
  )
  assert.equal(studentOwnFile.status, 200)
  assert.equal(await studentOwnFile.text(), 'student work')
  const blockedSubmissionFile = await fetch(
    `${origin}/api/learning/submissions/${submissionId}/file`,
    { headers: { Authorization: 'Be' + 'arer ' + tokenFor(users.studentB) } },
  )
  assert.equal(blockedSubmissionFile.status, 404)

  const graded = await request(
    `/api/learning/classwork/${classworkId}/submissions/${users.studentA.id}`,
    users.facultyA,
    { method: 'PATCH', body: JSON.stringify({ grade: 92.5 }) },
  )
  assert.equal(graded.status, 200)
  assert.equal(graded.body.submission.status, 'graded')
  assert.equal(graded.body.submission.grade, 92.5)
  assert.equal(
    (
      await request(
        `/api/learning/classwork/${classworkId}/submission`,
        users.studentA,
      )
    ).body.submission.status,
    'graded',
  )

  const returned = await request(
    `/api/learning/classwork/${classworkId}/submissions/${users.studentA.id}`,
    users.facultyA,
    { method: 'PATCH', body: JSON.stringify({ status: 'returned' }) },
  )
  assert.equal(returned.status, 200)
  assert.equal(returned.body.submission.status, 'returned')
  assert.equal(returned.body.submission.grade, 92.5)
})

test('class stream comments, announcement deletion, and class people stay scoped', async () => {
  const announcement = await request(
    `/api/learning/classes/${classes.a}/announcements`,
    users.facultyA,
    {
      method: 'POST',
      body: JSON.stringify({
        title: 'Discussion thread',
        body: 'Discuss this announcement.',
      }),
    },
  )
  assert.equal(announcement.status, 201)
  const announcementId = announcement.body.announcement.id

  const comment = await request(
    `/api/learning/classes/${classes.a}/announcements/${announcementId}/comments`,
    users.studentA,
    {
      method: 'POST',
      body: JSON.stringify({ text: 'Student comment' }),
    },
  )
  assert.equal(comment.status, 201)
  const stream = await request(
    `/api/learning/classes/${classes.a}/announcements`,
    users.facultyA,
  )
  const thread = stream.body.announcements.find((item) => item.id === announcementId)
  assert.equal(thread.comments[0].text, 'Student comment')
  assert.equal(thread.comments[0].author_id, users.studentA.id)

  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.a}/announcements/${announcementId}/comments`,
        users.studentB,
        { method: 'POST', body: JSON.stringify({ text: 'Out of class' }) },
      )
    ).status,
    404,
  )
  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.a}/announcements/${announcementId}/comments`,
        users.facultyA,
        { method: 'POST', body: JSON.stringify({ text: 'Wrong role' }) },
      )
    ).status,
    403,
  )

  const facultyPeople = await request(
    `/api/learning/classes/${classes.a}/people`,
    users.facultyA,
  )
  assert.equal(facultyPeople.status, 200)
  assert.deepEqual(facultyPeople.body.students.map((student) => student.id), [
    users.studentA.id,
  ])
  const studentPeople = await request(
    `/api/learning/classes/${classes.a}/people`,
    users.studentA,
  )
  assert.equal(studentPeople.status, 200)
  assert.equal(studentPeople.body.teacher.name, users.facultyA.name)
  assert.equal(studentPeople.body.students.length, 1)
  assert.equal(
    (
      await request(`/api/learning/classes/${classes.a}/people`, users.studentB)
    ).status,
    404,
  )

  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.a}/announcements/${announcementId}`,
        users.facultyB,
        { method: 'DELETE' },
      )
    ).status,
    404,
  )
  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.a}/announcements/${announcementId}`,
        users.facultyA,
        { method: 'DELETE' },
      )
    ).status,
    200,
  )
})

test('students can only answer teacher quizzes and never receive answer keys', async () => {
  const dashboard = await request('/api/student/dashboard', users.studentA)
  const quiz = dashboard.body.quizzes.find((item) => item.id === 'quiz-a-published')
  assert.equal(quiz.questionList.length, 4)
  for (const question of quiz.questionList) {
    assert.equal(Object.hasOwn(question, 'answer'), false)
    assert.equal(Object.hasOwn(question, 'correctAnswers'), false)
  }

  const directQuiz = await request(
    '/api/learning/quizzes/quiz-a-published',
    users.studentA,
  )
  const directQuestions = JSON.parse(directQuiz.body.quiz.questions_json)
  for (const question of directQuestions) {
    assert.equal(Object.hasOwn(question, 'answer'), false)
    assert.equal(Object.hasOwn(question, 'correctAnswers'), false)
  }

  const createAttempt = await request('/api/learning/quizzes', users.studentA, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Student-created quiz',
      classId: classes.a,
      questionList: [],
    }),
  })
  assert.equal(createAttempt.status, 403)

  const submission = await request(
    '/api/learning/quizzes/quiz-a-published/attempts',
    users.studentA,
    {
      method: 'POST',
      body: JSON.stringify({
        answers: {
          choice: 1,
          multiple: [2, 0],
          short: 'aLpHa',
          dropdown: '0',
        },
      }),
    },
  )
  assert.equal(submission.status, 201)
  assert.equal(submission.body.attempt.quiz_id, 'quiz-a-published')
  assert.equal(submission.body.attempt.student_id, users.studentA.id)

  const studentDashboardAfterAttempt = await request(
    '/api/student/dashboard',
    users.studentA,
  )
  const studentQuizAfterAttempt = studentDashboardAfterAttempt.body.quizzes.find(
    (item) => item.id === 'quiz-a-published',
  )
  assert.equal(studentQuizAfterAttempt.attemptsUsed, 1)
  assert.equal(studentQuizAfterAttempt.bestScore, null)
  assert.equal(studentDashboardAfterAttempt.body.attempts.length, 1)
  assert.equal(
    studentDashboardAfterAttempt.body.attempts[0].quizId,
    'quiz-a-published',
  )
  assert.equal(studentDashboardAfterAttempt.body.attempts[0].passed, false)

  const facultyScores = await request(
    `/api/faculty/classes/${classes.a}/quiz-attempts`,
    users.facultyA,
  )
  assert.equal(facultyScores.status, 200)
  assert.equal(facultyScores.body.attempts.length, 1)
  assert.equal(facultyScores.body.attempts[0].studentId, users.studentA.id)
  assert.equal(
    (
      await request(
        `/api/faculty/classes/${classes.b}/quiz-attempts`,
        users.facultyA,
      )
    ).status,
    404,
  )
  assert.equal(
    (
      await request(
        `/api/faculty/classes/${classes.a}/quiz-attempts`,
        users.studentA,
      )
    ).status,
    403,
  )

  const secondAttempt = await request(
    '/api/learning/quizzes/quiz-a-published/attempts',
    users.studentA,
    {
      method: 'POST',
      body: JSON.stringify({ answers: { choice: 0, multiple: [], short: '', dropdown: '1' } }),
    },
  )
  assert.equal(secondAttempt.status, 409)
  assert.equal(
    secondAttempt.body.message,
    'You already attempted this quiz.',
  )

  assert.equal(
    (
      await request('/api/learning/quizzes/quiz-a-published/attempts', users.studentB, {
        method: 'POST',
        body: JSON.stringify({ answers: {} }),
      })
    ).status,
    403,
  )
  assert.equal(
    (
      await request('/api/learning/quizzes/quiz-a-published/attempts', null, {
        method: 'POST',
        body: JSON.stringify({ answers: {} }),
      })
    ).status,
    401,
  )
})

test('lesson-file uploads and downloads require class ownership or active enrollment', async () => {
  const formData = new FormData()
  formData.append(
    'file',
    new Blob([Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x61])], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }),
    'lesson-deck.pptx',
  )

  const upload = await request(
    '/api/learning/slides/slide-a-published/presentation',
    users.facultyA,
    { method: 'POST', body: formData },
  )
  assert.equal(upload.status, 201)
  assert.equal(upload.body.presentation.fileName, 'lesson-deck.pptx')

  const studentToken = tokenFor(users.studentA)
  const studentDownload = await fetch(
    `${origin}/api/learning/slides/slide-a-published/presentation`,
    { headers: { Authorization: 'Bearer ' + studentToken } },
  )
  assert.equal(studentDownload.status, 200)
  assert.deepEqual(
    [...new Uint8Array(await studentDownload.arrayBuffer())],
    [0x50, 0x4b, 0x03, 0x04, 0x61],
  )

  const otherStudentDownload = await fetch(
    `${origin}/api/learning/slides/slide-a-published/presentation`,
    { headers: { Authorization: 'Bearer ' + tokenFor(users.studentB) } },
  )
  assert.equal(otherStudentDownload.status, 403)

  const unauthorizedUpload = await request(
    '/api/learning/slides/slide-a-published/presentation',
    users.studentA,
    { method: 'POST', body: formData },
  )
  assert.equal(unauthorizedUpload.status, 403)
})

test('faculty can attach files and enrolled students can download published lesson content', async () => {
  await database.collection('slides').updateMany(
    { id: { $in: ['slide-a-document', 'slide-a-pdf'] } },
    { $set: { status: 'Published' } },
  )
  const documentBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x61])
  const documentForm = new FormData()
  documentForm.append(
    'file',
    new Blob([documentBytes], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
    'lesson-notes.docx',
  )
  const documentUpload = await request(
    '/api/learning/slides/slide-a-document/presentation',
    users.facultyA,
    { method: 'POST', body: documentForm },
  )
  assert.equal(documentUpload.status, 201)
  assert.equal(documentUpload.body.presentation.fileName, 'lesson-notes.docx')
  assert.equal(
    documentUpload.body.presentation.mimeType,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
  const sharedDocumentLesson = await request(
    '/api/learning/slides/slide-a-document',
    users.studentA,
  )
  assert.equal(sharedDocumentLesson.status, 200)
  assert.equal(
    sharedDocumentLesson.body.presentation.fileName,
    'lesson-notes.docx',
  )

  const documentDownload = await fetch(
    `${origin}/api/learning/slides/slide-a-document/presentation`,
    { headers: { Authorization: `Bearer ${tokenFor(users.studentA)}` } },
  )
  assert.equal(documentDownload.status, 200)
  assert.match(
    documentDownload.headers.get('content-disposition'),
    /attachment;.*lesson-notes\.docx/,
  )
  assert.deepEqual(
    [...new Uint8Array(await documentDownload.arrayBuffer())],
    [...documentBytes],
  )
  const unsupportedPreview = await fetch(
    `${origin}/api/learning/slides/slide-a-document/presentation?preview=1`,
    { headers: { Authorization: `Bearer ${tokenFor(users.studentA)}` } },
  )
  assert.equal(unsupportedPreview.status, 200)
  assert.equal(
    unsupportedPreview.headers.get('content-type'),
    'application/octet-stream',
  )
  assert.match(unsupportedPreview.headers.get('content-disposition'), /^attachment;/)
  assert.deepEqual(
    [...new Uint8Array(await unsupportedPreview.arrayBuffer())],
    [...documentBytes],
  )

  const pdfBytes = Buffer.from('%PDF-1.7\nLesson preview')
  const pdfForm = new FormData()
  pdfForm.append(
    'file',
    new Blob([pdfBytes], { type: 'application/pdf' }),
    'lesson-handout.pdf',
  )
  const pdfUpload = await request(
    '/api/learning/slides/slide-a-pdf/presentation',
    users.facultyA,
    { method: 'POST', body: pdfForm },
  )
  assert.equal(pdfUpload.status, 201)
  assert.equal(pdfUpload.body.presentation.mimeType, 'application/pdf')
  const pdfPreview = await fetch(
    `${origin}/api/learning/slides/slide-a-pdf/presentation?preview=1`,
    { headers: { Authorization: `Bearer ${tokenFor(users.studentA)}` } },
  )
  assert.equal(pdfPreview.status, 200)
  assert.equal(
    pdfPreview.headers.get('content-type'),
    'application/octet-stream',
  )
  assert.match(
    pdfPreview.headers.get('content-disposition'),
    /attachment;.*lesson-handout\.pdf/,
  )
  assert.deepEqual(
    [...new Uint8Array(await pdfPreview.arrayBuffer())],
    [...pdfBytes],
  )
  await database.collection('slides').updateMany(
    { id: { $in: ['slide-a-document', 'slide-a-pdf'] } },
    { $set: { status: 'Draft' } },
  )
})

test('student cannot access unenrolled classes or their content by direct API', async () => {
  assert.equal(
    (await request(`/api/learning/classes/${classes.b}`, users.studentA)).status,
    404,
  )
  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.inactive}`,
        users.studentA,
      )
    ).status,
    404,
  )
  assert.equal(
    (await request('/api/learning/quizzes/quiz-b-published', users.studentA)).status,
    403,
  )
  assert.equal(
    (await request('/api/learning/slides/slide-b-published', users.studentA)).status,
    403,
  )
  assert.equal(
    (await request('/api/learning/quizzes/quiz-a-draft', users.studentA)).status,
    404,
  )
  assert.equal(
    (await request('/api/learning/slides/slide-a-draft', users.studentA)).status,
    404,
  )
})

test('enrollment uses the authenticated student and does not trust submitted identities', async () => {
  const response = await request('/api/student/enrollments', users.unassigned, {
    method: 'POST',
    body: JSON.stringify({
      classCode: 'JOIN-A',
      studentId: users.studentB.id,
      facultyId: users.facultyB.id,
    }),
  })
  assert.equal(response.status, 201)
  const enrollment = await database.collection('enrollments').findOne({
    class_id: classes.a,
    student_id: users.unassigned.id,
  })
  assert.equal(enrollment.student_id, users.unassigned.id)
})

test('student can join using the faculty-visible class code case-insensitively or a unique subject code', async () => {
  const classCodeJoin = await request('/api/student/enrollments', users.studentB, {
    method: 'POST',
    body: JSON.stringify({ joinCode: 'a1b2c3d4' }),
  })
  assert.equal(classCodeJoin.status, 201)
  assert.equal(classCodeJoin.body.class.id, classes.a)
  assert.equal(classCodeJoin.body.class.joinCode, 'A1B2C3D4')

  const invalidJoinCode = await request(
    '/api/student/enrollments',
    users.unassigned,
    {
      method: 'POST',
      body: JSON.stringify({ joinCode: 'INVALID1' }),
    },
  )
  assert.equal(invalidJoinCode.status, 404)

  const subjectCodeJoin = await request(
    '/api/student/enrollments',
    users.unassigned,
    {
      method: 'POST',
      body: JSON.stringify({ classCode: 'sci-a' }),
    },
  )
  assert.equal(subjectCodeJoin.status, 201)
  assert.equal(subjectCodeJoin.body.class.id, classes.a)

  const roster = await request(
    `/api/faculty/classes/${classes.a}/students`,
    users.facultyA,
  )
  assert.equal(roster.status, 200)
  assert.deepEqual(
    roster.body.students.map((student) => student.id).sort(),
    [users.studentA.id, users.studentB.id, users.unassigned.id].sort(),
  )
})

test('role guards reject unauthenticated and wrong-role requests', async () => {
  assert.equal((await request('/api/faculty/dashboard')).status, 401)
  assert.equal((await request('/api/student/dashboard')).status, 401)
  assert.equal((await request('/api/faculty/dashboard', users.studentA)).status, 403)
  assert.equal((await request('/api/student/dashboard', users.facultyA)).status, 403)
})

test('search and notifications never return global class, quiz, or student data', async () => {
  const facultySearch = await request('/api/search?q=Student', users.facultyA)
  assert.equal(facultySearch.status, 200)
  assert.deepEqual(
    facultySearch.body.results.map((result) => result.id).sort(),
    [users.studentA.id, users.studentB.id, users.unassigned.id].sort(),
  )
  const studentSearch = await request('/api/search?q=Faculty B', users.studentA)
  assert.equal(studentSearch.status, 200)
  assert.deepEqual(studentSearch.body.results, [])
  const privateQuizSearch = await request('/api/search?q=Private Quiz', users.studentA)
  assert.equal(privateQuizSearch.status, 200)
  assert.deepEqual(privateQuizSearch.body.results, [])

  const facultyNotifications = await request('/api/notifications', users.facultyA)
  assert.equal(facultyNotifications.status, 200)
  assert.doesNotMatch(JSON.stringify(facultyNotifications.body), /Faculty B activity/)
  const studentNotifications = await request('/api/notifications', users.studentA)
  assert.equal(studentNotifications.status, 200)
  assert.doesNotMatch(JSON.stringify(studentNotifications.body), /Faculty B activity/)
})

test('faculty class creation always assigns the authenticated faculty owner', async () => {
  const response = await request('/api/learning/classes', users.facultyA, {
    method: 'POST',
    body: JSON.stringify({
      class_name: 'Owned Class',
      subject: 'Computer Science',
      subject_code: 'CS-OWN',
      facultyId: users.facultyB.id,
      joinCode: 'FAKECODE',
    }),
  })
  assert.equal(response.status, 201)
  const created = await database.collection('classes').findOne({
    id: response.body.class.id,
  })
  assert.equal(created.faculty_id, users.facultyA.id)
  assert.match(created.join_code, /^[A-Z0-9]{6}$/)
  assert.equal(response.body.class.join_code, created.join_code)
  assert.notEqual(created.join_code, 'FAKECODE')
})

test('MongoDB documents retain the ownership and enrollment fields used by authorization', async () => {
  const classDocument = await database.collection('classes').findOne({
    id: classes.a,
  })
  const enrollment = await database.collection('enrollments').findOne({
    class_id: classes.a,
    student_id: users.studentA.id,
  })

  assert.equal(classDocument.faculty_id, users.facultyA.id)
  assert.equal(classDocument.join_code, 'A1B2C3D4')
  assert.equal(enrollment.status, 'Active')
})
