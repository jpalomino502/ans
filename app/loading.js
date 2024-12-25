import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from '@react-native-community/netinfo';

export default function Loading() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [itemsSaved, setItemsSaved] = useState(0);

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

          const response = await fetch("https://api.grupoans.com.co/api/clientesnodosoficinas_asistenciaoperacional", {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          const data = await response.json();
          
          if (Array.isArray(data)) {
            await AsyncStorage.setItem("apiData", JSON.stringify(data));
            setItemsSaved(data.length);
            console.log("Datos descargados y guardados.");
          } else {
            throw new Error("La respuesta de la API no es un array");
          }
        } else {
          const storedData = await AsyncStorage.getItem("apiData");
          if (storedData) {
            const parsedData = JSON.parse(storedData);
            setItemsSaved(parsedData.length);
            console.log("Usando datos locales guardados.");
          } else {
            Alert.alert("Sin conexión", "No se pudieron cargar los datos.");
          }
        }

        setLoading(false);
        router.replace("/home");
        
      } catch (error) {
        console.error("Error al cargar los datos:", error);
        Alert.alert("Error", "Ocurrió un error al cargar los datos. Por favor, inicia sesión nuevamente.");
        setLoading(false);
        router.replace("/");
      }
    };

    checkConnectivityAndFetchData();
  }, [router]);

  return (
    <View style={styles.container}>
      {loading ? (
        <>
          <Text style={styles.loadingText}>Cargando datos...</Text>
          <ActivityIndicator size="large" color="#000000" style={styles.spinner} />
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
  },
});

