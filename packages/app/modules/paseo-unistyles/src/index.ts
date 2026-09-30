import { NitroModules } from "react-native-nitro-modules";
import {
  Appearance,
  DeviceEventEmitter,
  Dimensions,
  I18nManager,
  Keyboard,
  TurboModuleRegistry,
  type TurboModule,
} from "react-native";

interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}
interface WindowState {
  colorScheme: "light" | "dark" | "unspecified";
  screen: { width: number; height: number };
  contentSizeCategory: string;
  insets: Insets & { ime: number };
  pixelRatio: number;
  fontScale: number;
  rtl: boolean;
  statusBar: { width: number; height: number };
  navigationBar: { width: number; height: number };
  isPortrait: boolean;
  isLandscape: boolean;
}
interface Spec extends TurboModule {
  initialize(state: WindowState, chrome: (command: string, value: number) => void): void;
  updateWindow(state: WindowState): void;
  getInsets(): Insets;
  setWindowStyle(command: string, value: number): Promise<void>;
}

declare const module: { hot?: { dispose(callback: () => void): void } };
let removeWindowListeners: (() => void) | undefined;

export function initializeHarmonyStyles(): void {
  removeWindowListeners?.();
  // Install Nitro before converting callbacks for the Unistyles native platform.
  NitroModules.hasHybridObject("UnistylesRuntime");
  const native = TurboModuleRegistry.getEnforcing<Spec>("Unistyles");
  let insets = native.getInsets();
  let ime = 0;
  const snapshot = (): WindowState => {
    const bounds = Dimensions.get("window");
    return {
      colorScheme: Appearance.getColorScheme() ?? "unspecified",
      screen: { width: bounds.width, height: bounds.height },
      contentSizeCategory: "unspecified",
      insets: { ...insets, ime },
      pixelRatio: bounds.scale,
      fontScale: bounds.fontScale,
      rtl: I18nManager.isRTL,
      statusBar: { width: bounds.width, height: insets.top },
      navigationBar: { width: bounds.width, height: insets.bottom },
      isPortrait: bounds.height >= bounds.width,
      isLandscape: bounds.width > bounds.height,
    };
  };
  const update = (): void => native.updateWindow(snapshot());
  native.initialize(snapshot(), (command, value) => {
    void native.setWindowStyle(command, value).catch((error: unknown) => {
      console.error("Unable to update the Harmony window", error);
    });
  });
  const subscriptions = [
    Dimensions.addEventListener("change", update),
    Appearance.addChangeListener(update),
    DeviceEventEmitter.addListener("paseoWindowInsetsChanged", (next: Insets) => {
      insets = next;
      update();
    }),
    Keyboard.addListener("keyboardDidShow", (event) => {
      ime = event.endCoordinates.height;
      update();
    }),
    Keyboard.addListener("keyboardDidHide", () => {
      ime = 0;
      update();
    }),
  ];
  removeWindowListeners = () => subscriptions.forEach((subscription) => subscription.remove());
  module.hot?.dispose(() => removeWindowListeners?.());
}
