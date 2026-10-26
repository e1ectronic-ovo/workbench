using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Text.RegularExpressions;

namespace Whaletide.Desktop.Android;

/// <summary>
/// 客户端自带 Android 运行时的安装与定位。
///
/// 不依赖 Android Studio / JDK / sdkmanager：Google 的仓库索引是公开 XML，
/// 按包坐标直接下 zip 再解压。装到 %LOCALAPPDATA%\Whaletide\android-sdk，
/// 用户装完客户端就能用，不需要额外装任何东西。
/// </summary>
public sealed class AndroidSdk
{
    private const string Repo = "https://dl.google.com/android/repository";
    private const string ApiLevel = "android-34";
    private const string Tag = "google_apis";
    private const string Abi = "x86_64";
    private const string EmulatorPort = "5554";

    public string Root { get; }
    public string AdbPath => Path.Combine(Root, "platform-tools", "adb.exe");
    public string EmulatorPath => Path.Combine(Root, "emulator", "emulator.exe");
    public string ImageDir => Path.Combine(Root, "system-images", ApiLevel, Tag, Abi);
    public string AvdName => "whaletide";
    public string Serial => $"emulator-{EmulatorPort}";
    public string AvdDir => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".android", "avd", $"{AvdName}.avd");

    public AndroidSdk()
    {
        var overridden = Environment.GetEnvironmentVariable("WHALETIDE_ANDROID_SDK");
        Root = string.IsNullOrWhiteSpace(overridden)
            ? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Whaletide",
                "android-sdk")
            : overridden;
    }

    public bool IsInstalled =>
        File.Exists(AdbPath) &&
        File.Exists(EmulatorPath) &&
        File.Exists(Path.Combine(ImageDir, "system.img"));

    public bool HasAvd => File.Exists(Path.Combine(AvdDir, "config.ini"));

    public object Describe() => new
    {
        root = Root,
        installed = IsInstalled,
        hasAvd = HasAvd,
        adb = AdbPath,
        emulator = EmulatorPath,
        apiLevel = ApiLevel,
        image = $"{ApiLevel} {Tag} {Abi}"
    };

    /// <summary>
    /// 首次运行：下载 platform-tools / emulator / 系统镜像并写出 AVD 配置。
    /// 进度通过回调上报（下载体积较大，必须给用户可见反馈）。
    /// </summary>
    public async Task EnsureAsync(IProgress<string>? progress = null, CancellationToken token = default)
    {
        Directory.CreateDirectory(Root);
        var cache = Path.Combine(Root, ".cache");
        Directory.CreateDirectory(cache);

        if (!IsInstalled)
        {
            progress?.Report("读取 Google 仓库索引…");
            using var http = CreateHttpClient();
            var repoXml = await http.GetStringAsync($"{Repo}/repository2-3.xml", token);
            var sysXml = await http.GetStringAsync($"{Repo}/sys-img/{Tag}/sys-img2-3.xml", token);

            var jobs = new[]
            {
                ("platform-tools", PickUrl(repoXml, "platform-tools"), $"{Repo}/", Path.Combine(Root, "platform-tools")),
                ("emulator", PickUrl(repoXml, "emulator"), $"{Repo}/", Path.Combine(Root, "emulator")),
                // 系统镜像不在仓库根下，在 sys-img/<tag>/ 下
                ("system-image", PickUrl(sysXml, $"system-images;{ApiLevel};{Tag};{Abi}"), $"{Repo}/sys-img/{Tag}/", ImageDir)
            };

            foreach (var (name, url, baseUrl, dest) in jobs)
            {
                token.ThrowIfCancellationRequested();
                var zip = Path.Combine(cache, $"{name}.zip");
                if (!File.Exists(zip) || new FileInfo(zip).Length < 1024 * 1024)
                {
                    await DownloadAsync(http, $"{baseUrl}{url}", zip, name, progress, token);
                }
                else
                {
                    progress?.Report($"{name} 已有缓存，直接解压");
                }

                progress?.Report($"解压 {name}…");
                // 三个包的 zip 根目录分别是 platform-tools/、emulator/、x86_64/，
                // 因此都解压到目标目录的父级，包名目录由 zip 自己提供。
                var target = Path.GetDirectoryName(dest) ?? Root;
                Directory.CreateDirectory(target);
                ExtractZip(zip, target);
            }
        }

        WriteAvd();
        progress?.Report("运行时已就绪");
    }

    private static HttpClient CreateHttpClient()
    {
        var handler = new HttpClientHandler { AllowAutoRedirect = true };
        var http = new HttpClient(handler) { Timeout = TimeSpan.FromMinutes(30) };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("Whaletide/1.0");
        return http;
    }

    private static async Task DownloadAsync(
        HttpClient http,
        string url,
        string dest,
        string label,
        IProgress<string>? progress,
        CancellationToken token)
    {
        progress?.Report($"下载 {label}…");
        using var response = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, token);
        response.EnsureSuccessStatusCode();

        var total = response.Content.Headers.ContentLength ?? 0;
        await using var source = await response.Content.ReadAsStreamAsync(token);
        await using var target = File.Create(dest);

        var buffer = new byte[81920];
        long received = 0;
        var lastReport = DateTime.UtcNow;

        int read;
        while ((read = await source.ReadAsync(buffer, token)) > 0)
        {
            await target.WriteAsync(buffer.AsMemory(0, read), token);
            received += read;

            if (DateTime.UtcNow - lastReport > TimeSpan.FromSeconds(3))
            {
                lastReport = DateTime.UtcNow;
                var percent = total > 0 ? received * 100.0 / total : 0;
                progress?.Report(total > 0
                    ? $"下载 {label} {received / 1048576.0:F0}/{total / 1048576.0:F0} MB（{percent:F0}%）"
                    : $"下载 {label} {received / 1048576.0:F0} MB");
            }
        }
    }

    private static void ExtractZip(string zipPath, string destDir)
    {
        // 目标目录可能已有旧文件（换版本时），覆盖式解压
        using var archive = ZipFile.OpenRead(zipPath);
        foreach (var entry in archive.Entries)
        {
            if (string.IsNullOrEmpty(entry.Name))
            {
                continue;
            }

            var full = Path.GetFullPath(Path.Combine(destDir, entry.FullName));
            if (!full.StartsWith(Path.GetFullPath(destDir), StringComparison.OrdinalIgnoreCase))
            {
                continue; // 防目录穿越
            }

            Directory.CreateDirectory(Path.GetDirectoryName(full)!);
            entry.ExtractToFile(full, overwrite: true);
        }
    }

    /// <summary>从仓库 XML 里取指定包的 Windows 归档地址。</summary>
    private static string PickUrl(string xml, string packagePath)
    {
        var marker = $"<remotePackage path=\"{packagePath}\">";
        var index = xml.IndexOf(marker, StringComparison.Ordinal);
        if (index < 0)
        {
            throw new InvalidOperationException($"Google 仓库里找不到 {packagePath}");
        }

        var end = xml.IndexOf("</remotePackage>", index, StringComparison.Ordinal);
        var block = xml[index..end];
        var urls = Regex.Matches(block, "<url>([^<]+)</url>")
            .Select(m => m.Groups[1].Value)
            .ToList();

        // 主机相关的包（platform-tools / emulator）挑 windows 那个；
        // 系统镜像不分平台，归档名里没有 win，直接取第一个。
        // 注意 darwin 里也含 "win"，不能用 Contains("win") 判断
        var win = urls.FirstOrDefault(u =>
            u.EndsWith("-win.zip", StringComparison.OrdinalIgnoreCase) ||
            u.Contains("windows_", StringComparison.OrdinalIgnoreCase));
        if (win is not null)
        {
            return win;
        }
        if (urls.Count > 0)
        {
            return urls[0];
        }
        throw new InvalidOperationException($"{packagePath} 没有可用归档");
    }

    /// <summary>写出私有 AVD：竖屏 1080×1920，短剧类应用按竖屏出片。</summary>
    public void WriteAvd()
    {
        var avdHome = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".android", "avd");
        Directory.CreateDirectory(AvdDir);

        var config = string.Join('\n', new[]
        {
            "avd.ini.encoding=UTF-8",
            $"AvdId={AvdName}",
            $"avd.ini.displayname={AvdName}",
            $"image.sysdir.1=system-images/{ApiLevel}/{Tag}/{Abi}/",
            $"tag.id={Tag}",
            $"tag.display={Tag}",
            $"abi.type={Abi}",
            $"hw.cpu.arch={Abi}",
            "hw.cpu.ncore=4",
            "hw.lcd.width=1080",
            "hw.lcd.height=1920",
            "hw.lcd.density=420",
            "hw.ramSize=3072",
            "vm.heapSize=512",
            "hw.keyboard=yes",
            "hw.gpu.enabled=yes",
            "hw.gpu.mode=auto",
            "disk.dataPartition.size=4096M",
            "fastboot.forceColdBoot=no",
            "showDeviceFrame=no",
            "PlayStore.enabled=false",
            "skin.dynamic=yes"
        });
        File.WriteAllText(Path.Combine(AvdDir, "config.ini"), config + "\n");

        var ini = string.Join('\n', new[]
        {
            "avd.ini.encoding=UTF-8",
            $"path={AvdDir.Replace('\\', '/')}",
            $"path.rel=avd/{AvdName}.avd",
            $"target={ApiLevel}"
        });
        Directory.CreateDirectory(avdHome);
        File.WriteAllText(Path.Combine(avdHome, $"{AvdName}.ini"), ini + "\n");
    }
}
