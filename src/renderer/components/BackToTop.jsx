import { useState, useEffect } from 'react'

export default function BackToTop() {
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 200)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: hovered ? 'auto' : '40px',
        height: '40px',
        padding: hovered ? '0 16px' : '0',
        background: '#333',
        color: '#fff',
        border: 'none',
        borderRadius: '20px',
        cursor: 'pointer',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'width 0.2s ease, padding 0.2s ease, background 0.15s ease',
        overflow: 'hidden',
        zIndex: 999
      }}
      title="トップへ戻る"
    >
      ↑{hovered && <span>トップへ</span>}
    </button>
  )
}
