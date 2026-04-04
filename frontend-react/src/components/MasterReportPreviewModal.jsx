import { useState, useMemo, useEffect } from 'react';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { useAuth } from '../hooks/useAuth';
import { logPdfDownload } from '../api';
import FullResultsPDF from './FullResultsPDF';
import DeductionNotesPDF from './DeductionNotesPDF';
import WeightedRankingsPDF from './WeightedRankingsPDF';
import CategoryWeightedRankingsPDF from './CategoryWeightedRankingsPDF';

export default function MasterReportPreviewModal({ open, reportData, onClose, onDownloadLogged, viewerRole, preferredTab, categoryRankings }) {
  const { token, user } = useAuth();
  const isSportsEvent = Boolean(reportData?.isSportsEvent);
  const [activeTab, setActiveTab] = useState('main');
  const resolvedRole = String(viewerRole || user?.role || '').toLowerCase();
  const canShowMainReport = resolvedRole !== 'grievance';
  const canShowDeductionNotes = !isSportsEvent && ['admin', 'superadmin', 'grievance'].includes(resolvedRole);
  const canShowWeightedRanking = ['admin', 'superadmin'].includes(resolvedRole);
  const canShowCategoryWeightedRanking = ['admin', 'superadmin'].includes(resolvedRole) && Boolean(reportData?.category);

  const defaultTab = useMemo(() => {
    const requested = String(preferredTab || '').toLowerCase();
    if (!canShowMainReport && canShowDeductionNotes) return 'deduction';
    if (requested === 'overall-weighted' && canShowWeightedRanking) return 'overall-weighted';
    if (requested === 'category-weighted' && canShowCategoryWeightedRanking) return 'category-weighted';
    if (requested === 'deduction' && canShowDeductionNotes) return 'deduction';
    if (resolvedRole === 'grievance' && canShowDeductionNotes) return 'deduction';
    return 'main';
  }, [preferredTab, resolvedRole, canShowMainReport, canShowDeductionNotes, canShowWeightedRanking, canShowCategoryWeightedRanking]);

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

  const categoryWeightedRankingsDocument = useMemo(
    () => (reportData && canShowCategoryWeightedRanking && categoryRankings ? <CategoryWeightedRankingsPDF reportData={reportData} categoryRankings={categoryRankings} /> : null),
    [reportData, canShowCategoryWeightedRanking, categoryRankings]
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
  } else if (activeTab === 'overall-weighted') {
    if (canShowWeightedRanking) {
      effectiveTab = 'overall-weighted';
    } else if (canShowDeductionNotes) {
      effectiveTab = 'deduction';
    }
  } else if (activeTab === 'category-weighted') {
    if (canShowCategoryWeightedRanking) {
      effectiveTab = 'category-weighted';
    } else if (canShowWeightedRanking) {
      effectiveTab = 'overall-weighted';
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
      : effectiveTab === 'overall-weighted'
        ? (weightedRankingsDocument || mainReportDocument)
        : (categoryWeightedRankingsDocument || mainReportDocument);
  const mainReportFileName = `${String(reportData.eventName || 'event').replace(/\s+/g, '_')}_master_results.pdf`;
  const deductionNotesFileName = `${String(reportData.eventName || 'event').replace(/\s+/g, '_')}_deduction_notes.pdf`;
  const overallWeightedRankingFileName = `${String(reportData.eventName || 'event').replace(/\s+/g, '_')}_overall_weighted_rankings.pdf`;
  const categoryWeightedRankingFileName = `${String(reportData.eventName || 'event').replace(/\s+/g, '_')}_category_weighted_rankings.pdf`;
  const fileName = effectiveTab === 'main'
    ? mainReportFileName
    : effectiveTab === 'deduction'
      ? (deductionNotesDocument ? deductionNotesFileName : mainReportFileName)
      : effectiveTab === 'overall-weighted'
        ? (weightedRankingsDocument ? overallWeightedRankingFileName : mainReportFileName)
        : (categoryWeightedRankingsDocument ? categoryWeightedRankingFileName : mainReportFileName);
  const reportType = effectiveTab === 'main'
    ? 'master_report'
    : effectiveTab === 'deduction'
      ? (deductionNotesDocument ? 'deduction_notes' : 'master_report')
      : effectiveTab === 'overall-weighted'
        ? (weightedRankingsDocument ? 'overall_weighted_rankings' : 'master_report')
        : (categoryWeightedRankingsDocument ? 'category_weighted_rankings' : 'master_report');

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
          {canShowCategoryWeightedRanking && (
            <button
              type="button"
              className={`tab-button ${effectiveTab === 'category-weighted' ? 'active' : ''}`}
              onClick={() => setActiveTab('category-weighted')}
            >
              Category Weighted Ranking
            </button>
          )}
          {canShowWeightedRanking && (
            <button
              type="button"
              className={`tab-button ${effectiveTab === 'overall-weighted' ? 'active' : ''}`}
              onClick={() => setActiveTab('overall-weighted')}
            >
              Overall Weighted Ranking
            </button>
          )}
        </div>

        <div className="pdf-preview-viewer-wrap">
          {displayDocument && (
            <PDFViewer
              key={`${effectiveTab}-${reportData?._id || reportData?.eventId || 'report'}`}
              className="pdf-preview-viewer"
              showToolbar
            >
              {displayDocument}
            </PDFViewer>
          )}
        </div>

        <div className="action-cell">
          {displayDocument && (
            <PDFDownloadLink
              key={`${reportType}-${fileName}`}
              document={displayDocument}
              fileName={fileName}
              className="ghost-btn pdf-link-btn"
              onClick={() => handleDownloadClick(reportType)}
            >
              {({ loading }) => (loading ? 'Preparing PDF...' : 'Download PDF')}
            </PDFDownloadLink>
          )}
          <button type="button" onClick={onClose}>Close Preview</button>
        </div>
      </div>
    </div>
  );
}
