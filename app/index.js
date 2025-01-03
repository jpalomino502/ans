import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const checkLogoutStatus = async () => {
      try {
        const wasLoggedOut = await AsyncStorage.getItem("wasLoggedOut");
        if (wasLoggedOut === "true") {
          await AsyncStorage.removeItem("wasLoggedOut");
          Alert.alert("Sesión cerrada", "Has cerrado sesión exitosamente.");
        }
      } catch (error) {
        console.error("Error checking logout status:", error);
      }
    };

    checkLogoutStatus();
  }, []);

  const handleLogin = async () => {
    console.log("Inicio de sesión iniciado...");
    setLoginError("");

    if (email && password) {
      setLoading(true);

      try {
        const response = await fetch("https://asistenciaoperacional.grupoans.com.co/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        console.log("Respuesta del servidor:", data);

        if (response.ok) {
          await AsyncStorage.setItem("authToken", data.token);
          
          if (data.user && data.user.id) {
            await AsyncStorage.setItem("userId", data.user.id.toString());
            console.log("ID de usuario almacenado:", data.user.id);
          } else {
            console.warn("No se recibió ID de usuario en la respuesta");
          }

          console.log("Redirigiendo a la pantalla de carga...");
          await router.replace("/loading");
          console.log("Redirección completada");
        } else {
          setLoginError(data.message || "Error en las credenciales");
        }
      } catch (error) {
        console.error("Error de conexión:", error);
        Alert.alert("Error de conexión", "No se pudo conectar con el servidor. Por favor, intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    } else {
      Alert.alert("Campos vacíos", "Por favor, ingresa tu correo electrónico y contraseña.");
    }
  };
    
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.title}>¡Bienvenido!</Text>
        <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
        
        {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.inputPassword}
            placeholder="Contraseña"
            placeholderTextColor="#aaa"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? "eye" : "eye-off"} size={24} color="#aaa" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={styles.loginButton} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: Constants.statusBarHeight,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#131313",
    marginBottom: 24,
  },
  input: {
    width: "80%",
    height: 45,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#f9f9f9",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "80%",
    height: 45,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#f9f9f9",
  },
  inputPassword: {
    flex: 1,
  },
  loginButton: {
    width: "80%",
    height: 45,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 5,
    marginTop: 16,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  errorText: {
    color: "red",
    fontSize: 14,
    marginBottom: 12,
  },
});
