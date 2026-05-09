import ErrorBoundary from './ErrorBoundary';
import ConcreteDashboard from './ConcreteDashboard';

export default function App() {
  return (
    <ErrorBoundary>
      <ConcreteDashboard />
    </ErrorBoundary>
  );
}
