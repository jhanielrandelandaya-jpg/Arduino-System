export const studentSubjects = [
  {
    id: 'cs-101',
    code: 'CS 101',
    name: 'Introduction to Computing',
    term: 'First Semester',
    academicYear: '2026–2027',
    instructor: 'Prof. Elena Reyes',
    schedule: 'Mon & Wed · 9:00 AM',
    progress: 82,
    lessons: 12,
    completed: 10,
    accent: 'blue',
    description:
      'Core computing concepts, number systems, and structured problem solving.',
  },
  {
    id: 'math-201',
    code: 'MATH 201',
    name: 'Discrete Mathematics',
    term: 'First Semester',
    academicYear: '2026–2027',
    instructor: 'Prof. Marco Villanueva',
    schedule: 'Tue & Thu · 10:30 AM',
    progress: 64,
    lessons: 16,
    completed: 10,
    accent: 'violet',
    description:
      'Logic, sets, relations, counting techniques, and the foundations of graph theory.',
  },
  {
    id: 'it-210',
    code: 'IT 210',
    name: 'Web Systems & Technologies',
    term: 'First Semester',
    academicYear: '2026–2027',
    instructor: 'Prof. Ana Santos',
    schedule: 'Mon & Fri · 1:00 PM',
    progress: 48,
    lessons: 12,
    completed: 6,
    accent: 'teal',
    description:
      'Modern web architecture, responsive interfaces, and secure client-server systems.',
  },
  {
    id: 'eng-105',
    code: 'ENG 105',
    name: 'Technical Communication',
    term: 'Second Semester',
    academicYear: '2025–2026',
    instructor: 'Prof. Rina Dela Cruz',
    schedule: 'Wed · 2:00 PM',
    progress: 100,
    lessons: 8,
    completed: 8,
    accent: 'amber',
    description:
      'Clear, professional written and oral communication for technical fields.',
  },
]

