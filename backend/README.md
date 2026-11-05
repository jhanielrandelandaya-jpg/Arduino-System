# Backend

## Database

The backend stores application records in MongoDB. Configure the connection
with `MONGODB_URI` and the database name with `MONGODB_DB`; they default to
`mongodb://127.0.0.1:27017` and `learnspace`, respectively. MongoDB must be
available when the backend starts handling database-backed requests.

Existing SQLite files are not imported automatically. Migrate any records you
need to keep into the MongoDB collections before switching the application to
this backend.

## Role-scoped learning APIs

Authentication uses a bearer token. Role checks read the current role from the
user record; client-supplied faculty, student, and ownership identifiers are not
used to authorize requests.

- `GET /api/faculty/dashboard`: classes owned by the current faculty member,
  their slides and quizzes, and students actively enrolled in those classes.
- `GET /api/student/dashboard`: published classes with an active enrollment,
  plus only their published slides, quizzes, and classwork. Assignment status
  and pending-work counts are specific to the authenticated student.
- `POST /api/learning/classes`: creates a class owned by the authenticated
  faculty member and assigns it a random unique 8-character `join_code`.
- `POST /api/student/enrollments`: joins a published class using its unique
  `join_code`; the legacy class code and unambiguous subject codes are also
  accepted for compatibility.
- `GET /api/learning/classes/:id/announcements`: announcements for an owned
  faculty class or a published class with an active student enrollment.
- `POST /api/learning/classes/:id/announcements`: posts an announcement as the
  authenticated faculty member to a class they own.
- `DELETE /api/learning/classes/:id/announcements/:announcementId`: deletes an
  announcement only when it belongs to a class owned by the current faculty
  member.
- `POST /api/learning/classes/:id/announcements/:announcementId/comments`:
  adds a comment as an active student enrolled in the class.
- `GET /api/learning/classes/:id/people`: returns the teacher and active class
  roster, scoped to the owner or an enrolled student.
- `GET /api/learning/classes/:id/classwork`: lists work for the owned class or
  published work for an active student enrollment.
- `POST /api/learning/classes/:id/classwork`: creates an assignment, quiz, or
  material for a class owned by the authenticated faculty member.
- `PATCH` and `DELETE /api/learning/classwork/:id`: edit or remove only
  classwork in a class owned by the current faculty member.
- `POST /api/learning/classwork/:id/attachments`: adds an attachment to owned
  classwork. `GET /api/learning/classwork/:id/attachments/:fileId` is limited
  to its faculty owner or an actively enrolled student viewing published work.
- `POST /api/learning/classwork/:id/submission`: turns in text and/or a file
  for an assignment as the authenticated, actively enrolled student.
- `GET /api/learning/classwork/:id/submissions`: returns the active roster and
  submission status for an owned classwork item.
- `PATCH /api/learning/classwork/:id/submissions/:studentId`: grades or returns
  a submission only for the faculty owner of its class.
- `GET /api/learning/submissions/:id/file`: downloads a submission file for its
  class faculty owner or the student who submitted it while enrolled.
- `GET /api/faculty/classes/:id/quiz-attempts`: scores submitted by students
  actively enrolled in the faculty member's owned class.
- `POST /api/learning/quizzes/:id/attempts`: submits answers for a published
  quiz in an actively enrolled class. Student quiz reads omit answer keys;
  scoring is performed by the server.
- `POST /api/learning/slides/:id/presentation`: faculty-only upload of any file
  type for an owned lesson (maximum 25 MB).
- `GET /api/learning/slides/:id/presentation`: downloads an attached file for
  its owning faculty member or an actively enrolled student when the lesson
  and class are published. Add `?preview=1` to preview supported PDF and image
  files; other types must be downloaded and opened with a compatible app.
- `/api/learning` class, quiz, slide, and activity routes apply the same
  ownership or enrollment scope. Students cannot read draft learning content.

Uploaded lesson files, classwork attachments, and student submission files are
stored on disk under `learningData/slides/`, `learningData/classwork/`, and
`learningData/submissions/` by default. Set `LEARNING_DATA_DIR`,
`SLIDE_DATA_DIR`, `CLASSWORK_DATA_DIR`, or `SUBMISSION_DATA_DIR` to change those
locations. Each upload is limited to 25 MB.
Faculty quiz questions support multiple choice, dropdown, checkboxes, short
answer, and paragraph answers.

The learning data is stored in MongoDB collections, including `classes`,
`enrollments`, `classwork` (`assignment`, `quiz`, and `material`), and
`submissions`.

Run the tests with a development or test MongoDB server available at
`MONGODB_URI` (or at the default local address). The tests create and drop
uniquely named databases:

```sh
npm test
```
