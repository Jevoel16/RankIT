import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { useAuth } from '../hooks/useAuth';
import { logPdfDownload } from '../api';

export default function PrintReportPreviewModal({
  open,
  title,
  subtitle,
  onClose,
  fileName,
  pdfDocument,
  downloadLabel,
  reportType,
  eventId,
  onDownloadLogged
}) {
  const { token } = useAuth();

  const handleDownloadClick = async () => {
    try {
      await logPdfDownload(reportType || 'report', eventId, token);
      if (typeof onDownloadLogged === 'function') {
        onDownloadLogged();
      }
    } catch (err) {
      console.error('Failed to log PDF download:', err);
    }
  };
  if (!open || !pdfDocument) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card pdf-preview-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="section-head">
          <h3>{title}</h3>
          <span className="muted">{subtitle}</span>
        </div>

        <div className="pdf-preview-viewer-wrap">
          <PDFViewer className="pdf-preview-viewer" showToolbar>
            {pdfDocument}
          </PDFViewer>
        </div>

        <div className="action-cell">
          <PDFDownloadLink document={pdfDocument} fileName={fileName} className="ghost-btn pdf-link-btn" onClick={handleDownloadClick}>
            {({ loading }) => (loading ? 'Preparing PDF...' : downloadLabel || 'Download PDF')}
          </PDFDownloadLink>
          <button type="button" onClick={onClose}>Close Preview</button>
        </div>
      </div>
    </div>
  );
}
