import Icon from '../components/Icon.jsx'

const FEATURES = [
  {
    title: 'Student Workspace',
    desc: 'Lessons, notes, quizzes, and progress tracking.',
    icon: 'graduation',
    color: '#0057ff',
  },
  {
    title: 'Faculty Workspace',
    desc: 'Create, manage, and track learning activities.',
    icon: 'users',
    color: '#7955ff',
  },
  {
    title: 'Your Knowledge, Your Pace.',
    desc: 'Learn anytime, anywhere, with secure access.',
    icon: 'book',
    color: '#06b6d4',
  },
]

export default function BrandingPanel() {
  return (
    <section className="branding-panel">
      <div className="brand-decoration brand-decoration-1" />
      <div className="brand-decoration brand-decoration-2" />

      <div className="brand-wrapper">
        <div className="brand-header">
          <div className="brand-mark">L</div>
          <span className="brand-name">LearnSpace</span>
          <span className="brand-pill">LMS</span>
        </div>

        <div className="brand-body">
          <span className="eyebrow">ROLE-BASED LEARNING PLATFORM</span>
          <h1 className="brand-heading">
            Learn better.<br />
            <span className="gradient-text">Achieve more.</span>
          </h1>
          <p className="brand-desc">
            One platform for students and faculty, with dedicated workspaces
            for learning, teaching, and measurable progress.
          </p>

          <div className="feature-grid">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="feature-card">
                <div className="feature-icon" style={{ color: feature.color }}>
                  <Icon name={feature.icon} size={20} />
                </div>
                <div>
                  <strong>{feature.title}</strong>
                  <span>{feature.desc}</span>
                </div>
                <span className="arrow">&#9654;</span>
              </div>
            ))}
          </div>
        </div>

        <div className="brand-footer">
          <div className="brand-illustration">
            <div className="illustration-laptop">
              <div className="laptop-screen">
                <div className="screen-mark">L</div>
              </div>
              <div className="laptop-base" />
            </div>
            <div className="illustration-books">
              <div className="book book-1" />
              <div className="book book-2" />
              <div className="book book-3" />
            </div>
            <div className="graduation-cap" />
          </div>
          <div className="brand-footer-text">
            <Icon name="shield" size={14} />
            <span>A smarter way to learn, one lesson at a time.</span>
          </div>
        </div>
      </div>
    </section>
  )
}
