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
    public int Width { get; init; }
    public int Height { get; init; }
    /// <summary>WS_EX_TOOLWINDOW：浮动工具栏/提示条一类，不是主显示窗口。</summary>
    public bool IsToolWindow { get; init; }

    public int Area => Width * Height;

    public string Display =>
        $"{ProcessName}  ·  {(string.IsNullOrWhiteSpace(Title) ? "(无标题)" : Title)}  ·  {ClassName}  ·  {Width}×{Height}  ·  0x{Handle.ToInt64():X}";
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

            GetWindowRect(hwnd, out var rect);
            var exStyle = GetWindowLongPtr(hwnd, GWL_EXSTYLE);
            result.Add(new WindowInfo(hwnd, (int)pid, processName, title, className)
            {
                Width = Math.Max(0, rect.Right - rect.Left),
                Height = Math.Max(0, rect.Bottom - rect.Top),
                IsToolWindow = (exStyle & WS_EX_TOOLWINDOW) != 0
            });
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
                // 分数相同时选面积最大的：主显示窗口一定比辅助窗口大
                .ThenByDescending(x => x.Window.Area)
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

    /// <summary>太小的窗口不可能是主显示区域，用来过滤掉按钮条、提示气泡。</summary>
    private const int MinWindowSize = 160;

    /// <summary>
    /// 隐藏同进程的浮动工具栏。
    ///
    /// 模拟器（qemu）除了主显示窗口，还会有一个 WS_EX_TOOLWINDOW 的侧边按钮条。
    /// 主窗口被 SetParent 进宿主后，这个按钮条仍然作为独立窗口浮在桌面上，
    /// 视觉上就像贴在客户端界面上的一块异物。客户端自己有控制入口，直接收起来。
    /// </summary>
    /// <returns>被隐藏的窗口数量。</returns>
    public static int HideToolWindows(string processName, IntPtr keep)
    {
        var hidden = 0;
        foreach (var window in EnumerateTopLevelWindows())
        {
            if (window.Handle == keep)
            {
                continue;
            }
            if (!window.IsToolWindow)
            {
                continue;
            }
            if (!string.Equals(
                    NormalizeProcessName(window.ProcessName),
                    NormalizeProcessName(processName),
                    StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }
            if (IsWindowVisible(window.Handle))
            {
                ShowWindow(window.Handle, SW_HIDE);
                hidden++;
            }
        }
        return hidden;
    }

    /// <summary>把之前被 <see cref="HideToolWindows"/> 收起来的工具栏放回去。</summary>
    public static int ShowToolWindows(string processName)
    {
        var shown = 0;
        foreach (var window in EnumerateTopLevelWindows(visibleOnly: false))
        {
            if (!window.IsToolWindow)
            {
                continue;
            }
            if (!string.Equals(
                    NormalizeProcessName(window.ProcessName),
                    NormalizeProcessName(processName),
                    StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }
            if (!IsWindowVisible(window.Handle))
            {
                ShowWindow(window.Handle, SW_SHOW);
                shown++;
            }
        }
        return shown;
    }

    private static int Score(WindowInfo window, string? title, string? className)
    {
        var score = 1;
        if (!string.IsNullOrWhiteSpace(className))
        {
            // 用户显式指定了类名，就完全按他的意思来，不再做启发式排除
            if (!string.Equals(window.ClassName, className, StringComparison.OrdinalIgnoreCase))
            {
                return -1;
            }
            score += 4;
        }
        else
        {
            // 没指定类名时的启发式排除。
            //
            // 模拟器（qemu）进程会有上百个窗口，其中可见的通常只有两个：
            // 一个 54×508 的 WS_EX_TOOLWINDOW 侧边按钮条（标题 "Emulator"），
            // 和一个真正的主显示窗口。如果只按标题长度排序，短标题的按钮条会胜出，
            // 而那个按钮条存在时间很短，SetParent 拿到的句柄往往已经失效。
            if (window.IsToolWindow)
            {
                return -1;
            }
            if (window.Width < MinWindowSize || window.Height < MinWindowSize)
            {
                return -1;
            }
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
