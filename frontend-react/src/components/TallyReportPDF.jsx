import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 28,
    fontFamily: 'Helvetica',
    fontSize: 10
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6
  },
  subtitle: {
    marginBottom: 10,
    color: '#444'
  },
  table: {
    borderWidth: 1,
    borderColor: '#202020'
  },
  row: {
    flexDirection: 'row'
  },
  headerCell: {
    backgroundColor: '#efefef',
    fontWeight: 'bold'
  },
  cell: {
    borderRightWidth: 1,
    borderRightColor: '#202020',
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
    paddingVertical: 5,
    paddingHorizontal: 4,
    justifyContent: 'center'
  },
  footerWrap: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#b8b8b8',
    paddingTop: 8
  },
  footerText: {
    fontSize: 9,
    color: '#444',
    marginBottom: 12
  },
  signatureLine: {
    marginTop: 18,
    width: 220,
    borderTopWidth: 1,
    borderTopColor: '#000',
    paddingTop: 3,
    fontSize: 9
  }
});

function resolveWidths(criteriaCount) {
  const numberWidth = 14;
  const contestantWidth = 30;
  const remaining = Math.max(20, 100 - numberWidth - contestantWidth);
  const eachCriteria = criteriaCount > 0 ? `${remaining / criteriaCount}%` : '0%';

  return {
    numberWidth: `${numberWidth}%`,
    contestantWidth: `${contestantWidth}%`,
    eachCriteria
  };
}

export default function TallyReportPDF({ reportData }) {
  const criteria = reportData?.criteria || [];
  const rows = reportData?.rows || [];
  const widths = resolveWidths(criteria.length);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{reportData?.eventName || 'Event'} - Tally Report</Text>
        <Text style={styles.subtitle}>Tallier: {reportData?.generatedByName || 'Unknown User'}</Text>
        <Text style={styles.subtitle}>View: All contestants for current event</Text>

        <View style={styles.table}>
          <View style={styles.row}>
            <View style={[styles.cell, styles.headerCell, { width: widths.numberWidth }]}>
              <Text>Contestant #</Text>
            </View>
            <View style={[styles.cell, styles.headerCell, { width: widths.contestantWidth }]}>
              <Text>Contestant</Text>
            </View>
            {criteria.map((criterion, index) => (
              <View
                key={`header-${criterion}-${index}`}
                style={[
                  styles.cell,
                  styles.headerCell,
                  { width: widths.eachCriteria, borderRightWidth: index === criteria.length - 1 ? 0 : 1 }
                ]}
              >
                <Text>{criterion} Score</Text>
              </View>
            ))}
          </View>

          {rows.map((row, rowIndex) => (
            <View key={row.contestantId || `${row.contestantName}-${rowIndex}`} style={styles.row}>
              <View style={[styles.cell, { width: widths.numberWidth }]}>
                <Text>{row.contestantNumber ?? '-'}</Text>
              </View>
              <View style={[styles.cell, { width: widths.contestantWidth }]}>
                <Text>{row.contestantName}</Text>
              </View>
              {criteria.map((criterion, index) => (
                <View
                  key={`${row.contestantId || rowIndex}-${criterion}`}
                  style={[styles.cell, { width: widths.eachCriteria, borderRightWidth: index === criteria.length - 1 ? 0 : 1 }]}
                >
                  <Text>{row.scores?.[criterion] ?? '-'}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.footerWrap}>
          <Text style={styles.footerText}>Downloaded on {new Date(reportData?.generatedAt || Date.now()).toLocaleString()}</Text>
          <Text style={styles.footerText}>Page 1 of 1</Text>
          <Text style={styles.signatureLine}>Tallier: {reportData?.generatedByName || '________________'}</Text>
        </View>
      </Page>
    </Document>
  );
}
