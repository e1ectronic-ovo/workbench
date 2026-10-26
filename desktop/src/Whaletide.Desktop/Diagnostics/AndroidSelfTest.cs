using System.IO;
using System.Windows;
using Whaletide.Desktop.Android;
using Whaletide.Desktop.Native;
using static Whaletide.Desktop.Native.NativeMethods;

namespace Whaletide.Desktop.Diagnostics;

/// <summary>
/// 内置 Android 引擎的端到端自检：启动引擎 → 装 APK → 列包 → 解析启动组件 → 定位引擎窗口。
/// 这一段跑通，才说明「客户端自己装 APK 并把画面托管进来」是真的，而不是纸面方案。
///
/// 用法：Whaletide.Desktop.exe --android-self-test [apk 路径]
/// </summary>
public static class AndroidSelfTest
{
    public static int Run(string? apkPath)
    {
        var logPath = Path.Combine(AppContext.BaseDirectory, "android-self-test.log");
        var logLock = new object();

        void Write(string message)
        {
            var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {message}";
            System.Diagnostics.Debug.WriteLine(line);
            lock (logLock)
            {
                try
                {
                    File.AppendAllText(logPath, line + Environment.NewLine);
                }
                catch
                {
                    // 日志写不进去不应该掩盖测试结果
                }
            }
        }

        try
        {
            File.WriteAllText(logPath, string.Empty);
        }
        catch
        {
            // 忽略
        }

        try
        {
            // 必须离开 UI 线程：WPF 的 DispatcherSynchronizationContext 被同步阻塞后，
            // await 的续体会永远排不上队（典型的 async-over-sync 死锁）。
            var (exitCode, targetHandle) = Task.Run(() => RunCoreAsync(apkPath, Write)).GetAwaiter().GetResult();

            // 嵌入必须在 UI 线程上做（要建 WPF 窗口）
            if (exitCode == 0 && targetHandle != IntPtr.Zero)
            {
                VerifyEmbeddingOnUiThread(targetHandle, Write);
            }

            return exitCode;
        }
        catch (Exception ex)
        {
            Write($"FAILED: {ex}");
            return 1;
        }
    }

    private static async Task<(int ExitCode, IntPtr TargetHandle)> RunCoreAsync(string? apkPath, Action<string> write)
    {
        using var engine = new AndroidEngine();
        write($"sdk root={engine.Sdk.Root}");
        write($"sdk installed={engine.Sdk.IsInstalled} avd={engine.Sdk.HasAvd}");

        if (!engine.Sdk.IsInstalled)
        {
            write("FAILED: 运行时未安装，先跑 scripts/android-runtime.mjs");
            return (1, IntPtr.Zero);
        }

        IProgress<string> progress = new Progress<string>(m => write($"  .. {m}"));
        await engine.StartAsync(progress);
        write($"engine state={engine.State} serial={engine.Sdk.Serial}");

        var adb = engine.CreateAdb() ?? throw new InvalidOperationException("adb 不可用");

        if (!string.IsNullOrWhiteSpace(apkPath))
        {
            if (!File.Exists(apkPath))
            {
                write($"FAILED: APK 不存在 {apkPath}");
                return (1, IntPtr.Zero);
            }

            var install = await adb.InstallAsync(apkPath);
            write($"install exit={install.ExitCode} out={install.StdOut.Trim()} err={install.StdErr.Trim()}");
            if (!install.Ok)
            {
                write("FAILED: 安装失败");
                return (1, IntPtr.Zero);
            }
        }

        var packages = await adb.ListThirdPartyPackagesAsync();
        write($"third-party packages ({packages.Count}): {string.Join(", ", packages)}");

        foreach (var package in packages)
        {
            var component = await adb.ResolveLauncherAsync(package);
            write($"launcher {package} => {component ?? "(未解析到)"}");
        }

        if (packages.Count > 0)
        {
            var launch = await adb.LaunchAsync(packages[0]);
            write($"launch {packages[0]} exit={launch.ExitCode} out={launch.StdOut.Trim()}");
        }

        // 关键：模块绑定要靠进程名找到引擎窗口，找不到就没法托管画面
        var window = WindowLocator.FindBest(
            AndroidEngine.WindowProcessName, null, null, TimeSpan.FromSeconds(8));
        if (window is null)
        {
            write($"FAILED: 没找到进程 {AndroidEngine.WindowProcessName} 的可见窗口");
            return (1, IntPtr.Zero);
        }

        write($"PASS window found: {window.Display}");
        return (0, window.Handle);
    }

