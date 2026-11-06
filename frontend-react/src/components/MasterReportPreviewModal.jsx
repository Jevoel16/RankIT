import { useEffect, useMemo, useState } from 'react';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { useAuth } from '../hooks/useAuth';
import { logPdfDownload } from '../api';
import CategoryWeightedRankingsPDF from './CategoryWeightedRankingsPDF';
import DeductionNotesPDF from './DeductionNotesPDF';
import FullResultsPDF from './FullResultsPDF';
import WeightedRankingsPDF from './WeightedRankingsPDF';
import { Modal, TabPanel, Tabs } from './ui';

const ADMIN_ROLES = ['admin', 'superadmin'];
const slug = (value) => String(value || 'event').replace(/\s+/g, '_');

// Which report tabs a role may see, in display order.
function availableReports({ role, reportData, categoryRankings }) {
  const isSports = Boolean(reportData?.isSportsEvent);
  const isAdmin = ADMIN_ROLES.includes(role);
  return [
    role !== 'grievance' && {
      id: 'main',
      label: 'Main report',
      reportType: 'master_report',
      suffix: 'master_results',
      render: () => <FullResultsPDF reportData={reportData} />
    },
    !isSports &&
      (isAdmin || role === 'grievance') && {
        id: 'deduction',
        label: 'Deduction notes',
        reportType: 'deduction_notes',
        suffix: 'deduction_notes',
        render: () => <DeductionNotesPDF reportData={reportData} />
      },
    isAdmin &&
      reportData?.category &&
      categoryRankings && {
        id: 'category-weighted',
        label: 'Category weighted',
        reportType: 'category_weighted_rankings',
        suffix: 'category_weighted_rankings',
        render: () => <CategoryWeightedRankingsPDF reportData={reportData} categoryRankings={categoryRankings} />
      },
    isAdmin && {
      id: 'overall-weighted',
      label: 'Overall weighted',
      reportType: 'overall_weighted_rankings',
      suffix: 'overall_weighted_rankings',
      render: () => <WeightedRankingsPDF reportData={reportData} />
    }
  ].filter(Boolean);
}

export default function MasterReportPreviewModal({
  open,
  reportData,
  onClose,
  onDownloadLogged,
  viewerRole,
  preferredTab,
  categoryRankings
}) {
  const { user } = useAuth();
  const role = String(viewerRole || user?.role || '').toLowerCase();
  const reports = useMemo(
    () => (reportData ? availableReports({ role, reportData, categoryRankings }) : []),
    [role, reportData, categoryRankings]
  );
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (open) setActiveId(preferredTab || '');
  }, [open, preferredTab, reportData]);

  const active = reports.find((report) => report.id === activeId) || reports[0];
  const document = useMemo(() => active?.render(), [active]);

  if (!reportData || !active) return null;

  const fileName = `${slug(reportData.eventName)}_${active.suffix}.pdf`;
  const logDownload = () =>
    logPdfDownload(active.reportType, reportData._id || reportData.eventId)
      .then(() => onDownloadLogged?.())
      .catch(() => {});

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title="Master report"
      description={`Event: ${reportData.eventName}`}
      footer={
        <>
          <PDFDownloadLink
            key={fileName}
            document={document}
            fileName={fileName}
            className="ui-btn ui-btn--primary"
            onClick={logDownload}
          >
            {({ loading }) => (loading ? 'Preparing PDF…' : 'Download PDF')}
          </PDFDownloadLink>
          <button type="button" className="ui-btn ui-btn--secondary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {reports.length > 1 && (
        <Tabs
          baseId="master-report"
          label="Report type"
          tabs={reports.map(({ id, label }) => ({ id, label }))}
          value={active.id}
          onChange={setActiveId}
        />
      )}
      <TabPanel baseId="master-report" id={active.id} active className="pdf-frame">
        <PDFViewer key={`${active.id}-${reportData._id || reportData.eventId}`} className="pdf-viewer" showToolbar>
          {document}
        </PDFViewer>
      </TabPanel>
    </Modal>
  );
}
