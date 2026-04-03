import { useState, useMemo } from 'react';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { useAuth } from '../hooks/useAuth';
import { logPdfDownload } from '../api';
import FullResultsPDF from './FullResultsPDF';
import DeductionNotesPDF from './DeductionNotesPDF';
import WeightedRankingsPDF from './WeightedRankingsPDF';

export default function MasterReportPreviewModal({ open, reportData, onClose, onDownloadLogged }) {
  const { token } = useAuth();
  const isSportsEvent = Boolean(reportData?.isSportsEvent);
  const [activeTab, setActiveTab] = useState('main');

  const mainReportDocument = useMemo(
    () => (reportData ? <FullResultsPDF reportData={reportData} /> : null),
    [reportData]
  );

  const deductionNotesDocument = useMemo(
    () => (reportData ? <DeductionNotesPDF reportData={reportData} /> : null),
    [reportData]
  );

  const weightedRankingsDocument = useMemo(
    () => (reportData ? <WeightedRankingsPDF reportData={reportData} /> : null),
    [reportData]
  );

  const handleDownloadClick = async (reportType) => {
    try {
      await logPdfDownload(reportType, reportData?._id || reportData?.eventId, token);
      if (typeof onDownloadLogged === 'function') {
        onDownloadLogged();
      }
    } catch (err) {
      // Log errors silently to not disrupt download
      console.error('Failed to log PDF download:', err);
    }
  };

  if (!open || !reportData) {
    return null;
  }

  const effectiveTab = isSportsEvent ? 'main' : activeTab;

  const displayDocument = effectiveTab === 'main'
    ? mainReportDocument
    : effectiveTab === 'deduction'
      ? deductionNotesDocument
      : weightedRankingsDocument;
  const mainReportFileName = `${String(reportData.eventName || 'event').replace(/\s+/g, '_')}_master_results.pdf`;
  const deductionNotesFileName = `${String(reportData.eventName || 'event').replace(/\s+/g, '_')}_deduction_notes.pdf`;
  const weightedRankingFileName = `${String(reportData.eventName || 'event').replace(/\s+/g, '_')}_weighted_rankings.pdf`;
  const fileName = effectiveTab === 'main' ? mainReportFileName : effectiveTab === 'deduction' ? deductionNotesFileName : weightedRankingFileName;
  const reportType = effectiveTab === 'main' ? 'master_report' : effectiveTab === 'deduction' ? 'deduction_notes' : 'weighted_rankings';

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card pdf-preview-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="section-head">
          <h3>Master Report Preview</h3>
          <span className="muted">Review before download</span>
        </div>

        <p className="muted">
          Event: <strong>{reportData.eventName}</strong>
        </p>

        <div className="report-tabs">
          <button
            type="button"
            className={`tab-button ${effectiveTab === 'main' ? 'active' : ''}`}
            onClick={() => setActiveTab('main')}
          >
            Main Report
          </button>
          {!isSportsEvent && (
            <>
              <button
                type="button"
                className={`tab-button ${effectiveTab === 'deduction' ? 'active' : ''}`}
                onClick={() => setActiveTab('deduction')}
              >
                Deduction Notes
              </button>
              <button
                type="button"
                className={`tab-button ${effectiveTab === 'weighted' ? 'active' : ''}`}
                onClick={() => setActiveTab('weighted')}
              >
                Weighted Ranking
              </button>
            </>
          )}
        </div>

        <div className="pdf-preview-viewer-wrap">
          {displayDocument && (
            <PDFViewer className="pdf-preview-viewer" showToolbar>
              {displayDocument}
            </PDFViewer>
          )}
        </div>

        <div className="action-cell">
          {displayDocument && (
            <PDFDownloadLink document={displayDocument} fileName={fileName} className="ghost-btn pdf-link-btn" onClick={() => handleDownloadClick(reportType)}>
              {({ loading }) => (loading ? 'Preparing PDF...' : 'Download PDF')}
            </PDFDownloadLink>
          )}
          <button type="button" onClick={onClose}>Close Preview</button>
        </div>
      </div>
    </div>
  );
}
