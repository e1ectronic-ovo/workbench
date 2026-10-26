using System.IO;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Threading;
using Whaletide.Desktop.Native;
using static Whaletide.Desktop.Native.NativeMethods;

namespace Whaletide.Desktop.Diagnostics;

public static class SelfTest
{
    public static int Run(Application app, string[] args)
    {
        var logPath = Path.Combine(AppContext.BaseDirectory, "self-test.log");
        var log = new List<string>();
        Window? target = null;
        Window? testWindow = null;
        NativeWindowHost? host = null;

        void Write(string message)
        {
            var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {message}";
            log.Add(line);
            Debug.WriteLine(line);
        }

        try
        {
            Write("starting native HWND embedding self-test");
            Write($"process={Environment.ProcessId} arch={RuntimeInformation.ProcessArchitecture}");

            target = new Window
            {
                Title = "Whaletide Embedding Test Target",
                Width = 640,
                Height = 360,
                WindowStartupLocation = WindowStartupLocation.Manual,
                Left = 40,
                Top = 40,
                ShowInTaskbar = false,
                Content = new System.Windows.Controls.TextBlock
                {
                    Text = "Native target window",
                    FontSize = 24,
                    HorizontalAlignment = HorizontalAlignment.Center,
                    VerticalAlignment = VerticalAlignment.Center
                }
            };
            target.Show();
            Drain(target.Dispatcher);

            var targetHwnd = new WindowInteropHelper(target).Handle;
            if (targetHwnd == IntPtr.Zero)
            {
                throw new InvalidOperationException("target HWND was not created");
            }
            Write($"target hwnd=0x{targetHwnd.ToInt64():X}");

            host = new NativeWindowHost { Width = 720, Height = 420 };
            var root = new System.Windows.Controls.Grid();
            root.Children.Add(host);
            testWindow = new Window
            {
                Title = "Whaletide Embedding Test Host",
                Width = 820,
                Height = 520,
                WindowStartupLocation = WindowStartupLocation.Manual,
                Left = 80,
                Top = 80,
                Content = root,
                ShowInTaskbar = false
            };
            testWindow.Show();
            testWindow.UpdateLayout();
            Drain(testWindow.Dispatcher);

            if (host.HostHwnd == IntPtr.Zero)
            {
                throw new InvalidOperationException("HwndHost did not create its parent HWND");
            }
            Write($"host hwnd=0x{host.HostHwnd.ToInt64():X}");

            var embedded = host.Embed(targetHwnd);
            Drain(testWindow.Dispatcher);

            if (!embedded)
            {
                throw new InvalidOperationException("NativeWindowHost.Embed returned false");
            }
            if (!host.IsEmbedded || host.ChildHwnd != targetHwnd)
            {
                throw new InvalidOperationException("NativeWindowHost did not retain the child HWND");
            }
            if (GetParent(targetHwnd) != host.HostHwnd)
            {
                throw new InvalidOperationException("GetParent(target) != host HWND");
            }
            if ((GetWindowLongPtr(targetHwnd, GWL_STYLE) & WS_CHILD) == 0)
            {
                throw new InvalidOperationException("target window did not receive WS_CHILD style");
            }

            host.SyncSize();
            if (!GetClientRect(host.HostHwnd, out var client) || client.Width <= 0 || client.Height <= 0)
            {
                throw new InvalidOperationException("host client rectangle is invalid");
            }

            Write($"PASS child parented successfully; host client={client.Width}x{client.Height}");
            host.Detach();
            Drain(testWindow.Dispatcher);

            if (GetParent(targetHwnd) != IntPtr.Zero)
            {
                throw new InvalidOperationException("target HWND was not restored to top level");
            }
            Write("PASS target detached and restored");

            RunExternalPhase(Write);

            Write("SELF-TEST PASSED");
            return 0;
        }
        catch (Exception ex)
        {
            Write($"SELF-TEST FAILED: {ex}");
            return 1;
        }
        finally
        {
            try
            {
                host?.Detach();
            }
            catch
            {
                // Best-effort cleanup.
            }
            try
            {
                testWindow?.Close();
            }
            catch
            {
                // Best-effort cleanup.
            }
            try
            {
                target?.Close();
            }
            catch
            {
                // Best-effort cleanup.
            }

            try
            {
                File.WriteAllLines(logPath, log);
            }
            catch
            {
                // Logging must not hide the test result.
            }
        }
    }

