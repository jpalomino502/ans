import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Circle } from 'react-native-maps';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import LocationSelector from './components/LocationSelector';
import TicketSelector from './components/TicketSelector';
import SyncStatusBar from './components/SyncStatusBar';

const LOCATION_TASK_NAME = 'background-location-task';
const LOCATION_INTERVAL = 3600000;

TaskManager.defineTask(LOCATION_TASK_NAME, async () => {
  try {
    const isCheckedIn = await AsyncStorage.getItem('isCheckedIn');
    if (isCheckedIn === 'true') {
      const location = await Location.getCurrentPositionAsync({});
      await sendLocationToAPI(location.coords);
    }
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Error in background task:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

async function sendLocationToAPI(coords) {
  const userId = await AsyncStorage.getItem('userId');
  const clientId = coords.clientId;
  if (!userId || !clientId) {
    console.log('sendLocationToAPI: No userId or clientId found');
    return;
  }

  const locationData = {
    id_usuario: userId,
    id_clientes: clientId.toString(),
    lat: coords.latitude.toString(),
    log: coords.longitude.toString(),
  };

  console.log('Sending location to API:', JSON.stringify(locationData, null, 2));

  const isOnline = await NetInfo.fetch().then(state => state.isConnected && state.isInternetReachable);

  if (!isOnline) {
    await storePendingLocation(locationData);
    return;
  }

  try {
    const response = await fetch('https://asistenciaoperacional.grupoans.com.co/api/ubicacion-usuario', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(locationData),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const responseText = await response.text();
    console.log('Location API Response:', responseText);
    console.log('Location sent successfully');
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
  const [userLocation, setUserLocation] = useState(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [distance, setDistance] = useState(null);
  const [offlineData, setOfflineData] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Checking...');
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [comments, setComments] = useState('');
  const [syncedCount, setSyncedCount] = useState(0);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false); // Added state for syncing
  const mapRef = useRef(null);
  const locationSelectorRef = useRef(null);
  const ticketSelectorRef = useRef(null);
  const locationIntervalRef = useRef(null);

  const saveCheckInData = async () => {
    try {
      await AsyncStorage.setItem('checkedInNodo', JSON.stringify(selectedNodo));
      await AsyncStorage.setItem('checkedInTicket', JSON.stringify(selectedTicket));
    } catch (error) {
      console.error('Error saving check-in data:', error);
    }
  };

  const loadCheckInData = async () => {
    try {
      const savedNodo = await AsyncStorage.getItem('checkedInNodo');
      const savedTicket = await AsyncStorage.getItem('checkedInTicket');
      if (savedNodo) setSelectedNodo(JSON.parse(savedNodo));
      if (savedTicket) setSelectedTicket(JSON.parse(savedTicket));
    } catch (error) {
      console.error('Error loading check-in data:', error);
    }
  };

  useEffect(() => {
    const getSavedData = async () => {
      try {
        const storedData = await AsyncStorage.getItem('apiData1');
        if (storedData) {
          setNodos(JSON.parse(storedData));
        }
        const storedOfflineData = await AsyncStorage.getItem('offlineData');
        if (storedOfflineData) {
          const parsedOfflineData = JSON.parse(storedOfflineData);
          setOfflineData(parsedOfflineData);
          setUnsyncedCount(parsedOfflineData.length);
        }
        const storedIsCheckedIn = await AsyncStorage.getItem('isCheckedIn');
        if (storedIsCheckedIn) {
          setIsCheckedIn(storedIsCheckedIn === 'true');
          if (storedIsCheckedIn === 'true') {
            await loadCheckInData();
          }
        }
        const userId = await AsyncStorage.getItem('userId');
        console.log('User ID recuperado:', userId);

        const storedTicketData = await AsyncStorage.getItem('apiData2');
        if (storedTicketData) {
          setTickets(JSON.parse(storedTicketData));
        }
      } catch (error) {
        console.error('Error al recuperar los datos de AsyncStorage:', error);
      }
    };

    getSavedData();
    setupLocationTracking();
    registerBackgroundFetch();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const newIsOnline = state.isConnected && state.isInternetReachable;
      setIsOnline(newIsOnline);
      setConnectionStatus(newIsOnline ? 'Online' : 'Offline');
      if (newIsOnline && !isSyncing) { // Update: Check isSyncing state
        syncPendingData();
      }
    });

    return () => unsubscribe();
  }, [isSyncing]); // Update: Add isSyncing to dependency array

  const registerBackgroundFetch = async () => {
    try {
      await BackgroundFetch.registerTaskAsync(LOCATION_TASK_NAME, {
        minimumInterval: LOCATION_INTERVAL,
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('Background fetch task registered');
    } catch (err) {
      console.error('Background fetch failed to register:', err);
    }
  };

  const setupLocationTracking = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la ubicación para usar esta aplicación.');
      return;
    }

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location) => {
        setUserLocation({
          ...location.coords,
          clientId: selectedNodo ? selectedNodo.id : null
        });
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
    if (!userLocation) return;

    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      parseFloat(selectedNodo.latitud),
      parseFloat(selectedNodo.longitud)
    );

    const maxDistance = 20000;

    if (distance <= maxDistance) {
      if (!isCheckedIn) {
        if (!comments.trim()) {
          Alert.alert('Error', 'Debes ingresar un comentario para el ingreso.');
          return;
        }

        Alert.alert(
          'Confirmar ingreso',
          `¿Estás seguro de que quieres ingresar a la ubicacion ${selectedNodo.nombre}?`,
          [
            {
              text: 'Cancelar',
              style: 'cancel'
            },
            {
              text: 'Sí, ingresar',
              onPress: async () => {
                console.log('Initiating check-in');
                const success = await handleApiCall('entrada');
                if (success) {
                  setIsCheckedIn(true);
                  await AsyncStorage.setItem('isCheckedIn', 'true');
                  await saveCheckInData();
                  setComments('');
                  Alert.alert('Check-in exitoso', `Has ingresado a la ubicacion ${selectedNodo.nombre}`);
                  
                  await sendLocationToAPI(userLocation);
                  
                  startLocationInterval();
                } else {
                  Alert.alert('Error', 'No se pudo realizar el check-in. Por favor, intenta de nuevo.');
                }
              }
            }
          ]
        );
      } else {
        if (!comments.trim()) {
          Alert.alert('Error', 'Debes ingresar un comentario para la salida.');
          return;
        }

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
                const success = await handleApiCall('salida');
                if (success) {
                  setIsCheckedIn(false);
                  await AsyncStorage.setItem('isCheckedIn', 'false');
                  setSelectedNodo(null);
                  setSelectedTicket(null);
                  setComments('');
                  await AsyncStorage.removeItem('checkedInNodo');
                  await AsyncStorage.removeItem('checkedInTicket');
                  Alert.alert('Check-out exitoso', `Has salido de la ubicacion ${selectedNodo.nombre}`);
                  
                  await sendLocationToAPI(userLocation);
                  
                  stopLocationInterval();
                  
                  if (locationSelectorRef.current) {
                    locationSelectorRef.current.resetSelection();
                  }
                  if (ticketSelectorRef.current) {
                    ticketSelectorRef.current.resetSelection();
                  }
                } else {
                  Alert.alert('Error', 'No se pudo realizar el check-out. Por favor, intenta de nuevo.');
                }
              }
            }
          ]
        );
      }
    } else {
      Alert.alert('Fuera de rango', `Debes estar a menos de ${maxDistance}m de la ubicacion para ${isCheckedIn ? 'salir' : 'ingresar'}.`);
    }
  };

  const startLocationInterval = () => {
    locationIntervalRef.current = setInterval(() => {
      if (userLocation) {
        sendLocationToAPI(userLocation);
      }
    }, LOCATION_INTERVAL);
  };

  const stopLocationInterval = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
    }
  };

  const handleApiCall = async (tipo) => {
    const userId = await AsyncStorage.getItem('userId');
    const data = {
      tipo,
      nombre: selectedNodo.nombre,
      ticket: selectedTicket ? selectedTicket.ticket : '',
      comentarios: comments,
      lat: userLocation.latitude.toString(),
      log: userLocation.longitude.toString(),
      fecha_registro: new Date().toISOString(),
      id_clientes: selectedNodo.id.toString(),
      id_usuario: userId
    };

    console.log('Sending data to API:', JSON.stringify(data, null, 2));

    if (isOnline) {
      try {
        const response = await fetch('https://asistenciaoperacional.grupoans.com.co/api/ingreso-salidas', {
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
          return false;
        }

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        setSyncedCount(prevCount => prevCount + 1);
        return true;
      } catch (error) {
        console.error('Error:', error);
        console.log('Storing data offline due to error');
        await storeOfflineData(data);
        return false;
      }
    } else {
      console.log('Offline: Storing data locally');
      await storeOfflineData(data);
      return true;
    }
  };

  const storeOfflineData = async (data) => {
    try {
      const updatedOfflineData = [...offlineData, data];
      await AsyncStorage.setItem('offlineData', JSON.stringify(updatedOfflineData));
      setOfflineData(updatedOfflineData);
      setUnsyncedCount(prevCount => prevCount + 1);
    } catch (error) {
      console.error('Error storing offline data:', error);
    }
  };

  const syncOfflineData = async () => {
    if (offlineData.length === 0) return;

    console.log('Starting offline data sync');
    const updatedOfflineData = [...offlineData];
    let newSyncedCount = syncedCount;
    let newUnsyncedCount = unsyncedCount;

    for (let i = 0; i < updatedOfflineData.length; i++) {
      try {
        console.log('Syncing item:', JSON.stringify(updatedOfflineData[i], null, 2));
        const response = await fetch('https://asistenciaoperacional.grupoans.com.co/api/ingreso-salidas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedOfflineData[i]),
        });

        if (response.ok) {
          console.log('Successfully synced item');
          updatedOfflineData.splice(i, 1);
          i--;
          newSyncedCount++;
          newUnsyncedCount--;
        } else {
          console.error('Failed to sync item:', updatedOfflineData[i]);
        }
      } catch (error) {
        console.error('Error syncing offline data:', error);
      }
    }

    console.log('Offline sync complete. Remaining items:', updatedOfflineData.length);
    setOfflineData(updatedOfflineData);
    setSyncedCount(newSyncedCount);
    setUnsyncedCount(newUnsyncedCount);
    await AsyncStorage.setItem('offlineData', JSON.stringify(updatedOfflineData));
  };

  const syncPendingData = async () => {
    if (isSyncing) return;

    try {
      setIsSyncing(true);
      console.log('Starting sync of pending data...');

      // Sync offline data
      if (offlineData.length > 0) {
        console.log(`Syncing ${offlineData.length} offline items...`);
        await syncOfflineData();
      }

      // Sync pending locations
      const pendingLocations = await AsyncStorage.getItem('pendingLocations');
      if (pendingLocations) {
        const locations = JSON.parse(pendingLocations);
        console.log(`Syncing ${locations.length} pending locations...`);
        for (const location of locations) {
          await sendLocationToAPI(location);
        }
        await AsyncStorage.removeItem('pendingLocations');
      }

      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Error syncing pending data:', error);
    } finally {
      setIsSyncing(false);
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

  useEffect(() => {
    console.log('User location updated:', userLocation);
  }, [userLocation]);

  useEffect(() => {
    console.log('Selected nodo updated:', selectedNodo);
  }, [selectedNodo]);

  const handleLogout = async () => {
    if (isCheckedIn) {
      Alert.alert(
        "No se puede cerrar sesión",
        "Debes salir de la ubicación actual antes de cerrar sesión.",
        [{ text: "Entendido" }]
      );
      return;
    }

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
              await AsyncStorage.removeItem('isCheckedIn');
              await AsyncStorage.removeItem('checkedInNodo');
              await AsyncStorage.removeItem('checkedInTicket');
              await AsyncStorage.setItem('wasLoggedOut', 'true');
              stopLocationInterval();
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Panel Técnico</Text>
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{connectionStatus}</Text>
          <View style={[styles.statusIndicator, { backgroundColor: isOnline ? '#4CAF50' : '#F44336' }]} />
        </View>
        <TouchableOpacity 
          onPress={handleLogout} 
          style={[styles.logoutButton, isCheckedIn && styles.disabledLogoutButton]}
          disabled={isCheckedIn}
        >
          <Ionicons name="log-out-outline" size={24} color={isCheckedIn ? "gray" : "black"} />
        </TouchableOpacity>
      </View>

      <SyncStatusBar syncedCount={syncedCount} unsyncedCount={unsyncedCount} isSyncing={isSyncing} /> {/* Update: Pass isSyncing prop */}

      <ScrollView style={styles.contentContainer} contentContainerStyle={styles.scrollViewContent}>
        <LocationSelector 
          ref={locationSelectorRef}
          onSelectLocation={(nodo) => {
            setSelectedNodo(nodo);
            setUserLocation(prevLocation => ({
              ...prevLocation,
              clientId: nodo ? nodo.id : null
            }));
          }} 
          isCheckedIn={isCheckedIn} 
          initialLocation={selectedNodo} 
        />
        <TicketSelector 
          ref={ticketSelectorRef}
          onSelectTicket={setSelectedTicket} 
          isCheckedIn={isCheckedIn}
          initialTicket={selectedTicket} 
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, isCheckedIn ? styles.activeInput : styles.inactiveInput]}
            placeholder={isCheckedIn ? "Comentarios para salida" : "Comentarios para ingreso"}
            value={comments}
            onChangeText={setComments}
            editable={true}
            multiline
          />
        </View>

        {selectedNodo && selectedTicket && (
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
              Distancia de la ubicacion: {(distance / 1000).toFixed(2)} km
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
              latitude: userLocation ? userLocation.latitude : 0,
              longitude: userLocation ? userLocation.longitude : 0,
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
      </ScrollView>
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
  disabledLogoutButton: {
    opacity: 0.5,
  },
});

