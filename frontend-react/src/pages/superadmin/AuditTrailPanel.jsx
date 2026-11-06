import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAuditLogs } from '../../api';
import AuditTrailPDF from '../../components/AuditTrailPDF';
import PrintReportPreviewModal from '../../components/PrintReportPreviewModal';
import { Button, DataTable, FormField, Skeleton, useToast } from '../../components/ui';
import { todayStamp } from '../../utils/browser';

const actorName = (log) => log?.actorId?.username || 'System';
const humanize = (action) =>
  String(action || '')
    .replace(/_/g, ' ')
    .toLowerCase();

export default function AuditTrailPanel() {
  const toast = useToast();
  const [logs, setLogs] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(
    () =>
      fetchAuditLogs()
        .then((data) => setLogs(data || []))
        .catch((error) => {
          setLogs((prev) => prev || []);
          toast.error(error.message);
        }),
    [toast]
  );

  useEffect(() => {
    load();
  }, [load]);

  const actors = useMemo(() => [...new Set((logs || []).map(actorName))].sort(), [logs]);
  const actions = useMemo(() => [...new Set((logs || []).map((log) => log.action).filter(Boolean))].sort(), [logs]);

  const rows = useMemo(() => {
    const fromDate = from ? new Date(`${from}T00:00:00`) : null;
    const toDate = to ? new Date(`${to}T23:59:59.999`) : null;
    return (logs || []).filter((log) => {
      const createdAt = new Date(log.createdAt);
      return (
        (!fromDate || createdAt >= fromDate) &&
        (!toDate || createdAt <= toDate) &&
        (!actor || actorName(log) === actor) &&
        (!action || log.action === action)
      );
    });
  }, [logs, from, to, actor, action]);

  const pdf = useMemo(
    () => (
      <AuditTrailPDF
        logs={rows}
        summary={{ from: from || 'Any', to: to || 'Any', user: actor || 'Any', action: action || 'Any' }}
        generatedAt={new Date()}
      />
    ),
    [rows, from, to, actor, action]
  );

  if (!logs) return <Skeleton lines={6} />;

  return (
    <div className="form-stack">
      <div className="filter-bar">
        <FormField label="From">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </FormField>
        <FormField label="To">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </FormField>
        <FormField label="User">
          <select value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">Everyone</option>
            {actors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Action">
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            {actions.map((name) => (
              <option key={name} value={name}>
                {humanize(name)}
              </option>
            ))}
          </select>
        </FormField>
        <span className="button-row filter-bar__action">
          <Button variant="ghost" onClick={load}>
            Refresh
          </Button>
          <Button onClick={() => setPreviewOpen(true)} disabled={rows.length === 0}>
            Export PDF
          </Button>
        </span>
      </div>

      <DataTable
        caption="Audit trail"
        rows={rows}
        pageSize={20}
        emptyTitle="No activity matches these filters"
        columns={[
          {
            key: 'time',
            header: 'When',
            render: (log) => <time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString()}</time>
          },
          { key: 'actor', header: 'User', render: actorName },
          { key: 'action', header: 'Action', render: (log) => <code className="action-code">{log.action}</code> }
        ]}
      />

      <PrintReportPreviewModal
        open={previewOpen}
        title="Audit trail"
        subtitle="Review before download or print"
        onClose={() => setPreviewOpen(false)}
        fileName={`audit_trail_${todayStamp()}.pdf`}
        pdfDocument={pdf}
        downloadLabel="Download PDF"
        reportType="audit_trail"
        onDownloadLogged={load}
      />
    </div>
  );
}
