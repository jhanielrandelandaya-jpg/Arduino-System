import './Home.css'

const getInitials = (fullName) =>
  fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

function Home({ user, onLogout }) {
  const firstName = user.fullName.split(' ')[0]
  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="brand">
          <div className="brand-icon">L</div>
          <span>LearnSpace</span>
        </div>

        <div className="home-user">
          <div className="home-avatar" aria-hidden="true">
            {getInitials(user.fullName)}
          </div>
          <div className="home-user-text">
            <strong>{user.fullName}</strong>
            <span>{user.role}</span>
          </div>
          <button type="button" className="home-logout" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="home-main">
        <section className="home-hero">
          <span className="home-eyebrow">YOUR LEARNING SPACE</span>
          <h1>Welcome back, {firstName}!</h1>
          <p>
            This is your home base for subjects, lessons, notes, and quizzes.
          </p>
        </section>

        <section className="home-stats" aria-label="Learning overview">
          <article className="home-stat">
            <span className="home-stat-label">Subjects</span>
            <strong>0</strong>
            <p>Your enrolled subjects will appear here.</p>
          </article>
          <article className="home-stat">
            <span className="home-stat-label">Lessons</span>
            <strong>0</strong>
            <p>Lessons you start will be saved here.</p>
          </article>
          <article className="home-stat">
            <span className="home-stat-label">Quizzes</span>
            <strong>0</strong>
            <p>Your quiz results will show up here.</p>
          </article>
        </section>

        <section className="home-grid">
          <article className="home-card">
            <div className="home-card-heading">
              <h2>Your account</h2>
              <span className="home-badge">{user.role}</span>
            </div>

            <dl className="home-details">
              <div>
                <dt>Full name</dt>
                <dd>{user.fullName}</dd>
              </div>
              <div>
                <dt>Username or email</dt>
                <dd>{user.username}</dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>{memberSince}</dd>
              </div>
            </dl>
          </article>

          <article className="home-card home-card-start">
            <h2>Getting started</h2>
            <p>Your learning space is ready. Here is what you can do next.</p>

            <ul className="home-checklist">
              <li>Add your first subject</li>
              <li>Open a lesson and take notes</li>
              <li>Practice with a quiz</li>
            </ul>

            <span className="home-coming-soon">
              Learning tools are coming soon.
            </span>
          </article>
        </section>
      </main>

      <footer className="home-footer">
        LearnSpace · A smarter way to learn, one lesson at a time.
      </footer>
    </div>
  )
}

export default Home
