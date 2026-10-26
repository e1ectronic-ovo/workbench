using System.Runtime.InteropServices;

namespace Whaletide.Desktop.Android;

/// <summary>
/// 宿主硬件画像：决定给 Android 实例分多少核、多少内存、用哪个 GPU 后端。
///
/// 之前这些值是写死的（4 核 / 3GB / gpu=auto），在 8 核 16GB + 独显的机器上
/// 相当于把一半性能留在桌上；更糟的是 <c>gpu=auto</c> 在多显示适配器（远程控制
/// 的虚拟显示器、Optimus 核显）的机器上会选错设备，甚至回退到软件渲染。
/// </summary>
public sealed record HardwareProfile(int CpuCores, int RamMegabytes, string GpuMode)
{
    /// <summary>Android 调度器在 6 核以上收益递减，8 核以上反而增加 QEMU 同步开销。</summary>
    private const int MaxCores = 6;

    private const int MinCores = 2;
    private const int MinRamMb = 2048;
    private const int MaxRamMb = 6144;

    public static HardwareProfile Detect()
    {
        var logical = Math.Max(1, Environment.ProcessorCount);

        // 逻辑核 / 2 ≈ 物理核（有超线程时准确，无超线程时偏保守）。
        // 保守是有意的：给宿主留出核，比让 QEMU 和宿主抢核更流畅。
        var cores = Math.Clamp(logical / 2, MinCores, MaxCores);

        // 总内存的 1/4 给模拟器。不用「当前可用内存」是因为那个值波动大，
        // 冷启动瞬间经常很低，会把配置算成一个荒谬的小值。
        var totalMb = (int)Math.Min(int.MaxValue, TotalPhysicalBytes() / (1024 * 1024));
        var ram = totalMb > 0
            ? Math.Clamp(totalMb / 4, MinRamMb, MaxRamMb)
            : 3072;
        // 对齐到 512MB，避免出现 4058 这种看起来像手抖的值
        ram = (int)(Math.Round(ram / 512.0) * 512);

        return new HardwareProfile(cores, ram, ResolveGpuMode());
    }

    /// <summary>
    /// GPU 后端。默认 host：直接用宿主显卡（含独显），这是唯一能吃到硬件光栅化的模式。
    ///
    /// auto 看起来更安全，但在装了远程控制软件（向日葵 / ToDesk 之类会注册虚拟显示器）
    /// 的机器上，它会挑到虚拟适配器，然后报 "Software OpenGL failed" 回退到软渲染，
    /// 表现就是整体发卡。留一个环境变量给确实跑不起来的机器退回 auto。
    /// </summary>
    private static string ResolveGpuMode()
    {
        var forced = Environment.GetEnvironmentVariable("WHALETIDE_ANDROID_GPU");
        if (!string.IsNullOrWhiteSpace(forced))
        {
            return forced.Trim().ToLowerInvariant();
        }
        return "host";
    }

    /// <summary>config.ini 里与性能有关的键。老 AVD 也要能升级到新值，所以单独抽出来。</summary>
    public IReadOnlyDictionary<string, string> PerformanceKeys() => new Dictionary<string, string>
    {
        ["hw.cpu.ncore"] = CpuCores.ToString(),
        ["hw.ramSize"] = RamMegabytes.ToString(),
        ["vm.heapSize"] = "1024",
        ["hw.gpu.enabled"] = "yes",
        ["hw.gpu.mode"] = GpuMode,
        // 关掉文件系统加密与自动同步，纯客户端场景用不到，省点 I/O
        ["disk.dataPartition.size"] = "6144M"
    };

    /// <summary>
    /// 当前实际可用的 CPU 虚拟化后端。
    ///
    /// AEHD（Android Emulator Hypervisor Driver）是 Google 给 AMD/Intel 写的裸机驱动，
    /// 在 AMD 上比 WHPX 快一档；两者互斥，装了 Hyper-V 就只能用 WHPX。
    /// 这个值只用于向用户解释性能差异，不参与启动决策。
    /// </summary>
    public static string DetectAccelerator()
    {
        if (ServiceExists("aehd") || ServiceExists("gvm"))
        {
            return "aehd";
        }
        if (ServiceExists("vmcompute") || ServiceExists("hvservice"))
        {
            return "whpx";
        }
        return "unknown";
    }

    private static bool ServiceExists(string name)
    {
        try
        {
            using var key = Microsoft.Win32.Registry.LocalMachine
                .OpenSubKey($@"SYSTEM\CurrentControlSet\Services\{name}");
            return key is not null;
        }
        catch
        {
            return false;
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MemoryStatusEx
    {
        public uint Length;
        public uint MemoryLoad;
        public ulong TotalPhysical;
        public ulong AvailablePhysical;
        public ulong TotalPageFile;
        public ulong AvailablePageFile;
        public ulong TotalVirtual;
        public ulong AvailableVirtual;
        public ulong AvailableExtendedVirtual;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MemoryStatusEx buffer);

    private static ulong TotalPhysicalBytes()
    {
        var status = new MemoryStatusEx { Length = (uint)Marshal.SizeOf<MemoryStatusEx>() };
        return GlobalMemoryStatusEx(ref status) ? status.TotalPhysical : 0;
    }
}