export const studentLessons = [
  {
    id: 'cs-1',
    subjectId: 'cs-101',
    subjectCode: 'CS 101',
    title: 'Foundations of Computing',
    summary:
      'How computers turn instructions into results, and why computational thinking matters.',
    duration: '18 min',
    status: 'completed',
    quizRequired: true,
    quizPassed: true,
    content: `Computing is the study of how information can be represented, processed, and communicated by machines. At its heart, a computer follows a simple loop: it receives input, processes that input according to instructions, and produces output.

A computer system is made up of hardware and software. Hardware includes the physical components such as the processor, memory, storage, and input/output devices. Software is the set of programs and instructions that tell the hardware what to do.

Computational thinking gives us a way to approach complex problems. It involves decomposition, pattern recognition, abstraction, and algorithm design. These skills are useful far beyond programming: they help us plan projects, organize information, and make decisions systematically.

In this course, you will build a strong foundation in these ideas before moving on to algorithms, data representation, and practical programming.`,
    presentation: {
      name: '01-foundations-of-computing.pptx',
      size: '2.4 MB',
      slides: 18,
    },
  },
  {
    id: 'cs-2',
    subjectId: 'cs-101',
    subjectCode: 'CS 101',
    title: 'Number Systems & Data Representation',
    summary:
      'Binary, hexadecimal, and how different data types are represented in memory.',
    duration: '22 min',
    status: 'completed',
    quizRequired: true,
    quizPassed: true,
    content: `Computers use the binary number system because digital circuits have two reliable states: on and off. Binary uses only the digits 0 and 1, but it can represent any number that the decimal system can.

Hexadecimal is a compact way to write binary values. Each hexadecimal digit corresponds to four binary bits, which makes it useful for memory addresses, colors, and machine-level debugging.

Data representation goes beyond numbers. Text is encoded using standards such as ASCII and Unicode. Images are stored as grids of pixels, and audio is stored as a sequence of samples. Understanding these representations helps you reason about storage, precision, and performance.`,
    presentation: {
      name: '02-number-systems.pptx',
      size: '3.1 MB',
      slides: 24,
    },
  },
  {
    id: 'cs-3',
    subjectId: 'cs-101',
    subjectCode: 'CS 101',
    title: 'Operating Systems Essentials',
    summary:
      'Processes, memory, file systems, and the role of the operating system.',
    duration: '20 min',
    status: 'current',
    quizRequired: true,
    quizPassed: false,
    content: `An operating system is the software layer that manages a computer's hardware and provides services to applications. It schedules processes, allocates memory, manages files, and handles input and output.

A process is a program in execution. The operating system gives each process the illusion of having its own processor and memory, while sharing the real hardware efficiently and safely.

Modern operating systems also provide security boundaries, user accounts, and device drivers. When you open an application, the operating system loads it into memory, creates a process, and hands control to it.`,
    presentation: {
      name: '03-operating-systems.pptx',
      size: '2.8 MB',
      slides: 21,
    },
  },
  {
    id: 'cs-4',
    subjectId: 'cs-101',
    subjectCode: 'CS 101',
    title: 'Introduction to Algorithms',
    summary:
      'Step-by-step problem solving, algorithm properties, and everyday examples.',
    duration: '25 min',
    status: 'locked',
    quizRequired: true,
    quizPassed: false,
    content: `An algorithm is a finite sequence of clear steps that solves a problem. A good algorithm is correct, efficient, and easy to understand. Algorithms are not tied to a programming language; they describe the logic of a solution.

We measure algorithms by their time complexity and space complexity. Big-O notation describes how running time grows as the input size grows, which helps us compare solutions without depending on a particular computer.

This lesson introduces searching, sorting, and simple problem-solving strategies. You will practice writing algorithms in plain language before translating them into code.`,
    presentation: {
      name: '04-introduction-to-algorithms.pptx',
      size: '3.6 MB',
      slides: 27,
    },
  },
  {
    id: 'math-1',
    subjectId: 'math-201',
    subjectCode: 'MATH 201',
    title: 'Logic and Propositions',
    summary:
      'Truth values, logical connectives, and constructing valid arguments.',
    duration: '24 min',
    status: 'completed',
    quizRequired: true,
    quizPassed: true,
    content: `A proposition is a statement that is either true or false, but not both. Logical connectives such as and, or, not, implies, and if and only if allow us to build compound propositions from simpler ones.

Truth tables give us a systematic way to evaluate compound statements. They are especially useful for checking whether two expressions are logically equivalent or whether an argument is valid.

Proof techniques such as direct proof, contradiction, and mathematical induction build on these foundations. Logic is the language of mathematics and computer science.`,
    presentation: {
      name: 'logic-and-propositions.pptx',
      size: '1.9 MB',
      slides: 16,
    },
  },
  {
    id: 'math-2',
    subjectId: 'math-201',
    subjectCode: 'MATH 201',
    title: 'Sets and Relations',
    summary:
      'Set operations, Cartesian products, and properties of relations.',
    duration: '21 min',
    status: 'current',
    quizRequired: true,
    quizPassed: false,
    content: `A set is a collection of distinct objects, called elements. Set operations include union, intersection, difference, and complement. These operations appear throughout mathematics, databases, and programming.

The Cartesian product of two sets contains all ordered pairs formed by taking one element from each set. A relation is any subset of a Cartesian product.

Relations can be reflexive, symmetric, transitive, or antisymmetric. These properties define equivalence relations and partial orders, which are central to many areas of computer science.`,
    presentation: {
      name: 'sets-and-relations.pptx',
      size: '2.2 MB',
      slides: 19,
    },
  },
  {
    id: 'it-1',
    subjectId: 'it-210',
    subjectCode: 'IT 210',
    title: 'How the Web Works',
    summary:
      'Clients, servers, HTTP, and the request-response lifecycle.',
    duration: '17 min',
    status: 'completed',
    quizRequired: true,
    quizPassed: true,
    content: `The web is a system of interconnected documents and applications delivered over the internet. A browser acts as a client, sending requests to servers and rendering the responses it receives.

HTTP is the protocol that defines how requests and responses are structured. Methods such as GET and POST describe the intent of a request, while status codes such as 200 and 404 describe the outcome.

Modern web applications often separate the client from the server. The client handles presentation and interaction, while the server manages data, authentication, and business rules.`,
    presentation: {
      name: 'how-the-web-works.pptx',
      size: '2.6 MB',
      slides: 20,
    },
  },
  {
    id: 'it-2',
    subjectId: 'it-210',
    subjectCode: 'IT 210',
    title: 'Responsive Interface Design',
    summary:
      'Layout systems, breakpoints, and accessible design patterns.',
    duration: '23 min',
    status: 'current',
    quizRequired: true,
    quizPassed: false,
    content: `Responsive design allows an interface to adapt to different screen sizes and input methods. Instead of designing for one fixed width, we design flexible layouts that respond to the available space.

Modern CSS provides powerful tools for responsive layouts, including flexbox, grid, and container queries. Breakpoints should be chosen based on content needs rather than specific devices.

Accessibility is part of quality. Clear contrast, readable type, keyboard navigation, and meaningful labels make an interface usable by more people in more situations.`,
    presentation: {
      name: 'responsive-interface-design.pptx',
      size: '3.3 MB',
      slides: 26,
    },
  },
  {
    id: 'it-3',
    subjectId: 'it-210',
    subjectCode: 'IT 210',
    title: 'Client-Server Architecture',
    summary:
      'APIs, authentication boundaries, and secure data flow.',
    duration: '26 min',
    status: 'locked',
    quizRequired: true,
    quizPassed: false,
    content: `Client-server architecture divides an application into two cooperating parts. The client requests services, and the server provides them. APIs define the contract between the two sides.

Authentication proves who a user is, while authorization decides what that user is allowed to do. These checks must happen on the server, not only in the interface.

Secure systems validate every request, protect sensitive data, and fail safely. This lesson connects the architecture of the web to the security decisions behind a real learning platform.`,
    presentation: {
      name: 'client-server-architecture.pptx',
      size: '2.9 MB',
      slides: 22,
    },
  },
]

