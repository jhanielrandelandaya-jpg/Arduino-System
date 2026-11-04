const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'learnspace-auth-'))
process.env.DATABASE_PATH = path.join(temporaryDirectory, 'test.sqlite')
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
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      origin = `http://127.0.0.1:${server.address().port}`
      resolve()
    })
  })

  const insertUser = db.prepare(`
    INSERT INTO users (id, full_name, username, password_hash, role)
    VALUES (?, ?, ?, 'not-used', ?)
  `)
  Object.values(users).forEach((user) =>
    insertUser.run(user.id, user.name, `${user.id}@example.test`, user.role),
  )

  const insertClass = db.prepare(`
    INSERT INTO classes
      (id, class_name, subject, subject_code, class_code, join_code, status, faculty_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertClass.run(classes.a, 'Faculty A Class', 'Science', 'SCI-A', 'JOIN-A', 'A1B2C3D4', 'Published', users.facultyA.id)
  insertClass.run(classes.b, 'Faculty B Class', 'History', 'HIS-B', 'JOIN-B', 'B1C2D3E4', 'Published', users.facultyB.id)
  insertClass.run(classes.inactive, 'Inactive Enrollment Class', 'Science', 'SCI-I', 'JOIN-I', 'I1N2A3C4', 'Published', users.facultyA.id)

  db.prepare(`
    INSERT INTO enrollments (id, student_id, class_id, status)
    VALUES (?, ?, ?, ?)
  `).run('enrollment-a', users.studentA.id, classes.a, 'Active')
  db.prepare(`
    INSERT INTO enrollments (id, student_id, class_id, status)
    VALUES (?, ?, ?, ?)
  `).run('enrollment-b', users.studentB.id, classes.b, 'Active')
  db.prepare(`
    INSERT INTO enrollments (id, student_id, class_id, status)
    VALUES (?, ?, ?, ?)
  `).run('enrollment-inactive', users.studentA.id, classes.inactive, 'Inactive')

  const insertQuiz = db.prepare(`
    INSERT INTO quizzes (id, quiz_title, class_id, subject_code, status, questions_json)
    VALUES (?, ?, ?, ?, ?, '[]')
  `)
  insertQuiz.run('quiz-a-published', 'A Published Quiz', classes.a, 'SCI-A', 'Published')
  insertQuiz.run('quiz-a-draft', 'A Draft Quiz', classes.a, 'SCI-A', 'Draft')
  insertQuiz.run('quiz-b-published', 'B Private Quiz', classes.b, 'HIS-B', 'Published')
  db.prepare('UPDATE quizzes SET questions_json = ? WHERE id = ?').run(
    JSON.stringify([
      {
        id: 'choice',
        type: 'multiple_choice',
        prompt: 'Select the correct choice',
        options: ['Wrong', 'Right'],
        answer: 1,
      },
      {
        id: 'multiple',
        type: 'checkboxes',
        prompt: 'Select both correct choices',
        options: ['First', 'Second', 'Third'],
        answer: [0, 2],
      },
      {
        id: 'short',
        type: 'short_answer',
        prompt: 'Enter the answer',
        answer: 'Alpha',
      },
      {
        id: 'dropdown',
        type: 'dropdown',
        prompt: 'Choose the answer',
        options: ['Correct', 'Incorrect'],
        answer: 0,
      },
    ]),
    'quiz-a-published',
  )

  const insertSlide = db.prepare(`
    INSERT INTO slides (id, class_id, title, content_json, status)
    VALUES (?, ?, ?, '[]', ?)
  `)
  insertSlide.run('slide-a-published', classes.a, 'A Published Slides', 'Published')
  insertSlide.run('slide-a-draft', classes.a, 'A Draft Slides', 'Draft')
  insertSlide.run('slide-b-published', classes.b, 'B Private Slides', 'Published')
  insertSlide.run('slide-a-document', classes.a, 'A Document Lesson', 'Draft')
  insertSlide.run('slide-a-pdf', classes.a, 'A PDF Lesson', 'Draft')

  const insertClasswork = db.prepare(`
    INSERT INTO classwork
      (id, class_id, type, title, instructions, due_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  insertClasswork.run(
    'classwork-a-assignment',
    classes.a,
    'assignment',
    'A Assignment',
    'Complete this work.',
    '2099-12-31T23:59:00Z',
    'Published',
  )
  insertClasswork.run(
    'classwork-a-quiz',
    classes.a,
    'quiz',
    'A Classwork Quiz',
    'Complete the linked quiz.',
    null,
    'Published',
  )
  insertClasswork.run(
    'classwork-a-draft',
    classes.a,
    'material',
    'A Draft Material',
    'Not published.',
    null,
    'Draft',
  )
  insertClasswork.run(
    'classwork-b-assignment',
    classes.b,
    'assignment',
    'B Private Assignment',
    'Private class work.',
    '2099-12-31T23:59:00Z',
    'Published',
  )

  db.prepare(`
    INSERT INTO submissions (id, classwork_id, student_id, status)
    VALUES ('submission-a-assignment', 'classwork-a-assignment', ?, 'assigned')
  `).run(users.studentA.id)

  db.prepare(`
    INSERT INTO class_announcements (id, class_id, author_id, message)
    VALUES ('announcement-a', ?, ?, 'Faculty A update'),
           ('announcement-b', ?, ?, 'Faculty B private update')
  `).run(classes.a, users.facultyA.id, classes.b, users.facultyB.id)

  db.prepare(`
    INSERT INTO activity_logs
      (id, action, entity_type, entity_id, message, actor_id, class_id)
    VALUES ('activity-a', 'class.created', 'class', ?, 'Faculty A activity', ?, ?),
           ('activity-b', 'class.created', 'class', ?, 'Faculty B activity', ?, ?)
  `).run(classes.a, users.facultyA.id, classes.a, classes.b, users.facultyB.id, classes.b)
})

