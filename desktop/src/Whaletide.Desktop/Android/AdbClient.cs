using System.Diagnostics;
using System.Text;

namespace Whaletide.Desktop.Android;

public sealed record AdbResult(int ExitCode, string StdOut, string StdErr)
{
    public bool Ok => ExitCode == 0;
    public string Message => string.IsNullOrWhiteSpace(StdErr) ? StdOut.Trim() : StdErr.Trim();
}

/// <summary>adb 的薄封装。所有调用都带超时，避免 install 卡死拖垮 UI 线程。</summary>
public sealed class AdbClient
{
    private readonly string _adbPath;
    private readonly string _serial;

    public AdbClient(string adbPath, string serial)
    {
        _adbPath = adbPath;
        _serial = serial;
    }

    public string Serial => _serial;

    public async Task<AdbResult> RunAsync(
        IReadOnlyList<string> args,
        TimeSpan? timeout = null,
        CancellationToken token = default)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = _adbPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };
        foreach (var arg in args)
        {
            startInfo.ArgumentList.Add(arg);
        }

        using var process = new Process { StartInfo = startInfo };
        if (!process.Start())
        {
            return new AdbResult(-1, string.Empty, "无法启动 adb");
        }

        var stdout = process.StandardOutput.ReadToEndAsync(token);
        var stderr = process.StandardError.ReadToEndAsync(token);

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(token);
        cts.CancelAfter(timeout ?? TimeSpan.FromSeconds(30));
        try
        {
            await process.WaitForExitAsync(cts.Token);
        }
        catch (OperationCanceledException)
        {
            try
            {
                process.Kill(entireProcessTree: true);
            }
            catch
            {
                // 进程可能已经自己退出
            }
            return new AdbResult(-1, string.Empty, "adb 命令超时");
        }

        return new AdbResult(process.ExitCode, await stdout, await stderr);
    }

    /// <summary>带 -s 的调用；设备没起来时会立刻失败，不做重试。</summary>
    public Task<AdbResult> RunDeviceAsync(
        IReadOnlyList<string> args,
        TimeSpan? timeout = null,
        CancellationToken token = default)
    {
        var full = new List<string> { "-s", _serial };
        full.AddRange(args);
        return RunAsync(full, timeout, token);
    }

    public Task<AdbResult> ShellAsync(string command, TimeSpan? timeout = null, CancellationToken token = default)
        => RunDeviceAsync(new[] { "shell", command }, timeout, token);

    public async Task<bool> IsBootedAsync(CancellationToken token = default)
    {
        var result = await ShellAsync("getprop sys.boot_completed", TimeSpan.FromSeconds(10), token);
        return result.Ok && result.StdOut.Trim() == "1";
    }

    public async Task<AdbResult> InstallAsync(string apkPath, CancellationToken token = default)
    {
        // -g：直接授予运行时权限，避免装完还要在模拟器里点一遍授权
        return await RunDeviceAsync(
            new[] { "install", "-r", "-g", apkPath },
            TimeSpan.FromMinutes(5),
            token);
    }

    public async Task<IReadOnlyList<string>> ListThirdPartyPackagesAsync(CancellationToken token = default)
    {
        var result = await ShellAsync("pm list packages -3", TimeSpan.FromSeconds(30), token);
        if (!result.Ok)
        {
            return Array.Empty<string>();
        }

        return result.StdOut
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(line => line.StartsWith("package:", StringComparison.Ordinal) ? line[8..] : line)
            .Where(line => line.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .OrderBy(line => line, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    /// <summary>解析启动 Activity，拿不到就回退到 monkey 的 LAUNCHER 启动。</summary>
    public async Task<string?> ResolveLauncherAsync(string packageName, CancellationToken token = default)
    {
        var result = await ShellAsync(
            $"cmd package resolve-activity --brief {packageName}",
            TimeSpan.FromSeconds(15),
            token);
        if (!result.Ok)
        {
            return null;
        }

        return result.StdOut
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .LastOrDefault(line => line.Contains('/') && line.Contains(packageName));
    }

    public async Task<AdbResult> LaunchAsync(string packageName, CancellationToken token = default)
    {
        var component = await ResolveLauncherAsync(packageName, token);
        if (!string.IsNullOrWhiteSpace(component))
        {
            var started = await ShellAsync($"am start -n {component}", TimeSpan.FromSeconds(30), token);
            if (started.Ok && !started.StdOut.Contains("Error", StringComparison.OrdinalIgnoreCase))
            {
                return started;
            }
        }

        return await ShellAsync(
            $"monkey -p {packageName} -c android.intent.category.LAUNCHER 1",
            TimeSpan.FromSeconds(30),
            token);
    }

    public Task<AdbResult> ForceStopAsync(string packageName, CancellationToken token = default)
        => ShellAsync($"am force-stop {packageName}", TimeSpan.FromSeconds(15), token);

    public Task<AdbResult> UninstallAsync(string packageName, CancellationToken token = default)
        => RunDeviceAsync(new[] { "uninstall", packageName }, TimeSpan.FromSeconds(60), token);

    public async Task<IReadOnlyList<string>> DevicesAsync(CancellationToken token = default)
    {
        var result = await RunAsync(new[] { "devices" }, TimeSpan.FromSeconds(15), token);
        if (!result.Ok)
        {
            return Array.Empty<string>();
        }

        return result.StdOut
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Skip(1)
            .Where(line => line.Contains('\t') && !line.Contains("offline", StringComparison.OrdinalIgnoreCase))
            .Select(line => line.Split('\t')[0])
            .ToList();
    }
}
