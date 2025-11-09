/**
 * History Indicator Component
 * Displays the current position in the edit history
 */

import { useHistory } from '../utils/useHistory';
import './HistoryIndicator.css';

export const HistoryIndicator = () => {
  const { undo, redo, canUndo, canRedo, historyPosition } = useHistory();

  return (
    <div className="history-indicator">
      <button
        className="history-button"
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 8H13M3 8L7 4M3 8L7 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <span className="history-position" title="History position">
        {historyPosition.past} / {historyPosition.past + historyPosition.future + 1}
      </span>

      <button
        className="history-button"
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        aria-label="Redo"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M13 8H3M13 8L9 4M13 8L9 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
};
