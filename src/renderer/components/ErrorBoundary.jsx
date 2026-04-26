import { Component } from 'react'
import PropTypes from 'prop-types'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'
      return (
        <div style={{ padding: 24, color: '#cc0000', fontFamily: 'monospace' }}>
          <h2>エラーが発生しました</h2>
          <pre>{this.state.error.message}</pre>
          {isDev && <pre>{this.state.error.stack}</pre>}
        </div>
      )
    }
    return this.props.children
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired
}
