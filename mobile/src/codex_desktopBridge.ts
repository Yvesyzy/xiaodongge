// Only installed electron implementations use this; Android keeps its native plugins.
export async function desktopPlugin(name: "NativeExport" | "NowPlaying" | "ScreenshotOcr") {
  const platform = (window as unknown as {
    CapacitorCustomPlatform?: { name: string; plugins: Record<string, object> };
  }).CapacitorCustomPlatform;
  const plugin = platform?.name === "electron" ? platform.plugins[name] : undefined;
  if (!plugin) throw new Error("Windows 原生接口未加载，请重新打开应用");
  return plugin;
}
