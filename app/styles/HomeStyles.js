import { StyleSheet } from 'react-native';
import Constants from 'expo-constants';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: Constants.statusBarHeight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  logoutButton: {
    padding: 5,
  },
  contentContainer: {
    flex: 1,
    padding: 15,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  pickerButton: {
    width: '100%',
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#000000',
  },
  pickerText: {
    fontSize: 16,
    color: '#000000',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    justifyContent: 'space-between',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
  },
  pickerItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  closeButton: {
    marginTop: 10,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#333',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 45,
    borderColor: '#000000',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    fontSize: 14,
    color: '#000000',
  },
  activeInput: {
    backgroundColor: '#ffffff',
    borderColor: '#000000',
  },
  inactiveInput: {
    backgroundColor: '#ffffff',
    borderColor: '#000000',
  },
  disabledInput: {
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  button: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignItems: 'center',
    borderWidth: 1,
  },
  buttonDefault: {
    backgroundColor: '#88DC65',
    borderColor: '#88DC65',
  },
  buttonNearby: {
    backgroundColor: '#88DC65',
    borderColor: '#88DC65',
  },
  buttonCheckedIn: {
    backgroundColor: '#ffff00',
    borderColor: '#ffff00',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  mapContainer: {
    width: '100%',
    height: 300,
    marginTop: 20,
    marginBottom: 20,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  disabledButton: {
    opacity: 0.5,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginRight: 5,
    fontSize: 14,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  distanceContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  distanceText: {
    fontSize: 14,
    marginBottom: 5,
  },
  distanceStatus: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  buttonPauseNearby: {
    backgroundColor: '#FFA500',
  },
  buttonResumeNearby: {
    backgroundColor: '#32CD32',
  },
  disabledLogoutButton: {
    opacity: 0.5,
  },
});

