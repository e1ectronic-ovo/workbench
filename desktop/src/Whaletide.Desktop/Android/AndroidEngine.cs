using System.Diagnostics;
using System.IO;

namespace Whaletide.Desktop.Android;

public enum AndroidEngineState
{
    NotInstalled,
    Stopped,
    Starting,
    Running,
    Stopping
}

/// <summary>
/// 客户端自己的 Android 引擎：拉起一个私有 AVD、等它开机完成、通过 adb 管应用。
///
/// 和「驱动用户已装的模拟器」的本质区别是：运行时由客户端准备、实例由客户端管理，
/// 用户装完客户端就能直接装 APK，不需要再装任何第三方模拟器。
/// </summary>
public sealed class AndroidEngine : IDisposable
{
    private readonly AndroidSdk _sdk = new();
    private readonly SemaphoreSlim _gate = new(1, 1);
    private Process? _emulator;
    private AndroidEngineState _state = AndroidEngineState.Stopped;
    private string _lastError = string.Empty;
    /// <summary>emulator 最近的输出，用于失败时解释原因（也是防止管道阻塞的消费端）。</summary>
    private readonly Queue<string> _emulatorLog = new();

    /// <summary>内置引擎的窗口属于 qemu 进程，不是 emulator.exe（后者只是启动器）。</summary>
    public const string WindowProcessName = "qemu-system-x86_64";

    public AndroidSdk Sdk => _sdk;
    public AndroidEngineState State => _state;
    public string LastError => _lastError;

    public AdbClient? CreateAdb()
        => File.Exists(_sdk.AdbPath) ? new AdbClient(_sdk.AdbPath, _sdk.Serial) : null;

    public object GetStatus()
    {
        var installed = _sdk.IsInstalled;
        if (!installed && _state != AndroidEngineState.Starting)
        {
            _state = AndroidEngineState.NotInstalled;
        }

        var profile = HardwareProfile.Detect();
        return new
        {
            installed,
            avdReady = _sdk.HasAvd,
            state = _state.ToString().ToLowerInvariant(),
            serial = _sdk.Serial,
            root = _sdk.Root,
            image = $"{_sdk.AvdName}",
            lastError = _lastError,
            windowProcess = WindowProcessName,
            hardware = new
            {
                cpuCores = profile.CpuCores,
                ramMegabytes = profile.RamMegabytes,
                gpuMode = profile.GpuMode,
                accelerator = HardwareProfile.DetectAccelerator()
            }
        };
    }

