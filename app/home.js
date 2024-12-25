import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Circle } from 'react-native-maps';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import Linking from 'expo-linking';

const LOCATION_TASK_NAME = 'background-location-task';
const BACKGROUND_FETCH_TASK = 'background-fetch';

TaskManager.defineTask(LOCATION_TASK_NAME, async () => {
  try {
    const isCheckedIn = await AsyncStorage.getItem('isCheckedIn');
    if (isCheckedIn === 'true') {
      const location = await Location.getCurrentPositionAsync({});
      await sendLocationToAPI(location.coords);
    }
    return BackgroundFetch.Result.NewData;
  } catch (error) {
    console.error('Error in background task:', error);
    return BackgroundFetch.Result.Failed;
  }
});

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  const now = Date.now();
  console.log(`Got background fetch call at date: ${new Date(now).toISOString()}`);
  
  // Check if the user is checked in
  const isCheckedIn = await AsyncStorage.getItem('isCheckedIn');
  if (isCheckedIn === 'true') {
    const location = await Location.getCurrentPositionAsync({});
    await sendLocationToAPI(location.coords);
  }

  return BackgroundFetch.Result.NewData;
});

async function sendLocationToAPI(coords) {
  const userId = await AsyncStorage.getItem('userId');
  if (!userId) {
    console.log('sendLocationToAPI: No userId found');
    return;
  }

  const locationData = {
    id_usuario: userId,
    lat: coords.latitude.toString(),
    log: coords.longitude.toString(),
  };

  console.log('Sending location to API:', JSON.stringify(locationData, null, 2));

  try {
    const response = await fetch('https://api.grupoans.com.co/api/ubicacion-usuario', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(locationData),
    });

    const responseText = await response.text();
    console.log('Location API Response (raw):', responseText);

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    console.log('Location sent successfully');
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log('Location API Response (parsed):', JSON.stringify(responseData, null, 2));
    } catch (parseError) {
      console.error('Error parsing JSON from location API:', parseError);
    }
  } catch (error) {
    console.error('Error sending location:', error);
    await storePendingLocation(locationData);
  }
}

async function storePendingLocation(locationData) {
  try {
    const pendingLocations = await AsyncStorage.getItem('pendingLocations');
    const updatedPendingLocations = pendingLocations ? [...JSON.parse(pendingLocations), locationData] : [locationData];
    await AsyncStorage.setItem('pendingLocations', JSON.stringify(updatedPendingLocations));
  } catch (error) {
    console.error('Error storing pending location:', error);
  }
}

