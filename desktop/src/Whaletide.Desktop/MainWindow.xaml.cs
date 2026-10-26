using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using Whaletide.Desktop.Native;

namespace Whaletide.Desktop;

public partial class MainWindow : Window
{
    private const string VirtualHost = "whaletide.local";
    private const string VirtualOrigin = $"https://{VirtualHost}/";
    private const string StartupRegistryName = "WhaletideWpf";

    private readonly string _userDataRoot;
    private WindowInfo? _embeddedWindow;
    private bool _webViewReady;
    private bool _detachForClose;
    private bool _probeDone;
    private string _closeAction = "ask";
    private CancellationTokenSource? _mountCancellation;

    /// <summary>--probe 模式：界面加载完就取 DOM 快照并退出。</summary>
    public static bool ProbeRequested { get; set; }

    public MainWindow()
    {
        InitializeComponent();
        _userDataRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Whaletide");

        Loaded += MainWindow_Loaded;
        StateChanged += MainWindow_StateChanged;
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            StartupText.Text = "正在初始化 WebView2…";
            var webViewData = Path.Combine(_userDataRoot, "WebView2");
            Directory.CreateDirectory(webViewData);

            var environment = await CoreWebView2Environment.CreateAsync(null, webViewData);
            await Browser.EnsureCoreWebView2Async(environment);

            var core = Browser.CoreWebView2;
            core.Settings.AreDevToolsEnabled = true;
            core.Settings.AreDefaultContextMenusEnabled = true;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.AreBrowserAcceleratorKeysEnabled = true;

            core.WebMessageReceived += Core_WebMessageReceived;
            core.NewWindowRequested += Core_NewWindowRequested;
            core.NavigationStarting += Core_NavigationStarting;
            core.NavigationCompleted += Core_NavigationCompleted;
            core.PermissionRequested += Core_PermissionRequested;
            core.ProcessFailed += Core_ProcessFailed;

            var bridge = ReadEmbeddedText("Web.bridge.js");
            await core.AddScriptToExecuteOnDocumentCreatedAsync(bridge);

            var rendererRoot = Path.Combine(AppContext.BaseDirectory, "renderer");
            var entryPoint = Path.Combine(rendererRoot, "index.html");
            if (!File.Exists(entryPoint))
            {
                throw new FileNotFoundException("找不到 Vue 渲染产物。请先运行 npm run build。", entryPoint);
            }

            core.SetVirtualHostNameToFolderMapping(
                VirtualHost,
                rendererRoot,
                CoreWebView2HostResourceAccessKind.Allow);

            _webViewReady = true;
            core.Navigate(VirtualOrigin + "index.html");
            StartupText.Text = "正在加载界面…";
        }
        catch (Exception ex)
        {
            StartupText.Text = "启动失败";
            Browser.Visibility = Visibility.Collapsed;
            StartupMask.Visibility = Visibility.Visible;
            MessageBox.Show(this, "Whaletide WPF 外壳启动失败\n\n" + ex, "鲸汐启动失败", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private async void Core_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string? requestId = null;
        try
        {
            using var document = JsonDocument.Parse(e.WebMessageAsJson);
            var root = document.RootElement;
            if (GetString(root, "type") != "whaletide:request")
            {
                return;
            }

            requestId = GetString(root, "id");
            var method = GetString(root, "method");
            var args = root.TryGetProperty("args", out var argsElement) ? argsElement : default;
            var result = method switch
            {
                "android.mount" => await MountAndroidWindowAsync(args),
                "android.launch" => await LaunchAndroidWindowAsync(args),
                _ => HandleRequest(method, args)
            };
            Reply(requestId, result);
        }
        catch (Exception ex)
        {
            ReplyError(requestId, ex.Message);
        }
    }

    private object? HandleRequest(string method, JsonElement args)
    {
        switch (method)
        {
            case "window.isMaximized":
                return WindowState == WindowState.Maximized;
            case "window.minimize":
                WindowState = WindowState.Minimized;
                return true;
            case "window.maximize":
                WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
                return WindowState == WindowState.Maximized;
            case "window.close":
                Dispatcher.BeginInvoke(Close, DispatcherPriority.Background);
                return true;
            case "window.getCloseAction":
                return _closeAction;
            case "window.setCloseAction":
                var action = GetString(args, "action");
                if (action is "ask" or "tray" or "quit") _closeAction = action;
                return _closeAction;
            case "window.setChromeTheme":
                return true;
            case "settings.getOpenAtLogin":
                return GetOpenAtLogin();
            case "settings.setOpenAtLogin":
                return SetOpenAtLogin(GetBoolean(args, "openAtLogin"), GetBoolean(args, "openAsHidden"));
            case "app.getInfo":
                return new
                {
                    name = "Whaletide",
                    version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.3.7",
                    platform = "win32",
                    isPackaged = !Debugger.IsAttached,
                    userData = _userDataRoot
                };
            case "dialog.pickImage":
                return PickImage();
            case "icons.saveModuleIcon":
                return SaveModuleIcon(GetString(args, "moduleId"), GetString(args, "sourcePath"));
            case "icons.removeModuleIcon":
                return RemoveModuleIcon(GetString(args, "moduleId"));
            case "icons.fileUrl":
                return GetIconFileUrl(GetString(args, "filePath"));
            case "shell.openExternal":
                OpenExternal(GetString(args, "url"));
                return true;
            case "android.pickWindow":
                return PickWindowTarget();
            case "android.updateBounds":
                SetEmbeddedRect(ReadRect(args));
                return GetAndroidStatus();
            case "android.deactivate":
                CancelMount();
                HideEmbeddedWindow();
                return GetAndroidStatus();
            case "android.detach":
                CancelMount();
                DetachEmbeddedWindow();
                return GetAndroidStatus();
            case "android.status":
                return GetAndroidStatus();
            default:
                throw new InvalidOperationException($"Unsupported bridge method: {method}");
        }
    }

    private async Task<object> MountAndroidWindowAsync(JsonElement args)
    {
        var processName = GetString(args, "processName").Trim();
        if (processName.Length == 0)
        {
            throw new InvalidOperationException("Android 模块没有配置模拟器进程名");
        }

        var title = GetString(args, "title");
        var className = GetString(args, "className");
        var rect = ReadRect(args);
        var token = BeginMount();

        SetEmbeddedRect(rect);
        ShowEmbeddedWindow();

        var currentInfo = _embeddedWindow is null ? null : WindowLocator.FromHandle(_embeddedWindow.Handle);
        var currentMatches = currentInfo is not null && WindowLocator.Matches(
            currentInfo,
            processName,
            title,
            className);

        if (!currentMatches)
        {
            var target = await WindowLocator.FindBestAsync(
                    processName,
                    title,
                    className,
                    TimeSpan.FromMilliseconds(1200),
                    token)
                ?? throw new InvalidOperationException(
                    $"找不到进程为 {processName} 的可见窗口。请先启动模拟器并进入主界面。");
            token.ThrowIfCancellationRequested();
            EmbedWindow(target);
        }
        else
        {
            WindowHost.SetVisible(true);
        }

        _ = Dispatcher.BeginInvoke(PublishAndroidStatus, DispatcherPriority.Loaded);
        return GetAndroidStatus();
    }

    private async Task<object> LaunchAndroidWindowAsync(JsonElement args)
    {
        var executablePath = GetString(args, "executablePath").Trim();
        var processName = GetString(args, "processName").Trim();
        if (processName.Length == 0)
        {
            throw new InvalidOperationException("Android 模块没有配置模拟器进程名");
        }
        if (executablePath.Length == 0 || !File.Exists(executablePath))
        {
            throw new FileNotFoundException("找不到配置的模拟器或应用可执行文件", executablePath);
        }

        var rect = ReadRect(args);
        var title = GetString(args, "title");
        var className = GetString(args, "className");
        var token = BeginMount();

        // 模拟器已经在跑的时候直接复用，避免每次「启动并嵌入」都多开一个实例。
        var existing = WindowLocator.FindBest(processName, title, className, TimeSpan.FromSeconds(1.5));
        if (existing is not null)
        {
            token.ThrowIfCancellationRequested();
            SetEmbeddedRect(rect);
            EmbedWindow(existing);
            return GetAndroidStatus();
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = executablePath,
            WorkingDirectory = Path.GetDirectoryName(executablePath) ?? AppContext.BaseDirectory,
            UseShellExecute = true
        };
        var arguments = GetString(args, "arguments");
        if (arguments.Length > 0) startInfo.Arguments = arguments;
        if (Process.Start(startInfo) is null)
        {
            throw new InvalidOperationException("模拟器进程没有成功启动");
        }

        var target = await WindowLocator.FindBestAsync(
                processName,
                title,
                className,
                TimeSpan.FromSeconds(20),
                token)
            ?? throw new InvalidOperationException(
                $"模拟器已启动，但在 20 秒内没有找到进程 {processName} 的可见窗口。请在设置中重新选择目标窗口，并确认填写的进程名正确。");

        token.ThrowIfCancellationRequested();
        SetEmbeddedRect(rect);
        EmbedWindow(target);
        return GetAndroidStatus();
    }

    private static Rect ReadRect(JsonElement args)
    {
        return new Rect(
            GetDouble(args, "x"),
            GetDouble(args, "y"),
            Math.Max(1, GetDouble(args, "width", 1)),
            Math.Max(1, GetDouble(args, "height", 1)));
    }

    private CancellationToken BeginMount()
    {
        CancelMount();
        _mountCancellation = new CancellationTokenSource();
        return _mountCancellation.Token;
    }

    private void CancelMount()
    {
        try
        {
            _mountCancellation?.Cancel();
        }
        catch (ObjectDisposedException)
        {
            // Already finished.
        }
        _mountCancellation?.Dispose();
        _mountCancellation = null;
    }

    private object? PickWindowTarget()
    {
        // 用户取消不是错误：返回 null，让前端安静地什么都不做。
        var target = WindowPicker.Pick(this);
        if (target is null)
        {
            return null;
        }

        return new
        {
            handle = $"0x{target.Handle.ToInt64():X}",
            processId = target.ProcessId,
            processName = target.ProcessName,
            title = target.Title,
            className = target.ClassName,
            display = target.Display
        };
    }

    private void EmbedWindow(WindowInfo target)
    {
        ShowEmbeddedWindow();
        if (!WindowHost.Embed(target.Handle))
        {
            throw new InvalidOperationException(
                $"Windows 拒绝把窗口 0x{target.Handle.ToInt64():X} 设为子窗口。请确认模拟器与鲸汐以相同权限级别运行。");
        }

        _embeddedWindow = target;
        DetachButton.IsEnabled = true;
        TargetStateDot.Fill = (System.Windows.Media.Brush)new System.Windows.Media.BrushConverter().ConvertFrom("#14B8A6")!;
        TargetStateText.Text = $"{target.ProcessName} · 已嵌入";
        PublishAndroidStatus();
    }

    private void SetEmbeddedRect(Rect rect)
    {
        var availableWidth = Math.Max(1, ContentRoot.ActualWidth);
        var availableHeight = Math.Max(1, ContentRoot.ActualHeight);
        var left = Math.Clamp(rect.X, 0, Math.Max(0, availableWidth - 1));
        var top = Math.Clamp(rect.Y, 0, Math.Max(0, availableHeight - 1));
        var width = Math.Clamp(rect.Width, 1, Math.Max(1, availableWidth - left));
        var height = Math.Clamp(rect.Height, 1, Math.Max(1, availableHeight - top));

        NativeOverlay.Width = availableWidth;
        NativeOverlay.Height = availableHeight;
        System.Windows.Controls.Canvas.SetLeft(WindowHost, left);
        System.Windows.Controls.Canvas.SetTop(WindowHost, top);
        WindowHost.Width = width;
        WindowHost.Height = height;
        WindowHost.InvalidateMeasure();
        NativeOverlay.UpdateLayout();
        WindowHost.SyncSize();
    }

    private void ShowEmbeddedWindow()
    {
        NativeOverlay.Visibility = Visibility.Visible;
        NativeOverlay.UpdateLayout();
        if (WindowHost.ChildHwnd != IntPtr.Zero)
        {
            WindowHost.SetVisible(true);
        }
    }

    private void HideEmbeddedWindow()
    {
        if (WindowHost.ChildHwnd != IntPtr.Zero)
        {
            WindowHost.SetVisible(false);
        }
        NativeOverlay.Visibility = Visibility.Hidden;
        PublishAndroidStatus();
    }

    private void DetachEmbeddedWindow()
    {
        WindowHost.Detach();
        NativeOverlay.Visibility = Visibility.Collapsed;
        _embeddedWindow = null;
        DetachButton.IsEnabled = false;
        TargetStateDot.Fill = (System.Windows.Media.Brush)new System.Windows.Media.BrushConverter().ConvertFrom("#64748B")!;
        TargetStateText.Text = "未嵌入";
        PublishAndroidStatus();
    }

    private object GetAndroidStatus()
    {
        var info = _embeddedWindow is null ? null : WindowLocator.FromHandle(_embeddedWindow.Handle);
        return new
        {
            embedded = WindowHost.IsEmbedded,
            processName = info?.ProcessName ?? string.Empty,
            title = info?.Title ?? string.Empty,
            className = info?.ClassName ?? string.Empty,
            handle = info is null ? "0x0" : $"0x{info.Handle.ToInt64():X}"
        };
    }

    private void PublishAndroidStatus()
    {
        if (!_webViewReady || Browser.CoreWebView2 is null) return;
        SendEvent("android:status", GetAndroidStatus());
    }

    private static string ReadEmbeddedText(string suffix)
    {
        var assembly = Assembly.GetExecutingAssembly();
        var name = assembly.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException($"Embedded resource not found: {suffix}");
        using var stream = assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"Unable to open embedded resource: {name}");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    private void Reply(string? id, object? result)
    {
        SendJson(new { type = "whaletide:response", id, ok = true, result });
    }

    private void ReplyError(string? id, string error)
    {
        SendJson(new { type = "whaletide:response", id, ok = false, error });
    }

    private void SendEvent(string name, object? payload)
    {
        SendJson(new { type = "whaletide:event", @event = name, payload });
    }

    private void SendJson(object payload)
    {
        Browser.CoreWebView2?.PostWebMessageAsJson(JsonSerializer.Serialize(payload));
    }

    private void Core_NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
        {
            OpenExternal(uri.AbsoluteUri);
        }
    }