    public async Task<object> PrepareAsync(IProgress<string> progress, CancellationToken token = default)
    {
        await _gate.WaitAsync(token);
        try
        {
            _lastError = string.Empty;
            await _sdk.EnsureAsync(progress, token);
            return GetStatus();
        }
        catch (Exception ex)
        {
            _lastError = ex.Message;
            throw;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>启动引擎：没有运行时先准备，然后拉起 AVD 并等到开机完成。</summary>
    public async Task<object> StartAsync(IProgress<string> progress, CancellationToken token = default)
    {
        await _gate.WaitAsync(token);
        try
        {
            if (_state == AndroidEngineState.Running && await IsBootedAsync(token))
            {
                progress.Report("引擎已在运行");
                return GetStatus();
            }

            _state = AndroidEngineState.Starting;
            _lastError = string.Empty;

            if (!_sdk.IsInstalled)
            {
                progress.Report("首次启动，正在准备 Android 运行时…");
                await _sdk.EnsureAsync(progress, token);
            }

            var adb = CreateAdb() ?? throw new InvalidOperationException("找不到 adb，请重新准备运行时");

            // 上次客户端退出时故意没杀引擎，这里先看看是不是已经有一个跑着的实例可以复用。
            // 冷启要 1–3 分钟，能复用就别重启。
            var devices = await adb.DevicesAsync(token);
            if (devices.Contains(_sdk.Serial, StringComparer.OrdinalIgnoreCase) && await adb.IsBootedAsync(token))
            {
                progress.Report("复用已在运行的引擎");
                // 复用的实例可能是上一版客户端启动的，性能设置一样要补齐
                await ApplyPerformanceTweaksAsync(adb, progress, token);
                _state = AndroidEngineState.Running;
                return GetStatus();
            }

            // 上次残留的半启动实例（用户直接关窗等）先收掉，避免端口占用
            if (_emulator is { HasExited: false })
            {
                await adb.RunAsync(new[] { "-s", _sdk.Serial, "emu", "kill" }, TimeSpan.FromSeconds(10), token);
                await WaitExitAsync(_emulator, TimeSpan.FromSeconds(10));
            }

            // 老 AVD 的 config.ini 是旧版本写的（4 核 / 3GB / gpu=auto），
            // 客户端升级后要能自动吃到按当前宿主算出来的硬件分配。
            if (_sdk.SyncAvdPerformance())
            {
                progress.Report("已按当前硬件更新 AVD 配置");
            }
            var profile = HardwareProfile.Detect();

            // host 直通独显是最快的路径，但在少数 Optimus / 虚拟显示器环境里会直接崩。
            // 崩了就退回 auto，宁可慢一点也不要整个引擎不可用。
            var gpuModes = profile.GpuMode == "host"
                ? new[] { "host", "auto" }
                : new[] { profile.GpuMode };

            Exception? lastError = null;
            foreach (var gpuMode in gpuModes)
            {
                progress.Report(
                    $"启动 Android 引擎（{profile.CpuCores} 核 / {profile.RamMegabytes}MB / GPU {gpuMode}）…");
                LaunchEmulator(gpuMode);

                try
                {
                    await WaitForDeviceAsync(adb, progress, token);
                    await WaitForBootAsync(adb, progress, token);
                    lastError = null;
                    break;
                }
                catch (Exception ex) when (gpuMode == "host" && !token.IsCancellationRequested)
                {
                    lastError = ex;
                    progress.Report($"GPU host 模式没起来（{ex.Message}），改用 auto 重试…");
                    await KillEmulatorAsync(token);
                }
            }

            if (lastError is not null)
            {
                throw lastError;
            }

            await ApplyPerformanceTweaksAsync(adb, progress, token);

            _state = AndroidEngineState.Running;
            progress.Report("引擎已就绪");
            return GetStatus();
        }
        catch (Exception ex)
        {
            _state = AndroidEngineState.Stopped;
            _lastError = ex.Message;
            throw;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>
    /// 开机后应用一组性能设置。
    ///
    /// 这不是「调参数让它看起来快」，而是去掉模拟器场景下纯属浪费的开销：
    /// 系统过渡动画在虚拟化环境里每帧都要走一遍 VM exit，而它本身没有任何信息量。
    /// 关掉后代画面跳变更干脆，感知上明显更跟手。
    /// </summary>
    private static async Task ApplyPerformanceTweaksAsync(
        AdbClient adb,
        IProgress<string> progress,
        CancellationToken token)
    {
        var tweaks = new[]
        {
            new[] { "shell", "settings", "put", "global", "window_animation_scale", "0" },
            new[] { "shell", "settings", "put", "global", "transition_animation_scale", "0" },
            // 安装时跳过 adb 校验，装大 APK 能省十几秒
            new[] { "shell", "settings", "put", "global", "verifier_verify_adb_installs", "0" }
        };

        foreach (var tweak in tweaks)
        {
            token.ThrowIfCancellationRequested();
            try
            {
                await adb.RunAsync(tweak, TimeSpan.FromSeconds(8), token);
            }
            catch
            {
                // 单项失败不该让整个启动流程失败
            }
        }
        progress.Report("已关闭系统过渡动画");
    }

    public async Task<object> StopAsync(CancellationToken token = default)
    {
        await _gate.WaitAsync(token);
        try
        {
            _state = AndroidEngineState.Stopping;
            var adb = CreateAdb();
            if (adb is not null)
            {
                await adb.RunAsync(new[] { "-s", _sdk.Serial, "emu", "kill" }, TimeSpan.FromSeconds(15), token);
            }

            if (_emulator is not null)
            {
                await WaitExitAsync(_emulator, TimeSpan.FromSeconds(15));
                if (!_emulator.HasExited)
                {
                    _emulator.Kill(entireProcessTree: true);
                }
                _emulator.Dispose();
                _emulator = null;
            }

            _state = AndroidEngineState.Stopped;
            return GetStatus();
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<bool> IsBootedAsync(CancellationToken token)
    {
        var adb = CreateAdb();
        return adb is not null && await adb.IsBootedAsync(token);
    }

    /// <summary>拉起 emulator 进程。<c>-gpu</c> 显式传，避免 AVD 里的旧值覆盖。</summary>
    private void LaunchEmulator(string gpuMode)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = _sdk.EmulatorPath,
            WorkingDirectory = Path.GetDirectoryName(_sdk.EmulatorPath)!,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        foreach (var arg in new[]
                 {
                     "-avd", _sdk.AvdName,
                     "-no-boot-anim",
                     "-no-snapshot-save",
                     "-netdelay", "none",
                     "-netspeed", "full",
                     "-gpu", gpuMode
                 })
        {
            startInfo.ArgumentList.Add(arg);
        }
        startInfo.Environment["ANDROID_SDK_ROOT"] = _sdk.Root;
        startInfo.Environment["ANDROID_HOME"] = _sdk.Root;

        var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException("模拟器进程没有启动");

        // 必须把管道读空。重定向了却没人读，子进程写满 4KB 缓冲后会永久阻塞在 write()，
        // 表现就是「进程活着但永远不上线」——这个坑排查起来非常费时间。
        _emulatorLog.Clear();
        void Capture(object? _, DataReceivedEventArgs e)
        {
            if (e.Data is null)
            {
                return;
            }
            lock (_emulatorLog)
            {
                _emulatorLog.Enqueue(e.Data);
                while (_emulatorLog.Count > 40)
                {
                    _emulatorLog.Dequeue();
                }
            }
        }

        process.OutputDataReceived += Capture;
        process.ErrorDataReceived += Capture;
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        _emulator = process;
    }

    /// <summary>把 emulator 最近输出拼成一段，用于失败时的错误信息。</summary>
    private string EmulatorLogTail(int lines = 12)
    {
        lock (_emulatorLog)
        {
            return string.Join(Environment.NewLine, _emulatorLog.TakeLast(lines));
        }
    }

    /// <summary>内部重试用：不等 adb，直接收掉当前实例。</summary>
    private async Task KillEmulatorAsync(CancellationToken token)
    {
        if (_emulator is null)
        {
            return;
        }

        try
        {
            var adb = CreateAdb();
            if (adb is not null)
            {
                await adb.RunAsync(new[] { "-s", _sdk.Serial, "emu", "kill" }, TimeSpan.FromSeconds(8), token);
            }
            await WaitExitAsync(_emulator, TimeSpan.FromSeconds(10));
            if (!_emulator.HasExited)
            {
                _emulator.Kill(entireProcessTree: true);
            }
        }
        catch
        {
            // 收不掉也不该把原始错误盖掉
        }
        finally
        {
            _emulator?.Dispose();
            _emulator = null;
        }
    }

    private async Task WaitForDeviceAsync(AdbClient adb, IProgress<string> progress, CancellationToken token)
    {
        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(90);
        while (DateTime.UtcNow < deadline)
        {
            token.ThrowIfCancellationRequested();
            if (_emulator is { HasExited: true })
            {
                throw new InvalidOperationException(
                    $"模拟器进程提前退出（代码 {_emulator.ExitCode}）。{EmulatorLogTail()}");
            }

            var devices = await adb.DevicesAsync(token);
            if (devices.Contains(_sdk.Serial, StringComparer.OrdinalIgnoreCase))
            {
                progress.Report("设备已连接，等待系统启动…");
                return;
            }

            await Task.Delay(1000, token);
        }

        throw new TimeoutException($"90 秒内没有等到模拟器上线。{EmulatorLogTail()}");
    }

    private async Task WaitForBootAsync(AdbClient adb, IProgress<string> progress, CancellationToken token)
    {
        var deadline = DateTime.UtcNow + TimeSpan.FromMinutes(5);
        var lastTick = DateTime.UtcNow;
        while (DateTime.UtcNow < deadline)
        {
            token.ThrowIfCancellationRequested();
            if (await adb.IsBootedAsync(token))
            {
                return;
            }

            if (DateTime.UtcNow - lastTick > TimeSpan.FromSeconds(10))
            {
                lastTick = DateTime.UtcNow;
                progress.Report("系统启动中…");
            }

            await Task.Delay(1500, token);
        }

        throw new TimeoutException("5 分钟内系统没有完成开机");
    }

    private static async Task WaitExitAsync(Process process, TimeSpan timeout)
    {
        try
        {
            using var cts = new CancellationTokenSource(timeout);
            await process.WaitForExitAsync(cts.Token);
        }
        catch (OperationCanceledException)
        {
            // 调用方决定是否需要强杀
        }
    }

    public void Dispose()
    {
        try
        {
            if (_emulator is { HasExited: false })
            {
                _emulator.Kill(entireProcessTree: true);
            }
        }
        catch
        {
            // 退出路径上的清理尽力而为
        }
        _emulator?.Dispose();
        _gate.Dispose();
    }
}