    /// <summary>
    /// 跨进程阶段：把一个真实外部进程（记事本）的窗口嵌进来。
    /// 上一阶段嵌的是本进程内的 WPF 窗口，测不到 UIPI / 跨进程 Win32 的差异；
    /// 模拟器就是典型的外部进程，所以这一段才是和真实场景同构的验证。
    /// 结果只记录不改变退出码——记事本在部分 Windows 版本上是打包应用，
    /// 嵌不进去不代表 NativeWindowHost 有问题，但需要留下证据。
    /// </summary>
    private static void RunExternalPhase(Action<string> write)
    {
        Process? target = null;
        Window? hostWindow = null;
        NativeWindowHost? host = null;

        try
        {
            write("external phase: spawning notepad.exe");
            target = Process.Start(new ProcessStartInfo("notepad.exe") { UseShellExecute = true });
            if (target is null)
            {
                write("SKIP external: notepad.exe did not start");
                return;
            }

            var info = WindowLocator.FindBest("notepad", null, null, TimeSpan.FromSeconds(10));
            if (info is null)
            {
                write("SKIP external: no visible notepad window in 10s");
                return;
            }
            write($"external phase: target hwnd=0x{info.Handle.ToInt64():X} pid={info.ProcessId} class={info.ClassName}");

            host = new NativeWindowHost { Width = 640, Height = 360 };
            var root = new System.Windows.Controls.Grid();
            root.Children.Add(host);
            hostWindow = new Window
            {
                Title = "Whaletide External Embedding Test",
                Width = 720,
                Height = 440,
                WindowStartupLocation = WindowStartupLocation.Manual,
                Left = 120,
                Top = 120,
                Content = root,
                ShowInTaskbar = false
            };
            hostWindow.Show();
            hostWindow.UpdateLayout();
            Drain(hostWindow.Dispatcher);

            if (!host.Embed(info.Handle))
            {
                write("FAIL external: SetParent rejected the window (UIPI or invalid handle)");
                return;
            }

            Drain(hostWindow.Dispatcher);

            if (GetParent(info.Handle) != host.HostHwnd)
            {
                write("FAIL external: GetParent(target) != host HWND");
                return;
            }
            if ((GetWindowLongPtr(info.Handle, GWL_STYLE) & WS_CHILD) == 0)
            {
                write("FAIL external: target did not receive WS_CHILD");
                return;
            }

            host.SyncSize();
            GetClientRect(host.HostHwnd, out var client);
            write($"PASS external: cross-process window embedded; host client={client.Width}x{client.Height}");

            host.Detach();
            Drain(hostWindow.Dispatcher);
            write(GetParent(info.Handle) == IntPtr.Zero
                ? "PASS external: target detached and restored to top level"
                : "FAIL external: target still parented after detach");
        }
        catch (Exception ex)
        {
            write($"FAIL external: {ex.GetType().Name}: {ex.Message}");
        }
        finally
        {
            try
            {
                host?.Detach();
            }
            catch
            {
                // Best-effort cleanup.
            }
            try
            {
                hostWindow?.Close();
            }
            catch
            {
                // Best-effort cleanup.
            }
            try
            {
                if (target is { HasExited: false }) target.Kill();
            }
            catch
            {
                // Notepad may already be gone or refuse to die; not a test failure.
            }
        }
    }

    private static void Drain(Dispatcher dispatcher)
    {
        var frame = new DispatcherFrame();
        dispatcher.BeginInvoke(DispatcherPriority.ContextIdle, new Action(() => frame.Continue = false));
        Dispatcher.PushFrame(frame);
    }
}