test.after(() => {
  if (server) server.close()
  db.close()
  for (const suffix of ['', '-shm', '-wal']) {
    const file = `${process.env.DATABASE_PATH}${suffix}`
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }
  fs.rmSync(path.join(temporaryDirectory, 'presentations'), {
    recursive: true,
    force: true,
  })
  fs.rmSync(path.join(temporaryDirectory, 'classwork-files'), {
    recursive: true,
    force: true,
  })
  fs.rmSync(path.join(temporaryDirectory, 'submission-files'), {
    recursive: true,
    force: true,
  })
  fs.rmdirSync(temporaryDirectory)
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
    [
      'classwork-a-assignment',
      'classwork-a-draft',
      'classwork-a-quiz',
    ].sort(),
  )
  assert.doesNotMatch(
    JSON.stringify(dashboard.body.classwork),
    /classwork-b|B Private Assignment/,
  )
  assert.deepEqual(dashboard.body.students.map((item) => item.id), [users.studentA.id])

  for (const endpoint of [
    '/api/learning/bootstrap',
    '/api/learning/classes',
    '/api/learning/quizzes',
    '/api/learning/slides',
    '/api/learning/activity',
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
    404,
  )
  assert.equal(
    (await request('/api/learning/slides/slide-b-published', users.facultyA)).status,
    404,
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
    404,
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
    404,
  )
})

