import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 28,
    fontSize: 10,
    fontFamily: 'Helvetica'
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 6
  },
  metaLine: {
    fontSize: 9,
    marginBottom: 2,
    color: '#333'
  },
  tableHeader: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#d6d6d6',
    backgroundColor: '#f2f4f8',
    marginTop: 10
  },
  tableRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#d6d6d6'
  },
  cellTimestamp: {
    width: '34%',
    padding: 6
  },
  cellUser: {
    width: '28%',
    padding: 6
  },
  cellAction: {
    width: '38%',
    padding: 6
  },
  headerCellText: {
    fontSize: 9,
    fontWeight: 700
  },
  rowCellText: {
    fontSize: 9
  },
  emptyState: {
    marginTop: 14,
    fontSize: 10,
    color: '#444'
  }
});

const PAGE_SIZE = 28;

function chunkLogs(logs) {
  const chunks = [];
  for (let index = 0; index < logs.length; index += PAGE_SIZE) {
    chunks.push(logs.slice(index, index + PAGE_SIZE));
  }
  return chunks.length ? chunks : [[]];
}

export default function AuditTrailPDF({ logs = [], summary = {}, generatedAt = new Date() }) {
  const pages = chunkLogs(logs);
  const generatedLabel = new Date(generatedAt).toLocaleString();

  return (
    <Document>
      {pages.map((pageRows, pageIndex) => (
        <Page key={`audit-page-${pageIndex}`} size="A4" orientation="landscape" style={styles.page}>
          {pageIndex === 0 && (
            <>
              <Text style={styles.title}>Filtered Audit Trail</Text>
              <Text style={styles.metaLine}>Generated: {generatedLabel}</Text>
              <Text style={styles.metaLine}>
                Filters: From: {summary.from || 'Any'} | To: {summary.to || 'Any'} | User: {summary.user || 'Any'} | Action: {summary.action || 'Any'}
              </Text>
              <Text style={styles.metaLine}>Total Records: {logs.length}</Text>
            </>
          )}

          <View style={styles.tableHeader}>
            <View style={styles.cellTimestamp}>
              <Text style={styles.headerCellText}>Timestamp</Text>
            </View>
            <View style={styles.cellUser}>
              <Text style={styles.headerCellText}>User</Text>
            </View>
            <View style={styles.cellAction}>
              <Text style={styles.headerCellText}>Action</Text>
            </View>
          </View>

          {pageRows.length === 0 ? (
            <Text style={styles.emptyState}>No audit logs match the selected filters.</Text>
          ) : (
            pageRows.map((log) => (
              <View style={styles.tableRow} key={log._id || `${log.createdAt}-${log.action}`}>
                <View style={styles.cellTimestamp}>
                  <Text style={styles.rowCellText}>{new Date(log.createdAt).toLocaleString()}</Text>
                </View>
                <View style={styles.cellUser}>
                  <Text style={styles.rowCellText}>{log?.actorId?.username || 'System'}</Text>
                </View>
                <View style={styles.cellAction}>
                  <Text style={styles.rowCellText}>{log.action || '-'}</Text>
                </View>
              </View>
            ))
          )}
        </Page>
      ))}
    </Document>
  );
}
