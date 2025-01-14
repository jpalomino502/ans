import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, AppState } from 'react-native';
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
import { styles } from './styles/HomeStyles';

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

async function sendLocationToAPI(coords, checkInOutData = null) {
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
    ...checkInOutData
  };

  console.log('Sending location data to API:', JSON.stringify(locationData, null, 2));

  const isOnline = await NetInfo.fetch().then(state => state.isConnected && state.isInternetReachable);

  if (!isOnline) {
    await storePendingLocationData(locationData);
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
    console.log('Location data sent successfully');
  } catch (error) {
    console.error('Error sending location data:', error);
    await storePendingLocationData(locationData);
  }
}

async function storePendingLocationData(locationData) {
  try {
    const pendingLocationData = await AsyncStorage.getItem('pendingLocationData');
    const updatedPendingLocationData = pendingLocationData ? [...JSON.parse(pendingLocationData), locationData] : [locationData];
    await AsyncStorage.setItem('pendingLocationData', JSON.stringify(updatedPendingLocationData));
    console.log('Location data stored locally');
  } catch (error) {
    console.error('Error storing pending location data:', error);
  }
}

export default function Home() {
  const router = useRouter();
  const [nodos, setNodos] = useState([]);
  const [selectedNodo, setSelectedNodo] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [distance, setDistance] = useState(null);
  const [offlineData, setOfflineData] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Checking...');
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [comments, setComments] = useState('');
  const [syncedCount, setSyncedCount] = useState(0);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const mapRef = useRef(null);
  const locationSelectorRef = useRef(null);
  const ticketSelectorRef = useRef(null);
  const locationIntervalRef = useRef(null);

  const saveCheckInData = async () => {
    try {
      await AsyncStorage.setItem('checkedInNodo', JSON.stringify(selectedNodo));
      await AsyncStorage.setItem('checkedInTicket', JSON.stringify(selectedTicket));
      await AsyncStorage.setItem('isPaused', JSON.stringify(isPaused));
    } catch (error) {
      console.error('Error saving check-in data:', error);
    }
  };

  const loadCheckInData = async () => {
    try {
      const savedNodo = await AsyncStorage.getItem('checkedInNodo');
      const savedTicket = await AsyncStorage.getItem('checkedInTicket');
      const savedIsPaused = await AsyncStorage.getItem('isPaused');
      if (savedNodo) setSelectedNodo(JSON.parse(savedNodo));
      if (savedTicket) setSelectedTicket(JSON.parse(savedTicket));
      if (savedIsPaused) setIsPaused(JSON.parse(savedIsPaused));
    } catch (error) {
      console.error('Error loading check-in data:', error);
    }
  };

  const handleCheckIn = () => {
    if (!userLocation || !comments.trim()) {
      Alert.alert('Error', 'Debes ingresar un comentario para el ingreso.');
      return;
    }

    Alert.alert(
      'Confirmar ingreso',
      `¿Estás seguro de que quieres ingresar a la ubicacion ${selectedNodo.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, ingresar',
          onPress: async () => {
            console.log('Initiating check-in');
            const success = await handleApiCall('entrada');
            if (success) {
              setIsCheckedIn(true);
              setIsPaused(false);
              await AsyncStorage.setItem('isCheckedIn', 'true');
              await AsyncStorage.setItem('isPaused', 'false');
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
  };

  const handleCheckOut = () => {
    if (!comments.trim()) {
      Alert.alert('Error', 'Debes ingresar un comentario para la salida.');
      return;
    }

    Alert.alert(
      'Confirmar salida',
      '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, salir',
          onPress: async () => {
            console.log('Initiating check-out');
            const success = await handleApiCall('salida');
            if (success) {
              setIsCheckedIn(false);
              setIsPaused(false);
              await AsyncStorage.setItem('isCheckedIn', 'false');
              await AsyncStorage.setItem('isPaused', 'false');
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
  };

  const handlePause = () => {
    if (!comments.trim()) {
      Alert.alert('Error', 'Debes ingresar un comentario para la pausa.');
      return;
    }

    Alert.alert(
      'Confirmar pausa',
      '¿Estás seguro de que quieres pausar tu actividad?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, pausar',
          onPress: async () => {
            console.log('Initiating pause');
            const success = await handleApiCall('pausa');
            if (success) {
              setIsPaused(true);
              await AsyncStorage.setItem('isPaused', 'true');
              await saveCheckInData();
              setComments('');
              Alert.alert('Pausa exitosa', 'Has pausado tu actividad');
              await sendLocationToAPI(userLocation);
              stopLocationInterval();
            } else {
              Alert.alert('Error', 'No se pudo realizar la pausa. Por favor, intenta de nuevo.');
            }
          }
        }
      ]
    );
  };

  const handleResume = () => {
    if (!comments.trim()) {
      Alert.alert('Error', 'Debes ingresar un comentario para reanudar.');
      return;
    }

    Alert.alert(
      'Confirmar reanudar',
      '¿Estás seguro de que quieres reanudar tu actividad?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, reanudar',
          onPress: async () => {
            console.log('Initiating resume');
            const success = await handleApiCall('reanudar');
            if (success) {
              setIsPaused(false);
              await AsyncStorage.setItem('isPaused', 'false');
              await saveCheckInData();
              setComments('');
              Alert.alert('Reanudación exitosa', 'Has reanudado tu actividad');
              await sendLocationToAPI(userLocation);
              startLocationInterval();
            } else {
              Alert.alert('Error', 'No se pudo reanudar la actividad. Por favor, intenta de nuevo.');
            }
          }
        }
      ]
    );
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

  const syncPendingData = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    const pendingLocations = await AsyncStorage.getItem('pendingLocationData');
    const hasPendingLocations = pendingLocations && JSON.parse(pendingLocations).length > 0;

    if (offlineData.length === 0 && !hasPendingLocations) {
      return;
    }

    setIsSyncing(true);

    try {
      console.log('Starting sync of pending data...');

      if (offlineData.length > 0) {
        console.log(`Syncing ${offlineData.length} offline items...`);
        await syncOfflineData();
      }

      if (hasPendingLocations) {
        const locations = JSON.parse(pendingLocations);
        console.log(`Syncing ${locations.length} pending location data...`);
        for (const location of locations) {
          try {
            const response = await fetch('https://asistenciaoperacional.grupoans.com.co/api/ubicacion-usuario', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(location),
            });

            if (!response.ok) {
              throw new Error('Network response was not ok');
            }

            console.log('Location data synced successfully');
          } catch (error) {
            console.error('Error syncing location data:', error);
            continue;
          }
        }
        await AsyncStorage.removeItem('pendingLocationData');
      }

      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Error syncing pending data:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [offlineData, isSyncing, isOnline, syncOfflineData]);

  const checkAndSyncPendingData = useCallback(() => {
    if (isOnline && !isSyncing) {
      syncPendingData();
    }
  }, [isOnline, isSyncing, syncPendingData]);

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
    let locationSubscription;

    const setupLocationTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se necesita acceso a la ubicación para usar esta aplicación.');
        return;
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        (location) => {
          setUserLocation(prevLocation => {
            if (
              prevLocation &&
              prevLocation.latitude === location.coords.latitude &&
              prevLocation.longitude === location.coords.longitude
            ) {
              return prevLocation;
            }
            return {
              ...location.coords,
              clientId: selectedNodo ? selectedNodo.id : null
            };
          });
        }
      );
    };

    setupLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [selectedNodo]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const newIsOnline = state.isConnected && state.isInternetReachable;
      setIsOnline(newIsOnline);
      setConnectionStatus(newIsOnline ? 'Online' : 'Offline');

      if (newIsOnline) {
        syncPendingData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [syncPendingData]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        syncPendingData();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [syncPendingData]);

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
      } finally {
        checkAndSyncPendingData();
      }
    } else {
      console.log('Offline: Storing data locally');
      await storeOfflineData(data);
      checkAndSyncPendingData(); 
      return true;
    }
  };

  const storeOfflineData = async (data) => {
    try {
      const updatedOfflineData = [...offlineData, data];
      await AsyncStorage.setItem('offlineData', JSON.stringify(updatedOfflineData));
      setOfflineData(updatedOfflineData);
      setUnsyncedCount(prevCount => prevCount + 1);
      checkAndSyncPendingData();
    } catch (error) {
      console.error('Error storing offline data:', error);
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
              await AsyncStorage.removeItem('isPaused');
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

      <SyncStatusBar syncedCount={syncedCount} unsyncedCount={unsyncedCount} isSyncing={isSyncing} />

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
            placeholder={
              isCheckedIn
                ? isPaused
                  ? "Comentarios para reanudar"
                  : "Comentarios para pausar o salir"
                : "Comentarios para ingreso"
            }
            value={comments}
            onChangeText={setComments}
            editable={true}
            multiline
          />
        </View>

        {selectedNodo && selectedTicket && (
          <View style={styles.buttonContainer}>
            {!isCheckedIn && (
              <TouchableOpacity
                style={[
                  styles.button,
                  distance <= 20000 ? styles.buttonNearby : styles.buttonDefault
                ]}
                onPress={handleCheckIn}
              >
                <Text style={styles.buttonText}>Ingresar</Text>
              </TouchableOpacity>
            )}
            
            {isCheckedIn && (
              <>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.buttonCheckedIn,
                    isPaused && styles.buttonDisabled
                  ]}
                  onPress={handleCheckOut}
                  disabled={isPaused}
                >
                  <Text style={styles.buttonText}>Salir</Text>
                </TouchableOpacity>

                {!isPaused ? (
                  <TouchableOpacity
                    style={[styles.button, styles.buttonPauseNearby]}
                    onPress={handlePause}
                  >
                    <Text style={styles.buttonText}>Pausar</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.button, styles.buttonResumeNearby]}
                    onPress={handleResume}
                  >
                    <Text style={styles.buttonText}>Reanudar</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
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