test('class announcements are available only to the class owner and active students', async () => {
  const facultyAnnouncements = await request(
    `/api/learning/classes/${classes.a}/announcements`,
    users.facultyA,
  )
  assert.equal(facultyAnnouncements.status, 200)
  assert.deepEqual(
    facultyAnnouncements.body.announcements.map((item) => item.message),
    ['Faculty A update'],
  )

  const studentAnnouncements = await request(
    `/api/learning/classes/${classes.a}/announcements`,
    users.studentA,
  )
  assert.equal(studentAnnouncements.status, 200)
  assert.deepEqual(
    studentAnnouncements.body.announcements.map((item) => item.message),
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
          body: JSON.stringify({ message: 'Cross-class announcement' }),
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
          body: JSON.stringify({ message: 'Student announcement' }),
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
        message: '  New class update  ',
        classId: classes.b,
        authorId: users.facultyB.id,
      }),
    },
  )
  assert.equal(created.status, 201)
  assert.equal(created.body.announcement.message, 'New class update')
  assert.equal(created.body.announcement.authorName, users.facultyA.name)
  const studentView = await request(
    `/api/learning/classes/${classes.a}/announcements`,
    users.studentA,
  )
  assert.deepEqual(
    studentView.body.announcements.map((item) => item.message).sort(),
    ['Faculty A update', 'New class update'].sort(),
  )

  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.a}/announcements`,
        users.facultyA,
        {
          method: 'POST',
          body: JSON.stringify({ message: ' ' }),
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
    '/api/learning/classes',
    '/api/learning/quizzes',
    '/api/learning/slides',
    '/api/learning/activity',
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
    [
      'classwork-a-assignment',
      'classwork-a-draft',
      'classwork-a-quiz',
    ].sort(),
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
  const blockedFile = await fetch(
    `${origin}/api/learning/classwork/${classworkId}/attachments/${attachment.body.attachment.fileId}`,
    { headers: { Authorization: 'Be' + 'arer ' + tokenFor(users.studentB) } },
  )
  assert.equal(blockedFile.status, 404)

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
  assert.equal(turnedIn.body.submission.text, 'My assignment response')

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
      body: JSON.stringify({ message: 'Discussion thread' }),
    },
  )
  assert.equal(announcement.status, 201)
  const announcementId = announcement.body.announcement.id

  const comment = await request(
    `/api/learning/classes/${classes.a}/announcements/${announcementId}/comments`,
    users.studentA,
    {
      method: 'POST',
      body: JSON.stringify({ message: 'Student comment' }),
    },
  )
  assert.equal(comment.status, 201)
  const stream = await request(
    `/api/learning/classes/${classes.a}/announcements`,
    users.facultyA,
  )
  const thread = stream.body.announcements.find((item) => item.id === announcementId)
  assert.equal(thread.comments[0].message, 'Student comment')
  assert.equal(thread.comments[0].authorName, users.studentA.name)

  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.a}/announcements/${announcementId}/comments`,
        users.studentB,
        { method: 'POST', body: JSON.stringify({ message: 'Out of class' }) },
      )
    ).status,
    404,
  )
  assert.equal(
    (
      await request(
        `/api/learning/classes/${classes.a}/announcements/${announcementId}/comments`,
        users.facultyA,
        { method: 'POST', body: JSON.stringify({ message: 'Wrong role' }) },
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
  assert.equal(studentPeople.body.students.length, 0)
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
  assert.equal(Object.hasOwn(directQuiz.body.quiz.questionList[0], 'answer'), false)

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
  assert.deepEqual(
    {
      score: submission.body.score,
      passed: submission.body.passed,
      correctCount: submission.body.correctCount,
      questionCount: submission.body.questionCount,
      attemptsUsed: submission.body.attemptsUsed,
    },
    {
      score: 100,
      passed: true,
      correctCount: 4,
      questionCount: 4,
      attemptsUsed: 1,
    },
  )

  const studentDashboardAfterAttempt = await request(
    '/api/student/dashboard',
    users.studentA,
  )
  const studentQuizAfterAttempt = studentDashboardAfterAttempt.body.quizzes.find(
    (item) => item.id === 'quiz-a-published',
  )
  assert.equal(studentQuizAfterAttempt.attemptsUsed, 1)
  assert.equal(studentQuizAfterAttempt.bestScore, 100)

  const facultyScores = await request(
    `/api/faculty/classes/${classes.a}/quiz-attempts`,
    users.facultyA,
  )
  assert.equal(facultyScores.status, 200)
  assert.equal(facultyScores.body.attempts.length, 1)
  assert.equal(facultyScores.body.attempts[0].studentId, users.studentA.id)
  assert.equal(facultyScores.body.attempts[0].score, 100)
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
  assert.equal(secondAttempt.status, 201)
  assert.equal(secondAttempt.body.attemptsUsed, 2)
  const exhaustedAttempt = await request(
    '/api/learning/quizzes/quiz-a-published/attempts',
    users.studentA,
    {
      method: 'POST',
      body: JSON.stringify({ answers: {} }),
    },
  )
  assert.equal(exhaustedAttempt.status, 409)

  assert.equal(
    (
      await request('/api/learning/quizzes/quiz-a-published/attempts', users.studentB, {
        method: 'POST',
        body: JSON.stringify({ answers: {} }),
      })
    ).status,
    404,
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
    'presentation',
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
  assert.equal(otherStudentDownload.status, 404)

  const unauthorizedUpload = await request(
    '/api/learning/slides/slide-a-published/presentation',
    users.studentA,
    { method: 'POST', body: formData },
  )
  assert.equal(unauthorizedUpload.status, 403)
})

test('faculty can attach any file type and students can download or preview supported files', async () => {
  db.prepare("UPDATE slides SET status = 'Published' WHERE id IN (?, ?)")
    .run('slide-a-document', 'slide-a-pdf')
  const documentBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x61])
  const documentForm = new FormData()
  documentForm.append(
    'presentation',
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
  assert.equal(documentUpload.body.presentation.previewable, false)
  const studentDashboard = await request(
    '/api/student/dashboard',
    users.studentA,
  )
  const sharedDocumentLesson = studentDashboard.body.slides.find(
    (slide) => slide.id === 'slide-a-document',
  )
  assert.equal(
    sharedDocumentLesson.content[0].presentation.fileName,
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
  assert.equal(unsupportedPreview.status, 415)

  const pdfBytes = Buffer.from('%PDF-1.7\nLesson preview')
  const pdfForm = new FormData()
  pdfForm.append(
    'presentation',
    new Blob([pdfBytes], { type: 'application/pdf' }),
    'lesson-handout.pdf',
  )
  const pdfUpload = await request(
    '/api/learning/slides/slide-a-pdf/presentation',
    users.facultyA,
    { method: 'POST', body: pdfForm },
  )
  assert.equal(pdfUpload.status, 201)
  assert.equal(pdfUpload.body.presentation.previewable, true)
  const pdfPreview = await fetch(
    `${origin}/api/learning/slides/slide-a-pdf/presentation?preview=1`,
    { headers: { Authorization: `Bearer ${tokenFor(users.studentA)}` } },
  )
  assert.equal(pdfPreview.status, 200)
  assert.equal(pdfPreview.headers.get('content-type'), 'application/pdf')
  assert.match(
    pdfPreview.headers.get('content-disposition'),
    /inline;.*lesson-handout\.pdf/,
  )
  assert.deepEqual(
    [...new Uint8Array(await pdfPreview.arrayBuffer())],
    [...pdfBytes],
  )
  db.prepare("UPDATE slides SET status = 'Draft' WHERE id IN (?, ?)")
    .run('slide-a-document', 'slide-a-pdf')
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
    404,
  )
  assert.equal(
    (await request('/api/learning/slides/slide-b-published', users.studentA)).status,
    404,
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
  const enrollment = db
    .prepare('SELECT student_id FROM enrollments WHERE class_id = ? AND student_id = ?')
    .get(classes.a, users.unassigned.id)
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
      className: 'Owned Class',
      subject: 'Computer Science',
      subjectCode: 'CS-OWN',
      facultyId: users.facultyB.id,
      joinCode: 'FAKECODE',
    }),
  })
  assert.equal(response.status, 201)
  const created = db.prepare('SELECT faculty_id, join_code FROM classes WHERE id = ?')
    .get(response.body.class.id)
  assert.equal(created.faculty_id, users.facultyA.id)
  assert.match(created.join_code, /^[A-Z0-9]{8}$/)
  assert.equal(response.body.class.joinCode, created.join_code)
  assert.notEqual(created.join_code, 'FAKECODE')
})

test('required ownership and enrollment indexes are present', () => {
  const indexes = new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all()
      .map((index) => index.name),
  )
  assert.ok(indexes.has('idx_classes_faculty'))
  assert.ok(indexes.has('idx_classes_join_code'))
  assert.ok(indexes.has('idx_enrollments_student'))
  assert.ok(indexes.has('idx_enrollments_class'))
  assert.ok(indexes.has('idx_quiz_attempts_quiz'))
  assert.ok(indexes.has('idx_quiz_attempts_student'))
  assert.ok(indexes.has('idx_class_announcements_class_created'))
  assert.ok(indexes.has('idx_classwork_class_status_due'))
  assert.ok(indexes.has('idx_submissions_student_status'))
  assert.ok(indexes.has('idx_submissions_classwork_status'))
  assert.ok(
    db
      .prepare('PRAGMA index_list(classes)')
      .all()
      .some((index) => index.name === 'idx_classes_join_code' && index.unique),
  )
  assert.ok(
    db
      .prepare('PRAGMA index_list(submissions)')
      .all()
      .some((index) => index.unique),
  )
  assert.ok(
    db
      .prepare('PRAGMA index_list(enrollments)')
      .all()
      .some((index) => index.unique),
  )
})
