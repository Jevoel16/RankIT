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
  cellUsername: {
    width: '36%',
    padding: 6
  },
  cellRole: {
    width: '22%',
    padding: 6
  },
  cellApproved: {
    width: '16%',
    padding: 6
  },
  cellStatus: {
    width: '26%',
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

const PAGE_SIZE = 34;

function chunkRows(rows) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += PAGE_SIZE) {
    chunks.push(rows.slice(index, index + PAGE_SIZE));
  }
  return chunks.length ? chunks : [[]];
}

export default function UsersDirectoryPDF({ title = 'Users Directory', users = [], summary = {}, generatedAt = new Date() }) {
  const pages = chunkRows(users);
  const generatedLabel = new Date(generatedAt).toLocaleString();

  return (
    <Document>
      {pages.map((pageRows, pageIndex) => (
        <Page key={`users-page-${pageIndex}`} size="A4" style={styles.page}>
          {pageIndex === 0 && (
            <>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.metaLine}>Generated: {generatedLabel}</Text>
              <Text style={styles.metaLine}>Filter - Username: {summary.search || 'Any'}</Text>
              <Text style={styles.metaLine}>Filter - Status: {summary.status || 'Any'}</Text>
              <Text style={styles.metaLine}>Total Records: {users.length}</Text>
            </>
          )}

          <View style={styles.tableHeader}>
            <View style={styles.cellUsername}>
              <Text style={styles.headerCellText}>Username</Text>
            </View>
            <View style={styles.cellRole}>
              <Text style={styles.headerCellText}>Role</Text>
            </View>
            <View style={styles.cellApproved}>
              <Text style={styles.headerCellText}>Approved</Text>
            </View>
            <View style={styles.cellStatus}>
              <Text style={styles.headerCellText}>Status</Text>
            </View>
          </View>

          {pageRows.length === 0 ? (
            <Text style={styles.emptyState}>No users match the selected filters.</Text>
          ) : (
            pageRows.map((user) => {
              const status = user.approvalStatus || (user.isApproved ? 'approved' : 'pending');
              return (
                <View style={styles.tableRow} key={user._id || user.id || user.username}>
                  <View style={styles.cellUsername}>
                    <Text style={styles.rowCellText}>{user.username || '-'}</Text>
                  </View>
                  <View style={styles.cellRole}>
                    <Text style={styles.rowCellText}>{user.role || '-'}</Text>
                  </View>
                  <View style={styles.cellApproved}>
                    <Text style={styles.rowCellText}>{user.isApproved ? 'Yes' : 'No'}</Text>
                  </View>
                  <View style={styles.cellStatus}>
                    <Text style={styles.rowCellText}>{status}</Text>
                  </View>
                </View>
              );
            })
          )}
        </Page>
      ))}
    </Document>
  );
}
