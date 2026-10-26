using System.Diagnostics;
using System.Text;
using static Whaletide.Desktop.Native.NativeMethods;

namespace Whaletide.Desktop.Native;

public sealed record WindowInfo(
    IntPtr Handle,
    int ProcessId,
    string ProcessName,
    string Title,
    string ClassName)
{
    public string Display =>
        $"{ProcessName}  ·  {(string.IsNullOrWhiteSpace(Title) ? "(无标题)" : Title)}  ·  {ClassName}  ·  0x{Handle.ToInt64():X}";
}

public static class WindowLocator
{
    /// <summary>当前进程之外、可见的顶层窗口。</summary>
    public static IReadOnlyList<WindowInfo> EnumerateTopLevelWindows(bool visibleOnly = true)
    {
        var result = new List<WindowInfo>();
        var ownPid = Environment.ProcessId;

        EnumWindows((hwnd, _) =>
        {
            if (visibleOnly && !IsWindowVisible(hwnd))
            {
                return true;
            }

            GetWindowThreadProcessId(hwnd, out var pid);
            if (pid == 0 || pid == ownPid)
            {
                return true;
            }

            var title = GetWindowTextSafe(hwnd);
            var className = GetClassNameSafe(hwnd);
            if (string.IsNullOrWhiteSpace(title) && string.IsNullOrWhiteSpace(className))
            {
                return true;
            }

            string processName;
            try
            {
                processName = Process.GetProcessById((int)pid).ProcessName;
            }
            catch
            {
                return true;
            }

            result.Add(new WindowInfo(hwnd, (int)pid, processName, title, className));
            return true;
        }, IntPtr.Zero);

        return result
            .OrderBy(w => w.ProcessName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(w => w.Title, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public static WindowInfo? FindByProcessName(string processName, TimeSpan? timeout = null)
    {
        return FindBest(processName, null, null, timeout);
    }

    /// <summary>
    /// 按进程名、标题和窗口类名匹配最可信的顶层窗口。
    /// 同一进程可能有多个窗口，标题/类名用于缩小到模拟器主显示窗口。
    /// </summary>
    public static WindowInfo? FindBest(
        string processName,
        string? title = null,
        string? className = null,
        TimeSpan? timeout = null)
    {
        var deadline = DateTime.UtcNow + (timeout ?? TimeSpan.Zero);
        while (true)
        {
            var hit = EnumerateTopLevelWindows()
                .Where(w => string.Equals(
                    NormalizeProcessName(w.ProcessName),
                    NormalizeProcessName(processName),
                    StringComparison.OrdinalIgnoreCase))
                .Select(w => new { Window = w, Score = Score(w, title, className) })
                .Where(x => x.Score >= 0)
                .OrderByDescending(x => x.Score)
                .ThenBy(x => x.Window.Title.Length)
                .Select(x => x.Window)
                .FirstOrDefault();

            if (hit is not null)
            {
                return hit;
            }
            if (DateTime.UtcNow >= deadline)
            {
                return null;
            }
            Thread.Sleep(120);
        }
    }

    /// <summary>异步轮询目标窗口，避免阻塞 WebView2 的 UI 线程。</summary>
    public static async Task<WindowInfo?> FindBestAsync(
        string processName,
        string? title = null,
        string? className = null,
        TimeSpan? timeout = null,
        CancellationToken cancellationToken = default)
    {
        var deadline = DateTime.UtcNow + (timeout ?? TimeSpan.Zero);
        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var hit = FindBest(processName, title, className, TimeSpan.Zero);
            if (hit is not null)
            {
                return hit;
            }
            if (DateTime.UtcNow >= deadline)
            {
                return null;
            }
            await Task.Delay(120, cancellationToken);
        }
    }

    public static bool Matches(
        WindowInfo window,
        string processName,
        string? title = null,
        string? className = null)
    {
        return string.Equals(
                NormalizeProcessName(window.ProcessName),
                NormalizeProcessName(processName),
                StringComparison.OrdinalIgnoreCase) &&
            (string.IsNullOrWhiteSpace(className) ||
             string.Equals(window.ClassName, className, StringComparison.OrdinalIgnoreCase)) &&
            (string.IsNullOrWhiteSpace(title) ||
             window.Title.Contains(title, StringComparison.OrdinalIgnoreCase));
    }

    private static int Score(WindowInfo window, string? title, string? className)
    {
        var score = 1;
        if (!string.IsNullOrWhiteSpace(className))
        {
            if (!string.Equals(window.ClassName, className, StringComparison.OrdinalIgnoreCase))
            {
                return -1;
            }
            score += 4;
        }

        if (!string.IsNullOrWhiteSpace(title))
        {
            if (string.Equals(window.Title, title, StringComparison.OrdinalIgnoreCase))
            {
                score += 3;
            }
            else if (window.Title.Contains(title, StringComparison.OrdinalIgnoreCase))
            {
                score += 1;
            }
            else
            {
                return -1;
            }
        }

        return score;
    }

    private static string NormalizeProcessName(string processName)
    {
        var value = processName.Trim();
        if (value.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
        {
            value = value[..^4];
        }
        return value;
    }

    public static WindowInfo? FromHandle(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero || !IsWindow(hwnd))
        {
            return null;
        }

        GetWindowThreadProcessId(hwnd, out var pid);
        string processName;
        try
        {
            processName = Process.GetProcessById((int)pid).ProcessName;
        }
        catch
        {
            processName = "unknown";
        }

        return new WindowInfo(hwnd, (int)pid, processName, GetWindowTextSafe(hwnd), GetClassNameSafe(hwnd));
    }

    private static string GetWindowTextSafe(IntPtr hwnd)
    {
        var length = GetWindowTextLength(hwnd);
        if (length <= 0)
        {
            return string.Empty;
        }

        var buffer = new StringBuilder(length + 1);
        GetWindowText(hwnd, buffer, buffer.Capacity);
        return buffer.ToString();
    }

    private static string GetClassNameSafe(IntPtr hwnd)
    {
        var buffer = new StringBuilder(256);
        GetClassName(hwnd, buffer, buffer.Capacity);
        return buffer.ToString();
    }
}