    private void Core_NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (e.Uri.StartsWith(VirtualOrigin, StringComparison.OrdinalIgnoreCase) ||
            e.Uri.Equals("about:blank", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        e.Cancel = true;
        if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
        {
            OpenExternal(uri.AbsoluteUri);
        }
    }

    private void Core_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (!e.IsSuccess)
        {
            StartupMask.Visibility = Visibility.Visible;
            StartupText.Text = $"界面加载失败（{e.WebErrorStatus}），请重新构建 renderer 后重启。";
            if (ProbeRequested) WriteProbe($"{{\"ok\":false,\"error\":\"navigation failed: {e.WebErrorStatus}\"}}");
            return;
        }

        StartupMask.Visibility = Visibility.Collapsed;
        _ = Dispatcher.BeginInvoke(PublishAndroidStatus, DispatcherPriority.Loaded);

        if (ProbeRequested && !_probeDone)
        {
            _probeDone = true;
            _ = RunProbeAsync();
        }
    }

    private const string ProbeScript = """
        (() => {
          const count = (sel) => document.querySelectorAll(sel).length;
          const bridge = window.workbench || null;
          return {
            readyState: document.readyState,
            title: document.title,
            theme: document.documentElement.getAttribute('data-theme') || '',
            shell: bridge ? String(bridge.shell || '') : '',
            impl: bridge ? String(bridge.impl || '') : '',
            hasAndroidBridge: !!(bridge && bridge.android),
            bodyLength: (document.body && document.body.innerText || '').trim().length,
            bodyPreview: (document.body && document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160),
            counts: {
              sidebar: count('.sidebar'),
              workspaces: count('.workspaces'),
              titlebar: count('.titlebar, .title-bar'),
              macRows: count('.mac-row'),
              svg: count('svg')
            }
          };
        })()
        """;

