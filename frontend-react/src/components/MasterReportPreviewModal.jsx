import { useState, useMemo } from 'react';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { useAuth } from '../hooks/useAuth';
import { logPdfDownload } from '../api';
import FullResultsPDF from './FullResultsPDF';
import DeductionNotesPDF from './DeductionNotesPDF';

export default function MasterReportPreviewModal({ open, reportData, onClose, onDownloadLogged }) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('main');

  const mainReportDocument = useMemo(
    () => (reportData ? <FullResultsPDF reportData={reportData} /> : null),
    [reportData]
  );

  const deductionNotesDocument = useMemo(
    () => (reportData ? <DeductionNotesPDF reportData={reportData} /> : null),
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

  const displayDocument = activeTab === 'main' ? mainReportDocument : deductionNotesDocument;
  const mainReportFileName = `${String(reportData.eventName || 'event').replace(/\s+/g, '_')}_master_results.pdf`;
  const deductionNotesFileName = `${String(reportData.eventName || 'event').replace(/\s+/g, '_')}_deduction_notes.pdf`;
  const fileName = activeTab === 'main' ? mainReportFileName : deductionNotesFileName;
  const reportType = activeTab === 'main' ? 'master_report' : 'deduction_notes';

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
            className={`tab-button ${activeTab === 'main' ? 'active' : ''}`}
            onClick={() => setActiveTab('main')}
          >
            Main Report
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'deduction' ? 'active' : ''}`}
            onClick={() => setActiveTab('deduction')}
          >
            Deduction Notes
          </button>
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
