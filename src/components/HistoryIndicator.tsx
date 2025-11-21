/**
 * History Indicator Component
 * Displays the current position in the edit history
 */

import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setShowComparison } from '../store';
import { useHistory } from '../utils/useHistory';
import { ExportDialog } from './ExportDialog';
import './HistoryIndicator.css';

export interface HistoryIndicatorProps {
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  hasImage?: boolean;
}

export const HistoryIndicator: React.FC<HistoryIndicatorProps> = ({ 
  canvasRef,
  hasImage = true,
}) => {
  const dispatch = useDispatch();
  const { undo, redo, canUndo, canRedo, historyPosition } = useHistory();
  const showComparison = useSelector((state: RootState) => state.ui.showComparison);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleComparisonMouseDown = () => {
    dispatch(setShowComparison(true));
  };

  const handleComparisonMouseUp = () => {
    dispatch(setShowComparison(false));
  };

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

      {/* Before Button */}
      {hasImage && (
        <button
          className={`history-button before-button ${showComparison ? 'active' : ''}`}
          onMouseDown={handleComparisonMouseDown}
          onMouseUp={handleComparisonMouseUp}
          onMouseLeave={handleComparisonMouseUp}
          title="Hold to show before (Spacebar)"
          aria-label="Hold to show original image"
          aria-pressed={showComparison}
        >
          Before
        </button>
      )}

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

      {/* Export Button */}
      {hasImage && (
        <button
          className="export-button"
          onClick={() => setShowExportDialog(true)}
          title="Export image"
          aria-label="Export edited image"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8 2V10M8 2L5 5M8 2L11 5M2 10V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Export
        </button>
      )}

      {/* Export Dialog */}
      {showExportDialog && canvasRef && (
        <ExportDialog
          canvasRef={canvasRef}
          onClose={() => setShowExportDialog(false)}
          onExportComplete={() => {
            console.log('✅ Export successful');
          }}
        />
      )}
    </div>
  );
};
