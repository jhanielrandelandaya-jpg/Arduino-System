import { useState } from 'react'
import BrandingPanel from './BrandingPanel.jsx'
import LoginForm from './LoginForm.jsx'
import './auth.css'
import { apiUrl } from '../utils/apiUrl'

const departmentOptions = [
  { value: 'BSAD', title: 'BSAD', description: 'Bachelor of Science in Agricultural Development', courses: [
    { value: 'BTVTEICT-ET', title: 'BTVTEICT-ET - Bachelor of Technical-Vocational Teacher Education major in Electrical Technology' },
    { value: 'BTVTEICT-ELXT', title: 'BTVTEICT-ELXT - Bachelor of Technical-Vocational Teacher Education major in Electronics Technology' },
    { value: 'BTVTEICT-ICT-CH', title: 'BTVTEICT-ICT-CH - Bachelor of Technical-Vocational Teacher Education major in ICT - Computer Hardware Servicing' },
    { value: 'BTVTEICT-ICT-CP', title: 'BTVTEICT-ICT-CP - Bachelor of Technical-Vocational Teacher Education major in ICT - Computer Programming' },
  ]},
  { value: 'EAAD', title: 'EAAD', description: 'Engineering and Applied Arts Department', courses: [
    { value: 'BSEE', title: 'BSEE - Bachelor of Science in Electrical Engineering' },
    { value: 'BSEcE', title: 'BSEcE - Bachelor of Science in Electronics Engineering' },
    { value: 'BSIT', title: 'BSIT - Bachelor of Science in Information Technology' },
    { value: 'BETET', title: 'BETET - Bachelor of Engineering Technology major in Electrical Technology' },
    { value: 'BETELXT', title: 'BETELXT - Bachelor of Engineering Technology major in Electronics Technology' },
    { value: 'BETICT', title: 'BETICT - Bachelor of Engineering Technology major in Instrumentation & Controls Technology' },
    { value: 'BETMECT', title: 'BETMECT - Bachelor of Engineering Technology major in Mechatronics Technology' },
  ]},
  { value: 'MAAD', title: 'MAAD', description: 'Mechanical and Allied Arts Department', courses: [
    { value: 'BSME', title: 'BSME - Bachelor of Science in Mechanical Engineering' },
    { value: 'BETAT', title: 'BETAT - Bachelor of Engineering Technology major in Automotive Technology' },
    { value: 'BETDMT', title: 'BETDMT - Bachelor of Engineering Technology major in Dies & Moulds Technology' },
    { value: 'BETEMT', title: 'BETEMT - Bachelor of Engineering Technology major in Electromechanical Technology' },
    { value: 'BETHVAC/RT', title: 'BETHVAC/RT - Bachelor of Engineering Technology major in Heating, Ventilation, & Airconditioning / Refrigeration Technology' },
    { value: 'BETMT', title: 'BETMT - Bachelor of Engineering Technology major in Mechanical Technology' },
    { value: 'BETNDT', title: 'BETNDT - Bachelor of Engineering Technology major in Non-Destructive Testing Technology' },
  ]},
  { value: 'CAAD', title: 'CAAD', description: 'Civil and Allied Arts Department', courses: [
    { value: 'BSCE', title: 'BSCE - Bachelor of Science in Civil Engineering' },
    { value: 'BSES', title: 'BSES - Bachelor of Science in Environmental Science' },
    { value: 'BETCHT', title: 'BETCHT - Bachelor of Engineering Technology major in Chemical Technology' },
    { value: 'BETCT', title: 'BETCT - Bachelor of Engineering Technology major in Civil Technology' },
  ]},
]

const roleOptions = [
  { value: 'Student', title: 'Student', description: 'Learn lessons, take quizzes, and track progress.', icon: 'graduation' },
  { value: 'Faculty', title: 'Faculty', description: 'Manage subjects, publish lessons, and review results.', icon: 'users' },
]

export default function LoginPage({ mode: initialMode = 'login', onAuthenticated }) {
  const [mode, setMode] = useState(initialMode)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [role, setRole] = useState('Student')
  const [department, setDepartment] = useState('')
  const [course, setCourse] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const switchMode = (nextMode) => {
    setError('')
    setShowPassword(false)
    setPassword('')
    setMode(nextMode)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const payload = {
      username: username.trim(),
      password,
    }

    if (mode === 'register') {
      payload.fullName = fullName.trim()
      payload.role = role
      payload.department = department
      if (role === 'Student') {
        payload.course = course
      }
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(
        apiUrl(`/api/auth/${mode === 'login' ? 'login' : 'register'}`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong. Please try again.')
      }

      if (!data.token || !data.user) {
        throw new Error('Your account was saved, but the session could not be started.')
      }

      onAuthenticated(data, mode === 'login' ? remember : true)
    } catch (submitError) {
      setError(submitError.message || 'We could not reach the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgotPassword = () => {
    alert('Password recovery will be added later.')
  }

  const handleSocial = (provider) => {
    alert(`${provider} sign-in will be added later.`)
  }

  return (
    <main className="login-page">
      <BrandingPanel />
      <LoginForm
        mode={mode}
        onSwitch={switchMode}
        error={error}
        isSubmitting={isSubmitting}
        fullName={fullName}
        setFullName={setFullName}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        remember={remember}
        setRemember={setRemember}
        role={role}
        setRole={setRole}
        department={department}
        setDepartment={setDepartment}
        course={course}
        setCourse={setCourse}
        departmentOptions={departmentOptions}
        roleOptions={roleOptions}
        onSubmit={handleSubmit}
        onForgotPassword={handleForgotPassword}
        onSocial={handleSocial}
      />
    </main>
  )
}