export default function Home() {
  const router = useRouter();
  const [nodos, setNodos] = useState([]);
  const [selectedNodo, setSelectedNodo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [ticket, setTicket] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [distance, setDistance] = useState(null);
  const [offlineData, setOfflineData] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [entryId, setEntryId] = useState('');
  const mapRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('Checking...');

  useEffect(() => {
    const getSavedData = async () => {
      try {
        const storedData = await AsyncStorage.getItem('apiData');
        if (storedData) {
          setNodos(JSON.parse(storedData));
        }
        const storedOfflineData = await AsyncStorage.getItem('offlineData');
        if (storedOfflineData) {
          setOfflineData(JSON.parse(storedOfflineData));
        }
        const storedIsCheckedIn = await AsyncStorage.getItem('isCheckedIn');
        if (storedIsCheckedIn) {
          setIsCheckedIn(storedIsCheckedIn === 'true');
        }
        const userId = await AsyncStorage.getItem('userId');
        console.log('User ID recuperado:', userId);
      } catch (error) {
        console.error('Error al recuperar los datos de AsyncStorage:', error);
      }
    };

    getSavedData();
    setupLocationTracking();
    registerBackgroundFetch();
    restoreCheckInState();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
      setConnectionStatus(state.isConnected ? 'Online' : 'Offline');
      if (state.isConnected) {
        syncOfflineData();
      }
    });

    const locationCheckInterval = setInterval(checkLocationServices, 60000); // Check every minute

    return () => {
      unsubscribe();
      clearInterval(locationCheckInterval);
    };
  }, []);

  const registerBackgroundFetch = async () => {
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 60 * 60, // 1 hour
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log("Background fetch registered");
    } catch (err) {
      console.log("Background fetch failed to register");
    }
  };

  const setupLocationTracking = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la ubicación para usar esta aplicación.');
      return;
    }

    let backgroundStatus = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus.status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la ubicación en segundo plano para usar esta aplicación.');
      return;
    }

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location) => {
        setUserLocation(location.coords);
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
        }
      }
    );
  };

  const checkLocationServices = async () => {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      Alert.alert(
        'Ubicación desactivada',
        'Por favor, active los servicios de ubicación para continuar usando la aplicación.',
        [
          { text: 'OK', onPress: () => Linking.openSettings() }
        ]
      );
    }
  };

  const handleSelectChange = (itemValue) => {
    if (!isCheckedIn) {
      const nodo = nodos.find((n) => n.id === parseInt(itemValue));
      setSelectedNodo(nodo);
      setModalVisible(false);
      setTicket('');
      if (mapRef.current && nodo) {
        mapRef.current.animateToRegion({
          latitude: parseFloat(nodo.latitud),
          longitude: parseFloat(nodo.longitud),
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    } else {
      Alert.alert('No se puede cambiar', 'Debes salir del cliente actual antes de seleccionar otro.');
    }
  };

  const filteredNodos = nodos.filter((nodo) =>
    nodo.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const clearSelection = () => {
    if (!isCheckedIn) {
      setSelectedNodo(null);
      setSearchQuery('');
      setModalVisible(false);
    } else {
      Alert.alert('No se puede cambiar', 'Debes salir del cliente actual antes de limpiar la selección.');
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const handleCheckInOut = async () => {
    if (!selectedNodo || !userLocation) return;

    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      parseFloat(selectedNodo.latitud),
      parseFloat(selectedNodo.longitud)
    );

    const maxDistance = 20000;

    if (distance <= maxDistance) {
      if (ticket.trim() === '') {
        Alert.alert('Error', 'Debes ingresar un ticket para realizar la acción.');
        return;
      }

      if (!isCheckedIn) {
        Alert.alert(
          'Confirmar ingreso',
          `¿Estás seguro de que quieres ingresar al cliente ${selectedNodo.nombre}?`,
          [
            {
              text: 'Cancelar',
              style: 'cancel'
            },
            {
              text: 'Sí, ingresar',
              onPress: async () => {
                console.log('Initiating check-in');
                await handleApiCall('entrada');
                setIsCheckedIn(true);
                await AsyncStorage.setItem('isCheckedIn', 'true');
                await AsyncStorage.setItem('checkedInNodoId', selectedNodo.id.toString());
                Alert.alert('Check-in exitoso', `Has ingresado al cliente ${selectedNodo.nombre}`);
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Confirmar salida',
          '¿Estás seguro de que quieres salir?',
          [
            {
              text: 'Cancelar',
              style: 'cancel'
            },
            {
              text: 'Sí, salir',
              onPress: async () => {
                console.log('Initiating check-out');
                await handleApiCall('salida');
                setIsCheckedIn(false);
                await AsyncStorage.setItem('isCheckedIn', 'false');
                await AsyncStorage.removeItem('checkedInNodoId');
                setTicket('');
                Alert.alert('Check-out exitoso', `Has salido del cliente ${selectedNodo.nombre}`);
              }
            }
          ]
        );
      }
    } else {
      Alert.alert('Fuera de rango', `Debes estar a menos de ${maxDistance}m del cliente para ${isCheckedIn ? 'salir' : 'ingresar'}.`);
    }
  };

  const handleApiCall = async (tipo) => {
    const data = {
      tipo,
      nombre: selectedNodo.nombre,
      ticket: ticket,
      lat: userLocation.latitude.toString(),
      log: userLocation.longitude.toString(),
      fecha_registro: new Date().toISOString(),
      id_clientes: selectedNodo.id.toString()
    };

    console.log('Sending data to API:', JSON.stringify(data, null, 2));

    if (isOnline) {
      try {
        const response = await fetch('https://api.grupoans.com.co/api/ingreso-salidas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        const responseText = await response.text();
        console.log('API Response (raw):', responseText);

        let responseData;
        try {
          responseData = JSON.parse(responseText);
          console.log('API Response (parsed):', JSON.stringify(responseData, null, 2));
        } catch (parseError) {
          console.error('Error parsing JSON:', parseError);
          throw new Error('Invalid JSON response from server');
        }

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        // Enviar ubicación después de un ingreso o salida exitoso
        console.log('Calling sendLocationToAPI after successful check-in/out');
        await sendLocationToAPI(userLocation);

      } catch (error) {
        console.error('Error:', error);
        console.log('Storing data offline due to error');
        storeOfflineData(data);
      }
    } else {
      console.log('Offline: Storing data locally');
      storeOfflineData(data);
    }
  };

  const storeOfflineData = async (data) => {
    try {
      const updatedOfflineData = [...offlineData, data];
      await AsyncStorage.setItem('offlineData', JSON.stringify(updatedOfflineData));
      setOfflineData(updatedOfflineData);
    } catch (error) {
      console.error('Error storing offline data:', error);
    }
  };

  const syncOfflineData = async () => {
    if (offlineData.length === 0) return;

    console.log('Starting offline data sync');
    const updatedOfflineData = [...offlineData];
    for (let i = 0; i < updatedOfflineData.length; i++) {
      try {
        console.log('Syncing item:', JSON.stringify(updatedOfflineData[i], null, 2));
        const response = await fetch('https://api.grupoans.com.co/api/ingreso-salidas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedOfflineData[i]),
        });

        const responseText = await response.text();
        console.log('API Response for sync (raw):', responseText);

        let responseData;
        try {
          responseData = JSON.parse(responseText);
          console.log('API Response for sync (parsed):', JSON.stringify(responseData, null, 2));
        } catch (parseError) {
          console.error('Error parsing JSON during sync:', parseError);
          continue; // Skip this item and move to the next
        }

        if (response.ok) {
          console.log('Successfully synced item');
          // Remove synced item
          updatedOfflineData.splice(i, 1);
          i--; // Adjust index after removal
        } else {
          console.error('Failed to sync item:', updatedOfflineData[i]);
        }
      } catch (error) {
        console.error('Error syncing offline data:', error);
      }
    }

    console.log('Offline sync complete. Remaining items:', updatedOfflineData.length);
    // Update offline data state and storage
    setOfflineData(updatedOfflineData);
    await AsyncStorage.setItem('offlineData', JSON.stringify(updatedOfflineData));

    // Sync pending locations
    const pendingLocations = await AsyncStorage.getItem('pendingLocations');
    if (pendingLocations) {
      const locations = JSON.parse(pendingLocations);
      for (const location of locations) {
        await sendLocationToAPI(location);
      }
      await AsyncStorage.removeItem('pendingLocations');
    }
  };

  useEffect(() => {
    if (selectedNodo && userLocation) {
      const calculatedDistance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        parseFloat(selectedNodo.latitud),
        parseFloat(selectedNodo.longitud)
      );
      setDistance(calculatedDistance);
    }
  }, [selectedNodo, userLocation]);

  const handleLogout = async () => {
    Alert.alert(
      "Cerrar Sesión",
      "¿Estás seguro que quieres cerrar sesión?",
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        { 
          text: "Sí", 
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('authToken');
              await AsyncStorage.removeItem('userId');
              await AsyncStorage.setItem('wasLoggedOut', 'true');
              await AsyncStorage.setItem('isCheckedIn', 'false');
              router.replace('/');
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert('Error', 'Hubo un problema al cerrar sesión. Por favor, intenta de nuevo.');
            }
          }
        }
      ]
    );
  };

  const restoreCheckInState = async () => {
    const storedIsCheckedIn = await AsyncStorage.getItem('isCheckedIn');
    const storedNodoId = await AsyncStorage.getItem('checkedInNodoId');
    
    if (storedIsCheckedIn === 'true' && storedNodoId) {
      setIsCheckedIn(true);
      const nodo = nodos.find(n => n.id.toString() === storedNodoId);
      if (nodo) {
        setSelectedNodo(nodo);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Panel Técnico</Text>
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{connectionStatus}</Text>
          <View style={[styles.statusIndicator, { backgroundColor: isOnline ? '#4CAF50' : '#F44336' }]} />
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="black" />
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        <TouchableOpacity 
          onPress={() => !isCheckedIn && setModalVisible(true)} 
          style={[styles.pickerButton, isCheckedIn && styles.disabledButton]}
          disabled={isCheckedIn}
        >
          <Text style={styles.pickerText}>
            {selectedNodo ? selectedNodo.nombre : 'Seleccione un cliente'}
          </Text>
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, isCheckedIn && styles.disabledInput]}
            placeholder="Ingrese el ticket"
            value={ticket}
            onChangeText={setTicket}
            editable={!isCheckedIn}
          />
        </View>

        {selectedNodo && (
          <TouchableOpacity
            style={[
              styles.button,
              isCheckedIn ? styles.buttonCheckedIn : (distance <= 20000 ? styles.buttonNearby : styles.buttonDefault)
            ]}
            onPress={handleCheckInOut}
          >
            <Text style={styles.buttonText}>
              {isCheckedIn ? 'Salir' : 'Ingresar'}
            </Text>
          </TouchableOpacity>
        )}

        {selectedNodo && distance !== null && (
          <View style={styles.distanceContainer}>
            <Text style={styles.distanceText}>
              Distancia al cliente: {(distance / 1000).toFixed(2)} km
            </Text>
            <Text style={styles.distanceStatus}>
              {distance <= 20000 ? 'Dentro del rango' : 'Fuera del rango'}
            </Text>
          </View>
        )}

        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: 7.1191,  // Latitude of Bucaramanga
              longitude: -73.1227,  // Longitude of Bucaramanga
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {selectedNodo && (
              <>
                <Marker
                  coordinate={{
                    latitude: parseFloat(selectedNodo.latitud),
                    longitude: parseFloat(selectedNodo.longitud),
                  }}
                  title={selectedNodo.nombre}
                />
                <Circle
                  center={{
                    latitude: parseFloat(selectedNodo.latitud),
                    longitude: parseFloat(selectedNodo.longitud),
                  }}
                  radius={20000}
                  fillColor="rgba(0, 0, 0, 0.1)"
                  strokeColor="rgba(0, 0, 0, 0.5)"
                />
              </>
            )}
            {userLocation && (
              <Marker
                coordinate={userLocation}
                title="Tu ubicación"
                pinColor="black"
              />
            )}
          </MapView>
        </View>
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar cliente..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <FlatList
              data={filteredNodos}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => handleSelectChange(item.id.toString())}
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
}

const styles = StyleSheet.create({
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
  disabledInput: {
    backgroundColor: '#f0f0f0',
    color: '#888',
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
});