export const initialStudentNotes = [
  {
    id: 'note-1',
    topicId: 'cs-2',
    title: 'Number systems — key takeaways',
    body: `• Each hexadecimal digit maps to exactly 4 binary bits.\n• Binary is used because circuits have two reliable states.\n• Unicode is essential for multilingual text.\n\nRemember: 1111 in binary is F in hexadecimal.`,
    updatedAt: '2026-10-22T14:30:00.000Z',
  },
  {
    id: 'note-2',
    topicId: 'math-1',
    title: 'Logic review before quiz',
    body: `Practice truth tables for implication. P → Q is false only when P is true and Q is false.\n\nNeed to review: contrapositive vs converse.`,
    updatedAt: '2026-10-20T08:15:00.000Z',
  },
]

export const studentQuizzes = [
  {
    id: 'quiz-1',
    title: 'Computing Foundations Check',
    subjectId: 'cs-101',
    subjectCode: 'CS 101',
    type: 'Faculty quiz',
    questions: 3,
    timeLimit: 15,
    maxScore: 100,
    passing: 75,
    attemptsAllowed: 2,
    attemptsUsed: 2,
    bestScore: 90,
    due: 'Oct 30, 2026',
    status: 'Completed',
    questionList: [
      {
        id: 'q1',
        prompt: 'Which statement best describes an algorithm?',
        options: [
          'A physical component inside a computer',
          'A finite sequence of clear steps that solves a problem',
          'A programming language',
          'A type of operating system',
        ],
        answer: 1,
      },
      {
        id: 'q2',
        prompt: 'Why do computers primarily use the binary number system?',
        options: [
          'Binary is easier for humans to read',
          'Digital circuits have two reliable states',
          'Binary uses fewer characters than decimal',
          'It is required by all programming languages',
        ],
        answer: 1,
      },
      {
        id: 'q3',
        prompt: 'What does the operating system manage?',
        options: [
          'Only the keyboard and mouse',
          'Only web pages',
          'Hardware resources and services for applications',
          'Only user passwords',
        ],
        answer: 2,
      },
    ],
  },
  {
    id: 'quiz-2',
    title: 'Number Systems Quiz',
    subjectId: 'cs-101',
    subjectCode: 'CS 101',
    type: 'Faculty quiz',
    questions: 8,
    timeLimit: 10,
    maxScore: 50,
    passing: 80,
    attemptsAllowed: 1,
    attemptsUsed: 0,
    bestScore: null,
    due: 'Nov 4, 2026',
    status: 'Available',
    questionList: [
      {
        id: 'q1',
        prompt: 'What is the decimal value of binary 1010?',
        options: ['8', '10', '12', '14'],
        answer: 1,
      },
      {
        id: 'q2',
        prompt: 'How many binary bits correspond to one hexadecimal digit?',
        options: ['2', '3', '4', '8'],
        answer: 2,
      },
      {
        id: 'q3',
        prompt: 'Which encoding supports the widest range of characters?',
        options: ['ASCII', 'Unicode', 'Morse code', 'Binary'],
        answer: 1,
      },
    ],
  },
  {
    id: 'quiz-3',
    title: 'Logic & Propositions',
    subjectId: 'math-201',
    subjectCode: 'MATH 201',
    type: 'Faculty quiz',
    questions: 12,
    timeLimit: 20,
    maxScore: 40,
    passing: 75,
    attemptsAllowed: 2,
    attemptsUsed: 1,
    bestScore: 72,
    due: 'Oct 28, 2026',
    status: 'Retake available',
    questionList: [
      {
        id: 'q1',
        prompt: 'A proposition is a statement that is…',
        options: [
          'Always true',
          'Always false',
          'Either true or false, but not both',
          'Neither true nor false',
        ],
        answer: 2,
      },
      {
        id: 'q2',
        prompt: 'P → Q is false only when…',
        options: [
          'P is true and Q is false',
          'P is false and Q is true',
          'Both are true',
          'Both are false',
        ],
        answer: 0,
      },
      {
        id: 'q3',
        prompt: 'Which connective represents “and”?',
        options: ['∨', '¬', '∧', '→'],
        answer: 2,
      },
    ],
  },
  {
    id: 'quiz-4',
    title: 'Web Basics Practice',
    subjectId: 'it-210',
    subjectCode: 'IT 210',
    type: 'Practice quiz',
    questions: 5,
    timeLimit: 8,
    maxScore: 20,
    passing: 70,
    attemptsAllowed: 99,
    attemptsUsed: 3,
    bestScore: 85,
    due: 'No deadline',
    status: 'Practice',
    questionList: [
      {
        id: 'q1',
        prompt: 'Which HTTP method is typically used to retrieve data?',
        options: ['POST', 'GET', 'DELETE', 'PATCH'],
        answer: 1,
      },
      {
        id: 'q2',
        prompt: 'What does a 404 status code mean?',
        options: [
          'The request succeeded',
          'The server encountered an error',
          'The resource was not found',
          'Authentication is required',
        ],
        answer: 2,
      },
      {
        id: 'q3',
        prompt: 'Where should authorization checks happen?',
        options: [
          'Only in the browser',
          'Only in CSS',
          'On the server',
          'In the database schema only',
        ],
        answer: 2,
      },
    ],
  },
]

