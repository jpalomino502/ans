import React, { useEffect } from 'react';
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Layout() {
  const router = useRouter();

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const authToken = await AsyncStorage.getItem("authToken");
        if (authToken) {
          router.replace("/loading");
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
      }
    };

    checkAuthStatus();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}

