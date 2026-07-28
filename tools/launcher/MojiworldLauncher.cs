// Mojiworld launcher — tiny fire-and-forget desktop stub (v0.29.266).
// Double-click → the game is running in your browser:
//   1. If nothing is already serving on :8765, start `node serve.js 8765`
//      hidden from the game folder (the exe's own directory).
//   2. Open the default browser at the game URL.
//   3. If Node.js is missing entirely, offer the hosted raw.githack build.
// The spawned server outlives the stub on purpose — the next launch finds
// the port open and goes straight to the browser.
// Built by launcher/build_launcher.ps1 with the .NET Framework csc.exe that
// ships with every Windows install — no SDK required. Icon: the Steam app
// icon (steam/build/icon.ico), baked in via /win32icon.
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
[assembly: AssemblyCompany("Moji-world & DADPEH")]
[assembly: AssemblyProduct("Mojiworld")]
[assembly: AssemblyCopyright("(c) Moji-world & DADPEH")]
[assembly: AssemblyVersion("0.29.266.0")]
[assembly: AssemblyFileVersion("0.29.266.0")]

static class MojiworldLauncher
{
    const int PORT = 8765;
    const string HOSTED = "https://raw.githack.com/dpeh001-x/Mojiworld/main/mojiworld_game.html";
    static readonly string URL = "http://localhost:" + PORT + "/mojiworld_game.html";

    [STAThread]
    static void Main()
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
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
        // PATH scan (no child-process probing — spawning where.exe with a
        // redirected pipe is exactly the shape Defender heuristics dislike).
        var path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var dir in path.Split(';'))
        {
            try
            {
                var candidate = Path.Combine(dir.Trim(), "node.exe");
                if (dir.Trim().Length > 0 && File.Exists(candidate)) return candidate;
            }
            catch { }
        }
        return null;
    }
}
