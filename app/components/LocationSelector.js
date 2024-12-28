import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, FlatList, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LocationSelector = forwardRef(({ onSelectLocation, isCheckedIn, initialLocation }, ref) => {
  const [nodos, setNodos] = useState([]);
  const [selectedNodo, setSelectedNodo] = useState(initialLocation);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadNodos();
  }, []);

  useEffect(() => {
    if (initialLocation) {
      setSelectedNodo(initialLocation);
    }
  }, [initialLocation]);

  useImperativeHandle(ref, () => ({
    resetSelection: () => {
      setSelectedNodo(null);
    }
  }));

  const loadNodos = async () => {
    try {
      const storedData = await AsyncStorage.getItem('apiData1');
      if (storedData) {
        setNodos(JSON.parse(storedData));
      }
    } catch (error) {
      console.error('Error loading nodos:', error);
    }
  };

  const handleSelectChange = (nodo) => {
    if (!isCheckedIn) {
      setSelectedNodo(nodo);
      setModalVisible(false);
      onSelectLocation(nodo);
    }
  };

  const filteredNodos = nodos.filter((nodo) =>
    nodo.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View>
      <TouchableOpacity 
        onPress={() => !isCheckedIn && setModalVisible(true)} 
        style={[styles.pickerButton, isCheckedIn && styles.disabledButton]}
        disabled={isCheckedIn}
      >
        <Text style={styles.pickerText}>
          {selectedNodo ? selectedNodo.nombre : 'Seleccione una ubicación'}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar ubicación..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <FlatList
              data={filteredNodos}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => handleSelectChange(item)}
                >
                  <Text style={styles.pickerItemText}>{item.nombre}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
});

export default LocationSelector;

const styles = StyleSheet.create({
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
  disabledButton: {
    opacity: 0.5,
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
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
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
});

