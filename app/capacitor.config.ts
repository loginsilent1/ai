import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.loginsilent1.argonpocket",
  appName: "Argon Pocket",
  webDir: "dist",
  backgroundColor: "#101611",
  android: {
    allowMixedContent: false,
  },
};

export default config;