export const quizResults = [
  {
    id: 'result-1',
    quiz: 'Computing Foundations Check',
    subjectCode: 'CS 101',
    date: 'Oct 22, 2026',
    score: 90,
    passing: 75,
    attempt: '2 of 2',
    status: 'Passed',
  },
  {
    id: 'result-2',
    quiz: 'Logic & Propositions',
    subjectCode: 'MATH 201',
    date: 'Oct 19, 2026',
    score: 72,
    passing: 75,
    attempt: '1 of 2',
    status: 'Retake available',
  },
  {
    id: 'result-3',
    quiz: 'Computing Foundations Check',
    subjectCode: 'CS 101',
    date: 'Oct 14, 2026',
    score: 80,
    passing: 75,
    attempt: '1 of 2',
    status: 'Passed',
  },
  {
    id: 'result-4',
    quiz: 'Web Basics Practice',
    subjectCode: 'IT 210',
    date: 'Oct 11, 2026',
    score: 85,
    passing: 70,
    attempt: 'Practice',
    status: 'Passed',
  },
  {
    id: 'result-5',
    quiz: 'Sets & Relations',
    subjectCode: 'MATH 201',
    date: 'Oct 6, 2026',
    score: 68,
    passing: 75,
    attempt: '1 of 1',
    status: 'Failed',
  },
]

