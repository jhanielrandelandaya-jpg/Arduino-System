import { useCallback, useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { ToastContext } from '../context/toast.js'

function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, tone = 'success') => {
    setToast({ id: Date.now(), message, tone })
  }, [])

  useEffect(() => {
    if (!toast) {
      return undefined
    }

    const timeout = window.setTimeout(() => setToast(null), 3400)
    return () => window.clearTimeout(timeout)
  }, [toast])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      {toast && (
        <div className={`lms-toast lms-toast-${toast.tone}`} role="status">
          <span className="lms-toast-icon">
            <Icon
              name={toast.tone === 'error' ? 'alert' : 'checkCircle'}
              size={19}
            />
          </span>
          <span>{toast.message}</span>
          <button
            type="button"
            className="lms-toast-close"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export default ToastProvider
