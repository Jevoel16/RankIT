import { useState, useMemo, useEffect } from 'react';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { useAuth } from '../hooks/useAuth';
import { logPdfDownload } from '../api';
import FullResultsPDF from './FullResultsPDF';
import DeductionNotesPDF from './DeductionNotesPDF';
import WeightedRankingsPDF from './WeightedRankingsPDF';

export default function MasterReportPreviewModal({ open, reportData, onClose, onDownloadLogged, viewerRole, preferredTab }) {
  const { token, user } = useAuth();
  const isSportsEvent = Boolean(reportData?.isSportsEvent);
  const [activeTab, setActiveTab] = useState('main');
  const resolvedRole = String(viewerRole || user?.role || '').toLowerCase();
  const canShowMainReport = resolvedRole !== 'grievance';
  const canShowDeductionNotes = !isSportsEvent && ['admin', 'superadmin', 'grievance'].includes(resolvedRole);
  const canShowWeightedRanking = ['admin', 'superadmin'].includes(resolvedRole);

  const defaultTab = useMemo(() => {
    const requested = String(preferredTab || '').toLowerCase();
    if (!canShowMainReport && canShowDeductionNotes) return 'deduction';
    if (requested === 'weighted' && canShowWeightedRanking) return 'weighted';
    if (requested === 'deduction' && canShowDeductionNotes) return 'deduction';
    if (resolvedRole === 'grievance' && canShowDeductionNotes) return 'deduction';
    return 'main';
  }, [preferredTab, resolvedRole, canShowMainReport, canShowDeductionNotes, canShowWeightedRanking]);

  useEffect(() => {
    if (!open) return;
    setActiveTab(defaultTab);
  }, [open, defaultTab, reportData?._id, reportData?.eventId]);

  const mainReportDocument = useMemo(
    () => (reportData ? <FullResultsPDF reportData={reportData} /> : null),
    [reportData]
  );

  const deductionNotesDocument = useMemo(
    () => (reportData && canShowDeductionNotes ? <DeductionNotesPDF reportData={reportData} /> : null),
    [reportData, canShowDeductionNotes]
  );

  const weightedRankingsDocument = useMemo(
    () => (reportData && canShowWeightedRanking ? <WeightedRankingsPDF reportData={reportData} /> : null),
    [reportData, canShowWeightedRanking]
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

  let effectiveTab = canShowMainReport ? 'main' : (canShowDeductionNotes ? 'deduction' : 'main');
  if (activeTab === 'deduction' && canShowDeductionNotes) {
    effectiveTab = 'deduction';
  } else if (activeTab === 'weighted') {
    if (canShowWeightedRanking) {
      effectiveTab = 'weighted';
    } else if (canShowDeductionNotes) {
      effectiveTab = 'deduction';
    }
  } else if (activeTab === 'main' && canShowMainReport) {
    effectiveTab = 'main';
  }

  const displayDocument = effectiveTab === 'main'
    ? mainReportDocument
    : effectiveTab === 'deduction'
      ? (deductionNotesDocument || mainReportDocument)
      : (weightedRankingsDocument || mainReportDocument);
  const mainReportFileName = `${String(reportData.eventName || 'event').replace(/\s+/g, '_')}_master_results.pdf`;
  const deductionNotesFileName = `${String(reportData.eventName || 'event').replace(/\s+/g, '_')}_deduction_notes.pdf`;
  const weightedRankingFileName = `${String(reportData.eventName || 'event').replace(/\s+/g, '_')}_weighted_rankings.pdf`;
  const fileName = effectiveTab === 'main'
    ? mainReportFileName
    : effectiveTab === 'deduction'
      ? (deductionNotesDocument ? deductionNotesFileName : mainReportFileName)
      : (weightedRankingsDocument ? weightedRankingFileName : mainReportFileName);
  const reportType = effectiveTab === 'main'
    ? 'master_report'
    : effectiveTab === 'deduction'
      ? (deductionNotesDocument ? 'deduction_notes' : 'master_report')
      : (weightedRankingsDocument ? 'weighted_rankings' : 'master_report');

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card pdf-preview-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="section-head">
          <h3>Master Report Preview</h3>
        </div>

        <p className="muted">
          Event: <strong>{reportData.eventName}</strong>
        </p>

        <div className="report-tabs">
          {canShowMainReport && (
            <button
              type="button"
              className={`tab-button ${effectiveTab === 'main' ? 'active' : ''}`}
              onClick={() => setActiveTab('main')}
            >
              Main Report
            </button>
          )}
          {canShowDeductionNotes && (
            <button
              type="button"
              className={`tab-button ${effectiveTab === 'deduction' ? 'active' : ''}`}
              onClick={() => setActiveTab('deduction')}
            >
              Deduction Notes
            </button>
          )}
          {canShowWeightedRanking && (
            <button
              type="button"
              className={`tab-button ${effectiveTab === 'weighted' ? 'active' : ''}`}
              onClick={() => setActiveTab('weighted')}
            >
              Weighted Ranking
            </button>
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