export const learningProgress = [
  {
    subjectId: 'cs-101',
    title: 'Introduction to Computing',
    progress: 82,
    topics: [
      {
        id: 'cs-1',
        title: 'Foundations of Computing',
        state: 'completed',
        requirement: 'Quiz passed · 90%',
      },
      {
        id: 'cs-2',
        title: 'Number Systems & Data Representation',
        state: 'completed',
        requirement: 'Quiz passed · 86%',
      },
      {
        id: 'cs-3',
        title: 'Operating Systems Essentials',
        state: 'current',
        requirement: 'Pass the lesson quiz to unlock the next topic',
      },
      {
        id: 'cs-4',
        title: 'Introduction to Algorithms',
        state: 'locked',
        requirement: 'Complete Operating Systems Essentials first',
      },
    ],
  },
  {
    subjectId: 'math-201',
    title: 'Discrete Mathematics',
    progress: 64,
    topics: [
      {
        id: 'math-1',
        title: 'Logic and Propositions',
        state: 'completed',
        requirement: 'Quiz passed · 78%',
      },
      {
        id: 'math-2',
        title: 'Sets and Relations',
        state: 'current',
        requirement: 'Pass the lesson quiz to unlock the next topic',
      },
      {
        id: 'math-3',
        title: 'Counting Principles',
        state: 'locked',
        requirement: 'Complete Sets and Relations first',
      },
    ],
  },
  {
    subjectId: 'it-210',
    title: 'Web Systems & Technologies',
    progress: 48,
    topics: [
      {
        id: 'it-1',
        title: 'How the Web Works',
        state: 'completed',
        requirement: 'Quiz passed · 88%',
      },
      {
        id: 'it-2',
        title: 'Responsive Interface Design',
        state: 'current',
        requirement: 'Pass the lesson quiz to unlock the next topic',
      },
      {
        id: 'it-3',
        title: 'Client-Server Architecture',
        state: 'locked',
        requirement: 'Complete Responsive Interface Design first',
      },
    ],
  },
]

export const studentActivity = [
  {
    id: 'a1',
    title: 'Passed Computing Foundations Check',
    meta: 'CS 101 · Score 90%',
    time: '2 hours ago',
    tone: 'success',
  },
  {
    id: 'a2',
    title: 'Added a note in Number Systems',
    meta: 'CS 101 · Personal notes',
    time: 'Yesterday',
    tone: 'blue',
  },
  {
    id: 'a3',
    title: 'Started Responsive Interface Design',
    meta: 'IT 210 · Lesson 2 of 3',
    time: '2 days ago',
    tone: 'violet',
  },
  {
    id: 'a4',
    title: 'Received a retake recommendation',
    meta: 'MATH 201 · Score 72%, passing is 75%',
    time: '3 days ago',
    tone: 'warning',
  },
]

export const studentLiveClasses = [
  {
    id: 'live-1',
    title: 'Advanced Prototyping',
    subjectCode: 'IT 210',
    instructor: 'Prof. Ana Santos',
    day: 'Today',
    time: '10:00 AM – 11:30 AM',
    status: 'live',
  },
  {
    id: 'live-2',
    title: 'Design Systems Deep Dive',
    subjectCode: 'CS 101',
    instructor: 'Prof. Elena Reyes',
    day: 'Tomorrow',
    time: '2:00 PM – 3:00 PM',
    status: 'scheduled',
  },
  {
    id: 'live-3',
    title: 'Discrete Math Review',
    subjectCode: 'MATH 201',
    instructor: 'Prof. Marco Villanueva',
    day: 'Oct 30',
    time: '9:00 AM – 10:30 AM',
    status: 'scheduled',
  },
]

