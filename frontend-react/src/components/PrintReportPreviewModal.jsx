import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { logPdfDownload } from '../api';
import { Modal } from './ui';

export default function PrintReportPreviewModal({
  open,
  title,
  subtitle,
  onClose,
  fileName,
  pdfDocument,
  downloadLabel = 'Download PDF',
  reportType = 'report',
  eventId,
  onDownloadLogged
}) {
  if (!pdfDocument) return null;

  // Download logging is best-effort and must not block the file.
  const logDownload = () =>
    logPdfDownload(reportType, eventId)
      .then(() => onDownloadLogged?.())
      .catch(() => {});

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title={title}
      description={subtitle}
      footer={
        <>
          <PDFDownloadLink
            document={pdfDocument}
            fileName={fileName}
            className="ui-btn ui-btn--primary"
            onClick={logDownload}
          >
            {({ loading }) => (loading ? 'Preparing PDF…' : downloadLabel)}
          </PDFDownloadLink>
          <button type="button" className="ui-btn ui-btn--secondary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div className="pdf-frame">
        <PDFViewer className="pdf-viewer" showToolbar>
          {pdfDocument}
        </PDFViewer>
      </div>
    </Modal>
  );
}
