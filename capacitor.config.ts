import type { CapacitorConfig } from "@capacitor/cli";

const remoteServerUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.casalclean.orcamentos",
  appName: "Casal Clean",
  webDir: "dist/public",
  ...(remoteServerUrl
    ? {
        server: {
          url: remoteServerUrl,
          cleartext: false,
          androidScheme: "https",
        },
      }
    : {}),
};

export default config;