export const facultySubjects = [
  {
    id: 'cs-101',
    code: 'CS 101',
    name: 'Introduction to Computing',
    term: 'First Semester',
    academicYear: '2026–2027',
    students: 42,
    lessons: 12,
    quizzes: 4,
    average: 86,
    status: 'Published',
    accent: 'blue',
    classCode: 'CS101-V9PYR',
  },
  {
    id: 'math-201',
    code: 'MATH 201',
    name: 'Discrete Mathematics',
    term: 'First Semester',
    academicYear: '2026–2027',
    students: 38,
    lessons: 16,
    quizzes: 5,
    average: 78,
    status: 'Published',
    accent: 'violet',
    classCode: 'MATH201-K4M2X',
  },
  {
    id: 'it-210',
    code: 'IT 210',
    name: 'Web Systems & Technologies',
    term: 'First Semester',
    academicYear: '2026–2027',
    students: 35,
    lessons: 12,
    quizzes: 3,
    average: 83,
    status: 'Published',
    accent: 'teal',
    classCode: 'IT210-7QW3L',
  },
  {
    id: 'eng-105',
    code: 'ENG 105',
    name: 'Technical Communication',
    term: 'Second Semester',
    academicYear: '2025–2026',
    students: 29,
    lessons: 8,
    quizzes: 2,
    average: 90,
    status: 'Archived',
    accent: 'amber',
    classCode: 'ENG105-8ZN6P',
  },
]

export const facultyLessons = [
  {
    id: 'fl-1',
    title: 'Foundations of Computing',
    subjectId: 'cs-101',
    subjectCode: 'CS 101',
    type: 'Presentation + text',
    presentation: '01-foundations-of-computing.pptx',
    status: 'Published',
    updated: 'Oct 21, 2026',
  },
  {
    id: 'fl-2',
    title: 'Number Systems & Data Representation',
    subjectId: 'cs-101',
    subjectCode: 'CS 101',
    type: 'Presentation + text',
    presentation: '02-number-systems.pptx',
    status: 'Published',
    updated: 'Oct 18, 2026',
  },
  {
    id: 'fl-3',
    title: 'Operating Systems Essentials',
    subjectId: 'cs-101',
    subjectCode: 'CS 101',
    type: 'Text + summary',
    presentation: '',
    status: 'Draft',
    updated: 'Oct 23, 2026',
  },
  {
    id: 'fl-4',
    title: 'Logic and Propositions',
    subjectId: 'math-201',
    subjectCode: 'MATH 201',
    type: 'Presentation + text',
    presentation: 'logic-and-propositions.pptx',
    status: 'Published',
    updated: 'Oct 16, 2026',
  },
  {
    id: 'fl-5',
    title: 'Sets and Relations',
    subjectId: 'math-201',
    subjectCode: 'MATH 201',
    type: 'Text + summary',
    presentation: '',
    status: 'Published',
    updated: 'Oct 20, 2026',
  },
  {
    id: 'fl-6',
    title: 'Responsive Interface Design',
    subjectId: 'it-210',
    subjectCode: 'IT 210',
    type: 'Presentation + text',
    presentation: 'responsive-interface-design.pptx',
    status: 'Scheduled',
    updated: 'Oct 24, 2026',
  },
]

export const facultyQuizzes = [
  {
    id: 'fq-1',
    title: 'Computing Foundations Check',
    subjectId: 'cs-101',
    subjectCode: 'CS 101',
    questions: 10,
    timeLimit: 15,
    maxScore: 100,
    passing: 75,
    attempts: 38,
    average: 86,
    due: 'Oct 30, 2026',
    status: 'Published',
  },
  {
    id: 'fq-2',
    title: 'Number Systems Quiz',
    subjectId: 'cs-101',
    subjectCode: 'CS 101',
    questions: 8,
    timeLimit: 10,
    maxScore: 50,
    passing: 80,
    attempts: 24,
    average: 79,
    due: 'Nov 4, 2026',
    status: 'Published',
  },
  {
    id: 'fq-3',
    title: 'Logic & Propositions',
    subjectId: 'math-201',
    subjectCode: 'MATH 201',
    questions: 12,
    timeLimit: 20,
    maxScore: 40,
    passing: 75,
    attempts: 31,
    average: 74,
    due: 'Oct 28, 2026',
    status: 'Published',
  },
  {
    id: 'fq-4',
    title: 'Client-Server Security',
    subjectId: 'it-210',
    subjectCode: 'IT 210',
    questions: 15,
    timeLimit: 25,
    maxScore: 60,
    passing: 80,
    attempts: 0,
    average: null,
    due: 'Nov 12, 2026',
    status: 'Draft',
  },
]

