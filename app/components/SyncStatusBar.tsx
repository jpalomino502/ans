import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SyncStatusBarProps {
  syncedCount: number;
  unsyncedCount: number;
}

const SyncStatusBar: React.FC<SyncStatusBarProps> = ({ syncedCount, unsyncedCount }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Envíos:</Text>
      <View style={styles.statusContainer}>
        <Text style={[styles.status, styles.synced]}>{syncedCount} enviados</Text>
        <Text style={[styles.status, styles.unsynced]}>{unsyncedCount} pendientes</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
  },
  status: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  synced: {
    backgroundColor: '#4CAF50',
    color: 'white',
  },
  
  unsynced: {
    backgroundColor: '#F44336',
    color: 'white',
  },
});

export default SyncStatusBar;

