import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error): State { return { error }; }
  render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32 }}>
          <div style={{ color: '#F43F5E', fontSize: 20, fontWeight: 700 }}>Dashboard Error</div>
          <div style={{ color: '#94A3B8', fontSize: 13, fontFamily: 'monospace', background: '#1E293B', padding: '16px 24px', borderRadius: 12, maxWidth: 600, wordBreak: 'break-all' }}>
            {String(this.state.error)}
          </div>
          <div style={{ color: '#64748B', fontSize: 12 }}>กรุณาแจ้ง error ข้างบนนี้ หรือกด F12 → Console เพื่อดูรายละเอียด</div>
          <button onClick={() => window.location.reload()} style={{ background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 700 }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