    private async Task RunProbeAsync()
    {
        string payload;
        try
        {
            var raw = await Browser.CoreWebView2!.ExecuteScriptAsync(ProbeScript);
            payload = $"{{\"ok\":true,\"probe\":{raw}}}";
        }
        catch (Exception ex)
        {
            payload = $"{{\"ok\":false,\"error\":{JsonSerializer.Serialize(ex.Message)}}}";
        }

        WriteProbe(payload);
        _ = Dispatcher.BeginInvoke(() => Application.Current.Shutdown(0), DispatcherPriority.Background);
    }

    private static void WriteProbe(string payload)
    {
        try
        {
            File.WriteAllText(Path.Combine(AppContext.BaseDirectory, "probe.log"), payload);
        }
        catch
        {
            // 探针写盘失败不应影响进程退出码语义。
        }
    }

    /// <summary>
    /// 壳内只信任本地虚拟主机的页面。媒体、剪贴板这类能力放给虚拟主机，
    /// 其余来源一律拒绝，避免嵌入的第三方页面静默拿到设备权限。
    /// </summary>
    private void Core_PermissionRequested(object? sender, CoreWebView2PermissionRequestedEventArgs e)
    {
        var isTrusted = Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) &&
                        uri.Host.Equals(VirtualHost, StringComparison.OrdinalIgnoreCase);