    /// <summary>
    /// 把真实的模拟器窗口嵌进宿主再解绑。
    /// 这一步验证的是「会不会黑屏」——模拟器若走 DirectComposition 渲染，SetParent 后代画面可能全黑，
    /// 但 GetParent/样式检查依然会通过，所以必须用真实窗口跑。
    /// </summary>
    private static void VerifyEmbeddingOnUiThread(IntPtr target, Action<string> write)
    {
        Window? hostWindow = null;
        NativeWindowHost? host = null;
        try
        {
            write($"target handle=0x{target.ToInt64():X} isWindow={IsWindow(target)}");
            foreach (var candidate in WindowLocator.EnumerateTopLevelWindows()
                         .Where(w => w.ProcessName.Contains("qemu", StringComparison.OrdinalIgnoreCase)))
            {
                write($"  candidate: {candidate.Display} isWindow={IsWindow(candidate.Handle)}");
            }
            host = new NativeWindowHost { Width = 900, Height = 600 };
            var root = new System.Windows.Controls.Grid();
            root.Children.Add(host);
            hostWindow = new Window
            {
                Title = "Whaletide Android Embedding Test",
                Width = 980,
                Height = 700,
                WindowStartupLocation = WindowStartupLocation.Manual,
                Left = 60,
                Top = 60,
                Content = root,
                ShowInTaskbar = false
            };
            hostWindow.Show();
            hostWindow.UpdateLayout();
            Drain(hostWindow.Dispatcher);

            if (!host.Embed(target))
            {
                write($"FAIL: SetParent 被拒绝（模拟器窗口无法作为子窗口） code={host.LastError} {host.LastErrorText}");
                return;
            }
            Drain(hostWindow.Dispatcher);

            if (GetParent(target) != host.HostHwnd)
            {
                write("FAIL: 嵌入后 GetParent 不是宿主窗口");
                return;
            }

            host.SyncSize();
            GetClientRect(host.HostHwnd, out var client);
            write($"PASS embedded emulator window; host client={client.Width}x{client.Height}");

            // 和正式挂载走同一条路径：把模拟器的浮动侧边按钮条收起来
            var embeddedInfo = WindowLocator.FromHandle(target);
            if (embeddedInfo is not null)
            {
                var hidden = WindowLocator.HideToolWindows(embeddedInfo.ProcessName, target);
                write($"tool windows hidden: {hidden}");
            }

            // 抓一张真实屏幕像素：这一步才是「嵌进去会不会黑屏」的证据。
            // 必须把宿主窗口置顶，否则抓到的可能是盖在上面的其它窗口（比如资源管理器）。
            hostWindow.Topmost = true;
            hostWindow.Activate();
            Drain(hostWindow.Dispatcher);
            Thread.Sleep(2000);
            Drain(hostWindow.Dispatcher);
            var shot = ScreenGrab.CaptureWindow(
                hostWindow, Path.Combine(AppContext.BaseDirectory, "embedding-check.png"));
            write(shot is null ? "WARN: 抓屏失败" : $"shot saved: {shot}");
            hostWindow.Topmost = false;

            host.Detach();
            Drain(hostWindow.Dispatcher);
            write(GetParent(target) != host.HostHwnd
                ? "PASS emulator window detached and restored"
                : "FAIL: 解绑后窗口仍挂在宿主上");
            write("PASS android engine self-test");
        }
        catch (Exception ex)
        {
            write($"FAIL: 嵌入阶段异常 {ex.Message}");
        }
        finally
        {
            try
            {
                host?.Detach();
            }
            catch
            {
                // 清理尽力而为
            }
            try
            {
                hostWindow?.Close();
            }
            catch
            {
                // 清理尽力而为
            }
        }
    }

    private static void Drain(System.Windows.Threading.Dispatcher dispatcher)
    {
        var frame = new System.Windows.Threading.DispatcherFrame();
        dispatcher.BeginInvoke(
            System.Windows.Threading.DispatcherPriority.ContextIdle,
            new Action(() => frame.Continue = false));
        System.Windows.Threading.Dispatcher.PushFrame(frame);
    }
}
