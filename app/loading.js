import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Platform, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher'

export default function Loading() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [itemsSaved, setItemsSaved] = useState(0);
  const [locationPermission, setLocationPermission] = useState(false);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);

  useEffect(() => {
    const checkConnectivityAndFetchData = async () => {
      try {
        const netInfo = await NetInfo.fetch();
        
        if (netInfo.isConnected) {
          const authToken = await AsyncStorage.getItem("authToken");
          const userId = await AsyncStorage.getItem("userId");
          console.log("User ID recuperado:", userId);

          if (!userId) {
            throw new Error("No se encontró el ID de usuario");
          }

          // Fetch and save data from the first API
          const response1 = await fetch("https://asistenciaoperacional.grupoans.com.co/api/clientesnodosoficinas_asistenciaoperacional", {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          const data1 = await response1.json();
          
          if (Array.isArray(data1)) {
            await AsyncStorage.setItem("apiData1", JSON.stringify(data1));
            setItemsSaved(prevItems => prevItems + data1.length);
            console.log("Datos de la primera API descargados y guardados.");
          } else {
            throw new Error("La respuesta de la primera API no es un array");
          }

          // Fetch and save data from the second API
          const response2 = await fetch("https://asistenciaoperacional.grupoans.com.co/api/consultaticketsmasiopticks", {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          const data2 = await response2.json();
          
          if (Array.isArray(data2)) {
            await AsyncStorage.setItem("apiData2", JSON.stringify(data2));
            setItemsSaved(prevItems => prevItems + data2.length);
            console.log("Datos de la segunda API descargados y guardados.");
          } else {
            throw new Error("La respuesta de la segunda API no es un array");
          }
        } else {
          const storedData1 = await AsyncStorage.getItem("apiData1");
          const storedData2 = await AsyncStorage.getItem("apiData2");
          if (storedData1 && storedData2) {
            const parsedData1 = JSON.parse(storedData1);
            const parsedData2 = JSON.parse(storedData2);
            setItemsSaved(parsedData1.length + parsedData2.length);
            console.log("Usando datos locales guardados.");
          } else {
            Alert.alert("Sin conexión", "No se pudieron cargar los datos.");
          }
        }

        setLoading(false);
        checkLocationStatus();
        
      } catch (error) {
        console.error("Error al cargar los datos:", error);
        Alert.alert("Error", "Ocurrió un error al cargar los datos. Por favor, inicia sesión nuevamente.");
        setLoading(false);
        router.replace("/");
      }
    };

    checkConnectivityAndFetchData();
  }, [router]);

  const checkLocationStatus = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');

    if (status === 'granted') {
      let enabled = await Location.hasServicesEnabledAsync();
      setIsLocationEnabled(enabled);
      if (enabled) {
        router.replace("/home");
      }
    }
  };

  const handleRequestPermission = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocationPermission(true);
      checkLocationStatus();
    } else {
      Alert.alert(
        "Permiso denegado",
        "Para usar esta aplicación, necesitas conceder permisos de ubicación.",
        [
          { text: "OK" },
          { text: "Abrir configuración", onPress: openSettings }
        ]
      );
    }
  };

  const handleEnableLocation = async () => {
    if (Platform.OS === 'android') {
      IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS);
    } else {
      Alert.alert(
        "Ubicación desactivada",
        "Por favor, activa la ubicación en la configuración de tu dispositivo.",
        [
          { text: "OK" },
          { text: "Abrir configuración", onPress: openSettings }
        ]
      );
    }
  };

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openSettings();
    } else {
      IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_SETTINGS);
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <>
          <Text style={styles.loadingText}>Cargando datos...</Text>
          <ActivityIndicator size="large" color="#000000" style={styles.spinner} />
        </>
      ) : !locationPermission ? (
        <>
          <Text style={styles.itemsText}>Se requiere permiso de ubicación</Text>
          <TouchableOpacity 
            onPress={handleRequestPermission}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Conceder permiso de ubicación</Text>
          </TouchableOpacity>
        </>
      ) : !isLocationEnabled ? (
        <>
          <Text style={styles.itemsText}>La ubicación está desactivada</Text>
          <TouchableOpacity 
            onPress={handleEnableLocation}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Activar ubicación</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.itemsText}>Elementos guardados: {itemsSaved}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  loadingText: {
    marginBottom: 20,
    fontSize: 18,
    color: '#000000',
  },
  spinner: {
    marginBottom: 20,
  },
  itemsText: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});