export const facultyStudents = [
  {
    id: 'st-1',
    name: 'Andrea Lim',
    username: 'andrea.lim',
    subjectCode: 'CS 101',
    attempts: 8,
    average: 92,
    passed: 8,
    lastActive: '10 minutes ago',
    status: 'On track',
  },
  {
    id: 'st-2',
    name: 'Miguel Santos',
    username: 'miguel.santos',
    subjectCode: 'CS 101',
    attempts: 6,
    average: 84,
    passed: 5,
    lastActive: '1 hour ago',
    status: 'On track',
  },
  {
    id: 'st-3',
    name: 'Bea Navarro',
    username: 'bea.navarro',
    subjectCode: 'MATH 201',
    attempts: 7,
    average: 71,
    passed: 4,
    lastActive: 'Yesterday',
    status: 'Needs support',
  },
  {
    id: 'st-4',
    name: 'Carlo Mendoza',
    username: 'carlo.mendoza',
    subjectCode: 'IT 210',
    attempts: 9,
    average: 88,
    passed: 8,
    lastActive: '2 hours ago',
    status: 'On track',
  },
  {
    id: 'st-5',
    name: 'Dana Reyes',
    username: 'dana.reyes',
    subjectCode: 'MATH 201',
    attempts: 10,
    average: 94,
    passed: 10,
    lastActive: '30 minutes ago',
    status: 'Excellent',
  },
  {
    id: 'st-6',
    name: 'Eli Ramos',
    username: 'eli.ramos',
    subjectCode: 'IT 210',
    attempts: 5,
    average: 66,
    passed: 2,
    lastActive: '3 days ago',
    status: 'At risk',
  },
]

export const facultyReports = [
  {
    id: 'r1',
    surname: 'Lim',
    name: 'Andrea Lim',
    subjectCode: 'CS 101',
    score: 92,
    attempts: 8,
    passing: 75,
    status: 'Passed',
  },
  {
    id: 'r2',
    surname: 'Mendoza',
    name: 'Carlo Mendoza',
    subjectCode: 'IT 210',
    score: 88,
    attempts: 9,
    passing: 80,
    status: 'Passed',
  },
  {
    id: 'r3',
    surname: 'Navarro',
    name: 'Bea Navarro',
    subjectCode: 'MATH 201',
    score: 71,
    attempts: 7,
    passing: 75,
    status: 'Failed',
  },
  {
    id: 'r4',
    surname: 'Ramos',
    name: 'Eli Ramos',
    subjectCode: 'IT 210',
    score: 66,
    attempts: 5,
    passing: 80,
    status: 'Failed',
  },
  {
    id: 'r5',
    surname: 'Reyes',
    name: 'Dana Reyes',
    subjectCode: 'MATH 201',
    score: 94,
    attempts: 10,
    passing: 75,
    status: 'Passed',
  },
  {
    id: 'r6',
    surname: 'Santos',
    name: 'Miguel Santos',
    subjectCode: 'CS 101',
    score: 84,
    attempts: 6,
    passing: 75,
    status: 'Passed',
  },
]

export const facultyActivity = [
  {
    id: 'fa1',
    title: 'Andrea Lim submitted a quiz',
    meta: 'CS 101 · Computing Foundations Check',
    time: '12 minutes ago',
    tone: 'success',
  },
  {
    id: 'fa2',
    title: 'New note flagged for review',
    meta: 'Miguel Santos · Number Systems',
    time: '1 hour ago',
    tone: 'blue',
  },
  {
    id: 'fa3',
    title: 'Lesson published',
    meta: 'IT 210 · Responsive Interface Design',
    time: '3 hours ago',
    tone: 'violet',
  },
  {
    id: 'fa4',
    title: 'Quiz average dropped below target',
    meta: 'MATH 201 · Logic & Propositions',
    time: 'Yesterday',
    tone: 'warning',
  },
]

export const weeklyPerformance = [
  { label: 'W1', value: 72 },
  { label: 'W2', value: 78 },
  { label: 'W3', value: 74 },
  { label: 'W4', value: 83 },
  { label: 'W5', value: 86 },
  { label: 'W6', value: 89 },
]