        var granted = isTrusted && e.PermissionKind is
            CoreWebView2PermissionKind.ClipboardRead or
            CoreWebView2PermissionKind.Notifications;

        e.State = granted ? CoreWebView2PermissionState.Allow : CoreWebView2PermissionState.Deny;
        e.Handled = true;
    }

    private void Core_ProcessFailed(object? sender, CoreWebView2ProcessFailedEventArgs e)
    {
        if (e.ProcessFailedKind == CoreWebView2ProcessFailedKind.BrowserProcessExited)
        {
            StartupMask.Visibility = Visibility.Visible;
            StartupText.Text = "WebView2 进程已退出，请重启鲸汐。";
        }
    }

    private void MainWindow_StateChanged(object? sender, EventArgs e)
    {
        MaximizeButton.Content = WindowState == WindowState.Maximized ? "❐" : "□";
        if (_webViewReady) SendEvent("window:maximized", WindowState == WindowState.Maximized);
    }

    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount == 2)
        {
            ToggleMaximize();
            return;
        }

        if (e.ButtonState == MouseButtonState.Pressed)
        {
            DragMove();
        }
    }

    private void ToggleMaximize()
    {
        WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
    }

    private void PickWindow_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var target = WindowPicker.Pick(this);
            if (target is null) return;
            SetEmbeddedRect(new Rect(0, 0, ContentRoot.ActualWidth, ContentRoot.ActualHeight));
            EmbedWindow(target);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "嵌入失败", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void DetachButton_Click(object sender, RoutedEventArgs e) => DetachEmbeddedWindow();
    private void MinimizeButton_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
    private void MaximizeButton_Click(object sender, RoutedEventArgs e) => ToggleMaximize();
    private void CloseButton_Click(object sender, RoutedEventArgs e) => Close();

    protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
    {
        if (!_detachForClose)
        {
            _detachForClose = true;
            try
            {
                WindowHost.Detach();
            }
            catch
            {
                // Restore is best-effort; never block closing.
            }
        }
        base.OnClosing(e);
    }

    private static object GetOpenAtLogin()
    {
        using var key = Registry.CurrentUser.OpenSubKey(
            @"Software\Microsoft\Windows\CurrentVersion\Run",
            writable: false);
        var exists = key?.GetValue(StartupRegistryName) is string;
        return new { openAtLogin = exists, openAsHidden = false, wasOpenedAtLogin = false };
    }

    private static object SetOpenAtLogin(bool enabled, bool openAsHidden)
    {
        using var key = Registry.CurrentUser.OpenSubKey(
            @"Software\Microsoft\Windows\CurrentVersion\Run",
            writable: true)
            ?? Registry.CurrentUser.CreateSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Run",
                writable: true);

        if (enabled)
        {
            var executable = Environment.ProcessPath
                ?? Path.Combine(AppContext.BaseDirectory, "Whaletide.Desktop.exe");
            key.SetValue(StartupRegistryName, $"\"{executable}\" --startup");
        }
        else
        {
            key.DeleteValue(StartupRegistryName, throwOnMissingValue: false);
        }

        return new { openAtLogin = enabled, openAsHidden };
    }

    private string? PickImage()
    {
        var dialog = new OpenFileDialog
        {
            Title = "选择模块图标",
            Filter = "图片文件|*.png;*.jpg;*.jpeg;*.webp;*.ico;*.bmp|所有文件|*.*",
            CheckFileExists = true,
            Multiselect = false
        };
        return dialog.ShowDialog(this) == true ? dialog.FileName : null;
    }

    private string SaveModuleIcon(string moduleId, string sourcePath)
    {
        if (!File.Exists(sourcePath))
        {
            throw new FileNotFoundException("图标文件不存在", sourcePath);
        }

        var safeId = SanitizeModuleId(moduleId);
        var iconDirectory = Path.Combine(_userDataRoot, "icons");
        Directory.CreateDirectory(iconDirectory);
        var extension = Path.GetExtension(sourcePath).ToLowerInvariant();
        if (extension.Length == 0) extension = ".png";
        var destination = Path.Combine(iconDirectory, safeId + extension);
        File.Copy(sourcePath, destination, overwrite: true);
        return destination;
    }

    private bool RemoveModuleIcon(string moduleId)
    {
        var safeId = SanitizeModuleId(moduleId);
        var iconDirectory = Path.Combine(_userDataRoot, "icons");
        if (!Directory.Exists(iconDirectory)) return true;
        foreach (var file in Directory.EnumerateFiles(iconDirectory, safeId + ".*"))
        {
            File.Delete(file);
        }
        return true;
    }

    private static string? GetIconFileUrl(string filePath)
    {
        if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath)) return null;
        var info = new FileInfo(filePath);
        if (info.Length <= 0 || info.Length > 8 * 1024 * 1024) return null;

        var mime = Path.GetExtension(filePath).ToLowerInvariant() switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".ico" => "image/x-icon",
            ".bmp" => "image/bmp",
            _ => "image/png"
        };
        return $"data:{mime};base64,{Convert.ToBase64String(File.ReadAllBytes(filePath))}";
    }

    private static string SanitizeModuleId(string moduleId)
    {
        var safe = new string(moduleId.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray());
        if (safe.Length == 0) throw new InvalidOperationException("无效的模块 ID");
        return safe;
    }

    private static void OpenExternal(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new InvalidOperationException("只允许打开 HTTP/HTTPS 链接");
        }

        Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
    }

    private static string GetString(JsonElement element, string propertyName, string fallback = "")
    {
        return element.ValueKind == JsonValueKind.Object &&
               element.TryGetProperty(propertyName, out var value) &&
               value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? fallback
            : fallback;
    }

    private static double GetDouble(JsonElement element, string propertyName, double fallback = 0)
    {
        return element.ValueKind == JsonValueKind.Object &&
               element.TryGetProperty(propertyName, out var value) &&
               value.ValueKind == JsonValueKind.Number &&
               value.TryGetDouble(out var number)
            ? number
            : fallback;
    }

    private static bool GetBoolean(JsonElement element, string propertyName, bool fallback = false)
    {
        return element.ValueKind == JsonValueKind.Object &&
               element.TryGetProperty(propertyName, out var value) &&
               value.ValueKind is JsonValueKind.True or JsonValueKind.False
            ? value.GetBoolean()
            : fallback;
    }
}
