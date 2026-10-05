import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FontMap } from "@/constants/Typography";
import { useTheme } from "@/hooks/use-theme";

SplashScreen.preventAutoHideAsync().catch((e: unknown) => console.error("Splash screen error", e));

export default function RootLayout() {
  const [loaded, error] = useFonts(FontMap);
  const { theme, colors } = useTheme();

  useEffect(() => {
    if (error) console.error("Font loading failed", error);
    if (loaded || error) {
      SplashScreen.hideAsync().catch((e: unknown) => console.error("Splash hide error", e));
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="editor" />
        <Stack.Screen name="export" />
        <Stack.Screen name="shortcuts" options={{ presentation: "modal" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
