// Mojiworld launcher — tiny fire-and-forget desktop stub (v0.29.266, live mode v0.30.433).
// Double-click → the game is running in your browser:
//   0. LIVE MODE (v0.30.433, per user "clicking on this app will always launch
//      the latest game"): if this folder carries an empty marker file named
//      .mojiworld-live, or a sibling folder named Mojiworld-live does, that
//      checkout is fetched and moved to origin/main first, and whatever server
//      is already holding :8765 is ended so the browser never gets a stale tree.
//      The dev working copy keeps no marker, so a plain checkout behaves as before.
//   1. If nothing is already serving on :8765, start `node serve.js 8765`
//      hidden from the game folder (the exe's own directory, or the live one).
//   2. Open the default browser at the game URL.
//   3. If Node.js is missing entirely, offer the hosted raw.githack build.
// The spawned server outlives the stub on purpose — the next launch finds
// the port open and goes straight to the browser (live mode restarts it).
// Built by tools/launcher/build_launcher.ps1 with the .NET Framework csc.exe
// that ships with every Windows install — no SDK required. Icon: the Steam
// app icon (steam/build/icon.ico), baked in via /win32icon.
using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

// Full version resource — a bare unsigned winexe with no metadata is a prime
// Defender false-positive (Wacatac-class heuristic). These attributes become
// the exe's Details tab.
[assembly: AssemblyTitle("Mojiworld Launcher")]
[assembly: AssemblyDescription("Starts the local Mojiworld server and opens the game in your browser")]
[assembly: AssemblyCompany("Moji-studios & DADPEH")]
[assembly: AssemblyProduct("Mojiworld")]
[assembly: AssemblyCopyright("(c) Moji-studios & DADPEH")]
[assembly: AssemblyVersion("0.30.433.0")]
[assembly: AssemblyFileVersion("0.30.433.0")]

static class MojiworldLauncher
{
    const int PORT = 8765;
    const string HOSTED = "https://raw.githack.com/dpeh001-x/Mojiworld/main/mojiworld_game.html";
    const string LIVE_MARKER = ".mojiworld-live";
    const string LIVE_SIBLING = "Mojiworld-live";
    static readonly string URL = "http://localhost:" + PORT + "/mojiworld_game.html";

    [STAThread]
    static void Main()
    {
        string exeDir = AppDomain.CurrentDomain.BaseDirectory;
        string live = ResolveLive(exeDir);
        string root = live ?? exeDir;
        if (live != null)
        {
            LiveUpdate(live);
            if (PortOpen()) FreePort();
        }
        if (!File.Exists(Path.Combine(root, "mojiworld_game.html")))
        {
            MessageBox.Show(
                "mojiworld_game.html was not found next to the launcher.\n\n" +
                "Put Mojiworld.exe in the game folder (the repo root).",
                "Mojiworld", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }
        if (!PortOpen())
        {
            string node = FindNode();
            if (node == null)
            {
                var pick = MessageBox.Show(
                    "Node.js was not found, so the local server can't start.\n" +
                    "(The game must be served over http — file:// breaks sprite pixel reads.)\n\n" +
                    "Open the hosted build in your browser instead?",
                    "Mojiworld", MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
                if (pick == DialogResult.Yes) Open(HOSTED);
                return;
            }
            var psi = new ProcessStartInfo
            {
                FileName = node,
                Arguments = "serve.js " + PORT,
                WorkingDirectory = root,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            try { Process.Start(psi); }
            catch (Exception e)
            {
                MessageBox.Show("Could not start the local server:\n" + e.Message,
                    "Mojiworld", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            for (int i = 0; i < 40 && !PortOpen(); i++) Thread.Sleep(150);
            if (!PortOpen())
            {
                MessageBox.Show("The local server did not come up on port " + PORT + ".",
                    "Mojiworld", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
        }
        Open(URL);
    }

    // The live checkout, if any: this folder when it carries the marker, else a
    // sibling folder named Mojiworld-live that carries it. Null means "serve the
    // exe's own folder", the pre-v0.30.433 behaviour.
    static string ResolveLive(string exeDir)
    {
        try
        {
            if (File.Exists(Path.Combine(exeDir, LIVE_MARKER))) return exeDir;
            string parent = Path.GetDirectoryName(exeDir.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
            if (parent == null) return null;
            string sib = Path.Combine(parent, LIVE_SIBLING);
            if (File.Exists(Path.Combine(sib, LIVE_MARKER)) && File.Exists(Path.Combine(sib, "serve.js"))) return sib;
        }
        catch { }
        return null;
    }

    // Fetch and move the live checkout to origin/main. Best effort: with no git,
    // no network or a slow fetch the launcher still serves whatever is checked out.
    static void LiveUpdate(string live)
    {
        string git = FindGit();
        if (git == null) return;
        Run(git, "fetch origin -q", live, 90000);
        Run(git, "checkout -q --detach origin/main", live, 30000);
    }

    // End whatever process holds :PORT (a server started from an older tree keeps
    // serving that tree). Done through cmd's own pipeline so this process opens
    // no redirected pipes of its own.
    static void FreePort()
    {
        Run("cmd.exe",
            "/c for /f \"tokens=5\" %p in ('netstat -ano ^| findstr /c:\":" + PORT + " \" ^| findstr LISTENING') do taskkill /PID %p /F",
            null, 15000);
        for (int i = 0; i < 30 && PortOpen(); i++) Thread.Sleep(100);
    }

    static void Run(string file, string args, string cwd, int timeoutMs)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = file,
                Arguments = args,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            if (cwd != null) psi.WorkingDirectory = cwd;
            using (var p = Process.Start(psi))
            {
                if (p != null && !p.WaitForExit(timeoutMs)) { try { p.Kill(); } catch { } }
            }
        }
        catch { }
    }

    static void Open(string url)
    {
        Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
    }

    static bool PortOpen()
    {
        try
        {
            using (var c = new TcpClient())
            {
                var r = c.BeginConnect("127.0.0.1", PORT, null, null);
                if (!r.AsyncWaitHandle.WaitOne(250)) return false;
                c.EndConnect(r);
                return true;
            }
        }
        catch { return false; }
    }

    static string FindNode()
    {
        string[] fixedPaths =
        {
            @"C:\Program Files\nodejs\node.exe",
            @"C:\Program Files (x86)\nodejs\node.exe",
            Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\Programs\nodejs\node.exe"),
        };
        foreach (var p in fixedPaths) if (File.Exists(p)) return p;
        return FindOnPath("node.exe");
    }

    static string FindGit()
    {
        string[] fixedPaths =
        {
            @"C:\Program Files\Git\cmd\git.exe",
            @"C:\Program Files\Git\bin\git.exe",
            Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\Programs\Git\cmd\git.exe"),
        };
        foreach (var p in fixedPaths) if (File.Exists(p)) return p;
        return FindOnPath("git.exe");
    }

    // PATH scan (no child-process probing — spawning where.exe with a
    // redirected pipe is exactly the shape Defender heuristics dislike).
    static string FindOnPath(string exe)
    {
        var path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var dir in path.Split(';'))
        {
            try
            {
                var candidate = Path.Combine(dir.Trim(), exe);
                if (dir.Trim().Length > 0 && File.Exists(candidate)) return candidate;
            }
            catch { }
        }
        return null;
    }
}
